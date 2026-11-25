import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WorldSimulationEngine,
  POP_SUPPORT_TIERS,
  getPopSupportCost,
} from '../src/world/worldEngine.js';
import { SharedWorldSync } from '../src/world/sharedWorldSync.js';

function createMockEngine() {
  const worldData = { isLand: new Uint8Array(1000 * 500) };
  const engine = new WorldSimulationEngine(worldData);
  engine.sync = { broadcast: () => {} };
  return engine;
}

test('treaty break with insufficient gold creates reparation debt and diverts production', () => {
  const engine = createMockEngine();

  // Setup Country 1 (Breaker) and Country 2 (Victim)
  const c1 = {
    id: 1,
    name: 'Breakerland',
    gold: 200,
    goldIncome: 10,
    landCount: 10,
    population: 100,
    maxPopulation: 1000,
    popGrowthRate: 0.1,
    troops: 20,
    capacity: 20,
    upgrades: {},
  };
  const c2 = {
    id: 2,
    name: 'Victimland',
    gold: 50,
    goldIncome: 5,
    landCount: 10,
    population: 100,
    maxPopulation: 1000,
    popGrowthRate: 0.1,
    troops: 20,
    capacity: 20,
    upgrades: {},
  };

  engine.countries = [c1, c2];
  engine.countryMap.set(1, c1);
  engine.countryMap.set(2, c2);
  engine.myCountryId = 1;

  // Active alliance treaty with 205 gold penalty (200 in treasury, 5 debt)
  const treaty = {
    id: 'tr_test_1',
    fromId: 1,
    toId: 2,
    fromName: 'Breakerland',
    toName: 'Victimland',
    type: 'ALLIANCE',
    penalty: 205,
    status: 'ACTIVE',
  };
  engine.treaties = [treaty];

  // 1. Break the treaty
  const res = engine.breakTreaty(treaty.id, 1, 'SALDIRI');
  assert.equal(res.ok, true);
  assert.equal(res.deducted, 200, 'All 200 upfront gold must be paid');
  assert.equal(res.debt, 5, 'Remaining debt must be 5');
  assert.equal(c1.gold, 0, 'Breaker gold must drop to 0');
  assert.equal(c2.gold, 250, 'Victim receives upfront 200 gold (50 + 200)');
  assert.equal(treaty.status, 'BROKEN');
  assert.equal(treaty.remainingDebt, 5);

  // 2. Simulate gold production ticks for Country 1
  engine.update(1.0);
  assert.equal(c1.gold, 0, 'Breaker must keep 0 gold while in debt');
  assert.equal(treaty.remainingDebt < 5, true, 'Debt should decrease as income is diverted');

  // Simulate enough ticks to completely clear the 5 gold debt
  while (treaty.remainingDebt > 0.05) {
    engine.update(1.0);
  }
  assert.equal(treaty.remainingDebt <= 0.05, true, 'Debt should be fully paid off');
  assert.equal(engine.getActiveReparationDebts(1).length, 0, 'No active debts remaining');

  // 3. Next tick after debt is cleared: breaker now keeps their own gold income
  const goldBefore = c1.gold;
  engine.update(1.0);
  assert.equal(c1.gold > goldBefore, true, 'Breaker now accumulates their own gold again');
});

