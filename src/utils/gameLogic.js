// Game Logic & Algorithms for City / Territory Conquest Game

export const PLAYER_COLORS = [
  { id: 1, name: 'Mavi', hex: '#2563eb', bg: '#dbeafe', border: '#1d4ed8', pen: '#1e40af' },
  { id: 2, name: 'Kırmızı', hex: '#dc2626', bg: '#fee2e2', border: '#b91c1c', pen: '#991b1b' },
  { id: 3, name: 'Yeşil', hex: '#16a34a', bg: '#dcfce7', border: '#15803d', pen: '#166534' },
  { id: 4, name: 'Turuncu', hex: '#d97706', bg: '#fef3c7', border: '#b45309', pen: '#92400e' },
  { id: 5, name: 'Mor', hex: '#9333ea', bg: '#f3e8ff', border: '#7e22ce', pen: '#6b21a8' },
  { id: 6, name: 'Pembe', hex: '#db2777', bg: '#fce7f3', border: '#be185d', pen: '#9d174d' },
  { id: 7, name: 'Camgöbeği', hex: '#0891b2', bg: '#cffafe', border: '#0e7490', pen: '#155e75' },
  { id: 8, name: 'Limon', hex: '#65a30d', bg: '#ecfccb', border: '#4d7c0f', pen: '#3f6212' },
];

/**
 * Calculates the maximum safe number S in [1, 9] a player can choose
 * so that in the worst case (Wheel R = S - 1), Loss = S * (S - 1),
 * remaining territory stays >= 1 (never drops to <= 0).
 * Formula: S * (S - 1) < currentArea
 */
export function calculateMaxSafeNumber(currentArea) {
  if (currentArea <= 1) return 1;
  let maxS = 1;
  for (let s = 1; s <= 9; s++) {
    const worstCaseLoss = s * (s - 1);
    if (worstCaseLoss < currentArea) {
      maxS = s;
    } else {
      break;
    }
  }
  return Math.min(9, maxS);
}

/**
 * Creates empty grid of size width x height (filled with 0: unowned)
 */
export function createEmptyGrid(width, height) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array(width).fill(0));
  }
  return grid;
}

/**
 * Returns starting positions for up to 8 players on a grid
 */
export function getStartingPositions(gridWidth, gridHeight, playerCount, startSize) {
  const positions = [];

  // 1. Top-Left Corner
  positions.push({ x: 0, y: 0 });
  // 2. Top-Right Corner
  positions.push({ x: gridWidth - startSize, y: 0 });
  // 3. Bottom-Right Corner
  positions.push({ x: gridWidth - startSize, y: gridHeight - startSize });
  // 4. Bottom-Left Corner
  positions.push({ x: 0, y: gridHeight - startSize });

  // 5. Top-Center Edge
  const midX = Math.floor((gridWidth - startSize) / 2);
  const midY = Math.floor((gridHeight - startSize) / 2);
  positions.push({ x: midX, y: 0 });
  // 6. Right-Center Edge
  positions.push({ x: gridWidth - startSize, y: midY });
  // 7. Bottom-Center Edge
  positions.push({ x: midX, y: gridHeight - startSize });
  // 8. Left-Center Edge
  positions.push({ x: 0, y: midY });

  return positions.slice(0, playerCount);
}

/**
 * Places initial territory for all players
 */
export function initializeBoardTerritories(gridWidth, gridHeight, players, startSize) {
  const grid = createEmptyGrid(gridWidth, gridHeight);
  const startPositions = getStartingPositions(gridWidth, gridHeight, players.length, startSize);

  players.forEach((player, idx) => {
    const pos = startPositions[idx];
    for (let dy = 0; dy < startSize; dy++) {
      for (let dx = 0; dx < startSize; dx++) {
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
          grid[y][x] = player.id;
        }
      }
    }
  });

  return grid;
}

/**
 * Counts total territory per player
 */
export function countPlayerTerritories(grid, players) {
  const counts = {};
  players.forEach(p => counts[p.id] = 0);

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const pid = grid[y][x];
      if (pid > 0 && counts[pid] !== undefined) {
        counts[pid]++;
      }
    }
  }
  return counts;
}

/**
 * Counts the number of connected components for a player's territory
 * (Uses 8-connectivity: diagonal touch is considered connected, unless blocked by cross rules)
 * High-performance: uses flat Uint8Array and pointer-based BFS queue instead of array.shift()
 */
export function countCountryComponents(grid, playerId, excludedSet = new Set()) {
  const height = grid.length;
  const width = grid[0].length;
  const totalCells = width * height;
  const visited = new Uint8Array(totalCells);
  let components = 0;

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      if (excludedSet.has(`${x},${y}`)) continue;
      if (grid[y][x] === playerId) {
        components++;
        visited[idx] = 1;
        const queue = [{ x, y }];
        let qHead = 0;

        while (qHead < queue.length) {
          const curr = queue[qHead++];
          for (let d = 0; d < 8; d++) {
            const nx = curr.x + dirs[d].dx;
            const ny = curr.y + dirs[d].dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx]) {
                if (grid[ny][nx] === playerId && !excludedSet.has(`${nx},${ny}`)) {
                  visited[nIdx] = 1;
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }
        }
      }
    }
  }

  return components;
}

