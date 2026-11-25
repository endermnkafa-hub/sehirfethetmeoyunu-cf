import React from 'react';
import { Globe, Grid, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';

export default function ModeSelection({
  onSelectMode, // 'WORLD' | 'FLAT'
  savedWorldGame,
  savedFlatGame,
  onResumeFlatGame,
  onResumeWorldGame,
}) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-stone-900 to-zinc-950 text-white flex flex-col justify-between p-4 sm:p-8 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="max-w-4xl mx-auto w-full text-center pt-2 sm:pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs sm:text-sm font-black tracking-wider uppercase mb-3 shadow-inner">
          <Sparkles size={16} className="animate-pulse" />
          <span>Büyük Strateji & Fetih Arenası</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md">
          ŞEHİR & TOPRAK <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent">FETHİ</span>
        </h1>
        <p className="text-xs sm:text-sm text-stone-400 mt-2 max-w-lg mx-auto font-medium">
          Oynamak istediğin harita türünü ve oyun modunu seç, fethe başla!
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 my-6">
        
        {/* Card 1: Dev Dünya Haritası (Askerli Fetih Seferi) */}
        <div
          onClick={() => onSelectMode('WORLD')}
          className="group relative bg-gradient-to-b from-stone-800/90 to-stone-900/95 border-2 border-amber-500/40 hover:border-amber-400 rounded-3xl p-5 sm:p-7 shadow-2xl hover:shadow-amber-500/20 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1 overflow-hidden"
        >
          {/* Glowing background ambient */}
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/25 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 text-stone-950 font-black text-[11px] tracking-wide uppercase shadow-md">
                <Globe size={13} />
                ORTAK DÜNYA • GERÇEK ZAMANLI
              </span>
              {savedWorldGame && (
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold">
                  💾 Devletin Var
                </span>
              )}
            </div>

            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-stone-950 shadow-lg group-hover:scale-105 transition">
                <Globe size={32} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white group-hover:text-amber-400 transition">
                  Dev Dünya Haritası
                </h2>
                <div className="text-xs text-amber-300/80 font-bold">
                  Tek Ortak Dünya • Kendi Resmin • Canlı Fetih
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed mb-5 font-normal">
              Herkesin gördüğü tek ve devasa bir gri dünya haritası! Sahipsiz bir piksele tıkla ve kendi fotoğrafınla devletini kur. Toprağına göre saniye başı asker üret, sınırlarını genişlet!
            </p>

            {/* Feature Bullets */}
            <div className="space-y-2.5 mb-6 text-xs text-stone-300">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  🗺️
                </div>
                <span><strong>Devasa Gri Dünya:</strong> Sahipsiz bir piksele tıklayarak kendi devletini kurduğun devasa dünya haritası.</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  ⏱️
                </div>
                <span><strong>Saniye Başı Asker:</strong> Tur yok! 1 piksel = 1/60 asker/sn. Kapasiten toprak sayına eşittir.</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  🖼️
                </div>
                <span><strong>Özel Resim:</strong> Kendi yüklediğin resim, ülken 1 piksel bile olsa tamamıyla haritada görünür.</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  🛡️
                </div>
                <span><strong>Adil Katılım:</strong> 1 cihaz = 1 ülke, aynı IP = max 2 ülke. VPN ve Proxy kullanımı yasaktır.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-stone-700/60">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('WORLD');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 group-hover:from-amber-400 group-hover:to-orange-500 text-stone-950 font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>{savedWorldGame ? 'Devletine Git / Haritaya Katıl' : 'Dünya Haritasına Katıl'}</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition" />
            </button>
          </div>
        </div>

        {/* Card 2: Düz Harita / Klasik Mod (Lokal & Özel Oda) */}
        <div
          onClick={() => onSelectMode('FLAT')}
          className="group relative bg-gradient-to-b from-stone-800/90 to-stone-900/95 border-2 border-stone-700 hover:border-blue-400 rounded-3xl p-5 sm:p-7 shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1 overflow-hidden"
        >
          {/* Glowing background ambient */}
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/25 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500 text-white font-black text-[11px] tracking-wide uppercase shadow-md">
                <Grid size={13} />
                SIRA TABANLI • TAKTİKSEL ÇARK
              </span>
              {savedFlatGame && (
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold">
                  💾 Kayıtlı Oyun Var
                </span>
              )}
            </div>

            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition">
                <Grid size={32} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white group-hover:text-blue-400 transition">
                  Düz Harita (Klasik)
                </h2>
                <div className="text-xs text-blue-300/80 font-bold">
                  Çark Çevirme • Duvarlar • Lokal & Özel Online Oda
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed mb-5 font-normal">
              Özelleştirilebilir ızgara üzerinde sırayla çark çevirerek sınırlarını genişlet. Taş duvarlar ör, diplomatik ittifaklar kur veya arkadaşlarınla tek telefondan / özel oda koduyla kapış!
            </p>

            {/* Feature Bullets */}
            <div className="space-y-2.5 mb-6 text-xs text-stone-300">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  🎲
                </div>
                <span><strong>Çark Sistemi:</strong> 1-6 arası sayını seç, çarkı çevir ve topraklarını fırçala.</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  🏰
                </div>
                <span><strong>Modern Mod:</strong> Sınırlarına taş duvarlar örerek rakiplerin akınlarını durdur.</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  🤖
                </div>
                <span><strong>Akıllı Botlar:</strong> Haraç isteyen, süper güce karşı koalisyon kuran zeki yapay zeka.</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  📱
                </div>
                <span><strong>Çoklu Oyuncu:</strong> Tek telefondan (Pass & Play) veya 5 haneli kodla online düello.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-stone-700/60">
            {savedFlatGame && onResumeFlatGame && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResumeFlatGame();
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={15} />
                <span>Kaldığın Yerden Devam Et (Tur {savedFlatGame.roundNumber || 1})</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('FLAT');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-500 text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Düz Haritada Oyna</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition" />
            </button>
          </div>
        </div>

      </div>

      {/* Footer info */}
      <div className="text-center text-stone-500 text-xs font-semibold pb-2">
        Şehir & Toprak Fethi v2.0 • Web & Android Mobil Uyumlu
      </div>
    </div>
  );
}