test('creditor receives quest progression on reparation payment, debtor does not', () => {
  const engine = createMockEngine();

  const c2 = {
    id: 2,
    name: 'Victimland',
    gold: 0,
    landCount: 10,
    population: 100,
    maxPopulation: 1000,
    popGrowthRate: 0.1,
    troops: 20,
    capacity: 20,
    upgrades: {},
  };
  engine.countries = [c2];
  engine.countryMap.set(2, c2);
  engine.myCountryId = 2; // I am the creditor/victim

  // Initialize quests for creditor
  const quests = engine.getQuests();
  const goldQuest = quests.find((q) => q.type === 'GOLD');
  const initialQuestProgress = goldQuest ? goldQuest.current : 0;

  const treaty = {
    id: 'tr_test_2',
    fromId: 1,
    toId: 2,
    debtorId: 1,
    creditorId: 2,
    debtorName: 'Breakerland',
    creditorName: 'Victimland',
    totalDebt: 500,
    paidDebt: 0,
    remainingDebt: 500,
    status: 'BROKEN',
  };
  engine.treaties = [treaty];

  // Receive remote reparation payment of 150 gold
  engine.handleRemoteTreatyReparationPayment(treaty.id, 150, 350, Date.now(), false);

  assert.equal(c2.gold, 150, 'Creditor gold must increase by 150');
  assert.equal(treaty.remainingDebt, 350, 'Remaining debt must update to 350');
  if (goldQuest) {
    assert.equal(goldQuest.current, initialQuestProgress + 150, 'Creditor GOLD quest must progress by 150');
  }
});

test('both parties in a TRIBUTE treaty are protected; attacking breaks treaty and pays penalty', () => {
  const engine = createMockEngine();

  const overlord = {
    id: 10,
    name: 'Overlord',
    gold: 300,
    landCount: 10,
    troops: 50,
    upgrades: {},
  };
  const vassal = {
    id: 20,
    name: 'Vassal',
    gold: 50,
    landCount: 10,
    troops: 50,
    upgrades: {},
  };

  engine.countries = [overlord, vassal];
  engine.countryMap.set(10, overlord);
  engine.countryMap.set(20, vassal);

  const tributeTreaty = {
    id: 'tr_tribute_1',
    fromId: 10,
    toId: 20,
    tributeReceiverId: 10,
    tributePayerId: 20,
    type: 'TRIBUTE',
    penalty: 500,
    status: 'ACTIVE',
  };
  engine.treaties = [tributeTreaty];

  // 1. Check canExpandToPixel from Overlord towards Vassal
  // Place vassal land at (50, 50) and make it habitable
  engine.worldData.isLand[50 * 1000 + 50] = 1;
  engine.owners[50 * 1000 + 50] = 20;

  const check1 = engine.canExpandToPixel(10, 50, 50);
  assert.equal(check1.valid, false);
  assert.equal(check1.isTreatyViolation, true);
  assert.equal(check1.treaty.id, 'tr_tribute_1');

  // 2. Overlord attacks Vassal: breaks treaty and pays penalty to Vassal
  const res = engine.breakTreaty('tr_tribute_1', 10, 'SALDIRI');
  assert.equal(res.ok, true);
  assert.equal(res.deducted, 300);
  assert.equal(res.debt, 200);
  assert.equal(vassal.gold, 350, 'Vassal receives 300 penalty gold');
  assert.equal(overlord.gold, 0);
  assert.equal(tributeTreaty.status, 'BROKEN');
});

test('naval landing on treaty partner shore breaks treaty and pays penalty', () => {
  const engine = createMockEngine();

  const c1 = { id: 1, name: 'Attacker', gold: 100, landCount: 5, troops: 50, upgrades: {} };
  const c2 = { id: 2, name: 'Ally', gold: 0, landCount: 5, troops: 50, upgrades: {} };
  engine.countries = [c1, c2];
  engine.countryMap.set(1, c1);
  engine.countryMap.set(2, c2);

  const alliance = {
    id: 'tr_naval_1',
    fromId: 1,
    toId: 2,
    type: 'ALLIANCE',
    penalty: 400,
    status: 'ACTIVE',
  };
  engine.treaties = [alliance];

  // Target shore owned by Ally
  const shoreIdx = 30 * 1000 + 30;
  engine.worldData.isLand[shoreIdx] = 1;
  engine.owners[shoreIdx] = 2;

  const ship = {
    id: 'ship_test',
    countryId: 1,
    toX: 30,
    toY: 30,
  };

  engine._completeNavalLanding(ship);

  assert.equal(alliance.status, 'BROKEN', 'Alliance must be broken on landing');
  assert.equal(c1.gold, 0, 'Attacker pays 100 upfront gold');
  assert.equal(c2.gold, 100, 'Ally receives 100 upfront gold');
  assert.equal(alliance.remainingDebt, 300, 'Remaining debt must be 300');
});