/**
 * Checks if a player's territory remains a single connected component (4-connected)
 * excluding all cells in the excludedSet.
 */
export function isCountryConnectedMulti(grid, playerId, excludedSet = new Set()) {
  return countCountryComponents(grid, playerId, excludedSet) <= 1;
}

export function isCountryConnected(grid, playerId, excludeX = -1, excludeY = -1) {
  const set = new Set();
  if (excludeX >= 0 && excludeY >= 0) {
    set.add(`${excludeX},${excludeY}`);
  }
  return isCountryConnectedMulti(grid, playerId, set);
}

/**
 * Checks whether placing candidate (tx, ty) would create an enclosed hole
 * or an empty pocket/cavity against the game boundary.
 */
export function wouldCreateTrappedPocket(grid, activePlayerId, tx, ty, pendingCells = []) {
  const height = grid.length;
  const width = grid[0].length;

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const isPlayerCell = (x, y) => {
    if (x === tx && y === ty) return true;
    if (pendingCells.some(c => c.x === x && c.y === y && !c.isWallBreachOnly && (c.playerId === activePlayerId || !c.playerId))) return true;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      return grid[y][x] === activePlayerId;
    }
    return false;
  };

  for (const dir of dirs) {
    const startX = tx + dir.dx;
    const startY = ty + dir.dy;

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) continue;
    if (isPlayerCell(startX, startY)) continue;
    if (grid[startY][startX] !== 0) continue;

    const visited = new Set();
    const queue = [{ x: startX, y: startY }];
    visited.add(startY * width + startX);

    let isSealedOff = true;
    let cellCount = 0;
    const maxSearch = Math.max(400, Math.min(1600, Math.floor(width * height * 0.4)));
    let qHead = 0;

    while (qHead < queue.length) {
      const { x, y } = queue[qHead++];
      cellCount++;

      if (cellCount > maxSearch) {
        isSealedOff = false;
        break;
      }

      for (const d of dirs) {
        const nx = x + d.dx;
        const ny = y + d.dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          continue;
        }

        if (isPlayerCell(nx, ny)) {
          continue;
        }

        if (grid[ny][nx] !== 0 && grid[ny][nx] !== activePlayerId) {
          isSealedOff = false;
          break;
        }

        const idx = ny * width + nx;
        if (!visited.has(idx)) {
          visited.add(idx);
          queue.push({ x: nx, y: ny });
        }
      }

      if (!isSealedOff) break;
    }

    if (isSealedOff) {
      return { trapped: true };
    }
  }

  return { trapped: false };
}

/**
 * Prevents 2x2 checkerboard cross interlocks ("ülkeler iç içe giriyormuş gibi"):
 * Disallows placing a cell if it creates a 2x2 grid where two diagonally opposite cells
 * belong to activePlayer and the other two belong to enemy players (both sides occupied).
 */
export function wouldCreateCheckerboardCross(grid, activePlayerId, tx, ty, pendingCells = []) {
  const height = grid.length;
  const width = grid[0].length;

  const getOwner = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    if (x === tx && y === ty) return activePlayerId;
    const pending = pendingCells.find(c => c.x === x && c.y === y);
    if (pending) {
      if (pending.isWallBreachOnly) {
        return grid[y][x];
      }
      return pending.playerId || activePlayerId;
    }
    return grid[y][x];
  };

  const offsets = [
    { ox: 0, oy: 0 },
    { ox: -1, oy: 0 },
    { ox: 0, oy: -1 },
    { ox: -1, oy: -1 },
  ];

  for (const { ox, oy } of offsets) {
    const x0 = tx + ox;
    const y0 = ty + oy;
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    if (x0 < 0 || x1 >= width || y0 < 0 || y1 >= height) continue;

    const p00 = getOwner(x0, y0);
    const p10 = getOwner(x1, y0);
    const p01 = getOwner(x0, y1);
    const p11 = getOwner(x1, y1);

    // Diagonal 1: (x0, y0) and (x1, y1) are activePlayer
    if (p00 === activePlayerId && p11 === activePlayerId) {
      if (p10 > 0 && p01 > 0 && p10 !== activePlayerId && p01 !== activePlayerId) {
        return {
          cross: true,
          reason: 'İki tarafında da rakip varken çaprazdan iç içe geçilemez! Önce aradaki rakip toprağı fethetmelisin.'
        };
      }
    }

    // Diagonal 2: (x1, y0) and (x0, y1) are activePlayer
    if (p10 === activePlayerId && p01 === activePlayerId) {
      if (p00 > 0 && p11 > 0 && p00 !== activePlayerId && p11 !== activePlayerId) {
        return {
          cross: true,
          reason: 'İki tarafında da rakip varken çaprazdan iç içe geçilemez! Önce aradaki rakip toprağı fethetmelisin.'
        };
      }
    }
  }

  return { cross: false };
}

/**
 * Returns whether target cell (tx, ty) can be expanded into by activePlayer.
 */
