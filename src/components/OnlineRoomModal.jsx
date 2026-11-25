import React, { useState, useEffect, useRef } from 'react';
import { multiplayer } from '../utils/multiplayer';
import { PLAYER_COLORS } from '../utils/gameLogic';
import { Wifi, Plus, LogIn, Check, AlertCircle, Copy, Edit3, Smartphone, Hourglass } from 'lucide-react';

export default function OnlineRoomModal({
  isOpen,
  onClose,
  onStartOnlineGame,
}) {
  const [tab, setTab] = useState('CREATE'); // 'CREATE' | 'JOIN'
  const [roomCode, setRoomCode] = useState('');
  const [status, setStatus] = useState('IDLE'); // 'IDLE' | 'CONNECTING' | 'LOBBY' | 'ERROR'
  const [errorMsg, setErrorMsg] = useState('');

  // Lobby Configuration
  const [isHost, setIsHost] = useState(false);
  const [gameMode, setGameMode] = useState('KLASIK'); // 'KLASIK' | 'MODERN'
  const [gridSize, setGridSize] = useState(60);
  const [startSize, setStartSize] = useState(3);
  const [totalPlayerCount, setTotalPlayerCount] = useState(4); // 2, 4, 6, 8
  const [hostPlayerCount, setHostPlayerCount] = useState(2); // Players on Phone 1

  // Player Names array for all players (id 1 to totalPlayerCount)
  const [playerNames, setPlayerNames] = useState([
    'Oyuncu 1', 'Oyuncu 2', 'Oyuncu 3', 'Oyuncu 4',
    'Oyuncu 5', 'Oyuncu 6', 'Oyuncu 7', 'Oyuncu 8'
  ]);

  // Readiness
  const [clientIsReady, setClientIsReady] = useState(false);
  const [hostWantsAutoStart, setHostWantsAutoStart] = useState(false);
  const [clientConnected, setClientConnected] = useState(false);

  // Reset modal lobby state cleanly when closed so reopening never shows a dead lobby
  useEffect(() => {
    if (!isOpen) {
      setStatus('IDLE');
      setErrorMsg('');
      setClientConnected(false);
      setClientIsReady(false);
      setHostWantsAutoStart(false);
    }
  }, [isOpen]);

  // Synchronous ref to prevent stale closures when clients connect asynchronously
  const lobbyStateRef = useRef({});
  lobbyStateRef.current = {
    gameMode,
    gridSize,
    startSize,
    totalPlayerCount,
    hostPlayerCount,
    playerNames,
    clientIsReady,
  };

  // Build the unified players array
  const buildPlayerList = (names = playerNames, total = totalPlayerCount, hostCount = hostPlayerCount) => {
    return PLAYER_COLORS.slice(0, total).map((col, idx) => ({
      ...col,
      name: names[idx] || `Oyuncu ${idx + 1}`,
      phoneId: idx < hostCount ? 'HOST' : 'CLIENT',
      alive: true,
    }));
  };

  // 1. Host Creates Room
  const handleCreateRoom = () => {
    setStatus('CONNECTING');
    setErrorMsg('');
    const randomCode = Math.floor(10000 + Math.random() * 90000).toString();
    setRoomCode(randomCode);
    setIsHost(true);
    setClientConnected(false);
    setClientIsReady(false);
    setHostWantsAutoStart(false);

    multiplayer.createRoom(
      randomCode,
      (code) => {
        setStatus('LOBBY');

        // Immediately push latest state whenever a new peer connects
        multiplayer.onPeerConnected = (conn) => {
          setClientConnected(true);
          const cur = lobbyStateRef.current;
          const syncPayload = {
            type: 'LOBBY_FULL_SYNC',
            ...cur,
            clientIsReady: false,
          };
          try {
            conn.send(syncPayload);
          } catch (e) {}
          multiplayer.broadcastState(syncPayload);
        };

        // Problem 4: Update lobby status immediately when remote client disconnects
        multiplayer.onPeerDisconnected = () => {
          setClientConnected(false);
          setClientIsReady(false);
        };

        // Host listens to client actions
        multiplayer.onActionReceived = (action, conn) => {
          if (!action) return;
          const cur = lobbyStateRef.current;

          if (action.type === 'CLIENT_JOIN') {
            setClientConnected(true);
            const syncPayload = {
              type: 'LOBBY_FULL_SYNC',
              ...cur,
              clientIsReady: false,
            };
            if (conn) {
              try {
                conn.send(syncPayload);
              } catch (e) {}
            }
            multiplayer.broadcastState(syncPayload);
          } else if (action.type === 'UPDATE_CLIENT_NAMES') {
            setPlayerNames(prev => {
              const updated = [...prev];
              const curHostCount = lobbyStateRef.current.hostPlayerCount;
              action.names.forEach((name, idx) => {
                const targetIdx = curHostCount + idx;
                if (targetIdx < updated.length) {
                  updated[targetIdx] = name;
                }
              });
              multiplayer.broadcastState({
                type: 'LOBBY_NAMES_SYNC',
                playerNames: updated,
              });
              return updated;
            });
          } else if (action.type === 'CLIENT_READY_TOGGLE') {
            setClientIsReady(action.ready);
            multiplayer.broadcastState({
              type: 'CLIENT_READY_SYNC',
              ready: action.ready,
            });
          }
        };
      },
      (err) => {
        setStatus('ERROR');
        setErrorMsg('Oda kurulamadı. Lütfen tekrar deneyin.');
      }
    );
  };

  // 2. Client Joins Room
  const handleJoinRoom = () => {
    if (!roomCode || roomCode.length < 4) {
      setErrorMsg('Lütfen 4 haneli oda kodunu girin.');
      return;
    }

    setStatus('CONNECTING');
    setErrorMsg('');
    setIsHost(false);
    setClientIsReady(false);

    multiplayer.joinRoom(
      roomCode,
      () => {
        setStatus('LOBBY');
        // Notify host that client joined
        multiplayer.sendAction({
          type: 'CLIENT_JOIN',
        });

        // Client listens to host updates
        multiplayer.onStateChange = (msg) => {
          if (!msg) return;

          if (msg.type === 'LOBBY_FULL_SYNC' || msg.type === 'LOBBY_SETTINGS_SYNC') {
            if (msg.gameMode) setGameMode(msg.gameMode);
            if (msg.gridSize) setGridSize(msg.gridSize);
            if (msg.startSize) setStartSize(msg.startSize);
            if (msg.totalPlayerCount) setTotalPlayerCount(msg.totalPlayerCount);
            if (msg.hostPlayerCount) setHostPlayerCount(msg.hostPlayerCount);
            if (msg.playerNames) setPlayerNames(msg.playerNames);
            if (msg.clientIsReady !== undefined) setClientIsReady(msg.clientIsReady);
            setClientConnected(true);
            setStatus('LOBBY');
          } else if (msg.type === 'LOBBY_NAMES_SYNC') {
            if (msg.playerNames) {
              setPlayerNames(prev => {
                const updated = [...prev];
                const hCount = lobbyStateRef.current.hostPlayerCount;
                for (let i = 0; i < hCount && i < msg.playerNames.length; i++) {
                  updated[i] = msg.playerNames[i];
                }
                return updated;
              });
            }
          } else if (msg.type === 'CLIENT_READY_SYNC') {
            setClientIsReady(msg.ready);
          } else if (msg.type === 'ROOM_FULL') {
            setStatus('ERROR');
            setErrorMsg(msg.message || 'Oda dolu (Maksimum 1 katılımcı cihaz bağlanabilir).');
          } else if (msg.type === 'START_GAME') {
            onStartOnlineGame({
              isHost: false,
              roomCode,
              myDevice: 'CLIENT',
              initialState: msg,
            });
            onClose();
          }
        };

        // Problem 4: Update join state if host disconnects in lobby
        multiplayer.onPeerDisconnected = () => {
          setStatus('ERROR');
          setErrorMsg('Oda sahibi ile bağlantı kesildi.');
        };
      },
      (err) => {
        setStatus('ERROR');
        setErrorMsg('Odaya bağlanılamadı. Kodun doğruluğunu ve kurucunun odada olduğunu kontrol edin.');
      }
    );
  };

  // Host updates player counts or modes
  const handleHostUpdateSettings = (newMode, newTotal, newHostCount, newGridSize, newStartSize) => {
    if (!isHost) return;
    const m = newMode !== undefined ? newMode : gameMode;
    const t = newTotal !== undefined ? newTotal : totalPlayerCount;
    const h = newHostCount !== undefined
      ? newHostCount
      : (newTotal !== undefined ? Math.max(1, Math.floor(t / 2)) : hostPlayerCount);
    const g = newGridSize !== undefined ? newGridSize : gridSize;
    const s = newStartSize !== undefined ? newStartSize : startSize;

    setGameMode(m);
    setTotalPlayerCount(t);
    setHostPlayerCount(h);
    setGridSize(g);
    setStartSize(s);
    setClientIsReady(false);

    multiplayer.broadcastState({
      type: 'LOBBY_FULL_SYNC',
      gameMode: m,
      totalPlayerCount: t,
      hostPlayerCount: h,
      gridSize: g,
      startSize: s,
      playerNames,
      clientIsReady: false,
    });
  };

  // Rename a player
  const handleRenamePlayer = (index, newName) => {
    const updated = [...playerNames];
    updated[index] = newName;
    setPlayerNames(updated);

    if (isHost) {
      multiplayer.broadcastState({
        type: 'LOBBY_NAMES_SYNC',
        playerNames: updated,
      });
    } else {
      // Client sending updated names for their slice
      const clientSlice = updated.slice(hostPlayerCount, totalPlayerCount);
      multiplayer.sendAction({
        type: 'UPDATE_CLIENT_NAMES',
        names: clientSlice,
      });
    }
  };

  // Client toggles ready
  const handleClientToggleReady = () => {
    const next = !clientIsReady;
    setClientIsReady(next);
    multiplayer.sendAction({
      type: 'CLIENT_READY_TOGGLE',
      ready: next,
    });
  };

  // Host clicks start or triggers auto-start when client is ready
  const handleHostStartClick = () => {
    if (clientIsReady) {
      launchGameAsHost();
    } else {
      setHostWantsAutoStart(prev => !prev);
    }
  };

  // Auto-start trigger when client becomes ready and host wanted auto-start
  useEffect(() => {
    if (isHost && hostWantsAutoStart && clientIsReady) {
      launchGameAsHost();
    }
  }, [clientIsReady, hostWantsAutoStart, isHost]);

  const launchGameAsHost = () => {
    const players = buildPlayerList();
    onStartOnlineGame({
      isHost: true,
      roomCode,
      myDevice: 'HOST',
      joinedPlayers: players,
      roomSettings: { gameMode, gridSize, startSize },
    });
    onClose();
  };

  const clientPlayerCount = Math.max(1, totalPlayerCount - hostPlayerCount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-sm sm:max-w-md w-full border-4 border-blue-500 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-xl">
              <Wifi size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-800 leading-tight">
                {status === 'LOBBY' ? '🌐 Online Oda Lobisi' : 'Online Oda'}
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                {status === 'LOBBY' ? `Oda Kodu: #${roomCode}` : 'İki telefonda Pass & Play'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              multiplayer.cleanup();
              onClose();
            }}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            ✕
          </button>
        </div>

        {/* 1. INITIAL FORM: CREATE OR JOIN */}
        {status === 'IDLE' && (
          <div className="py-4 space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab('CREATE')}
                className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition ${
                  tab === 'CREATE'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-stone-50 text-stone-700 border-stone-200'
                }`}
              >
                <Plus size={16} />
                <span>Oda Kur (Host)</span>
              </button>
              <button
                onClick={() => setTab('JOIN')}
                className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition ${
                  tab === 'JOIN'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-stone-50 text-stone-700 border-stone-200'
                }`}
              >
                <LogIn size={16} />
                <span>Odaya Katıl</span>
              </button>
            </div>

            {tab === 'CREATE' ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 leading-relaxed">
                💡 <strong>Oda Kur:</strong> 4 haneli bir oda kodu oluşturulur. Arkadaşın kendi telefonundan odaya bağlandığında iki taraf da kendi telefonundaki oyuncuların isimlerini girip oyunu başlatır.
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  4 Haneli Oda Kodu:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Örn: 5831"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.trim())}
                  className="w-full p-3 rounded-xl border border-stone-300 font-black text-center text-2xl tracking-widest bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                />
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-1.5 font-medium">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={tab === 'CREATE' ? handleCreateRoom : handleJoinRoom}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
            >
              {tab === 'CREATE' ? 'Oda Kur & Lobiye Geç ➔' : 'Odaya Bağlan ➔'}
            </button>
          </div>
        )}

        {/* 2. CONNECTING SPINNER */}
        {status === 'CONNECTING' && (
          <div className="py-10 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="text-sm font-black text-stone-800">
              Odaya bağlanılıyor...
            </div>
            <p className="text-xs text-stone-500">
              Cihazlar arası bağlantı kuruluyor.
            </p>
          </div>
        )}

        {/* 3. ERROR SCREEN */}
        {status === 'ERROR' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <div className="text-sm font-black text-stone-800">
              Bağlantı Hatası
            </div>
            <p className="text-xs text-red-600 font-medium px-4">
              {errorMsg}
            </p>
            <button
              onClick={() => setStatus('IDLE')}
              className="px-6 py-2.5 bg-stone-800 text-white font-black text-xs rounded-xl hover:bg-stone-900 transition"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* 4. COMPREHENSIVE LOBBY SCREEN (IDENTICAL FOR BOTH HOST & CLIENT) */}
        {status === 'LOBBY' && (
          <div className="py-3 space-y-3.5">
            
            {/* Room Code Card */}
            <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                  Oda Kodu:
                </span>
                <div className="text-2xl font-black text-blue-950 tracking-widest leading-none mt-0.5">
                  {roomCode}
                </div>
              </div>
              <button
                onClick={() => {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(roomCode)
                      .then(() => alert(`Oda Kodu (${roomCode}) panoya kopyalandı!`))
                      .catch(() => alert(`Oda Kodu: ${roomCode}`));
                  } else {
                    alert(`Oda Kodu: ${roomCode}`);
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <Copy size={14} />
                <span>Kopyala</span>
              </button>
            </div>

            {/* Connection Status Indicator */}
            {isHost && (
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between border ${
                clientConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
              }`}>
                <span>{clientConnected ? '✅ 2. Cihaz (Katılımcı) Bağlandı' : '⏳ 2. Cihaz Bekleniyor (Oda Kodunu Paylaşın)...'}</span>
              </div>
            )}

            {/* Room Settings (Host edits, Client sees live) */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600">Oyun Modu:</span>
                {isHost ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleHostUpdateSettings('KLASIK')}
                      className={`px-2.5 py-1 text-xs font-black rounded-lg border transition ${
                        gameMode === 'KLASIK'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-stone-700 border-stone-200'
                      }`}
                    >
                      Klasik
                    </button>
                    <button
                      onClick={() => handleHostUpdateSettings('MODERN')}
                      className={`px-2.5 py-1 text-xs font-black rounded-lg border transition ${
                        gameMode === 'MODERN'
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                          : 'bg-white text-stone-700 border-stone-200'
                      }`}
                    >
                      Modern
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-stone-200 text-stone-800">
                    {gameMode === 'MODERN' ? '🛡️ Modern Mod' : '📜 Klasik Mod'}
                  </span>
                )}
              </div>

              {/* Total Player Selector (Host selects total players) */}
              <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
                <span className="text-xs font-bold text-stone-600">Toplam Oyuncu:</span>
                {isHost ? (
                  <div className="flex gap-1">
                    {[2, 4, 6, 8].map(tot => (
                      <button
                        key={tot}
                        onClick={() => {
                          const half = Math.max(1, Math.floor(tot / 2));
                          handleHostUpdateSettings(undefined, tot, half);
                        }}
                        className={`w-7 h-7 text-xs font-black rounded-lg border transition ${
                          totalPlayerCount === tot
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-stone-700 border-stone-200'
                        }`}
                      >
                        {tot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs font-black text-stone-800">
                    {totalPlayerCount} Oyuncu
                  </span>
                )}
              </div>

              {/* Device Player Distribution info */}
              <div className="flex items-center justify-between text-[11px] text-stone-500 bg-white p-2 rounded-xl border border-stone-200/70">
                <span className="flex items-center gap-1 font-bold text-blue-700">
                  <Smartphone size={13} />
                  <span>1. Telefon: {hostPlayerCount} Oyuncu</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-green-700">
                  <Smartphone size={13} />
                  <span>2. Telefon: {clientPlayerCount} Oyuncu</span>
                </span>
              </div>
            </div>

            {/* Players List with Names & Device Badges */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center justify-between">
                <span>Oyuncular & İsimler:</span>
                <span className="text-[10px] text-stone-400 font-normal">
                  {isHost ? 'Kendi oyuncularının adını yaz' : 'Kendi telefonunun oyuncularını yaz'}
                </span>
              </span>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {Array.from({ length: totalPlayerCount }).map((_, idx) => {
                  const colorInfo = PLAYER_COLORS[idx] || PLAYER_COLORS[0];
                  const isHostPlayer = idx < hostPlayerCount;
                  const canIEdit = (isHost && isHostPlayer) || (!isHost && !isHostPlayer);

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border flex items-center justify-between text-xs transition ${
                        canIEdit
                          ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-200'
                          : 'bg-stone-50 border-stone-200 opacity-90'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: colorInfo.hex }}
                        />
                        {canIEdit ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              maxLength={12}
                              value={playerNames[idx] || ''}
                              onChange={e => handleRenamePlayer(idx, e.target.value)}
                              placeholder={`Oyuncu ${idx + 1}`}
                              className="w-full bg-white px-2 py-1 text-xs font-black border border-blue-400 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <Edit3 size={13} className="text-blue-500 shrink-0" />
                          </div>
                        ) : (
                          <span className="font-bold text-stone-800 truncate">
                            {playerNames[idx] || `Oyuncu ${idx + 1}`}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                          isHostPlayer
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {isHostPlayer ? '1. Telefon' : '2. Telefon'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Readiness & Start Game Controls */}
            <div className="pt-2 border-t border-stone-200">
              {isHost ? (
                /* Host Controls */
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                    <span className="font-bold text-stone-700">2. Telefon Durumu:</span>
                    {clientIsReady ? (
                      <span className="font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Check size={13} />
                        <span>✓ HAZIR</span>
                      </span>
                    ) : (
                      <span className="font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Hourglass size={12} className="animate-spin" />
                        <span>HAZIR DEĞİL</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleHostStartClick}
                    className={`w-full py-3.5 text-white font-black text-sm rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 ${
                      clientIsReady
                        ? 'bg-green-600 hover:bg-green-700'
                        : hostWantsAutoStart
                        ? 'bg-amber-600 hover:bg-amber-700 animate-pulse'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Check size={18} />
                    <span>
                      {clientIsReady
                        ? 'Oyunu Hemen Başlat ➔'
                        : hostWantsAutoStart
                        ? '2. Telefon Hazır Olunca Otomatik Başlatılacak...'
                        : 'Başlat (Hazır Olunca Otomatik Başla)'}
                    </span>
                  </button>
                </div>
              ) : (
                /* Client Controls */
                <div className="space-y-2">
                  <button
                    onClick={handleClientToggleReady}
                    className={`w-full py-3.5 font-black text-sm rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 ${
                      clientIsReady
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-stone-950'
                    }`}
                  >
                    <Check size={18} />
                    <span>
                      {clientIsReady
                        ? '✓ HAZIRSIN (İptal Etmek İçin Tıkla)'
                        : 'HAZIR OL (READY) ➔'}
                    </span>
                  </button>
                  <p className="text-[11px] text-stone-500 text-center">
                    {clientIsReady
                      ? 'Hazırsın! Kurucu başlattığı anda oyun otomatik açılacak.'
                      : 'İsimlerini girdikten sonra "Hazır Ol" butonuna tıkla.'}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
