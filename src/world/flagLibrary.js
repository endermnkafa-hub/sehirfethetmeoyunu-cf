// Crisp Offline-First Flag Library & Custom Image Buffer Decoder
// Renders clean, CORS-free 256x160 RGBA flag buffers for real-time pixel-clipped world territory fills

export const FLAG_W = 256;
export const FLAG_H = 160;

// Convert any HTMLImageElement or HTMLCanvasElement to a FLAG_W x FLAG_H RGBA Uint8ClampedArray
export function canvasToFlagBuffer(source) {
  const c = document.createElement('canvas');
  c.width = FLAG_W;
  c.height = FLAG_H;
  const ctx = c.getContext('2d', { willReadFrequently: true });

  // Cover-fit image into FLAG_W x FLAG_H so it never stretches weirdly
  const sw = source.naturalWidth || source.width || FLAG_W;
  const sh = source.naturalHeight || source.height || FLAG_H;
  const srcRatio = sw / sh;
  const dstRatio = FLAG_W / FLAG_H;

  let drawW = FLAG_W;
  let drawH = FLAG_H;
  let offsetX = 0;
  let offsetY = 0;

  if (srcRatio > dstRatio) {
    drawH = FLAG_H;
    drawW = FLAG_H * srcRatio;
    offsetX = -(drawW - FLAG_W) / 2;
  } else {
    drawW = FLAG_W;
    drawH = FLAG_W / srcRatio;
    offsetY = -(drawH - FLAG_H) / 2;
  }

  ctx.drawImage(source, offsetX, offsetY, drawW, drawH);
  return {
    rgba: ctx.getImageData(0, 0, FLAG_W, FLAG_H).data,
    dataUrl: c.toDataURL('image/png'),
  };
}

