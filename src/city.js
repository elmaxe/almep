import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { L, SIDEWALKS } from './layout.js';
import {
  rng, pick, facadeTextures, signTexture, asphaltTexture, sidewalkTexture,
  snowTexture, graniteTexture, FACADE_COLORS, posterTexture,
} from './textures.js';

const HALF_PI = Math.PI / 2;

/** Place a flat mesh on a wall facing `side` at `plane`, centred at `along`, height `y`. */
export function orient(obj, side, plane, along, y) {
  switch (side) {
    case '+x': obj.position.set(plane, y, along); obj.rotation.y = HALF_PI; break;
    case '-x': obj.position.set(plane, y, along); obj.rotation.y = -HALF_PI; break;
    case '+z': obj.position.set(along, y, plane); obj.rotation.y = 0; break;
    case '-z': obj.position.set(along, y, plane); obj.rotation.y = Math.PI; break;
  }
  return obj;
}

/** Re-project UVs from world-space positions so tiled textures line up. */
export function planarUV(geo, scale) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (ny > 0.5) { u = x; v = z; } else if (nx > 0.5) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function boxAt(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

function roofGeometry(w, len, rh, alongZ) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2 + 0.3, rh * 0.85);
  s.lineTo(0, rh);
  s.lineTo(w / 2 - 0.3, rh * 0.85);
  s.lineTo(w / 2, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  if (!alongZ) g.rotateY(HALF_PI);
  return g;
}

const SHOPS = [
  'KONDITORI', 'TOBAK', 'SKOMAKERI', 'APOTEK', 'OPTIKER', 'BOKHANDEL', 'URMAKARE',
  'FOTO', 'KEMTVÄTT', 'RESTAURANG', 'PIZZERIA', 'BIJOUTERI', 'HERRMODE', 'DAMFRISÖR',
  'RADIO · TV', 'LEKSAKER', 'JÄRNHANDEL', 'SPARBANKEN', 'KAFÉ', 'BLOMSTERHANDEL', 'SPORT',
  'ANTIKVARIAT', 'GULDSMED', 'GRILL', 'VIDEO', 'RESEBYRÅ', 'MUSIK', 'PARFYMERI', 'HATTAR',
];
const NEON = ['#ff3b5c', '#ff9b2e', '#3cf0ff', '#ffe04a', '#ff5fd2', '#7dff6a', '#ffffff'];

function makeSign(text, r, { w, h = 0.75, style } = {}) {
  const st = style ?? (r() < 0.6 ? 'neon' : 'box');
  const neon = pick(r, NEON);
  const tex = st === 'neon'
    ? signTexture(text, { bg: '#0b0b0d', fg: neon, glow: true, w: 512, h: 96 })
    : signTexture(text, { bg: pick(r, ['#f3efe2', '#f6d84a', '#e8e8e8', '#c8242c']), fg: '#161616', w: 512, h: 96 });
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  mat.color.setScalar(st === 'neon' ? 2.2 : 1.25);
  const width = w ?? Math.min(9, 1.6 + text.length * 0.42);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), mat);
  return mesh;
}