export function canExpandToCell(grid, activePlayerId, tx, ty, pendingCells = [], alliances = [], allowFreeConquest = true) {
  const height = grid.length;
  const width = grid[0].length;

  if (tx < 0 || tx >= width || ty < 0 || ty >= height) return { valid: false, reason: 'Harita dışı' };

  if (grid[ty][tx] === activePlayerId) return { valid: false, reason: 'Zaten senin toprağın' };
  if (pendingCells.some(c => c.x === tx && c.y === ty)) return { valid: false, reason: 'Bu turda zaten seçtin' };

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  let isAdjacent = false;
  for (const dir of dirs) {
    const nx = tx + dir.dx;
    const ny = ty + dir.dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      if (
        grid[ny][nx] === activePlayerId ||
        pendingCells.some(c => c.x === nx && c.y === ny && !c.isWallBreachOnly && (c.playerId === activePlayerId || (!c.playerId && grid[ny][nx] === activePlayerId)))
      ) {
        isAdjacent = true;
        break;
      }
    }
  }

  if (!isAdjacent) {
    return { valid: false, reason: 'Kendi sınırına bitişik bir kare seçmelisin' };
  }

  // Prevent 2x2 checkerboard cross (interlocking borders)
  const crossCheck = wouldCreateCheckerboardCross(grid, activePlayerId, tx, ty, pendingCells);
  if (crossCheck.cross) {
    return { valid: false, reason: crossCheck.reason };
  }

  const targetOwner = grid[ty][tx];

  // 1. Expanding into empty/neutral cell (0): Must not create an empty hole
  if (targetOwner === 0) {
    const trappedCheck = wouldCreateTrappedPocket(grid, activePlayerId, tx, ty, pendingCells);
    if (trappedCheck.trapped) {
      return {
        valid: false,
        reason: 'Sınırla veya ülkenle arada boşluk (delik) bırakamazsın! Önce aradaki boşlukları doldurmalısın.',
      };
    }
    return { valid: true, isAttack: false };
  }

  // 2. Target is an enemy cell (ATTACK):
  if (targetOwner > 0) {
    const hasAlliance = alliances.some(a => 
      a.status === 'active' && 
      ((a.player1Id === activePlayerId && a.player2Id === targetOwner) ||
       (a.player2Id === activePlayerId && a.player1Id === targetOwner))
    );

    // PERFORMANCE OPTIMIZATION:
    // If allowFreeConquest is enabled (default true):
    // ALWAYS ALLOW ATTACKING! No split-protection when executing or eliminating an enemy!
    // Skip expensive O(W*H) full-map territory scan completely!
    if (allowFreeConquest) {
      return { 
        valid: true, 
        isAttack: true, 
        targetOwner,
        isAllianceAttack: hasAlliance 
      };
    }

    // Only if allowFreeConquest is disabled, count target owner's total territory
    let targetArea = 0;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (grid[r][c] === targetOwner) targetArea++;
      }
    }

    if (targetArea <= 12) {
      return { 
        valid: true, 
        isAttack: true, 
        targetOwner,
        isAllianceAttack: hasAlliance 
      };
    }

    const baseExcluded = new Set();
    pendingCells.forEach(c => {
      if (grid[c.y][c.x] === targetOwner) {
        baseExcluded.add(`${c.x},${c.y}`);
      }
    });

    const componentsBefore = countCountryComponents(grid, targetOwner, baseExcluded);
    const newExcluded = new Set(baseExcluded);
    newExcluded.add(`${tx},${ty}`);
    const componentsAfter = countCountryComponents(grid, targetOwner, newExcluded);

    // If components increase, this cell was a bridge/cut-set.
    if (componentsAfter > componentsBefore) {
      return { 
        valid: false, 
        reason: 'Bu kareyi alamazsın! Rakibin ülkesi ikiye bölünür (çapraz bağ da bölünme sayılır).' 
      };
    }

    return { 
      valid: true, 
      isAttack: true, 
      targetOwner,
      isAllianceAttack: hasAlliance 
    };
  }

  return { valid: true, isAttack: false };
}

/**
 * Checks whether active player can build a Wall/Sur on (x, y)
 * - Must be owned by player (or pending)
 * - Must not already have a wall
 * - Must be on the outer border
 */
export function canBuildWallOnCell(grid, activePlayerId, x, y, walls = {}, pendingCells = []) {
  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) {
    return { valid: false, reason: 'Geçersiz harita' };
  }
  const height = grid.length;
  const width = grid[0].length;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height) {
    return { valid: false, reason: 'Harita dışı' };
  }
  const key = `${x},${y}`;

  if (walls[key]) return { valid: false, reason: 'Burada zaten duvar var' };

  // Must be owned
  const isOwned = grid[y][x] === activePlayerId || pendingCells.some(c => c.x === x && c.y === y && !c.isWallBreachOnly && (c.playerId === activePlayerId || !c.playerId));
  if (!isOwned) return { valid: false, reason: 'Sadece kendi sınırlarına duvar örebilirsin' };

  // Must touch an external tile
  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  let hasExternalBorder = false;

  for (const d of dirs) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      hasExternalBorder = true; // map boundary
      break;
    }
    const neighborOwner = grid[ny][nx];
    const isPendingOwned = pendingCells.some(c => c.x === nx && c.y === ny && !c.isWallBreachOnly && (c.playerId === activePlayerId || !c.playerId));
    if (neighborOwner !== activePlayerId && !isPendingOwned) {
      hasExternalBorder = true;
      break;
    }
  }

  if (!hasExternalBorder) {
    return { valid: false, reason: 'Duvar sadece dış sınırdaki karelere örülebilir' };
  }

  return { valid: true };
}

