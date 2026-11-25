// Real-Time Shared World MMO Conquest Engine
// Hardcore logarithmic progression, Naval Ship Expeditions across seas, 9 Upgrade Branches (Max Lv.25), Zero Emojis

import { MAP_W, MAP_H } from "./worldRasterizer.js";
import { loadDataUrlToFlagBuffer } from "./flagLibrary.js";
import {
  getOrCreateDeviceId,
  getMyCountryId,
  saveMyCountryId,
} from "./networkSecurity.js";
import { SharedWorldSync } from "./sharedWorldSync.js";

const IS_DEV_SANDBOX =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
export const WORLD_SAVE_KEY = IS_DEV_SANDBOX
  ? "sf_shared_world_dev_sandbox_v1"
  : "sf_shared_world_v9_clean";

export const UPGRADE_DEFINITIONS = [
  {
    key: "mobilization",
    name: "Seferberlik Hızı",
    desc: "Her seviyede saniye başı asker üretim hızını +%5 artırır.",
    baseCost: 25,
    costScale: 1.38,
    maxLevel: 25,
  },
  {
    key: "weapons",
    name: "Taarruz Doktrini",
    desc: "Her seviyede ordunun saldırı gücünü +%6 artırır; düşman toprağı alırken daha az asker harcarsın.",
    baseCost: 30,
    costScale: 1.38,
    maxLevel: 25,
  },
  {
    key: "fortification",
    name: "Sınır Tahkimatı",
    desc: "Her seviyede topraklarının savunma direncini +%6 artırır; rakipler senden piksel alırken ağır kayıp verir.",
    baseCost: 30,
    costScale: 1.38,
    maxLevel: 25,
  },
  {
    key: "citadel",
    name: "Vatan Direnişi & Siper Ağı",
    desc: "Her seviyede tüm topraklarının işgal direncini +%8 artırır; toprağına saldıranlar çok daha fazla asker harcar.",
    baseCost: 35,
    costScale: 1.38,
    maxLevel: 25,
  },
  {
    key: "navy",
    name: "Donanma & Tersane",
    desc: "Her seviyede gemilerin deniz aşırı çıkarma menzilini +14 piksel ve gemi seyir hızını +%10 artırır.",
    baseCost: 30,
    costScale: 1.36,
    maxLevel: 25,
  },
  {
    key: "logistics",
    name: "Ordu Lojistiği",
    desc: "Her seviyede maksimum asker depolama kapasitesini +%8 artırır.",
    baseCost: 25,
    costScale: 1.35,
    maxLevel: 25,
  },
  {
    key: "economy",
    name: "Vergi & Hazine",
    desc: "Her seviyede halktan toplanan saniye başı altın gelirini +%6 artırır.",
    baseCost: 25,
    costScale: 1.35,
    maxLevel: 25,
  },
  {
    key: "housing",
    name: "İskan & Nüfus",
    desc: "Her seviyede halk kapasitesini ve nüfus artış hızını +%7 artırır (Ek vergi katkısı sağlar).",
    baseCost: 20,
    costScale: 1.33,
    maxLevel: 25,
  },
  {
    key: "siege",
    name: "Kuşatma & Harekat",
    desc: "Her seviyede sahipsiz gri toprakları fethetme asker maliyetini %2 düşürür.",
    baseCost: 40,
    costScale: 1.42,
    maxLevel: 25,
  },
];

export const DEFAULT_UPGRADES = {
  mobilization: 0,
  weapons: 0,
  fortification: 0,
  citadel: 0,
  navy: 0,
  logistics: 0,
  economy: 0,
  housing: 0,
  siege: 0,
};

// Market: Halka Nüfus Desteği (+50% Nüfus Artış Hızı)
// Fiyatlar 1.000 (1k) nüfuslu bir devlet için taban fiyatlardır; devletin mevcut nüfusuna göre doğru orantılı ölçeklenir.
export const POP_SUPPORT_TIERS = [
  { key: "5m", label: "5 Dakika", durationMs: 5 * 60 * 1000, baseCost: 1000 },
  { key: "10m", label: "10 Dakika", durationMs: 10 * 60 * 1000, baseCost: 1900 },
  { key: "15m", label: "15 Dakika", durationMs: 15 * 60 * 1000, baseCost: 2750 },
  { key: "30m", label: "30 Dakika", durationMs: 30 * 60 * 1000, baseCost: 5200 },
  { key: "1h", label: "1 Saat", durationMs: 60 * 60 * 1000, baseCost: 9800 },
  { key: "1d", label: "1 Gün", durationMs: 24 * 60 * 60 * 1000, baseCost: 195000 },
];

export function getPopSupportCost(population, baseCost) {
  const pop = Math.max(250, Number(population) || 0);
  const scale = pop / 1000;
  return Math.max(100, Math.round(baseCost * scale));
}

// State Doctrines (Multi-axis strategy: Economy vs Military vs Fortress)
export const DOCTRINE_DEFINITIONS = [
  {
    key: "BALANCED",
    name: "Dengeli Yönetim",
    icon: "⚖️",
    shortDesc: "Standart dengeli büyüme, ceza yok.",
    pros: ["Tüm alanlarda dengeli gelişim"],
    cons: ["Özel uzmanlık bonusu yok"],
    color: "#94A3B8",
  },
  {
    key: "MERCHANT",
    name: "Tüccar Cumhuriyeti",
    icon: "💰",
    shortDesc: "Yüksek altın geliri ve ucuz özel asker.",
    pros: ["+%35 Altın Geliri", "-%20 Özel Asker Maliyeti (200 Altın)"],
    cons: ["-%12 Normal Asker Kapasitesi"],
    color: "#FBBF24",
  },
  {
    key: "WARLORD",
    name: "Savaş İmparatorluğu",
    icon: "⚔️",
    shortDesc: "Yüksek saldırı gücü ve hızlı fetih.",
    pros: ["+%22 Saldırı Gücü", "-%10 Fetih Asker Maliyeti"],
    cons: ["-%15 Altın Geliri"],
    color: "#F43F5E",
  },
  {
    key: "FORTRESS",
    name: "Kale Devleti",
    icon: "🛡️",
    shortDesc: "Aşılmaz savunma ve hızlı nüfus artışı.",
    pros: ["+%28 Savunma Dayanıklılığı", "+%20 Nüfus Büyümesi"],
    cons: ["-%10 Saldırı Gücü"],
    color: "#38BDF8",
  },
];

// Deterministic Strategic Resource & Historic Capital Coordinates (1000x500 Miller Projected World)
// Accurately calibrated to real-world geography and guaranteed to snap to authentic land pixels
export const RAW_STRATEGIC_NODES = [
  // Historic Capitals / Wonders (+8% Attack & +8% Defense each, max +32%)
  { id: "cap_istanbul", type: "WONDER", name: "İstanbul", x: 580, y: 179 },
  { id: "cap_rome", type: "WONDER", name: "Roma", x: 535, y: 176 },
  { id: "cap_cairo", type: "WONDER", name: "Kahire", x: 587, y: 217 },
  { id: "cap_beijing", type: "WONDER", name: "Pekin", x: 823, y: 183 },
  { id: "cap_newyork", type: "WONDER", name: "New York", x: 294, y: 180 },
  { id: "cap_london", type: "WONDER", name: "Londra", x: 500, y: 139 },
  { id: "cap_tokyo", type: "WONDER", name: "Tokyo", x: 888, y: 198 },

  // Gold Mines (+12% Gold Income each, max +48%) - Balanced across all continents
  { id: "gold_safrica", type: "GOLD", name: "Witwatersrand Altın Madeni", x: 578, y: 391 },
  { id: "gold_alaska", type: "GOLD", name: "Klondike Altın Madeni", x: 113, y: 85 },
  { id: "gold_andes", type: "GOLD", name: "And Dağları Altın Madeni", x: 282, y: 332 },
  { id: "gold_oz", type: "GOLD", name: "Kalgoorlie Altın Madeni", x: 837, y: 406 },
  { id: "gold_siberia", type: "GOLD", name: "Sibirya Altın Madeni", x: 849, y: 110 },
  { id: "gold_ghana", type: "GOLD", name: "Batı Afrika Altın Madeni", x: 496, y: 292 },

  // Oil & Industrial Hubs (+12% Troop Production each, max +48%) - Balanced across all continents
  { id: "oil_gulf", type: "OIL", name: "Basra Petrol Havzası", x: 633, y: 215 },
  { id: "oil_texas", type: "OIL", name: "Teksas Petrol Havzası", x: 235, y: 218 },
  { id: "oil_caspian", type: "OIL", name: "Hazar Petrol Havzası", x: 639, y: 181 },
  { id: "oil_venezuela", type: "OIL", name: "Orinoco Petrol Havzası", x: 324, y: 286 },
  { id: "oil_northsea", type: "OIL", name: "Kuzey Avrupa Sanayisi", x: 504, y: 119 },
  { id: "oil_manchuria", type: "OIL", name: "Doğu Asya Sanayisi", x: 847, y: 158 },
];

const NUCLEAR_STRIKE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const NUCLEAR_STRIKE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const NUCLEAR_STRIKE_MAX_RADIUS = 22;

function normalizeNuclearStrike(rawStrike, now = Date.now()) {
  if (!rawStrike || typeof rawStrike !== 'object' || Array.isArray(rawStrike)) return null;
  const { id, x, y } = rawStrike;
  const fromX = rawStrike.fromX ?? x;
  const fromY = rawStrike.fromY ?? y;
  const radius = rawStrike.radius ?? NUCLEAR_STRIKE_MAX_RADIUS;
  const time = rawStrike.time;

  if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return null;
  if (!Number.isInteger(fromX) || !Number.isInteger(fromY) || fromX < 0 || fromX >= MAP_W || fromY < 0 || fromY >= MAP_H) return null;
  if (!Number.isInteger(radius) || radius < 1 || radius > NUCLEAR_STRIKE_MAX_RADIUS) return null;
  if (!Number.isFinite(time) || time <= 0 || now - time >= NUCLEAR_STRIKE_MAX_AGE_MS || time - now > NUCLEAR_STRIKE_MAX_FUTURE_SKEW_MS) return null;

  return { ...rawStrike, id, x, y, fromX, fromY, radius, time };
}

export class WorldSimulationEngine {
  constructor(worldData, callbacks = {}) {
    this.worldData = worldData;
    this.onEvent = callbacks.onEvent || (() => {});
    this.onSound = callbacks.onSound || (() => {});
    this.onChat = callbacks.onChat || (() => {});
    this.onUnderAttack = callbacks.onUnderAttack || (() => {});

    const total = MAP_W * MAP_H;
    this.owners = new Int16Array(total);
    for (let i = 0; i < total; i++) {
      this.owners[i] = worldData.isLand[i] ? 0 : -1;
    }
    this.isWasteland = new Uint8Array(total); // 1 = scorched radioactive wasteland (uninhabitable)
    this.nuclearStrikes = []; // History of nuclear strikes
    this.nuclearMissiles = []; // In-flight missile animations [{ fromX, fromY, toX, toY, progress, startTime, duration, strike }]
    this.activeExplosions = []; // Real-time rendering explosion animations [{ x, y, radius, startTime, duration }]

    this.countries = [];
    this.countryMap = new Map();
    this.ships = []; // Active naval expeditions sailing across water
    this.treaties = []; // Diplomatic treaties & tribute agreements (İttifak & Haraç)
    this.wars = [];
    this._radiationClearedAt = 0;
    this.onTreatyUpdate = null;
    this._lastTributeCheck = 0;
    this.chatMessages = [];
    this.undoStack = []; // 5-second undo stack for recent pixel conquests
    this.myDeviceId = getOrCreateDeviceId();
    this.myCountryId = null;

    this.dirtyPixels = true;
    this.dirtyRegions = true;

    // Initialize deterministic strategic nodes snapped strictly to valid land pixels
    this.strategicNodes = this._initStrategicNodes();

    // Load local country and world cache immediately so refreshing never flashes an empty world
    this._loadLocalWorldBackup();

    // Restore any persistent wasteland & nuclear strikes immediately so initial render is irradiated
    this._loadPersistedNuclearStrikes();

    // Keep constructors free of network/timer side effects. React StrictMode may
    // construct and discard render-time instances before a component is mounted.
    this.sync = null;
    this._syncUpdateCallback = () => {
      this.dirtyPixels = true;
      this.dirtyRegions = true;
    };
  }

  ensureSync() {
    if (this.sync && !this.sync.destroyed) return this.sync;
    this.sync = new SharedWorldSync(this, this._syncUpdateCallback);
    return this.sync;
  }

  _saveLocalWorldBackup() {
    // Disabled: all world state lives exclusively on the Firebase server
  }