test('nuclear strike hitting treaty partner territory breaks treaty and pays penalty', () => {
  const engine = createMockEngine();

  const c1 = { id: 1, name: 'NuclearState', gold: 150, landCount: 10, troops: 50, upgrades: {} };
  const c2 = { id: 2, name: 'VictimAlly', gold: 10, landCount: 10, troops: 50, upgrades: {} };
  engine.countries = [c1, c2];
  engine.countryMap.set(1, c1);
  engine.countryMap.set(2, c2);

  const alliance = {
    id: 'tr_nuke_1',
    fromId: 1,
    toId: 2,
    type: 'ALLIANCE',
    penalty: 600,
    status: 'ACTIVE',
  };
  engine.treaties = [alliance];

  // Set ally land within blast radius
  const blastCenterIdx = 100 * 1000 + 100;
  engine.worldData.isLand[blastCenterIdx] = 1;
  engine.owners[blastCenterIdx] = 2;

  const strike = {
    id: 'strike_test_1',
    attackerId: 1,
    attackerName: 'NuclearState',
    x: 100,
    y: 100,
    radius: 10,
    time: Date.now(),
  };

  engine._detonateNuclearStrike(strike, false);

  assert.equal(alliance.status, 'BROKEN', 'Treaty must be broken on nuke blast');
  assert.equal(c1.gold, 0, 'NuclearState pays 150 upfront gold');
  assert.equal(c2.gold, 160, 'VictimAlly receives 150 upfront gold (10 + 150)');
  assert.equal(alliance.remainingDebt, 450, 'Remaining debt must be 450');
});

test('population growth rate is >= 1/sec, faster for small & rapidly growing states, and +50% with Market support', () => {
  const engine = createMockEngine();
  const smallState = {
    id: 1,
    name: 'SmallState',
    gold: 50000,
    landCount: 15,
    population: 1000,
    upgrades: {},
  };
  const largeState = {
    id: 2,
    name: 'LargeState',
    gold: 50000,
    landCount: 500,
    population: 9000,
    upgrades: {},
  };
  engine.countries = [smallState, largeState];
  engine.countryMap.set(1, smallState);
  engine.countryMap.set(2, largeState);
  engine.myCountryId = 1;

  engine._recalculateDerivedStats(smallState);
  engine._recalculateDerivedStats(largeState);

  assert.equal(smallState.popGrowthRate >= 1.0, true, 'Base pop growth must be >= 1/sec');
  assert.equal(largeState.popGrowthRate >= 1.0, true, 'Large state pop growth must be >= 1/sec');
  assert.equal(smallState.popGrowthRate > largeState.popGrowthRate, true, 'Small state gets catch-up speed bonus');

  // Rapid growth momentum bonus
  const beforeMomentum = smallState.popGrowthRate;
  engine._recordConquestMomentum(smallState, 10);
  engine._recalculateDerivedStats(smallState);
  assert.equal(smallState.popGrowthRate > beforeMomentum * 1.4, true, 'Rapidly conquering state grows faster');

  // Market Population Support pricing scales with population (1k = 1x, 9k = 9x)
  const tier5m = POP_SUPPORT_TIERS.find((t) => t.key === '5m');
  const tier10m = POP_SUPPORT_TIERS.find((t) => t.key === '10m');
  assert.equal(getPopSupportCost(1000, tier5m.baseCost), 1000);
  assert.equal(getPopSupportCost(1000, tier10m.baseCost), 1900);
  assert.equal(getPopSupportCost(9000, tier5m.baseCost), 9000);
  assert.equal(getPopSupportCost(9000, tier10m.baseCost), 17100);

  // Buying Population Support boosts popGrowthRate by +50%
  const rateBeforeBoost = smallState.popGrowthRate;
  const buyRes = engine.buyPopulationSupport(1, '5m');
  assert.equal(buyRes.ok, true);
  assert.equal(buyRes.cost, 1000);
  assert.equal(smallState.popBoostActive, true);
  assert.ok(Math.abs(smallState.popGrowthRate - rateBeforeBoost * 1.5) < 0.01, 'Support boost must give exact +50% speed');
});

