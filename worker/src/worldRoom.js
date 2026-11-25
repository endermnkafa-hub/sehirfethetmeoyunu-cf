import { DurableObject } from 'cloudflare:workers';

// Pixel coordinate packing: supports maps up to 4096x4096 with integer keys
const PIXEL_STRIDE = 4096;
const MAX_CHAT_HISTORY = 50;
const MAX_TREATY_EVENTS = 200;
const MAX_NUCLEAR_STRIKES = 60;
const MAX_MESSAGE_BYTES = 24 * 1024; // 24 KB safety cap per WS frame
const MAX_BATCH_COORDS = 250; // max 125 pixels per CONQUER_BATCH frame
const MAX_PIXELS_PER_SEC = 60; // generous for auto-conquer/drag, blocks map-wipe bots
const NAVAL_GRACE_MS = 25000; // allow non-adjacent shore landing after LAUNCH_SHIP
const CHAT_COOLDOWN_MS = 1500;

function packXY(x, y) {
  return (y | 0) * PIXEL_STRIDE + (x | 0);
}

function unpackXY(k) {
  const y = Math.floor(k / PIXEL_STRIDE);
  const x = k - y * PIXEL_STRIDE;
  return [x, y];
}

function isValidCoord(x, y) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < PIXEL_STRIDE &&
    y < PIXEL_STRIDE
  );
}

/**
 * WorldRoom Durable Object (Authoritative + Anti-Cheat + Hibernation)
 * - Uses WebSocket Hibernation API so 50+ concurrent players cost 1 HTTP request on connect
 *   and 0 CPU while idle.
 * - Uses setWebSocketAutoResponse("ping" -> "pong") so keep-alive pings NEVER wake the DO.
 * - Enforces server-side ownership, coordinate bounds, adjacency (with naval grace),
 *   rate limits, and stats sanity before persisting to SQLite and broadcasting deltas.
 */