/**
 * Validates a complete online placement plan on the host before changing the board.
 * The host must never trust coordinates, costs, ownership claims, or wall changes
 * supplied by a remote client.
 */
export function validateTurnPlacementPlan(
  grid,
  activePlayerId,
  pendingCells = [],
  pendingWalls = [],
  walls = {},
  alliances = [],
  maxPoints = Infinity,
) {
  const invalid = (reason) => ({ valid: false, reason });

  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0]) || grid[0].length === 0) {
    return invalid('Geçersiz harita');
  }

  const height = grid.length;
  const width = grid[0].length;
  if (grid.some((row) => !Array.isArray(row) || row.length !== width)) {
    return invalid('Harita satırlarının boyutları tutarsız');
  }
  if (!Number.isInteger(activePlayerId) || activePlayerId <= 0) {
    return invalid('Geçersiz aktif oyuncu');
  }
  if (!Array.isArray(pendingCells) || !Array.isArray(pendingWalls)) {
    return invalid('Hamle verisi geçersiz');
  }
  if (pendingCells.length > width * height || pendingWalls.length > width * height) {
    return invalid('Hamle sayısı harita sınırını aşıyor');
  }
  if (!(maxPoints === Infinity || (Number.isFinite(maxPoints) && maxPoints >= 0))) {
    return invalid('Tur hakkı geçersiz');
  }

  const nextWalls = { ...(walls && typeof walls === 'object' && !Array.isArray(walls) ? walls : {}) };
  const acceptedCells = [];
  const acceptedWalls = [];
  const seenCells = new Set();
  const seenWalls = new Set();
  let spent = 0;

  for (const cell of pendingCells) {
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
      return invalid('Geçersiz kare hamlesi');
    }

    const { x, y } = cell;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height) {
      return invalid('Hamle harita sınırlarının dışında');
    }
    if (cell.playerId !== activePlayerId) {
      return invalid('Hamle aktif oyuncuya ait değil');
    }

    const key = `${x},${y}`;
    if (seenCells.has(key)) return invalid('Aynı kare birden fazla kez seçilmiş');
    seenCells.add(key);

    const isBreachOnly = cell.isWallBreachOnly === true;
    const isWallDemolished = cell.isWallDemolished === true;
    if (isBreachOnly && isWallDemolished) return invalid('Duvar hamlesi çelişkili');

    const cost = cell.cost === undefined ? 1 : cell.cost;
    if (!Number.isInteger(cost) || cost < 1 || cost > 2) {
      return invalid('Hamle maliyeti geçersiz');
    }

    const owner = grid[y][x];
    const wallExists = Boolean(nextWalls[key]);
    const check = canExpandToCell(grid, activePlayerId, x, y, acceptedCells, alliances);
    if (!check.valid) return invalid(check.reason || 'Geçersiz fetih hamlesi');

    if (isBreachOnly) {
      if (!wallExists || owner <= 0 || owner === activePlayerId || cost !== 1) {
        return invalid('Geçersiz duvar aşma hamlesi');
      }
      delete nextWalls[key];
    } else if (isWallDemolished) {
      if (!wallExists || owner <= 0 || owner === activePlayerId || (cost !== 1 && cost !== 2)) {
        return invalid('Geçersiz duvar yıkma hamlesi');
      }
      delete nextWalls[key];
    } else {
      if (wallExists || cost !== 1) return invalid('Normal fetih hamlesi geçersiz');
    }

    if (cell.previousOwner !== undefined && cell.previousOwner !== owner) {
      return invalid('Kare sahipliği değişmiş; hamle güncel değil');
    }
    if (cell.targetOwner !== undefined && cell.targetOwner !== check.targetOwner) {
      return invalid('Hedef oyuncu bilgisi uyuşmuyor');
    }

    spent += cost;
    if (spent > maxPoints) return invalid('Oyuncu mevcut tur hakkından fazla harcama yapıyor');

    acceptedCells.push({
      ...cell,
      x,
      y,
      cost,
      playerId: activePlayerId,
      previousOwner: owner,
      targetOwner: check.targetOwner,
      isAllianceAttack: Boolean(check.isAllianceAttack),
    });
  }

  for (const wall of pendingWalls) {
    if (!wall || typeof wall !== 'object' || Array.isArray(wall)) {
      return invalid('Geçersiz duvar hamlesi');
    }
    const { x, y } = wall;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height) {
      return invalid('Duvar harita sınırlarının dışında');
    }

    const key = `${x},${y}`;
    if (seenWalls.has(key)) return invalid('Aynı kareye birden fazla duvar kurulamaz');
    seenWalls.add(key);

    const check = canBuildWallOnCell(grid, activePlayerId, x, y, nextWalls, acceptedCells);
    if (!check.valid) return invalid(check.reason || 'Geçersiz duvar yeri');

    nextWalls[key] = true;
    acceptedWalls.push({ x, y });
    spent += 1;
    if (spent > maxPoints) return invalid('Oyuncu mevcut tur hakkından fazla harcama yapıyor');
  }

  return {
    valid: true,
    reason: null,
    pendingCells: acceptedCells,
    pendingWalls: acceptedWalls,
    walls: nextWalls,
    spent,
  };
}

/**
 * Checks if activePlayer has at least one valid expansion or wall-building move remaining.
 * Prevents soft-locking when the map is full or no valid moves remain.
 */
