import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { canExpandToCell, canBuildWallOnCell, PLAYER_COLORS } from '../utils/gameLogic';
import { ZoomIn, ZoomOut, Compass, RotateCcw } from 'lucide-react';

export default function GameBoard({
  grid,
  gridWidth,
  gridHeight,
  activePlayer,
  pendingCells,
  pendingWalls = [],
  walls = {},
  placingMode = 'EXPAND',
  onCellClick,
  onBuildWall,
  onUndo,
  canPlaceMore,
  alliances,
  isPlacingPhase,
  isMyTurn = true,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Precompute valid highlight cells ONLY when board/turn state changes (avoids 60 FPS BFS lag on 80x80 maps!)
  const highlightedCells = useMemo(() => {
    if (!isMyTurn || !isPlacingPhase || !canPlaceMore || !grid || grid.length === 0) return [];
    const results = [];
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

    if (placingMode === 'WALL') {
      const currentWallsMap = { ...walls };
      pendingWalls.forEach(w => { currentWallsMap[`${w.x},${w.y}`] = true; });
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (grid[y][x] === activePlayer.id || pendingCells.some(c => c.x === x && c.y === y && !c.isWallBreachOnly)) {
            if (canBuildWallOnCell(grid, activePlayer.id, x, y, currentWallsMap, pendingCells).valid) {
              results.push({ x, y, type: 'WALL' });
            }
          }
        }
      }
    } else {
      const checked = new Set();
      const tryAdd = (tx, ty) => {
        const key = `${tx},${ty}`;
        if (checked.has(key)) return;
        checked.add(key);
        const check = canExpandToCell(grid, activePlayer.id, tx, ty, pendingCells, alliances);
        if (check.valid) {
          results.push({ x: tx, y: ty, type: check.isAttack ? 'ATTACK' : 'EXPAND' });
        }
      };

      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (grid[y][x] === activePlayer.id) {
            for (const d of dirs) {
              const nx = x + d.dx;
              const ny = y + d.dy;
              if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                tryAdd(nx, ny);
              }
            }
          }
        }
      }

      pendingCells.forEach(cell => {
        if (cell.isWallBreachOnly) {
          results.push({ x: cell.x, y: cell.y, type: 'ATTACK' });
          return;
        }
        if (cell.playerId && cell.playerId !== activePlayer.id) return;
        for (const d of dirs) {
          const nx = cell.x + d.dx;
          const ny = cell.y + d.dy;
          if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
            tryAdd(nx, ny);
          }
        }
      });
    }

    return results;
  }, [isMyTurn, isPlacingPhase, canPlaceMore, grid, gridWidth, gridHeight, activePlayer.id, pendingCells, pendingWalls, walls, placingMode, alliances]);

  // Keep all latest props in a ref to avoid stale closures in requestAnimationFrame and event handlers
  const propsRef = useRef({});
  propsRef.current = {
    grid,
    gridWidth,
    gridHeight,
    activePlayer,
    pendingCells,
    pendingWalls,
    walls,
    placingMode,
    onCellClick,
    onBuildWall,
    canPlaceMore: isMyTurn && canPlaceMore,
    alliances,
    isPlacingPhase: isMyTurn && isPlacingPhase,
    isMyTurn,
    highlightedCells,
  };

  // Camera current position & target position for smooth animation
  const cameraRef = useRef({ x: 30, y: 30, zoom: 24 });
  const targetCameraRef = useRef({ x: 30, y: 30, zoom: 24 });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isPaintingRef = useRef(false);
  const lastCellRef = useRef(null);
  const touchDistanceRef = useRef(null);

  // Calculate center of player's territory using latest ref (so grid changes don't yank camera)
  const getPlayerCenter = useCallback((playerId) => {
    const { grid: g, gridWidth: gw, gridHeight: gh, activePlayer: ap } = propsRef.current;
    const pid = playerId !== undefined ? playerId : ap.id;
    let sumX = 0, sumY = 0, count = 0;
    if (g && g.length > 0) {
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          if (g[y][x] === pid) {
            sumX += x;
            sumY += y;
            count++;
          }
        }
      }
    }
    if (count > 0) {
      return { x: sumX / count, y: sumY / count };
    }
    return { x: (gw || 60) / 2, y: (gh || 60) / 2 };
  }, []);

  // Smooth glide camera to target player
  const focusOnPlayerSmooth = useCallback((playerId) => {
    const center = getPlayerCenter(playerId);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const zoom = cameraRef.current.zoom;
      targetCameraRef.current = {
        x: rect.width / 2 - (center.x + 0.5) * zoom,
        y: rect.height / 2 - (center.y + 0.5) * zoom,
        zoom,
      };
    }
  }, [getPlayerCenter]);

  // Only auto-glide camera when activePlayer.id changes (NOT on every grid edit!)
  useEffect(() => {
    focusOnPlayerSmooth(activePlayer.id);
  }, [activePlayer.id, focusOnPlayerSmooth]);

  // Center-anchored zoom controls so zooming doesn't drift toward top-left
  const handleZoom = useCallback((delta) => {
    const target = targetCameraRef.current;
    const oldZoom = target.zoom;
    const newZoom = Math.max(12, Math.min(65, oldZoom + delta));
    if (newZoom === oldZoom) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const scale = newZoom / oldZoom;
      target.x = cx - (cx - target.x) * scale;
      target.y = cy - (cy - target.y) * scale;
    }
    target.zoom = newZoom;
  }, []);

  // Attach non-passive wheel listener to prevent console warnings & page scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e) => {
      e.preventDefault();
      handleZoom(e.deltaY < 0 ? 4 : -4);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [handleZoom]);

  // 60FPS Animation Loop for smooth camera lerp & canvas rendering
  useEffect(() => {
    let animationFrameId;

    const render = () => {
      // Smooth camera interpolation (lerp)
      const current = cameraRef.current;
      const target = targetCameraRef.current;
      const speed = 0.12; // Smooth gliding speed

      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dz = target.zoom - current.zoom;

      current.x += dx * speed;
      current.y += dy * speed;
      current.zoom += dz * speed;

      // Draw canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawBoard(ctx, canvas, current);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Canvas drawing function
  const drawBoard = (ctx, canvas, cam) => {
    const {
      grid,
      gridWidth,
      gridHeight,
      activePlayer,
      pendingCells,
      pendingWalls,
      walls,
      canPlaceMore,
      isPlacingPhase,
      highlightedCells,
    } = propsRef.current;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Slate outer background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.translate(cam.x, cam.y);

    const zoom = cam.zoom;
    const boardWidthPx = gridWidth * zoom;
    const boardHeightPx = gridHeight * zoom;

    // 1. Paper Base & Shadow
    ctx.shadowColor = 'rgba(15, 23, 42, 0.2)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, boardWidthPx, boardHeightPx);
    ctx.shadowColor = 'transparent';

    // 2. Draw Owned Territories (Background Fills)
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const ownerId = grid[y][x];
        if (ownerId > 0) {
          const color = PLAYER_COLORS.find(c => c.id === ownerId) || PLAYER_COLORS[0];
          ctx.fillStyle = color.hex;
          ctx.globalAlpha = 0.52;
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
      }
    }
    ctx.globalAlpha = 1.0;

    // 3. Draw Pending Turn Cells
    if (pendingCells && pendingCells.length > 0) {
      const activeColor = PLAYER_COLORS.find(c => c.id === activePlayer.id) || PLAYER_COLORS[0];
      let stepNum = 1;
      pendingCells.forEach((cell) => {
        if (cell.isWallBreachOnly) {
          // Breached wall without conquest: show cracked explosion
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.fillRect(cell.x * zoom, cell.y * zoom, zoom, zoom);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cell.x * zoom + 1, cell.y * zoom + 1, zoom - 2, zoom - 2);

          ctx.fillStyle = '#ef4444';
          ctx.font = `bold ${Math.max(10, Math.floor(zoom * 0.45))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💥', (cell.x + 0.5) * zoom, (cell.y + 0.5) * zoom);
        } else {
          const cellColor = (cell.playerId ? PLAYER_COLORS.find(c => c.id === cell.playerId) : null) || activeColor;
          ctx.fillStyle = cellColor.hex;
          ctx.globalAlpha = 0.78;
          ctx.fillRect(cell.x * zoom, cell.y * zoom, zoom, zoom);

          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(10, Math.floor(zoom * 0.45))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${stepNum}`, (cell.x + 0.5) * zoom, (cell.y + 0.5) * zoom);
        }
        stepNum += (cell.cost || 1);
      });
    }
    ctx.globalAlpha = 1.0;

    // 4. CRISP HIGH-CONTRAST GRID LINES (Her 1x1 kare belirgin)
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#cbd5e1'; // Clear slate grid line
    ctx.beginPath();
    for (let c = 0; c <= gridWidth; c++) {
      ctx.moveTo(c * zoom, 0);
      ctx.lineTo(c * zoom, boardHeightPx);
    }
    for (let r = 0; r <= gridHeight; r++) {
      ctx.moveTo(0, r * zoom);
      ctx.lineTo(boardWidthPx, r * zoom);
    }
    ctx.stroke();

    // 5. Major 5x5 Grid Lines (Kılavuz çizgileri)
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    for (let c = 0; c <= gridWidth; c += 5) {
      ctx.moveTo(c * zoom, 0);
      ctx.lineTo(c * zoom, boardHeightPx);
    }
    for (let r = 0; r <= gridHeight; r += 5) {
      ctx.moveTo(0, r * zoom);
      ctx.lineTo(boardWidthPx, r * zoom);
    }
    ctx.stroke();

    // 6. Bold Pen Borders Around Territories
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const ownerId = grid[y][x];
        if (ownerId > 0) {
          const color = PLAYER_COLORS.find(c => c.id === ownerId) || PLAYER_COLORS[0];
          ctx.strokeStyle = color.border;
          ctx.lineWidth = 2.4;

          if (y === 0 || grid[y - 1][x] !== ownerId) {
            ctx.beginPath();
            ctx.moveTo(x * zoom, y * zoom);
            ctx.lineTo((x + 1) * zoom, y * zoom);
            ctx.stroke();
          }
          if (y === gridHeight - 1 || grid[y + 1][x] !== ownerId) {
            ctx.beginPath();
            ctx.moveTo(x * zoom, (y + 1) * zoom);
            ctx.lineTo((x + 1) * zoom, (y + 1) * zoom);
            ctx.stroke();
          }
          if (x === 0 || grid[y][x - 1] !== ownerId) {
            ctx.beginPath();
            ctx.moveTo(x * zoom, y * zoom);
            ctx.lineTo(x * zoom, (y + 1) * zoom);
            ctx.stroke();
          }
          if (x === gridWidth - 1 || grid[y][x + 1] !== ownerId) {
            ctx.beginPath();
            ctx.moveTo((x + 1) * zoom, y * zoom);
            ctx.lineTo((x + 1) * zoom, (y + 1) * zoom);
            ctx.stroke();
          }
        }
      }
    }

    // 7. Draw Walls / Surlar
    if (walls) {
      Object.keys(walls).forEach(key => {
        const [wx, wy] = key.split(',').map(Number);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(wx * zoom + 1.5, wy * zoom + 1.5, zoom - 3, zoom - 3);

        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.max(9, Math.floor(zoom * 0.42))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', (wx + 0.5) * zoom, (wy + 0.5) * zoom);
      });
    }

    // 7.1 Draw Pending Walls being built this turn
    if (pendingWalls && pendingWalls.length > 0) {
      pendingWalls.forEach(w => {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.strokeRect(w.x * zoom + 1.5, w.y * zoom + 1.5, zoom - 3, zoom - 3);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
        ctx.fillRect(w.x * zoom + 1.5, w.y * zoom + 1.5, zoom - 3, zoom - 3);

        ctx.font = `bold ${Math.max(9, Math.floor(zoom * 0.42))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', (w.x + 0.5) * zoom, (w.y + 0.5) * zoom);
      });
    }

    // 8. Outer Grid Border
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(0, 0, boardWidthPx, boardHeightPx);

    // 8. Highlight Valid Cells During Placing Phase (Precomputed via useMemo - 0 BFS per frame!)
    if (isPlacingPhase && canPlaceMore && highlightedCells && highlightedCells.length > 0) {
      ctx.setLineDash([3, 3]);

      for (let i = 0; i < highlightedCells.length; i++) {
        const item = highlightedCells[i];
        if (item.type === 'WALL') {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          ctx.fillRect(item.x * zoom + 2, item.y * zoom + 2, zoom - 4, zoom - 4);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(item.x * zoom + 2, item.y * zoom + 2, zoom - 4, zoom - 4);

          ctx.font = `bold ${Math.max(9, Math.floor(zoom * 0.38))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🛡️', (item.x + 0.5) * zoom, (item.y + 0.5) * zoom);
        } else if (item.type === 'ATTACK') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fillRect(item.x * zoom, item.y * zoom, zoom, zoom);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(item.x * zoom + 1, item.y * zoom + 1, zoom - 2, zoom - 2);
        } else {
          ctx.fillStyle = `${activePlayer.hex}33`;
          ctx.fillRect(item.x * zoom, item.y * zoom, zoom, zoom);
          ctx.strokeStyle = activePlayer.hex;
          ctx.lineWidth = 2;
          ctx.strokeRect(item.x * zoom + 1, item.y * zoom + 1, zoom - 2, zoom - 2);
        }
      }

      ctx.setLineDash([]);
    }

    ctx.restore();
  };

  // Convert screen coordinates to grid coordinates
  const screenToGrid = (screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;
    const clickX = screenX - rect.left - cam.x;
    const clickY = screenY - rect.top - cam.y;

    const gx = Math.floor(clickX / cam.zoom);
    const gy = Math.floor(clickY / cam.zoom);

    if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
      return { x: gx, y: gy };
    }
    return null;
  };

  // Bresenham line algorithm to prevent gaps when mouse or finger drags fast!
  const paintLine = (p0, p1) => {
    let x0 = p0.x, y0 = p0.y;
    const x1 = p1.x, y1 = p1.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (!(x0 === p0.x && y0 === p0.y)) {
        const res = propsRef.current.onCellClick(x0, y0);
        // If cell placement failed or ran out of points, STOP line immediately!
        // NEVER jump over an unconquered or invalid cell!
        if (res && res.valid === false) {
          break;
        }
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  // Mouse Handlers
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      const cell = screenToGrid(e.clientX, e.clientY);
      const { placingMode: curMode, isPlacingPhase: curPlacing, canPlaceMore: curCan } = propsRef.current;
      if (cell && curPlacing && curCan) {
        if (curMode === 'WALL') {
          const res = propsRef.current.onBuildWall(cell.x, cell.y);
          if (res && res.valid === false) {
            isDraggingRef.current = true;
            dragStartRef.current = {
              x: e.clientX - targetCameraRef.current.x,
              y: e.clientY - targetCameraRef.current.y,
            };
          }
        } else {
          const res = propsRef.current.onCellClick(cell.x, cell.y);
          if (res && res.valid) {
            isPaintingRef.current = true;
            lastCellRef.current = cell;
          } else {
            isDraggingRef.current = true;
            dragStartRef.current = {
              x: e.clientX - targetCameraRef.current.x,
              y: e.clientY - targetCameraRef.current.y,
            };
          }
        }
      } else {
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: e.clientX - targetCameraRef.current.x,
          y: e.clientY - targetCameraRef.current.y,
        };
      }
    }
  };

  const handleMouseMove = (e) => {
    const { placingMode: curMode, isPlacingPhase: curPlacing, canPlaceMore: curCan } = propsRef.current;
    if (isPaintingRef.current && curPlacing && curCan && curMode !== 'WALL') {
      const cell = screenToGrid(e.clientX, e.clientY);
      if (cell) {
        if (!lastCellRef.current || cell.x !== lastCellRef.current.x || cell.y !== lastCellRef.current.y) {
          if (lastCellRef.current) {
            // Use line interpolation to ensure NO GAPS when moving fast!
            paintLine(lastCellRef.current, cell);
          } else {
            propsRef.current.onCellClick(cell.x, cell.y);
          }
          lastCellRef.current = cell;
        }
      }
    } else if (isDraggingRef.current) {
      targetCameraRef.current.x = e.clientX - dragStartRef.current.x;
      targetCameraRef.current.y = e.clientY - dragStartRef.current.y;
      cameraRef.current.x = targetCameraRef.current.x;
      cameraRef.current.y = targetCameraRef.current.y;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPaintingRef.current = false;
    lastCellRef.current = null;
  };

  // Touch Handlers for Mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const cell = screenToGrid(touch.clientX, touch.clientY);
      const { placingMode: curMode, isPlacingPhase: curPlacing, canPlaceMore: curCan } = propsRef.current;
      if (cell && curPlacing && curCan) {
        if (curMode === 'WALL') {
          const res = propsRef.current.onBuildWall(cell.x, cell.y);
          if (res && res.valid === false) {
            isDraggingRef.current = true;
            dragStartRef.current = {
              x: touch.clientX - targetCameraRef.current.x,
              y: touch.clientY - targetCameraRef.current.y,
            };
          }
        } else {
          const res = propsRef.current.onCellClick(cell.x, cell.y);
          if (res && res.valid) {
            isPaintingRef.current = true;
            lastCellRef.current = cell;
          } else {
            isDraggingRef.current = true;
            dragStartRef.current = {
              x: touch.clientX - targetCameraRef.current.x,
              y: touch.clientY - targetCameraRef.current.y,
            };
          }
        }
      } else {
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: touch.clientX - targetCameraRef.current.x,
          y: touch.clientY - targetCameraRef.current.y,
        };
      }
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      isPaintingRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { placingMode: curMode, isPlacingPhase: curPlacing, canPlaceMore: curCan } = propsRef.current;
      if (isPaintingRef.current && curPlacing && curCan && curMode !== 'WALL') {
        const cell = screenToGrid(touch.clientX, touch.clientY);
        if (cell) {
          if (!lastCellRef.current || cell.x !== lastCellRef.current.x || cell.y !== lastCellRef.current.y) {
            if (lastCellRef.current) {
              paintLine(lastCellRef.current, cell);
            } else {
              propsRef.current.onCellClick(cell.x, cell.y);
            }
            lastCellRef.current = cell;
          }
        }
      } else if (isDraggingRef.current) {
        targetCameraRef.current.x = touch.clientX - dragStartRef.current.x;
        targetCameraRef.current.y = touch.clientY - dragStartRef.current.y;
        cameraRef.current.x = targetCameraRef.current.x;
        cameraRef.current.y = targetCameraRef.current.y;
      }
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const diff = newDist - touchDistanceRef.current;
      if (Math.abs(diff) > 2) {
        handleZoom(diff > 0 ? 1.5 : -1.5);
        touchDistanceRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    isPaintingRef.current = false;
    touchDistanceRef.current = null;
    lastCellRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-200"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => handleZoom(5)}
          className="p-3 bg-white/95 text-stone-700 shadow-lg rounded-full hover:bg-stone-50 active:scale-95 transition border border-stone-300"
          title="Yakınlaştır"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={() => handleZoom(-5)}
          className="p-3 bg-white/95 text-stone-700 shadow-lg rounded-full hover:bg-stone-50 active:scale-95 transition border border-stone-300"
          title="Uzaklaştır"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={() => focusOnPlayerSmooth()}
          className="p-3 bg-white/95 text-blue-600 shadow-lg rounded-full hover:bg-blue-50 active:scale-95 transition border border-blue-300"
          title="Ülkeme Odaklan"
        >
          <Compass size={20} />
        </button>
      </div>

      {/* Undo Button if pending cells exist */}
      {isMyTurn && pendingCells && pendingCells.length > 0 && (
        <div className="absolute bottom-6 left-4 z-10">
          <button
            onClick={onUndo}
            className="flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-lg rounded-xl active:scale-95 transition"
          >
            <RotateCcw size={18} />
            <span>Son Kareyi Geri Al ({pendingCells.length})</span>
          </button>
        </div>
      )}
    </div>
  );
}
