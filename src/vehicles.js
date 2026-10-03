import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { L } from './layout.js';
import { rng, pick, glowTexture, signTexture } from './textures.js';

function box(w, h, l, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, l);
  g.translate(x, y, z);
  return g;
}

// Materials slots used by the car geometry groups.
const SLOT = { paint: 0, glass: 1, black: 2, head: 3, tail: 4, snow: 5, chrome: 6, taxi: 7 };

/** Boxy late-70s/80s Swedish saloon (think Volvo 240). Forward is +z. */
function carGeometry({ snow = false, taxi = false } = {}) {
  const parts = [];
  const add = (slot, g) => parts.push([slot, g]);
  add(SLOT.paint, box(1.72, 0.56, 4.78, 0, 0.62, 0));
  add(SLOT.paint, box(1.66, 0.08, 1.35, 0, 0.94, 1.66)); // bonnet
  add(SLOT.glass, box(1.58, 0.5, 2.25, 0, 1.15, -0.15));
  add(SLOT.paint, box(1.62, 0.07, 2.0, 0, 1.43, -0.2)); // roof
  // pillars
  for (const sx of [-0.79, 0.79]) {
    add(SLOT.paint, box(0.05, 0.5, 0.1, sx, 1.15, 0.95));
    add(SLOT.paint, box(0.05, 0.5, 0.12, sx, 1.15, -0.2));
    add(SLOT.paint, box(0.05, 0.5, 0.18, sx, 1.15, -1.2));
  }
  add(SLOT.black, box(1.78, 0.2, 0.16, 0, 0.42, 2.42)); // bumpers
  add(SLOT.black, box(1.78, 0.2, 0.16, 0, 0.42, -2.42));
  add(SLOT.chrome, box(0.9, 0.24, 0.04, 0, 0.72, 2.4)); // grille
  for (const sx of [-0.6, 0.6]) {
    add(SLOT.head, box(0.4, 0.17, 0.04, sx, 0.74, 2.405));
    add(SLOT.tail, box(0.46, 0.22, 0.04, sx, 0.74, -2.405));
  }
  for (const sx of [-0.78, 0.78]) for (const sz of [-1.42, 1.38]) {
    const w = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
    w.rotateZ(Math.PI / 2);
    w.translate(sx, 0.32, sz);
    add(SLOT.black, w);
  }
  if (snow) {
    add(SLOT.snow, box(1.5, 0.08, 1.8, 0, 1.5, -0.2));
    add(SLOT.snow, box(1.5, 0.05, 1.0, 0, 1.0, 1.7));
    add(SLOT.snow, box(1.5, 0.05, 0.8, 0, 0.92, -1.9));
  }
  if (taxi) add(SLOT.taxi, box(0.6, 0.2, 0.3, 0, 1.57, -0.2));
  // mergeGeometries keeps one group per input, in order
  const geo = mergeGeometries(parts.map((p) => p[1]), true);
  geo.groups.forEach((g, i) => { g.materialIndex = parts[i][0]; });
  return geo;
}

const PAINTS = [0x8a1c1c, 0xc9b98f, 0x2c3e66, 0xd9d6cc, 0x5b4636, 0x1d1f22, 0x7a7d80, 0x8c6a2b, 0x2f5a3a, 0x9fa6ad, 0x6b1f2f];