export function hasAnyValidPlacingMove(grid, activePlayerId, pendingCells = [], pendingWalls = [], walls = {}, alliances = [], gameMode = 'KLASIK') {
  if (!grid || grid.length === 0) return false;
  const height = grid.length;
  const width = grid[0].length;
  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  const checkedExpand = new Set();

  // 1. Check if any adjacent cell can be expanded into (or breached wall conquered)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === activePlayerId) {
        for (const d of dirs) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const key = `${nx},${ny}`;
            if (!checkedExpand.has(key)) {
              checkedExpand.add(key);
              if (canExpandToCell(grid, activePlayerId, nx, ny, pendingCells, alliances).valid) {
                return true;
              }
            }
          }
        }
      }
    }
  }

  for (const cell of pendingCells) {
    if (cell.isWallBreachOnly) {
      // Can conquer breached wall cell
      return true;
    }
    if (cell.playerId && cell.playerId !== activePlayerId) continue;
    for (const d of dirs) {
      const nx = cell.x + d.dx;
      const ny = cell.y + d.dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const key = `${nx},${ny}`;
        if (!checkedExpand.has(key)) {
          checkedExpand.add(key);
          if (canExpandToCell(grid, activePlayerId, nx, ny, pendingCells, alliances).valid) {
            return true;
          }
        }
      }
    }
  }

  // 2. In Modern Mode, also check if any valid wall can still be built
  if (gameMode === 'MODERN') {
    const currentWallsMap = { ...walls };
    pendingWalls.forEach(w => { currentWallsMap[`${w.x},${w.y}`] = true; });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === activePlayerId) {
          if (canBuildWallOnCell(grid, activePlayerId, x, y, currentWallsMap, pendingCells).valid) {
            return true;
          }
        }
      }
    }
    for (const cell of pendingCells) {
      if (!cell.isWallBreachOnly && (!cell.playerId || cell.playerId === activePlayerId)) {
        if (canBuildWallOnCell(grid, activePlayerId, cell.x, cell.y, currentWallsMap, pendingCells).valid) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Topological check in 3x3 8-neighborhood:
 * Returns true if the player's 8-neighbors form at most 1 connected component in the 8-ring.
 * If so, removing (x, y) is mathematically guaranteed not to disconnect the country!
 * Runs in O(1) time (~microsecond).
 */
function isRemovalSafeLocally(grid, playerId, x, y, width, height) {
  const dxs = [0, 1, 1, 1, 0, -1, -1, -1];
  const dys = [-1, -1, 0, 1, 1, 1, 0, -1];

  const present = [];
  for (let i = 0; i < 8; i++) {
    const nx = x + dxs[i];
    const ny = y + dys[i];
    if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === playerId) {
      present.push(i);
    }
  }

  // 0 or 1 neighbor: removing this cell cannot split remaining cells
  if (present.length <= 1) return true;

  // Check if all present neighbors form a single 8-connected component in the 8-ring
  const visited = new Set();
  const queue = [present[0]];
  visited.add(present[0]);
  let qHead = 0;

  while (qHead < queue.length) {
    const curr = queue[qHead++];
    const cx = dxs[curr];
    const cy = dys[curr];

    for (const other of present) {
      if (!visited.has(other)) {
        const ox = dxs[other];
        const oy = dys[other];
        if (Math.max(Math.abs(cx - ox), Math.abs(cy - oy)) <= 1) {
          visited.add(other);
          queue.push(other);
        }
      }
    }
  }

  return visited.size === present.length;
}

/**
 * Fast targeted BFS to verify if all neighbors of (x, y) can reach each other
 * through the rest of the player's country without passing through (x, y).
 */
function canReachNeighborsWithout(grid, playerId, x, y, width, height) {
  const dirs = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
  ];

  const neighbors = [];
  for (let d = 0; d < 8; d++) {
    const nx = x + dirs[d].dx;
    const ny = y + dirs[d].dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === playerId) {
      neighbors.push({ x: nx, y: ny });
    }
  }

  if (neighbors.length <= 1) return true;

  const targetCount = neighbors.length;
  let reachedCount = 1;

  const visited = new Uint8Array(width * height);
  visited[y * width + x] = 1; // Exclude center
  visited[neighbors[0].y * width + neighbors[0].x] = 1;

  const queue = [neighbors[0]];
  let qHead = 0;

  while (qHead < queue.length) {
    const curr = queue[qHead++];
    for (let d = 0; d < 8; d++) {
      const nx = curr.x + dirs[d].dx;
      const ny = curr.y + dirs[d].dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === playerId) {
        const idx = ny * width + nx;
        if (!visited[idx]) {
          visited[idx] = 1;
          queue.push({ x: nx, y: ny });
          if (neighbors.some(n => n.x === nx && n.y === ny)) {
            reachedCount++;
            if (reachedCount === targetCount) return true;
          }
        }
      }
    }
  }

  return reachedCount === targetCount;
}

/**
 * Intelligent country shrink algorithm (Highly Optimized: ~10ms for 30 cells on 80x80)
 * Uses O(1) topological neighborhood test + fast reachability BFS.
 */