  _loadLocalWorldBackup() {
    // Disabled: always load authoritative state from Firebase server
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(WORLD_SAVE_KEY);
      }
    } catch {}
  }

  _ensureCountryInventory(c) {
    if (!c) return;
    c.inventory = c.inventory || { nukes: 0, specialTroops: c.specialTroops || 0 };
  }

  _persistCountryInventory() {
    // Disabled: inventory is synced exclusively via Firebase server
  }

  _persistNuclearStrikes() {
    // Disabled: nuclear strikes are synced exclusively via Firebase server
  }

  _loadPersistedNuclearStrikes() {
    // Disabled: nuclear strikes come exclusively from Firebase server
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("sf_nuclear_strikes_v1");
      }
    } catch {}
  }

  restoreMyCountryFromServer(clientIp = null) {
    if (clientIp && clientIp !== "127.0.0.1" && clientIp !== "unknown") {
      this._cachedClientIp = clientIp;
    }
    const effectiveIp = clientIp || this._cachedClientIp || null;

    const storedId = getMyCountryId();
    if (storedId) {
      const parsed = parseInt(storedId, 10);
      if (this.countryMap.has(parsed)) {
        const c = this.countryMap.get(parsed);
        if (c && c.landCount > 0) {
          this.myCountryId = parsed;
          c.deviceId = this.myDeviceId;
          this._ensureCountryInventory(c);
          return;
        }
      }
    }
    const devCountry = this.countries.find(
      (c) => c.deviceId === this.myDeviceId && c.landCount > 0,
    );
    if (devCountry) {
      this.myCountryId = devCountry.id;
      saveMyCountryId(devCountry.id);
      this._ensureCountryInventory(devCountry);
      return;
    }
    // Auto-recovery via IP address (e.g. Instagram in-app browser -> Chrome switch)
    if (effectiveIp && effectiveIp !== "127.0.0.1" && effectiveIp !== "unknown") {
      const ipCountry = this.countries.find(
        (c) => c.creatorIp === effectiveIp && c.landCount > 0,
      );
      if (ipCountry) {
        this.myCountryId = ipCountry.id;
        ipCountry.deviceId = this.myDeviceId;
        saveMyCountryId(ipCountry.id);
        this._ensureCountryInventory(ipCountry);
        this.onEvent(
          `${ipCountry.name} devletinin yönetimi IP üzerinden otomatik bağlandı!`,
        );
      }
    }
  }

  // Check pending offline package without auto-adding, so player can claim it via an interactive reward chest!
  getPendingOfflinePackage() {
    const c = this.getMyCountry();
    if (!c || c.landCount <= 0) return null;

    const now = Date.now();
    const lastTime = c.lastActiveTime || c._lastStatsTime || c._lastSyncTime || now;

    const elapsedSec = Math.max(
      0,
      Math.min(3600 * 24 * 7, (now - lastTime) / 1000),
    );

    if (elapsedSec < 30) return null; // Ignore reloads under 30s

    this._recalculateDerivedStats(c);
    const availableCapacity = Math.max(0, c.capacity - c.troops);
    const troopsProduced = Math.min(
      availableCapacity,
      c.productionRate * 0.5 * elapsedSec,
    );
    const goldIncomePerSec = c.goldIncome || 0;
    const goldProduced = Math.max(0, Math.floor(goldIncomePerSec * 0.5 * elapsedSec));
    const popSpace = Math.max(0, c.maxPopulation - c.population);
    const popGrown = Math.min(popSpace, c.popGrowthRate * 0.5 * elapsedSec);

    if (troopsProduced < 0.5 && goldProduced < 5) return null;

    const elapsedMin = Math.floor(elapsedSec / 60);
    const timeStr =
      elapsedMin >= 60
        ? `${Math.floor(elapsedMin / 60)} saat ${elapsedMin % 60} dk`
        : `${elapsedMin} dakika`;

    return {
      countryId: c.id,
      troops: Math.floor(troopsProduced),
      gold: goldProduced,
      popGrown: Math.floor(popGrown),
      elapsedSec,
      timeStr,
    };
  }

  // Claim the pending offline package
  claimOfflinePackage(pkg) {
    if (!pkg) return false;
    const c = this.getMyCountry();
    if (!c || c.id !== pkg.countryId) return false;

    const now = Date.now();
    c.lastActiveTime = now;

    if (pkg.troops > 0) {
      c.troops = Math.min(c.capacity, Number((c.troops + pkg.troops).toFixed(1)));
    }
    if (pkg.gold > 0) {
      c.gold = (c.gold || 0) + pkg.gold;
    }
    if (pkg.popGrown > 0) {
      c.population = Math.min(c.maxPopulation, c.population + pkg.popGrown);
    }

    this.onSound("celebration");
    this.onEvent(
      `Çevrimdışı Paket Toplandı (${pkg.timeStr}): +${pkg.troops} Asker, +${pkg.gold} Altın hazinene eklendi!`,
    );

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
        lastActiveTime: now,
        lastHeartbeatTime: now,
        lastInputTime: this.lastInputTime || now,
      },
    });
    if (this.sync && this.sync.publishMyCountrySnapshot) {
      this.sync.publishMyCountrySnapshot();
    }

    this.saveState();
    return true;
  }

  // Daily Streak Check & Bonus (Server-backed on country object, never localStorage!)
  getDailyStreakInfo() {
    const c = this.getMyCountry();
    if (!c) return { streak: 0, isClaimedToday: true, bonusPercent: 0, bonusGold: 0 };

    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const lastClaimDay = c.lastDailyClaimDay || "";
    const isClaimedToday = lastClaimDay === today;
    let currentStreak = Number(c.dailyStreak) || 0;

    if (!isClaimedToday && lastClaimDay && lastClaimDay !== yesterdayDate) {
      currentStreak = 0;
    }

    const nextStreak = isClaimedToday ? currentStreak : currentStreak + 1;
    const bonusPercent = Math.min(25, Math.max(3, currentStreak * 3));

    return {
      streak: currentStreak,
      nextStreak,
      isClaimedToday,
      bonusPercent,
      bonusGold: Math.min(2500, 200 + currentStreak * 150),
    };
  }

  claimDailyStreak() {
    const c = this.getMyCountry();
    if (!c) return null;

    const info = this.getDailyStreakInfo();
    if (info.isClaimedToday) return null;

    const today = new Date().toISOString().slice(0, 10);
    const updatedStreak = info.nextStreak;

    c.dailyStreak = updatedStreak;
    c.lastDailyClaimDay = today;

    const goldBonus = info.bonusGold;
    c.gold = (c.gold || 0) + goldBonus;
    c._rewardGoldPool = (c._rewardGoldPool || 0) + goldBonus;

    this.onSound("celebration");
    this.onEvent(`🔥 ${updatedStreak}. Gün Giriş Serisi! (+${goldBonus} Altın ve +%${info.bonusPercent} Günlük Verim)`);

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
        dailyStreak: c.dailyStreak,
        lastDailyClaimDay: c.lastDailyClaimDay,
      },
    });
    if (this.sync && this.sync.publishMyCountrySnapshot) {
      this.sync.publishMyCountrySnapshot();
    }

    this.saveState();
    return {
      streak: updatedStreak,
      gold: goldBonus,
      bonusPercent: info.bonusPercent,
    };
  }

  loadChatMessages() {}

  saveChatMessages() {}

  handleRemoteChatMessage(chat) {
    if (!chat || !chat.id) return;
    if (this.chatMessages.some((m) => m.id === chat.id)) return;
    this.chatMessages.push(chat);
    if (this.chatMessages.length > 50) {
      this.chatMessages.shift();
    }
    this.onChat(this.chatMessages);
  }

  cleanupInactiveCountries() {
    const total = MAP_W * MAP_H;
    const activeIds = new Set();
    for (let i = 0; i < total; i++) {
      const o = this.owners[i];
      if (o > 0) activeIds.add(o);
    }
    const seenIds = new Set();
    const cleanList = [];
    for (const c of this.countries) {
      if (activeIds.has(c.id) && !seenIds.has(c.id)) {
        seenIds.add(c.id);
        cleanList.push(c);
      }
    }
    const beforeCount = this.countries.length;
    this.countries = cleanList;
    this.countryMap.clear();
    for (const c of this.countries) {
      this.countryMap.set(c.id, c);
    }
    if (this.countries.length !== beforeCount) {
      this.dirtyPixels = true;
      this.dirtyRegions = true;
    }
  }

  getMyCountry() {
    if (!this.myCountryId) {
      const storedId = getMyCountryId();
      if (storedId) {
        this.myCountryId = parseInt(storedId, 10);
      } else {
        const devCountry = this.countries.find(
          (c) => c.deviceId === this.myDeviceId,
        );
        if (devCountry) {
          this.myCountryId = devCountry.id;
          saveMyCountryId(devCountry.id);
        }
      }
    }
    const country = this.countryMap.get(this.myCountryId) || null;
    if (country && typeof localStorage !== 'undefined') {
      const localFlag = localStorage.getItem('sf_my_country_flag');
      if (localFlag && (country.flagDataUrl !== localFlag || !country.flagRgba)) {
        country.flagDataUrl = localFlag;
        loadDataUrlToFlagBuffer(localFlag)
          .then((decoded) => {
            country.flagRgba = decoded.rgba;
            this.dirtyPixels = true;
          })
          .catch(() => {});
      }
    }
    return country;
  }

  // Cleanly abandon current country so the player can found a new one without auto-reattaching
  abandonMyCountry() {
    const c = this.getMyCountry();
    if (c) {
      c.deviceId = null;
      this.sync.broadcast({
        type: "SYNC_COUNTRY_STATS",
        countryId: c.id,
        stats: {
          troops: Number(c.troops.toFixed(1)),
          gold: Math.floor(c.gold),
          population: Math.floor(c.population),
          color: c.color,
          upgrades: c.upgrades,
        },
      });
    }
    this.myCountryId = null;
    try {
      localStorage.removeItem("sf_my_country_id");
    } catch {}
    this.saveState();
  }

  // Only allows linking if deviceId matches
  claimExistingCountry(countryId) {
    const c = this.countryMap.get(countryId);
    if (!c || c.landCount <= 0)
      return { ok: false, reason: "Devlet bulunamadı." };
    if (c.deviceId && c.deviceId !== this.myDeviceId) {
      return { ok: false, reason: "Bu devlet başka bir oyuncuya aittir!" };
    }
    this.myCountryId = c.id;
    c.deviceId = this.myDeviceId;
    saveMyCountryId(c.id);
    this.saveState();
    this.onEvent(`${c.name} devletinin yönetimi bu cihaza bağlandı!`);
    return { ok: true, country: c };
  }

  // Check if a land pixel (x, y) borders sea/ocean
  isCoastalPixel(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
    const isLand = this.worldData.isLand;
    const idx = y * MAP_W + x;
    if (!isLand[idx]) return false;
    return (
      (x > 0 && !isLand[idx - 1]) ||
      (x < MAP_W - 1 && !isLand[idx + 1]) ||
      (y > 0 && !isLand[idx - MAP_W]) ||
      (y < MAP_H - 1 && !isLand[idx + MAP_W])
    );
  }

  // Check if straight line between (x0, y0) and (x1, y1) crosses sea/water and minimal land
  hasWaterPath(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(4, Math.ceil(dist));
    let waterSamples = 0;
    const isLand = this.worldData.isLand;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = Math.round(x0 + (x1 - x0) * t);
      const sy = Math.round(y0 + (y1 - y0) * t);
      if (sx >= 0 && sx < MAP_W && sy >= 0 && sy < MAP_H) {
        if (!isLand[sy * MAP_W + sx]) {
          waterSamples++;
        }
      }
    }
    // Must traverse at least 45% water cells along the route
    return waterSamples >= Math.max(1, Math.floor((steps - 1) * 0.45));
  }

  // Find nearest owned coastal pixel (port) to launch a ship toward (targetX, targetY)
  findNearestOwnedPort(countryId, targetX, targetY) {
    if (this.dirtyRegions || !this.countryBounds) {
      this.computeCountryBounds();
    }
    const b = this.countryBounds?.get(countryId);
    if (!b || b.count === 0) return null;

    let bestPort = null;
    let bestDist = Infinity;

    for (let y = b.minY; y <= b.maxY; y++) {
      const row = y * MAP_W;
      for (let x = b.minX; x <= b.maxX; x++) {
        if (this.owners[row + x] === countryId && this.isCoastalPixel(x, y)) {
          const d = Math.hypot(targetX - x, targetY - y);
          if (d < bestDist) {
            bestDist = d;
            bestPort = { x, y, distance: d };
          }
        }
      }
    }
    return bestPort;
  }

  _normalizeCountry(c) {
    const sourceUpgrades = c.upgrades && typeof c.upgrades === 'object' && !Array.isArray(c.upgrades)
      ? c.upgrades : {};
    c.upgrades = { ...DEFAULT_UPGRADES };
    for (const key of Object.keys(DEFAULT_UPGRADES)) {
      const level = sourceUpgrades[key];
      c.upgrades[key] = Number.isFinite(level) ? Math.max(0, Math.min(25, Math.floor(level))) : 0;
    }

    c.landCount = Number.isFinite(c.landCount)
      ? Math.max(1, Math.min(MAP_W * MAP_H, Math.floor(c.landCount))) : 1;
    c.population = Number.isFinite(c.population)
      ? Math.max(10, Math.min(1_000_000_000_000, c.population)) : 10;
    c.gold = Number.isFinite(c.gold)
      ? Math.max(0, Math.min(1_000_000_000_000_000, c.gold)) : 0;
    c.troops = Number.isFinite(c.troops)
      ? Math.max(0, Math.min(1_000_000_000, c.troops)) : 1.0;

    c.name = typeof c.name === 'string' ? c.name.trim().slice(0, 40) || 'Adsız Devlet' : 'Adsız Devlet';
    c.color = typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#E11D48';
    c.capitalX = Number.isInteger(c.capitalX) && c.capitalX >= 0 && c.capitalX < MAP_W ? c.capitalX : Math.floor(MAP_W / 2);
    c.capitalY = Number.isInteger(c.capitalY) && c.capitalY >= 0 && c.capitalY < MAP_H ? c.capitalY : Math.floor(MAP_H / 2);

    const rawNukes = c.inventory && typeof c.inventory === 'object' ? c.inventory.nukes : 0;
    const rawSpecialTroops = c.inventory && typeof c.inventory === 'object' ? c.inventory.specialTroops : (c.specialTroops || 0);
    c.specialTroops = Number.isFinite(rawSpecialTroops) ? Math.max(0, Math.floor(rawSpecialTroops)) : 0;
    c.inventory = {
      nukes: Number.isFinite(rawNukes) ? Math.max(0, Math.min(100000, Math.floor(rawNukes))) : 0,
      specialTroops: c.specialTroops,
    };
    const validDoctrines = ["BALANCED", "MERCHANT", "WARLORD", "FORTRESS"];
    c.doctrine = validDoctrines.includes(c.doctrine) ? c.doctrine : "BALANCED";
    this._recalculateDerivedStats(c);
    return c;
  }

  _initStrategicNodes() {
    const nodes = [];
    for (const raw of RAW_STRATEGIC_NODES) {
      let bestX = raw.x;
      let bestY = raw.y;
      if (!this.worldData.isLand[bestY * MAP_W + bestX]) {
        // Spiral search up to radius 18 to snap to nearest valid land pixel
        let found = false;
        for (let r = 1; r <= 18 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              const nx = bestX + dx;
              const ny = bestY + dy;
              if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && this.worldData.isLand[ny * MAP_W + nx]) {
                bestX = nx;
                bestY = ny;
                found = true;
              }
            }
          }
        }
      }
      nodes.push({
        ...raw,
        x: bestX,
        y: bestY,
        idx: bestY * MAP_W + bestX,
      });
    }
    return nodes;
  }

  // Count how many strategic resources (GOLD, OIL, WONDER) a country currently controls
  getCountryStrategicCounts(countryId) {
    let gold = 0;
    let oil = 0;
    let wonder = 0;
    const controlled = [];
    if (!this.strategicNodes) return { gold, oil, wonder, controlled };
    for (const node of this.strategicNodes) {
      if (this.owners[node.idx] === countryId) {
        if (node.type === "GOLD") gold++;
        else if (node.type === "OIL") oil++;
        else if (node.type === "WONDER") wonder++;
        controlled.push(node);
      }
    }
    return { gold, oil, wonder, controlled };
  }

  setCountryDoctrine(countryId, doctrineKey) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    const def = DOCTRINE_DEFINITIONS.find((d) => d.key === doctrineKey);
    if (!def) return { ok: false, reason: "Geçersiz doktrin." };
    if (c.doctrine === doctrineKey) return { ok: false, reason: "Zaten bu doktrindesin." };

    const now = Date.now();
    const lastChange = c.lastDoctrineChange || 0;
    const cooldownMs = 12 * 60 * 60 * 1000; // 12 hours free change
    const isFree = lastChange === 0 || (now - lastChange) >= cooldownMs;
    const switchCost = isFree ? 0 : 1500;

    if (switchCost > 0 && c.gold < switchCost) {
      return { ok: false, reason: `Erken doktrin değişimi için ${switchCost.toLocaleString()} Altın gerekli!` };
    }

    if (switchCost > 0) c.gold -= switchCost;
    c.doctrine = doctrineKey;
    c.lastDoctrineChange = now;

    this._recalculateDerivedStats(c);
    if (c.troops > c.capacity) c.troops = c.capacity;
    this.saveState();
    this.onSound("celebration");
    this.onEvent(`${def.icon} Devlet Doktrini "${def.name}" olarak değiştirildi!`);

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      stats: {
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        troops: Number(c.troops.toFixed(1)),
        upgrades: c.upgrades,
        inventory: c.inventory,
        doctrine: c.doctrine,
      },
    });

    return { ok: true, doctrine: def, cost: switchCost };
  }

  _recalculateDerivedStats(c) {
    const up = c.upgrades || DEFAULT_UPGRADES;
    const doc = c.doctrine || "BALANCED";
    const strat = this.getCountryStrategicCounts(c.id);
    c.strategicCounts = { gold: strat.gold, oil: strat.oil, wonder: strat.wonder };

    // Strategic node multipliers (capped for healthy late-game balance)
    const stratGoldMult = 1 + Math.min(0.48, strat.gold * 0.12);
    const stratOilMult = 1 + Math.min(0.48, strat.oil * 0.12);
    const stratWonderBonus = Math.min(0.32, strat.wonder * 0.08);

    // Doctrine multipliers
    const docCapMult = doc === "MERCHANT" ? 0.88 : 1.0;
    const docGoldMult = doc === "MERCHANT" ? 1.35 : doc === "WARLORD" ? 0.85 : 1.0;
    const docPopMult = doc === "FORTRESS" ? 1.20 : 1.0;
    const docAttackBonus = doc === "WARLORD" ? 0.22 : doc === "FORTRESS" ? -0.10 : 0;
    const docDefenseBonus = doc === "FORTRESS" ? 0.28 : 0;

    // 1. Asker Kapasitesi = Toprak Sayısı * (1 + Lojistik * %8) * Doktrin
    c.capacity = Math.max(
      1,
      Math.floor(c.landCount * (1 + (up.logistics || 0) * 0.08) * docCapMult),
    );

    // 2. Asker Üretim Hızı (Logaritmik + Seferberlik + Petrol Havzaları)
    const baseRate = (1.0 + 0.85 * Math.log(Math.max(1, c.landCount))) / 30.0;
    c.productionRate = baseRate * (1 + (up.mobilization || 0) * 0.05) * stratOilMult;

    // 3. Otomatik Halk (Nüfus) & Vergi (Altın) Üretimi
    c.maxPopulation = Math.floor(
      c.landCount * 15 * (1 + (up.housing || 0) * 0.07),
    );
    const nowMs = Date.now();
    // Küçük devletlere ekstra büyüme desteği
    const smallCountryPopMult =
      c.landCount < 40 ? 1.6 : c.landCount < 120 ? 1.3 : c.landCount < 300 ? 1.15 : 1.0;
    // Hızlı büyüyen (son 60 saniyede fetih yapan) devletlere büyüme ivmesi (+%100'e kadar)
    let rapidGrowthMult = 1.0;
    if (Array.isArray(c._recentConquestTimes) && c._recentConquestTimes.length > 0) {
      const cutoff = nowMs - 60000;
      c._recentConquestTimes = c._recentConquestTimes.filter((t) => t >= cutoff);
      rapidGrowthMult = 1 + Math.min(1.0, c._recentConquestTimes.length * 0.05);
    }
    // Market: Halka Nüfus Desteği (+%50 nüfus artış hızı)
    const hasPopBoost = Boolean(c.popBoostUntil && c.popBoostUntil > nowMs);
    c.popBoostActive = hasPopBoost;
    const popSupportMult = hasPopBoost ? 1.5 : 1.0;

    c.popGrowthRate =
      (1.0 + 0.25 * Math.log(c.landCount + 1)) *
      smallCountryPopMult *
      rapidGrowthMult *
      (1 + (up.housing || 0) * 0.07) *
      docPopMult *
      popSupportMult;

    const popBonus = 1 + Math.min(0.25, (c.population || 15) / 3500);
    c.goldIncome =
      (0.04 + 0.08 * Math.log(c.landCount + 1)) *
      (1 + (up.economy || 0) * 0.05) *
      popBonus *
      stratGoldMult *
      docGoldMult;

    // 4. Saldırı & Savunma Gücü (Tüm topraklarda eşit savunma; Başkent ayrımı yoktur!)
    c.attackPower = Math.max(
      0.5,
      1.0 + (up.weapons || 0) * 0.06 + docAttackBonus + stratWonderBonus,
    );
    const underdogBonus =
      c.landCount < 40 ? 0.35 : c.landCount < 100 ? 0.15 : 0;

    // Yeni Devlet Barış Koruması (İlk 24 saat içinde yeni kurulan ülkelere +%40 geçici savunma kalkanı)
    let newPlayerShieldBonus = 0;
    if (c.createdAt) {
      const ageHours = (Date.now() - c.createdAt) / (1000 * 3600);
      if (ageHours < 24) {
        newPlayerShieldBonus = Math.max(0, 0.40 * (1 - ageHours / 24));
      }
    }

    c.defensePower =
      1.0 +
      (up.fortification || 0) * 0.06 +
      (up.citadel || 0) * 0.08 +
      underdogBonus +
      newPlayerShieldBonus +
      docDefenseBonus +
      stratWonderBonus;

    // 5. Donanma Menzili & Gemi Hızı
    c.navalRange = 38 + (up.navy || 0) * 14;
    c.shipSpeed = 11 * (1 + (up.navy || 0) * 0.1);
  }

  getCountryCenter(countryId) {
    if (this.dirtyRegions || !this.countryBounds) {
      this.computeCountryBounds();
    }
    const bounds = this.countryBounds;
    const b = bounds ? bounds.get(countryId) : null;
    if (
      b &&
      b.count > 0 &&
      Number.isFinite(b.sumX) &&
      Number.isFinite(b.sumY)
    ) {
      return {
        x: Math.round(b.sumX / b.count),
        y: Math.round(b.sumY / b.count),
      };
    }
    const c = this.countryMap.get(countryId);
    const cx = c && Number.isFinite(c.capitalX) ? c.capitalX : MAP_W / 2;
    const cy = c && Number.isFinite(c.capitalY) ? c.capitalY : MAP_H / 2;
    return { x: cx, y: cy };
  }

  setCountryColor(countryId, newColor) {
    const country = this.countryMap.get(countryId);
    if (!country || !newColor) return { ok: false };
    country.color = newColor;
    this.dirtyPixels = true;
    this.saveState();

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: country.id,
      stats: {
        color: country.color,
        gold: country.gold,
        population: country.population,
        troops: country.troops,
        upgrades: country.upgrades,
      },
    });
    return { ok: true };
  }

  // Real-time continuous simulation tick (Troops, Population, Gold & Naval Ships)
  update(deltaTimeSec) {
    if (deltaTimeSec <= 0 || deltaTimeSec > 1.0) deltaTimeSec = 0.05;

    for (const c of this.countries) {
      if (c.landCount <= 0) continue;

      this._recalculateDerivedStats(c);

      // Continuous troop production runs for both active and offline countries up to their capacity limit!
      if (c.troops < c.capacity) {
        const produced = Math.min(c.capacity - c.troops, c.productionRate * deltaTimeSec);
        c.troops += produced;
        if (c.id === this.myCountryId && produced > 0) {
          this._troopQuestBuffer = (this._troopQuestBuffer || 0) + produced;
          if (this._troopQuestBuffer >= 1) {
            const whole = Math.floor(this._troopQuestBuffer);
            this._troopQuestBuffer -= whole;
            this.progressQuest("TROOPS", whole);
          }
        }
      }

      if (c.population < c.maxPopulation) {
        c.population = Math.min(
          c.maxPopulation,
          c.population + c.popGrowthRate * deltaTimeSec,
        );
      }

      const isMyCountry = c.id === this.myCountryId;
      if (isMyCountry) {
        let goldIncomeDelta = c.goldIncome * deltaTimeSec;
        // Check active reparation debts where my country is the debtor
        const activeDebts = this.getActiveReparationDebts(c.id);
        if (activeDebts.length > 0 && goldIncomeDelta > 0) {
          for (const debtTreaty of activeDebts) {
            if (goldIncomeDelta <= 0) break;
            const payAmt = Math.min(goldIncomeDelta, debtTreaty.remainingDebt);
            debtTreaty.paidDebt = (debtTreaty.paidDebt || 0) + payAmt;
            debtTreaty.remainingDebt = Math.max(0, debtTreaty.remainingDebt - payAmt);
            goldIncomeDelta -= payAmt;

            this._pendingDebtTransfers = this._pendingDebtTransfers || {};
            this._pendingDebtTransfers[debtTreaty.id] =
              (this._pendingDebtTransfers[debtTreaty.id] || 0) + payAmt;
          }
        }
        // Debtor only receives leftover gold income (0 while debts remain active)
        c.gold += goldIncomeDelta;
        c.lastActiveTime = Date.now();
      }
    }

    // Process periodic Tribute payments every 60s
    this._processPeriodicTributes();

    // Process periodic Reparation debt payments
    this._processPeriodicReparations();

    // Update sailing ships across oceans/seas
    if (this.ships.length > 0) {
      const remainingShips = [];
      for (const ship of this.ships) {
        ship.progress +=
          (ship.speed * deltaTimeSec) / Math.max(1, ship.distance);
        ship.x =
          ship.fromX + (ship.toX - ship.fromX) * Math.min(1, ship.progress);
        ship.y =
          ship.fromY + (ship.toY - ship.fromY) * Math.min(1, ship.progress);

        if (ship.progress >= 1.0) {
          // Ship has arrived at target shore -> execute amphibious landing!
          this._completeNavalLanding(ship);
        } else {
          remainingShips.push(ship);
        }
      }
      this.ships = remainingShips;
    }
  }

  _completeNavalLanding(ship) {
    const country = this.countryMap.get(ship.countryId);
    if (!country || country.landCount <= 0) return;

    const idx = ship.toY * MAP_W + ship.toX;
    const prevOwner = this.owners[idx];
    if (prevOwner === ship.countryId) return;

    this.owners[idx] = ship.countryId;
    country.landCount++;
    country.population += 5;

    if (prevOwner > 0) {
      if (prevOwner !== ship.countryId) {
        const activeTreaty = this.getActiveTreatyBetween(ship.countryId, prevOwner);
        if (activeTreaty) {
          this.breakTreaty(activeTreaty.id, ship.countryId, "SALDIRI (ÇIKARMA)");
        }
      }
      const prevCountry = this.countryMap.get(prevOwner);
      if (prevCountry) {
        prevCountry.landCount = Math.max(0, prevCountry.landCount - 1);
        this._recalculateDerivedStats(prevCountry);
        if (prevCountry.troops > prevCountry.capacity) {
          prevCountry.troops = prevCountry.capacity;
        }
      }
    }

    this._recalculateDerivedStats(country);
    this.dirtyPixels = true;
    this.dirtyRegions = true;

    if (ship.countryId === this.myCountryId) {
      this.progressQuest("CONQUER", 1);
      this.onSound("celebration");
      this.onEvent(
        `Donanman karşı kıyıya çıkarma yaptı! (${ship.toX}, ${ship.toY})`,
      );
      this.sync.broadcast({
        type: "CONQUER_PIXEL",
        countryId: ship.countryId,
        x: ship.toX,
        y: ship.toY,
        cost: 0,
        wasEnemy: prevOwner > 0,
      });
    }
    this._recordConquestMomentum(country, 1);

    this.scheduleSave();
  }

  buyUpgrade(countryId, upgradeKey) {
    const country = this.countryMap.get(countryId);
    if (!country) return { ok: false, reason: "Devlet bulunamadı." };

    const def = UPGRADE_DEFINITIONS.find((u) => u.key === upgradeKey);
    if (!def) return { ok: false, reason: "Geliştirme bulunamadı." };

    const currentLevel = country.upgrades?.[upgradeKey] || 0;
    if (currentLevel >= def.maxLevel) {
      return { ok: false, reason: "Maksimum seviyeye ulaşıldı!" };
    }

    const cost = Math.round(
      def.baseCost * Math.pow(def.costScale, currentLevel),
    );
    if (country.gold < cost) {
      return { ok: false, reason: `Yetersiz Altın! (${cost} Altın gerekli)` };
    }

    country.gold -= cost;
    country.upgrades[upgradeKey] = currentLevel + 1;
    if (country.id === this.myCountryId) {
      // Reward-earned gold cannot progress the GOLD spending quest (prevents infinite reward loops)
      const rewardDebt = country._rewardGoldPool || 0;
      const effectiveSpend = Math.max(0, cost - rewardDebt);
      country._rewardGoldPool = Math.max(0, rewardDebt - cost);
      if (effectiveSpend > 0) {
        this.progressQuest("GOLD", effectiveSpend);
      }
    }
    this._recalculateDerivedStats(country);
    this.onSound("celebration");
    this.onEvent(`${def.name} Seviye ${currentLevel + 1} oldu!`);
    this.saveState();

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: country.id,
      stats: {
        gold: country.gold,
        population: country.population,
        troops: country.troops,
        upgrades: country.upgrades,
      },
    });

    return { ok: true, level: currentLevel + 1, cost };
  }

  // Prestige / Rebirth system for max-level (Lv.25) upgrades: resets to Lv.1 with permanent +%2 star bonus
  prestigeUpgrade(countryId, upgradeKey) {
    const country = this.countryMap.get(countryId);
    if (!country) return { ok: false, reason: "Devlet bulunamadı." };

    const def = UPGRADE_DEFINITIONS.find((u) => u.key === upgradeKey);
    if (!def) return { ok: false, reason: "Geliştirme bulunamadı." };

    const currentLevel = country.upgrades?.[upgradeKey] || 0;
    if (currentLevel < def.maxLevel) {
      return { ok: false, reason: `Prestij için önce 25. Seviyeye ulaşmalısın! (Mevcut: Sv.${currentLevel})` };
    }

    const prestigeCost = 15000;
    if (country.gold < prestigeCost) {
      return { ok: false, reason: `Prestij için ${prestigeCost.toLocaleString()} Altın gereklidir!` };
    }

    country.gold -= prestigeCost;
    country.upgrades[upgradeKey] = 1;
    if (!country.prestigeStars) country.prestigeStars = {};
    country.prestigeStars[upgradeKey] = (country.prestigeStars[upgradeKey] || 0) + 1;

    this._recalculateDerivedStats(country);
    this.onSound("celebration");
    this.onEvent(`⭐ ${def.name} Prestij Yapıldı! (+1 Kalıcı Prestij Yıldızı kazandın)`);
    this.saveState();

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: country.id,
      stats: {
        gold: country.gold,
        population: country.population,
        troops: country.troops,
        upgrades: country.upgrades,
      },
    });

    return { ok: true, stars: country.prestigeStars[upgradeKey] };
  }

  // Rank / Title calculation based on landCount, age and army
  getCountryTitle(c) {
    if (!c || c.landCount <= 0) return { title: "Göçebe Topluluk", badge: "🏕️", minLand: 0 };
    const lands = c.landCount;
    if (lands >= 500) return { title: "Cihan İmparatoru", badge: "👑", minLand: 500 };
    if (lands >= 250) return { title: "Büyük Hakan", badge: "⚜️", minLand: 250 };
    if (lands >= 120) return { title: "Yüce Sultan", badge: "🌟", minLand: 120 };
    if (lands >= 60) return { title: "Krallık Hükümdarı", badge: "🏰", minLand: 60 };
    if (lands >= 30) return { title: "Sancak Beyi", badge: "🛡️", minLand: 30 };
    if (lands >= 10) return { title: "Derebeyi", badge: "⚔️", minLand: 10 };
    return { title: "Beylik", badge: "🚩", minLand: 1 };
  }

  // Balanced Dynamic Quests: Server-backed in-memory/country state (no browser localStorage cache!)
  getQuests() {
    const c = this.getMyCountry();
    if (!c) return [];

    if (Array.isArray(c.quests) && c.quests.length > 0) {
      return c.quests;
    }

    const lands = Math.max(1, c.landCount);
    const conquerTarget = Math.max(8, Math.round(Math.min(60, lands * 0.15)));
    const goldSpendTarget = Math.max(500, Math.round(Math.min(25000, lands * 40 + 400)));
    const troopTarget = Math.max(30, Math.round(c.capacity * 1.2) + 20);

    c.quests = [
      {
        id: "quest_conquer",
        title: `${conquerTarget} Yeni Piksel Fethet`,
        desc: "Sınırlarını genişleterek vatan toprağını büyüt.",
        type: "CONQUER",
        target: conquerTarget,
        current: 0,
        rewardGold: Math.round(conquerTarget * 25),
        rewardTroops: 0,
        completed: false,
      },
      {
        id: "quest_gold",
        title: `${goldSpendTarget.toLocaleString()} Altın Harca (Kendi Gelirin)`,
        desc: "Kendi ürettiğin altınla geliştirmeler yap (Ödül altınları sayılmaz).",
        type: "GOLD",
        target: goldSpendTarget,
        current: 0,
        rewardGold: Math.round(goldSpendTarget * 0.12),
        rewardTroops: 0,
        completed: false,
      },
      {
        id: "quest_army",
        title: `Toplam ${troopTarget} Asker Üret`,
        desc: "Kışlalarında asker üret (Harcasan bile ilerleme sıfırlanmaz).",
        type: "TROOPS",
        target: troopTarget,
        current: 0,
        rewardGold: Math.round(troopTarget * 4),
        rewardTroops: 0,
        completed: false,
      },
    ];

    return c.quests;
  }

  // Progress quest and grant reward
  progressQuest(type, amount = 1) {
    const c = this.getMyCountry();
    if (!c) return;
    const quests = this.getQuests();

    for (const q of quests) {
      if (q.type === type && !q.completed) {
        q.current = (q.current || 0) + amount;
        if (q.current >= q.target) {
          q.current = q.target;
          q.completed = true;
        }
      }
    }
  }

  // Claim completed quest reward and roll next tier quest
  claimQuestReward(questId) {
    const c = this.getMyCountry();
    if (!c) return null;
    const quests = this.getQuests();

    const idx = quests.findIndex((q) => q.id === questId && q.completed);
    if (idx === -1) return null;

    const quest = quests[idx];
    const rewardGold = quest.rewardGold || 0;

    c.gold = (c.gold || 0) + rewardGold;
    // Track reward gold separately so spending it doesn't feed back into GOLD quests
    c._rewardGoldPool = (c._rewardGoldPool || 0) + rewardGold;

    this.onSound("celebration");
    this.onEvent(`🏆 Görev Tamamlandı (${quest.title}): +${rewardGold.toLocaleString()} Altın kazandın!`);

    // Generate refreshed higher-tier replacement quest (Gold-only, balanced scaling)
    const lands = Math.max(1, c.landCount);
    if (quest.type === "CONQUER") {
      const nextTarget = Math.max(quest.target + 6, Math.round(lands * 0.18) + 6);
      quests[idx] = {
        ...quest,
        id: "quest_conquer_" + Date.now(),
        title: `${nextTarget} Yeni Piksel Fethet`,
        target: nextTarget,
        current: 0,
        rewardGold: Math.round(nextTarget * 25),
        rewardTroops: 0,
        completed: false,
      };
    } else if (quest.type === "GOLD") {
      const nextTarget = Math.round(quest.target * 1.5);
      quests[idx] = {
        ...quest,
        id: "quest_gold_" + Date.now(),
        title: `${nextTarget.toLocaleString()} Altın Harca (Kendi Gelirin)`,
        target: nextTarget,
        current: 0,
        rewardGold: Math.round(nextTarget * 0.12),
        rewardTroops: 0,
        completed: false,
      };
    } else {
      const nextTarget = Math.round(quest.target * 1.45) + 25;
      quests[idx] = {
        ...quest,
        id: "quest_army_" + Date.now(),
        title: `Toplam ${nextTarget} Asker Üret`,
        target: nextTarget,
        current: 0,
        rewardGold: Math.round(nextTarget * 4),
        rewardTroops: 0,
        completed: false,
      };
    }

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
        quests: c.quests,
        _rewardGoldPool: Math.floor(c._rewardGoldPool || 0),
      },
    });
    if (this.sync && this.sync.publishMyCountrySnapshot) {
      this.sync.publishMyCountrySnapshot();
    }

    this.saveState();
    return { rewardGold, rewardTroops: 0 };
  }

  // Special Mercenary Recruitment: Unlimited capacity, dedicated reserve pool!
  buyMercenaries(countryId, troopCount) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    this._recalculateDerivedStats(c);

    const count = Math.max(1, Math.floor(troopCount));
    const unitPrice = c.doctrine === "MERCHANT" ? 200 : 250;
    const cost = Math.round(count * unitPrice);
    if (c.gold < cost) {
      return { ok: false, reason: `Yetersiz altın! ${count} özel asker için ${cost.toLocaleString()} Altın gereklidir.` };
    }
    c.gold -= cost;
    c.specialTroops = (c.specialTroops || 0) + count;
    c.inventory = {
      ...(c.inventory || {}),
      specialTroops: c.specialTroops,
    };
    if (countryId === this.myCountryId) {
      const rewardDebt = c._rewardGoldPool || 0;
      const effectiveSpend = Math.max(0, cost - rewardDebt);
      c._rewardGoldPool = Math.max(0, rewardDebt - cost);
      if (effectiveSpend > 0) {
        this.progressQuest("GOLD", effectiveSpend);
      }
      this._persistCountryInventory(c);
    }

    this.dirtyPixels = true;
    this.saveState();
    this.onSound("celebration");
    this.onEvent(`${count} Özel Asker (Muhafız) kiralandı! (-${cost.toLocaleString()} Altın)`);

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      stats: {
        gold: Math.round(c.gold),
        population: Math.round(c.population),
        troops: Number(c.troops.toFixed(1)),
        upgrades: c.upgrades,
        inventory: c.inventory,
      },
    });

    return { ok: true, count, cost };
  }

  _recordConquestMomentum(country, count = 1) {
    if (!country || count <= 0) return;
    const now = Date.now();
    if (!Array.isArray(country._recentConquestTimes)) {
      country._recentConquestTimes = [];
    }
    const addCount = Math.min(25, Math.floor(count));
    for (let i = 0; i < addCount; i++) {
      country._recentConquestTimes.push(now);
    }
    const cutoff = now - 60000;
    if (country._recentConquestTimes.length > 40) {
      country._recentConquestTimes = country._recentConquestTimes
        .filter((t) => t >= cutoff)
        .slice(-30);
    }
  }

  // Market: Halka Nüfus Desteği Ver (+%50 Nüfus Artış Hızı)
  buyPopulationSupport(countryId, tierKey) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    const tier = POP_SUPPORT_TIERS.find((t) => t.key === tierKey);
    if (!tier) return { ok: false, reason: "Geçersiz destek paketi." };

    const cost = getPopSupportCost(c.population, tier.baseCost);
    if ((c.gold || 0) < cost) {
      return {
        ok: false,
        reason: `Yetersiz altın! ${tier.label} nüfus desteği için ${cost.toLocaleString()} Altın gereklidir.`,
      };
    }

    c.gold -= cost;
    const now = Date.now();
    c.popBoostUntil = Math.max(now, c.popBoostUntil || 0) + tier.durationMs;

    if (countryId === this.myCountryId) {
      const rewardDebt = c._rewardGoldPool || 0;
      const effectiveSpend = Math.max(0, cost - rewardDebt);
      c._rewardGoldPool = Math.max(0, rewardDebt - cost);
      if (effectiveSpend > 0) {
        this.progressQuest("GOLD", effectiveSpend);
      }
    }

    this._recalculateDerivedStats(c);
    this.saveState();
    this.onSound("celebration");
    this.onEvent(
      `👥 Halka Nüfus Desteği (${tier.label}) aktif edildi! Nüfus artış hızı +%50 arttı. (-${cost.toLocaleString()} Altın)`,
    );

    if (this.sync) {
      this.sync.broadcast({
        type: "SYNC_COUNTRY_STATS",
        countryId: c.id,
        stats: {
          gold: Math.round(c.gold || 0),
          population: Math.round(c.population || 0),
          troops: Number((c.troops || 0).toFixed(1)),
          upgrades: c.upgrades,
          popBoostUntil: c.popBoostUntil,
          _rewardGoldPool: Math.floor(c._rewardGoldPool || 0),
        },
      });
    }

    return { ok: true, tier, cost, popBoostUntil: c.popBoostUntil, country: c };
  }

  // Detect the richest country in the world for prestige title [En Zengin]
  getRichestCountry() {
    let best = null;
    let maxGold = -1;
    for (const c of this.countries) {
      if (c && c.landCount > 0 && c.gold > maxGold) {
        maxGold = c.gold;
        best = c;
      }
    }
    return best;
  }

  // Buy and Stockpile Nuclear Warhead: costs 65,000 Gold, safely stores in country inventory
  buyNuclear(countryId) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    const COST = 65000;
    if (c.gold < COST) {
      return {
        ok: false,
        reason: `Yetersiz altın! Taktik Nükleer Silah için ${COST.toLocaleString()} Altın gereklidir.`,
      };
    }
    c.gold -= COST;
    if (countryId === this.myCountryId) {
      const rewardDebt = c._rewardGoldPool || 0;
      const effectiveSpend = Math.max(0, COST - rewardDebt);
      c._rewardGoldPool = Math.max(0, rewardDebt - COST);
      if (effectiveSpend > 0) {
        this.progressQuest("GOLD", effectiveSpend);
      }
    }
    c.inventory = c.inventory || { nukes: 0 };
    c.inventory.nukes = (c.inventory.nukes || 0) + 1;
    this._persistCountryInventory(c);
    this.dirtyPixels = true;
    this.saveState();
    this.onSound("celebration");
    this.onEvent(
      `1 Adet Taktik Nükleer Başlık satın alındı ve depolandı! (Toplam Depoda: ${c.inventory.nukes} Adet)`,
    );

    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      stats: {
        gold: Math.round(c.gold),
        population: Math.round(c.population),
        troops: Number(c.troops.toFixed(1)),
        upgrades: c.upgrades,
        inventory: c.inventory,
      },
    });

    return { ok: true, nukes: c.inventory.nukes, cost: COST };
  }

  // Launch Stored Nuclear Strike: consumes 1 nuclear warhead from inventory
  launchNuclearStrike(countryId, targetX, targetY) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };

    c.inventory = c.inventory || { nukes: 0 };
    if (!c.inventory.nukes || c.inventory.nukes <= 0) {
      return {
        ok: false,
        reason:
          "Deponda hazır nükleer başlık yok! Önce Market'ten satın alıp depolamalısın.",
      };
    }

    c.inventory.nukes -= 1;
    this._persistCountryInventory(c);

    const fromX = c.capitalX != null ? c.capitalX : targetX;
    const fromY = c.capitalY != null ? c.capitalY : targetY;

    const strike = {
      id: "nuke_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      attackerId: countryId,
      attackerName: c.name,
      fromX,
      fromY,
      x: targetX,
      y: targetY,
      radius: 22,
      time: Date.now(),
    };

    // Trigger in-flight missile animation locally & remotely
    this.handleRemoteNuclearStrike(strike, true);

    // Save wasteland and strikes locally so refresh never wipes nuclear fallout
    this._persistNuclearStrikes();

    // Broadcast nuclear strike immediately to cloud and all tabs
    if (this.sync) {
      this.sync.broadcast({
        type: "NUCLEAR_STRIKE",
        strike,
      });

      this.sync.broadcast({
        type: "SYNC_COUNTRY_STATS",
        countryId: c.id,
        stats: {
          gold: Math.round(c.gold || 0),
          population: Math.round(c.population || 0),
          troops: Number((c.troops || 0).toFixed(1)),
          upgrades: c.upgrades,
          inventory: c.inventory,
        },
      });
    }

    // Immediately publish our country's updated inventory & territory
    if (this.sync && typeof this.sync.publishMyCountrySnapshot === "function") {
      setTimeout(() => {
        this.sync.publishMyCountrySnapshot();
      }, 500);
    }

    return { ok: true, strike, remainingNukes: c.inventory.nukes };
  }

  handleRemoteNuclearStrike(strike, isLocal = false, isHistoryReplay = false) {
    const safeStrike = normalizeNuclearStrike(strike);
    if (!safeStrike) return;
    strike = safeStrike;
    const { fromX, fromY, x, y } = strike;

    // If loading past history or refreshed page, apply wasteland directly without playing flight & explosion animations
    if (isHistoryReplay) {
      this._applyNuclearWastelandOnly(strike);
      return;
    }

    // 1. Launch in-flight missile animation from capital/origin to target
    const startX = fromX != null ? fromX : x;
    const startY = fromY != null ? fromY : y;
    const dist = Math.hypot(x - startX, y - startY);
    const flightDuration = Math.max(1400, Math.min(3200, dist * 25)); // Smooth parabolic missile flight

    this.nuclearMissiles.push({
      fromX: startX,
      fromY: startY,
      toX: x,
      toY: y,
      startTime: Date.now(),
      duration: flightDuration,
      strike,
      isLocal,
    });

    this.onSound("launch");

    // 2. Detonation occurs after missile arrives at target
    setTimeout(() => {
      this._detonateNuclearStrike(strike, isLocal);
    }, flightDuration);
  }

  _applyNuclearWastelandOnly(strike) {
    strike = normalizeNuclearStrike(strike);
    if (!strike) return;
    if (this._radiationClearedAt && strike.time <= this._radiationClearedAt) return;
    const { x, y, radius } = strike;

    if (!this.nuclearStrikes.some((s) => s.id === strike.id)) {
      this.nuclearStrikes.push(strike);
    }

    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      const cy = y + dy;
      if (cy < 0 || cy >= MAP_H) continue;
      const row = cy * MAP_W;
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = x + dx;
        if (cx < 0 || cx >= MAP_W) continue;
        if (dx * dx + dy * dy > r2) continue;
        const idx = row + cx;
        if (!this.worldData.isLand[idx]) continue;

        this.isWasteland[idx] = 1;
        const prevOwner = this.owners[idx];
        if (prevOwner > 0) {
          this.owners[idx] = 0;
          if (prevOwner !== strike.attackerId) {
            const activeTreaty = this.getActiveTreatyBetween(strike.attackerId, prevOwner);
            if (activeTreaty) {
              this.breakTreaty(activeTreaty.id, strike.attackerId, "NÜKLEER SALDIRI");
            }
          }
          const country = this.countryMap.get(prevOwner);
          if (country) {
            country.landCount = Math.max(0, country.landCount - 1);
            country.troops = Math.max(0, country.troops - 0.75);
          }
        }
      }
    }
  }

  _detonateNuclearStrike(strike, isLocal = false) {
    strike = normalizeNuclearStrike(strike);
    if (!strike) return;
    if (this._radiationClearedAt && strike.time <= this._radiationClearedAt) return;
    const { x, y, radius } = strike;

    // Prune expired strikes older than 24 hours.
    const now = Date.now();
    this.nuclearStrikes = this.nuclearStrikes.filter((s) => s.id !== strike.id && (now - s.time) < NUCLEAR_STRIKE_MAX_AGE_MS);
    this.nuclearStrikes.push(strike);

    this.activeExplosions.push({
      x,
      y,
      radius,
      startTime: Date.now(),
      duration: 4500, // Enhanced 4.5s mushroom cloud & expanding shockwave
    });

    const r2 = radius * radius;
    const affected = new Set();

    for (let dy = -radius; dy <= radius; dy++) {
      const cy = y + dy;
      if (cy < 0 || cy >= MAP_H) continue;
      const row = cy * MAP_W;
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = x + dx;
        if (cx < 0 || cx >= MAP_W) continue;
        if (dx * dx + dy * dy > r2) continue;
        const idx = row + cx;
        if (!this.worldData.isLand[idx]) continue;

        this.isWasteland[idx] = 1;
        const prevOwner = this.owners[idx];
        if (prevOwner > 0) {
          this.owners[idx] = 0;
          if (prevOwner !== strike.attackerId) {
            const activeTreaty = this.getActiveTreatyBetween(strike.attackerId, prevOwner);
            if (activeTreaty) {
              this.breakTreaty(activeTreaty.id, strike.attackerId, "NÜKLEER SALDIRI");
            }
          }
          const country = this.countryMap.get(prevOwner);
          if (country) {
            country.landCount = Math.max(0, country.landCount - 1);
            country.troops = Math.max(0, country.troops - 0.75);
            affected.add(country);
            if (prevOwner === this.myCountryId && !isLocal) {
              this.onUnderAttack({
                isNuke: true,
                x,
                y,
                attackerName: "Düşman Nükleeri",
                time: Date.now(),
              });
            }
          }
        }
      }
    }

    // Capital preservation: If capital was scorched, relocate to nearest owned pixel
    for (const country of affected) {
      const capIdx = country.capitalY * MAP_W + country.capitalX;
      if (this.isWasteland[capIdx] || this.owners[capIdx] !== country.id) {
        let found = false;
        for (let i = 0; i < MAP_W * MAP_H; i++) {
          if (this.owners[i] === country.id && !this.isWasteland[i]) {
            country.capitalX = i % MAP_W;
            country.capitalY = Math.floor(i / MAP_W);
            found = true;
            break;
          }
        }
        if (!found) {
          country.landCount = 0;
        }
      }
      this._recalculateDerivedStats(country);
    }

    this.dirtyPixels = true;
    this.dirtyRegions = true;
    this._persistNuclearStrikes();

    if (this.onEvent) {
      this.onEvent({
        type: "NUCLEAR_STRIKE",
        strike,
        isLocal,
      });
    }
    this.onSound("bomb_explosion");
  }

  // Transfer seller's border pixels adjacent to buyer (Land Purchase)
  transferBorderPixels({ buyerId, sellerId, count }) {
    const buyer = this.countryMap.get(buyerId);
    const seller = this.countryMap.get(sellerId);
    if (!buyer || !seller || count <= 0) return 0;

    const queue = [];
    const visited = new Set();

    for (let y = 0; y < MAP_H; y++) {
      const row = y * MAP_W;
      for (let x = 0; x < MAP_W; x++) {
        const idx = row + x;
        if (this.owners[idx] === sellerId && !this.isWasteland[idx]) {
          const touchesBuyer =
            (x > 0 && this.owners[idx - 1] === buyerId) ||
            (x < MAP_W - 1 && this.owners[idx + 1] === buyerId) ||
            (y > 0 && this.owners[idx - MAP_W] === buyerId) ||
            (y < MAP_H - 1 && this.owners[idx + MAP_W] === buyerId);
          if (touchesBuyer) {
            queue.push(idx);
            visited.add(idx);
          }
        }
      }
    }

    let transferred = 0;
    while (queue.length > 0 && transferred < count) {
      const idx = queue.shift();
      if (this.owners[idx] === sellerId && !this.isWasteland[idx]) {
        this.owners[idx] = buyerId;
        buyer.landCount++;
        seller.landCount = Math.max(0, seller.landCount - 1);
        transferred++;

        const cx = idx % MAP_W;
        const cy = Math.floor(idx / MAP_W);
        const neighbors = [
          cy > 0 ? idx - MAP_W : -1,
          cy < MAP_H - 1 ? idx + MAP_W : -1,
          cx > 0 ? idx - 1 : -1,
          cx < MAP_W - 1 ? idx + 1 : -1,
        ];
        for (const n of neighbors) {
          if (
            n >= 0 &&
            this.owners[n] === sellerId &&
            !this.isWasteland[n] &&
            !visited.has(n)
          ) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
    }

    // Capital preservation
    const selCapIdx = seller.capitalY * MAP_W + seller.capitalX;
    if (this.owners[selCapIdx] !== sellerId && seller.landCount > 0) {
      for (let i = 0; i < MAP_W * MAP_H; i++) {
        if (this.owners[i] === sellerId && !this.isWasteland[i]) {
          seller.capitalX = i % MAP_W;
          seller.capitalY = Math.floor(i / MAP_W);
          break;
        }
      }
    }

    this.dirtyPixels = true;
    this.dirtyRegions = true;
    return transferred;
  }

  // Automatically fill any internal holes/cavities inside the country's borders to ensure solid, gap-free territory
  autoFillInternalCavities(countryId) {
    const country = this.countryMap.get(countryId);
    if (!country || country.landCount < 6) return 0;

    const b = this.countryBounds ? this.countryBounds.get(countryId) : null;
    if (!b || b.count < 6) return 0;

    const minX = Math.max(0, b.minX - 1);
    const maxX = Math.min(MAP_W - 1, b.maxX + 1);
    const minY = Math.max(0, b.minY - 1);
    const maxY = Math.min(MAP_H - 1, b.maxY + 1);

    let filledCount = 0;
    // Iterate through bounding box to find gaps with 3 or 4 neighbors owned by countryId
    for (let py = minY; py <= maxY; py++) {
      const row = py * MAP_W;
      for (let px = minX; px <= maxX; px++) {
        const idx = row + px;
        // Only neutral unoccupied land can be auto-filled
        if (this.owners[idx] === 0 && this.worldData.isLand[idx]) {
          if (this.isWasteland && this.isWasteland[idx]) continue;

          const ownedNeighbors =
            (px > 0 && this.owners[idx - 1] === countryId ? 1 : 0) +
            (px < MAP_W - 1 && this.owners[idx + 1] === countryId ? 1 : 0) +
            (py > 0 && this.owners[idx - MAP_W] === countryId ? 1 : 0) +
            (py < MAP_H - 1 && this.owners[idx + MAP_W] === countryId ? 1 : 0);

          if (ownedNeighbors >= 3) {
            this.owners[idx] = countryId;
            country.landCount++;
            country.population += 3;
            this._expandCountryBound(countryId, px, py);
            filledCount++;

            this.sync.broadcast({
              type: "CONQUER_PIXEL",
              countryId,
              x: px,
              y: py,
              wasEnemy: false,
            });
          }
        }
      }
    }

    if (filledCount > 0) {
      this._recalculateDerivedStats(country);
      this.dirtyPixels = true;
    }

    return filledCount;
  }

  // Check if country has any internal holes/cavities inside its bounding box
  hasInternalCavities(countryId) {
    const b = this.countryBounds ? this.countryBounds.get(countryId) : null;
    if (!b || b.count < 8) return false;
    const minX = Math.max(0, b.minX);
    const maxX = Math.min(MAP_W - 1, b.maxX);
    const minY = Math.max(0, b.minY);
    const maxY = Math.min(MAP_H - 1, b.maxY);

    for (let py = minY; py <= maxY; py++) {
      const row = py * MAP_W;
      for (let px = minX; px <= maxX; px++) {
        const idx = row + px;
        if (this.owners[idx] === 0 && this.worldData.isLand[idx]) {
          const ownedNeighbors =
            (px > 0 && this.owners[idx - 1] === countryId ? 1 : 0) +
            (px < MAP_W - 1 && this.owners[idx + 1] === countryId ? 1 : 0) +
            (py > 0 && this.owners[idx - MAP_W] === countryId ? 1 : 0) +
            (py < MAP_H - 1 && this.owners[idx + MAP_W] === countryId ? 1 : 0);
          if (ownedNeighbors >= 3) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check if pixel (x, y) can be conquered by land OR by naval ship expedition
  canExpandToPixel(countryId, x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) {
      return { valid: false, reason: "Harita dışı." };
    }

    const idx = y * MAP_W + x;
    if (!this.worldData.isLand[idx]) {
      return { valid: false, reason: "Deniz veya okyanus fethedilemez." };
    }
    if (this.isWasteland && this.isWasteland[idx]) {
      return { valid: false, reason: "Bu bölge nükleer serpinti ve radyasyon nedeniyle yaşanamaz haldedir! " };
    }

    const currentOwner = this.owners[idx];
    if (currentOwner === countryId) {
      return { valid: false, reason: "Zaten senin toprağın." };
    }

    const attacker = this.countryMap.get(countryId);
    if (!attacker) return { valid: false, reason: "Devlet bulunamadı." };

    // 1. Check 4-way land adjacency
    const isAdjacent =
      (x > 0 && this.owners[idx - 1] === countryId) ||
      (x < MAP_W - 1 && this.owners[idx + 1] === countryId) ||
      (y > 0 && this.owners[idx - MAP_W] === countryId) ||
      (y < MAP_H - 1 && this.owners[idx + MAP_W] === countryId);

    const isEnemy = currentOwner > 0;
    let baseCost = 1.0;

    if (!isEnemy) {
      const siegeLevel = attacker.upgrades?.siege || 0;
      const warlordMult = attacker.doctrine === "WARLORD" ? 0.9 : 1.0;
      baseCost = Math.max(0.45, Number(((1.0 - siegeLevel * 0.02) * warlordMult).toFixed(2)));
    } else {
      // Check active diplomatic treaties (İttifak / Haraç)
      const activeTreaty = this.getActiveTreatyBetween(countryId, currentOwner);
      if (activeTreaty) {
        return {
          valid: false,
          isTreatyViolation: true,
          treaty: activeTreaty,
          targetOwner: currentOwner,
          reason: `Bu devletle aktif bir ${activeTreaty.type === "ALLIANCE" ? "İttifak" : "Haraç"} anlaşman var! Saldırmak anlaşmayı bozar ve ${activeTreaty.penalty} Altın ceza ödetir.`,
        };
      }

      const defender = this.countryMap.get(currentOwner);
      const defPower = defender ? defender.defensePower || 1.0 : 1.0;
      const atkPower = attacker.attackPower || 1.0;

      // Çevrimdışı Oyuncu Koruma Kalkanı:
      // Eğer hedef devlet son 150 saniyedir (2.5 dk) çevrimdışıysa fetih maliyeti 5 KAT artar!
      let offlineShieldMult = 1.0;
      if (defender && defender.id !== countryId) {
        const now = Date.now();
        const lastInput = defender.lastInputTime || 0;
        const lastHeartbeat = defender.lastHeartbeatTime || defender._lastStatsTime || defender._lastSyncTime || 0;
        const isOffline = (now - lastHeartbeat) >= 75000 && (now - lastInput) >= 150000;
        if (isOffline) {
          offlineShieldMult = 5.0;
        }
      }

      baseCost = Math.max(
        1.0,
        Number((((2.0 * defPower) / atkPower) * offlineShieldMult).toFixed(2)),
      );
    }

    if (isAdjacent) {
      if (this.isSnakingConquest(countryId, x, y)) {
        return {
          valid: false,
          reason:
            "Devletini yılan gibi tek piksel uzatamazsın! Sınırlarını kalınlaştırarak büyümelisin.",
        };
      }

      return {
        valid: true,
        isNaval: false,
        cost: baseCost,
        isEnemy,
        targetOwnerId: currentOwner,
      };
    }

    // 2. Not adjacent on land -> Check if reachable across water via Naval Ship Expedition!
    if (!this.isCoastalPixel(x, y)) {
      return {
        valid: false,
        reason:
          "Sadece sınırındaki komşu pikselleri veya deniz aşırı kıyı şeritlerini (gemiyle) fethedebilirsin.",
      };
    }

    const nearestPort = this.findNearestOwnedPort(countryId, x, y);
    if (!nearestPort) {
      return {
        valid: false,
        reason:
          "Deniz aşırı gemi göndermek için önce denize kıyısı olan bir toprağa sahip olmalısın!",
      };
    }

    const maxRange = attacker.navalRange || 38;
    if (nearestPort.distance > maxRange) {
      return {
        valid: false,
        reason: `Hedef kıyı donanma menzili dışında! (Mesafe: ${Math.round(nearestPort.distance)}, Menzil: ${maxRange} • Donanma geliştir)`,
      };
    }

    if (!this.hasWaterPath(nearestPort.x, nearestPort.y, x, y)) {
      return {
        valid: false,
        reason: "Gemi rotası deniz üzerinden geçmelidir.",
      };
    }

    const navalCost = Number((baseCost + 1.0).toFixed(2));

    return {
      valid: true,
      isNaval: true,
      portX: nearestPort.x,
      portY: nearestPort.y,
      distance: nearestPort.distance,
      cost: navalCost,
      isEnemy,
      targetOwnerId: currentOwner,
    };
  }

  // Prevent 1-pixel wide snaking across open land, while allowing natural solid expansion and naval beachheads to grow!
  isSnakingConquest(countryId, x, y) {
    const country = this.countryMap.get(countryId);
    if (!country || country.landCount < 6) return false;

    let ownedNeighbors = 0;
    let singleNeighbor = null;

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
        if (this.owners[ny * MAP_W + nx] === countryId) {
          ownedNeighbors++;
          singleNeighbor = { x: nx, y: ny };
        }
      }
    }

    // Touching 2 or more owned cardinal neighbors thickens or connects borders (never snaking)
    if (ownedNeighbors >= 2) return false;
    if (ownedNeighbors === 0 || !singleNeighbor) return false;

    // Check diagonal neighbors around (x, y) belonging to country
    let diagonalOwned = 0;
    const diagDirs = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    for (const [dx, dy] of diagDirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
        if (this.owners[ny * MAP_W + nx] === countryId) {
          diagonalOwned++;
        }
      }
    }

    // If (x, y) touches at least 1 diagonal owned pixel in addition to the cardinal neighbor,
    // it's forming a 2x2 corner or solid block, which is allowed!
    if (diagonalOwned >= 1) return false;

    // Zorunlu koridor / kıstak / sağı-solu deniz veya kendi toprağımız kontrolü:
    // Eğer bir hatta ilerlemek zorundaysa (yan taraflar deniz ya da zaten kendi toprağıysa), çizgi engeli ASLA kilit oluşturmamalıdır!
    const isWaterOrMine = (px, py) => {
      if (px < 0 || px >= MAP_W || py < 0 || py >= MAP_H) return true;
      const idx = py * MAP_W + px;
      if (!this.worldData.isLand[idx]) return true; // Deniz/su
      if (this.owners[idx] === countryId) return true; // Zaten kendi toprağımız
      return false;
    };

    const stepX = x - singleNeighbor.x;
    const stepY = y - singleNeighbor.y;
    const side1X = -stepY;
    const side1Y = stepX;
    const side2X = stepY;
    const side2Y = -stepX;

    // 1. Hedef pikselin sağı ve solu deniz veya kendi toprağımızsa -> zorunlu dar geçit, engelleme!
    if (
      isWaterOrMine(x + side1X, y + side1Y) &&
      isWaterOrMine(x + side2X, y + side2Y)
    ) {
      return false;
    }

    // 2. Komşunun sağı ve solu deniz veya kendi toprağımızsa -> koridordan çıkış / ilerleme, engelleme!
    if (
      isWaterOrMine(singleNeighbor.x + side1X, singleNeighbor.y + side1Y) &&
      isWaterOrMine(singleNeighbor.x + side2X, singleNeighbor.y + side2Y)
    ) {
      return false;
    }

    // 3. Bölgesel coğrafi darlık kontrolü: singleNeighbor çevresinde 3x3 alanda toplam kaç kara hücresi var?
    let totalLandIn3x3 = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = singleNeighbor.x + dx;
        const py = singleNeighbor.y + dy;
        if (px >= 0 && px < MAP_W && py >= 0 && py < MAP_H) {
          if (this.worldData.isLand[py * MAP_W + px]) {
            totalLandIn3x3++;
          }
        }
      }
    }
    // Eğer etrafta zaten toplam 4 veya daha az kara varsa (ince burun, yarımada veya kıstak), çizgi engeli uygulanamaz!
    if (totalLandIn3x3 <= 4) {
      return false;
    }

    // (x, y) touches ONLY 1 single neighbor in its entire 3x3 neighborhood!
    // Check if that single neighbor itself is an isolated beachhead (< 6 connected pixels)
    const startIdx = singleNeighbor.y * MAP_W + singleNeighbor.x;
    const visited = new Set([startIdx]);
    const queue = [startIdx];
    let head = 0;
    while (head < queue.length && visited.size < 6) {
      const cur = queue[head++];
      const cx = cur % MAP_W;
      const cy = (cur / MAP_W) | 0;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
          const nIdx = ny * MAP_W + nx;
          if (this.owners[nIdx] === countryId && !visited.has(nIdx)) {
            visited.add(nIdx);
            queue.push(nIdx);
          }
        }
      }
    }
    // If the entire connected island/beachhead has < 6 pixels, allow it to establish a foothold
    if (visited.size < 6) {
      return false;
    }

    // Check singleNeighbor's cardinal neighbors:
    let neighborCardinalOwned = 0;
    for (const [dx, dy] of dirs) {
      const nx = singleNeighbor.x + dx;
      const ny = singleNeighbor.y + dy;
      if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
        if (this.owners[ny * MAP_W + nx] === countryId) {
          neighborCardinalOwned++;
        }
      }
    }

    // If singleNeighbor has <= 1 cardinal owned neighbor, singleNeighbor is already a 1-pixel tip!
    // Adding (x, y) to it would extend a 1-pixel snake line into the void. Block it!
    if (neighborCardinalOwned <= 1) {
      return true;
    }

    // Also check singleNeighbor's 3x3 support:
    let neighbor3x3Support = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const px = singleNeighbor.x + dx;
        const py = singleNeighbor.y + dy;
        if (px >= 0 && px < MAP_W && py >= 0 && py < MAP_H) {
          if (this.owners[py * MAP_W + px] === countryId) {
            neighbor3x3Support++;
          }
        }
      }
    }

    // In solid land, a valid border neighbor should have at least 3 owned pixels supporting it
    return neighbor3x3Support <= 2;
  }

  // Helper to consume troops with Normal > Special priority (Auto-conquer only uses normal troops!)
  _deductTroops(country, amount, allowSpecial = true) {
    if (amount <= 0) return true;
    const normal = country.troops || 0;
    const special = allowSpecial ? (country.specialTroops || 0) : 0;
    if (normal + special < amount) return false;

    if (normal >= amount) {
      country.troops = Number((normal - amount).toFixed(2));
    } else {
      const remainder = amount - normal;
      country.troops = 0;
      country.specialTroops = Math.max(0, Math.floor(special - remainder));
      country.inventory = {
        ...(country.inventory || {}),
        specialTroops: country.specialTroops,
      };
      if (country.id === this.myCountryId) {
        this._persistCountryInventory(country);
      }
    }
    return true;
  }

  // Conquer single pixel (instant on adjacent land, or dispatches a sailing Ship across the sea!)
  conquerPixel(countryId, x, y, isAutoConquer = false) {
    const country = this.countryMap.get(countryId);
    if (!country) return { ok: false, reason: "Devlet bulunamadı." };

    // Oto-fethet kesinlikle başka ülkelerin topraklarına saldıramaz; sadece sahipsiz (tarafsız) toprakları fetheder!
    if (isAutoConquer && x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
      const targetOwner = this.owners[y * MAP_W + x];
      if (targetOwner > 0 && targetOwner !== countryId) {
        return { ok: false, reason: "Oto-fethet başka ülkelerin topraklarını fethedemez." };
      }
    }

    const check = this.canExpandToPixel(countryId, x, y);
    if (!check.valid) return { ok: false, reason: check.reason };

    const allowSpecial = !isAutoConquer;
    const availableTroops = (country.troops || 0) + (allowSpecial ? (country.specialTroops || 0) : 0);

    if (availableTroops < check.cost) {
      return {
        ok: false,
        reason: isAutoConquer
          ? `Oto-fethet için yetersiz normal asker! (${check.cost} gerekli)`
          : `Yetersiz asker! (${check.cost} asker gerekli, toplamda ${availableTroops.toFixed(1)} var)`,
      };
    }

    // Naval Ship Expedition across sea/ocean
    if (check.isNaval) {
      // Prevent duplicate ship to same target pixel
      const alreadySailing = this.ships.some(
        (s) => s.countryId === countryId && s.toX === x && s.toY === y,
      );
      if (alreadySailing) {
        return {
          ok: false,
          reason: "Bu kıyıya zaten bir çıkarma gemisi ilerliyor!",
        };
      }

      this._deductTroops(country, check.cost, allowSpecial);
      const ship = {
        id: "ship_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        countryId,
        color: country.color || "#38BDF8",
        fromX: check.portX,
        fromY: check.portY,
        toX: x,
        toY: y,
        x: check.portX,
        y: check.portY,
        distance: check.distance,
        speed: country.shipSpeed || 11,
        progress: 0,
      };
      this.ships.push(ship);
      this.onSound("pencil");
      this.onEvent(`Çıkarma gemisi denize açıldı! Hedef kıyıya ilerliyor...`);

      this.sync.broadcast({
        type: "LAUNCH_SHIP",
        ship,
      });

      this.saveState();
      return { ok: true, isNaval: true, ship, country };
    }

    // Adjacent Land Conquest
    const idx = y * MAP_W + x;
    const prevOwner = this.owners[idx];

    // Check if this move encloses any neutral cavity pockets
    const enclosed = this.findEnclosedCavitiesForMove(countryId, x, y);
    const siegeLevel = country.upgrades?.siege || 0;
    const costPerCavityPixel = Math.max(
      0.5,
      Number((1.0 - siegeLevel * 0.02).toFixed(2)),
    );

    // Deduct cost for the clicked border pixel (Priority: Normal > Special)
    this._deductTroops(country, check.cost, allowSpecial);
    this.owners[idx] = countryId;
    country.landCount++;
    country.population += 5;

    if (prevOwner > 0) {
      if (prevOwner !== countryId) {
        const activeTreaty = this.getActiveTreatyBetween(countryId, prevOwner);
        if (activeTreaty) {
          this.breakTreaty(activeTreaty.id, countryId, "SALDIRI");
        }
      }
      const prevCountry = this.countryMap.get(prevOwner);
      if (prevCountry) {
        prevCountry.landCount = Math.max(0, prevCountry.landCount - 1);
        this._recalculateDerivedStats(prevCountry);
        if (prevCountry.troops > prevCountry.capacity) {
          prevCountry.troops = prevCountry.capacity;
        }
        this.dirtyRegions = true;
      }
    }
    this._expandCountryBound(countryId, x, y);

    const filledCavities = [];
    for (const cIdx of enclosed) {
      const currentAvail = (country.troops || 0) + (allowSpecial ? (country.specialTroops || 0) : 0);
      if (currentAvail >= costPerCavityPixel) {
        this._deductTroops(country, costPerCavityPixel, allowSpecial);
        this.owners[cIdx] = countryId;
        const px = cIdx % MAP_W;
        const py = (cIdx / MAP_W) | 0;
        this._expandCountryBound(countryId, px, py);
        filledCavities.push({ x: px, y: py });
        country.landCount++;
        country.population += 3;

        this.sync.broadcast({
          type: "CONQUER_PIXEL",
          countryId,
          x: px,
          y: py,
          wasEnemy: false,
        });
      }
    }

    // Record for 5-Second Undo ONLY for neutral (unowned) land pixels — never enemy combat conquests!
    if (countryId === this.myCountryId && prevOwner === 0) {
      this.undoStack.push({
        countryId,
        x,
        y,
        prevOwner: 0,
        cost: check.cost,
        cavities: filledCavities,
        time: Date.now(),
      });
      const cutoff = Date.now() - 5000;
      this.undoStack = this.undoStack.filter((u) => u.time >= cutoff);
    }

    this._recordConquestMomentum(country, 1 + filledCavities.length);
    this._recalculateDerivedStats(country);

    this.dirtyPixels = true;
    this.onSound("pencil");

    if (countryId === this.myCountryId) {
      this.progressQuest("CONQUER", 1 + filledCavities.length);
    }

    if (filledCavities.length > 0) {
      this.onEvent(
        `Çevrelenen ${filledCavities.length} iç piksel ${cavityTotalCost.toFixed(1)} asker harcanarak fethedildi!`,
      );
    }

    this.sync.broadcast({
      type: "CONQUER_PIXEL",
      countryId,
      x,
      y,
      cost: check.cost,
      wasEnemy: prevOwner > 0,
    });

    // Automatically seal any remaining tiny cavities so borders stay completely solid
    this.autoFillInternalCavities(countryId);

    this.scheduleSave();
    return { ok: true, isNaval: false, country };
  }

  // Detects any neutral land pockets that would become completely enclosed if (targetX, targetY) were conquered
  findEnclosedCavitiesForMove(countryId, targetX, targetY) {
    const origOwner = this.owners[targetY * MAP_W + targetX];
    this.owners[targetY * MAP_W + targetX] = countryId;

    const candidates = [];
    const immediateDirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dx, dy] of immediateDirs) {
      const nx = targetX + dx;
      const ny = targetY + dy;
      if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
        const idx = ny * MAP_W + nx;
        if (this.owners[idx] === 0 && this.worldData.isLand[idx]) {
          candidates.push(idx);
        }
      }
    }

    const enclosedPixels = [];
    const visitedGlobal = new Set();

    for (const startIdx of candidates) {
      if (visitedGlobal.has(startIdx) || this.owners[startIdx] !== 0) continue;

      const queue = [startIdx];
      const component = [startIdx];
      visitedGlobal.add(startIdx);
      let isEnclosed = true;

      let qHead = 0;
      while (qHead < queue.length) {
        const cur = queue[qHead++];
        const cx = cur % MAP_W;
        const cy = (cur / MAP_W) | 0;

        const dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        for (const [ddx, ddy] of dirs) {
          const adjX = cx + ddx;
          const adjY = cy + ddy;
          if (adjX < 0 || adjX >= MAP_W || adjY < 0 || adjY >= MAP_H) {
            isEnclosed = false;
            break;
          }
          const adjIdx = adjY * MAP_W + adjX;
          if (!this.worldData.isLand[adjIdx]) {
            // Water/ocean is NOT an enclosed interior hole (prevents filling entire peninsulas/islands!)
            isEnclosed = false;
            break;
          }
          const o = this.owners[adjIdx];
          if (o === countryId) {
            continue;
          }
          if (o !== 0) {
            isEnclosed = false;
            break;
          }
          if (!visitedGlobal.has(adjIdx)) {
            visitedGlobal.add(adjIdx);
            component.push(adjIdx);
            queue.push(adjIdx);
            if (component.length > 8) {
              isEnclosed = false;
              break;
            }
          }
        }
        if (!isEnclosed) break;
      }

      if (isEnclosed && component.length <= 150) {
        for (const idx of component) {
          enclosedPixels.push(idx);
        }
      }
    }

    // Restore simulated tile
    this.owners[targetY * MAP_W + targetX] = origOwner;

    return enclosedPixels;
  }

  // 5-Second Undo for mistakenly conquered pixels
  undoLastConquest() {
    const cutoff = Date.now() - 5000;
    this.undoStack = (this.undoStack || []).filter((u) => u.time >= cutoff);
    if (this.undoStack.length === 0) {
      return {
        ok: false,
        reason: "Geri alınabilecek son 5 saniye içinde fethedilmiş piksel yok.",
      };
    }

    const item = this.undoStack.pop();
    const country = this.countryMap.get(item.countryId);
    if (!country) return { ok: false, reason: "Devlet bulunamadı." };

    const idx = item.y * MAP_W + item.x;
    if (this.owners[idx] !== item.countryId) {
      return { ok: false, reason: "Bu piksel zaten başka bir işlem gördü." };
    }

    this.owners[idx] = item.prevOwner;
    let removedCount = 1;

    // Also revert any enclosed cavity pixels that were auto-filled by this conquest
    if (Array.isArray(item.cavities) && item.cavities.length > 0) {
      for (const cav of item.cavities) {
        const cIdx = cav.y * MAP_W + cav.x;
        if (this.owners[cIdx] === item.countryId) {
          this.owners[cIdx] = 0;
          removedCount++;
          this.sync.broadcast({
            type: "UNDO_PIXEL",
            countryId: item.countryId,
            x: cav.x,
            y: cav.y,
            prevOwner: 0,
            cost: 0,
          });
        }
      }
    }

    country.landCount = Math.max(1, country.landCount - removedCount);
    country.population = Math.max(
      15,
      country.population - 5 - (removedCount - 1) * 3,
    );
    this._recalculateDerivedStats(country);
    country.troops = Math.min(
      country.capacity,
      Number((country.troops + item.cost).toFixed(1)),
    );

    if (item.prevOwner > 0) {
      return { ok: false, reason: "Düşman toprağı fethi geri alınamaz!" };
    }

    // Deduct reverted pixels from CONQUER quest progress so undo cannot farm quests
    if (item.countryId === this.myCountryId && removedCount > 0) {
      const quests = this.getQuests();
      for (const q of quests) {
        if (q.type === "CONQUER") {
          q.current = Math.max(0, (q.current || 0) - removedCount);
          if (q.current < q.target) {
            q.completed = false;
          }
        }
      }
    }

    this.computeCountryBounds();
    this.dirtyPixels = true;
    this.dirtyRegions = false;
    this.saveState();

    this.sync.broadcast({
      type: "UNDO_PIXEL",
      countryId: item.countryId,
      x: item.x,
      y: item.y,
      prevOwner: item.prevOwner,
      cost: item.cost,
    });
    this.sync.publishMyCountrySnapshot();

    this.onEvent("Son fethedilen piksel geri alındı ve askerin iade edildi!");
    return {
      ok: true,
      x: item.x,
      y: item.y,
      remainingUndos: this.undoStack.length,
    };
  }

  handleRemoteUndoPixel(countryId, x, y, prevOwner, batchMode = false) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return;
    if (!Number.isInteger(countryId) || !Number.isInteger(prevOwner) || prevOwner < 0) return;
    const c = this.countryMap.get(countryId);
    if (!c) return;
    const idx = y * MAP_W + x;
    // Ignore duplicate, stale, ocean, and post-strike undo packets. They must not
    // change ownership or decrement territory counters a second time.
    if (!this.worldData.isLand[idx] || this.isWasteland[idx] || this.owners[idx] !== countryId) return;
    const restoredOwner = prevOwner > 0 && this.countryMap.has(prevOwner) ? prevOwner : 0;
    this.owners[idx] = restoredOwner;
    c.landCount = Math.max(0, c.landCount - 1);
    this._recalculateDerivedStats(c);
    if (restoredOwner > 0) {
      const pc = this.countryMap.get(restoredOwner);
      pc.landCount++;
      this._recalculateDerivedStats(pc);
    }
    if (!batchMode) {
      this.computeCountryBounds();
      this.dirtyPixels = true;
      this.dirtyRegions = false;
    }
  }

  // O(1) incremental bounding box expansion when conquering a pixel
  _expandCountryBound(countryId, x, y) {
    if (!this.countryBounds) {
      this.computeCountryBounds();
      return;
    }
    let b = this.countryBounds.get(countryId);
    if (!b) {
      b = { minX: x, maxX: x, minY: y, maxY: y, count: 1, sumX: x, sumY: y };
      this.countryBounds.set(countryId, b);
      return;
    }
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
    b.count++;
    b.sumX += x;
    b.sumY += y;
  }

  // Smart Mobile Touch-Snap: If finger touches within radius of a valid border pixel, snap to nearest valid border pixel!
  findSmartExpandTarget(countryId, tapX, tapY, radius = 4) {
    const exact = this.canExpandToPixel(countryId, tapX, tapY);
    if (exact.valid || exact.isTreatyViolation) {
      return { x: tapX, y: tapY, check: exact };
    }

    let best = null;
    let bestDist = Infinity;

    for (let dy = -radius; dy <= radius; dy++) {
      const ny = tapY + dy;
      if (ny < 0 || ny >= MAP_H) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = tapX + dx;
        if (nx < 0 || nx >= MAP_W) continue;
        const d = dx * dx + dy * dy;
        if (d >= bestDist) continue;
        const chk = this.canExpandToPixel(countryId, nx, ny);
        if (chk.valid && !chk.isNaval) {
          bestDist = d;
          best = { x: nx, y: ny, check: chk };
        }
      }
    }
    return best;
  }

  // One-Tap Mobile Quick Expand: Automatically conquers the closest available adjacent border pixel!
  // If onlyNeutral is true (default), strictly targets unoccupied neutral territory (owners[idx] === 0) and NEVER attacks other nations.
  conquerNextBorderPixel(countryId, onlyNeutral = true) {
    const country = this.countryMap.get(countryId);
    if (!country) return { ok: false, reason: "Devlet bulunamadı." };

    if (this.dirtyRegions || !this.countryBounds) {
      this.computeCountryBounds();
    }
    const b = this.countryBounds.get(countryId);
    if (!b || b.count === 0) return { ok: false, reason: "Toprak bulunamadı." };

    const minX = Math.max(0, b.minX - 1);
    const maxX = Math.min(MAP_W - 1, b.maxX + 1);
    const minY = Math.max(0, b.minY - 1);
    const maxY = Math.min(MAP_H - 1, b.maxY + 1);

    const candidates = [];

    for (let y = minY; y <= maxY; y++) {
      const row = y * MAP_W;
      for (let x = minX; x <= maxX; x++) {
        const idx = row + x;
        if (!this.worldData.isLand[idx] || this.owners[idx] === countryId)
          continue;

        // Radioactive wasteland can never be conquered
        if (this.isWasteland && this.isWasteland[idx]) continue;

        // If onlyNeutral requested, strictly skip any land owned by other countries/states
        if (onlyNeutral && this.owners[idx] !== 0) continue;

        // Never auto-conquer land belonging to an active treaty partner (alliance/tribute)
        if (this.owners[idx] > 0 && this.getActiveTreatyBetween(countryId, this.owners[idx])) continue;

        const ownedNeighbors =
          (x > 0 && this.owners[idx - 1] === countryId ? 1 : 0) +
          (x < MAP_W - 1 && this.owners[idx + 1] === countryId ? 1 : 0) +
          (y > 0 && this.owners[idx - MAP_W] === countryId ? 1 : 0) +
          (y < MAP_H - 1 && this.owners[idx + MAP_W] === countryId ? 1 : 0);
        if (ownedNeighbors === 0) continue;
        if (this.isSnakingConquest(countryId, x, y)) continue;

        candidates.push({
          x,
          y,
          ownedNeighbors,
          isEnemy: this.owners[idx] > 0,
        });
      }
    }

    if (candidates.length === 0) {
      return {
        ok: false,
        reason: onlyNeutral
          ? "Sınırında fethedilecek boş (tarafsız) toprak kalmadı!"
          : "Komşu kara sınırı kalmadı! Karşı kıyılara gemi gönder.",
      };
    }

    // Group candidates into disconnected territory clusters using 16x16 spatial buckets
    // so auto-conquer rotates fairly across ALL colonies/regions instead of only 1!
    const bucketMap = new Map();
    for (const cand of candidates) {
      const bx = cand.x >> 4;
      const by = cand.y >> 4;
      const key = `${bx},${by}`;
      let list = bucketMap.get(key);
      if (!list) {
        list = { bx, by, items: [] };
        bucketMap.set(key, list);
      }
      list.items.push(cand);
    }

    const visitedBuckets = new Set();
    const clusters = [];
    for (const [startKey, startBucket] of bucketMap.entries()) {
      if (visitedBuckets.has(startKey)) continue;
      visitedBuckets.add(startKey);
      const queue = [startBucket];
      const clusterItems = [];
      let sumX = 0;
      let sumY = 0;
      let cMinX = Infinity;
      let cMinY = Infinity;

      while (queue.length > 0) {
        const cur = queue.shift();
        for (const item of cur.items) {
          clusterItems.push(item);
          sumX += item.x;
          sumY += item.y;
          if (item.x < cMinX) cMinX = item.x;
          if (item.y < cMinY) cMinY = item.y;
        }
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nKey = `${cur.bx + dx},${cur.by + dy}`;
            if (!visitedBuckets.has(nKey) && bucketMap.has(nKey)) {
              visitedBuckets.add(nKey);
              queue.push(bucketMap.get(nKey));
            }
          }
        }
      }

      clusters.push({
        items: clusterItems,
        centerX: sumX / clusterItems.length,
        centerY: sumY / clusterItems.length,
        minX: cMinX,
        minY: cMinY,
      });
    }

    // Deterministic ordering so round-robin visits every separate territory evenly
    clusters.sort((a, c2) => (a.minY !== c2.minY ? a.minY - c2.minY : a.minX - c2.minX));

    if (!this._autoConquerRegionCursor) this._autoConquerRegionCursor = 0;
    const chosenCluster = clusters[this._autoConquerRegionCursor % clusters.length];
    this._autoConquerRegionCursor = (this._autoConquerRegionCursor + 1) % 1000000;

    let bestCandidate = null;
    let bestScore = Infinity;
    for (const cand of chosenCluster.items) {
      // Massive priority bonus to fill internal holes (3 or 4 owned neighbors) first before expanding outward!
      const cavityBonus =
        cand.ownedNeighbors >= 3 ? -300 : cand.ownedNeighbors === 2 ? -75 : 0;
      const dist =
        Math.hypot(cand.x - chosenCluster.centerX, cand.y - chosenCluster.centerY) +
        (cand.isEnemy ? 25 : 0) +
        cavityBonus;
      if (dist < bestScore) {
        bestScore = dist;
        bestCandidate = cand;
      }
    }

    return this.conquerPixel(countryId, bestCandidate.x, bestCandidate.y, true);
  }

  async foundCountry({
    name,
    color,
    flagDataUrl,
    capitalX,
    capitalY,
    creatorIp,
  }) {
    const idx = capitalY * MAP_W + capitalX;
    if (!this.worldData.isLand[idx]) {
      return { ok: false, reason: "Denize devlet kurulamaz!" };
    }
    if (this.owners[idx] !== 0) {
      return { ok: false, reason: "Bu piksel zaten başka bir devlete ait!" };
    }

    const existingForDevice = this.countries.find(
      (c) => c.deviceId === this.myDeviceId,
    );
    if (existingForDevice && existingForDevice.landCount > 0) {
      return {
        ok: false,
        reason: `Bu cihazdan zaten bir ülke kurulmuş: "${existingForDevice.name}"! (1 Cihaz = 1 Ülke)`,
      };
    }

    const currentCountry = this.getMyCountry();
    if (currentCountry && currentCountry.landCount > 0) {
      return {
        ok: false,
        reason: `Zaten "${currentCountry.name}" adında bir ülken var!`,
      };
    }

    if (creatorIp && creatorIp !== "unknown" && creatorIp !== "127.0.0.1") {
      const countForIp = this.countries.filter(
        (c) => c.creatorIp === creatorIp && c.landCount > 0,
      ).length;
      if (countForIp >= 2) {
        return {
          ok: false,
          reason: "Bu IP adresinden en fazla 2 ülke oluşturulabilir!",
        };
      }
    }

    let flagRgba = null;
    let finalFlagDataUrl = flagDataUrl;
    try {
      const decoded = await loadDataUrlToFlagBuffer(flagDataUrl);
      flagRgba = decoded.rgba;
      if (decoded.dataUrl) {
        finalFlagDataUrl = decoded.dataUrl;
      }
    } catch {}

    // Unique 15-bit integer ID (10..32000) so countries created on different devices (Phone vs PC) never collide
    let newId = 10 + Math.floor(Math.random() * 31900);
    while (this.countryMap.has(newId)) {
      newId = 10 + Math.floor(Math.random() * 31900);
    }

    const country = this._normalizeCountry({
      id: newId,
      name: (name || "Devletim").trim(),
      color: color || "#E11D48",
      flagDataUrl: finalFlagDataUrl || flagDataUrl,
      flagRgba,
      capitalX,
      capitalY,
      landCount: 1,
      population: 15,
      gold: 0,
      troops: 1.0,
      upgrades: { ...DEFAULT_UPGRADES },
      creatorIp: creatorIp || "unknown",
      deviceId: this.myDeviceId,
      createdAt: Date.now(),
    });

    this.owners[idx] = newId;
    this.countries.push(country);
    this.countryMap.set(newId, country);
    this._expandCountryBound(newId, capitalX, capitalY);

    this.myCountryId = newId;
    saveMyCountryId(newId);
    if ((finalFlagDataUrl || flagDataUrl) && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sf_my_country_flag', finalFlagDataUrl || flagDataUrl);
      } catch {}
    }

    this.dirtyPixels = true;
    this.dirtyRegions = true;
    this.onSound("celebration");
    this.onEvent(`${country.name} kuruldu!`);

    this.sync.broadcast({
      type: "NEW_COUNTRY",
      country: {
        id: country.id,
        name: country.name,
        color: country.color,
        flagDataUrl: country.flagDataUrl,
        capitalX: country.capitalX,
        capitalY: country.capitalY,
        population: country.population,
        gold: country.gold,
        troops: country.troops,
        upgrades: country.upgrades,
        creatorIp: country.creatorIp,
        deviceId: country.deviceId,
        createdAt: country.createdAt,
      },
    });

    this.saveState();
    return { ok: true, country };
  }

  _generateFallbackFlagUrl(name, color) {
    if (typeof document === "undefined") return null;
    try {
      const cv = document.createElement("canvas");
      cv.width = 64;
      cv.height = 40;
      const cctx = cv.getContext("2d");
      cctx.fillStyle = color || "#E11D48";
      cctx.fillRect(0, 0, 64, 40);
      cctx.fillStyle = "#FFFFFF";
      cctx.font = "900 20px Inter, sans-serif";
      cctx.textAlign = "center";
      cctx.textBaseline = "middle";
      const initial = (name || "D").trim().charAt(0).toUpperCase();
      cctx.fillText(initial, 32, 20);
      return cv.toDataURL("image/jpeg", 0.7);
    } catch {
      return null;
    }
  }

  handleRemoteNewCountry(remoteData) {
    if (!remoteData || !Number.isInteger(remoteData.id) || remoteData.id < 10 || remoteData.id > 31909 ||
        this.countryMap.has(remoteData.id) || !Number.isInteger(remoteData.capitalX) ||
        !Number.isInteger(remoteData.capitalY) || remoteData.capitalX < 0 || remoteData.capitalX >= MAP_W ||
        remoteData.capitalY < 0 || remoteData.capitalY >= MAP_H) return;

    const capitalIdx = remoteData.capitalY * MAP_W + remoteData.capitalX;
    if (!this.worldData.isLand[capitalIdx] || this.isWasteland[capitalIdx]) return;

    const flagUrl =
      remoteData.flagDataUrl ||
      this._generateFallbackFlagUrl(remoteData.name, remoteData.color);
    const country = this._normalizeCountry({
      ...remoteData,
      flagDataUrl: flagUrl,
      flagRgba: null,
      landCount: 1,
    });

    const idx = country.capitalY * MAP_W + country.capitalX;
    if (this.worldData.isLand[idx] && !this.isWasteland[idx]) {
      this.owners[idx] = country.id;
    }

    this.countries.push(country);
    this.countryMap.set(country.id, country);
    this._expandCountryBound(country.id, country.capitalX, country.capitalY);
    this.dirtyPixels = true;
    this.dirtyRegions = true;
    this.scheduleSave();

    if (flagUrl) {
      loadDataUrlToFlagBuffer(flagUrl)
        .then((decoded) => {
          country.flagRgba = decoded.rgba;
          this.dirtyPixels = true;
        })
        .catch(() => {});
    }
  }

  // Export up to maxPts [x1, y1, x2, y2...] coordinates for a country (used by cloud sync)
  getCountryPixelCoords(countryId, maxPts = 3000) {
    if (this.dirtyRegions || !this.countryBounds) {
      this.computeCountryBounds();
    }
    const b = this.countryBounds?.get(countryId);
    if (!b || b.count === 0) return [];
    const pts = [];
    for (let y = b.minY; y <= b.maxY; y++) {
      const row = y * MAP_W;
      for (let x = b.minX; x <= b.maxX; x++) {
        if (this.owners[row + x] === countryId) {
          pts.push(x, y);
          if (pts.length >= maxPts * 2) return pts;
        }
      }
    }
    return pts;
  }

  // Ultra-compact Horizontal RLE encoding: [y, xStart, length, ...]
  // Compresses 500+ pixels into ~250 bytes so packets NEVER exceed the 4 KB server limit!
  getCountryRleSpans(countryId) {
    if (this.dirtyRegions || !this.countryBounds) {
      this.computeCountryBounds();
    }
    const b = this.countryBounds?.get(countryId);
    if (!b || b.count === 0) return [];
    const spans = [];
    for (let y = b.minY; y <= b.maxY; y++) {
      const row = y * MAP_W;
      let x = b.minX;
      while (x <= b.maxX) {
        if (this.owners[row + x] === countryId) {
          const startX = x;
          while (x <= b.maxX && this.owners[row + x] === countryId) {
            x++;
          }
          spans.push(y, startX, x - startX);
        } else {
          x++;
        }
      }
    }
    return spans;
  }

  // Handle remote country + territory sync packet from cloud (Phone <-> PC) — 100% SYNCHRONOUS to avoid async race overwrites!
  handleRemoteCountrySyncPacket(
    remoteCountry,
    pts,
    packetTime = 0,
    batchMode = false,
    rleSpans = null,
  ) {
    if (!remoteCountry || !Number.isInteger(remoteCountry.id) || remoteCountry.id < 10 || remoteCountry.id > 31909) return;
    // Sanitize capital coordinates instead of silently dropping valid countries with float/missing capitals
    let capX = Number.isFinite(remoteCountry.capitalX) ? Math.round(remoteCountry.capitalX) : -1;
    let capY = Number.isFinite(remoteCountry.capitalY) ? Math.round(remoteCountry.capitalY) : -1;
    if (capX < 0 || capX >= MAP_W || capY < 0 || capY >= MAP_H) {
      if (Array.isArray(rleSpans) && rleSpans.length >= 3) {
        capY = Math.max(0, Math.min(MAP_H - 1, Math.round(rleSpans[0])));
        capX = Math.max(0, Math.min(MAP_W - 1, Math.round(rleSpans[1])));
      } else if (Array.isArray(pts) && pts.length >= 2) {
        capX = Math.max(0, Math.min(MAP_W - 1, Math.round(pts[0])));
        capY = Math.max(0, Math.min(MAP_H - 1, Math.round(pts[1])));
      } else {
        return;
      }
      remoteCountry = { ...remoteCountry, capitalX: capX, capitalY: capY };
    } else if (capX !== remoteCountry.capitalX || capY !== remoteCountry.capitalY) {
      remoteCountry = { ...remoteCountry, capitalX: capX, capitalY: capY };
    }

    // Reject oversized or malformed coordinate payloads before allocating sets.
    if (Array.isArray(rleSpans) && (rleSpans.length % 3 !== 0 || rleSpans.length > MAP_W * MAP_H * 3)) return;
    if (Array.isArray(pts) && (pts.length % 2 !== 0 || pts.length > MAP_W * MAP_H * 2)) return;

    let country = this.countryMap.get(remoteCountry.id);
    if (
      country &&
      packetTime > 0 &&
      country._lastSyncTime &&
      packetTime < country._lastSyncTime
    ) {
      // Ignore stale out-of-order history packet older than what we already applied!
      return;
    }

    if (!country) {
      let flagUrl = remoteCountry.flagDataUrl;
      if (!flagUrl && remoteCountry.id === this.myCountryId && typeof localStorage !== 'undefined') {
        flagUrl = localStorage.getItem('sf_my_country_flag');
      }
      if (!flagUrl) {
        flagUrl = this._generateFallbackFlagUrl(remoteCountry.name, remoteCountry.color);
      }
      country = this._normalizeCountry({
        ...remoteCountry,
        flagDataUrl: flagUrl,
        flagRgba: null,
      });
      country._lastSyncTime = packetTime || Date.now();
      if (!this.countries.some((c) => c.id === country.id)) {
        this.countries.push(country);
      }
      this.countryMap.set(country.id, country);
      if (flagUrl) {
        loadDataUrlToFlagBuffer(flagUrl)
          .then((decoded) => {
            country.flagRgba = decoded.rgba;
            this.dirtyPixels = true;
          })
          .catch(() => {});
      }
    } else {
      if (packetTime > 0) country._lastSyncTime = packetTime;
      if (typeof remoteCountry.color === 'string' && /^#[0-9a-f]{6}$/i.test(remoteCountry.color)) {
        country.color = remoteCountry.color;
      }

      // Never overwrite an existing custom flag with an empty/fallback flag!
      if (remoteCountry.flagDataUrl && remoteCountry.flagDataUrl !== country.flagDataUrl) {
        // Server-authoritative flag sync (no browser localStorage flag override)
        country.flagDataUrl = remoteCountry.flagDataUrl;
        loadDataUrlToFlagBuffer(remoteCountry.flagDataUrl)
          .then((res) => {
            country.flagRgba = res.rgba;
            this.dirtyPixels = true;
          })
          .catch(() => {});
      }
      if (remoteCountry.upgrades && typeof remoteCountry.upgrades === 'object' && !Array.isArray(remoteCountry.upgrades)) {
        const safeUpgrades = { ...DEFAULT_UPGRADES };
        for (const key of Object.keys(DEFAULT_UPGRADES)) {
          const level = remoteCountry.upgrades[key];
          safeUpgrades[key] = Number.isFinite(level) ? Math.max(0, Math.min(25, Math.floor(level))) : country.upgrades[key] || 0;
        }
        country.upgrades = safeUpgrades;
      }
    }

    if (batchMode || country.id !== this.myCountryId) {
      if (Number.isFinite(remoteCountry.troops))
        country.troops = Math.max(0, Math.min(1_000_000_000, remoteCountry.troops));
      if (Number.isFinite(remoteCountry.gold))
        country.gold = Math.max(0, Math.min(1_000_000_000_000_000, remoteCountry.gold));
      if (Number.isFinite(remoteCountry.population))
        country.population = Math.max(10, Math.min(1_000_000_000_000, remoteCountry.population));
      if (remoteCountry.inventory && typeof remoteCountry.inventory === 'object') {
        const nukes = remoteCountry.inventory.nukes;
        const specialTroops = remoteCountry.inventory.specialTroops;
        country.specialTroops = Number.isFinite(specialTroops)
          ? Math.max(0, Math.floor(specialTroops))
          : country.specialTroops || 0;
        country.inventory = {
          nukes: Number.isFinite(nukes) ? Math.max(0, Math.min(100000, Math.floor(nukes))) : country.inventory?.nukes || 0,
          specialTroops: country.specialTroops,
        };
      }
      if (["BALANCED", "MERCHANT", "WARLORD", "FORTRESS"].includes(remoteCountry.doctrine)) {
        country.doctrine = remoteCountry.doctrine;
      }
      if (Number.isFinite(remoteCountry.dailyStreak)) {
        country.dailyStreak = Math.max(country.dailyStreak || 0, Math.floor(remoteCountry.dailyStreak));
      }
      if (typeof remoteCountry.lastDailyClaimDay === "string" && remoteCountry.lastDailyClaimDay) {
        country.lastDailyClaimDay = remoteCountry.lastDailyClaimDay;
      }
      if (Array.isArray(remoteCountry.quests) && remoteCountry.quests.length > 0) {
        country.quests = remoteCountry.quests;
      }
      if (Number.isFinite(remoteCountry._rewardGoldPool)) {
        country._rewardGoldPool = Math.max(0, Math.floor(remoteCountry._rewardGoldPool));
      }
      if (Number.isFinite(remoteCountry.popBoostUntil)) {
        country.popBoostUntil = Math.max(country.popBoostUntil || 0, remoteCountry.popBoostUntil);
      }
    }

    if (remoteCountry.lastHeartbeatTime) country.lastHeartbeatTime = remoteCountry.lastHeartbeatTime;
    else if (packetTime > 0) country.lastHeartbeatTime = packetTime;
    if (remoteCountry.lastInputTime) country.lastInputTime = remoteCountry.lastInputTime;
    if (remoteCountry.lastActiveTime) country.lastActiveTime = remoteCountry.lastActiveTime;

    const idxCap = country.capitalY * MAP_W + country.capitalX;
    if (this.worldData.isLand[idxCap] && !this.isWasteland[idxCap] && this.owners[idxCap] === 0) {
      this.owners[idxCap] = country.id;
    }

    const hasRle = Array.isArray(rleSpans) && rleSpans.length >= 3;
    const hasPts = Array.isArray(pts) && pts.length >= 2;
    if (hasRle || hasPts) {
      const validPtsSet = new Set();
      if (hasRle) {
        for (let i = 0; i < rleSpans.length; i += 3) {
          const py = rleSpans[i];
          const xStart = rleSpans[i + 1];
          const len = rleSpans[i + 2];
          if (!Number.isInteger(py) || !Number.isInteger(xStart) || !Number.isInteger(len) ||
              py < 0 || py >= MAP_H || len <= 0 || xStart < 0 || xStart >= MAP_W) continue;
          const row = py * MAP_W;
          const endX = Math.min(MAP_W, xStart + len);
          for (let px = xStart; px < endX; px++) {
            validPtsSet.add(row + px);
          }
        }
      } else {
        for (let i = 0; i < pts.length; i += 2) {
          const px = pts[i];
          const py = pts[i + 1];
          if (Number.isInteger(px) && Number.isInteger(py) && px >= 0 && px < MAP_W && py >= 0 && py < MAP_H) {
            validPtsSet.add(py * MAP_W + px);
          }
        }
      }

      // Synchronize territory exactly with the authoritative pts
      if (
        (batchMode || country.id !== this.myCountryId) &&
        validPtsSet.size > 0
      ) {
        if (!batchMode) {
          // Clear any old/orphaned pixels that this country no longer owns across the entire map
          const total = MAP_W * MAP_H;
          for (let idx = 0; idx < total; idx++) {
            if (this.owners[idx] === country.id && !validPtsSet.has(idx)) {
              this.owners[idx] = 0;
            }
          }
        }

        // Set all authoritative pixels (scorched radioactive wasteland cannot be owned)
        for (const idx of validPtsSet) {
          if (this.worldData.isLand[idx]) {
            if (this.isWasteland && this.isWasteland[idx]) {
              this.owners[idx] = 0;
            } else {
              this.owners[idx] = country.id;
            }
          }
        }
      } else if (country.id === this.myCountryId) {
        for (const idx of validPtsSet) {
          if (this.worldData.isLand[idx] && this.owners[idx] === 0) {
            if (this.isWasteland && this.isWasteland[idx]) {
              this.owners[idx] = 0;
            } else {
              this.owners[idx] = country.id;
            }
          }
        }
      }
    }

    if (!batchMode) {
      // Immediately recompute full country bounds & stats so rendering and territory size are 100% exact!
      this.computeCountryBounds();
      this.dirtyRegions = false;
      this.dirtyPixels = true;
    }
    this._recalculateDerivedStats(country);
  }

  handleRemoteConquerPixel(countryId, x, y, cost = 1, isReplay = false, wasEnemy = null) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return;
    if (!Number.isInteger(countryId) || !Number.isFinite(cost) || cost < 0 || cost > 100000) return;
    const country = this.countryMap.get(countryId);
    if (!country) return; // Ignore orphaned pixel packets for unknown countries

    const idx = y * MAP_W + x;
    // A remote packet may only claim habitable land; never let malformed packets
    // create territory in the ocean or reclaim radioactive wasteland.
    if (!this.worldData.isLand[idx] || this.isWasteland[idx]) return;
    const prevOwner = this.owners[idx];
    if (prevOwner === countryId) return;

    // Treaty protection & simultaneous neutral-pixel race guard:
    if (!isReplay && prevOwner > 0 && prevOwner !== countryId) {
      const activeTreaty = this.getActiveTreatyBetween(countryId, prevOwner);
      if (activeTreaty) {
        if (wasEnemy === false) {
          // Friend clicked or auto-filled a pixel that was neutral on their screen (simultaneous click race condition).
          // Do NOT overwrite ally's pixel, do NOT trigger false attack alarm, and do NOT break treaty!
          return;
        }
        // Genuine attack on an ally while treaty is still ACTIVE -> break treaty authoritatively & transfer penalty/debt!
        this.breakTreaty(activeTreaty.id, countryId, "SALDIRI");
      }
    }

    this.owners[idx] = countryId;

    country.landCount++;
    country.troops = Math.max(0, country.troops - (cost || 0));
    this._recalculateDerivedStats(country);

    if (prevOwner > 0) {
      const prevC = this.countryMap.get(prevOwner);
      if (prevC) {
        prevC.landCount = Math.max(0, prevC.landCount - 1);
        this._recalculateDerivedStats(prevC);
      }
      this.dirtyRegions = true;

      // Eğer saldırıya uğrayan benim devletimse (ve geçmiş tekrarı değilse), anında acil durum saldırı alarmı tetikle!
      if (!isReplay && prevOwner === this.myCountryId && countryId !== this.myCountryId) {
        this.onUnderAttack({
          attackerId: countryId,
          attackerName: country.name || "Düşman",
          attackerColor: country.color || "#EF4444",
          x,
          y,
          time: Date.now(),
        });
      }
    }
    this._expandCountryBound(countryId, x, y);

    this.dirtyPixels = true;
  }

  // Server-backed mode: world state lives on the cloud server, not in browser localStorage/cookies!
  scheduleSave() {}

  handleRemoteLaunchShip(remoteShip) {
    if (!remoteShip || !remoteShip.id) return;
    if (this.ships.some((s) => s.id === remoteShip.id)) return;
    this.ships.push({ ...remoteShip });
  }

  handleRemoteSyncCountryStats(
    countryId,
    stats,
    packetTime = 0,
    forceInit = false,
    isAdminOverride = false,
  ) {
    if (!forceInit && !isAdminOverride && countryId === this.myCountryId) return;
    const country = this.countryMap.get(countryId);
    if (!country || !stats) return;
    // Reject stale admin/stats packets sent BEFORE this country was created (prevents old 1M admin gifts leaking to new countries)
    if (
      packetTime > 0 &&
      country.createdAt &&
      packetTime + 3000 < country.createdAt
    ) {
      return;
    }
    if (
      !isAdminOverride &&
      packetTime > 0 &&
      country._lastStatsTime &&
      packetTime < country._lastStatsTime
    )
      return;
    if (packetTime > 0) country._lastStatsTime = packetTime;
    if (isAdminOverride) {
      country._lastAdminOverrideTime = Date.now();
    }
    if (typeof stats.color === 'string' && /^#[0-9a-f]{6}$/i.test(stats.color)) {
      country.color = stats.color;
      this.dirtyPixels = true;
    }
    if (Number.isFinite(stats.gold)) country.gold = Math.max(0, Math.min(1_000_000_000_000_000, stats.gold));
    if (Number.isFinite(stats.population)) country.population = Math.max(10, Math.min(1_000_000_000_000, stats.population));
    if (Number.isFinite(stats.troops)) country.troops = Math.max(0, Math.min(1_000_000_000, stats.troops));
    if (stats.upgrades && typeof stats.upgrades === 'object' && !Array.isArray(stats.upgrades)) {
      const incoming = { ...DEFAULT_UPGRADES };
      for (const key of Object.keys(DEFAULT_UPGRADES)) {
        const level = stats.upgrades[key];
        incoming[key] = Number.isFinite(level) ? Math.max(0, Math.min(25, Math.floor(level))) : country.upgrades[key] || 0;
      }
      country.upgrades = incoming;
    }
    if (stats.inventory && typeof stats.inventory === 'object') {
      const nukes = stats.inventory.nukes;
      const specialTroops = stats.inventory.specialTroops;
      country.specialTroops = Number.isFinite(specialTroops) ? Math.max(0, Math.floor(specialTroops)) : country.specialTroops || 0;
      country.inventory = {
        nukes: Number.isFinite(nukes) ? Math.max(0, Math.min(100000, Math.floor(nukes))) : country.inventory?.nukes || 0,
        specialTroops: country.specialTroops,
      };
      if (countryId === this.myCountryId) {
        this._persistCountryInventory(country);
      }
    }
    if (stats.lastHeartbeatTime) country.lastHeartbeatTime = stats.lastHeartbeatTime;
    else if (packetTime > 0) country.lastHeartbeatTime = packetTime;
    if (stats.lastInputTime) country.lastInputTime = stats.lastInputTime;
    if (stats.lastActiveTime) country.lastActiveTime = stats.lastActiveTime;
    if (["BALANCED", "MERCHANT", "WARLORD", "FORTRESS"].includes(stats.doctrine)) {
      country.doctrine = stats.doctrine;
    }
    if (Number.isFinite(stats.dailyStreak)) {
      country.dailyStreak = Math.max(country.dailyStreak || 0, Math.floor(stats.dailyStreak));
    }
    if (typeof stats.lastDailyClaimDay === "string" && stats.lastDailyClaimDay) {
      country.lastDailyClaimDay = stats.lastDailyClaimDay;
    }
    if (Array.isArray(stats.quests) && stats.quests.length > 0) {
      country.quests = stats.quests;
    }
    if (Number.isFinite(stats.popBoostUntil)) {
      country.popBoostUntil = Math.max(country.popBoostUntil || 0, stats.popBoostUntil);
    }
    if (Number.isFinite(stats._rewardGoldPool)) {
      country._rewardGoldPool = Math.max(0, Math.floor(stats._rewardGoldPool));
    }
    this._recalculateDerivedStats(country);
    this.saveState();
  }

  // Update country flag / custom image dynamically in real-time
  async updateCountryFlag(countryId, dataUrl) {
    const c = this.countryMap.get(countryId);
    if (!c || !dataUrl) return false;

    try {
      const decoded = await loadDataUrlToFlagBuffer(dataUrl);
      const finalFlag = decoded.dataUrl || dataUrl;
      c.flagDataUrl = finalFlag;
      c.flagRgba = decoded.rgba;

      if (countryId === this.myCountryId && typeof localStorage !== 'undefined') {
        localStorage.setItem('sf_my_country_flag', finalFlag);
      }

      this.dirtyPixels = true;
      this.dirtyRegions = true;

      const compactFlag = this.sync.getCompactFlagFromCountry(c);
      this.sync.broadcast({
        type: 'UPDATE_COUNTRY_FLAG',
        countryId,
        flagDataUrl: compactFlag || finalFlag,
      });

      return true;
    } catch (err) {
      console.error('[Engine] updateCountryFlag error:', err);
      return false;
    }
  }

  handleRemoteUpdateFlag(countryId, flagDataUrl) {
    if (!countryId || !flagDataUrl) return;
    const c = this.countryMap.get(countryId);
    if (!c) return;

    // Protect local player's HD flag from lower-res remote broadcast
    if (countryId === this.myCountryId && typeof localStorage !== 'undefined') {
      const localFlag = localStorage.getItem('sf_my_country_flag');
      if (localFlag) return;
    }

    c.flagDataUrl = flagDataUrl;
    loadDataUrlToFlagBuffer(flagDataUrl)
      .then((decoded) => {
        c.flagRgba = decoded.rgba;
        this.dirtyPixels = true;
      })
      .catch(() => {});
  }

  // ==========================================
  // TREATY & DIPLOMACY SYSTEM (İttifak & Haraç)
  // ==========================================

  _processPeriodicTributes() {
    const now = Date.now();
    if (this._lastTributeCheck && now - this._lastTributeCheck < 4000) return;
    this._lastTributeCheck = now;

    if (!Array.isArray(this.treaties) || this.treaties.length === 0) return;

    for (const treaty of this.treaties) {
      if (treaty.status !== "ACTIVE" || treaty.type !== "TRIBUTE") continue;
      // Only the paying client (or my country if payer) handles their own tribute debit
      if (treaty.tributePayerId !== this.myCountryId) continue;

      const lastPay = treaty.lastPaymentTime || treaty.activatedAt || now;
      if (now - lastPay >= 60000) { // 60 seconds
        const payer = this.countryMap.get(treaty.tributePayerId);
        const receiver = this.countryMap.get(treaty.tributeReceiverId);

        if (payer && payer.gold >= treaty.tributeAmount) {
          payer.gold -= treaty.tributeAmount;
          if (receiver) {
            receiver.gold += treaty.tributeAmount;
          }
          treaty.lastPaymentTime = now;

          this.sync.broadcast({
            type: "TREATY_PAYMENT",
            treatyId: treaty.id,
            amount: treaty.tributeAmount,
            time: now,
          });

          this.onSound("cash");
          this.onEvent(` ${payer.name}, ${receiver?.name || "Devlet"} için dakikalık ${treaty.tributeAmount} Altın haraç ödedi.`);
          if (this.onTreatyUpdate) this.onTreatyUpdate();
        } else {
          // Payer has insufficient gold -> treaty is broken due to non-payment!
          this.breakTreaty(treaty.id, treaty.tributePayerId, "HARAÇ ÖDENEMEDİ (İFLAS)");
        }
      }
    }
  }

  _processPeriodicReparations() {
    const now = Date.now();
    if (this._lastReparationCheck && now - this._lastReparationCheck < 2500) return;
    this._lastReparationCheck = now;

    if (!this._pendingDebtTransfers) return;
    let hasTransfers = false;

    for (const [treatyId, amount] of Object.entries(this._pendingDebtTransfers)) {
      if (!amount || amount < 0.5) continue;
      const treaty = this.treaties.find((t) => t.id === treatyId);
      if (!treaty) continue;

      const rounded = Number(amount.toFixed(1));
      this._pendingDebtTransfers[treatyId] = 0;
      hasTransfers = true;

      this.sync.broadcast({
        type: "TREATY_REPARATION_PAYMENT",
        treatyId: treaty.id,
        amount: rounded,
        remainingDebt: Number(Math.max(0, treaty.remainingDebt).toFixed(1)),
        time: now,
      });

      const creditor = this.countryMap.get(treaty.creditorId);
      if (creditor && creditor.id !== this.myCountryId) {
        creditor.gold += rounded;
      }

      if (treaty.remainingDebt <= 0) {
        this.onSound("celebration");
        this.onEvent(
          `⚖️ ${treaty.creditorName || "Devlet"} devletine olan tüm tazminat borcunuz kapandı! Artık ürettiğiniz altınlar kasanıza kalacak.`,
        );
      }
    }
    if (hasTransfers && this.onTreatyUpdate) {
      this.onTreatyUpdate();
    }
  }

  getActiveReparationDebts(countryId) {
    if (!countryId || !Array.isArray(this.treaties)) return [];
    return this.treaties.filter(
      (t) =>
        t.status === "BROKEN" &&
        t.debtorId === countryId &&
        (t.remainingDebt || 0) > 0.05,
    );
  }

  getPendingReparationReceivables(countryId) {
    if (!countryId || !Array.isArray(this.treaties)) return [];
    return this.treaties.filter(
      (t) =>
        t.status === "BROKEN" &&
        t.creditorId === countryId &&
        (t.remainingDebt || 0) > 0.05,
    );
  }

  getActiveTreatyBetween(c1Id, c2Id) {
    if (!c1Id || !c2Id || c1Id === c2Id) return null;
    return (
      this.treaties.find(
        (t) =>
          t.status === "ACTIVE" &&
          t.type !== "LAND_PURCHASE" &&
          ((t.fromId === c1Id && t.toId === c2Id) ||
            (t.fromId === c2Id && t.toId === c1Id)),
      ) || null
    );
  }

  getMyTreaties() {
    if (!this.myCountryId) return [];
    return this.treaties.filter(
      (t) => t.fromId === this.myCountryId || t.toId === this.myCountryId,
    );
  }

  getMyPendingIncomingTreaties() {
    if (!this.myCountryId) return [];
    return this.treaties.filter(
      (t) => t.toId === this.myCountryId && t.status === "PENDING",
    );
  }

  proposeTreaty({
    toCountryId,
    type,
    penalty,
    tributeAmount,
    tributeRole,
    landPixelCount,
    landPricePerPixel,
  }) {
    const fromC = this.getMyCountry();
    if (!fromC || fromC.landCount <= 0) {
      return { ok: false, reason: "Önce aktif bir devletin olmalı!" };
    }
    const toC = this.countryMap.get(toCountryId);
    if (!toC || toC.landCount <= 0) {
      return { ok: false, reason: "Hedef devlet haritada bulunamadı." };
    }
    if (fromC.id === toC.id) {
      return { ok: false, reason: "Kendi kendine anlaşma yapamazsın!" };
    }

    const existingActive = this.getActiveTreatyBetween(fromC.id, toC.id);
    if (existingActive && type !== "LAND_PURCHASE") {
      return {
        ok: false,
        reason: `Bu devletle zaten aktif bir "${existingActive.type === "ALLIANCE" ? "İttifak" : "Haraç"}" anlaşman var!`,
      };
    }

    const existingPending = this.treaties.find(
      (t) =>
        t.status === "PENDING" &&
        ((t.fromId === fromC.id && t.toId === toC.id) ||
          (t.fromId === toC.id && t.toId === fromC.id)),
    );
    if (existingPending) {
      return {
        ok: false,
        reason: "Bu devletle zaten bekleyen bir anlaşma teklifi var!",
      };
    }

    const cleanPenalty = Math.max(100, Math.round(Number(penalty) || 1000));
    const cleanTribute =
      type === "TRIBUTE"
        ? Math.max(10, Math.round(Number(tributeAmount) || 50))
        : 0;

    let tributePayerId = null;
    let tributeReceiverId = null;
    if (type === "TRIBUTE") {
      tributePayerId = tributeRole === "RECEIVER" ? toC.id : fromC.id;
      tributeReceiverId = tributeRole === "RECEIVER" ? fromC.id : toC.id;
    }

    let cleanLandPixelCount = 0;
    let cleanLandPricePerPixel = 0;
    let landTotalPrice = 0;
    if (type === "LAND_PURCHASE") {
      cleanLandPixelCount = Math.max(5, Math.min(500, Math.round(Number(landPixelCount) || 25)));
      cleanLandPricePerPixel = Math.max(10, Math.round(Number(landPricePerPixel) || 50));
      landTotalPrice = cleanLandPixelCount * cleanLandPricePerPixel;
      if (fromC.gold < landTotalPrice) {
        return {
          ok: false,
          reason: `Kasanda yeterli altın yok! (${cleanLandPixelCount} piksel için ${landTotalPrice.toLocaleString()} Altın gerekli)`,
        };
      }
    }

    const treaty = {
      id: "tr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      type, // 'ALLIANCE' | 'TRIBUTE' | 'LAND_PURCHASE'
      fromId: fromC.id,
      toId: toC.id,
      fromName: fromC.name,
      toName: toC.name,
      fromColor: fromC.color || "#FBBF24",
      toColor: toC.color || "#38BDF8",
      penalty: cleanPenalty,
      tributeAmount: cleanTribute,
      tributePayerId,
      tributeReceiverId,
      landPixelCount: cleanLandPixelCount,
      landPricePerPixel: cleanLandPricePerPixel,
      landTotalPrice,
      buyerId: fromC.id,
      sellerId: toC.id,
      status: "PENDING",
      createdAt: Date.now(),
      activatedAt: null,
      lastPaymentTime: null,
    };

    this.treaties.push(treaty);

    this.sync.broadcast({
      type: "TREATY_PROPOSAL",
      treaty,
    });

    this.onSound("pencil");
    const typeLabel =
      type === "ALLIANCE"
        ? "İttifak"
        : type === "TRIBUTE"
          ? "Haraç"
          : "Toprak Satın Alma";
    this.onEvent(`Diplomasi: ${toC.name} devletine ${typeLabel} teklifi gönderildi.`);
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    return { ok: true, treaty };
  }

  acceptTreaty(treatyId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty || treaty.status !== "PENDING") {
      return { ok: false, reason: "Anlaşma bulunamadı veya süresi geçmiş." };
    }

    if (treaty.type === "LAND_PURCHASE") {
      const buyer = this.countryMap.get(treaty.buyerId);
      const seller = this.countryMap.get(treaty.sellerId);
      if (!buyer || !seller) {
        return { ok: false, reason: "Devletlerden biri bulunamadı." };
      }
      if (buyer.gold < treaty.landTotalPrice) {
        return {
          ok: false,
          reason: "Alıcının kasasında yeterli altın bulunmuyor!",
        };
      }

      buyer.gold = Math.max(0, buyer.gold - treaty.landTotalPrice);
      seller.gold += treaty.landTotalPrice;
      const transferred = this.transferBorderPixels({
        buyerId: treaty.buyerId,
        sellerId: treaty.sellerId,
        count: treaty.landPixelCount,
      });

      treaty.status = "COMPLETED";
      treaty.activatedAt = Date.now();

      this.sync.broadcast({
        type: "TREATY_ACCEPT",
        treatyId,
        activatedAt: treaty.activatedAt,
        transferred,
      });

      this.sync.broadcast({
        type: "SYNC_COUNTRY_STATS",
        countryId: buyer.id,
        stats: {
          gold: Math.round(buyer.gold),
          population: Math.round(buyer.population),
          troops: Number(buyer.troops.toFixed(1)),
          upgrades: buyer.upgrades,
        },
      });

      this.sync.broadcast({
        type: "SYNC_COUNTRY_STATS",
        countryId: seller.id,
        stats: {
          gold: Math.round(seller.gold),
          population: Math.round(seller.population),
          troops: Number(seller.troops.toFixed(1)),
          upgrades: seller.upgrades,
        },
      });

      this.sync.sendChatMessage(
        ` ${treaty.fromName}, ${treaty.toName} devletinden ${transferred} piksel toprağı ${treaty.landTotalPrice.toLocaleString()} Altın karşılığında satın aldı! `,
        true,
      );

      this.onSound("celebration");
      this.onEvent(
        ` Toprak Satışı: ${treaty.fromName}, ${treaty.toName} devletinden ${transferred} piksel toprağı satın aldı!`,
      );
      if (this.onTreatyUpdate) this.onTreatyUpdate();
      return { ok: true, treaty, transferred };
    }

    treaty.status = "ACTIVE";
    treaty.activatedAt = Date.now();
    treaty.lastPaymentTime = Date.now();

    this.sync.broadcast({
      type: "TREATY_ACCEPT",
      treatyId,
      activatedAt: treaty.activatedAt,
    });

    this.onSound("celebration");
    this.onEvent(
      ` ${treaty.fromName} ve ${treaty.toName} arasında ${treaty.type === "ALLIANCE" ? "İttifak" : "Haraç"} anlaşması imzalandı!`,
    );
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    return { ok: true, treaty };
  }

  rejectTreaty(treatyId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty || treaty.status !== "PENDING") return { ok: false };

    treaty.status = "REJECTED";
    this.sync.broadcast({
      type: "TREATY_REJECT",
      treatyId,
    });

    this.onSound("pencil");
    this.onEvent(
      `${treaty.toName}, ${treaty.fromName} tarafından yapılan anlaşma teklifini reddetti.`,
    );
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    return { ok: true };
  }

  breakTreaty(treatyId, breakerCountryId, reason = "SALDIRI") {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty || treaty.status !== "ACTIVE") return { ok: false };

    const breaker = this.countryMap.get(breakerCountryId);
    const victimId =
      breakerCountryId === treaty.fromId ? treaty.toId : treaty.fromId;
    const victim = this.countryMap.get(victimId);

    const penalty = treaty.penalty || 0;
    let upfrontPaid = 0;
    let debt = 0;

    if (breaker && penalty > 0) {
      upfrontPaid = Math.min(breaker.gold, penalty);
      breaker.gold = Math.max(0, breaker.gold - upfrontPaid);
      debt = Math.max(0, penalty - upfrontPaid);
      if (victim && upfrontPaid > 0) {
        victim.gold += upfrontPaid;
        if (victim.id === this.myCountryId) {
          this.progressQuest("GOLD", Math.round(upfrontPaid));
        }
      }
    }

    treaty.status = "BROKEN";
    treaty.brokenAt = Date.now();
    treaty.breakerId = breakerCountryId;
    treaty.breakReason = reason;

    treaty.debtorId = breakerCountryId;
    treaty.creditorId = victimId;
    treaty.debtorName = breaker ? breaker.name : "Devlet";
    treaty.creditorName = victim ? victim.name : "Devlet";
    treaty.totalDebt = penalty;
    treaty.paidDebt = upfrontPaid;
    treaty.remainingDebt = debt;

    this.sync.broadcast({
      type: "TREATY_BREAK",
      treatyId,
      breakerId: breakerCountryId,
      penalty,
      upfrontPaid,
      debt,
      reason,
    });

    this.onSound("celebration");
    const breakerName = breaker ? breaker.name : "Devlet";
    const victimName = victim ? victim.name : "Devlet";
    if (debt > 0) {
      this.onEvent(
        `⚠️ ${breakerName}, ${victimName} ile anlaşmasını ihlal etti! Kasadaki ${upfrontPaid} Altın ödendi. Kalan ${debt} Altın borç, ürettiği altınlardan tahsil edilecek!`,
      );
    } else {
      this.onEvent(
        ` ${breakerName}, ${victimName} ile olan ${treaty.type === "ALLIANCE" ? "İttifak" : "Haraç"} anlaşmasını ${reason === "SALDIRI" ? "saldırarak" : "ödemeyerek"} ihlal etti! (${upfrontPaid} Altın ceza ödendi)`,
      );
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    this.scheduleSave();
    return { ok: true, penalty, deducted: upfrontPaid, debt, treaty };
  }

  // Request mutual termination of an active treaty without penalty
  requestTreatyTermination(treatyId, requesterCountryId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty || treaty.status !== "ACTIVE") {
      return { ok: false, reason: "Aktif bir anlaşma bulunamadı." };
    }
    const requester = this.countryMap.get(requesterCountryId);
    const otherId = requesterCountryId === treaty.fromId ? treaty.toId : treaty.fromId;
    const other = this.countryMap.get(otherId);

    treaty.terminationRequestedBy = requesterCountryId;
    treaty.terminationRequestedAt = Date.now();

    this.sync.broadcast({
      type: "TREATY_TERMINATION_REQUEST",
      treatyId,
      requesterId: requesterCountryId,
    });

    this.onSound("pencil");
    this.onEvent(
      ` ${requester ? requester.name : "Devlet"}, ${other ? other.name : "karşı devlete"} anlaşmayı cezasız feshetme teklifi gönderdi.`,
    );
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    return { ok: true, treaty };
  }

  cancelTreatyTerminationRequest(treatyId, requesterCountryId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty || treaty.terminationRequestedBy !== requesterCountryId) return { ok: false };
    treaty.terminationRequestedBy = null;
    treaty.terminationRequestedAt = null;

    this.sync.broadcast({
      type: "TREATY_TERMINATION_CANCEL_REQUEST",
      treatyId,
    });

    this.onEvent("Fesih isteği geri çekildi.");
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    return { ok: true };
  }

  acceptTreatyTermination(treatyId, accepterCountryId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty || treaty.status !== "ACTIVE") {
      return { ok: false, reason: "Anlaşma aktif değil veya bulunamadı." };
    }

    // Terminated mutually with ZERO penalty from both sides!
    treaty.status = "TERMINATED";
    treaty.terminatedAt = Date.now();
    treaty.terminationRequestedBy = null;

    this.sync.broadcast({
      type: "TREATY_TERMINATION_ACCEPT",
      treatyId,
    });

    this.sync.sendChatMessage(
      ` ${treaty.fromName} ve ${treaty.toName} arasındaki ${treaty.type === "ALLIANCE" ? "İttifak" : "Haraç"} anlaşması karşılıklı rıza ile cezasız olarak feshedildi!`,
      true,
    );

    this.onSound("celebration");
    this.onEvent(` Anlaşma karşılıklı kabul ile cezasız feshedildi.`);
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    return { ok: true, treaty };
  }

  rejectTreatyTermination(treatyId, rejecterCountryId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return { ok: false };
    treaty.terminationRequestedBy = null;
    treaty.terminationRequestedAt = null;

    this.sync.broadcast({
      type: "TREATY_TERMINATION_REJECT",
      treatyId,
    });

    this.onSound("pencil");
    this.onEvent(`Anlaşma fesih teklifi reddedildi. Anlaşma geçerliliğini koruyor.`);
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    return { ok: true };
  }

  handleRemoteTreatyTerminationRequest(treatyId, requesterId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.terminationRequestedBy = requesterId;
    treaty.terminationRequestedAt = Date.now();
    const otherId = requesterId === treaty.fromId ? treaty.toId : treaty.fromId;
    if (otherId === this.myCountryId) {
      this.onSound("notification");
      const reqName = requesterId === treaty.fromId ? treaty.fromName : treaty.toName;
      this.onEvent(` ${reqName} anlaşmayı cezasız feshetmek istiyor. Anlaşmalar menüsünden yanıtlayabilirsiniz.`);
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyTerminationCancel(treatyId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.terminationRequestedBy = null;
    treaty.terminationRequestedAt = null;
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyTerminationAccept(treatyId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.status = "TERMINATED";
    treaty.terminatedAt = Date.now();
    treaty.terminationRequestedBy = null;
    this.onSound("celebration");
    this.onEvent(` ${treaty.fromName} ve ${treaty.toName} arasındaki anlaşma cezasız olarak feshedildi.`);
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyTerminationReject(treatyId) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.terminationRequestedBy = null;
    treaty.terminationRequestedAt = null;
    this.onEvent("Anlaşma fesih teklifi reddedildi. Anlaşma devam ediyor.");
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyProposal(remoteTreaty, isReplay = false) {
    if (!remoteTreaty || !remoteTreaty.id) return;
    const existing = this.treaties.find((t) => t.id === remoteTreaty.id);
    if (existing) {
      Object.assign(existing, remoteTreaty);
    } else {
      this.treaties.push({ ...remoteTreaty });
    }

    if (!isReplay && remoteTreaty.toId === this.myCountryId) {
      this.onSound("notification");
      this.onEvent(
        ` Diplomatik Teklif: ${remoteTreaty.fromName} size bir ${remoteTreaty.type === "ALLIANCE" ? "İttifak" : "Haraç"} anlaşması teklif etti!`,
      );
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyAccept(treatyId, activatedAt, isReplay = false) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.status = treaty.type === "LAND_PURCHASE" ? "COMPLETED" : "ACTIVE";
    treaty.activatedAt = activatedAt || Date.now();
    treaty.lastPaymentTime = treaty.activatedAt;

    const involvesMe = this.myCountryId && (treaty.fromId === this.myCountryId || treaty.toId === this.myCountryId);
    if (!isReplay && involvesMe) {
      this.onSound("celebration");
      if (treaty.type === "LAND_PURCHASE") {
        this.onEvent(
          ` ${treaty.fromName} ve ${treaty.toName} arasındaki Toprak Satışı tamamlandı!`,
        );
      } else {
        this.onEvent(
          ` ${treaty.fromName} ve ${treaty.toName} arasındaki ${treaty.type === "ALLIANCE" ? "İttifak" : "Haraç"} anlaşması yürürlüğe girdi!`,
        );
      }
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyReject(treatyId, isReplay = false) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.status = "REJECTED";

    if (!isReplay && treaty.fromId === this.myCountryId) {
      this.onSound("pencil");
      this.onEvent(`${treaty.toName} anlaşma teklifinizi reddetti.`);
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyBreak(
    treatyId,
    breakerId,
    penalty = 0,
    upfrontPaid = null,
    debt = null,
    reason = "SALDIRI",
    isReplay = false,
  ) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.status = "BROKEN";
    treaty.breakerId = breakerId;
    treaty.brokenAt = Date.now();
    treaty.breakReason = reason;

    const breaker = this.countryMap.get(breakerId);
    const victimId = breakerId === treaty.fromId ? treaty.toId : treaty.fromId;
    const victim = this.countryMap.get(victimId);

    const actualPenalty = penalty || treaty.penalty || 0;
    const actualUpfront =
      upfrontPaid !== null
        ? upfrontPaid
        : breaker
          ? Math.min(breaker.gold, actualPenalty)
          : actualPenalty;
    const actualDebt =
      debt !== null ? debt : Math.max(0, actualPenalty - actualUpfront);

    treaty.debtorId = breakerId;
    treaty.creditorId = victimId;
    treaty.debtorName = breaker ? breaker.name : "Devlet";
    treaty.creditorName = victim ? victim.name : "Devlet";
    treaty.totalDebt = actualPenalty;
    treaty.paidDebt = actualUpfront;
    treaty.remainingDebt = actualDebt;

    if (!isReplay && actualPenalty > 0) {
      if (breaker && actualUpfront > 0) {
        breaker.gold = Math.max(0, breaker.gold - actualUpfront);
      }
      if (victim && actualUpfront > 0) {
        victim.gold += actualUpfront;
        if (victim.id === this.myCountryId) {
          this.progressQuest("GOLD", Math.round(actualUpfront));
        }
      }
      const breakerName = breaker ? breaker.name : "Devlet";
      const victimName = victim ? victim.name : "Devlet";
      if (actualDebt > 0) {
        this.onEvent(
          `⚠️ ${breakerName}, ${victimName} ile anlaşmasını ihlal etti! Kasadaki ${actualUpfront} Altın ödendi. Kalan ${actualDebt} Altın borç, ürettiği altınlardan tahsil edilecek!`,
        );
      } else {
        this.onEvent(
          ` ${breakerName}, ${victimName} ile olan anlaşmasını ihlal etti! (${actualUpfront} Altın tazminat)`,
        );
      }
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyReparationPayment(
    treatyId,
    amount = 0,
    remainingDebt = 0,
    time = 0,
    isReplay = false,
  ) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.remainingDebt = remainingDebt;
    treaty.paidDebt = (treaty.paidDebt || 0) + amount;

    if (!isReplay && amount > 0) {
      const creditor = this.countryMap.get(treaty.creditorId);
      if (creditor && creditor.id === this.myCountryId) {
        creditor.gold += amount;
        this.progressQuest("GOLD", Math.round(amount));
        this.onSound("cash");
        this.onEvent(
          `💰 ${treaty.debtorName || "Devlet"} tazminat borcuna istinaden size ${Math.round(amount)} Altın ödedi. (Kalan Borç: ${Math.round(remainingDebt)} Altın)`,
        );
      }
      const debtor = this.countryMap.get(treaty.debtorId);
      if (debtor && debtor.id !== this.myCountryId) {
        debtor.gold = Math.max(0, debtor.gold - amount);
      }
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  handleRemoteTreatyPayment(treatyId, amount = 0, time = 0, isReplay = false) {
    const treaty = this.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    treaty.lastPaymentTime = time || Date.now();

    if (!isReplay && amount > 0) {
      const payer = this.countryMap.get(treaty.tributePayerId);
      const receiver = this.countryMap.get(treaty.tributeReceiverId);
      if (payer && payer.id !== this.myCountryId) payer.gold = Math.max(0, payer.gold - amount);
      if (receiver && receiver.id === this.myCountryId) {
        receiver.gold += amount;
        this.onSound("cash");
        this.onEvent(` ${payer?.name || "Vasal"} size ${amount} Altın haraç ödedi.`);
      }
    }
    if (this.onTreatyUpdate) this.onTreatyUpdate();
  }

  // ===== ADMIN POWERS (AUTHORIZED BY ADMIN IP ONLY) =====
  adminGiveResources(countryId, troopsDelta = 50, goldDelta = 5000) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    if (goldDelta !== 0) {
      c.gold = Math.max(0, (c.gold || 0) + goldDelta);
    }
    if (troopsDelta !== 0) {
      c.troops = Math.max(0, Number(((c.troops || 0) + troopsDelta).toFixed(1)));
    }
    this._recalculateDerivedStats(c);
    this.saveState();
    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      isAdminOverride: true,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
      },
    });
    this.onSound("cash");
    this.onEvent(
      `[ADMIN] ${c.name}: ${troopsDelta >= 0 ? "+" : ""}${troopsDelta} Asker & ${goldDelta >= 0 ? "+" : ""}${goldDelta} Altın düzenlendi!`,
    );
    return { ok: true, country: c };
  }

  adminSetResources(countryId, exactTroops = null, exactGold = null) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    if (exactTroops !== null && !isNaN(exactTroops)) {
      c.troops = Math.max(0, Number(Number(exactTroops).toFixed(1)));
    }
    if (exactGold !== null && !isNaN(exactGold)) {
      c.gold = Math.max(0, Math.floor(Number(exactGold)));
    }
    this._recalculateDerivedStats(c);
    this.saveState();
    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      isAdminOverride: true,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
      },
    });
    this.onSound("cash");
    this.onEvent(`[ADMIN] ${c.name} kaynakları ayarlandı: ${Math.floor(c.troops)} Asker, ${Math.floor(c.gold).toLocaleString()} Altın`);
    return { ok: true, country: c };
  }

  adminGiveNuclear(countryId, count = 1) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    c.inventory = c.inventory || { nukes: 0 };
    c.inventory.nukes = Math.max(0, (c.inventory.nukes || 0) + count);
    this._persistCountryInventory(c);
    this.saveState();
    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      isAdminOverride: true,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
      },
    });
    this.onSound("celebration");
    this.onEvent(`[ADMIN] ${c.name} envanterine ${count >= 0 ? "+" : ""}${count} Taktik Nükleer Silah uygulandı! (Toplam: ${c.inventory.nukes})`);
    return { ok: true, nukes: c.inventory.nukes };
  }

  adminSetNuclear(countryId, exactCount = 0) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    c.inventory = c.inventory || { nukes: 0 };
    c.inventory.nukes = Math.max(0, Math.floor(Number(exactCount)));
    this._persistCountryInventory(c);
    this.saveState();
    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      isAdminOverride: true,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
      },
    });
    this.onSound("celebration");
    this.onEvent(`[ADMIN] ${c.name} nükleer stoğu ${c.inventory.nukes} yapıldı!`);
    return { ok: true, nukes: c.inventory.nukes };
  }

  adminClearRadiation(broadcast = true, clearedAt = null) {
    const total = MAP_W * MAP_H;
    let clearedCount = 0;
    if (this.isWasteland) {
      for (let i = 0; i < total; i++) {
        if (this.isWasteland[i]) {
          this.isWasteland[i] = 0;
          clearedCount++;
        }
      }
    }
    this.nuclearStrikes = [];
    this.nuclearMissiles = [];
    this.activeExplosions = [];
    // Havadaki füzeler temizlikten sonra patlayıp radyasyonu geri getirmesin
    this._radiationClearedAt = Number.isFinite(clearedAt) && clearedAt > 0 ? clearedAt : Date.now();
    this._persistNuclearStrikes();
    this.dirtyPixels = true;
    this.dirtyRegions = true;
    this.saveState();

    if (broadcast && this.sync) {
      this.sync.broadcast({ type: "ADMIN_CLEAR_RADIATION" });
      this.onSound("celebration");
      this.onEvent(`[ADMIN] Tüm nükleer radyasyon ve çorak araziler temizlendi! (${clearedCount} piksel rehabilite edildi)`);
    }
    return { ok: true, clearedCount };
  }

  adminGiveAllPlayersGold(goldAmount = 10000) {
    let count = 0;
    for (const c of this.countries) {
      if (c && c.landCount > 0) {
        c.gold = Math.max(0, (c.gold || 0) + goldAmount);
        count++;
        this.sync.broadcast({
          type: "SYNC_COUNTRY_STATS",
          countryId: c.id,
          isAdminOverride: true,
          stats: {
            troops: Number(c.troops.toFixed(1)),
            gold: Math.floor(c.gold),
            population: Math.floor(c.population),
            color: c.color,
            upgrades: c.upgrades,
            inventory: c.inventory,
          },
        });
      }
    }
    this.saveState();
    this.sync.sendChatMessage(` [SUNUCU ETKİNLİĞİ] Admin tüm aktif devletlere +${goldAmount.toLocaleString()} Altın hediye etti!`, true);
    this.onSound("cash");
    this.onEvent(`[ADMIN] Tüm ${count} devlete +${goldAmount.toLocaleString()} Altın dağıtıldı!`);
    return { ok: true, count };
  }

  adminGiveAllPlayersTroops(troopsAmount = 100) {
    let count = 0;
    for (const c of this.countries) {
      if (c && c.landCount > 0) {
        c.troops = Math.max(0, Number(((c.troops || 0) + troopsAmount).toFixed(1)));
        count++;
        this.sync.broadcast({
          type: "SYNC_COUNTRY_STATS",
          countryId: c.id,
          isAdminOverride: true,
          stats: {
            troops: Number(c.troops.toFixed(1)),
            gold: Math.floor(c.gold),
            population: Math.floor(c.population),
            color: c.color,
            upgrades: c.upgrades,
            inventory: c.inventory,
          },
        });
      }
    }
    this.saveState();
    this.sync.sendChatMessage(` [SUNUCU ETKİNLİĞİ] Admin tüm ordulara +${troopsAmount} Asker takviyesi yaptı!`, true);
    this.onSound("celebration");
    this.onEvent(`[ADMIN] Tüm ${count} devlete +${troopsAmount} Asker gönderildi!`);
    return { ok: true, count };
  }

  adminGiveAllPlayersNukes(nukesCount = 1) {
    let count = 0;
    for (const c of this.countries) {
      if (c && c.landCount > 0) {
        c.inventory = c.inventory || { nukes: 0 };
        c.inventory.nukes = Math.max(0, (c.inventory.nukes || 0) + nukesCount);
        this._persistCountryInventory(c);
        count++;
        this.sync.broadcast({
          type: "SYNC_COUNTRY_STATS",
          countryId: c.id,
          isAdminOverride: true,
          stats: {
            troops: Number(c.troops.toFixed(1)),
            gold: Math.floor(c.gold),
            population: Math.floor(c.population),
            color: c.color,
            upgrades: c.upgrades,
            inventory: c.inventory,
          },
        });
      }
    }
    this.saveState();
    this.sync.sendChatMessage(` [SUNUCU ETKİNLİĞİ] Admin tüm devletlere +${nukesCount} Taktik Nükleer Silah dağıttı!`, true);
    this.onSound("celebration");
    this.onEvent(`[ADMIN] Tüm ${count} devlete +${nukesCount} Nükleer Silah dağıtıldı!`);
    return { ok: true, count };
  }

  adminGiveSpecialTroops(countryId, amount = 50) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    const add = Math.floor(Number(amount) || 0);
    c.specialTroops = Math.max(0, (c.specialTroops || 0) + add);
    c.inventory = { ...(c.inventory || {}), specialTroops: c.specialTroops };
    if (c.id === this.myCountryId) this._persistCountryInventory(c);
    this.saveState();
    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      isAdminOverride: true,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
        inventory: c.inventory,
      },
    });
    this.onSound("celebration");
    this.onEvent(`[ADMIN] ${c.name} devletine ${add >= 0 ? "+" : ""}${add} Özel Asker (Muhafız) gönderildi! (Toplam: ${c.specialTroops})`);
    return { ok: true, specialTroops: c.specialTroops };
  }

  adminGiveAllPlayersSpecialTroops(amount = 50) {
    let count = 0;
    const add = Math.floor(Number(amount) || 0);
    for (const c of this.countries) {
      if (c && c.landCount > 0) {
        c.specialTroops = Math.max(0, (c.specialTroops || 0) + add);
        c.inventory = { ...(c.inventory || {}), specialTroops: c.specialTroops };
        if (c.id === this.myCountryId) this._persistCountryInventory(c);
        count++;
        this.sync.broadcast({
          type: "SYNC_COUNTRY_STATS",
          countryId: c.id,
          isAdminOverride: true,
          stats: {
            troops: Number(c.troops.toFixed(1)),
            gold: Math.floor(c.gold),
            population: Math.floor(c.population),
            color: c.color,
            upgrades: c.upgrades,
            inventory: c.inventory,
          },
        });
      }
    }
    this.saveState();
    this.sync.sendChatMessage(` [SUNUCU ETKİNLİĞİ] Admin tüm devletlere +${add} Özel Asker (Muhafız) gönderdi!`, true);
    this.onSound("celebration");
    this.onEvent(`[ADMIN] Tüm ${count} devlete +${add} Özel Asker gönderildi!`);
    return { ok: true, count };
  }

  adminBreakCountryTreaties(countryId, broadcast = true) {
    const c = this.countryMap.get(countryId);
    const beforeCount = (this.treaties || []).length;
    this.treaties = (this.treaties || []).filter((t) => t.fromId !== countryId && t.toId !== countryId);
    this.wars = (this.wars || []).filter((w) => w.fromId !== countryId && w.toId !== countryId);
    this.saveState();
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    if (broadcast && this.sync) {
      // Sadece bu devletin anlaşmalarını boz (eskiden herkesin anlaşmasını siliyordu)
      this.sync.broadcast({ type: "ADMIN_BREAK_COUNTRY_TREATIES", countryId });
      this.onEvent(`[ADMIN] ${c?.name || "Devlet"} devletinin tüm anlaşmaları ve savaşları bozuldu!`);
    }
    return { ok: true, removedCount: beforeCount - this.treaties.length };
  }

  adminAutoExpand(countryId, pixelsCount = 25) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Devlet bulunamadı." };
    const limit = Math.max(0, Math.min(5000, Math.floor(Number(pixelsCount) || 0)));
    if (limit === 0) return { ok: false, reason: "Geçersiz piksel sayısı." };

    // Asker harcamadan, sınıra komşu boş (sahipsiz, radyasyonsuz) karaları BFS ile ekle
    const total = MAP_W * MAP_H;
    const queue = [];
    const seen = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      if (this.owners[i] === countryId) {
        queue.push(i);
        seen[i] = 1;
      }
    }
    const pts = [];
    let head = 0;
    while (head < queue.length && pts.length < limit) {
      const idx = queue[head++];
      const x = idx % MAP_W;
      const y = (idx / MAP_W) | 0;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < MAP_W - 1 ? idx + 1 : -1,
        y > 0 ? idx - MAP_W : -1,
        y < MAP_H - 1 ? idx + MAP_W : -1,
      ];
      for (const n of neighbors) {
        if (n < 0 || seen[n]) continue;
        seen[n] = 1;
        if (!this.worldData.isLand[n] || this.isWasteland[n] || this.owners[n] !== 0) continue;
        this.owners[n] = countryId;
        c.landCount++;
        c.population += 3;
        const nx = n % MAP_W;
        const ny = (n / MAP_W) | 0;
        this._expandCountryBound(countryId, nx, ny);
        pts.push(nx, ny);
        queue.push(n);
        if (pts.length / 2 >= limit) break;
      }
    }

    const conquered = pts.length / 2;
    this._recalculateDerivedStats(c);
    this.dirtyPixels = true;
    this.dirtyRegions = true;
    this.saveState();

    // ntfy 4KB limitini aşmamak için parça parça gönder
    if (this.sync) {
      for (let i = 0; i < pts.length; i += 400) {
        this.sync.broadcast({ type: "CONQUER_BATCH", countryId, pts: pts.slice(i, i + 400) });
      }
    }

    this.onSound("pencil");
    this.onEvent(`[ADMIN] ${c.name} devletinin sınırları +${conquered} boş piksel otomatik genişletildi!`);
    return { ok: true, conquered };
  }

  adminResetTreaties(broadcast = true) {
    this.treaties = [];
    this.wars = [];
    this.saveState();
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    if (broadcast && this.sync) {
      this.sync.broadcast({ type: "ADMIN_RESET_TREATIES" });
      this.sync.sendChatMessage(` [BARIŞ İLANI] Admin tüm diplomatik savaşları ve anlaşmaları sıfırladı. Tüm devletler barışa kavuştu!`, true);
      this.onEvent(`[ADMIN] Tüm anlaşmalar ve savaşlar sıfırlandı!`);
    }
    return { ok: true };
  }

  adminMaxUpgrades(countryId) {
    const c = this.countryMap.get(countryId);
    if (!c) return { ok: false, reason: "Önce haritada bir devletin olmalı." };
    for (const def of UPGRADE_DEFINITIONS) {
      c.upgrades[def.key] = def.maxLevel;
    }
    this._recalculateDerivedStats(c);
    this.saveState();
    this.sync.broadcast({
      type: "SYNC_COUNTRY_STATS",
      countryId: c.id,
      isAdminOverride: true,
      stats: {
        troops: Number(c.troops.toFixed(1)),
        gold: Math.floor(c.gold),
        population: Math.floor(c.population),
        color: c.color,
        upgrades: c.upgrades,
      },
    });
    this.onSound("celebration");
    this.onEvent("[ADMIN] Tüm geliştirmeler Maksimum Sv.25 yapıldı!");
    return { ok: true };
  }

  adminDeleteCountry(countryId, broadcast = true) {
    const c = this.countryMap.get(countryId);
    const total = MAP_W * MAP_H;
    for (let i = 0; i < total; i++) {
      if (this.owners[i] === countryId) {
        this.owners[i] = 0;
      }
    }
    this.countries = this.countries.filter((x) => x.id !== countryId);
    this.countryMap.delete(countryId);
    this.ships = this.ships.filter((s) => s.countryId !== countryId);
    if (this.myCountryId === countryId) {
      this.myCountryId = null;
      saveMyCountryId(null);
    }
    this.computeCountryBounds();
    this.dirtyRegions = false;
    this.dirtyPixels = true;
    this.treaties = (this.treaties || []).filter((t) => t.fromId !== countryId && t.toId !== countryId);
    this.saveState();
    if (this.onTreatyUpdate) this.onTreatyUpdate();

    if (broadcast && this.sync) {
      this.sync.broadcast({
        type: "ADMIN_DELETE_COUNTRY",
        countryId,
      });
      this.onEvent(`[ADMIN] ${c?.name || "Devlet"} haritadan silindi!`);
    }
  }

  adminClearChat(broadcast = true) {
    this.chatMessages = [];
    this.onChat([]);
    if (broadcast && this.sync) {
      this.sync.broadcast({ type: "ADMIN_CLEAR_CHAT" });
      this.onEvent("[ADMIN] Global Sohbet temizlendi!");
    }
  }

  adminResetWorld(broadcast = true, clearIdentity = true) {
    const total = MAP_W * MAP_H;
    for (let i = 0; i < total; i++) {
      this.owners[i] = this.worldData.isLand[i] ? 0 : -1;
    }
    if (this.isWasteland) this.isWasteland.fill(0);
    this.nuclearStrikes = [];
    this.nuclearMissiles = [];
    this.activeExplosions = [];
    this._radiationClearedAt = Date.now();
    this._persistNuclearStrikes();
    this.treaties = [];
    this.wars = [];
    if (this.onTreatyUpdate) this.onTreatyUpdate();
    this.countries = [];
    this.countryMap.clear();
    this.ships = [];
    this.chatMessages = [];
    this.undoStack = [];
    this.myCountryId = null;
    if (clearIdentity) saveMyCountryId(null);
    this.computeCountryBounds();
    this.dirtyRegions = false;
    this.dirtyPixels = true;
    this.onChat([]);
    this.saveState();

    if (typeof localStorage !== "undefined") {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith("sf_inventory_") ||
              k.startsWith("sf_quests_") ||
              k.startsWith("sf_streak_") ||
              k.startsWith("sf_last_active_") ||
              k === "sf_my_country_flag")
          ) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) localStorage.removeItem(k);
      } catch {}
    }

    if (broadcast && this.sync) {
      this.sync.broadcast({ type: "ADMIN_RESET_WORLD" });
      this.onEvent("[ADMIN] Tüm Dünya Haritası sıfırlandı!");
    }
  }

  // Export compact world snapshot for cross-device WebRTC synchronization (Phone <-> PC)
  exportSnapshot() {
    try {
      const total = MAP_W * MAP_H;
      const rle = [];
      let cur = this.owners[0];
      let len = 1;
      for (let i = 1; i < total; i++) {
        const v = this.owners[i];
        if (v === cur && len < 65535) {
          len++;
        } else {
          rle.push(cur, len);
          cur = v;
          len = 1;
        }
      }
      rle.push(cur, len);

      return {
        v: 9,
        countries: this.countries.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          flagDataUrl: c.flagDataUrl,
          capitalX: c.capitalX,
          capitalY: c.capitalY,
          creatorIp: c.creatorIp,
          deviceId: c.deviceId,
          troops: c.troops,
          landCount: c.landCount,
          population: c.population,
          gold: c.gold,
          upgrades: c.upgrades,
          createdAt: c.createdAt,
        })),
        rle,
      };
    } catch {
      return null;
    }
  }

  // Merge remote device's world snapshot into local shared world (Phone <-> PC)
  mergeRemoteSnapshot(data) {
    if (!data || !Array.isArray(data.countries) || !Array.isArray(data.rle))
      return;

    let changed = false;

    for (const rc of data.countries) {
      if (!rc || !rc.id) continue;
      const existing = this.countryMap.get(rc.id);
      if (!existing) {
        const country = this._normalizeCountry({ ...rc });
        if (rc.flagDataUrl) {
          loadDataUrlToFlagBuffer(rc.flagDataUrl)
            .then((res) => {
              country.flagRgba = res.rgba;
              this.dirtyPixels = true;
            })
            .catch(() => {});
        }
        this.countries.push(country);
        this.countryMap.set(country.id, country);
        if (rc.deviceId === this.myDeviceId && !this.myCountryId) {
          this.myCountryId = country.id;
          saveMyCountryId(country.id);
        }
        changed = true;
      } else {
        // Merge upgrades if remote has higher upgrade levels
        if (rc.upgrades) {
          for (const k of Object.keys(DEFAULT_UPGRADES)) {
            if ((rc.upgrades[k] || 0) > (existing.upgrades[k] || 0)) {
              existing.upgrades[k] = rc.upgrades[k];
              changed = true;
            }
          }
        }
      }
    }

    // Merge claimed pixels from remote RLE
    const total = MAP_W * MAP_H;
    let ptr = 0;
    for (let i = 0; i < data.rle.length; i += 2) {
      const val = data.rle[i];
      const count = data.rle[i + 1];
      for (let k = 0; k < count && ptr < total; k++) {
        if (val > 0 && this.worldData.isLand[ptr] && this.countryMap.has(val)) {
          if (this.owners[ptr] === 0) {
            this.owners[ptr] = val;
            changed = true;
          }
        }
        ptr++;
      }
    }

    if (changed) {
      // Recount land per country accurately
      const landCounts = new Map();
      for (let i = 0; i < total; i++) {
        const o = this.owners[i];
        if (o > 0) {
          landCounts.set(o, (landCounts.get(o) || 0) + 1);
        }
      }
      for (const c of this.countries) {
        c.landCount = landCounts.get(c.id) || 0;
        this._recalculateDerivedStats(c);
      }

      this.dirtyPixels = true;
      this.dirtyRegions = true;
      this.saveState();
    }
  }

  computeCountryBounds() {
    const bounds = new Map();
    for (const c of this.countries) {
      bounds.set(c.id, {
        minX: MAP_W,
        minY: MAP_H,
        maxX: 0,
        maxY: 0,
        count: 0,
        sumX: 0,
        sumY: 0,
      });
    }

    for (let y = 0; y < MAP_H; y++) {
      const row = y * MAP_W;
      for (let x = 0; x < MAP_W; x++) {
        const o = this.owners[row + x];
        if (o <= 0) continue;
        const b = bounds.get(o);
        if (b) {
          if (x < b.minX) b.minX = x;
          if (x > b.maxX) b.maxX = x;
          if (y < b.minY) b.minY = y;
          if (y > b.maxY) b.maxY = y;
          b.count++;
          b.sumX += x;
          b.sumY += y;
        }
      }
    }

    this.countryBounds = bounds;
    this.dirtyRegions = false;

    // Synchronize landCount with actual pixel count and prune 0-pixel ghost countries
    let hasZeroLand = false;
    for (const c of this.countries) {
      const b = bounds.get(c.id);
      const cnt = b ? b.count : 0;
      c.landCount = cnt;
      if (cnt === 0) hasZeroLand = true;
    }
    if (hasZeroLand) {
      this.cleanupInactiveCountries();
    }

    return bounds;
  }

  // Authoritative State persistence: keeps local copy in sync with server state
  saveState() {
    this._saveLocalWorldBackup();
  }

  loadState() {
    this._loadLocalWorldBackup();
    return true;
  }
}
