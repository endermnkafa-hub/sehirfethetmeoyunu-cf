// Ultra-Crisp 1000x500 Minimalist Grey Earth World Map Rasterizer
// Uses real Natural Earth TopoJSON geometry from world-atlas (100% offline)

import { feature } from 'topojson-client';
import countriesAtlas from 'world-atlas/countries-110m.json' with { type: 'json' };

export const MAP_W = 1000;
export const MAP_H = 500;

const LAT_MAX = 79;
const LAT_MIN = -56;

function millerY(latDeg) {
  const rad = (latDeg * Math.PI) / 180;
  return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * rad));
}

const M_MAX = millerY(LAT_MAX);
const M_MIN = millerY(LAT_MIN);

export function lonLatToMapXY(lon, lat) {
  const clampedLat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
  const x = ((lon + 180) / 360) * MAP_W;
  const y = ((M_MAX - millerY(clampedLat)) / (M_MAX - M_MIN)) * MAP_H;
  return [x, y];
}

export function mapXYToLonLat(x, y) {
  const lon = (x / MAP_W) * 360 - 180;
  const my = M_MAX - (y / MAP_H) * (M_MAX - M_MIN);
  const rad = 2.5 * (Math.atan(Math.exp(0.8 * my)) - Math.PI / 4);
  const lat = (rad * 180) / Math.PI;
  return [lon, lat];
}