export function shrinkCountrySmart(grid, playerId, amount, walls = {}) {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid = grid.map(row => [...row]);
  const newWalls = { ...walls };
  const removedCells = [];

  const dirs4 = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];

  // Track player cells for instant O(1) lookup and fast iteration
  const owned = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (newGrid[y][x] === playerId) {
        owned.push({ x, y });
      }
    }
  }

  for (let step = 0; step < amount; step++) {
    if (owned.length === 0) break;

    const fallbackCandidates = [];

    // Scan only owned cells for external borders
    for (let i = 0; i < owned.length; i++) {
      const cell = owned[i];
      let externalBorders = 0;
      for (const d of dirs4) {
        const nx = cell.x + d.dx;
        const ny = cell.y + d.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || newGrid[ny][nx] !== playerId) {
          externalBorders++;
        }
      }

      if (externalBorders > 0) {
        fallbackCandidates.push({ x: cell.x, y: cell.y, externalBorders, ownedIdx: i });
      }
    }

    if (fallbackCandidates.length === 0) break;

    // Sort by externalBorders desc: try outer corners and exposed borders first
    fallbackCandidates.sort((a, b) => b.externalBorders - a.externalBorders);

    let chosen = null;

    // 1. Try local topological test (O(1) microsecond check)
    for (const c of fallbackCandidates) {
      if (isRemovalSafeLocally(newGrid, playerId, c.x, c.y, width, height)) {
        chosen = c;
        break;
      }
    }

    // 2. If no candidate was locally simple, check via targeted reachability BFS
    if (!chosen) {
      for (const c of fallbackCandidates) {
        if (canReachNeighborsWithout(newGrid, playerId, c.x, c.y, width, height)) {
          chosen = c;
          break;
        }
      }
    }

    // 3. Fallback: pick the most exposed candidate
    if (!chosen) {
      chosen = fallbackCandidates[0];
    }

    newGrid[chosen.y][chosen.x] = 0;
    delete newWalls[`${chosen.x},${chosen.y}`];
    removedCells.push({ x: chosen.x, y: chosen.y });

    // Remove from owned array (O(1) swap with last element)
    const idx = chosen.ownedIdx;
    if (idx !== undefined && idx < owned.length && owned[idx].x === chosen.x && owned[idx].y === chosen.y) {
      owned[idx] = owned[owned.length - 1];
      owned.pop();
    } else {
      const actualIdx = owned.findIndex(c => c.x === chosen.x && c.y === chosen.y);
      if (actualIdx !== -1) {
        owned[actualIdx] = owned[owned.length - 1];
        owned.pop();
      }
    }
  }

  return { newGrid, newWalls, removedCells };
}

export function applyBreachPenalty(grid, violatorPlayerId, count, walls = {}) {
  return shrinkCountrySmart(grid, violatorPlayerId, count, walls);
}

/**
 * Transfers 'amount' border cells from fromPlayerId to toPlayerId (Optimized)
 */
export function transferTerritory(grid, fromPlayerId, toPlayerId, amount, walls = {}) {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid = grid.map(row => [...row]);
  const newWalls = { ...walls };
  const transferred = [];

  const dirs4 = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

  const owned = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (newGrid[y][x] === fromPlayerId) {
        owned.push({ x, y });
      }
    }
  }

  for (let step = 0; step < amount; step++) {
    if (owned.length === 0) break;

    const fallbackCandidates = [];

    for (let i = 0; i < owned.length; i++) {
      const cell = owned[i];
      let touchesTarget = false;
      let targetTouchesCount = 0;

      for (const d of dirs4) {
        const nx = cell.x + d.dx;
        const ny = cell.y + d.dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (newGrid[ny][nx] === toPlayerId) {
            touchesTarget = true;
            targetTouchesCount++;
          }
        }
      }

      if (touchesTarget) {
        fallbackCandidates.push({ x: cell.x, y: cell.y, targetTouchesCount, ownedIdx: i });
      }
    }

    if (fallbackCandidates.length === 0) break;

    fallbackCandidates.sort((a, b) => b.targetTouchesCount - a.targetTouchesCount);

    let chosen = null;
    for (const c of fallbackCandidates) {
      if (isRemovalSafeLocally(newGrid, fromPlayerId, c.x, c.y, width, height)) {
        chosen = c;
        break;
      }
    }

    if (!chosen) {
      for (const c of fallbackCandidates) {
        if (canReachNeighborsWithout(newGrid, fromPlayerId, c.x, c.y, width, height)) {
          chosen = c;
          break;
        }
      }
    }

    if (!chosen) {
      chosen = fallbackCandidates[0];
    }

    newGrid[chosen.y][chosen.x] = toPlayerId;
    delete newWalls[`${chosen.x},${chosen.y}`];
    transferred.push({ x: chosen.x, y: chosen.y });

    const idx = chosen.ownedIdx;
    if (idx !== undefined && idx < owned.length && owned[idx].x === chosen.x && owned[idx].y === chosen.y) {
      owned[idx] = owned[owned.length - 1];
      owned.pop();
    } else {
      const actualIdx = owned.findIndex(c => c.x === chosen.x && c.y === chosen.y);
      if (actualIdx !== -1) {
        owned[actualIdx] = owned[owned.length - 1];
        owned.pop();
      }
    }
  }

  return { newGrid, newWalls, transferred };
}

/**
 * Instantly expand player territory for debug/testing
 */