test('remote neutral-pixel race does not trigger false attack alert or break treaty; genuine attack does', () => {
  let attackAlerts = 0;
  const worldData = { isLand: new Uint8Array(1000 * 500) };
  const engine = new WorldSimulationEngine(worldData, {
    onUnderAttack: () => {
      attackAlerts++;
    },
  });
  engine.sync = { broadcast: () => {} };

  const me = { id: 1, name: 'Me', gold: 100, landCount: 10, troops: 20, upgrades: {} };
  const friend = { id: 2, name: 'Friend', gold: 500, landCount: 10, troops: 20, upgrades: {} };
  engine.countries = [me, friend];
  engine.countryMap.set(1, me);
  engine.countryMap.set(2, friend);
  engine.myCountryId = 1;

  const alliance = {
    id: 'tr_friend_1',
    fromId: 1,
    toId: 2,
    type: 'ALLIANCE',
    penalty: 1000,
    status: 'ACTIVE',
  };
  engine.treaties = [alliance];

  const idx = 40 * 1000 + 40;
  engine.worldData.isLand[idx] = 1;
  engine.owners[idx] = 1; // I just conquered this pixel

  // 1. Simultaneous neutral click race (wasEnemy === false) -> ignored, NO false alert, treaty stays ACTIVE!
  engine.handleRemoteConquerPixel(2, 40, 40, 1, false, false);
  assert.equal(engine.owners[idx], 1, 'Ally neutral-pixel race must not overwrite my pixel');
  assert.equal(attackAlerts, 0, 'Must not trigger false attack notification');
  assert.equal(alliance.status, 'ACTIVE', 'Treaty must remain active');

  // 2. Genuine enemy attack (wasEnemy === true) -> breaks treaty, pays upfront gold + debt, triggers alert!
  engine.handleRemoteConquerPixel(2, 40, 40, 1, false, true);
  assert.equal(alliance.status, 'BROKEN', 'Genuine attack must break treaty');
  assert.equal(me.gold, 600, 'Victim receives friend upfront 500 gold (100 + 500)');
  assert.equal(alliance.remainingDebt, 500, 'Remaining 500 debt recorded');
  assert.equal(attackAlerts, 1, 'Genuine attack triggers attack notification');
});

test('auto-conquer rotates evenly across multiple disconnected territories/colonies', () => {
  const engine = createMockEngine();
  const c1 = {
    id: 1,
    name: 'Empire',
    gold: 1000,
    landCount: 2,
    troops: 100,
    capacity: 100,
    upgrades: {},
  };
  engine.countries = [c1];
  engine.countryMap.set(1, c1);
  engine.myCountryId = 1;

  // Create two separate continents far apart: Region A around (50,50), Region B around (300,300)
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const idxA = (50 + dy) * 1000 + (50 + dx);
      const idxB = (300 + dy) * 1000 + (300 + dx);
      engine.worldData.isLand[idxA] = 1;
      engine.owners[idxA] = 0;
      engine.worldData.isLand[idxB] = 1;
      engine.owners[idxB] = 0;
    }
  }
  engine.owners[50 * 1000 + 50] = 1;
  engine.owners[300 * 1000 + 300] = 1;
  engine.computeCountryBounds();

  // Run 4 auto-conquer ticks -> both Region A and Region B must grow!
  for (let i = 0; i < 4; i++) {
    const res = engine.conquerNextBorderPixel(1, true);
    assert.equal(res.ok, true);
  }

  let regionACount = 0;
  let regionBCount = 0;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (engine.owners[(50 + dy) * 1000 + (50 + dx)] === 1) regionACount++;
      if (engine.owners[(300 + dy) * 1000 + (300 + dx)] === 1) regionBCount++;
    }
  }

  assert.equal(regionACount > 1, true, 'Region A must expand via auto-conquer');
  assert.equal(regionBCount > 1, true, 'Region B must also expand via auto-conquer');
});