// Smooth deterministic 2D noise for organic subtle relief
function hash2(ix, iy) {
  let n = ix * 374761393 + iy * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y) {
  return (
    smoothNoise(x * 0.045, y * 0.045) * 0.52 +
    smoothNoise(x * 0.11, y * 0.11) * 0.30 +
    smoothNoise(x * 0.24, y * 0.24) * 0.18
  );
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

let cachedWorldData = null;

export function getWorldRasterData() {
  if (cachedWorldData) return cachedWorldData;

  const countriesGeo = feature(countriesAtlas, countriesAtlas.objects.countries);

  // Offscreen canvas to rasterize each country geometry
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  const countryList = [];

  function drawRing(ring) {
    if (!ring || ring.length < 3) return;
    let started = false;
    let prevLon = null;
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const [px, py] = lonLatToMapXY(lon, lat);
      if (!started || (prevLon !== null && Math.abs(lon - prevLon) > 180)) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
      prevLon = lon;
    }
    ctx.closePath();
  }

  let cid = 1;
  for (const feat of countriesGeo.features) {
    if (feat.id === '010' || feat.id === '260') continue;
    const geom = feat.geometry;
    if (!geom) continue;

    const r = cid & 255;
    const g = (cid >> 8) & 255;
    ctx.fillStyle = `rgb(${r},${g},128)`;

    ctx.beginPath();
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) drawRing(ring);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) drawRing(ring);
      }
    }
    ctx.fill();

    countryList[cid] = {
      cid,
      isoId: feat.id,
      name: feat.properties?.name || `Bölge ${cid}`,
    };
    cid++;
  }

  const raw = ctx.getImageData(0, 0, MAP_W, MAP_H).data;
  const total = MAP_W * MAP_H;
  const isLand = new Uint8Array(total);
  const countryMask = new Uint16Array(total);
  let totalLandPixels = 0;

  for (let i = 0; i < total; i++) {
    const b = raw[i * 4 + 2];
    if (b > 64) {
      const id = raw[i * 4] | (raw[i * 4 + 1] << 8);
      if (id > 0) {
        isLand[i] = 1;
        countryMask[i] = id;
        totalLandPixels++;
      }
    }
  }

  // Open narrow navigable canals (Suez & Panama)
  const canals = [
    [32.5, 30.2], // Suez
    [-79.8, 9.1], // Panama
  ];
  for (const [clon, clat] of canals) {
    const [cx, cy] = lonLatToMapXY(clon, clat);
    const ix = Math.round(cx);
    const iy = Math.round(cy);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (ny >= 0 && ny < MAP_H && nx >= 0 && nx < MAP_W) {
          const idx = ny * MAP_W + nx;
          if (isLand[idx]) {
            isLand[idx] = 0;
            countryMask[idx] = 0;
            totalLandPixels--;
          }
        }
      }
    }
  }

  // Ocean distance from coast (BFS) for subtle depth gradient
  const oceanDepth = new Uint8Array(total);
  oceanDepth.fill(255);
  const bfsQueue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  for (let i = 0; i < total; i++) {
    if (isLand[i]) {
      oceanDepth[i] = 0;
      bfsQueue[qTail++] = i;
    }
  }

  while (qHead < qTail) {
    const cur = bfsQueue[qHead++];
    const curD = oceanDepth[cur];
    if (curD >= 20) continue;
    const x = cur % MAP_W;
    const y = (cur / MAP_W) | 0;

    if (x > 0 && oceanDepth[cur - 1] === 255) { oceanDepth[cur - 1] = curD + 1; bfsQueue[qTail++] = cur - 1; }
    if (x < MAP_W - 1 && oceanDepth[cur + 1] === 255) { oceanDepth[cur + 1] = curD + 1; bfsQueue[qTail++] = cur + 1; }
    if (y > 0 && oceanDepth[cur - MAP_W] === 255) { oceanDepth[cur - MAP_W] = curD + 1; bfsQueue[qTail++] = cur - MAP_W; }
    if (y < MAP_H - 1 && oceanDepth[cur + MAP_W] === 255) { oceanDepth[cur + MAP_W] = curD + 1; bfsQueue[qTail++] = cur + MAP_W; }
  }

  // Build Sleek Minimalist GREY Earth Base Map ("hayvan kadar gri bir dunya haritasi")
  const baseMapRgba = new Uint8ClampedArray(total * 4);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const idx = y * MAP_W + x;
      const p4 = idx * 4;

      if (!isLand[idx]) {
        // Deep midnight slate ocean
        const d = oceanDepth[idx];
        let r, g, b;
        if (d <= 2) {
          r = 16; g = 22; b = 34; // Shallow coastal shelf
        } else if (d <= 6) {
          const t = (d - 2) / 4;
          r = lerp(16, 12, t);
          g = lerp(22, 16, t);
          b = lerp(34, 26, t);
        } else {
          r = 10; g = 14; b = 23; // Deep open ocean
        }

        const wave = Math.sin(x * 0.12 + y * 0.08) * 1.0;
        baseMapRgba[p4] = Math.max(0, Math.min(255, r + wave));
        baseMapRgba[p4 + 1] = Math.max(0, Math.min(255, g + wave));
        baseMapRgba[p4 + 2] = Math.max(0, Math.min(255, b + wave * 1.2));
        baseMapRgba[p4 + 3] = 255;
      } else {
        // Sleek, high-contrast GRAPHITE GREY neutral land
        const n = fbm(x, y);

        // Subtle topographic relief so continents have texture
        let r = 50 + (n - 0.5) * 8;
        let g = 56 + (n - 0.5) * 8;
        let b = 68 + (n - 0.5) * 8;

        const myCid = countryMask[idx];
        const touchesWater =
          (x > 0 && !isLand[idx - 1]) ||
          (x < MAP_W - 1 && !isLand[idx + 1]) ||
          (y > 0 && !isLand[idx - MAP_W]) ||
          (y < MAP_H - 1 && !isLand[idx + MAP_W]);

        const touchesOtherCountry =
          !touchesWater &&
          ((x < MAP_W - 1 && isLand[idx + 1] && countryMask[idx + 1] !== myCid) ||
            (y < MAP_H - 1 && isLand[idx + MAP_W] && countryMask[idx + MAP_W] !== myCid));

        if (touchesWater) {
          // Coastline shadow
          r *= 0.65; g *= 0.68; b *= 0.72;
        } else if (touchesOtherCountry) {
          // Country border groove
          r *= 0.82; g *= 0.82; b *= 0.82;
        }

        baseMapRgba[p4] = Math.max(0, Math.min(255, r));
        baseMapRgba[p4 + 1] = Math.max(0, Math.min(255, g));
        baseMapRgba[p4 + 2] = Math.max(0, Math.min(255, b));
        baseMapRgba[p4 + 3] = 255;
      }
    }
  }

  cachedWorldData = {
    width: MAP_W,
    height: MAP_H,
    isLand,
    countryMask,
    countryList,
    oceanDepth,
    baseMapRgba,
    totalLandPixels,
  };
  return cachedWorldData;
}

export function findNearestLand(x, y, isLand, maxRadius = 16) {
  const ix = Math.max(0, Math.min(MAP_W - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(MAP_H - 1, Math.round(y)));
  if (isLand[iy * MAP_W + ix]) return { x: ix, y: iy };

  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && isLand[ny * MAP_W + nx]) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return null;
}
