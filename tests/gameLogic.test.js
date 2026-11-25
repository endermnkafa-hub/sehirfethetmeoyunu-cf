import test from 'node:test';
import assert from 'node:assert/strict';
import { canBuildWallOnCell, validateTurnPlacementPlan } from '../src/utils/gameLogic.js';

function createBoard(size = 30) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  grid[Math.floor(size / 2)][Math.floor(size / 2)] = 1;
  return grid;
}

const activeId = 1;
const center = 15;

test('accepts a legal adjacent conquest and derives ownership from the board', () => {
  const grid = createBoard();
  const plan = validateTurnPlacementPlan(grid, activeId, [
    { x: center + 1, y: center, cost: 1, playerId: activeId, previousOwner: 0 },
  ], [], {}, [], 1);

  assert.equal(plan.valid, true);
  assert.equal(plan.spent, 1);
  assert.equal(plan.pendingCells[0].previousOwner, 0);
  assert.equal(plan.pendingCells[0].playerId, activeId);
});

test('rejects out-of-bounds and fractional remote coordinates before mutation', () => {
  const grid = createBoard();
  for (const cell of [
    { x: -1, y: center, cost: 1, playerId: activeId },
    { x: center + 0.5, y: center, cost: 1, playerId: activeId },
    { x: 30, y: center, cost: 1, playerId: activeId },
  ]) {
    const plan = validateTurnPlacementPlan(grid, activeId, [cell], [], {}, [], 3);
    assert.equal(plan.valid, false);
  }
});

test('rejects non-adjacent, duplicate, and forged-player cells', () => {
  const grid = createBoard();
  const farCell = { x: 2, y: 2, cost: 1, playerId: activeId };
  assert.equal(validateTurnPlacementPlan(grid, activeId, [farCell], [], {}, [], 3).valid, false);

  const adjacent = { x: center + 1, y: center, cost: 1, playerId: activeId };
  assert.equal(validateTurnPlacementPlan(grid, activeId, [adjacent, adjacent], [], {}, [], 3).valid, false);
  assert.equal(validateTurnPlacementPlan(grid, activeId, [{ ...adjacent, playerId: 2 }], [], {}, [], 3).valid, false);
});

test('rejects costs above the turn budget and invalid normal-cell costs', () => {
  const grid = createBoard();
  const cell = { x: center + 1, y: center, playerId: activeId, cost: 2 };
  assert.equal(validateTurnPlacementPlan(grid, activeId, [cell], [], {}, [], 1).valid, false);
  assert.equal(validateTurnPlacementPlan(grid, activeId, [{ ...cell, cost: 1.5 }], [], {}, [], 3).valid, false);
});

test('accepts a wall breach only when the target is an enemy-owned walled cell', () => {
  const grid = createBoard();
  grid[center][center + 1] = 2;
  const walls = { [`${center + 1},${center}`]: true };
  const plan = validateTurnPlacementPlan(grid, activeId, [
    { x: center + 1, y: center, cost: 1, playerId: activeId, previousOwner: 2, targetOwner: 2, isWallBreachOnly: true },
  ], [], walls, [], 1);

  assert.equal(plan.valid, true);
  assert.equal(plan.walls[`${center + 1},${center}`], undefined);
  assert.equal(validateTurnPlacementPlan(grid, activeId, [
    { x: center + 1, y: center, cost: 1, playerId: activeId, isWallBreachOnly: true },
  ], [], {}, [], 1).valid, false);
});

test('accepts the second stage of a wall breach as a two-point demolition', () => {
  const grid = createBoard();
  grid[center][center + 1] = 2;
  const wallKey = `${center + 1},${center}`;
  const walls = { [wallKey]: true };

  const firstStage = validateTurnPlacementPlan(grid, activeId, [
    { x: center + 1, y: center, cost: 1, playerId: activeId, previousOwner: 2, targetOwner: 2, isWallBreachOnly: true },
  ], [], walls, [], 1);
  assert.equal(firstStage.valid, true);
  assert.equal(firstStage.walls[wallKey], undefined);

  const secondStage = validateTurnPlacementPlan(grid, activeId, [
    {
      x: center + 1, y: center, cost: 2, playerId: activeId,
      previousOwner: 2, targetOwner: 2,
      isWallDemolished: true, wasBreachedThisTurn: true,
    },
  ], [], walls, [], 2);
  assert.equal(secondStage.valid, true);
  assert.equal(secondStage.walls[wallKey], undefined);
});

test('accepts a two-point wall conquest and rejects forged destruction of a non-wall', () => {
  const grid = createBoard();
  grid[center][center + 1] = 2;
  const wallKey = `${center + 1},${center}`;
  const cell = {
    x: center + 1, y: center, cost: 2, playerId: activeId,
    previousOwner: 2, targetOwner: 2, isWallDemolished: true,
  };
  const plan = validateTurnPlacementPlan(grid, activeId, [cell], [], { [wallKey]: true }, [], 2);
  assert.equal(plan.valid, true);
  assert.equal(plan.walls[wallKey], undefined);
  assert.equal(validateTurnPlacementPlan(grid, activeId, [cell], [], {}, [], 2).valid, false);
});

test('allows a subsequent move adjacent to a previously accepted pending cell', () => {
  const grid = createBoard();
  const plan = validateTurnPlacementPlan(grid, activeId, [
    { x: center + 1, y: center, cost: 1, playerId: activeId, previousOwner: 0 },
    { x: center + 2, y: center, cost: 1, playerId: activeId, previousOwner: 0 },
  ], [], {}, [], 2);
  assert.equal(plan.valid, true);
  assert.equal(plan.spent, 2);
});

test('rejects stale ownership claims and malformed board shapes', () => {
  const grid = createBoard();
  const cell = { x: center + 1, y: center, cost: 1, playerId: activeId, previousOwner: 7 };
  assert.equal(validateTurnPlacementPlan(grid, activeId, [cell], [], {}, [], 1).valid, false);
  assert.equal(validateTurnPlacementPlan([[0, 0], [0]], activeId, [], [], {}, [], 2).valid, false);
});

test('wall placement rejects out-of-bounds coordinates without throwing', () => {
  const grid = createBoard();
  assert.equal(canBuildWallOnCell(grid, activeId, -1, center).valid, false);
  assert.equal(canBuildWallOnCell(grid, activeId, center, 30).valid, false);
});

test('validates pending wall construction against the committed board and turn budget', () => {
  const grid = createBoard();
  const plan = validateTurnPlacementPlan(grid, activeId, [], [
    { x: center, y: center },
  ], {}, [], 1);
  assert.equal(plan.valid, true);
  assert.equal(plan.walls[`${center},${center}`], true);
  assert.equal(validateTurnPlacementPlan(grid, activeId, [], [
    { x: center, y: center }, { x: center, y: center },
  ], {}, [], 2).valid, false);
});