export class City {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.seed = 1000;
    this.bodyMats = new Map();
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.3 });
    this.build();
  }

  bodyMat(color) {
    if (!this.bodyMats.has(color)) {
      const c = new THREE.Color(color).multiplyScalar(0.55);
      this.bodyMats.set(color, new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
    }
    return this.bodyMats.get(color);
  }

  /**
   * A single building. `faces` lists the walls that get a detailed facade:
   * { side, y0, ground, lit }.
   */
  building({ x0, x1, z0, z1, h, base = 0, faces, color, roof = true, seed }) {
    const r = rng(seed ?? this.seed++);
    color = color ?? pick(r, FACADE_COLORS);
    const body = new THREE.Mesh(boxAt(x0, x1, base, h, z0, z1), this.bodyMat(color));
    this.scene.add(body);
    if (roof) {
      const alongZ = z1 - z0 > x1 - x0;
      const w = alongZ ? x1 - x0 : z1 - z0;
      const len = alongZ ? z1 - z0 : x1 - x0;
      const rg = roofGeometry(w + 0.6, len + 0.6, 2.5 + r() * 2.5, alongZ);
      const rm = new THREE.Mesh(rg, this.roofMat);
      rm.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
      this.scene.add(rm);
      // chimneys
      for (let i = 0; i < 2 + r() * 3; i++) {
        const cx = x0 + 2 + r() * (x1 - x0 - 4);
        const cz = z0 + 2 + r() * (z1 - z0 - 4);
        const ch = new THREE.Mesh(boxAt(cx - 0.4, cx + 0.4, h, h + 3 + r() * 1.5, cz - 0.6, cz + 0.6), this.bodyMat(color));
        this.scene.add(ch);
      }
    }
    for (const f of faces) {
      const y0 = f.y0 ?? base;
      const along = f.side.endsWith('x') ? [z0, z1] : [x0, x1];
      const plane = { '+x': x1, '-x': x0, '+z': z1, '-z': z0 }[f.side];
      const out = f.side[0] === '+' ? 0.03 : -0.03;
      const len = along[1] - along[0];
      const fh = h - y0;
      const { map, emissiveMap } = facadeTextures({ w: len, h: fh, seed: Math.floor(r() * 1e9), color, ground: f.ground !== false, lit: f.lit ?? 0.22 });
      const mat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.95, roughness: 0.92 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, fh), mat);
      orient(m, f.side, plane + out, (along[0] + along[1]) / 2, y0 + fh / 2);
      this.scene.add(m);
      if (f.signs !== false && f.ground !== false && len > 7 && r() < 0.75) {
        const sign = makeSign(pick(r, SHOPS), r);
        const a = along[0] + 1 + sign.geometry.parameters.width / 2 + r() * Math.max(0, len - 2 - sign.geometry.parameters.width);
        orient(sign, f.side, plane + out * 4, a, y0 + 3.95);
        this.scene.add(sign);
      }
    }
    this.world.addCollider(x0, x1, z0, z1, Infinity);
    this.world.footprints.push({ x0, x1, z0, z1, h, base });
    return { x0, x1, z0, z1, h, color };
  }

  /**
   * A row of buildings whose street facades all face `side` on the line
   * `plane`, spanning [from, to] along the street.
   */
  row({ side, plane, from, to, depth = 24, hMin = 19, hMax = 27, base = 0, y0, cornerStart, cornerEnd, segMin = 13, segMax = 26, signs = true, lit }) {
    const r = rng(this.seed++);
    const out = [];
    let a = from;
    while (a < to - 0.1) {
      let b = Math.min(to, a + segMin + r() * (segMax - segMin));
      if (to - b < segMin * 0.6) b = to;
      const h = Math.round(hMin + r() * (hMax - hMin));
      const faces = [{ side, y0, signs, lit }];
      const alongX = side.endsWith('z');
      if (a === from && cornerStart) faces.push({ side: alongX ? '-x' : '-z', y0: cornerStart.y0 ?? y0, signs, lit, ground: cornerStart.ground });
      if (b === to && cornerEnd) faces.push({ side: alongX ? '+x' : '+z', y0: cornerEnd.y0 ?? y0, signs, lit, ground: cornerEnd.ground });
      let box;
      if (side === '+x') box = { x0: plane - depth, x1: plane, z0: a, z1: b };
      if (side === '-x') box = { x0: plane, x1: plane + depth, z0: a, z1: b };
      if (side === '+z') box = { x0: a, x1: b, z0: plane - depth, z1: plane };
      if (side === '-z') box = { x0: a, x1: b, z0: plane, z1: plane + depth };
      out.push(this.building({ ...box, h, base, faces }));
      a = b;
    }
    return out;
  }

  build() {
    this.ground();
    this.buildings();
    this.ridge();
    this.landmarks();
    this.streetSigns();
    this.walls();
  }

  ground() {
    const scene = this.scene;
    const asphalt = asphaltTexture();
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    const gW = 300, gD = 540;
    asphalt.repeat.set(gW / 9, gD / 9);
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(gW, gD),
      new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.55, metalness: 0.05, color: 0xbfc3c8 }),
    );
    g.rotation.x = -HALF_PI;
    g.position.set(0, 0, (L.zNorth + L.zSouth) / 2);
    scene.add(g);

    // raised sidewalks (merged into one mesh)
    const swTex = sidewalkTexture();
    swTex.wrapS = swTex.wrapT = THREE.RepeatWrapping;
    const swGeos = [];
    const kerbGeos = [];
    for (const [x0, x1, z0, z1] of SIDEWALKS.slice(0, -1)) {
      swGeos.push(boxAt(x0, x1, 0, L.sidewalkH, z0, z1));
    }
    const sw = new THREE.Mesh(planarUV(mergeGeometries(swGeos), 7), new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.85 }));
    scene.add(sw);

    // granite kerbs along Sveavägen
    for (const [x0, x1, z0, z1] of SIDEWALKS.slice(0, 6)) {
      const kx = x0 < 0 ? x1 : x0;
      kerbGeos.push(boxAt(kx - 0.15, kx + 0.15, 0, L.sidewalkH + 0.02, z0, z1));
    }
    const gran = graniteTexture();
    gran.wrapS = gran.wrapT = THREE.RepeatWrapping;
    scene.add(new THREE.Mesh(planarUV(mergeGeometries(kerbGeos), 2), new THREE.MeshStandardMaterial({ map: gran, roughness: 0.8, color: 0xaaaaaa })));

    // churchyard snow
    const cy = L.churchyard;
    const snow = snowTexture();
    snow.wrapS = snow.wrapT = THREE.RepeatWrapping;
    const cyGeo = planarUV(boxAt(cy.x0, cy.x1, 0, 0.14, cy.z0, cy.z1), 12);
    scene.add(new THREE.Mesh(cyGeo, new THREE.MeshStandardMaterial({ map: snow, roughness: 0.9, emissive: 0x1e2330 })));

    // central reservation on Sveavägen
    const medGeos = [];
    const gaps = [[L.kyrkogata.z0 - 4, L.kyrkogata.z1 + 6], [-12, 12], [L.kungsgatan.z0 - 6, L.kungsgatan.z1 + 4]];
    let z = L.zNorth;
    for (const [g0, g1] of gaps) {
      medGeos.push(boxAt(-0.9, 0.9, 0, 0.18, z, g0));
      z = g1;
    }
    medGeos.push(boxAt(-0.9, 0.9, 0, 0.18, z, L.zSouth));
    scene.add(new THREE.Mesh(planarUV(mergeGeometries(medGeos), 3), new THREE.MeshStandardMaterial({ map: gran, roughness: 0.8, color: 0x888888 })));
    this.median = gaps;

    // lane markings
    const markGeos = [];
    for (const lx of [-4.9, 4.9]) {
      for (let mz = L.zNorth; mz < L.zSouth; mz += 9) {
        if (gaps.some(([g0, g1]) => mz > g0 - 3 && mz < g1)) continue;
        markGeos.push(boxAt(lx - 0.07, lx + 0.07, 0.005, 0.012, mz, mz + 3));
      }
    }
    // zebra crossings
    const zebra = (zc, x0, x1, alongX = true) => {
      for (let s = x0; s < x1; s += 1.0) {
        if (alongX) markGeos.push(boxAt(s, s + 0.5, 0.005, 0.012, zc - 2, zc + 2));
        else markGeos.push(boxAt(zc - 2, zc + 2, 0.005, 0.012, s, s + 0.5));
      }
    };
    zebra(L.kyrkogata.z1 + 3, -10.8, 10.8);
    zebra(-9.5, -10.8, 10.8);
    zebra(L.kungsgatan.z0 - 3, -10.8, 10.8);
    zebra(-13.5, -3.4, 3.4, false); // across Tunnelgatan mouth
    zebra(13.5, L.kyrkogata.road0, L.kyrkogata.road1, false);
    const markMat = new THREE.MeshStandardMaterial({ color: 0xcfcfc8, roughness: 0.7 });
    scene.add(new THREE.Mesh(mergeGeometries(markGeos), markMat));

    // snowbanks
    const r = rng(77);
    const bank = new THREE.IcosahedronGeometry(1, 2);
    const banks = [];
    const addBank = (x, z0, z1, spread = 0.5) => {
      for (let bz = z0; bz < z1; bz += 1.2 + r() * 1.5) {
        if (r() < 0.25) continue;
        banks.push([x + (r() - 0.5) * spread, bz, 0.7 + r() * 0.6, 0.18 + r() * 0.25, 1.1 + r() * 1.2]);
      }
    };
    const kerbBreaks = [[-6, 6], [L.kyrkogata.z0, L.kyrkogata.z1 + 6], [L.kungsgatan.z0 - 6, L.kungsgatan.z1], [-13, -6]];
    const banked = (x, z0, z1) => {
      let a = z0;
      for (const [b0, b1] of [...kerbBreaks].sort((p, q) => p[0] - q[0])) {
        if (b1 < a || b0 > z1) continue;
        addBank(x, a, b0);
        a = b1;
      }
      addBank(x, a, z1);
    };
    banked(-10.35, L.zNorth, L.zSouth);
    banked(10.35, L.zNorth, L.zSouth);
    let mz0 = L.zNorth;
    for (const [g0, g1] of gaps) { addBank(0, mz0, g0, 0.3); mz0 = g1; }
    addBank(0, mz0, L.zSouth, 0.3);
    const inst = new THREE.InstancedMesh(bank, new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: 0.95, emissive: 0x161a22 }), banks.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    banks.forEach(([x, z, sx, sy, sz], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 0.4);
      m4.compose(new THREE.Vector3(x, 0.05, z), q, new THREE.Vector3(sx * 0.5, sy, sz));
      inst.setMatrixAt(i, m4);
    });
    scene.add(inst);
  }

  buildings() {
    const t = L.tunnel;
    // --- Sveavägen west side ---
    this.row({ side: '+x', plane: -L.front, from: L.zNorth, to: -32, depth: 24 });
    this.dekorima = this.building({
      x0: -40, x1: -16, z0: -32, z1: t.z0, h: 25, color: '#c2b59b', seed: 4242,
      faces: [{ side: '+x', signs: false }, { side: '+z', signs: false }],
    });
    this.row({ side: '+x', plane: -L.front, from: t.z1, to: L.kungsgatan.z0, cornerStart: {}, cornerEnd: {} });
    this.row({ side: '+x', plane: -L.front, from: L.kungsgatan.z1, to: L.zSouth, cornerStart: {} });

    // --- Tunnelgatan, both sides; their west ends face Malmskillnadsgatan above the ridge ---
    this.row({ side: '+z', plane: t.z0, from: L.stairs.x0, to: -40, depth: 20, hMin: 23, hMax: 28, cornerStart: { y0: L.plateauH } });
    this.row({ side: '-z', plane: t.z1, from: L.stairs.x0, to: -40, depth: 20, hMin: 23, hMax: 28, cornerStart: { y0: L.plateauH } });
    // blocks behind them, only their Malmskillnadsgatan facades are visible
    this.row({ side: '-x', plane: L.stairs.x0, from: -80, to: t.z0 - 20, depth: 48, hMin: 21, hMax: 26, y0: L.plateauH, segMin: 14, segMax: 22 });
    this.row({ side: '-x', plane: L.stairs.x0, from: t.z1 + 20, to: 80, depth: 48, hMin: 21, hMax: 26, y0: L.plateauH, segMin: 14, segMax: 22 });
    // Malmskillnadsgatan west side, standing on the ridge
    this.row({ side: '+x', plane: L.malm.x0, from: -80, to: 80, depth: 24, base: L.plateauH, hMin: L.plateauH + 14, hMax: L.plateauH + 20 });

    // --- Sveavägen east side ---
    this.row({ side: '-x', plane: L.front, from: L.zNorth, to: L.grand.z0 });
    this.grandBuilding = this.building({
      x0: 16, x1: 40, z0: L.grand.z0, z1: L.grand.z1, h: 24, color: '#d8c49a', seed: 4545,
      faces: [{ side: '-x', signs: false }],
    });
    this.row({ side: '-x', plane: L.front, from: L.grand.z1, to: L.kyrkogata.z0, cornerEnd: {} });
    this.row({ side: '-x', plane: L.front, from: L.churchyard.z1, to: L.kungsgatan.z0, cornerStart: { ground: false }, cornerEnd: {} });
    this.row({ side: '-x', plane: L.front, from: L.kungsgatan.z1, to: L.zSouth, cornerStart: {} });

    // --- around the churchyard ---
    this.row({ side: '+z', plane: L.kyrkogata.z0, from: 40, to: L.kyrkogata.x1, depth: 24 });
    this.row({ side: '-x', plane: L.kyrkogata.x1, from: -130, to: 70, depth: 24, lit: 0.3 });
    this.row({ side: '-z', plane: L.churchyard.z1, from: 40, to: L.kyrkogata.x1, depth: 24, signs: false });

    // --- Kungsgatan ---
    const k = L.kungsgatan;
    this.row({ side: '+z', plane: k.z0, from: k.x0 - 20, to: -40, depth: 24, lit: 0.35 });
    this.row({ side: '-z', plane: k.z1, from: k.x0 - 20, to: -40, depth: 24, lit: 0.35 });
    this.row({ side: '+z', plane: k.z0, from: 40, to: k.x1 + 20, depth: 24, lit: 0.35 });
    this.row({ side: '-z', plane: k.z1, from: 40, to: k.x1 + 20, depth: 24, lit: 0.35 });

    // close the vistas at both ends of Sveavägen (beyond the fog)
    this.building({ x0: -40, x1: 40, z0: L.zNorth - 60, z1: L.zNorth - 30, h: 30, faces: [{ side: '+z' }] });
    this.building({ x0: -40, x1: 40, z0: L.zSouth + 30, z1: L.zSouth + 60, h: 30, faces: [{ side: '-z' }] });
  }

  ridge() {
    const scene = this.scene;
    const s = L.stairs;
    const H = L.plateauH;
    const gran = graniteTexture();
    gran.wrapS = gran.wrapT = THREE.RepeatWrapping;
    const granMat = new THREE.MeshStandardMaterial({ map: gran, roughness: 0.85, color: 0x9a9a9a });

    // the Brunkeberg ridge under Malmskillnadsgatan
    const plateau = planarUV(boxAt(-150, s.x0, 0, H, -90, 90), 4);
    scene.add(new THREE.Mesh(plateau, granMat));
    const swTex = sidewalkTexture();
    const topGeo = planarUV(boxAt(-150, s.x0, H, H + 0.01, -90, 90), 7);
    scene.add(new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.85 })));
    const road = new THREE.Mesh(
      planarUV(boxAt(-98, -90, H, H + 0.02, L.malm.z0 - 10, L.malm.z1 + 10), 9),
      new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.55, color: 0xbfc3c8 }),
    );
    scene.add(road);

    // walls flanking the stairs, topped with a parapet
    const wallGeos = [
      boxAt(s.x0, s.x1, 0, H + 1.0, -6, s.z0),
      boxAt(s.x0, s.x1, 0, H + 1.0, s.z1, 6),
    ];
    scene.add(new THREE.Mesh(planarUV(mergeGeometries(wallGeos), 4), granMat));
    this.world.addCollider(s.x0, s.x1, -6, s.z0, Infinity);
    this.world.addCollider(s.x0, s.x1, s.z1, 6, Infinity);

    // the steps
    const stepGeos = [];
    const run = (s.x1 - s.x0) / s.steps;
    for (let i = 0; i < s.steps; i++) {
      const xa = s.x1 - (i + 1) * run;
      const top = ((i + 1) * H) / s.steps;
      stepGeos.push(boxAt(xa, xa + run, 0, top, s.z0, s.z1));
    }
    scene.add(new THREE.Mesh(planarUV(mergeGeometries(stepGeos), 3), granMat));
    // snow on the tread edges
    const snowGeos = [];
    for (let i = 0; i < s.steps; i += 1) {
      const xa = s.x1 - (i + 1) * run;
      const top = ((i + 1) * H) / s.steps;
      snowGeos.push(boxAt(xa + run * 0.6, xa + run, top, top + 0.03, s.z0, s.z0 + 0.5));
      snowGeos.push(boxAt(xa + run * 0.6, xa + run, top, top + 0.03, s.z1 - 0.5, s.z1));
    }
    scene.add(new THREE.Mesh(mergeGeometries(snowGeos), new THREE.MeshStandardMaterial({ color: 0xd5dbe5, roughness: 0.9 })));

    // handrails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 });
    const len = Math.hypot(s.x1 - s.x0, H);
    const ang = Math.atan2(H, s.x1 - s.x0);
    for (const rz of [s.z0 + 0.15, 0, s.z1 - 0.15]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), railMat);
      rail.rotation.z = HALF_PI + ang;
      rail.position.set((s.x0 + s.x1) / 2, H / 2 + 0.95, rz);
      scene.add(rail);
      for (let i = 0; i <= 8; i++) {
        const px = s.x1 - (i / 8) * (s.x1 - s.x0);
        const py = (i / 8) * H;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 5), railMat);
        post.position.set(px, py + 0.47, rz);
        scene.add(post);
      }
    }
    // a railing along the edge of the plateau, either side of the stairs
    for (const [z0, z1] of [[-60, s.z0], [s.z1, 60]]) {
      const bar = new THREE.Mesh(boxAt(s.x0 - 0.1, s.x0 + 0.1, H + 0.9, H + 1.0, z0, z1), railMat);
      scene.add(bar);
    }
    // plateau bounds
    this.world.addCollider(-100.5, -88, L.malm.z0 - 1, L.malm.z0, Infinity);
    this.world.addCollider(-100.5, -88, L.malm.z1, L.malm.z1 + 1, Infinity);
  }

  landmarks() {
    const scene = this.scene;
    // --- Dekorima, the art supplies shop on the corner of Tunnelgatan ---
    const dek = makeSign('DEKORIMA', rng(1), { w: 7, h: 0.95, style: 'box' });
    dek.material.map = signTexture('DEKORIMA', { bg: '#f2ede0', fg: '#b3141e', w: 512, h: 80 });
    dek.material.color.setScalar(1.3);
    orient(dek, '+x', -15.85, -12, 4.0);
    scene.add(dek);
    const dek2 = dek.clone();
    dek2.scale.set(0.8, 0.8, 1);
    orient(dek2, '+z', L.tunnel.z0 + 0.15, -21, 4.0);
    scene.add(dek2);
    // display windows on the corner, always lit
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.62, 0.48) });
    for (const zc of [-27, -22, -17, -9]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), winMat);
      orient(w, '+x', -15.9, zc, 1.9);
      scene.add(w);
      // easels and frames in the window
      for (let i = 0; i < 3; i++) {
        const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + i * 0.1, 0.8), new THREE.MeshBasicMaterial({ map: posterTexture(zc * 7 + i) }));
        orient(fr, '+x', -15.85, zc - 1 + i, 1.5 + (i % 2) * 0.3);
        scene.add(fr);
      }
    }

    // --- Biografen Grand ---
    const gz = (L.grand.z0 + L.grand.z1) / 2;
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.6, metalness: 0.4 });
    const canopy = new THREE.Mesh(boxAt(13.2, 16, 3.6, 4.4, gz - 9, gz + 9), darkMat);
    scene.add(canopy);
    const bulbsMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 1.2) });
    const bulbGeo = new THREE.SphereGeometry(0.06, 6, 4);
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbsMat, 160);
    const m4 = new THREE.Matrix4();
    let bi = 0;
    for (let i = 0; i < 80; i++) {
      const z = gz - 9 + (i / 79) * 18;
      for (const y of [3.65, 4.35]) {
        m4.makeTranslation(13.15, y, z);
        bulbs.setMatrixAt(bi++, m4);
      }
    }
    scene.add(bulbs);
    const marquee = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 0.6),
      new THREE.MeshBasicMaterial({ map: signTexture('BRÖDERNA MOZART', { bg: '#f7f1dc', fg: '#141414', w: 1024, h: 64 }) }),
    );
    marquee.material.color.setScalar(1.4);
    orient(marquee, '-x', 13.15, gz, 4.0);
    scene.add(marquee);
    // vertical blade sign
    const bladeTex = signTexture('GRAND', { bg: '#0d0d10', fg: '#ff2d3a', glow: true, w: 512, h: 110, family: 'Georgia, serif' });
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), new THREE.MeshBasicMaterial({ map: bladeTex, side: THREE.DoubleSide }));
    blade.material.color.setScalar(2.4);
    // perpendicular to the facade so it reads from along the street
    blade.rotation.set(0, Math.PI, HALF_PI);
    blade.position.set(14.6, 8.5, gz - 4.14);
    scene.add(blade);
    const blade2 = blade.clone();
    blade2.rotation.set(0, 0, HALF_PI);
    blade2.position.z = gz - 3.86;
    scene.add(blade2);
    scene.add(new THREE.Mesh(boxAt(13.9, 16, 5.3, 11.7, gz - 4.12, gz - 3.88), darkMat));
    // poster light boxes and lit foyer
    for (const dz of [-7.5, 7.5]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshBasicMaterial({ map: posterTexture(Math.abs(dz) * 13 + dz) }));
      p.material.color.setScalar(1.0);
      orient(p, '-x', 15.9, gz + dz, 1.8);
      scene.add(p);
    }
    const foyer = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.66, 0.42) }));
    orient(foyer, '-x', 15.92, gz, 1.6);
    scene.add(foyer);
    // canopy casts light on the pavement
    this.world.extraGlows.push({ x: 14, z: gz, r: 7, color: 0xffd9a0, intensity: 0.9 });
    this.world.lamps.push(new THREE.Vector3(14, 3.4, gz));

    // --- Hötorget T-bana entrance ---
    const tz = L.kungsgatan.z0 - 9;
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5b6066, metalness: 0.6, roughness: 0.4 });
    const pit = new THREE.Mesh(boxAt(-15.2, -12.2, -0.01, L.sidewalkH + 0.005, tz - 4, tz + 4), new THREE.MeshBasicMaterial({ color: 0x050506 }));
    scene.add(pit);
    for (const [x0, x1, z0, z1] of [[-15.3, -15.2, tz - 4, tz + 4], [-12.2, -12.1, tz - 4, tz + 4], [-15.3, -12.1, tz - 4.1, tz - 4]]) {
      scene.add(new THREE.Mesh(boxAt(x0, x1, 0, 1.1, z0, z1), railMat));
    }
    this.world.addCollider(-15.3, -12.1, tz - 4.1, tz + 4, Infinity);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), railMat);
    pole.position.set(-12.0, 1.6, tz + 4.4);
    scene.add(pole);
    const tTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f5fbf';
      ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 84px Helvetica, Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('T', 64, 68);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const tSign = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ map: tTex, side: THREE.DoubleSide }));
    tSign.material.color.setScalar(1.6);
    tSign.position.set(-12.0, 3.4, tz + 4.4);
    scene.add(tSign);

    // --- Televerket phone booth near the corner ---
    this.phoneBooth(14.9, -8);
    this.phoneBooth(-14.9, 30);
  }

  phoneBooth(x, z) {
    const g = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.5, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x223040, transparent: true, opacity: 0.35, roughness: 0.1 });
    g.add(new THREE.Mesh(boxAt(-0.5, 0.5, 0, 0.1, -0.5, 0.5), frame));
    g.add(new THREE.Mesh(boxAt(-0.5, 0.5, 2.2, 2.45, -0.5, 0.5), frame));
    for (const [px, pz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      g.add(new THREE.Mesh(boxAt(px - 0.04, px + 0.04, 0, 2.2, pz - 0.04, pz + 0.04), frame));
    }
    g.add(new THREE.Mesh(boxAt(-0.48, 0.48, 0.1, 2.2, -0.48, 0.48), glass));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.22), new THREE.MeshBasicMaterial({ map: signTexture('TELEFON', { bg: '#f4d03f', fg: '#1a1a1a', w: 256, h: 60 }) }));
    sign.material.color.setScalar(1.5);
    for (const ry of [0, HALF_PI, Math.PI, -HALF_PI]) {
      const s = sign.clone();
      s.rotation.y = ry;
      s.position.set(Math.sin(ry) * 0.51, 2.33, Math.cos(ry) * 0.51);
      g.add(s);
    }
    g.position.set(x, L.sidewalkH, z);
    this.scene.add(g);
    this.world.addCollider(x - 0.55, x + 0.55, z - 0.55, z + 0.55, Infinity);
  }

  streetSigns() {
    const make = (text) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(text.length > 14 ? 2.6 : 1.8, 0.36),
        new THREE.MeshBasicMaterial({ map: signTexture(text, { bg: '#1d4f9e', fg: '#ffffff', border: '#ffffff', w: 512, h: 100 }) }),
      );
      m.material.color.setScalar(0.9);
      return m;
    };
    const put = (text, side, plane, along, y = 4.8) => {
      const m = make(text);
      orient(m, side, plane + (side[0] === '+' ? 0.06 : -0.06), along, y);
      this.scene.add(m);
    };
    put('SVEAVÄGEN', '+x', -16, -9);
    put('TUNNELGATAN', '+z', L.tunnel.z0, -18.5);
    put('SVEAVÄGEN', '+x', -16, 9);
    put('TUNNELGATAN', '-z', L.tunnel.z1, -18.5);
    put('SVEAVÄGEN', '-x', 16, L.kyrkogata.z0 - 3);
    put('ADOLF FREDRIKS KYRKOGATA', '+z', L.kyrkogata.z0, 19.5);
    put('SVEAVÄGEN', '-x', 16, L.churchyard.z1 + 3);
    put('KUNGSGATAN', '+z', L.kungsgatan.z0, -19);
    put('KUNGSGATAN', '+z', L.kungsgatan.z0, 19);
    put('SVEAVÄGEN', '+x', -16, L.kungsgatan.z0 - 3);
    put('SVEAVÄGEN', '-x', 16, L.kungsgatan.z0 - 3);
    put('MALMSKILLNADSGATAN', '+x', L.malm.x0, -9, L.plateauH + 4.6);
    put('MALMSKILLNADSGATAN', '+x', L.malm.x0, 9, L.plateauH + 4.6);
    put('TUNNELGATAN', '-x', L.stairs.x1 + 0.0, -4.4, 3.5);
  }

  walls() {
    const w = this.world;
    // invisible limits at the ends of the streets
    w.addCollider(-16, 16, L.zNorth - 2, L.zNorth, Infinity);
    w.addCollider(-16, 16, L.zSouth, L.zSouth + 2, Infinity);
    const k = L.kungsgatan;
    w.addCollider(k.x0 - 2, k.x0, k.z0, k.z1, Infinity);
    w.addCollider(k.x1, k.x1 + 2, k.z0, k.z1, Infinity);
  }
}
