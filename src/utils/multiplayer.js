import PeerPkg from 'peerjs';
const Peer = typeof PeerPkg === 'function' ? PeerPkg : (PeerPkg?.Peer || PeerPkg?.default || PeerPkg);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const getStoredClientToken = () => {
  try {
    let token = sessionStorage.getItem('sf_client_token');
    if (!token) {
      token = 'ct_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('sf_client_token', token);
    }
    return token;
  } catch {
    return 'ct_' + Math.random().toString(36).slice(2, 10);
  }
};

class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = null;
    this.clientToken = getStoredClientToken();
    this.activeClientToken = null; // On Host: token of the authorized remote client
    this.connections = []; // For host: list of client conns (strictly 1 active client)
    this.hostConn = null; // For client: connection to host
    this.channel = null; // Native browser BroadcastChannel for instant local tab sync
    this.onStateChange = null;
    this.onActionReceived = null;
    this.onPeerConnected = null;
    this.onPeerDisconnected = null;
    this.status = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
    this.seenMsgIds = new Set();
    this._msgCounter = 0;
    this._connectTimeout = null;
  }

  _stamp(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    if (payload._msgId) return payload;
    return {
      ...payload,
      _clientToken: this.clientToken,
      _msgId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${++this._msgCounter}`,
    };
  }

  _isDuplicate(data) {
    if (!data || !data._msgId) return false;
    if (this.seenMsgIds.has(data._msgId)) return true;
    this.seenMsgIds.add(data._msgId);
    if (this.seenMsgIds.size > 200) {
      const first = this.seenMsgIds.values().next().value;
      this.seenMsgIds.delete(first);
    }
    return false;
  }

  // Create a room as Host
  createRoom(customCode, onReady, onError) {
    this.cleanup();
    this.isHost = true;
    // 5-digit room code gives 90,000 combinations, drastically reducing collision probability
    const code = customCode || Math.floor(10000 + Math.random() * 90000).toString();
    this.roomCode = code;

    // Local BroadcastChannel for instant same-browser/PC sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(`sf-room-${code}`);
        this.channel.onmessage = (e) => {
          const data = e.data;
          if (!data || data._sender === 'HOST') return;
          if (this._isDuplicate(data)) return;
          if (this.onActionReceived) {
            this.onActionReceived(data, {
              send: (resp) => {
                if (this.channel) this.channel.postMessage({ ...this._stamp(resp), _sender: 'HOST' });
              }
            });
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    const peerId = `sf-game-${code}`;
    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    this.peer.on('open', () => {
      this.status = 'CONNECTED';
      if (onReady) onReady(code);
    });

    this.peer.on('connection', (conn) => {
      const incomingToken = conn.metadata?.clientToken;
      const activeOpenConns = this.connections.filter(c => c !== conn && c.open);

      // Enforce single remote client limit
      if (activeOpenConns.length >= 1) {
        // If this is the SAME client reconnecting (e.g. WiFi hiccup or page refresh), replace stale connection
        if (incomingToken && this.activeClientToken && incomingToken === this.activeClientToken) {
          activeOpenConns.forEach(old => {
            try { old.close(); } catch {}
          });
          this.connections = [conn];
        } else {
          // A second different remote device is trying to connect: REJECT!
          conn.on('open', () => {
            try {
              conn.send(this._stamp({
                type: 'ROOM_FULL',
                message: 'Bu oda dolu! Sadece 2 cihaz (Oda Sahibi ve 1 Katılımcı) desteklenmektedir.',
              }));
              setTimeout(() => {
                try { conn.close(); } catch {}
              }, 500);
            } catch {}
          });
          return;
        }
      } else {
        this.connections.push(conn);
        if (incomingToken) {
          this.activeClientToken = incomingToken;
        }
      }

      conn.on('open', () => {
        if (this.onPeerConnected) {
          this.onPeerConnected(conn);
        }
      });

      conn.on('data', (data) => {
        if (!data) return;
        if (data.type === 'CLIENT_HANDSHAKE' && data.clientToken) {
          this.activeClientToken = data.clientToken;
        }
        if (this._isDuplicate(data)) return;
        if (this.onActionReceived) {
          this.onActionReceived(data, conn);
        }
      });

      conn.on('close', () => {
        this.connections = this.connections.filter(c => c !== conn);
        if (this.onPeerDisconnected) {
          this.onPeerDisconnected(conn);
        }
      });
    });

    this.peer.on('error', (err) => {
      // If code was already taken (e.g. quick refresh), still allow local BroadcastChannel or trigger ready
      if (err.type === 'unavailable-id') {
        this.status = 'CONNECTED';
        if (onReady) onReady(code);
      } else {
        if (onError) onError(err);
      }
    });
  }

  // Join a room as Client
  joinRoom(code, onConnected, onError) {
    this.cleanup();
    this.isHost = false;
    this.roomCode = code;

    let hasConnected = false;

    const markConnected = () => {
      if (hasConnected) return;
      hasConnected = true;
      if (this._connectTimeout) {
        clearTimeout(this._connectTimeout);
        this._connectTimeout = null;
      }
      this.status = 'CONNECTED';
      if (onConnected) onConnected();
    };

    // Fail gracefully if no host responds within 12 seconds
    this._connectTimeout = setTimeout(() => {
      if (!hasConnected) {
        this.cleanup();
        if (onError) onError(new Error('Oda bulunamadı veya zaman aşımına uğradı.'));
      }
    }, 12000);

    // Local BroadcastChannel for instant same-browser/PC sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(`sf-room-${code}`);
        this.channel.onmessage = (e) => {
          const data = e.data;
          if (!data || data._sender !== 'HOST') return;
          markConnected();
          if (this._isDuplicate(data)) return;
          if (this.onStateChange) {
            this.onStateChange(data);
          }
        };
        // Ping local tab host immediately if open in same browser
        this.channel.postMessage({ ...this._stamp({ type: 'CLIENT_JOIN' }), _sender: 'CLIENT' });
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    const targetPeerId = `sf-game-${code}`;
    this.peer = new Peer({
      debug: 1,
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    this.peer.on('open', () => {
      this.hostConn = this.peer.connect(targetPeerId, {
        reliable: true,
        metadata: { clientToken: this.clientToken },
      });

      this.hostConn.on('open', () => {
        markConnected();
        // Send initial handshake with clientToken
        try {
          this.hostConn.send(this._stamp({
            type: 'CLIENT_HANDSHAKE',
            clientToken: this.clientToken,
          }));
        } catch {}
      });

      this.hostConn.on('data', (data) => {
        if (!hasConnected) markConnected();
        if (this._isDuplicate(data)) return;
        if (this.onStateChange) {
          this.onStateChange(data);
        }
      });

      this.hostConn.on('close', () => {
        if (this.onPeerDisconnected) {
          this.onPeerDisconnected();
        }
      });

      this.hostConn.on('error', (err) => {
        console.warn('Peer connection error:', err);
      });
    });

    this.peer.on('error', (err) => {
      if (!hasConnected && err?.type === 'peer-unavailable') {
        setTimeout(() => {
          if (!hasConnected) {
            this.cleanup();
            if (onError) onError(err);
          }
        }, 600);
      } else if (!this.channel && !hasConnected && onError) {
        this.cleanup();
        onError(err);
      }
    });
  }

  // Reconnect client to existing room
  reconnect(onSuccess, onError) {
    if (!this.roomCode || this.isHost) return;
    this.joinRoom(this.roomCode, onSuccess, onError);
  }

  // Host broadcasts state to all clients
  broadcastState(state) {
    if (!this.isHost) return;
    const stamped = this._stamp(state);

    // Broadcast via WebRTC
    this.connections.forEach(conn => {
      if (conn.open) {
        try {
          conn.send(stamped);
        } catch {}
      }
    });

    // Broadcast via local channel
    if (this.channel) {
      try {
        this.channel.postMessage({ ...stamped, _sender: 'HOST' });
      } catch {}
    }
  }

  // Client sends action to host (or host sends to self)
  sendAction(action) {
    const stamped = this._stamp(action);
    if (stamped && stamped._msgId) {
      this.seenMsgIds.add(stamped._msgId);
    }
    if (this.isHost) {
      if (this.onActionReceived) {
        this.onActionReceived(stamped, null);
      }
    } else {
      if (this.hostConn && this.hostConn.open) {
        try {
          this.hostConn.send(stamped);
        } catch {}
      }
      if (this.channel) {
        try {
          this.channel.postMessage({ ...stamped, _sender: 'CLIENT' });
        } catch {}
      }
    }
  }

  cleanup() {
    if (this._connectTimeout) {
      clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    this.seenMsgIds.clear();
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    if (this.hostConn) {
      try {
        this.hostConn.close();
      } catch {}
      this.hostConn = null;
    }
    this.connections.forEach(c => {
      try {
        c.close();
      } catch {}
    });
    this.connections = [];
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
    this.status = 'DISCONNECTED';
    this.roomCode = null;
    this.isHost = false;
    this.activeClientToken = null;
  }
}

export const multiplayer = new MultiplayerManager();
