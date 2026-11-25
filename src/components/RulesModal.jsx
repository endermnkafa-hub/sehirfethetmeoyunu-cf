import React from 'react';
import { BookOpen, X, CheckCircle, AlertTriangle, Shield, Dices } from 'lucide-react';

export default function RulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border-4 border-blue-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-stone-800">Oyun Kuralları</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 py-4 text-stone-700 text-sm leading-relaxed">
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
            <h3 className="font-bold text-blue-900 flex items-center gap-1.5 mb-1">
              <Dices size={16} /> 1. Sayı Söyleme & Çark Mekaniği
            </h3>
            <p>
              Sırası gelen oyuncu <strong>1 ile 9 arasında</strong> bir sayı söyler. Ardından oyun çarkı döndürür (0 - 9).
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li><strong>Oyuncunun Sayısı ≤ Çark:</strong> KAZANDIN! İki sayı çarpılır (S × Çark) ve o kadar kare <strong>büyürsün</strong>.</li>
              <li><strong>Oyuncunun Sayısı &gt; Çark:</strong> KAYBETTİN! Sayılar çarpılır ve o kadar kare <strong>küçülürsün</strong>.</li>
              <li><strong>Çark 0 Gelirse:</strong> Ne kazanç ne kayıp, tur pas geçer.</li>
            </ul>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <h3 className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
              <Shield size={16} /> 2. Güvenli Sayı Sınırı
            </h3>
            <p className="text-xs">
              Eksiye düşüp oyundan elenmemen için sistem söyleyebileceğin maksimum sayıyı otomatik hesaplar:
              <br />
              <strong>Kural:</strong> S × (S - 1) &lt; Toplam Alan.
              <br />
              Örn: 9 karen varsa en fazla <strong>3</strong> söyleyebilirsin (4 söylersen en kötü ihtimalde 4 × 3 = 12 kaybedip -3'e düşersin).
            </p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <h3 className="font-bold text-amber-900 flex items-center gap-1.5 mb-1">
              <CheckCircle size={16} /> 3. Büyüme & Toprak Bütünlüğü
            </h3>
            <p className="text-xs">
              * Büyürken sadece <strong>kendi sınırlarına komşu</strong> kareleri boyayabilirsin ve arada <strong>boşluk (delik)</strong> bırakamazsın.
              <br />
              * Rakibin sınırlarına saldırarak topraklarını fethedebilirsin (Savaş). İki tarafında rakip varken çaprazdan iç içe geçiş yapılamaz.
              <br />
              * <strong>Modern Mod:</strong> Dış sınırına <strong>Sur (🛡️)</strong> örebilir, müttefiklerine <strong>toprak hibe edebilir</strong> veya <strong>haraç/vergi</strong> anlaşması kurabilirsin!
            </p>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl">
            <h3 className="font-bold text-purple-900 flex items-center gap-1.5 mb-1">
              <AlertTriangle size={16} /> 4. İttifak & Diplomasi
            </h3>
            <p className="text-xs">
              * Oyuncular birbirine süreli (örn: 3 tur) veya kalıcı ittifak teklif edebilir.
              <br />
              * Anlaşma sırasında <strong>Bozma Cezası</strong> belirlenir. İttifaklı olduğun birine saldırırsan anlaşmayı bozarsın ve belirlenen ceza kadar toprağın tarafsız hale gelir!
              <br />
              * Kalıcı ittifaklar iki tarafın rızasıyla <strong>cezasız barışçıl şekilde</strong> feshedilebilir.
            </p>
          </div>

        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition"
        >
          Anladım, Oyuna Başla!
        </button>
      </div>
    </div>
  );
}