export class Vehicles {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.geo = { parked: carGeometry({ snow: true }), moving: carGeometry(), taxi: carGeometry({ taxi: true }) };
    const taxiTex = signTexture('TAXI', { bg: '#f2c230', fg: '#111', w: 128, h: 48 });
    this.shared = {
      glass: new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.15, metalness: 0.6 }),
      black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
      headOff: new THREE.MeshStandardMaterial({ color: 0x9a9a8c, roughness: 0.3 }),
      headOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.8, 3.2) }),
      tailOff: new THREE.MeshStandardMaterial({ color: 0x5a0d0d, roughness: 0.4 }),
      tailOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.15, 0.1) }),
      snow: new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.9 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0x9a9da2, metalness: 0.9, roughness: 0.3 }),
      taxi: new THREE.MeshBasicMaterial({ map: taxiTex, color: new THREE.Color(1.6, 1.6, 1.6) }),
    };
    this.paints = new Map();
    this.moving = [];
    this.parkCars();
    this.traffic();
  }

  paint(c) {
    if (!this.paints.has(c)) this.paints.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.4 }));
    return this.paints.get(c);
  }

  materials(color, on) {
    const s = this.shared;
    return [this.paint(color), s.glass, s.black, on ? s.headOn : s.headOff, on ? s.tailOn : s.tailOff, s.snow, s.chrome, s.taxi];
  }

  parkCars() {
    const r = rng(505);
    const k = L.kungsgatan;
    const avoid = [[-15, 9], [L.kyrkogata.z0 - 5, L.kyrkogata.z1 + 6], [k.z0 - 14, k.z1 + 6], [L.zNorth, L.zNorth + 6], [L.zSouth - 6, L.zSouth]];
    for (const side of [-1, 1]) {
      let z = L.zNorth + 8;
      while (z < L.zSouth - 8) {
        z += 5.6 + r() * 3;
        if (r() < 0.22) { z += 6 + r() * 10; continue; }
        if (avoid.some(([a, b]) => z > a - 2.5 && z < b + 2.5)) continue;
        const x = side * 9.45;
        const car = new THREE.Mesh(this.geo.parked, this.materials(pick(r, PAINTS), false));
        car.position.set(x, 0, z);
        car.rotation.y = side < 0 ? 0 : Math.PI;
        car.rotation.y += (r() - 0.5) * 0.05;
        this.scene.add(car);
        this.world.addCollider(x - 0.9, x + 0.9, z - 2.45, z + 2.45, 1.5);
      }
    }
    // a couple on Tunnelgatan and Malmskillnadsgatan
    for (const [x, z, ry, y] of [[-30, -2.4, Math.PI / 2, 0], [-52, 2.4, -Math.PI / 2, 0], [-89.5 - 1.5, -22, Math.PI, L.plateauH], [-96.5, 30, 0, L.plateauH]]) {
      const car = new THREE.Mesh(this.geo.parked, this.materials(pick(r, PAINTS), false));
      car.position.set(x, y, z);
      car.rotation.y = ry;
      this.scene.add(car);
      const along = Math.abs(Math.sin(ry)) > 0.5;
      if (along) this.world.addCollider(x - 2.45, x + 2.45, z - 0.9, z + 0.9, y + 1.5);
      else this.world.addCollider(x - 0.9, x + 0.9, z - 2.45, z + 2.45, y + 1.5);
    }
  }

  traffic() {
    const r = rng(606);
    const beamMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(0.55, 0.5, 0.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const tailGlowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(0.5, 0.02, 0.02), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const lanes = [
      { x: -6.6, dir: 1 }, { x: -3.3, dir: 1 },
      { x: 3.3, dir: -1 }, { x: 6.6, dir: -1 },
    ];
    const span = L.zSouth - L.zNorth + 50;
    for (let i = 0; i < 7; i++) {
      const lane = lanes[i % lanes.length];
      const taxi = r() < 0.3;
      const g = new THREE.Group();
      const body = new THREE.Mesh(taxi ? this.geo.taxi : this.geo.moving, this.materials(taxi ? 0x1d1f22 : pick(r, PAINTS), true));
      g.add(body);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(4, 12).rotateX(-Math.PI / 2), beamMat);
      beam.position.set(0, 0.03, 8);
      g.add(beam);
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5).rotateX(-Math.PI / 2), tailGlowMat);
      tail.position.set(0, 0.03, -3.2);
      g.add(tail);
      g.rotation.y = lane.dir > 0 ? 0 : Math.PI;
      const z = L.zNorth - 25 + ((i * 0.37 + r() * 0.1) % 1) * span;
      g.position.set(lane.x, 0, z);
      this.scene.add(g);
      const cruise = 9 + r() * 5;
      this.moving.push({ g, lane, speed: cruise, cruise });
    }
  }

  update(dt, player) {
    const zMin = L.zNorth - 25;
    const zMax = L.zSouth + 25;
    for (const c of this.moving) {
      const { g, lane } = c;
      let target = c.cruise;
      // stop for the player standing in the lane
      if (player.y < 2) {
        const ahead = (player.z - g.position.z) * lane.dir;
        if (Math.abs(player.x - lane.x) < 1.8 && ahead > 0 && ahead < 14) target = ahead < 5 ? 0 : Math.min(target, (ahead - 5) * 1.2);
      }
      // keep distance to cars ahead in the same lane
      for (const o of this.moving) {
        if (o === c || o.lane !== lane) continue;
        const gap = (o.g.position.z - g.position.z) * lane.dir;
        if (gap > 0 && gap < 16) target = Math.min(target, Math.max(0, (gap - 7) * 1.2));
      }
      c.speed += (target - c.speed) * Math.min(1, dt * (target < c.speed ? 4 : 1.2));
      g.position.z += lane.dir * c.speed * dt;
      if (g.position.z > zMax) g.position.z = zMin;
      if (g.position.z < zMin) g.position.z = zMax;
    }
  }

  /** Distance from (x, z) to the nearest moving car, for audio. */
  nearestDistance(x, z) {
    let d = Infinity;
    for (const c of this.moving) d = Math.min(d, Math.hypot(c.g.position.x - x, c.g.position.z - z));
    return d;
  }
}
