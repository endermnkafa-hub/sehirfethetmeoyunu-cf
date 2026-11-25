// Real-Time Cross-Device Shared World Synchronization Layer
// Powered by Cloudflare Workers + Durable Objects (WebSocket Hibernation API) + Local BroadcastChannel
// Deep Quota Optimization:
//  - 1 persistent WebSocket per player (= 1 HTTP Worker request per session, 0 polling!)
//  - Delta-only pixel broadcasts (NEVER sends full map snapshots periodically!)
//  - Deduplicated 450ms pixel batching
//  - Dirty-checked, visibility-aware stats sync (skips unchanged & background tabs)
//  - Zero-cost "ping"/"pong" auto-response (does NOT wake Durable Object!)
//  - Flag deduplication (sent once on country create/flag update, never in chat or heartbeats)

import { FLAG_W, FLAG_H } from './flagLibrary.js';
import { getWorkerWsUrl } from '../workerConfig.js';

const PIXEL_BATCH_MS = 450;
const STATS_SYNC_INTERVAL_MS = 30000;
const PING_INTERVAL_MS = 28000;
const MAX_PENDING_QUEUE = 120;

export class SharedWorldSync {
  constructor(engine, onRemoteUpdate) {
    this.engine = engine;
    this.onRemoteUpdate = onRemoteUpdate || (() => {});
    this.destroyed = false;
    this.channel = null;
    this.tabId = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

    this.isCloudConnected = false;
    this.hasInitialSyncLoaded = false;
    this.isSyncError = false;
    this.lastWriteError = false;
    this.onlineCount = 1;

    this.seenMsgIds = new Set();
    this._msgSeq = 0;

    // WebSocket state
    this.ws = null;
    this._reconnectTimer = null;
    this._reconnectAttempt = 0;
    this._pingInterval = null;
    this._statsInterval = null;
    this._outgoingQueue = [];

    // Delta pixel batch buffer (deduplicated by "x,y")
    this._pendingPixelsMap = new Map();
    this._pendingPixelsCountryId = null;
    this._batchTimer = null;

    // Dirty-checking cache for stats sync
    this._lastStatsSignature = '';

    // 1. Local BroadcastChannel for instant same-browser tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('sf_shared_world_mmo_cf_v1');
        this.channel.onmessage = (e) => {
          this._handleRemoteMessage(e.data, false);
        };
      } catch {}
    }

    // 2. Connect to Cloudflare Workers Durable Object WebSocket
    this._connectWebSocket();

    // 3. Start dirty-checked, visibility-aware stats sync (every 30s, ONLY if changed & tab visible)
    this._statsInterval = setInterval(() => {
      if (this.destroyed || !this.isCloudConnected) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      this._syncStatsIfDirty();
    }, STATS_SYNC_INTERVAL_MS);
  }

  getConnectedPeersCount() {
    return this.isCloudConnected ? Math.max(1, this.onlineCount || this.engine.countries.length) : 0;
  }

  _connectWebSocket() {
    if (this.destroyed || typeof window === 'undefined') return;

    const wsUrl = getWorkerWsUrl();
    if (!wsUrl) {
      console.warn('[SharedWorldSync] VITE_WORKER_WS_URL is not configured.');
      this.isCloudConnected = false;
      this.isSyncError = true;
      this.onRemoteUpdate();
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        if (this.destroyed) {
          ws.close();
          return;
        }
        this._reconnectAttempt = 0;
        this.isCloudConnected = true;
        this.isSyncError = false;
        this.lastWriteError = false;

        // Flush any queued delta messages from brief offline window
        while (this._outgoingQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
          const msg = this._outgoingQueue.shift();
          try {
            ws.send(msg);
          } catch {
            this._outgoingQueue.unshift(msg);
            break;
          }
        }

        // Start zero-cost ping/pong keepalive (handled by CF auto-response without waking DO)
        if (this._pingInterval) clearInterval(this._pingInterval);
        this._pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send('ping');
            } catch {}
          }
        }, PING_INTERVAL_MS);

        this.onRemoteUpdate();
      };

      ws.onmessage = (event) => {
        if (this.destroyed) return;
        const raw = event.data;
        if (raw === 'pong' || typeof raw !== 'string') return;

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }

        if (data.type === 'INIT_STATE') {
          this._applyInitState(data);
          this.hasInitialSyncLoaded = true;
          this.isCloudConnected = true;
          this.isSyncError = false;
          this.onRemoteUpdate();
          return;
        }

        this._handleRemoteMessage(data, false);
      };

      ws.onclose = () => {
        if (this._pingInterval) {
          clearInterval(this._pingInterval);
          this._pingInterval = null;
        }
        if (this.destroyed) return;
        this.isCloudConnected = false;
        this.onRemoteUpdate();
        this._scheduleReconnect();
      };

      ws.onerror = () => {
        if (this.destroyed) return;
        this.isSyncError = true;
        this.onRemoteUpdate();
      };
    } catch (err) {
      console.warn('[SharedWorldSync] WebSocket init error:', err);
      this.isCloudConnected = false;
      this.isSyncError = true;
      this.onRemoteUpdate();
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.destroyed || this._reconnectTimer) return;
    const delay = Math.min(15000, 1000 * Math.pow(2, this._reconnectAttempt));
    this._reconnectAttempt = Math.min(this._reconnectAttempt + 1, 5);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connectWebSocket();
    }, delay);
  }

  _applyInitState(init) {
    if (!init) return;
    if (typeof init.onlineCount === 'number') {
      this.onlineCount = init.onlineCount;
    }

    // 1. Apply nuclear strikes (without re-playing explosion animations)
    if (Array.isArray(init.nuclearStrikes)) {
      for (const strike of init.nuclearStrikes) {
        this.engine.handleRemoteNuclearStrike(strike, false, true);
      }
    }

    // 2. Apply countries + RLE territory spans
    if (Array.isArray(init.countries)) {
      for (const entry of init.countries) {
        if (!entry || !entry.country?.id) continue;
        this.engine.handleRemoteCountrySyncPacket(
          entry.country,
          null,
          entry.updatedAt || init.serverTime || 0,
          true,
          entry.rle || null
        );
      }
    }

    // 3. Reconnect player's own country from server state if it exists
    this.engine.restoreMyCountryFromServer();

    // 4. Replay diplomacy treaties
    if (Array.isArray(init.treaties)) {
      for (const p of init.treaties) {
        if (!p || !p.type) continue;
        if (p.type === 'TREATY_PROPOSAL' && p.treaty) {
          this.engine.handleRemoteTreatyProposal(p.treaty, true);
        } else if (p.type === 'TREATY_ACCEPT' && p.treatyId) {
          this.engine.handleRemoteTreatyAccept(p.treatyId, p.activatedAt || p._sentAt || 0, true);
        } else if (p.type === 'TREATY_REJECT' && p.treatyId) {
          this.engine.handleRemoteTreatyReject(p.treatyId, true);
        } else if (p.type === 'TREATY_BREAK' && p.treatyId) {
          this.engine.handleRemoteTreatyBreak(p.treatyId, p.breakerId, p.penalty, p.upfrontPaid, p.debt, p.reason, true);
        } else if (p.type === 'TREATY_PAYMENT' && p.treatyId) {
          this.engine.handleRemoteTreatyPayment(p.treatyId, p.amount, p.time, true);
        } else if (p.type === 'TREATY_REPARATION_PAYMENT' && p.treatyId) {
          this.engine.handleRemoteTreatyReparationPayment(p.treatyId, p.amount, p.remainingDebt, p.time, true);
        } else if (p.type === 'TREATY_TERMINATION_REQUEST' && p.treatyId) {
          this.engine.handleRemoteTreatyTerminationRequest(p.treatyId, p.requesterId);
        } else if (p.type === 'TREATY_TERMINATION_CANCEL_REQUEST' && p.treatyId) {
          this.engine.handleRemoteTreatyTerminationCancel(p.treatyId);
        } else if (p.type === 'TREATY_TERMINATION_ACCEPT' && p.treatyId) {
          this.engine.handleRemoteTreatyTerminationAccept(p.treatyId);
        } else if (p.type === 'TREATY_TERMINATION_REJECT' && p.treatyId) {
          this.engine.handleRemoteTreatyTerminationReject(p.treatyId);
        } else if (p.type === 'ADMIN_BREAK_COUNTRY_TREATIES' && p.countryId) {
          this.engine.adminBreakCountryTreaties(p.countryId, false);
        }
      }
    }

    // 5. Compute bounds ONCE for the entire map
    this.engine.computeCountryBounds();
    this.engine.dirtyRegions = false;
    this.engine.dirtyPixels = true;
    this.engine.saveState();

    // 6. Load recent chat messages (resolve flags locally from countryMap)
    if (Array.isArray(init.chats)) {
      for (const chat of init.chats) {
        const enriched = this._enrichChatFlag(chat);
        this.engine.handleRemoteChatMessage(enriched);
      }
    }
  }

  _enrichChatFlag(chat) {
    if (!chat || chat.flagDataUrl || !chat.countryId) return chat;
    const c = this.engine.countryMap.get(chat.countryId);
    if (!c) return chat;
    return {
      ...chat,
      flagDataUrl: c.flagDataUrl || this.getCompactFlagFromCountry(c),
    };
  }

  _syncStatsIfDirty() {
    const myC = this.engine.getMyCountry();
    if (!myC || myC.landCount <= 0) return;

    const stats = {
      troops: Number(myC.troops.toFixed(1)),
      gold: Math.floor(myC.gold),
      population: Math.floor(myC.population),
      color: myC.color,
      upgrades: myC.upgrades,
      inventory: myC.inventory || { nukes: 0 },
      popBoostUntil: myC.popBoostUntil || 0,
    };

    const sig = JSON.stringify(stats);
    if (sig === this._lastStatsSignature) return; // Nothing changed -> 0 bytes sent!
    this._lastStatsSignature = sig;

    const now = Date.now();
    this.broadcast({
      type: 'SYNC_COUNTRY_STATS',
      countryId: myC.id,
      stats: {
        ...stats,
        lastActiveTime: now,
        lastHeartbeatTime: now,
        lastInputTime: this.engine.lastInputTime || myC.lastInputTime || now,
      },
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this._statsInterval) clearInterval(this._statsInterval);
    if (this._pingInterval) clearInterval(this._pingInterval);
    if (this._batchTimer) clearTimeout(this._batchTimer);
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.channel) {
      try { this.channel.close(); } catch {}
      this.channel = null;
    }
  }

  // Synchronously convert country's decoded flagRgba buffer (or small dataUrl) into a compact <=1600 byte JPEG dataUrl
  getCompactFlagFromCountry(country) {
    if (!country || typeof document === 'undefined') return null;
    try {
      if (country.flagRgba && country.flagRgba.length === FLAG_W * FLAG_H * 4) {
        const srcCv = document.createElement('canvas');
        srcCv.width = FLAG_W;
        srcCv.height = FLAG_H;
        const sctx = srcCv.getContext('2d');
        const imgData = sctx.createImageData(FLAG_W, FLAG_H);
        imgData.data.set(country.flagRgba);
        sctx.putImageData(imgData, 0, 0);

        const dstCv = document.createElement('canvas');
        dstCv.width = 60;
        dstCv.height = 38;
        const dctx = dstCv.getContext('2d');
        dctx.drawImage(srcCv, 0, 0, 60, 38);
        return dstCv.toDataURL('image/jpeg', 0.70);
      }
      if (country.flagDataUrl && country.flagDataUrl.length <= 2500) {
        return country.flagDataUrl;
      }
    } catch {}
    return null;
  }

  // Kept for compatibility with WorldEngine calls (only used on explicit country creation/recovery, NEVER on a timer)
  publishMyCountrySnapshot() {
    const myC = this.engine.getMyCountry();
    if (!myC || myC.landCount <= 0) return;

    const rle = this.engine.getCountryRleSpans(myC.id);
    const compactFlag = this.getCompactFlagFromCountry(myC);

    const countryMeta = {
      id: myC.id,
      name: myC.name,
      color: myC.color,
      flagDataUrl: compactFlag,
      capitalX: myC.capitalX,
      capitalY: myC.capitalY,
      population: Math.round(myC.population),
      gold: Math.round(myC.gold),
      troops: Number(myC.troops.toFixed(1)),
      upgrades: myC.upgrades,
      inventory: myC.inventory || { nukes: 0, specialTroops: myC.specialTroops || 0 },
      doctrine: myC.doctrine || 'BALANCED',
      dailyStreak: myC.dailyStreak || 0,
      lastDailyClaimDay: myC.lastDailyClaimDay || '',
      quests: Array.isArray(myC.quests) ? myC.quests : null,
      _rewardGoldPool: Math.floor(myC._rewardGoldPool || 0),
      popBoostUntil: myC.popBoostUntil || 0,
      lastActiveTime: myC.lastActiveTime || Date.now(),
      creatorIp: myC.creatorIp,
      deviceId: myC.deviceId,
      createdAt: myC.createdAt,
      lastHeartbeatTime: Date.now(),
      lastInputTime: this.engine.lastInputTime || myC.lastInputTime || Date.now(),
    };

    this._sendToWorker({
      type: 'COUNTRY_SYNC_PACKET',
      country: countryMeta,
      rle,
    });
  }

  queuePixelConquest(countryId, x, y, cost) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'CONQUER_PIXEL',
          countryId,
          x,
          y,
          cost,
          _senderTabId: this.tabId,
        });
      } catch {}
    }

    // If countryId changed mid-batch, flush previous batch first
    if (this._pendingPixelsCountryId !== null && this._pendingPixelsCountryId !== countryId) {
      this._flushPixelBatch();
    }
    this._pendingPixelsCountryId = countryId;
    this._pendingPixelsMap.set(`${x},${y}`, [x, y]);

    if (!this._batchTimer) {
      this._batchTimer = setTimeout(() => {
        this._flushPixelBatch();
      }, PIXEL_BATCH_MS);
    }
  }

  _flushPixelBatch() {
    this._batchTimer = null;
    if (this._pendingPixelsMap.size === 0 || this._pendingPixelsCountryId === null) return;

    const countryId = this._pendingPixelsCountryId;
    const pts = [];
    for (const [x, y] of this._pendingPixelsMap.values()) {
      pts.push(x, y);
    }
    this._pendingPixelsMap.clear();

    // Send ONLY the changed pixel coordinates — NEVER the full map!
    this._sendToWorker({
      type: 'CONQUER_BATCH',
      countryId,
      pts,
    });
  }

  broadcast(data) {
    const packet = {
      ...data,
      _msgId: data._msgId || `${this.tabId}_${Date.now()}_${++this._msgSeq}`,
      _senderTabId: this.tabId,
      _senderDeviceId: this.engine.myDeviceId,
    };

    this.seenMsgIds.add(packet._msgId);

    // 1. Local browser tabs
    if (this.channel) {
      try {
        this.channel.postMessage(packet);
      } catch {}
    }

    // 2. Delta-only pixel conquest
    if (data.type === 'CONQUER_PIXEL') {
      if (data.wasEnemy === true) {
        // Enemy attacks send immediately as a tiny single-pixel delta (no full-map snapshot!)
        this._sendToWorker(packet);
        return;
      }
      this.queuePixelConquest(data.countryId, data.x, data.y, data.cost);
      return;
    }

    if (data.type === 'NEW_COUNTRY' && packet.country) {
      const fullC = this.engine.countryMap.get(packet.country.id) || packet.country;
      const compactFlag = this.getCompactFlagFromCountry(fullC);
      this._sendToWorker({
        ...packet,
        country: {
          ...packet.country,
          flagDataUrl: compactFlag,
        },
      });
      return;
    }

    this._sendToWorker(packet);
  }

  // Compatibility no-ops (server Durable Object handles state cleanup on ADMIN_RESET_WORLD / ADMIN_DELETE_COUNTRY)
  clearAllCloudCountriesState() {}
  deleteCloudCountryState() {}

  _sendToWorker(packet) {
    const fullPacket = {
      ...packet,
      _msgId: packet._msgId || `${this.tabId}_${Date.now()}_${++this._msgSeq}`,
      _senderTabId: this.tabId,
      _sentAt: packet._sentAt || Date.now(),
    };
    this.seenMsgIds.add(fullPacket._msgId);

    const encoded = JSON.stringify(fullPacket);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(encoded);
        this.lastWriteError = false;
      } catch {
        this.lastWriteError = true;
        this._enqueueOutgoing(encoded);
      }
    } else {
      this._enqueueOutgoing(encoded);
    }
  }

  _enqueueOutgoing(encoded) {
    if (this._outgoingQueue.length >= MAX_PENDING_QUEUE) {
      this._outgoingQueue.shift();
    }
    this._outgoingQueue.push(encoded);
  }

  _handleRemoteMessage(data, isHistoryReplay = false) {
    if (!data) return;
    if (!isHistoryReplay && data._senderTabId === this.tabId) return;

    if (data._msgId) {
      if (this.seenMsgIds.has(data._msgId)) return;
      this.seenMsgIds.add(data._msgId);
      if (this.seenMsgIds.size > 800) {
        const first = this.seenMsgIds.values().next().value;
        this.seenMsgIds.delete(first);
      }
    }

    if (data.type === 'NEW_COUNTRY' && data.country) {
      this.engine.handleRemoteNewCountry(data.country);
      if (data.country.deviceId === this.engine.myDeviceId && !this.engine.myCountryId) {
        this.engine.myCountryId = data.country.id;
      }
      this.onRemoteUpdate();
    } else if (data.type === 'UPDATE_COUNTRY_FLAG' && data.countryId && data.flagDataUrl) {
      this.engine.handleRemoteUpdateFlag(data.countryId, data.flagDataUrl);
      this.onRemoteUpdate();
    } else if (data.type === 'COUNTRY_SYNC_PACKET' && data.country) {
      this.engine.handleRemoteCountrySyncPacket(
        data.country,
        data.pts,
        data._sentAt || 0,
        false,
        data.rle || null
      );
      if (data.country.deviceId === this.engine.myDeviceId && !this.engine.myCountryId) {
        this.engine.myCountryId = data.country.id;
      }
      this.onRemoteUpdate();
    } else if (data.type === 'CONQUER_PIXEL') {
      this.engine.handleRemoteConquerPixel(data.countryId, data.x, data.y, data.cost, false, data.wasEnemy ?? null);
      this.onRemoteUpdate();
    } else if (data.type === 'CONQUER_BATCH' && Array.isArray(data.pts)) {
      for (let i = 0; i < data.pts.length; i += 2) {
        this.engine.handleRemoteConquerPixel(data.countryId, data.pts[i], data.pts[i + 1], 0, false, false);
      }
      this.engine.computeCountryBounds();
      this.engine.dirtyPixels = true;
      this.onRemoteUpdate();
    } else if (data.type === 'LAUNCH_SHIP' && data.ship) {
      this.engine.handleRemoteLaunchShip(data.ship);
      this.onRemoteUpdate();
    } else if (data.type === 'SYNC_COUNTRY_STATS') {
      this.engine.handleRemoteSyncCountryStats(
        data.countryId,
        data.stats,
        data._sentAt || 0,
        false,
        Boolean(data.isAdminOverride)
      );
      this.onRemoteUpdate();
    } else if (data.type === 'UNDO_PIXEL') {
      this.engine.handleRemoteUndoPixel(data.countryId, data.x, data.y, data.prevOwner);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_PROPOSAL' && data.treaty) {
      this.engine.handleRemoteTreatyProposal(data.treaty, false);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_ACCEPT' && data.treatyId) {
      this.engine.handleRemoteTreatyAccept(data.treatyId, data.activatedAt || data._sentAt || Date.now(), false);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_REJECT' && data.treatyId) {
      this.engine.handleRemoteTreatyReject(data.treatyId, false);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_BREAK' && data.treatyId) {
      this.engine.handleRemoteTreatyBreak(data.treatyId, data.breakerId, data.penalty, data.upfrontPaid, data.debt, data.reason, false);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_PAYMENT' && data.treatyId) {
      this.engine.handleRemoteTreatyPayment(data.treatyId, data.amount, data.time, false);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_REPARATION_PAYMENT' && data.treatyId) {
      this.engine.handleRemoteTreatyReparationPayment(data.treatyId, data.amount, data.remainingDebt, data.time, false);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_TERMINATION_REQUEST' && data.treatyId) {
      this.engine.handleRemoteTreatyTerminationRequest(data.treatyId, data.requesterId);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_TERMINATION_CANCEL_REQUEST' && data.treatyId) {
      this.engine.handleRemoteTreatyTerminationCancel(data.treatyId);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_TERMINATION_ACCEPT' && data.treatyId) {
      this.engine.handleRemoteTreatyTerminationAccept(data.treatyId);
      this.onRemoteUpdate();
    } else if (data.type === 'TREATY_TERMINATION_REJECT' && data.treatyId) {
      this.engine.handleRemoteTreatyTerminationReject(data.treatyId);
      this.onRemoteUpdate();
    } else if (data.type === 'NUCLEAR_STRIKE' && data.strike) {
      this.engine.handleRemoteNuclearStrike(data.strike, false, isHistoryReplay);
      this.onRemoteUpdate();
    } else if (data.type === 'GLOBAL_CHAT' && data.chat) {
      this.engine.handleRemoteChatMessage(this._enrichChatFlag(data.chat));
      this.onRemoteUpdate();
    } else if (data.type === 'ADMIN_DELETE_COUNTRY' && data.countryId) {
      this.engine.adminDeleteCountry(data.countryId, false);
      this.onRemoteUpdate();
    } else if (data.type === 'ADMIN_CLEAR_CHAT') {
      this.engine.adminClearChat(false);
      this.onRemoteUpdate();
    } else if (data.type === 'ADMIN_CLEAR_RADIATION') {
      this.engine.adminClearRadiation(false, data._sentAt || data._envTime || 0);
      this.onRemoteUpdate();
    } else if (data.type === 'ADMIN_BREAK_COUNTRY_TREATIES' && data.countryId) {
      this.engine.adminBreakCountryTreaties(data.countryId, false);
      this.onRemoteUpdate();
    } else if (data.type === 'ADMIN_RESET_TREATIES') {
      this.engine.adminResetTreaties(false);
      this.onRemoteUpdate();
    } else if (data.type === 'ADMIN_RESET_WORLD') {
      this.engine.adminResetWorld(false);
      this.onRemoteUpdate();
    }
  }

  sendChatMessage(text, isAdmin = false) {
    if (!text || !text.trim()) return;
    const myC = this.engine.getMyCountry();
    const richest = this.engine.getRichestCountry();
    const isRichest = Boolean(myC && richest && myC.id === richest.id && myC.gold >= 500);
    const rankInfo = myC ? this.engine.getCountryTitle(myC) : null;

    const localFlag = myC ? this.getCompactFlagFromCountry(myC) : null;
    const chatBase = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      countryId: myC?.id || 0,
      countryName: myC?.name || (isAdmin ? 'Admin' : 'Gezgin'),
      countryColor: isAdmin ? '#FBBF24' : myC?.color || '#38BDF8',
      countryTitle: rankInfo?.title || null,
      countryTitleBadge: rankInfo?.badge || null,
      isAdmin: Boolean(isAdmin),
      isRichest,
      text: text.trim().slice(0, 160),
      time: Date.now(),
    };

    // Show flag locally, but DO NOT transmit 1.6KB flag JPEG over the wire in chat!
    this.engine.handleRemoteChatMessage({ ...chatBase, flagDataUrl: localFlag });
    this.broadcast({
      type: 'GLOBAL_CHAT',
      chat: { ...chatBase, flagDataUrl: null },
    });
  }
}
