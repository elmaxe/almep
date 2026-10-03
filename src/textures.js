import * as THREE from 'three';

// Deterministic PRNG so the street looks the same on every load.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function speckle(ctx, w, h, r, count, colors, maxSize = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = pick(r, colors);
    const s = 1 + r() * maxSize;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

function blotches(ctx, w, h, r, count, color, minR, maxR) {
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = minR + r() * (maxR - minR);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    // draw wrapped copies so the tile stays seamless
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      ctx.restore();
    }
  }
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export function asphaltTexture() {
  return cached('asphalt', () => {
    const [c, ctx] = makeCanvas(512, 512);
    const r = rng(11);
    ctx.fillStyle = '#26272a';
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, r, 9000, ['#1d1e20', '#303135', '#2b2a28', '#3a3a3c'], 2);
    blotches(ctx, 512, 512, r, 14, 'rgba(10,12,16,0.45)', 30, 90); // wet patches
    blotches(ctx, 512, 512, r, 10, 'rgba(120,115,105,0.10)', 20, 60); // salt/slush
    return toTexture(c);
  });
}

export function sidewalkTexture() {
  return cached('sidewalk', () => {
    const [c, ctx] = makeCanvas(512, 512);
    const r = rng(12);
    ctx.fillStyle = '#4e4f52';
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, r, 7000, ['#454649', '#58595c', '#626366'], 2);
    blotches(ctx, 512, 512, r, 26, 'rgba(225,230,240,0.55)', 20, 70); // packed snow
    blotches(ctx, 512, 512, r, 40, 'rgba(240,244,250,0.35)', 6, 20);
    return toTexture(c);
  });
}

export function snowTexture() {
  return cached('snow', () => {
    const [c, ctx] = makeCanvas(512, 512);
    const r = rng(13);
    ctx.fillStyle = '#d9dee8';
    ctx.fillRect(0, 0, 512, 512);
    blotches(ctx, 512, 512, r, 40, 'rgba(170,180,200,0.25)', 20, 80);
    speckle(ctx, 512, 512, r, 5000, ['#eef1f6', '#c8cfdb', '#ffffff'], 1.5);
    return toTexture(c);
  });
}

export function gravelTexture() {
  return cached('gravel', () => {
    const [c, ctx] = makeCanvas(256, 256);
    const r = rng(14);
    ctx.fillStyle = '#8d8a84';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, r, 5000, ['#6f6c66', '#a5a19a', '#b9b6b0', '#7a776f'], 2);
    blotches(ctx, 256, 256, r, 18, 'rgba(230,235,245,0.6)', 10, 40);
    return toTexture(c);
  });
}

export function graniteTexture() {
  return cached('granite', () => {
    const [c, ctx] = makeCanvas(512, 512);
    const r = rng(15);
    ctx.fillStyle = '#6d6a66';
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, r, 14000, ['#5a5753', '#85817b', '#9b958e', '#4a4744', '#7d6c66'], 2);
    ctx.strokeStyle = 'rgba(30,28,26,0.7)';
    ctx.lineWidth = 3;
    const rowH = 64;
    for (let y = 0; y <= 512; y += rowH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      const off = (y / rowH) % 2 ? 64 : 0;
      for (let x = off; x <= 512; x += 128) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rowH);
        ctx.stroke();
      }
    }
    return toTexture(c);
  });
}

export function glowTexture() {
  return cached('glow', () => {
    const [c, ctx] = makeCanvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return toTexture(c, { srgb: false });
  });
}

export function flakeTexture() {
  return cached('flake', () => {
    const [c, ctx] = makeCanvas(32, 32);
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return toTexture(c, { srgb: false });
  });
}

export const FACADE_COLORS = [
  '#c9a46a', '#d8c49a', '#b5653f', '#a89f91', '#cdb48a', '#8f8a80',
  '#d6a77a', '#b9a184', '#9c5a3c', '#e0d2b0', '#7d7f80', '#c2b59b',
];

const LIT = ['#ffcf7a', '#ffd99a', '#ffe7c0', '#fff1d8', '#ffb867', '#ffd27f', '#8fb6ff'];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