export function expandPlayerInstant(grid, playerId, amount) {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid = grid.map(row => [...row]);
  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  let added = 0;

  for (let step = 0; step < amount; step++) {
    const candidates = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (newGrid[y][x] === 0) {
          const touches = dirs.some(d => {
            const nx = x + d.dx;
            const ny = y + d.dy;
            return nx >= 0 && nx < width && ny >= 0 && ny < height && newGrid[ny][nx] === playerId;
          });
          if (touches) candidates.push({ x, y });
        }
      }
    }
    if (candidates.length === 0) break;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    newGrid[chosen.y][chosen.x] = playerId;
    added++;
  }

  return { newGrid, added };
}

/**
 * Computes intelligent bot moves for expansion & walls
 */
export function computeBotTurnMoves(grid, botPlayerId, totalPoints, walls = {}, alliances = [], gameMode = 'KLASIK') {
  const height = grid.length;
  const width = grid[0].length;
  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  const pendingCells = [];
  const pendingWalls = [];
  const curWalls = { ...walls };
  let spent = 0;

  const centerX = width / 2;
  const centerY = height / 2;

  // Modern mode: Build a wall if exposed to enemies and has enough points
  if (gameMode === 'MODERN' && totalPoints >= 2 && Math.random() < 0.35) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === botPlayerId && !curWalls[`${x},${y}`]) {
          const enemyNear = dirs.some(d => {
            const nx = x + d.dx, ny = y + d.dy;
            return nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] > 0 && grid[ny][nx] !== botPlayerId;
          });
          if (enemyNear && canBuildWallOnCell(grid, botPlayerId, x, y, curWalls, []).valid) {
            pendingWalls.push({ x, y });
            curWalls[`${x},${y}`] = true;
            spent++;
            break;
          }
        }
      }
      if (pendingWalls.length > 0) break;
    }
  }

  while (spent < totalPoints) {
    const remaining = totalPoints - spent;
    const candidates = [];
    const visitedKeys = new Set(pendingCells.map(c => `${c.x},${c.y}`));
    const candidateCoords = new Set();

    const consider = (tx, ty) => {
      const k = `${tx},${ty}`;
      if (!visitedKeys.has(k) && tx >= 0 && tx < width && ty >= 0 && ty < height) {
        candidateCoords.add(k);
      }
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === botPlayerId) {
          for (const d of dirs) consider(x + d.dx, y + d.dy);
        }
      }
    }
    for (const c of pendingCells) {
      if (!c.isWallBreachOnly) {
        for (const d of dirs) consider(c.x + d.dx, c.y + d.dy);
      }
    }

    for (const k of candidateCoords) {
      const [tx, ty] = k.split(',').map(Number);
      const isWall = !!curWalls[k] && grid[ty][tx] !== botPlayerId;
      const cost = isWall ? 2 : 1;

      if (remaining >= cost) {
        const check = canExpandToCell(grid, botPlayerId, tx, ty, pendingCells, alliances);
        if (check.valid) {
          let score = 10;
          if (check.isAttack) {
            score = check.isAllianceAttack ? -50 : 50;
          } else {
            const distToCenter = Math.hypot(tx - centerX, ty - centerY);
            score += Math.max(0, 30 - distToCenter);
          }
          candidates.push({ x: tx, y: ty, cost, isWall, isAttack: check.isAttack, targetOwner: check.targetOwner, score });
        }
      }
    }

    if (candidates.length === 0) break;

    candidates.sort((a, b) => (b.score + Math.random() * 5) - (a.score + Math.random() * 5));
    const chosen = candidates[0];

    if (chosen.isWall) {
      delete curWalls[`${chosen.x},${chosen.y}`];
      pendingCells.push({
        x: chosen.x,
        y: chosen.y,
        cost: 2,
        isWallDemolished: true,
        previousOwner: grid[chosen.y][chosen.x],
        targetOwner: chosen.targetOwner,
        playerId: botPlayerId,
      });
      spent += 2;
    } else {
      pendingCells.push({
        x: chosen.x,
        y: chosen.y,
        cost: 1,
        previousOwner: grid[chosen.y][chosen.x],
        targetOwner: chosen.targetOwner,
        playerId: botPlayerId,
      });
      spent += 1;
    }
  }

  return { pendingCells, pendingWalls, walls: curWalls };
}

/**
 * Finds all neighboring player IDs bordering a specific player
 */
export function getPlayerNeighbors(grid, playerId) {
  const height = grid.length;
  const width = grid[0].length;
  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  const neighborCounts = {};

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === playerId) {
        for (const d of dirs) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const other = grid[ny][nx];
            if (other > 0 && other !== playerId) {
              neighborCounts[other] = (neighborCounts[other] || 0) + 1;
            }
          }
        }
      }
    }
  }
  return neighborCounts;
}

/**
 * Evaluates sophisticated diplomatic actions for a bot
 * (Tribute demand when dominant, Coalition against superpowers, Desperation peace pacts, Betrayal when trapped)
 */
