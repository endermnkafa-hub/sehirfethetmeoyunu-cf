import React, { useState } from 'react';
import { Wrench, X, Plus, Sparkles, User, Shield, Flame } from 'lucide-react';

export default function DebugModal({
  isOpen,
  onClose,
  players,
  activePlayer,
  onSwitchPlayer,
  onAddPoints,
  onInstantExpand,
  onSetFixedRoll,
  fixedRoll,
  wallAttack1Hit,
  setWallAttack1Hit,
  onEliminatePlayer,
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(activePlayer?.id || 1);
  const [customPoints, setCustomPoints] = useState(20);
  const [customInstant, setCustomInstant] = useState(15);

  if (!isOpen) return null;

  const foundTarget = players.find(p => p.id === selectedPlayerId && p.alive);
  const targetPlayer = foundTarget || activePlayer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-sm sm:max-w-md w-full border-4 border-amber-400 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-xl">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-800 leading-tight">
                🛠️ Hile & Test Paneli
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                İstediğin oyuncuyu seçip test yapabilirsin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 py-3">
          
          {/* 1. Target Player Selector */}
          <div>
            <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={14} className="text-blue-600" />
              <span>İşlem Yapılacak Oyuncuyu Seç</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {players.map((p) => {
                const isSelected = p.id === targetPlayer.id;
                const isActive = p.id === activePlayer.id;
                const isDead = !p.alive;
                return (
                  <button
                    key={p.id}
                    disabled={isDead}
                    onClick={() => !isDead && setSelectedPlayerId(p.id)}
                    className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                      isDead
                        ? 'bg-stone-100 border-stone-200 opacity-45 cursor-not-allowed'
                        : isSelected
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-300 shadow-sm'
                        : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.hex }}
                      />
                      <span className="text-xs font-black truncate">{p.name}</span>
                    </div>
                    <div className="text-[10px] text-stone-500 flex items-center justify-between">
                      {isDead ? (
                        <span className="font-extrabold text-red-600">💀 Elendi</span>
                      ) : isActive ? (
                        <span className="font-extrabold text-blue-600 bg-blue-50 px-1 rounded">Sırada</span>
                      ) : (
                        <span>Bekliyor</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Button to Give Turn to Target */}
            {targetPlayer.id !== activePlayer.id && (
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => {
                    const targetIdx = players.findIndex(p => p.id === targetPlayer.id);
                    if (targetIdx !== -1) onSwitchPlayer(targetIdx);
                  }}
                  className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black transition flex items-center justify-center gap-1"
                >
                  <span>⏩ Sırayı Ver</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`${targetPlayer.name} oyuncusunu tamamen fethedip öldürmek/elemek istediğine emin misin?`)) {
                      onEliminatePlayer(targetPlayer.id);
                      onClose();
                    }
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>⚔️ Anında Öldür (Ele)</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Direct Instant Map Expansion */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
            <label className="block text-xs font-black text-stone-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Flame size={14} className="text-red-500" />
              <span>Haritada Doğrudan Büyüt ({targetPlayer.name})</span>
            </label>
            <p className="text-[11px] text-stone-500 mb-2">
              Kareleri tek tek boyamadan, haritaya otomatik olarak direkt ekler.
            </p>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[10, 25, 50, 100].map(amt => (
                <button
                  key={amt}
                  onClick={() => onInstantExpand(targetPlayer.id, amt)}
                  className="py-1.5 text-xs font-black bg-white hover:bg-red-50 text-red-600 border border-stone-200 rounded-xl transition shadow-xs active:scale-95"
                >
                  +{amt} Kare
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="500"
                value={customInstant}
                onChange={e => setCustomInstant(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="w-20 p-2 text-xs font-bold text-center border border-stone-300 bg-white rounded-xl"
              />
              <button
                onClick={() => onInstantExpand(targetPlayer.id, Math.max(1, Number(customInstant) || 1))}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md transition"
              >
                Anında {Math.max(1, Number(customInstant) || 1)} Kare Ekle
              </button>
            </div>
          </div>

          {/* 3. Add Paint / Expansion Points */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
            <label className="block text-xs font-black text-stone-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Plus size={14} className="text-green-600" />
              <span>Elle Boyama Hakkı Ekle (Puan)</span>
            </label>
            <p className="text-[11px] text-stone-500 mb-2">
              Seçilen oyuncunun sırasını başlatır ve boyamak için hak tanımlar.
            </p>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[5, 15, 30, 60].map(pt => (
                <button
                  key={pt}
                  onClick={() => {
                    const targetIdx = players.findIndex(p => p.id === targetPlayer.id);
                    onAddPoints(pt, targetIdx !== -1 ? targetIdx : undefined);
                  }}
                  className="py-1.5 text-xs font-black bg-white hover:bg-green-50 text-green-700 border border-stone-200 rounded-xl transition shadow-xs active:scale-95"
                >
                  +{pt} Hak
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="300"
                value={customPoints}
                onChange={e => setCustomPoints(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
                className="w-20 p-2 text-xs font-bold text-center border border-stone-300 bg-white rounded-xl"
              />
              <button
                onClick={() => {
                  const targetIdx = players.findIndex(p => p.id === targetPlayer.id);
                  const safePts = Math.max(1, Number(customPoints) || 1);
                  onAddPoints(safePts, targetIdx !== -1 ? targetIdx : undefined);
                }}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-black text-xs rounded-xl shadow-md transition"
              >
                {Math.max(1, Number(customPoints) || 1)} Boyama Hakkı Ver
              </button>
            </div>
          </div>

          {/* 4. Rig the Wheel */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
            <label className="block text-xs font-black text-stone-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-600" />
              <span>Çark Sonucunu Sabitle</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => onSetFixedRoll(fixedRoll === num ? null : num)}
                  className={`py-1.5 text-xs font-black rounded-xl border transition ${
                    fixedRoll === num
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            {fixedRoll !== null ? (
              <p className="text-[11px] text-amber-700 font-bold mt-1.5">
                ✓ Sonraki çark kesinlikle <strong>{fixedRoll}</strong> gelecek! (İptal etmek için tekrar tıkla)
              </p>
            ) : (
              <p className="text-[10px] text-stone-400 mt-1">
                Şu an çark rastgele (%100 doğal).
              </p>
            )}
          </div>

          {/* 5. Wall Attack Mode (Sur Savunma Kuralı) */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
            <label className="block text-xs font-black text-stone-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Shield size={14} className="text-blue-600" />
              <span>Sur Yıkma & Fetih Kuralı</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWallAttack1Hit(false)}
                className={`p-2 rounded-xl border text-xs font-black transition text-left flex flex-col justify-between ${
                  !wallAttack1Hit
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-300'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span>🛡️ Standart (2 Hak)</span>
                <span className="text-[10px] font-medium text-stone-500 mt-1">
                  1 Hak Sur Yıkma + 1 Hak Fetih
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWallAttack1Hit(true)}
                className={`p-2 rounded-xl border text-xs font-black transition text-left flex flex-col justify-between ${
                  wallAttack1Hit
                    ? 'bg-amber-50 border-amber-600 text-amber-900 ring-2 ring-amber-300'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span>⚡ Hızlı (1 Hak)</span>
                <span className="text-[10px] font-medium text-stone-500 mt-1">
                  Tek saldırıda hem sur yıkılır hem fethedilir
                </span>
              </button>
            </div>
          </div>

        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-3 bg-stone-800 hover:bg-stone-900 text-white font-black text-xs rounded-xl transition shadow-md"
        >
          Paneli Kapat
        </button>
      </div>
    </div>
  );
}
