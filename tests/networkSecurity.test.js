import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateDeviceId, getMyCountryId, saveMyCountryId } from '../src/world/networkSecurity.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('device and country identity survive when localStorage access throws', () => {
  const previousLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const session = new MemoryStorage();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('storage blocked by browser policy'); },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: session,
    writable: true,
  });

  try {
    const firstId = getOrCreateDeviceId();
    assert.match(firstId, /^dev_/);
    assert.equal(getOrCreateDeviceId(), firstId);

    saveMyCountryId(42);
    assert.equal(getMyCountryId(), '42');
    saveMyCountryId(null);
    assert.equal(getMyCountryId(), null);
  } finally {
    if (previousLocal) Object.defineProperty(globalThis, 'localStorage', previousLocal);
    else delete globalThis.localStorage;
    if (previousSession) Object.defineProperty(globalThis, 'sessionStorage', previousSession);
    else delete globalThis.sessionStorage;
  }
});
