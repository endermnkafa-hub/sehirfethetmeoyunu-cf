import React from 'react';
import { calculateMaxSafeNumber } from '../utils/gameLogic';
import { Dices, Check, RotateCcw, AlertCircle, Shield, PenTool } from 'lucide-react';

export default function TurnControls({
  gameMode = 'KLASIK',
  activePlayer,
  playerArea,
  turnPhase,
  chosenNumber,
  setChosenNumber,
  onStartSpin,
  placingMode = 'EXPAND',
  setPlacingMode,
  pendingCells,
  pendingWalls = [],
  totalToPlace,
  onFinishPlacing,
  onUndo,
  onOpenDiplomacy,
  actionMessage,
  isMyTurn = true,
  hasValidMoves = true,
}) {
  const maxSafe = calculateMaxSafeNumber(playerArea);
  const spent = (pendingCells ? pendingCells.reduce((sum, c) => sum + (c.cost || 1), 0) : 0) + (pendingWalls ? pendingWalls.length : 0);
  const remaining = totalToPlace - spent;

  return (
    <div className="turn-controls-panel w-full bg-white/95 backdrop-blur-md border-t-2 border-stone-200 shadow-2xl p-3 sm:p-4 z-20 shrink-0">
      <div className="max-w-2xl mx-auto flex flex-col gap-2.5">
        
        {/* Active Player Info Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
              style={{ backgroundColor: activePlayer.hex }}
            >
              {activePlayer.id}
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-stone-600 flex items-center gap-1.5">
                <span>Sıradaki Oyuncu</span>
                {gameMode === 'MODERN' && (
                  <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-black">
                    MODERN MOD
                  </span>
                )}
              </div>
              <div className="text-base font-black text-stone-800">
                {activePlayer.name}{' '}
                <span className="text-xs font-normal text-stone-500">
                  ({playerArea} Kare)
                </span>
              </div>
            </div>
          </div>

          {/* Diplomacy button */}
          <button
            onClick={onOpenDiplomacy}
            disabled={!isMyTurn}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition shadow-sm ${
              isMyTurn
                ? 'text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 active:scale-95'
                : 'text-stone-400 bg-stone-100/60 border border-stone-200 opacity-50 cursor-not-allowed'
            }`}
          >
            <Shield size={16} className={isMyTurn ? "text-amber-500" : "text-stone-400"} />
            <span>İttifak & Diplomasi</span>
          </button>
        </div>

        {/* Action Warning / Info Banner */}
        {actionMessage && (
          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* If active player is a bot */}
        {activePlayer.isBot ? (
          <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-2xl text-center space-y-1.5 shadow-sm animate-pulse">
            <div className="flex items-center justify-center gap-2 text-purple-900 font-black text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-ping" />
              <span>🤖 {activePlayer.name} (Yapay Zeka) Hamle Yapıyor...</span>
            </div>
            <p className="text-xs text-purple-700 font-medium">
              {turnPhase === 'PICK_NUMBER'
                ? 'Bot güvenli sayısını belirleyip çarkı çeviriyor...'
                : 'Bot harita genişleme ve savunma hamlelerini hesaplıyor...'}
            </p>
          </div>
        ) : !isMyTurn ? (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-center space-y-1.5 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-amber-900 font-black text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>Sıra Diğer Cihazda ({activePlayer.name} - {activePlayer.phoneId === 'HOST' ? '1. Telefon' : '2. Telefon'})</span>
            </div>
            <p className="text-xs text-stone-600 font-medium">
              {chosenNumber ? (
                <span>Seçtiği Sayı: <strong className="text-blue-700 text-sm font-black">{chosenNumber}</strong> &bull; Hamlesi ekranda anlık güncelleniyor.</span>
              ) : (
                'Diğer oyuncu çarkı çevirip hamlesini yaparken ekranınızda anlık olarak izleyebilirsiniz.'
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Phase 1: Pick Number */}
            {turnPhase === 'PICK_NUMBER' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">
                1 - 9 Arası Sayı Seçin:
              </span>
              <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                Güvenli Limit: <strong className="text-stone-800">{maxSafe}</strong>
              </span>
            </div>

            {/* 1-9 buttons */}
            <div className="number-grid-landscape grid grid-cols-9 gap-1 sm:gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                const isSafe = num <= maxSafe;
                const isSelected = chosenNumber === num;

                return (
                  <button
                    key={num}
                    disabled={!isSafe}
                    onClick={() => setChosenNumber(num)}
                    className={`h-11 sm:h-12 rounded-xl font-black text-base sm:text-lg flex flex-col items-center justify-center transition active:scale-95 border ${
                      !isSafe
                        ? 'bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed opacity-50'
                        : isSelected
                        ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                        : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-300 shadow-sm'
                    }`}
                  >
                    <span>{num}</span>
                    <span className="text-[8px] font-normal opacity-70">
                      {isSafe ? `-${num * (num - 1)}` : 'Risk'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Spin CTA Button */}
            <button
              onClick={onStartSpin}
              className="w-full mt-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-base rounded-2xl shadow-lg transition active:scale-98 flex items-center justify-center gap-2"
            >
              <Dices size={20} />
              <span>Sayıyı Söyle ({chosenNumber}) ve Çarkı Çevir!</span>
            </button>
          </div>
        )}

        {/* Phase 2: Placing Territory / Walls */}
        {turnPhase === 'PLACING' && (
          <div className="flex flex-col gap-2 animate-in fade-in duration-200">
            
            {/* Mode Switcher in Modern Mode */}
            {gameMode === 'MODERN' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPlacingMode('EXPAND')}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                    placingMode === 'EXPAND'
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                      : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                  }`}
                >
                  <PenTool size={14} />
                  <span>Toprak Fethet (1 Hak)</span>
                </button>
                <button
                  type="button"
                  disabled={remaining < 1}
                  onClick={() => setPlacingMode('WALL')}
                  className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                    remaining < 1
                      ? 'opacity-40 bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                      : placingMode === 'WALL'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                      : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                  }`}
                >
                  <Shield size={14} />
                  <span>Sur / Duvar Ör (1 Hak)</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-blue-800">
                  {placingMode === 'WALL' ? '🛡️ Sur İnşa Etme Modu:' : 'Büyüme Hakkın:'}
                </div>
                <div className="text-sm font-bold text-blue-950">
                  {placingMode === 'WALL'
                    ? 'Dış sınırındaki kendi karelerine dokunarak duvar çek (1 Hak).'
                    : 'Haritadaki boş veya rakip karelere dokunarak boya (1 Hak).'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-500">Kalan: </span>
                <span className="text-xl font-black text-blue-600">
                  {remaining}
                </span>
                <span className="text-xs text-stone-400"> / {totalToPlace}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={onUndo}
                disabled={(!pendingCells || pendingCells.length === 0) && (!pendingWalls || pendingWalls.length === 0)}
                className="px-4 py-3 bg-stone-200 hover:bg-stone-300 disabled:opacity-40 text-stone-700 font-bold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={16} />
                <span>Geri Al</span>
              </button>

              <button
                onClick={onFinishPlacing}
                disabled={remaining > 0 && hasValidMoves}
                className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-black text-base rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Check size={20} />
                <span>
                  {remaining === 0
                    ? 'Büyümeyi Onayla ve Turu Bitir'
                    : !hasValidMoves
                    ? 'Hamle Kalmadı — Turu Onayla'
                    : `${remaining} Puan Daha Harcamalısın`}
                </span>
              </button>
            </div>
          </div>
        )}
      </>
    )}
      </div>
    </div>
  );
}
