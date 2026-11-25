import { DurableObject } from 'cloudflare:workers';

// Pixel coordinate packing: supports maps up to 4096x4096 with integer keys
const PIXEL_STRIDE = 4096;
const MAX_CHAT_HISTORY = 50;
const MAX_TREATY_EVENTS = 200;
const MAX_NUCLEAR_STRIKES = 60;
const MAX_MESSAGE_BYTES = 24 * 1024; // 24 KB safety cap per WS frame

function packXY(x, y) {
  return (y | 0) * PIXEL_STRIDE + (x | 0);
}

function unpackXY(k) {
  const y = Math.floor(k / PIXEL_STRIDE);
  const x = k - y * PIXEL_STRIDE;
  return [x, y];
}

/**
 * WorldRoom Durable Object
 * - Uses WebSocket Hibernation API so 50+ concurrent players cost 1 HTTP request on connect
 *   and 0 CPU while idle.
 * - Uses setWebSocketAutoResponse("ping" -> "pong") so keep-alive pings NEVER wake the DO.
 * - Persists authoritative world state in embedded SQLite and broadcasts ONLY minimal deltas.
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

      // Send ONE compact authoritative initial state snapshot over the WebSocket
      try {
        const initPacket = this._buildInitStatePacket();
        server.send(JSON.stringify(initPacket));
      } catch (err) {
        console.error('INIT_STATE build error:', err);
      }

      // Notify others of online count cheaply only when needed
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Build compact initial state for a newly connected player.
   * Compresses each country's owned pixels into RLE spans [x, y, len, ...]
   * so thousands of pixels fit in a few kilobytes.
   */
  _buildInitStatePacket() {
    const countriesRows = this.sql.exec(
      'SELECT id, meta_json, flag_data_url, updated_at FROM countries ORDER BY updated_at ASC'
    ).toArray();

    // Group pixels by countryId and build RLE spans
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
          // Ensure we don't wrap across row boundary
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

  /**
   * Hibernation WebSocket message handler.
   * Applies minimal delta to SQLite and broadcasts ONLY the delta to other sockets.
   */
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

    // Apply authoritative state mutation in SQLite
    const shouldBroadcast = this._applyDelta(data, now);
    if (!shouldBroadcast) return;

    // Strip redundant flagDataUrl from chat messages to save bandwidth (clients resolve by countryId)
    let outData = data;
    if (data.type === 'GLOBAL_CHAT' && data.chat && data.chat.flagDataUrl) {
      outData = {
        ...data,
        chat: { ...data.chat, flagDataUrl: null },
      };
    }

    const encoded = JSON.stringify(outData);
    const sockets = this.ctx.getWebSockets();
    for (const peer of sockets) {
      if (peer === ws) continue;
      try {
        peer.send(encoded);
      } catch {
        // Dead socket will be cleaned up by webSocketClose/webSocketError
      }
    }
  }

  _applyDelta(data, now) {
    const t = data.type;

    if (t === 'CONQUER_PIXEL') {
      const cid = Number(data.countryId);
      const x = data.x | 0;
      const y = data.y | 0;
      if (!cid) return false;
      this.sql.exec(
        'INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)',
        packXY(x, y),
        cid
      );
      return true;
    }

    if (t === 'CONQUER_BATCH') {
      const cid = Number(data.countryId);
      const pts = data.pts;
      if (!cid || !Array.isArray(pts) || pts.length < 2) return false;
      // Apply all changed pixels in one fast loop (DO SQLite auto-coalesces writes per turn)
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const k = packXY(pts[i] | 0, pts[i + 1] | 0);
        this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', k, cid);
      }
      return true;
    }

    if (t === 'UNDO_PIXEL') {
      const x = data.x | 0;
      const y = data.y | 0;
      const prevOwner = Number(data.prevOwner || 0);
      const k = packXY(x, y);
      if (prevOwner > 0) {
        this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', k, prevOwner);
      } else {
        this.sql.exec('DELETE FROM pixels WHERE k = ?', k);
      }
      return true;
    }

    if (t === 'NEW_COUNTRY' && data.country?.id) {
      const c = data.country;
      const flag = c.flagDataUrl || null;
      const meta = { ...c };
      delete meta.flagDataUrl;
      this.sql.exec(
        'INSERT OR REPLACE INTO countries (id, meta_json, flag_data_url, updated_at) VALUES (?, ?, ?, ?)',
        Number(c.id),
        JSON.stringify(meta),
        flag,
        now
      );
      if (Number.isFinite(c.capitalX) && Number.isFinite(c.capitalY)) {
        this.sql.exec(
          'INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)',
          packXY(c.capitalX | 0, c.capitalY | 0),
          Number(c.id)
        );
      }
      return true;
    }

    if (t === 'UPDATE_COUNTRY_FLAG' && data.countryId && data.flagDataUrl) {
      this.sql.exec(
        'UPDATE countries SET flag_data_url = ?, updated_at = ? WHERE id = ?',
        data.flagDataUrl,
        now,
        Number(data.countryId)
      );
      return true;
    }

    if (t === 'SYNC_COUNTRY_STATS' && data.countryId && data.stats) {
      const cid = Number(data.countryId);
      const row = this.sql.exec('SELECT meta_json FROM countries WHERE id = ?', cid).toArray()[0];
      if (row) {
        try {
          const meta = JSON.parse(row.meta_json);
          Object.assign(meta, data.stats);
          this.sql.exec(
            'UPDATE countries SET meta_json = ?, updated_at = ? WHERE id = ?',
            JSON.stringify(meta),
            now,
            cid
          );
        } catch {}
      }
      return true;
    }

    if (t === 'COUNTRY_SYNC_PACKET' && data.country?.id) {
      // Only used on initial country creation or explicit repair, never periodic
      const c = data.country;
      const cid = Number(c.id);
      const existing = this.sql.exec('SELECT flag_data_url FROM countries WHERE id = ?', cid).toArray()[0];
      const flag = c.flagDataUrl || existing?.flag_data_url || null;
      const meta = { ...c };
      delete meta.flagDataUrl;
      this.sql.exec(
        'INSERT OR REPLACE INTO countries (id, meta_json, flag_data_url, updated_at) VALUES (?, ?, ?, ?)',
        cid,
        JSON.stringify(meta),
        flag,
        now
      );
      if (Array.isArray(data.rle) && data.rle.length >= 3) {
        for (let i = 0; i + 2 < data.rle.length; i += 3) {
          const sy = data.rle[i] | 0;
          const sx = data.rle[i + 1] | 0;
          const len = data.rle[i + 2] | 0;
          for (let dx = 0; dx < len; dx++) {
            this.sql.exec('INSERT OR REPLACE INTO pixels (k, c) VALUES (?, ?)', packXY(sx + dx, sy), cid);
          }
        }
      }
      return true;
    }

    if (t === 'GLOBAL_CHAT' && data.chat?.id) {
      const chatClean = { ...data.chat, flagDataUrl: null };
      this.sql.exec(
        'INSERT OR REPLACE INTO chats (id, payload_json, created_at) VALUES (?, ?, ?)',
        String(chatClean.id),
        JSON.stringify(chatClean),
        chatClean.time || now
      );
      // Trim old chat rows
      this.sql.exec(
        `DELETE FROM chats WHERE id NOT IN (SELECT id FROM chats ORDER BY created_at DESC LIMIT ${MAX_CHAT_HISTORY})`
      );
      return true;
    }

    if (t === 'NUCLEAR_STRIKE' && data.strike) {
      this.sql.exec(
        'INSERT INTO nuclear_strikes (payload_json, created_at) VALUES (?, ?)',
        JSON.stringify(data.strike),
        now
      );
      return true;
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
      return true;
    }

    if (t === 'LAUNCH_SHIP') {
      // Ephemeral visual/gameplay event — broadcast only, no SQLite write needed
      return true;
    }

    // Admin actions
    if (t === 'ADMIN_DELETE_COUNTRY' && data.countryId) {
      const cid = Number(data.countryId);
      this.sql.exec('DELETE FROM countries WHERE id = ?', cid);
      this.sql.exec('DELETE FROM pixels WHERE c = ?', cid);
      return true;
    }

    if (t === 'ADMIN_CLEAR_CHAT') {
      this.sql.exec('DELETE FROM chats');
      return true;
    }

    if (t === 'ADMIN_CLEAR_RADIATION') {
      this.sql.exec('DELETE FROM nuclear_strikes');
      return true;
    }

    if (t === 'ADMIN_RESET_TREATIES') {
      this.sql.exec('DELETE FROM treaties');
      return true;
    }

    if (t === 'ADMIN_RESET_WORLD') {
      this.sql.exec('DELETE FROM countries');
      this.sql.exec('DELETE FROM pixels');
      this.sql.exec('DELETE FROM chats');
      this.sql.exec('DELETE FROM treaties');
      this.sql.exec('DELETE FROM nuclear_strikes');
      return true;
    }

    return true;
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