/**
 * Procedural building facade. Returns a colour map and an emissive map
 * (lit windows and shop windows) for a wall `w` x `h` metres.
 * `y0` is the height (m) at which the wall starts to be visible —
 * buildings standing on the Brunkeberg ridge use it so floors line up.
 */
export function facadeTextures({ w, h, seed, color, ground = true, floorH = 3.2, groundH = 4.6, bay = 3.0, lit = 0.22 }) {
  const r = rng(seed);
  const PX = 10;
  const cw = Math.min(1024, Math.max(16, Math.ceil(w * PX)));
  const ch = Math.min(1024, Math.max(16, Math.ceil(h * PX)));
  const sx = cw / w;
  const sy = ch / h;
  const [c, ctx] = makeCanvas(cw, ch);
  const [e, ectx] = makeCanvas(cw, ch);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, cw, ch);

  const base = color || pick(r, FACADE_COLORS);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, cw, ch);
  speckle(ctx, cw, ch, r, (cw * ch) / 30, [shade(base, 0.9), shade(base, 1.08), shade(base, 0.82)], 2);
  // grime gradient towards the street
  const grime = ctx.createLinearGradient(0, ch, 0, 0);
  grime.addColorStop(0, 'rgba(20,18,16,0.35)');
  grime.addColorStop(0.4, 'rgba(20,18,16,0)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 0, cw, ch);

  const Y = (m) => (h - m) * sy; // metres-from-bottom -> canvas y
  const X = (m) => m * sx;

  // top cornice
  ctx.fillStyle = shade(base, 0.6);
  ctx.fillRect(0, 0, cw, Math.max(2, 0.6 * sy));

  const bays = Math.max(1, Math.floor(w / bay));
  const margin = (w - bays * bay) / 2;
  const style = r();

  const startY = ground ? groundH : 0.6;
  if (ground) {
    // stone plinth
    ctx.fillStyle = shade(base, 0.55);
    ctx.fillRect(0, Y(groundH), cw, groundH * sy);
    ctx.fillStyle = shade(base, 0.4);
    ctx.fillRect(0, Y(groundH), cw, 0.25 * sy);
    // shop windows and doors
    for (let i = 0; i < bays; i++) {
      const bx = margin + i * bay;
      const isDoor = r() < 0.18;
      const ww = isDoor ? 1.2 : bay - 0.5;
      const wx = bx + (bay - ww) / 2;
      const wy0 = isDoor ? 0.05 : 0.6;
      const wy1 = 3.4;
      const on = r() < (isDoor ? 0.2 : 0.5);
      ctx.fillStyle = on ? '#e9d7b0' : '#141820';
      ctx.fillRect(X(wx), Y(wy1), ww * sx, (wy1 - wy0) * sy);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = Math.max(1, 0.12 * sx);
      ctx.strokeRect(X(wx), Y(wy1), ww * sx, (wy1 - wy0) * sy);
      if (on) {
        const g = ectx.createLinearGradient(0, Y(wy1), 0, Y(wy0));
        const col = pick(r, ['#ffe2a8', '#fff3dc', '#ffd38a', '#e8f0ff']);
        g.addColorStop(0, shade(col, 0.72));
        g.addColorStop(1, shade(col, 0.38));
        ectx.fillStyle = g;
        ectx.fillRect(X(wx), Y(wy1), ww * sx, (wy1 - wy0) * sy);
        // silhouettes of goods on display
        ectx.fillStyle = 'rgba(0,0,0,0.45)';
        for (let k = 0; k < 4; k++) {
          const gw = 0.2 + r() * 0.5;
          const gh = 0.3 + r() * 1.2;
          ectx.fillRect(X(wx + 0.2 + r() * (ww - 0.6)), Y(wy0 + gh), gw * sx, gh * sy);
        }
      }
    }
  }

  // upper floors
  const floors = Math.floor((h - startY - 1.0) / floorH);
  const winW = style < 0.5 ? 1.2 : 1.4;
  const winH = style < 0.3 ? 1.9 : 1.6;
  for (let f = 0; f < floors; f++) {
    const fy = startY + f * floorH;
    // string course
    if (f > 0 && style > 0.4) {
      ctx.fillStyle = shade(base, 0.75);
      ctx.fillRect(0, Y(fy + 0.1), cw, Math.max(1, 0.18 * sy));
    }
    for (let i = 0; i < bays; i++) {
      const wx = margin + i * bay + (bay - winW) / 2;
      const wy = fy + 0.9;
      // surround
      ctx.fillStyle = shade(base, 0.7);
      ctx.fillRect(X(wx - 0.12), Y(wy + winH + 0.12), (winW + 0.24) * sx, (winH + 0.24) * sy);
      const on = r() < lit;
      if (on) {
        const col = pick(r, LIT);
        ctx.fillStyle = col;
        ctx.fillRect(X(wx), Y(wy + winH), winW * sx, winH * sy);
        const dim = 0.45 + r() * 0.45;
        ectx.fillStyle = shade(col, dim);
        ectx.fillRect(X(wx), Y(wy + winH), winW * sx, winH * sy);
        if (r() < 0.6) {
          // curtains
          ectx.fillStyle = 'rgba(60,30,10,0.55)';
          ectx.fillRect(X(wx), Y(wy + winH), winW * 0.28 * sx, winH * sy);
          ectx.fillRect(X(wx + winW * 0.72), Y(wy + winH), winW * 0.28 * sx, winH * sy);
        }
      } else {
        const g = ctx.createLinearGradient(0, Y(wy + winH), 0, Y(wy));
        g.addColorStop(0, '#2a3242');
        g.addColorStop(1, '#0c0f16');
        ctx.fillStyle = g;
        ctx.fillRect(X(wx), Y(wy + winH), winW * sx, winH * sy);
      }
      // mullions
      ctx.fillStyle = '#d8d2c4';
      ctx.fillRect(X(wx + winW / 2 - 0.04), Y(wy + winH), Math.max(1, 0.08 * sx), winH * sy);
      ctx.fillRect(X(wx), Y(wy + winH * 0.62), winW * sx, Math.max(1, 0.08 * sy));
      ectx.fillStyle = '#000';
      ectx.fillRect(X(wx + winW / 2 - 0.04), Y(wy + winH), Math.max(1, 0.08 * sx), winH * sy);
      ectx.fillRect(X(wx), Y(wy + winH * 0.62), winW * sx, Math.max(1, 0.08 * sy));
      // sill
      ctx.fillStyle = shade(base, 0.5);
      ctx.fillRect(X(wx - 0.15), Y(wy), (winW + 0.3) * sx, Math.max(1, 0.12 * sy));
    }
  }

  return { map: toTexture(c), emissiveMap: toTexture(e) };
}