export class WorldRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    // Auto-respond to keep-alive pings without waking the Durable Object (0 billable requests!)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

    this._initSchema();
  }

  _initSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS countries (
        id INTEGER PRIMARY KEY,
        meta_json TEXT NOT NULL,
        flag_data_url TEXT,
        device_id TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pixels (
        k INTEGER PRIMARY KEY,
        c INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS treaties (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nuclear_strikes (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      );
    `);

    // Safe migration for existing tables created before device_id column
    try {
      this.sql.exec('ALTER TABLE countries ADD COLUMN device_id TEXT');
    } catch {
      // Column already exists
    }
  }

  _getSession(ws) {
    try {
      const att = ws.deserializeAttachment();
      if (att && typeof att === 'object') return att;
    } catch {}
    return {
      deviceId: null,
      tokens: MAX_PIXELS_PER_SEC,
      lastTokenRefill: Date.now(),
      lastChatAt: 0,
      navalGraceUntil: 0,
    };
  }

  _saveSession(ws, session) {
    try {
      ws.serializeAttachment(session);
    } catch {}
  }

  _consumePixelTokens(session, count, now) {
    const elapsedSec = Math.max(0, (now - (session.lastTokenRefill || now)) / 1000);
    const refilled = Math.min(MAX_PIXELS_PER_SEC, (session.tokens ?? MAX_PIXELS_PER_SEC) + elapsedSec * MAX_PIXELS_PER_SEC);
    session.lastTokenRefill = now;
    if (refilled < count) {
      session.tokens = refilled;
      return false;
    }
    session.tokens = refilled - count;
    return true;
  }

  _verifyCountryOwner(countryId, senderDeviceId) {
    const row = this.sql.exec('SELECT device_id, meta_json FROM countries WHERE id = ?', countryId).toArray()[0];
    if (!row) return false;
    let ownerDevice = row.device_id;
    if (!ownerDevice && row.meta_json) {
      try {
        ownerDevice = JSON.parse(row.meta_json)?.deviceId || null;
      } catch {}
    }
    if (!ownerDevice) return true; // Legacy row without deviceId
    return Boolean(senderDeviceId && senderDeviceId === ownerDevice);
  }

  _isAdjacentToCountry(countryId, x, y, batchOwnedSet = null) {
    // Check 8-connected neighbors (allows diagonal expansion)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!isValidCoord(nx, ny)) continue;
        const nk = packXY(nx, ny);
        if (batchOwnedSet && batchOwnedSet.has(nk)) return true;
        const row = this.sql.exec('SELECT c FROM pixels WHERE k = ?', nk).toArray()[0];
        if (row && row.c === countryId) return true;
      }
    }
    return false;
  }

  _countryHasAnyPixels(countryId) {
    const row = this.sql.exec('SELECT 1 AS ok FROM pixels WHERE c = ? LIMIT 1', countryId).toArray()[0];
    return Boolean(row);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stats') {
      const sockets = this.ctx.getWebSockets();
      const countryCount = this.sql.exec('SELECT COUNT(*) AS cnt FROM countries').one()?.cnt || 0;
      const pixelCount = this.sql.exec('SELECT COUNT(*) AS cnt FROM pixels').one()?.cnt || 0;
      return new Response(
        JSON.stringify({
          onlinePlayers: sockets.length,
          countries: countryCount,
          conqueredPixels: pixelCount,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept with Hibernation API
      this.ctx.acceptWebSocket(server);
      this._saveSession(server, {
        deviceId: null,
        tokens: MAX_PIXELS_PER_SEC,
        lastTokenRefill: Date.now(),
        lastChatAt: 0,
        navalGraceUntil: 0,
      });

      // Send ONE compact authoritative initial state snapshot over the WebSocket
      try {
        const initPacket = this._buildInitStatePacket();
        server.send(JSON.stringify(initPacket));
      } catch (err) {
        console.error('INIT_STATE build error:', err);
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not Found', { status: 404 });
  }

  _buildInitStatePacket() {
    const countriesRows = this.sql.exec(
      'SELECT id, meta_json, flag_data_url, updated_at FROM countries ORDER BY updated_at ASC'
    ).toArray();

    const pixelsByCountry = new Map();
    const pixelRows = this.sql.exec('SELECT k, c FROM pixels ORDER BY k ASC').toArray();
    for (const row of pixelRows) {
      let arr = pixelsByCountry.get(row.c);
      if (!arr) {
        arr = [];
        pixelsByCountry.set(row.c, arr);
      }
      arr.push(row.k);
    }

    const countries = [];
    for (const row of countriesRows) {
      let meta;
      try {
        meta = JSON.parse(row.meta_json);
      } catch {
        continue;
      }
      if (row.flag_data_url) {
        meta.flagDataUrl = row.flag_data_url;
      }

      // Convert sorted packed keys into RLE [y, xStart, len, ...] (matching WorldEngine format)
      const keys = pixelsByCountry.get(row.id) || [];
      const rle = [];
      let i = 0;
      while (i < keys.length) {
        const startKey = keys[i];
        const [sx, sy] = unpackXY(startKey);
        let len = 1;
        while (i + len < keys.length && keys[i + len] === startKey + len) {
          if (sx + len >= PIXEL_STRIDE) break;
          len++;
        }
        rle.push(sy, sx, len);
        i += len;
      }

      countries.push({
        country: meta,
        rle,
        updatedAt: row.updated_at,
      });
    }

    const chatRows = this.sql.exec(
      `SELECT payload_json FROM chats ORDER BY created_at DESC LIMIT ${MAX_CHAT_HISTORY}`
    ).toArray().reverse();
    const chats = chatRows.map((r) => JSON.parse(r.payload_json));

    const treatyRows = this.sql.exec(
      `SELECT payload_json FROM treaties ORDER BY seq ASC LIMIT ${MAX_TREATY_EVENTS}`
    ).toArray();
    const treaties = treatyRows.map((r) => JSON.parse(r.payload_json));

    const strikeRows = this.sql.exec(
      `SELECT payload_json FROM nuclear_strikes ORDER BY seq ASC LIMIT ${MAX_NUCLEAR_STRIKES}`
    ).toArray();
    const nuclearStrikes = strikeRows.map((r) => JSON.parse(r.payload_json));

    const onlineCount = this.ctx.getWebSockets().length;

    return {
      type: 'INIT_STATE',
      countries,
      chats,
      treaties,
      nuclearStrikes,
      onlineCount,
      serverTime: Date.now(),
    };
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    if (message.length > MAX_MESSAGE_BYTES) return;

    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
    if (!data || !data.type) return;

    const now = Date.now();
    data._sentAt = data._sentAt || now;

    const session = this._getSession(ws);
    if (!session.deviceId && typeof data._senderDeviceId === 'string' && data._senderDeviceId.length > 0) {
      session.deviceId = data._senderDeviceId.slice(0, 64);
    }

    // Apply authoritative + anti-cheat validated delta to SQLite
    const validatedData = this._applyDelta(data, now, session);
    this._saveSession(ws, session);
    if (!validatedData) return;

    // Strip redundant flagDataUrl from chat messages to save bandwidth
    let outData = validatedData;
    if (validatedData.type === 'GLOBAL_CHAT' && validatedData.chat && validatedData.chat.flagDataUrl) {
      outData = {
        ...validatedData,
        chat: { ...validatedData.chat, flagDataUrl: null },
      };
    }

    const encoded = JSON.stringify(outData);
    const sockets = this.ctx.getWebSockets();
    for (const peer of sockets) {
      if (peer === ws) continue;
      try {
        peer.send(encoded);
      } catch {}
    }
  }

  _applyDelta(data, now, session) {
    const t = data.type;
    const senderDeviceId = data._senderDeviceId || session.deviceId || null;

    if (t === 'CONQUER_PIXEL') {
      const cid = Number(data.countryId);
      const x = data.x;
      const y = data.y;
      if (!cid || !isValidCoord(x, y)) return null;
      if (!this._verifyCountryOwner(cid, senderDeviceId)) return null;
      if (!this._consumePixelTokens(session, 1, now)) return null;

      const allowNonAdjacent = now <= (session.navalGraceUntil || 0) || !this._countryHasAnyPixels(cid);
      if (!allowNonAdjacent && !this._isAdjacentToCountry(cid, x, y)) {
        return null; // Reject teleport pixel
      }

      this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', packXY(x, y), cid);
      return data;
    }

    if (t === 'CONQUER_BATCH') {
      const cid = Number(data.countryId);
      const pts = data.pts;
      if (!cid || !Array.isArray(pts) || pts.length < 2 || pts.length > MAX_BATCH_COORDS) return null;
      if (!this._verifyCountryOwner(cid, senderDeviceId)) return null;

      const pixelCount = Math.floor(pts.length / 2);
      if (!this._consumePixelTokens(session, pixelCount, now)) return null;

      const allowNonAdjacent = now <= (session.navalGraceUntil || 0) || !this._countryHasAnyPixels(cid);
      const acceptedPts = [];
      const batchOwnedSet = new Set();

      for (let i = 0; i + 1 < pts.length; i += 2) {
        const x = pts[i];
        const y = pts[i + 1];
        if (!isValidCoord(x, y)) continue;
        if (!allowNonAdjacent && !this._isAdjacentToCountry(cid, x, y, batchOwnedSet)) {
          continue; // Drop non-adjacent teleport pixel
        }
        const k = packXY(x, y);
        batchOwnedSet.add(k);
        this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', k, cid);
        acceptedPts.push(x, y);
      }

      if (acceptedPts.length === 0) return null;
      return { ...data, pts: acceptedPts };
    }

    if (t === 'UNDO_PIXEL') {
      const cid = Number(data.countryId);
      const x = data.x;
      const y = data.y;
      if (!cid || !isValidCoord(x, y)) return null;
      if (!this._verifyCountryOwner(cid, senderDeviceId)) return null;

      const prevOwner = Number(data.prevOwner || 0);
      const k = packXY(x, y);
      if (prevOwner > 0) {
        this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', k, prevOwner);
      } else {
        this.sql.exec('DELETE FROM pixels WHERE k = ?', k);
      }
      return data;
    }

    if (t === 'LAUNCH_SHIP' && data.ship) {
      // Grant short naval landing grace window so shore pixel conquest passes adjacency check
      session.navalGraceUntil = now + NAVAL_GRACE_MS;
      return data;
    }

    if (t === 'NEW_COUNTRY' && data.country?.id) {
      const c = data.country;
      const cid = Number(c.id);
      if (!cid) return null;
      const flag = c.flagDataUrl || null;
      const deviceId = c.deviceId || senderDeviceId || null;
      if (deviceId) session.deviceId = deviceId;

      const meta = { ...c };
      delete meta.flagDataUrl;
      this.sql.exec(
        'INSERT OR REPLACE INTO countries (id, meta_json, flag_data_url, device_id, updated_at) VALUES (?, ?, ?, ?, ?)',
        cid,
        JSON.stringify(meta),
        flag,
        deviceId,
        now
      );
      if (Number.isFinite(c.capitalX) && Number.isFinite(c.capitalY)) {
        const cx = Math.floor(c.capitalX);
        const cy = Math.floor(c.capitalY);
        if (isValidCoord(cx, cy)) {
          this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', packXY(cx, cy), cid);
        }
      }
      return data;
    }

    if (t === 'UPDATE_COUNTRY_FLAG' && data.countryId && data.flagDataUrl) {
      const cid = Number(data.countryId);
      if (!this._verifyCountryOwner(cid, senderDeviceId)) return null;
      this.sql.exec(
        'UPDATE countries SET flag_data_url = ?, updated_at = ? WHERE id = ?',
        data.flagDataUrl,
        now,
        cid
      );
      return data;
    }

    if (t === 'SYNC_COUNTRY_STATS' && data.countryId && data.stats) {
      const cid = Number(data.countryId);
      const isAdminOverride = Boolean(data.isAdminOverride);
      if (!isAdminOverride && !this._verifyCountryOwner(cid, senderDeviceId)) return null;

      // Sanity clamp numeric fields
      const s = data.stats;
      const cleanStats = { ...s };
      if (cleanStats.troops !== undefined) {
        if (!Number.isFinite(cleanStats.troops) || cleanStats.troops < 0) return null;
      }
      if (cleanStats.gold !== undefined) {
        if (!Number.isFinite(cleanStats.gold) || cleanStats.gold < 0) return null;
      }
      if (cleanStats.population !== undefined) {
        if (!Number.isFinite(cleanStats.population) || cleanStats.population < 0) return null;
      }

      const row = this.sql.exec('SELECT meta_json FROM countries WHERE id = ?', cid).toArray()[0];
      if (row) {
        try {
          const meta = JSON.parse(row.meta_json);
          Object.assign(meta, cleanStats);
          this.sql.exec(
            'UPDATE countries SET meta_json = ?, updated_at = ? WHERE id = ?',
            JSON.stringify(meta),
            now,
            cid
          );
        } catch {}
      }
      return { ...data, stats: cleanStats };
    }

    if (t === 'COUNTRY_SYNC_PACKET' && data.country?.id) {
      const c = data.country;
      const cid = Number(c.id);
      const existing = this.sql.exec('SELECT flag_data_url, device_id FROM countries WHERE id = ?', cid).toArray()[0];
      if (existing && existing.device_id && senderDeviceId && existing.device_id !== senderDeviceId) {
        return null; // Reject overwriting another player's country
      }
      const flag = c.flagDataUrl || existing?.flag_data_url || null;
      const deviceId = c.deviceId || existing?.device_id || senderDeviceId || null;
      const meta = { ...c };
      delete meta.flagDataUrl;
      this.sql.exec(
        'INSERT OR REPLACE INTO countries (id, meta_json, flag_data_url, device_id, updated_at) VALUES (?, ?, ?, ?, ?)',
        cid,
        JSON.stringify(meta),
        flag,
        deviceId,
        now
      );
      if (Array.isArray(data.rle) && data.rle.length >= 3) {
        for (let i = 0; i + 2 < data.rle.length; i += 3) {
          const sy = data.rle[i] | 0;
          const sx = data.rle[i + 1] | 0;
          const len = Math.min(256, Math.max(0, data.rle[i + 2] | 0));
          for (let dx = 0; dx < len; dx++) {
            if (isValidCoord(sx + dx, sy)) {
              this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', packXY(sx + dx, sy), cid);
            }
          }
        }
      }
      return data;
    }

    if (t === 'GLOBAL_CHAT' && data.chat?.id) {
      if (!data.chat.isAdmin && now - (session.lastChatAt || 0) < CHAT_COOLDOWN_MS) {
        return null; // Chat spam protection
      }
      session.lastChatAt = now;
      const chatClean = {
        ...data.chat,
        text: String(data.chat.text || '').trim().slice(0, 160),
        flagDataUrl: null,
      };
      if (!chatClean.text) return null;

      this.sql.exec(
        'INSERT OR REPLACE INTO chats (id, payload_json, created_at) VALUES (?, ?, ?)',
        String(chatClean.id),
        JSON.stringify(chatClean),
        chatClean.time || now
      );
      this.sql.exec(
        `DELETE FROM chats WHERE id NOT IN (SELECT id FROM chats ORDER BY created_at DESC LIMIT ${MAX_CHAT_HISTORY})`
      );
      return { ...data, chat: chatClean };
    }

    if (t === 'NUCLEAR_STRIKE' && data.strike) {
      this.sql.exec(
        'INSERT INTO nuclear_strikes (payload_json, created_at) VALUES (?, ?)',
        JSON.stringify(data.strike),
        now
      );
      return data;
    }

    if (
      t === 'TREATY_PROPOSAL' ||
      t === 'TREATY_ACCEPT' ||
      t === 'TREATY_REJECT' ||
      t === 'TREATY_BREAK' ||
      t === 'TREATY_PAYMENT' ||
      t === 'TREATY_REPARATION_PAYMENT' ||
      t === 'TREATY_TERMINATION_REQUEST' ||
      t === 'TREATY_TERMINATION_CANCEL_REQUEST' ||
      t === 'TREATY_TERMINATION_ACCEPT' ||
      t === 'TREATY_TERMINATION_REJECT' ||
      t === 'ADMIN_BREAK_COUNTRY_TREATIES'
    ) {
      this.sql.exec(
        'INSERT INTO treaties (payload_json, created_at) VALUES (?, ?)',
        JSON.stringify(data),
        now
      );
      return data;
    }

    // Admin actions
    if (t === 'ADMIN_DELETE_COUNTRY' && data.countryId) {
      const cid = Number(data.countryId);
      this.sql.exec('DELETE FROM countries WHERE id = ?', cid);
      this.sql.exec('DELETE FROM pixels WHERE c = ?', cid);
      return data;
    }

    if (t === 'ADMIN_CLEAR_CHAT') {
      this.sql.exec('DELETE FROM chats');
      return data;
    }

    if (t === 'ADMIN_CLEAR_RADIATION') {
      this.sql.exec('DELETE FROM nuclear_strikes');
      return data;
    }

    if (t === 'ADMIN_RESET_TREATIES') {
      this.sql.exec('DELETE FROM treaties');
      return data;
    }

    if (t === 'ADMIN_RESET_WORLD') {
      this.sql.exec('DELETE FROM countries');
      this.sql.exec('DELETE FROM pixels');
      this.sql.exec('DELETE FROM chats');
      this.sql.exec('DELETE FROM treaties');
      this.sql.exec('DELETE FROM nuclear_strikes');
      return data;
    }

    return data;
  }

  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {}
  }

  async webSocketError(ws) {
    try {
      ws.close();
    } catch {}
  }
}