export function evaluateBotDiplomacy(grid, botPlayer, allPlayers, alliances = [], gameMode = 'KLASIK') {
  // 45% chance to consider diplomacy in any given turn to keep gameplay natural
  if (Math.random() > 0.45) return null;

  const territoryCounts = countPlayerTerritories(grid, allPlayers);
  const botArea = territoryCounts[botPlayer.id] || 0;
  if (botArea < 6) return null;

  const neighborCounts = getPlayerNeighbors(grid, botPlayer.id);
  const neighborIds = Object.keys(neighborCounts).map(Number);
  if (neighborIds.length === 0) return null;

  const myAlliances = alliances.filter(a => a.status === 'active' && (a.player1Id === botPlayer.id || a.player2Id === botPlayer.id));
  const alliedPlayerIds = new Set();
  myAlliances.forEach(a => {
    alliedPlayerIds.add(a.player1Id === botPlayer.id ? a.player2Id : a.player1Id);
  });

  const alivePlayers = allPlayers.filter(p => p.alive && (territoryCounts[p.id] || 0) > 0);
  const totalConquered = Object.values(territoryCounts).reduce((a, b) => a + b, 0);

  const sortedPlayers = [...alivePlayers].sort((a, b) => (territoryCounts[b.id] || 0) - (territoryCounts[a.id] || 0));
  const leader = sortedPlayers[0];
  const leaderArea = territoryCounts[leader.id] || 0;

  // 1. KÖŞEYE SIKIŞTIRMA & HARAÇ (Tribute Demand - Modern Mode)
  if (gameMode === 'MODERN') {
    for (const nId of neighborIds) {
      if (alliedPlayerIds.has(nId)) continue;
      const target = allPlayers.find(p => p.id === nId);
      if (!target || !target.alive) continue;
      const targetArea = territoryCounts[nId] || 0;

      // If bot is significantly stronger (>=1.5x area) and has strong border presence
      if (botArea >= 15 && botArea >= targetArea * 1.5 && neighborCounts[nId] >= 2) {
        return {
          type: 'PROPOSE',
          targetPlayer: target,
          proposal: {
            id: Date.now() + Math.random(),
            type: 'TRIBUTE',
            proposer: botPlayer,
            target: target,
            player1Id: botPlayer.id,
            player2Id: target.id,
            payerId: target.id,
            patronId: botPlayer.id,
            durationRounds: 4,
            penaltyCells: 3,
            tributeAmount: 1,
            status: 'active',
            message: `Ordularım sınırlarına dayandı. Bana saldırmamam ve barış için her tur 1 kare haraç (vergi) ödemelisin!`,
          }
        };
      }
    }
  }

  // 2. ORTAK DÜŞMAN / SÜPER GÜCE KARŞI KOALİSYON (Common Threat Coalition)
  if (leader && leader.id !== botPlayer.id && leaderArea >= totalConquered * 0.32 && leaderArea >= botArea * 1.3) {
    for (const p of alivePlayers) {
      if (p.id === botPlayer.id || p.id === leader.id || alliedPlayerIds.has(p.id)) continue;
      return {
        type: 'PROPOSE',
        targetPlayer: p,
        proposal: {
          id: Date.now() + Math.random(),
          type: 'NON_AGGRESSION',
          proposer: botPlayer,
          target: p,
          player1Id: botPlayer.id,
          player2Id: p.id,
          durationRounds: 4,
          penaltyCells: 3,
          status: 'active',
          message: `${leader.name} hızla büyüyüp hepimizi tehdit ediyor! Ona karşı güçlerimizi birleştirmek için 4 turluk ittifak kuralım!`,
        }
      };
    }
  }

  // 3. ZAYIF DÜŞÜNCE BARIŞ VE SALDIRMAZLIK ARAYIŞI (Desperation Peace Pact)
  if (botArea <= 12) {
    for (const nId of neighborIds) {
      if (alliedPlayerIds.has(nId)) continue;
      const strongNeighbor = allPlayers.find(p => p.id === nId);
      if (!strongNeighbor || !strongNeighbor.alive) continue;
      const nArea = territoryCounts[nId] || 0;
      if (nArea >= botArea * 1.4) {
        return {
          type: 'PROPOSE',
          targetPlayer: strongNeighbor,
          proposal: {
            id: Date.now() + Math.random(),
            type: 'NON_AGGRESSION',
            proposer: botPlayer,
            target: strongNeighbor,
            player1Id: botPlayer.id,
            player2Id: strongNeighbor.id,
            durationRounds: 3,
            penaltyCells: 2,
            status: 'active',
            message: `Devletim toparlanırken aramızda barış olsun. 3 turluk saldırmazlık paktı teklif ediyorum.`,
          }
        };
      }
    }
  }

  // 4. İTTİFAK FESHİ / İHANET (Break Alliance when completely surrounded by ally)
  if (myAlliances.length > 0 && Math.random() < 0.25) {
    const allyId = [...alliedPlayerIds][0];
    const ally = allPlayers.find(p => p.id === allyId);
    if (ally) {
      const otherNeighbors = neighborIds.filter(id => id !== allyId);
      if (otherNeighbors.length === 0 && botArea >= 12) {
        return {
          type: 'BETRAY',
          allianceId: myAlliances[0].id,
          targetPlayer: ally,
          penaltyCells: myAlliances[0].penaltyCells || 2,
          message: `⚠️ ${botPlayer.name}, toprakları sıkıştığı için ${ally.name} ile olan ittifakını bozdu ve savaşa girdi!`,
        };
      }
    }
  }

  return null;
}

