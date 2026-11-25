// Client Network & Device Security Guard
// Enforces: 1 Device = 1 Country, Max 2 Countries per IP, VPN/Proxy Detection

const DEVICE_ID_KEY = 'sf_unique_device_id';
const MY_COUNTRY_KEY = 'sf_my_country_id';

// Salted FNV-1a hashes of authorized Admin IPv4 & IPv6 /64 prefix so raw IPs are never exposed in public source
const ADMIN_IP_HASHES = new Set([
  '8e7ef9be',
  'fd703693',
  'bb850af4',
  '4ee3cbf5',
  'bbe48bfc',
  '3d67831b',
  '75b15967',
  '11be88f1',
]);

function hashIpForAdmin(ip) {
  if (!ip || typeof ip !== 'string') return '';
  const s = 'sf_admin_salt_2026:' + ip.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function isAdminIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (ADMIN_IP_HASHES.has(hashIpForAdmin(ip))) return true;
  if (ip.includes(':')) {
    const prefix64 = ip.split(':').slice(0, 4).join(':');
    if (ADMIN_IP_HASHES.has(hashIpForAdmin(prefix64))) return true;
  }
  return false;
}

// Storage adapters are intentionally isolated: privacy settings, WebViews, or
// browser policies can disable localStorage while sessionStorage/cookies still work.
function getCookie(name) {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  } catch {
    return null;
  }
}

function setCookie(name, val) {
  try {
    if (typeof document === 'undefined') return false;
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${name}=${encodeURIComponent(val)}; max-age=${oneYear}; path=/; SameSite=Lax`;
    return true;
  } catch {
    return false;
  }
}

function readStorage(storageName, key) {
  try {
    const storage = globalThis[storageName];
    const value = storage?.getItem(key);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function readPersistentValue(key) {
  return readStorage('localStorage', key) ||
    readStorage('sessionStorage', key) ||
    getCookie(key);
}

function writePersistentValue(key, value) {
  let persisted = false;
  try {
    globalThis.localStorage?.setItem(key, value);
    persisted = true;
  } catch {}
  try {
    globalThis.sessionStorage?.setItem(key, value);
    persisted = true;
  } catch {}
  if (setCookie(key, value)) persisted = true;
  return persisted;
}

function removePersistentValue(key) {
  try { globalThis.localStorage?.removeItem(key); } catch {}
  try { globalThis.sessionStorage?.removeItem(key); } catch {}
  setCookie(key, '');
}

function createDeviceId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `dev_${globalThis.crypto.randomUUID()}`;
    }
  } catch {}
  return 'dev_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
}

export function getOrCreateDeviceId() {
  const existing = readPersistentValue(DEVICE_ID_KEY);
  if (existing) {
    writePersistentValue(DEVICE_ID_KEY, existing);
    return existing;
  }

  const id = createDeviceId();
  writePersistentValue(DEVICE_ID_KEY, id);
  return id;
}

export function getMyCountryId() {
  const id = readPersistentValue(MY_COUNTRY_KEY);
  if (id) writePersistentValue(MY_COUNTRY_KEY, id);
  return id;
}

export function saveMyCountryId(countryId) {
  if (countryId === null || countryId === undefined || countryId === '') {
    removePersistentValue(MY_COUNTRY_KEY);
    return;
  }
  writePersistentValue(MY_COUNTRY_KEY, String(countryId));
}

// Check IP and detect VPN/Proxy
export async function checkNetworkAndSecurity() {
  let clientIp = '127.0.0.1';
  let isVpnOrProxy = false;
  let providerName = '';
  let needsFallback = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    let res;
    try {
      res = await fetch('https://ipwho.is/', { cache: 'no-store', signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res?.ok) {
      const data = await res.json();
      if (data && data.success !== false && typeof data.ip === 'string' && data.ip.trim()) {
        clientIp = data.ip.trim();
        providerName = data.connection?.isp || data.connection?.org || '';
        const lowerIsp = (providerName + ' ' + (data.connection?.org || '')).toLowerCase();
        const vpnKeywords = [
          'vpn', 'proxy', 'tor', 'hosting', 'datacenter', 'digitalocean', 'm247',
          'ovh', 'linode', 'hetzner', 'choopa', 'amazon', 'google cloud', 'azure',
          'cloudflare', 'nordvpn', 'expressvpn', 'surfshark', 'privateinternetaccess',
          'cyberghost', 'zenmate', 'protonvpn', 'mullvad', 'windscribe'
        ];
        isVpnOrProxy = vpnKeywords.some((keyword) => lowerIsp.includes(keyword)) ||
          Boolean(data.security?.vpn || data.security?.proxy || data.security?.tor);
        needsFallback = false;
      }
    }
  } catch (_err) {
    // The fallback endpoint below is deliberately independent of the first request.
  }

  if (needsFallback) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      let response;
      try {
        response = await fetch('https://api.ipify.org?format=json', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (response?.ok) {
        const data = await response.json();
        if (typeof data?.ip === 'string' && data.ip.trim()) clientIp = data.ip.trim();
      }
    } catch {}
  }

  const existingCountryId = getMyCountryId();
  return {
    clientIp,
    isVpnOrProxy,
    isAdmin: isAdminIp(clientIp),
    providerName,
    hasExistingCountry: Boolean(existingCountryId),
    deviceId: getOrCreateDeviceId(),
  };
}
