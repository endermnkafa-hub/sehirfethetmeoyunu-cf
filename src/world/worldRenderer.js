// High-DPI 60 FPS Cartographic Renderer for Massive Minimalist Grey Earth Map
// Ultra-Fast Mobile Edition: Zero per-frame Path2D clip/stroke tessellation!
// Territories are composited onto offscreen bufferCanvas ONLY when a pixel changes; panning & zooming is 1 single drawImage call (60 FPS on all phones)

import { MAP_W, MAP_H } from "./worldRasterizer";
import { FLAG_W, FLAG_H } from "./flagLibrary";

export class WorldMapRenderer {
  constructor(worldData) {
    this.worldData = worldData;

    // Offscreen 1000x500 buffer canvas (holds Grey Earth + all painted country territories)
    this.bufferCanvas = document.createElement("canvas");
    this.bufferCanvas.width = MAP_W;
    this.bufferCanvas.height = MAP_H;
    this.bufferCtx = this.bufferCanvas.getContext("2d");
    this.imageData = this.bufferCtx.createImageData(MAP_W, MAP_H);
    this.imageData.data.set(worldData.baseMapRgba);
    this.bufferCtx.putImageData(this.imageData, 0, 0);

    // Image cache for HTMLImageElements
    this.imgCache = new Map();

    // Clickable screen hitboxes for country crests & flags
    this.crestHitboxes = [];
  }

  getBaseScale(viewW, viewH) {
    // On portrait mobile screens, prevent the map from shrinking into a tiny 180px horizontal ribbon
    return Math.max(viewW / MAP_W, (viewH * 0.68) / MAP_H);
  }