export function loadDataUrlToFlagBuffer(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        resolve(canvasToFlagBuffer(img));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Helper: Draw a 5-point star
function drawStar(ctx, cx, cy, outerR, innerR, color, rotation = -Math.PI / 2) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = rotation + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Helper: Draw Crescent & Star
function drawCrescentStar(ctx, cx, cy, r, bgColor, fgColor, starOffsetX = r * 1.15) {
  ctx.save();
  ctx.fillStyle = fgColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cx + r * 0.25, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fill();

  drawStar(ctx, cx + starOffsetX, cy, r * 0.45, r * 0.19, fgColor, -Math.PI / 5);
  ctx.restore();
}

// Procedural high-contrast vector flags rendered to 128x80 canvas (100% offline, instant, zero CORS taint)
const FLAG_DRAWERS = {
  tr(ctx, w, h) {
    ctx.fillStyle = '#E30A17';
    ctx.fillRect(0, 0, w, h);
    drawCrescentStar(ctx, w * 0.42, h * 0.5, h * 0.26, '#E30A17', '#FFFFFF', h * 0.34);
  },
  az(ctx, w, h) {
    ctx.fillStyle = '#00B5E2'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#EF3340'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#509E2F'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
    drawCrescentStar(ctx, w * 0.48, h * 0.5, h * 0.13, '#EF3340', '#FFFFFF', h * 0.16);
  },
  de(ctx, w, h) {
    ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#DD0000'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#FFCE00'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
  },
  fr(ctx, w, h) {
    ctx.fillStyle = '#002395'; ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = '#ED2939'; ctx.fillRect((w * 2) / 3, 0, w / 3, h);
  },
  it(ctx, w, h) {
    ctx.fillStyle = '#009246'; ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = '#CE2B37'; ctx.fillRect((w * 2) / 3, 0, w / 3, h);
  },
  es(ctx, w, h) {
    ctx.fillStyle = '#AA151B'; ctx.fillRect(0, 0, w, h * 0.25);
    ctx.fillStyle = '#F1BF00'; ctx.fillRect(0, h * 0.25, w, h * 0.5);
    ctx.fillStyle = '#AA151B'; ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.fillStyle = '#AA151B'; ctx.fillRect(w * 0.25, h * 0.36, w * 0.12, h * 0.28);
    ctx.fillStyle = '#F1BF00'; ctx.fillRect(w * 0.28, h * 0.42, w * 0.06, h * 0.16);
  },
  gb(ctx, w, h) {
    ctx.fillStyle = '#012169'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = h * 0.18;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
    ctx.strokeStyle = '#C8102E'; ctx.lineWidth = h * 0.08;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, h * 0.36, w, h * 0.28);
    ctx.fillRect(w * 0.41, 0, w * 0.18, h);
    ctx.fillStyle = '#C8102E';
    ctx.fillRect(0, h * 0.41, w, h * 0.18);
    ctx.fillRect(w * 0.44, 0, w * 0.12, h);
  },
  ru(ctx, w, h) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#0039A6'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#D52B1E'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
  },
  ua(ctx, w, h) {
    ctx.fillStyle = '#005BBB'; ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#FFD500'; ctx.fillRect(0, h / 2, w, h / 2);
  },
  pl(ctx, w, h) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#DC143C'; ctx.fillRect(0, h / 2, w, h / 2);
  },
  se(ctx, w, h) {
    ctx.fillStyle = '#006AA7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FECC00';
    ctx.fillRect(w * 0.3, 0, w * 0.14, h);
    ctx.fillRect(0, h * 0.4, w, h * 0.2);
  },
  no(ctx, w, h) {
    ctx.fillStyle = '#BA0C2F'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(w * 0.28, 0, w * 0.18, h);
    ctx.fillRect(0, h * 0.38, w, h * 0.24);
    ctx.fillStyle = '#00205B';
    ctx.fillRect(w * 0.32, 0, w * 0.1, h);
    ctx.fillRect(0, h * 0.44, w, h * 0.12);
  },
  gr(ctx, w, h) {
    const sh = h / 9;
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0D5EAF' : '#FFFFFF';
      ctx.fillRect(0, i * sh, w, sh + 0.5);
    }
    ctx.fillStyle = '#0D5EAF'; ctx.fillRect(0, 0, h * 0.56, h * 0.56);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(h * 0.22, 0, h * 0.12, h * 0.56);
    ctx.fillRect(0, h * 0.22, h * 0.56, h * 0.12);
  },
  us(ctx, w, h) {
    const sh = h / 13;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#FFFFFF';
      ctx.fillRect(0, i * sh, w, sh + 0.5);
    }
    ctx.fillStyle = '#3C3B6E';
    ctx.fillRect(0, 0, w * 0.42, sh * 7);
    ctx.fillStyle = '#FFFFFF';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillRect(w * 0.04 + c * w * 0.065, h * 0.05 + r * h * 0.095, 2.2, 2.2);
      }
    }
  },
  ca(ctx, w, h) {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, w * 0.26, h);
    ctx.fillRect(w * 0.74, 0, w * 0.26, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(w * 0.26, 0, w * 0.48, h);
    drawStar(ctx, w * 0.5, h * 0.5, h * 0.26, h * 0.13, '#FF0000');
  },
  mx(ctx, w, h) {
    ctx.fillStyle = '#006847'; ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = '#CE1126'; ctx.fillRect((w * 2) / 3, 0, w / 3, h);
    ctx.fillStyle = '#8B5A2B';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.13, 0, Math.PI * 2); ctx.fill();
  },
  br(ctx, w, h) {
    ctx.fillStyle = '#009C3B'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFDF00';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.1);
    ctx.lineTo(w * 0.88, h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.9);
    ctx.lineTo(w * 0.12, h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#002776';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.37, h * 0.46); ctx.quadraticCurveTo(w * 0.5, h * 0.55, w * 0.63, h * 0.52); ctx.stroke();
  },
  ar(ctx, w, h) {
    ctx.fillStyle = '#74ACDF'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#74ACDF'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
    ctx.fillStyle = '#F6B40E';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.12, 0, Math.PI * 2); ctx.fill();
  },
  co(ctx, w, h) {
    ctx.fillStyle = '#FCD116'; ctx.fillRect(0, 0, w, h * 0.5);
    ctx.fillStyle = '#003893'; ctx.fillRect(0, h * 0.5, w, h * 0.25);
    ctx.fillStyle = '#CE1126'; ctx.fillRect(0, h * 0.75, w, h * 0.25);
  },
  jp(ctx, w, h) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#BC002D';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.28, 0, Math.PI * 2); ctx.fill();
  },
  cn(ctx, w, h) {
    ctx.fillStyle = '#DE2910'; ctx.fillRect(0, 0, w, h);
    drawStar(ctx, w * 0.2, h * 0.28, h * 0.16, h * 0.065, '#FFDE00');
    drawStar(ctx, w * 0.34, h * 0.16, h * 0.055, h * 0.025, '#FFDE00');
    drawStar(ctx, w * 0.38, h * 0.28, h * 0.055, h * 0.025, '#FFDE00');
    drawStar(ctx, w * 0.36, h * 0.42, h * 0.055, h * 0.025, '#FFDE00');
    drawStar(ctx, w * 0.28, h * 0.48, h * 0.055, h * 0.025, '#FFDE00');
  },
  in(ctx, w, h) {
    ctx.fillStyle = '#FF9933'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#138808'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
    ctx.strokeStyle = '#000080'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.13, 0, Math.PI * 2); ctx.stroke();
  },
  kr(ctx, w, h) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#CD2E3A';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.22, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#0047A0';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.22, 0, Math.PI); ctx.fill();
  },
  kz(ctx, w, h) {
    ctx.fillStyle = '#00AFCA'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FEC50C';
    ctx.beginPath(); ctx.arc(w * 0.52, h * 0.45, h * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(w * 0.08, h * 0.1, w * 0.07, h * 0.8);
  },
  sa(ctx, w, h) {
    ctx.fillStyle = '#006C35'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(w * 0.24, h * 0.34, w * 0.52, h * 0.12);
    ctx.fillRect(w * 0.28, h * 0.56, w * 0.44, h * 0.08);
  },
  ir(ctx, w, h) {
    ctx.fillStyle = '#239F40'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#DA0000'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
    ctx.fillStyle = '#DA0000';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.11, 0, Math.PI * 2); ctx.fill();
  },
  eg(ctx, w, h) {
    ctx.fillStyle = '#CE1126'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#111111'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
    ctx.fillStyle = '#C09300';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.1, 0, Math.PI * 2); ctx.fill();
  },
  ma(ctx, w, h) {
    ctx.fillStyle = '#C1272D'; ctx.fillRect(0, 0, w, h);
    drawStar(ctx, w * 0.5, h * 0.5, h * 0.24, h * 0.1, '#006233');
  },
  ng(ctx, w, h) {
    ctx.fillStyle = '#008751'; ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = '#008751'; ctx.fillRect((w * 2) / 3, 0, w / 3, h);
  },
  za(ctx, w, h) {
    ctx.fillStyle = '#E03C31'; ctx.fillRect(0, 0, w, h * 0.5);
    ctx.fillStyle = '#001489'; ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = h * 0.28;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.42, h * 0.5); ctx.lineTo(0, h); ctx.moveTo(w * 0.42, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
    ctx.strokeStyle = '#007749'; ctx.lineWidth = h * 0.18;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.42, h * 0.5); ctx.lineTo(0, h); ctx.moveTo(w * 0.42, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
    ctx.fillStyle = '#111111';
    ctx.beginPath(); ctx.moveTo(0, h * 0.18); ctx.lineTo(w * 0.25, h * 0.5); ctx.lineTo(0, h * 0.82); ctx.closePath(); ctx.fill();
  },
  et(ctx, w, h) {
    ctx.fillStyle = '#078930'; ctx.fillRect(0, 0, w, h / 3);
    ctx.fillStyle = '#FCDD09'; ctx.fillRect(0, h / 3, w, h / 3);
    ctx.fillStyle = '#DA121A'; ctx.fillRect(0, (h * 2) / 3, w, h / 3);
    ctx.fillStyle = '#0F47AF';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.18, 0, Math.PI * 2); ctx.fill();
    drawStar(ctx, w * 0.5, h * 0.5, h * 0.13, h * 0.055, '#FCDD09');
  },
  id(ctx, w, h) {
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, h / 2, w, h / 2);
  },
  au(ctx, w, h) {
    ctx.fillStyle = '#00008B'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(0.45, 0.45);
    FLAG_DRAWERS.gb(ctx, w, h);
    ctx.restore();
    drawStar(ctx, w * 0.24, h * 0.72, h * 0.12, h * 0.055, '#FFFFFF');
    drawStar(ctx, w * 0.74, h * 0.25, h * 0.08, h * 0.035, '#FFFFFF');
    drawStar(ctx, w * 0.82, h * 0.45, h * 0.07, h * 0.03, '#FFFFFF');
    drawStar(ctx, w * 0.68, h * 0.52, h * 0.07, h * 0.03, '#FFFFFF');
    drawStar(ctx, w * 0.74, h * 0.74, h * 0.09, h * 0.04, '#FFFFFF');
  },
};