test('CF Worker INIT_STATE and live delta updates preserve countries, conquests, and stats', () => {
  const engine = createMockEngine();
  // Mark test land area as habitable
  for (let x = 20; x <= 30; x++) {
    engine.worldData.isLand[20 * 1000 + x] = 1;
    engine.owners[20 * 1000 + x] = 0;
  }

  // Create SharedWorldSync without opening live WebSocket connections
  const sync = Object.create(SharedWorldSync.prototype);
  sync.engine = engine;
  sync.seenMsgIds = new Set();
  sync.onRemoteUpdate = () => {};
  sync.tabId = 'test_tab';

  // Authoritative INIT_STATE from Cloudflare Durable Object
  sync._applyInitState({
    type: 'INIT_STATE',
    serverTime: 2000,
    onlineCount: 2,
    countries: [
      {
        country: { id: 10, name: 'OlderState', color: '#EF4444', capitalX: 20, capitalY: 20, gold: 50, troops: 5 },
        rle: [20, 20, 1],
        updatedAt: 1000,
      },
      {
        country: { id: 20, name: 'NewerState', color: '#22C55E', capitalX: 22.4, capitalY: 20.1, gold: 100, troops: 10 },
        rle: [20, 21, 2],
        updatedAt: 2000,
      },
    ],
    chats: [],
    treaties: [],
    nuclearStrikes: [],
  });

  // Live delta messages arriving over WebSocket
  sync._handleRemoteMessage({ type: 'CONQUER_PIXEL', countryId: 20, x: 23, y: 20, cost: 1, _sentAt: 2500 }, false);
  sync._handleRemoteMessage({ type: 'SYNC_COUNTRY_STATS', countryId: 20, stats: { gold: 999, troops: 15 }, _sentAt: 2600 }, false);

  assert.equal(engine.countryMap.has(10), true, 'OlderState must be visible');
  assert.equal(engine.countryMap.has(20), true, 'NewerState (with float capital) must be visible');
  assert.equal(engine.owners[20 * 1000 + 21], 20, 'Authoritative RLE must assign (21,20) to Country 20');
  assert.equal(engine.owners[20 * 1000 + 23], 20, 'Live CONQUER_PIXEL delta must be applied');
  assert.equal(engine.countryMap.get(20).gold, 999, 'Live SYNC_COUNTRY_STATS delta must be applied');
});

test('narrow isthmus/corridor bounded by sea or owned territory allows linear expansion', () => {
  const engine = createMockEngine();
  const cid = 10;
  engine.countryMap.set(cid, {
    id: cid,
    name: 'IsthmusNation',
    color: '#3B82F6',
    landCount: 15,
  });

  // Setup a 1-pixel wide peninsula/bridge along row y=50 from x=10 to x=15
  // y=49 and y=51 are sea (water = 0)
  for (let x = 10; x <= 15; x++) {
    engine.worldData.isLand[50 * 1000 + x] = 1;
  }
  // Country already owns (10,50), (11,50), (12,50)
  engine.owners[50 * 1000 + 10] = cid;
  engine.owners[50 * 1000 + 11] = cid;
  engine.owners[50 * 1000 + 12] = cid;

  // Expanding to (13,50): sağı ve solu su (y=49 ve y=51 deniz)
  // Bu yüzden zorunlu koridordur ve snaking sayılmamalıdır!
  const isSnake = engine.isSnakingConquest(cid, 13, 50);
  assert.equal(isSnake, false, 'Narrow isthmus with sea on flanks must NOT be blocked as snaking');
});