  getOrLoadImage(dataUrl, onLoadCallback) {
    if (!dataUrl) return null;
    let img = this.imgCache.get(dataUrl);
    if (!img) {
      img = new Image();
      if (onLoadCallback) {
        img.onload = onLoadCallback;
      }
      img.src = dataUrl;
      this.imgCache.set(dataUrl, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  _hexToRgb(hex) {
    if (!hex || typeof hex !== "string") return [251, 191, 36];
    const clean = hex.replace("#", "");
    if (clean.length === 6) {
      const num = parseInt(clean, 16);
      if (!Number.isNaN(num)) {
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
      }
    }
    return [251, 191, 36];
  }

  // Fast offscreen buffer update: only updates country bounding boxes when a pixel is conquered!
  updateTerritoryBuffer(engine) {
    const dst = this.imageData.data;
    const base = this.worldData.baseMapRgba;
    const owners = engine.owners;
    const bounds =
      engine.dirtyRegions || !engine.countryBounds
        ? engine.computeCountryBounds()
        : engine.countryBounds;
    const total = MAP_W * MAP_H;

    // Reset base grey map
    dst.set(base);

    for (const country of engine.countries) {
      if (country.landCount <= 0) continue;
      const cid = country.id;
      const b = bounds.get(cid);
      if (!b || b.count === 0 || b.maxX < b.minX) continue;

      const minX = Math.max(0, b.minX);
      const maxX = Math.min(MAP_W - 1, b.maxX);
      const minY = Math.max(0, b.minY);
      const maxY = Math.min(MAP_H - 1, b.maxY);
      const bw = Math.max(1, maxX - minX + 1);
      const bh = Math.max(1, maxY - minY + 1);

      const [br, bg, bb] = this._hexToRgb(country.color);
      const flagRgba = country.flagRgba;

      for (let y = minY; y <= maxY; y++) {
        const row = y * MAP_W;
        for (let x = minX; x <= maxX; x++) {
          const idx = row + x;
          if (owners[idx] !== cid) continue;

          const p4 = idx * 4;
          const isBorder =
            x === 0 ||
            x === MAP_W - 1 ||
            y === 0 ||
            y === MAP_H - 1 ||
            owners[idx - 1] !== cid ||
            owners[idx + 1] !== cid ||
            owners[idx - MAP_W] !== cid ||
            owners[idx + MAP_W] !== cid;

          if (isBorder && bw > 2 && bh > 2) {
            dst[p4] = br;
            dst[p4 + 1] = bg;
            dst[p4 + 2] = bb;
            dst[p4 + 3] = 255;
          } else if (flagRgba && bw <= 120 && bh <= 90) {
            // Fit the custom uploaded image pattern cleanly into the territory boundaries
            const flagAspect = FLAG_W / FLAG_H;
            const boxAspect = bw / bh;
            let normU = (x - minX + 0.5) / bw;
            let normV = (y - minY + 0.5) / bh;
            if (boxAspect > flagAspect) {
              const scaleFactor = boxAspect / flagAspect;
              normU = (normU - 0.5) * scaleFactor + 0.5;
            } else {
              const scaleFactor = flagAspect / boxAspect;
              normV = (normV - 0.5) * scaleFactor + 0.5;
            }
            normU = Math.max(0, Math.min(0.999, normU));
            normV = Math.max(0, Math.min(0.999, normV));
            const fx = (normU * FLAG_W) | 0;
            const fy = (normV * FLAG_H) | 0;

            const fp = (fy * FLAG_W + fx) * 4;
            dst[p4] = (flagRgba[fp] * 0.90 + br * 0.10) | 0;
            dst[p4 + 1] = (flagRgba[fp + 1] * 0.90 + bg * 0.10) | 0;
            dst[p4 + 2] = (flagRgba[fp + 2] * 0.90 + bb * 0.10) | 0;
            dst[p4 + 3] = 255;
          } else {
            // Very large empire territory: Solid, clean national territory color
            dst[p4] = (br * 0.90) | 0;
            dst[p4 + 1] = (bg * 0.90) | 0;
            dst[p4 + 2] = (bb * 0.90) | 0;
            dst[p4 + 3] = 255;
          }
        }
      }
    }

    // Render radioactive wasteland zones (scorched toxic soil)
    if (engine.isWasteland && engine.nuclearStrikes && engine.nuclearStrikes.length > 0) {
      for (let i = 0; i < total; i++) {
        if (engine.isWasteland[i]) {
          const p4 = i * 4;
          const noise = ((i * 1337 + 7) & 0x0f);
          dst[p4] = 20 + noise;     // Charred soot
          dst[p4 + 1] = 36 + noise; // Toxic irradiated olive/green
          dst[p4 + 2] = 22 + (noise >> 1);
          dst[p4 + 3] = 255;
        }
      }
    }

    this.bufferCtx.putImageData(this.imageData, 0, 0);
  }

  // Draw 60 FPS viewport frame (Zero Path2D clipping during pan/zoom!)
  renderFrame(ctx, viewW, viewH, camera, engine, opts = {}) {
    if (!ctx || !engine) return null;
    const { hoveredMapPos = null, toolMode = "CONQUER", isTargetingNuke = false } = opts || {};

    // Sanitize camera to prevent any NaN poisoning that causes black screen
    if (!camera || !Number.isFinite(camera.zoom) || camera.zoom <= 0) {
      if (camera) camera.zoom = 1.0;
    }
    if (!camera || !Number.isFinite(camera.panX)) {
      if (camera) camera.panX = 0;
    }
    if (!camera || !Number.isFinite(camera.panY)) {
      if (camera) camera.panY = 0;
    }

    try {
      if (engine.dirtyRegions) {
        engine.computeCountryBounds();
      }
      if (engine.dirtyPixels) {
        this.updateTerritoryBuffer(engine);
        engine.dirtyPixels = false;
      }

      // 1. Deep ocean background
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, viewW, viewH);

      // World transform
      const baseScale = this.getBaseScale(viewW, viewH) || 1.0;
      const safeZoom =
        Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1.0;
      const scale = baseScale * safeZoom;
      const mapScreenW = MAP_W * scale;
      const mapScreenH = MAP_H * scale;
      const originX =
        (viewW - mapScreenW) / 2 +
        (Number.isFinite(camera.panX) ? camera.panX : 0);
      const originY =
        (viewH - mapScreenH) / 2 +
        (Number.isFinite(camera.panY) ? camera.panY : 0);

      ctx.save();
      ctx.translate(originX, originY);

      // 2. Single hardware-accelerated drawImage call for the entire map + territories!
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.bufferCanvas, 0, 0, mapScreenW, mapScreenH);

      const bounds =
      engine.dirtyRegions || !engine.countryBounds
        ? engine.computeCountryBounds()
        : engine.countryBounds;

      // Reset hitboxes for this frame
      this.crestHitboxes = [];

      // 3. Crisp High-Resolution Country Crest / Emblem Banner in Territory
      // Only show center flag preview in PAN mode (hidden in CONQUER and NUKE targeting modes so it never blocks clicks!)
      const showCenterCrests = toolMode === "PAN" && !isTargetingNuke;
      for (const country of (showCenterCrests ? engine.countries : [])) {
        if (country.landCount <= 0) continue;
        const b = bounds.get(country.id);
        if (!b || b.count === 0) continue;

        // For large countries (>50 px), center the crest squarely in the heart of their territory
        // For small countries, place it at the capital
        let crestX = country.capitalX;
        let crestY = country.capitalY;
        const capIdx = crestY * MAP_W + crestX;
        const needsCentroid =
          country.landCount > 50 ||
          crestX == null ||
          crestY == null ||
          engine.owners[capIdx] !== country.id ||
          !this.worldData.isLand[capIdx];

        if (needsCentroid) {
          const targetX = Math.round(b.sumX / b.count);
          const targetY = Math.round(b.sumY / b.count);
          let bestDist = Infinity;
          let bestX = b.minX;
          let bestY = b.minY;

          for (let cy = b.minY; cy <= b.maxY; cy++) {
            const row = cy * MAP_W;
            for (let cx = b.minX; cx <= b.maxX; cx++) {
              if (engine.owners[row + cx] === country.id) {
                const dist = (cx - targetX) ** 2 + (cy - targetY) ** 2;
                if (dist < bestDist) {
                  bestDist = dist;
                  bestX = cx;
                  bestY = cy;
                }
              }
            }
          }
          crestX = bestX;
          crestY = bestY;
        }

        const sx = (crestX + 0.5) * scale;
        const sy = (crestY + 0.5) * scale;

        // Viewport culling
        if (
          sx + originX < -120 ||
          sx + originX > viewW + 120 ||
          sy + originY < -120 ||
          sy + originY > viewH + 120
        ) {
          continue;
        }

        const isMe = country.id === engine.myCountryId;
        const img = this.getOrLoadImage(country.flagDataUrl, () => {
          engine.dirtyPixels = true;
        });

        // Compute crest dimensions based on country size and camera scale
        const landFactor = Math.sqrt(country.landCount);
        // Base width proportional to territory size
        const baseW = Math.max(22, Math.min(110, 16 + landFactor * 0.9));
        // Screen width: grows naturally when zooming in (scale factor), but has a robust minimum (>= 38px)
        // so it NEVER becomes microscopic or shrinks when approaching
        const zoomFactor = Math.max(0.85, Math.min(2.8, scale));
        const screenW = Math.max(38, Math.min(220, Math.round(baseW * zoomFactor)));
        const screenH = Math.round(screenW * (FLAG_H / FLAG_W));

        // Register clickable screen hitbox
        const screenLeft = sx + originX - screenW / 2;
        const screenTop = sy + originY - screenH / 2;
        this.crestHitboxes.push({
          countryId: country.id,
          countryName: country.name,
          flagDataUrl: country.flagDataUrl,
          color: country.color,
          x: screenLeft,
          y: screenTop,
          w: screenW,
          h: screenH,
        });

        ctx.save();
        ctx.translate(sx, sy);

        // Elegant drop shadow
        ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
        ctx.shadowBlur = Math.min(10, 4 + scale);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        const halfW = screenW / 2;
        const halfH = screenH / 2;
        const radius = Math.max(3, Math.min(6, screenW * 0.12));

        // Base rounded rect
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(-halfW, -halfH, screenW, screenH, radius);
        } else {
          ctx.rect(-halfW, -halfH, screenW, screenH);
        }
        ctx.fillStyle = "#090d16";
        ctx.fill();

        const crestBorderColor = country.color || (isMe ? "#FBBF24" : "#94A3B8");
        ctx.strokeStyle = crestBorderColor;
        ctx.lineWidth = isMe ? 2.2 : 1.6;
        ctx.stroke();

        // Clip & draw high-resolution image with anti-aliasing
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.clip();
        if (img) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, -halfW, -halfH, screenW, screenH);
        } else {
          // Stylish fallback emblem so it's NEVER an invisible flat color box!
          const grad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
          grad.addColorStop(0, "#1e293b");
          grad.addColorStop(1, "#0f172a");
          ctx.fillStyle = grad;
          ctx.fillRect(-halfW, -halfH, screenW, screenH);

          // Country Initials
          ctx.fillStyle = country.color || "#FBBF24";
          ctx.font = `900 ${Math.max(9, Math.min(18, Math.round(screenH * 0.52)))}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const initials = (country.name || "D").slice(0, 3).toUpperCase();
          ctx.fillText(initials, 0, 1);
        }
        ctx.restore();

        // Overlay border stroke for razor-sharp edge
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = crestBorderColor;
        ctx.lineWidth = isMe ? 2.2 : 1.6;
        ctx.stroke();

        // Capital indicator badge (small star in top-left)
        if (country.capitalX === crestX && country.capitalY === crestY) {
          const starR = Math.max(3, Math.min(6, screenW * 0.11));
          ctx.fillStyle = "#FBBF24";
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(-halfW + starR + 2, -halfH + starR + 2, starR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      }

      // 3.5. Fixed Strategic Resources & Historic Capitals (Gold Mines, Oil Hubs, Wonders)
      if (engine.strategicNodes && engine.strategicNodes.length > 0) {
        const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 420);
        for (const node of engine.strategicNodes) {
          const sx = (node.x + 0.5) * scale;
          const sy = (node.y + 0.5) * scale;
          if (
            sx + originX < -60 ||
            sx + originX > viewW + 60 ||
            sy + originY < -60 ||
            sy + originY > viewH + 60
          ) {
            continue;
          }

          const ownerId = engine.owners[node.idx];
          const ownerCountry = ownerId > 0 ? engine.countryMap.get(ownerId) : null;
          const radius = Math.max(7, Math.min(14, 5.5 + scale * 1.15));

          let bg = "rgba(15, 23, 42, 0.92)";
          let accent = "#FBBF24";
          let glyph = "🪙";
          if (node.type === "OIL") {
            accent = "#38BDF8";
            glyph = "⛽";
          } else if (node.type === "WONDER") {
            accent = "#C084FC";
            glyph = "🏛️";
          }

          ctx.save();
          ctx.translate(sx, sy);

          // Subtle glowing ring
          ctx.beginPath();
          ctx.arc(0, 0, radius + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = ownerCountry ? (ownerCountry.color || accent) : accent;
          ctx.globalAlpha = ownerCountry ? 0.85 : pulse * 0.65;
          ctx.lineWidth = ownerCountry ? 2.2 : 1.4;
          ctx.stroke();
          ctx.globalAlpha = 1;

          // Badge circle
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.strokeStyle = ownerCountry ? (ownerCountry.color || accent) : accent;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Custom vector logos (zero emojis!)
          const ir = radius * 0.56;
          ctx.fillStyle = accent;
          ctx.strokeStyle = accent;
          ctx.lineWidth = Math.max(1.2, radius * 0.14);
          if (node.type === "GOLD") {
            // Custom Gold Ingot / Diamond Emblem
            ctx.beginPath();
            ctx.moveTo(0, -ir);
            ctx.lineTo(ir * 0.85, 0);
            ctx.lineTo(0, ir);
            ctx.lineTo(-ir * 0.85, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#FEF3C7";
            ctx.beginPath();
            ctx.moveTo(0, -ir * 0.55);
            ctx.lineTo(ir * 0.35, 0);
            ctx.lineTo(0, ir * 0.55);
            ctx.lineTo(-ir * 0.35, 0);
            ctx.closePath();
            ctx.fill();
          } else if (node.type === "OIL") {
            // Custom Oil Drop Emblem
            ctx.beginPath();
            ctx.moveTo(0, -ir);
            ctx.bezierCurveTo(ir * 0.9, -ir * 0.1, ir * 0.85, ir, 0, ir);
            ctx.bezierCurveTo(-ir * 0.85, ir, -ir * 0.9, -ir * 0.1, 0, -ir);
            ctx.closePath();
            ctx.fill();
          } else {
            // Custom Historic Capital Crown / Star Emblem
            ctx.beginPath();
            for (let k = 0; k < 5; k++) {
              const outerAngle = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
              const innerAngle = outerAngle + Math.PI / 5;
              const ox = Math.cos(outerAngle) * ir;
              const oy = Math.sin(outerAngle) * ir;
              const ix = Math.cos(innerAngle) * (ir * 0.45);
              const iy = Math.sin(innerAngle) * (ir * 0.45);
              if (k === 0) ctx.moveTo(ox, oy);
              else ctx.lineTo(ox, oy);
              ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            ctx.fill();
          }

          // Show name label when zoomed in
          if (scale >= 3.2) {
            ctx.font = "800 9px Inter, system-ui, sans-serif";
            const label = node.name;
            const tw = ctx.measureText(label).width + 10;
            const th = 14;
            ctx.fillStyle = "rgba(9, 13, 22, 0.88)";
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(-tw / 2, radius + 3, tw, th, 4);
            } else {
              ctx.rect(-tw / 2, radius + 3, tw, th);
            }
            ctx.fill();
            ctx.fillStyle = accent;
            ctx.fillText(label, 0, radius + 3 + th / 2);
          }

          ctx.restore();
        }
      }

      // 3.6. Tactical Nuclear Blast Radius Flashing Red Preview when targeting
      if (isTargetingNuke && hoveredMapPos && Number.isFinite(hoveredMapPos.x) && Number.isFinite(hoveredMapPos.y)) {
        const nx = (hoveredMapPos.x + 0.5) * scale;
        const ny = (hoveredMapPos.y + 0.5) * scale;
        const nukeRadiusPx = 6 * scale; // Matches 6-pixel blast radius in worldEngine
        const flash = 0.5 + 0.5 * Math.sin(Date.now() / 130);

        ctx.save();
        ctx.beginPath();
        ctx.arc(nx, ny, nukeRadiusPx, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.18 + flash * 0.24})`;
        ctx.fill();
        ctx.lineWidth = Math.max(2, 2.5);
        ctx.strokeStyle = `rgba(248, 113, 113, ${0.55 + flash * 0.45})`;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshair center
        ctx.beginPath();
        ctx.moveTo(nx - 8, ny);
        ctx.lineTo(nx + 8, ny);
        ctx.moveTo(nx, ny - 8);
        ctx.lineTo(nx, ny + 8);
        ctx.strokeStyle = "#FCA5A5";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }

      const myCountry = engine.getMyCountry();

      // 4. Active Conquerable Frontier Highlight (Shows all land border pixels you have troops to conquer!)
      if (myCountry && myCountry.troops >= 0.5) {
        const myB = bounds.get(myCountry.id);
        if (myB && myB.count > 0) {
          const owners = engine.owners;
          const isLand = this.worldData.isLand;
          const isWasteland = engine.isWasteland;
          const myId = myCountry.id;
          const troops = myCountry.troops;
          const siegeLvl = myCountry.upgrades?.siege || 0;
          const baseNeutralCost = Math.max(0.5, 1.0 - siegeLvl * 0.02);

          const minX = Math.max(0, myB.minX - 4);
          const maxX = Math.min(MAP_W - 1, myB.maxX + 4);
          const minY = Math.max(0, myB.minY - 4);
          const maxY = Math.min(MAP_H - 1, myB.maxY + 4);

          const pulse = 0.40 + 0.35 * Math.sin(Date.now() / 200);
          ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;

          for (let y = minY; y <= maxY; y++) {
            const py = y * scale;
            if (py + originY < -20 || py + originY > viewH + 20) continue;
            const row = y * MAP_W;
            for (let x = minX; x <= maxX; x++) {
              const idx = row + x;
              if (!isLand[idx] || owners[idx] === myId || (isWasteland && isWasteland[idx])) continue;

              const isAdj =
                (x > 0 && owners[idx - 1] === myId) ||
                (x < MAP_W - 1 && owners[idx + 1] === myId) ||
                (y > 0 && owners[idx - MAP_W] === myId) ||
                (y < MAP_H - 1 && owners[idx + MAP_W] === myId);

              if (!isAdj) continue;

              const enemyId = owners[idx];
              let cost = baseNeutralCost;
              if (enemyId > 0) {
                const def = engine.countryMap.get(enemyId);
                const fortLvl = def?.upgrades?.fortress || 0;
                cost = 2.0 + fortLvl * 0.25;
              }

              if (troops >= cost) {
                const px = x * scale;
                ctx.fillRect(px, py, Math.max(1.8, scale), Math.max(1.8, scale));
              }
            }
          }
        }
      }

      // 4.5. Radioactive Exclusion Zone Epic Markers
      if (Array.isArray(engine.nuclearStrikes)) {
        for (const strike of engine.nuclearStrikes) {
          const sx = (strike.x + 0.5) * scale;
          const sy = (strike.y + 0.5) * scale;
          if (sx + originX < -60 || sx + originX > viewW + 60 || sy + originY < -60 || sy + originY > viewH + 60) continue;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.fillStyle = "rgba(20, 83, 45, 0.88)";
          ctx.strokeStyle = "#4ade80";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#22c55e";
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 4.5. In-flight Parabolic Ballistic Nuclear Missiles with Dashed Trajectory
      if (Array.isArray(engine.nuclearMissiles) && engine.nuclearMissiles.length > 0) {
        const now = Date.now();
        for (const m of engine.nuclearMissiles) {
          const elapsed = now - m.startTime;
          if (elapsed < 0) continue;
          const progress = Math.min(1.0, elapsed / m.duration);

          const fromSx = (m.fromX + 0.5) * scale;
          const fromSy = (m.fromY + 0.5) * scale;
          const toSx = (m.toX + 0.5) * scale;
          const toSy = (m.toY + 0.5) * scale;

          // Parabolic arc height
          const dist = Math.hypot(toSx - fromSx, toSy - fromSy);
          const arcHeight = Math.min(120, Math.max(30, dist * 0.35));

          // Draw dashed trajectory path
          ctx.save();
          ctx.strokeStyle = "rgba(244, 63, 94, 0.75)";
          ctx.lineWidth = Math.max(1.5, scale * 0.35);
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(fromSx, fromSy);
          const cpX = (fromSx + toSx) / 2;
          const cpY = Math.min(fromSy, toSy) - arcHeight;
          ctx.quadraticCurveTo(cpX, cpY, toSx, toSy);
          ctx.stroke();
          ctx.restore();

          // Calculate current missile coordinates along bezier curve
          const t = progress;
          const curX = (1 - t) * (1 - t) * fromSx + 2 * (1 - t) * t * cpX + t * t * toSx;
          const curY = (1 - t) * (1 - t) * fromSy + 2 * (1 - t) * t * cpY + t * t * toSy;

          // Tangent angle
          const tangentX = 2 * (1 - t) * (cpX - fromSx) + 2 * t * (toSx - cpX);
          const tangentY = 2 * (1 - t) * (cpY - fromSy) + 2 * t * (toSy - cpY);
          const angle = Math.atan2(tangentY, tangentX);

          // Draw missile warhead icon & jet flame
          ctx.save();
          ctx.translate(curX, curY);
          ctx.rotate(angle);

          // Jet flame trail
          ctx.fillStyle = "rgba(251, 146, 60, 0.85)";
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(-20, -3.5);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-20, 3.5);
          ctx.closePath();
          ctx.fill();

          // Missile rocket body
          ctx.fillStyle = "#E2E8F0";
          ctx.strokeStyle = "#DC2626";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(2, -4);
          ctx.lineTo(-10, -4);
          ctx.lineTo(-10, 4);
          ctx.lineTo(2, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Red warhead tip
          ctx.fillStyle = "#EF4444";
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(2, -4);
          ctx.lineTo(2, 4);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
        engine.nuclearMissiles = engine.nuclearMissiles.filter((m) => now - m.startTime < m.duration + 100);
      }

      // 4.6. Real-time Nuclear Detonations, Realistic Mushroom Cloud & Shockwave
      if (Array.isArray(engine.activeExplosions) && engine.activeExplosions.length > 0) {
        const now = Date.now();
        for (const exp of engine.activeExplosions) {
          const elapsed = now - exp.startTime;
          if (elapsed < 0 || elapsed > exp.duration) continue;
          const progress = elapsed / exp.duration; // 0 to 1
          const sx = (exp.x + 0.5) * scale;
          const sy = (exp.y + 0.5) * scale;
          const maxScreenR = exp.radius * scale;
          const currentR = Math.max(2, maxScreenR * Math.sin(progress * Math.PI * 0.5));

          ctx.save();
          ctx.translate(sx, sy);

          // 1. Initial blinding flash (0 to 15%)
          if (progress < 0.15) {
            const flashAlpha = 1.0 - progress / 0.15;
            ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.95})`;
            ctx.beginPath();
            ctx.arc(0, 0, currentR * 1.8, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2. Rising Mushroom Cloud Stem and Cap (0.10 to 0.90)
          if (progress >= 0.08 && progress < 0.92) {
            const cloudProgress = (progress - 0.08) / 0.84;
            const cloudAlpha = Math.max(0, Math.sin(cloudProgress * Math.PI));
            const stemHeight = currentR * 1.35 * Math.min(1.0, cloudProgress * 1.8);
            const capRadius = currentR * 0.85;

            // Mushroom stem
            ctx.fillStyle = `rgba(180, 83, 9, ${cloudAlpha * 0.55})`;
            ctx.beginPath();
            ctx.moveTo(-currentR * 0.18, 0);
            ctx.lineTo(-currentR * 0.28, -stemHeight * 0.85);
            ctx.lineTo(currentR * 0.28, -stemHeight * 0.85);
            ctx.lineTo(currentR * 0.18, 0);
            ctx.closePath();
            ctx.fill();

            // Mushroom cap (multi-lobed cauliflower cloud head)
            ctx.save();
            ctx.translate(0, -stemHeight);
            const capGrad = ctx.createRadialGradient(0, -capRadius * 0.2, capRadius * 0.1, 0, 0, capRadius);
            capGrad.addColorStop(0, `rgba(254, 240, 138, ${cloudAlpha * 0.95})`);
            capGrad.addColorStop(0.35, `rgba(249, 115, 22, ${cloudAlpha * 0.85})`);
            capGrad.addColorStop(0.7, `rgba(220, 38, 38, ${cloudAlpha * 0.75})`);
            capGrad.addColorStop(1, `rgba(67, 20, 7, ${cloudAlpha * 0.4})`);
            ctx.fillStyle = capGrad;

            // Cap lobes
            ctx.beginPath();
            ctx.arc(0, -capRadius * 0.3, capRadius * 0.65, 0, Math.PI * 2);
            ctx.arc(-capRadius * 0.5, 0, capRadius * 0.55, 0, Math.PI * 2);
            ctx.arc(capRadius * 0.5, 0, capRadius * 0.55, 0, Math.PI * 2);
            ctx.arc(0, 0, capRadius * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // 3. Ground Fireball Core
          const fireAlpha = Math.max(0, 1.0 - progress);
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentR);
          grad.addColorStop(0, `rgba(255, 255, 255, ${fireAlpha})`);
          grad.addColorStop(0.3, `rgba(245, 158, 11, ${fireAlpha * 0.9})`);
          grad.addColorStop(0.7, `rgba(220, 38, 38, ${fireAlpha * 0.7})`);
          grad.addColorStop(1, `rgba(75, 85, 99, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, currentR, 0, Math.PI * 2);
          ctx.fill();

          // 4. Supersonic shockwave ring
          ctx.strokeStyle = `rgba(251, 191, 36, ${fireAlpha * 0.95})`;
          ctx.lineWidth = Math.max(2, 6 * (1 - progress));
          ctx.beginPath();
          ctx.arc(0, 0, currentR, 0, Math.PI * 2);
          ctx.stroke();

          // 5. Toxic radioactive fallout aura
          if (progress > 0.25) {
            const smokeAlpha = (1 - progress) * 0.65;
            ctx.fillStyle = `rgba(34, 197, 94, ${smokeAlpha})`;
            ctx.beginPath();
            ctx.arc(0, 0, currentR * 0.75, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
        engine.activeExplosions = engine.activeExplosions.filter((e) => now - e.startTime < e.duration);
      }

      // 5. Render Active Naval Ships Sailing Across Seas
      if (Array.isArray(engine.ships) && engine.ships.length > 0) {
        for (const ship of engine.ships) {
          const fromSx = (ship.fromX + 0.5) * scale;
          const fromSy = (ship.fromY + 0.5) * scale;
          const toSx = (ship.toX + 0.5) * scale;
          const toSy = (ship.toY + 0.5) * scale;
          const curSx = (ship.x + 0.5) * scale;
          const curSy = (ship.y + 0.5) * scale;

          ctx.save();
          ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(fromSx, fromSy);
          ctx.lineTo(toSx, toSy);
          ctx.stroke();

          const sz = Math.max(10, Math.min(18, scale * 1.8));
          ctx.translate(curSx, curSy);

          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.85, 0, Math.PI * 2);
          ctx.fillStyle = "#082F49";
          ctx.fill();
          ctx.strokeStyle = ship.color || "#38BDF8";
          ctx.lineWidth = 1.6;
          ctx.stroke();

          ctx.fillStyle = "#F8FAFC";
          ctx.beginPath();
          ctx.moveTo(0, -sz * 0.5);
          ctx.lineTo(sz * 0.45, sz * 0.15);
          ctx.lineTo(-sz * 0.45, sz * 0.15);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // 6. Clean Country Name & Flag Pill Above Territory
      for (const country of engine.countries) {
        if (country.landCount <= 0) continue;
        const b = bounds.get(country.id);
        if (!b || b.count === 0) continue;

        const centerX = ((b.minX + b.maxX + 1) / 2) * scale;
        const topY = b.minY * scale;

        if (
          centerX + originX < -100 ||
          centerX + originX > viewW + 100 ||
          topY + originY < -50 ||
          topY + originY > viewH + 50
        ) {
          continue;
        }

        const isMe = country.id === engine.myCountryId;
        ctx.save();
        const fontSize = 11;
        ctx.font = "800 11px Inter, system-ui, sans-serif";
        const label = `${country.name} (${country.landCount} px · ${Math.floor(country.troops)} Asker)`;
        const flagThumbW = 20;
        const flagThumbH = 13;
        const textW = ctx.measureText(label).width;
        const tw = textW + flagThumbW + 18;
        const th = 22;
        const labelY = topY - th - 6;
        const pillX = centerX - tw / 2;

        const pillBorderColor = country.color || (isMe ? "#FBBF24" : "#94A3B8");
        ctx.fillStyle = "rgba(9, 13, 22, 0.92)";
        ctx.strokeStyle = pillBorderColor;
        ctx.lineWidth = isMe ? 1.8 : 1.3;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(pillX, labelY, tw, th, 6);
        } else {
          ctx.rect(pillX, labelY, tw, th);
        }
        ctx.fill();
        ctx.stroke();

        const img = this.getOrLoadImage(country.flagDataUrl);
        const thumbX = pillX + 5;
        const thumbY = labelY + (th - flagThumbH) / 2;
        if (img) {
          ctx.save();
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(thumbX, thumbY, flagThumbW, flagThumbH, 2.5);
          } else {
            ctx.rect(thumbX, thumbY, flagThumbW, flagThumbH);
          }
          ctx.clip();
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, thumbX, thumbY, flagThumbW, flagThumbH);
          ctx.restore();
        } else {
          ctx.fillStyle = country.color || "#E11D48";
          ctx.fillRect(thumbX, thumbY, flagThumbW, flagThumbH);
        }

        ctx.fillStyle = isMe ? "#FDE68A" : "#F1F5F9";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, thumbX + flagThumbW + 6, labelY + th / 2);
        ctx.restore();
      }

      ctx.restore();

      return { scale, originX, originY, mapScreenW, mapScreenH };
    } catch (err) {
      console.error("[WorldRenderer] renderFrame error:", err);
      try {
        ctx.restore();
      } catch {}
      return null;
    }
  }

  // Find crest hitbox clicked by player on screen
  getHitCrest(clientX, clientY, canvas) {
    if (!canvas || !this.crestHitboxes || this.crestHitboxes.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Check hitboxes from front to back
    for (let i = this.crestHitboxes.length - 1; i >= 0; i--) {
      const hb = this.crestHitboxes[i];
      if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
        return hb;
      }
    }
    return null;
  }
}