const flagCache = new Map();

export function getPresetFlag(code) {
  if (flagCache.has(code)) return flagCache.get(code);
  const c = document.createElement('canvas');
  c.width = FLAG_W;
  c.height = FLAG_H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const drawer = FLAG_DRAWERS[code] || FLAG_DRAWERS.tr;
  drawer(ctx, FLAG_W, FLAG_H);
  const result = {
    rgba: ctx.getImageData(0, 0, FLAG_W, FLAG_H).data,
    dataUrl: c.toDataURL('image/png'),
  };
  flagCache.set(code, result);
  return result;
}

export const PRESET_PLAYER_FLAGS = [
  { code: 'tr', name: 'Türkiye', color: '#E30A17' },
  { code: 'az', name: 'Azerbaycan', color: '#00B5E2' },
  { code: 'de', name: 'Almanya', color: '#FFCE00' },
  { code: 'us', name: 'ABD', color: '#3C3B6E' },
  { code: 'gb', name: 'Birleşik Krallık', color: '#012169' },
  { code: 'jp', name: 'Japonya', color: '#BC002D' },
  { code: 'br', name: 'Brezilya', color: '#009C3B' },
  { code: 'fr', name: 'Fransa', color: '#002395' },
  { code: 'it', name: 'İtalya', color: '#009246' },
  { code: 'ru', name: 'Rusya', color: '#0039A6' },
  { code: 'kz', name: 'Kazakistan', color: '#00AFCA' },
  { code: 'es', name: 'İspanya', color: '#F1BF00' },
];