/** Text sign (shop sign, street sign, cinema marquee). */
export function signTexture(text, { bg = '#111', fg = '#fff', border = null, w = 512, h = 128, font = 'bold', family = 'Helvetica, Arial, sans-serif', glow = false } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = h * 0.07;
    ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  }
  let size = h * 0.62;
  ctx.font = `${font} ${size}px ${family}`;
  while (ctx.measureText(text).width > w * 0.88 && size > 8) {
    size -= 2;
    ctx.font = `${font} ${size}px ${family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowColor = fg;
    ctx.shadowBlur = h * 0.15;
  }
  ctx.fillStyle = fg;
  ctx.fillText(text, w / 2, h / 2 + h * 0.03);
  return toTexture(c);
}

export function posterTexture(seed) {
  const r = rng(seed);
  const [c, ctx] = makeCanvas(128, 192);
  const hue = Math.floor(r() * 360);
  const g = ctx.createLinearGradient(0, 0, 0, 192);
  g.addColorStop(0, `hsl(${hue},60%,55%)`);
  g.addColorStop(1, `hsl(${(hue + 60) % 360},55%,25%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(64, 95, 30, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Helvetica, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(pick(r, ['PREMIÄR', 'NU', 'SNART', 'BIO', 'KONSERT']), 64, 30);
  ctx.fillRect(20, 160, 88, 4);
  ctx.fillRect(30, 170, 68, 3);
  return toTexture(c);
}
