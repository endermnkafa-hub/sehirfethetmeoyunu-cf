import React, { useState, useEffect } from 'react';
import { Handshake, Check, X, Shield, Gift, Coins, AlertCircle } from 'lucide-react';

export default function DiplomacyModal({
  isOpen,
  onClose,
  gameMode = 'KLASIK',
  activePlayer,
  players,
  alliances,
  territoryCounts,
  onProposeAlliance,
  onCancelMutualAlliance,
  onTransferTerritory,
  onlineInfo = null,
  onSendOnlineProposal = null,
  onSendOnlineCancel = null,
  onAbortOnlineProposal = null,
  onAbortOnlineCancel = null,
}) {
  const [activeTab, setActiveTab] = useState('ALLIANCE'); // 'ALLIANCE' | 'TRANSFER'
  const [targetPlayerId, setTargetPlayerId] = useState(null);
  const [isPermanent, setIsPermanent] = useState(false);
  const [durationRounds, setDurationRounds] = useState(3);
  const [penaltyCells, setPenaltyCells] = useState(5);
  const [allianceType, setAllianceType] = useState('PEACE'); // 'PEACE' | 'TRIBUTE'
  const [tributeDirection, setTributeDirection] = useState('PAY'); // 'PAY' | 'DEMAND'
  const [tributePerRound, setTributePerRound] = useState(1);
  const [transferAmount, setTransferAmount] = useState(3);

  // States for confirmation dialogs
  const [pendingProposal, setPendingProposal] = useState(null);
  const [pendingCancelRequest, setPendingCancelRequest] = useState(null);
  const [pendingTransferRequest, setPendingTransferRequest] = useState(null);
  const [waitingForOnlineTarget, setWaitingForOnlineTarget] = useState(null);
  const [waitingForOnlineCancel, setWaitingForOnlineCancel] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setWaitingForOnlineTarget(null);
      setWaitingForOnlineCancel(null);
      setPendingProposal(null);
      setPendingCancelRequest(null);
      setPendingTransferRequest(null);
      setTargetPlayerId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const myArea = territoryCounts[activePlayer.id] || 0;
  const otherPlayers = players.filter(p => p.id !== activePlayer.id && p.alive);

  const myAlliances = alliances.filter(
    a => a.status === 'active' && (a.player1Id === activePlayer.id || a.player2Id === activePlayer.id)
  );

  const isAlreadyAllied = (targetId) => {
    return myAlliances.some(a => a.player1Id === targetId || a.player2Id === targetId);
  };

  const targetPlayer = targetPlayerId ? players.find(p => p.id === Number(targetPlayerId)) : null;
  const targetArea = targetPlayer ? (territoryCounts[targetPlayer.id] || 0) : 0;
  const maxAllowedPenalty = targetPlayer ? Math.max(1, Math.min(myArea, targetArea)) : myArea;

  const handleStartPropose = () => {
    if (!targetPlayer) return;
    const finalPenalty = Math.min(penaltyCells, maxAllowedPenalty);

    const proposalData = {
      proposer: activePlayer,
      target: targetPlayer,
      payerId: tributeDirection === 'PAY' ? activePlayer.id : targetPlayer.id,
      patronId: tributeDirection === 'PAY' ? targetPlayer.id : activePlayer.id,
      durationRounds: isPermanent ? 0 : Math.min(10, Math.max(1, Number(durationRounds))),
      penaltyCells: Math.max(1, finalPenalty),
      type: allianceType,
      tributeAmount: allianceType === 'TRIBUTE' ? Math.max(1, Number(tributePerRound)) : 0,
    };

    // If target player is on the other phone in an online room:
    if (onlineInfo && targetPlayer.phoneId !== onlineInfo.myDevice && onSendOnlineProposal) {
      onSendOnlineProposal(proposalData);
      setWaitingForOnlineTarget(targetPlayer.name);
      return;
    }

    // Local Pass & Play mode on same device:
    setPendingProposal(proposalData);
  };

  const handleConfirmProposalByTarget = () => {
    if (!pendingProposal) return;
    onProposeAlliance({
      player1Id: pendingProposal.proposer.id,
      player2Id: pendingProposal.target.id,
      payerId: pendingProposal.payerId || pendingProposal.proposer.id,
      patronId: pendingProposal.patronId || pendingProposal.target.id,
      durationRounds: pendingProposal.durationRounds,
      penaltyCells: pendingProposal.penaltyCells,
      type: pendingProposal.type || 'PEACE',
      tributeAmount: pendingProposal.tributeAmount || 0,
      status: 'active',
    });
    setPendingProposal(null);
    setTargetPlayerId(null);
  };

  const handleStartCancel = (alliance) => {
    const allyId = alliance.player1Id === activePlayer.id ? alliance.player2Id : alliance.player1Id;
    const ally = players.find(p => p.id === allyId);

    if (onlineInfo && ally?.phoneId !== onlineInfo.myDevice && onSendOnlineCancel) {
      onSendOnlineCancel(alliance, activePlayer, ally);
      setWaitingForOnlineCancel(ally?.name || 'Müttefik');
      return;
    }

    setPendingCancelRequest({
      alliance,
      proposer: activePlayer,
      ally,
    });
  };

  const handleConfirmCancelByAlly = () => {
    if (!pendingCancelRequest) return;
    onCancelMutualAlliance(pendingCancelRequest.alliance.id);
    setPendingCancelRequest(null);
  };

  const handleStartTransfer = () => {
    if (!targetPlayer || myArea <= 1) return;
    setPendingTransferRequest({
      from: activePlayer,
      to: targetPlayer,
      amount: Math.max(1, Math.min(transferAmount, myArea - 1)),
    });
  };

  const handleConfirmTransfer = () => {
    if (!pendingTransferRequest) return;
    onTransferTerritory(pendingTransferRequest.from.id, pendingTransferRequest.to.id, pendingTransferRequest.amount);
    setPendingTransferRequest(null);
    setTargetPlayerId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border-4 border-amber-300 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <Handshake className="text-amber-600" size={24} />
            <h2 className="text-xl font-black text-stone-800">Diplomasi</h2>
          </div>
          <button
            onClick={() => {
              if (waitingForOnlineTarget && onAbortOnlineProposal) onAbortOnlineProposal();
              if (waitingForOnlineCancel && onAbortOnlineCancel) onAbortOnlineCancel();
              onClose();
            }}
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modern Mod Tab Switcher */}
        {gameMode === 'MODERN' && !pendingProposal && !pendingCancelRequest && !pendingTransferRequest && (
          <div className="flex gap-2 my-3">
            <button
              onClick={() => setActiveTab('ALLIANCE')}
              className={`flex-1 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition ${
                activeTab === 'ALLIANCE'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              <Shield size={14} />
              <span>İttifak & Vergi</span>
            </button>
            <button
              onClick={() => setActiveTab('TRANSFER')}
              className={`flex-1 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition ${
                activeTab === 'TRANSFER'
                  ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              <Gift size={14} />
              <span>Toprak Hibe Et</span>
            </button>
          </div>
        )}

        {/* 0. Online Waiting Screen */}
        {waitingForOnlineTarget ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-lg font-black text-stone-800">
              Teklif İletildi!
            </div>
            <p className="text-xs text-stone-600 px-4 leading-relaxed">
              <strong>{waitingForOnlineTarget}</strong> oyuncusunun telefon ekranına ittifak teklifi gönderildi. Kabul etmesi veya reddetmesi bekleniyor...
            </p>
            <button
              onClick={() => {
                setWaitingForOnlineTarget(null);
                if (onAbortOnlineProposal) onAbortOnlineProposal();
              }}
              className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition"
            >
              Geri Dön / İptal Et
            </button>
          </div>
        ) : waitingForOnlineCancel ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-lg font-black text-stone-800">
              Fesih İsteği İletildi!
            </div>
            <p className="text-xs text-stone-600 px-4 leading-relaxed">
              <strong>{waitingForOnlineCancel}</strong> oyuncusuna barışçıl fesih talebi gönderildi. Yanıt bekleniyor...
            </p>
            <button
              onClick={() => {
                setWaitingForOnlineCancel(null);
                if (onAbortOnlineCancel) onAbortOnlineCancel();
              }}
              className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition"
            >
              Geri Dön / İptal Et
            </button>
          </div>
        ) : pendingCancelRequest ? (
          <div className="py-4 text-center">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 mb-4">
              <div className="text-xs font-black text-amber-800 uppercase tracking-wide">
                Barışçıl Fesih Onayı
              </div>
              <div className="text-lg font-black text-stone-800 mt-2">
                <span style={{ color: pendingCancelRequest.ally.hex }}>{pendingCancelRequest.ally.name}</span>,
                <br />
                <span style={{ color: pendingCancelRequest.proposer.hex }}>{pendingCancelRequest.proposer.name}</span> anlaşmayı <u>cezasız ve barışçıl</u> sonlandırmak istiyor.
              </div>
            </div>

            <p className="text-xs text-stone-500 mb-4">
              (Telefonu {pendingCancelRequest.ally.name} oyuncusuna verin ve kararını onaylasın)
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setPendingCancelRequest(null)}
                className="flex-1 py-3 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold rounded-xl transition text-sm"
              >
                Reddet
              </button>
              <button
                onClick={handleConfirmCancelByAlly}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition text-sm flex items-center justify-center gap-1.5"
              >
                <Check size={18} />
                <span>Onayla (Feshet)</span>
              </button>
            </div>
          </div>
        ) : pendingProposal ? (
          /* 2. New Alliance Proposal Screen */
          <div className="py-4 text-center">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 mb-4">
              <div className="text-xs font-black text-amber-800 uppercase tracking-wide">
                {pendingProposal.type === 'TRIBUTE' ? 'Vergi / Haraç Teklifi' : 'İttifak Onayı Gerekiyor'}
              </div>
              <div className="text-lg font-black text-stone-800 mt-2">
                <span style={{ color: pendingProposal.target.hex }}>{pendingProposal.target.name}</span>,
                <br />
                <span style={{ color: pendingProposal.proposer.hex }}>{pendingProposal.proposer.name}</span>{' '}
                {pendingProposal.type === 'TRIBUTE'
                  ? (pendingProposal.payerId === pendingProposal.target.id
                      ? `senden her tur ${pendingProposal.tributeAmount} kare haraç talep ediyor!`
                      : `sana her tur ${pendingProposal.tributeAmount} kare haraç ödemeyi teklif ediyor!`)
                  : 'sana ittifak teklif ediyor!'}
              </div>

              <div className="mt-4 p-3 bg-white rounded-xl text-xs sm:text-sm text-stone-700 flex flex-col gap-1.5 text-left shadow-sm border border-stone-200">
                {pendingProposal.type === 'TRIBUTE' && (
                  <div>
                    <span className="font-bold">Tur Başına Haraç: </span>
                    <span className="text-amber-700 font-extrabold">{pendingProposal.tributeAmount} Kare Toprak</span>
                  </div>
                )}
                <div>
                  <span className="font-bold">Süre: </span>
                  {pendingProposal.durationRounds === 0 ? 'Kalıcı (Süresiz)' : `${pendingProposal.durationRounds} Tur`}
                </div>
                <div>
                  <span className="font-bold">Bozma Cezası: </span>
                  <span className="text-red-600 font-extrabold">{pendingProposal.penaltyCells} Toprak</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-stone-500 mb-4">
              (Telefonu {pendingProposal.target.name} oyuncusuna verin ve kararını onaylasın)
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setPendingProposal(null)}
                className="flex-1 py-3 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold rounded-xl transition text-sm"
              >
                Reddet
              </button>
              <button
                onClick={handleConfirmProposalByTarget}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition text-sm flex items-center justify-center gap-1.5"
              >
                <Check size={18} />
                <span>Kabul Et</span>
              </button>
            </div>
          </div>
        ) : pendingTransferRequest ? (
          /* 3. Territory Transfer Confirmation Screen */
          <div className="py-4 text-center">
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-300 mb-4">
              <div className="text-xs font-black text-purple-800 uppercase tracking-wide">
                Toprak Devri Onayı
              </div>
              <div className="text-lg font-black text-stone-800 mt-2">
                <span style={{ color: pendingTransferRequest.to.hex }}>{pendingTransferRequest.to.name}</span>,
                <br />
                <span style={{ color: pendingTransferRequest.from.hex }}>{pendingTransferRequest.from.name}</span> sana sınırlarından{' '}
                <span className="font-black text-purple-700">{pendingTransferRequest.amount} Kare</span> devretmek istiyor!
              </div>
            </div>

            <p className="text-xs text-stone-500 mb-4">
              (Telefonu {pendingTransferRequest.to.name} oyuncusuna verin ve devri onaylasın)
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setPendingTransferRequest(null)}
                className="flex-1 py-3 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold rounded-xl transition text-sm"
              >
                Reddet
              </button>
              <button
                onClick={handleConfirmTransfer}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md transition text-sm flex items-center justify-center gap-1.5"
              >
                <Check size={18} />
                <span>Toprakları Kabul Et</span>
              </button>
            </div>
          </div>
        ) : activeTab === 'TRANSFER' && gameMode === 'MODERN' ? (
          /* 4. Territory Transfer Input Screen */
          <div className="my-3 space-y-4">
            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 leading-relaxed">
              💡 <strong>Toprak Hibe Etme:</strong> Sınır komşun olan bir müttefikine topraklarını hediye edebilir, ona destek olabilir veya sınırlarınızı düzeltebilirsiniz.
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">
                Kime Toprak Devredeceksin?
              </label>
              <select
                value={targetPlayerId || ''}
                onChange={e => setTargetPlayerId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="">Oyuncu Seçin...</option>
                {otherPlayers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({territoryCounts[p.id] || 0} Kare)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">
                Kaç Kare Devredeceksin? (Maks: {Math.max(1, myArea - 1)})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, myArea - 1)}
                  value={transferAmount}
                  onChange={e => {
                    const val = Math.max(1, Math.min(Math.max(1, myArea - 1), Number(e.target.value) || 1));
                    setTransferAmount(val);
                  }}
                  className="w-24 p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-center text-sm focus:ring-2 focus:ring-purple-400"
                />
                <div className="flex-1 flex gap-1">
                  {[1, 3, 5, 10].map(v => (
                    <button
                      key={v}
                      type="button"
                      disabled={v >= myArea}
                      onClick={() => setTransferAmount(v)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                        v >= myArea
                          ? 'opacity-30 bg-stone-100 cursor-not-allowed'
                          : transferAmount === v
                          ? 'bg-purple-600 text-white border-purple-700'
                          : 'bg-stone-50 text-stone-700 border-stone-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              disabled={!targetPlayerId || myArea <= 1}
              onClick={handleStartTransfer}
              className="w-full mt-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Gift size={16} />
              <span>Toprak Devri Talebi Gönder</span>
            </button>
          </div>
        ) : (
          /* 5. Main Alliances List & Propose Form */
          <>
            <div className="my-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-400 mb-2">
                Mevcut İttifakların ({myAlliances.length})
              </h3>
              {myAlliances.length === 0 ? (
                <div className="p-3 bg-stone-50 rounded-xl text-stone-500 text-xs italic text-center border border-stone-200">
                  Şu an kimseyle aktif bir ittifakın yok.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {myAlliances.map(a => {
                    const allyId = a.player1Id === activePlayer.id ? a.player2Id : a.player1Id;
                    const ally = players.find(p => p.id === allyId);
                    const isPerm = a.durationRounds === 0;

                    return (
                      <div
                        key={a.id}
                        className="p-3 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: ally?.hex }}
                            />
                            <span className="font-black text-stone-800 text-sm">{ally?.name}</span>
                            {a.type === 'TRIBUTE' && (() => {
                              const isPayer = a.payerId ? a.payerId === activePlayer.id : a.player1Id === activePlayer.id;
                              return (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                  isPayer
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-green-100 text-green-900 border border-green-300'
                                }`}>
                                  {isPayer ? `ÖDÜYORSUN (-${a.tributeAmount || 1})` : `ALACAKSIN (+${a.tributeAmount || 1})`}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                            <span className="font-medium">
                              {isPerm ? 'Kalıcı Anlaşma' : `Kalan: ${a.durationRounds} Tur`}
                            </span>
                            <span>•</span>
                            <span className="text-red-500 font-bold">Ceza: {a.penaltyCells} Kare</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleStartCancel(a)}
                          className="px-3 py-1.5 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl transition border border-amber-300"
                        >
                          Fesih İste
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-stone-200">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-600 mb-3">
                Yeni Anlaşma Teklif Et
              </h3>

              {otherPlayers.filter(p => !isAlreadyAllied(p.id)).length === 0 ? (
                <div className="text-xs text-stone-400 italic">
                  Teklif edebileceğin uygun oyuncu kalmadı.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Modern Mode: Treaty Type */}
                  {gameMode === 'MODERN' && (
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1">
                        Anlaşma Türü
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAllianceType('PEACE')}
                          className={`py-2 px-3 text-xs font-black rounded-xl border transition ${
                            allianceType === 'PEACE'
                              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                              : 'bg-stone-50 text-stone-700 border-stone-200'
                          }`}
                        >
                          🛡️ Saldırmazlık
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllianceType('TRIBUTE')}
                          className={`py-2 px-3 text-xs font-black rounded-xl border transition ${
                            allianceType === 'TRIBUTE'
                              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                              : 'bg-stone-50 text-stone-700 border-stone-200'
                          }`}
                        >
                          💰 Vergi / Haraç
                        </button>
                      </div>
                      <div className="mt-2 p-2 bg-stone-100 rounded-xl text-[11px] text-stone-600 font-medium leading-tight">
                        {allianceType === 'PEACE' ? (
                          <span>🛡️ <strong>Saldırmazlık:</strong> İki ülke birbirine saldıramaz. Vergi transferi <u>olmaz</u>.</span>
                        ) : (
                          <span>💰 <strong>Vergi / Haraç:</strong> {tributeDirection === 'PAY' ? 'Sen müttefikine her tur haraç ödersin.' : 'Müttefikin sana her tur haraç öder.'}</span>
                        )}
                      </div>

                      {allianceType === 'TRIBUTE' && (
                        <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 space-y-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-amber-900 mb-1">
                              Haraç Yönü:
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setTributeDirection('PAY')}
                                className={`py-1.5 px-2 text-[11px] font-black rounded-lg border transition ${
                                  tributeDirection === 'PAY'
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                    : 'bg-white text-stone-700 border-amber-200'
                                }`}
                              >
                                💸 Ben Ödeyeceğim
                              </button>
                              <button
                                type="button"
                                onClick={() => setTributeDirection('DEMAND')}
                                className={`py-1.5 px-2 text-[11px] font-black rounded-lg border transition ${
                                  tributeDirection === 'DEMAND'
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                    : 'bg-white text-stone-700 border-amber-200'
                                }`}
                              >
                                👑 Bana Ödensin (Talep)
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-amber-900 mb-1">
                              Tur Başına Haraç Miktarı (Kare):
                            </label>
                            <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={tributePerRound}
                              onChange={e => setTributePerRound(Math.max(1, Math.min(10, Number(e.target.value))))}
                              className="w-20 p-2 text-xs font-bold text-center border border-amber-300 rounded-lg bg-white"
                            />
                            <div className="flex-1 grid grid-cols-4 gap-1">
                              {[1, 2, 3, 5].map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setTributePerRound(v)}
                                  className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                                    tributePerRound === v
                                      ? 'bg-amber-500 text-white border-amber-600'
                                      : 'bg-white text-stone-700 border-stone-200'
                                  }`}
                                >
                                  {v} Kare
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">
                      Kime Teklif Edeceksin?
                    </label>
                    <select
                      value={targetPlayerId || ''}
                      onChange={e => {
                        const pid = e.target.value;
                        setTargetPlayerId(pid);
                        if (pid) {
                          const p = players.find(x => x.id === Number(pid));
                          const pArea = territoryCounts[p.id] || 0;
                          const maxP = Math.max(1, Math.min(myArea, pArea));
                          if (penaltyCells > maxP) setPenaltyCells(maxP);
                        }
                      }}
                      className="w-full p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    >
                      <option value="">Oyuncu Seçin...</option>
                      {otherPlayers
                        .filter(p => !isAlreadyAllied(p.id))
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({territoryCounts[p.id] || 0} Toprak)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-600">
                        Süre (Tur Sayısı - Max 10)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsPermanent(!isPermanent)}
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border transition ${
                          isPermanent
                            ? 'bg-purple-600 text-white border-purple-700 shadow-sm'
                            : 'bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {isPermanent ? '✓ Kalıcı (Süresiz)' : 'Kalıcı Yap'}
                      </button>
                    </div>

                    {!isPermanent && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={durationRounds}
                          onChange={e => {
                            const val = Math.min(10, Math.max(1, Number(e.target.value) || 1));
                            setDurationRounds(val);
                          }}
                          className="w-24 p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-center text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        />
                        <div className="flex-1 grid grid-cols-4 gap-1">
                          {[1, 2, 3, 5].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setDurationRounds(t)}
                              className={`py-2 text-xs font-bold rounded-lg border transition ${
                                durationRounds === t
                                  ? 'bg-amber-500 text-white border-amber-600'
                                  : 'bg-stone-50 text-stone-700 border-stone-200'
                              }`}
                            >
                              {t} Tur
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-stone-600">
                        Bozma Cezası (Toprak Sayısı)
                      </label>
                      {targetPlayer && (
                        <span className="text-[10px] text-stone-500 font-medium">
                          Maks: <strong className="text-stone-800">{maxAllowedPenalty} Kare</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={maxAllowedPenalty}
                        value={penaltyCells}
                        onChange={e => {
                          const val = Math.max(1, Math.min(maxAllowedPenalty, Number(e.target.value) || 1));
                          setPenaltyCells(val);
                        }}
                        className="w-24 p-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-center text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />

                      <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
                        {[5, 10, 15, 20].map(val => {
                          const disabled = targetPlayer && val > maxAllowedPenalty;
                          return (
                            <button
                              key={val}
                              type="button"
                              disabled={disabled}
                              onClick={() => setPenaltyCells(val)}
                              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition whitespace-nowrap ${
                                disabled
                                  ? 'opacity-30 bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed'
                                  : penaltyCells === val
                                  ? 'bg-red-500 text-white border-red-600'
                                  : 'bg-stone-50 text-stone-700 border-stone-200'
                              }`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={!targetPlayerId}
                    onClick={handleStartPropose}
                    className="w-full mt-2 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition active:scale-95"
                  >
                    Teklifi Gönder ➔
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