// World AI Factions with authentic geographic spawn coordinates (lon, lat)
export const WORLD_AI_NATIONS = [
  { key: 'de', name: 'Almanya', color: '#EAB308', lon: 10.4, lat: 51.1, personality: 'EXPANSIONIST' },
  { key: 'fr', name: 'Fransa', color: '#2563EB', lon: 2.2, lat: 46.6, personality: 'BALANCED' },
  { key: 'gb', name: 'Britanya', color: '#1D4ED8', lon: -1.8, lat: 52.8, personality: 'NAVAL' },
  { key: 'es', name: 'İspanya', color: '#F59E0B', lon: -3.7, lat: 40.4, personality: 'NAVAL' },
  { key: 'it', name: 'İtalya', color: '#16A34A', lon: 12.6, lat: 42.8, personality: 'BALANCED' },
  { key: 'se', name: 'İsveç', color: '#0284C7', lon: 15.5, lat: 62.0, personality: 'DEFENSIVE' },
  { key: 'pl', name: 'Polonya', color: '#DC2626', lon: 19.1, lat: 52.1, personality: 'BALANCED' },
  { key: 'ua', name: 'Ukrayna', color: '#3B82F6', lon: 31.2, lat: 48.8, personality: 'DEFENSIVE' },
  { key: 'ru', name: 'Rusya', color: '#1E40AF', lon: 55.0, lat: 58.0, personality: 'EXPANSIONIST' },
  { key: 'tr', name: 'Anadolu', color: '#E11D48', lon: 34.0, lat: 39.2, personality: 'BALANCED' },
  { key: 'gr', name: 'Yunanistan', color: '#0EA5E9', lon: 22.0, lat: 39.1, personality: 'NAVAL' },
  { key: 'eg', name: 'Mısır', color: '#D97706', lon: 30.8, lat: 26.8, personality: 'BALANCED' },
  { key: 'ma', name: 'Fas', color: '#B91C1C', lon: -6.5, lat: 32.0, personality: 'BALANCED' },
  { key: 'ng', name: 'Nijerya', color: '#059669', lon: 8.6, lat: 9.1, personality: 'EXPANSIONIST' },
  { key: 'et', name: 'Etiyopya', color: '#65A30D', lon: 39.5, lat: 9.0, personality: 'DEFENSIVE' },
  { key: 'za', name: 'Güney Afrika', color: '#10B981', lon: 24.5, lat: -29.0, personality: 'BALANCED' },
  { key: 'sa', name: 'Arabistan', color: '#15803D', lon: 45.0, lat: 24.0, personality: 'DEFENSIVE' },
  { key: 'ir', name: 'İran', color: '#16A34A', lon: 53.6, lat: 32.4, personality: 'EXPANSIONIST' },
  { key: 'kz', name: 'Kazakistan', color: '#06B6D4', lon: 67.0, lat: 48.0, personality: 'EXPANSIONIST' },
  { key: 'in', name: 'Hindistan', color: '#EA580C', lon: 78.9, lat: 21.5, personality: 'EXPANSIONIST' },
  { key: 'cn', name: 'Çin', color: '#DC2626', lon: 105.0, lat: 35.0, personality: 'EXPANSIONIST' },
  { key: 'jp', name: 'Japonya', color: '#EF4444', lon: 138.2, lat: 36.2, personality: 'NAVAL' },
  { key: 'kr', name: 'Kore', color: '#2563EB', lon: 127.7, lat: 36.5, personality: 'DEFENSIVE' },
  { key: 'id', name: 'Endonezya', color: '#E11D48', lon: 113.9, lat: -2.0, personality: 'NAVAL' },
  { key: 'au', name: 'Avustralya', color: '#1D4ED8', lon: 134.0, lat: -25.0, personality: 'NAVAL' },
  { key: 'us', name: 'Amerika', color: '#2563EB', lon: -98.5, lat: 39.5, personality: 'EXPANSIONIST' },
  { key: 'ca', name: 'Kanada', color: '#DC2626', lon: -106.0, lat: 57.0, personality: 'DEFENSIVE' },
  { key: 'mx', name: 'Meksika', color: '#16A34A', lon: -102.5, lat: 23.6, personality: 'BALANCED' },
  { key: 'br', name: 'Brezilya', color: '#10B981', lon: -51.9, lat: -14.2, personality: 'EXPANSIONIST' },
  { key: 'ar', name: 'Arjantin', color: '#38BDF8', lon: -64.0, lat: -36.0, personality: 'BALANCED' },
  { key: 'co', name: 'Kolombiya', color: '#FACC15', lon: -74.0, lat: 4.5, personality: 'BALANCED' },
];
