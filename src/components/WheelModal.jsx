import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function WheelModal({
  isOpen,
  chosenNumber,
  activePlayer,
  onFinish,
  fixedRoll = null,
  isMyTurn = true,
  rollData = null,
}) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [applyTransition, setApplyTransition] = useState(false);
  const [resultNumber, setResultNumber] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const tickTimerRef = useRef(null);
  const finishTimerRef = useRef(null);

  const clearSpinTimers = () => {
    if (tickTimerRef.current) {
      clearTimeout(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const segments = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const numSegments = segments.length;
  const segmentAngle = 360 / numSegments; // 36 deg

  useEffect(() => {
    if (isOpen) {
      clearSpinTimers();
      setResultNumber(null);
      setOutcome(null);
      setShowResult(false);
      setIsSpinning(false);
      setApplyTransition(false);
      setRotation(0); // Clean reset to zero

      // Give browser time to paint rotation: 0 before starting transition
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          startSpin();
        });
      }, 100);

      return () => {
        clearTimeout(timer);
        clearSpinTimers();
      };
    } else {
      clearSpinTimers();
    }
  }, [isOpen]);

  const startSpin = () => {
    setIsSpinning(true);
    soundManager.init();

    // Uniform or synchronized roll
    const array = new Uint32Array(1);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      array[0] = Math.floor(Math.random() * 1000000);
    }
    const target = (rollData && rollData.target !== undefined)
      ? rollData.target
      : (fixedRoll !== null ? fixedRoll : (array[0] % 10));

    // 10 to 12 full high-speed spins (synchronized if rollData has fullSpins)
    const fullSpins = (rollData && rollData.fullSpins !== undefined)
      ? rollData.fullSpins
      : (10 + (array[0] % 3));

    // Jitter: slight random offset within the 36-degree slice (+/- 10 deg) so it's natural
    const jitter = (rollData && rollData.jitter !== undefined)
      ? rollData.jitter
      : ((array[0] % 19) - 9); // between -9 and +9 degrees
    const targetAngle = 360 - (target * segmentAngle + segmentAngle / 2) + jitter;
    const totalRotation = fullSpins * 360 + targetAngle;

    setApplyTransition(true);
    setRotation(totalRotation);

    // Audio ticking sound with realistic inertia
    let delay = 35;
    let elapsed = 0;

    const playStep = () => {
      soundManager.playTick();
      elapsed += delay;

      if (elapsed < 2000) {
        delay = 40;
      } else if (elapsed < 3000) {
        delay += 25;
      } else if (elapsed < 3800) {
        delay += 65;
      } else {
        return;
      }

      tickTimerRef.current = setTimeout(playStep, delay);
    };

    tickTimerRef.current = setTimeout(playStep, delay);

    // 3.8s animation duration
    finishTimerRef.current = setTimeout(() => {
      clearSpinTimers();
      setIsSpinning(false);
      setResultNumber(target);

      if (target === 0) {
        setOutcome('draw');
      } else if (chosenNumber <= target) {
        setOutcome('win');
        soundManager.playWin();
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        setOutcome('lose');
        soundManager.playLose();
      }

      setShowResult(true);
    }, 3900);
  };

  if (!isOpen) return null;

  const segmentColors = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80',
    '#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc'
  ];

  const diff = resultNumber !== null ? chosenNumber * resultNumber : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="wheel-modal-card bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center border-4 border-amber-300 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto">
        
        {/* Wheel Graphic */}
        <div className="wheel-graphic-box relative w-64 h-64 my-2 flex items-center justify-center shrink-0">
          {/* Top Indicator Arrow */}
          <div className="absolute -top-3.5 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-red-600 drop-shadow-lg"></div>

          {/* SVG Rotating Wheel */}
          <div
            className="w-full h-full rounded-full shadow-2xl border-4 border-amber-400 overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: applyTransition ? 'transform 3.8s cubic-bezier(0.1, 0.96, 0.18, 1)' : 'none',
            }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {segments.map((seg, idx) => {
                const startAngle = (idx * segmentAngle * Math.PI) / 180;
                const endAngle = (((idx + 1) * segmentAngle) * Math.PI) / 180;
                const x1 = 50 + 50 * Math.sin(startAngle);
                const y1 = 50 - 50 * Math.cos(startAngle);
                const x2 = 50 + 50 * Math.sin(endAngle);
                const y2 = 50 - 50 * Math.cos(endAngle);

                const d = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;

                const textAngle = ((idx + 0.5) * segmentAngle * Math.PI) / 180;
                const tx = 50 + 34 * Math.sin(textAngle);
                const ty = 50 - 34 * Math.cos(textAngle);

                const isResultSeg = showResult && resultNumber === seg;

                return (
                  <g key={seg}>
                    <path
                      d={d}
                      fill={isResultSeg ? '#fef08a' : segmentColors[idx]}
                      stroke="#ffffff"
                      strokeWidth={isResultSeg ? '1.5' : '0.8'}
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill={isResultSeg ? '#854d0e' : '#1f2937'}
                      fontSize={isResultSeg ? '12' : '9.5'}
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${idx * segmentAngle + segmentAngle / 2}, ${tx}, ${ty})`}
                    >
                      {seg}
                    </text>
                  </g>
                );
              })}
              <circle cx="50" cy="50" r="13" fill="#ffffff" stroke="#d97706" strokeWidth="2.5" />
              <circle cx="50" cy="50" r="5" fill="#f59e0b" />
            </svg>
          </div>
        </div>

        {/* Info, Result & Action Column */}
        <div className="flex-1 w-full flex flex-col items-center justify-center">
          {/* Header */}
          <div className="mb-2 text-center">
            <div className="text-xs uppercase font-extrabold tracking-wider text-stone-500">
              {activePlayer.name} Hamlesi
            </div>
            <div className="text-lg font-black text-stone-800 flex items-center justify-center gap-2 mt-0.5">
              <span>Söylenen Sayı:</span>
              <span className="inline-block px-3 py-0.5 bg-blue-100 text-blue-700 rounded-xl text-xl font-black border border-blue-300">
                {chosenNumber}
              </span>
            </div>
          </div>

          {/* Result Area */}
          <div className="w-full min-h-[80px] flex flex-col items-center justify-center mt-1 text-center">
          {isSpinning && (
            <div className="text-stone-600 font-bold animate-pulse text-sm">
              Çark hızla dönüyor...
            </div>
          )}

          {showResult && outcome === 'win' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-2xl w-full text-green-800 animate-in zoom-in-90 duration-200">
              <div className="flex items-center justify-center gap-1.5 font-black text-lg text-green-600">
                <Sparkles size={20} />
                <span>
                  {isMyTurn
                    ? `KAZANDIN! (${chosenNumber} ≤ ${resultNumber})`
                    : `${activePlayer.name} KAZANDI! (${chosenNumber} ≤ ${resultNumber})`}
                </span>
              </div>
              <div className="text-sm mt-1">
                <span className="font-semibold">{chosenNumber} × {resultNumber} = </span>
                <span className="text-xl font-black text-green-700">+{diff} Kare</span>{' '}
                {isMyTurn ? 'büyüyeceksin!' : 'büyüyecek.'}
              </div>
            </div>
          )}

          {showResult && outcome === 'lose' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl w-full text-red-800 animate-in zoom-in-90 duration-200">
              <div className="flex items-center justify-center gap-1.5 font-black text-lg text-red-600">
                <AlertTriangle size={20} />
                <span>
                  {isMyTurn
                    ? `KAYBETTİN! (${chosenNumber} > ${resultNumber})`
                    : `${activePlayer.name} KAYBETTİ! (${chosenNumber} > ${resultNumber})`}
                </span>
              </div>
              <div className="text-sm mt-1">
                <span className="font-semibold">{chosenNumber} × {resultNumber} = </span>
                <span className="text-xl font-black text-red-700">-{diff} Kare</span>{' '}
                {isMyTurn ? 'küçüleceksin.' : 'küçülecek.'}
              </div>
            </div>
          )}

          {showResult && outcome === 'draw' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl w-full text-amber-800 animate-in zoom-in-90 duration-200">
              <div className="flex items-center justify-center gap-1.5 font-black text-lg text-amber-600">
                <ShieldCheck size={20} />
                <span>ÇARK 0 GELDİ!</span>
              </div>
              <div className="text-sm mt-1 font-bold">
                {isMyTurn
                  ? 'Ne kazanç ne kayıp! Turun değişmeden geçer.'
                  : `${activePlayer.name} için ne kazanç ne kayıp! Turu değişmeden geçer.`}
              </div>
            </div>
          )}
        </div>

        {/* Continue Button / Spectator Indicator */}
        {showResult && (
          isMyTurn ? (
            <button
              onClick={() => onFinish({ resultNumber, outcome, diff })}
              className={`w-full mt-4 py-3.5 px-6 rounded-2xl text-white font-black text-base shadow-lg transition active:scale-95 ${
                outcome === 'win'
                  ? 'bg-green-600 hover:bg-green-700'
                  : outcome === 'lose'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-stone-700 hover:bg-stone-800'
              }`}
            >
              {outcome === 'win' ? 'Topraklarını Boya ➔' : outcome === 'lose' ? 'Küçülmeyi Onayla ➔' : 'Sonraki Oyuncu ➔'}
            </button>
          ) : (
            <div className="w-full mt-4 py-3.5 px-4 bg-stone-100 border border-stone-200 text-stone-600 font-bold text-sm rounded-2xl flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span>{activePlayer.name} hamlesine devam ediyor, lütfen bekleyin...</span>
            </div>
          )
        )}
        </div>
      </div>
    </div>
  );
}
