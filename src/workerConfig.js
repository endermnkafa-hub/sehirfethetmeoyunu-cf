// Cloudflare Workers + Durable Objects WebSocket URL configuration
// Production: set VITE_WORKER_WS_URL in GitHub Actions Variables (e.g. wss://sehirfethetmeoyunu-worker.your-subdomain.workers.dev)
// Local dev: defaults to ws://127.0.0.1:8787 (wrangler dev)

export function getWorkerWsUrl() {
  if (typeof window === 'undefined') return '';

  const isLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const envUrl = (import.meta.env.VITE_WORKER_WS_URL || '').trim();
  const overrideUrl = (() => {
    try {
      return (window.localStorage.getItem('sf_worker_ws_url') || '').trim();
    } catch {
      return '';
    }
  })();

  let base = overrideUrl || envUrl || (isLocal ? 'ws://127.0.0.1:8787' : '');
  if (!base) return '';

  // Normalize http(s) -> ws(s)
  if (base.startsWith('https://')) base = 'wss://' + base.slice(8);
  else if (base.startsWith('http://')) base = 'ws://' + base.slice(7);
  base = base.replace(/\/+$/, '');

  const room = isLocal ? 'dev' : 'main';
  return `${base}/ws?room=${room}`;
}
