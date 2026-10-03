import * as THREE from 'three';
import { L, groundHeight } from './layout.js';
import { rng, pick } from './textures.js';

const COATS = [0x1d1f24, 0x3b2f26, 0x4a4a4f, 0x2a3346, 0x5e4a36, 0x232323, 0x6b5b45];

/** Simple low-poly person in a winter coat. Returns { group, legs }. */
export function makePerson(r, { coat, hat = r() < 0.5, height = 1.7 + r() * 0.15 } = {}) {
  const g = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: coat ?? pick(r, COATS), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9b59a, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 });
  const s = height / 1.75;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.29, 0.95, 10), coatMat);
  body.position.y = 0.95 * s + 0.02;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), coatMat);
  shoulders.position.y = 1.42 * s;
  shoulders.scale.set(1.05, 0.5, 0.8);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin);
  head.position.y = 1.6 * s;
  const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 8), new THREE.MeshStandardMaterial({ color: pick(r, [0x7a1f1f, 0x2d4a6b, 0x6b6b6b, 0xa48a52]) }));
  scarf.position.y = 1.47 * s;
  g.add(body, shoulders, head, scarf);
  if (hat) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), dark);
    h.position.y = 1.7 * s;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 12), dark);
    brim.position.y = 1.65 * s;
    g.add(h, brim);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: pick(r, [0x2a1d14, 0x6b5338, 0x9a9590, 0xc9b27a]) }));
    hair.position.y = 1.61 * s;
    g.add(hair);
  }
  const legs = [];
  for (const sx of [-0.09, 0.09]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.5 * s, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.5 * s, 6), dark);
    leg.position.y = -0.25 * s;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  return { group: g, legs };
}

/** Late-night pedestrians walking up and down the pavements. */
export class People {
  constructor(world) {
    this.world = world;
    this.list = [];
    const r = rng(808);
    const routes = [
      { x: -13.2, z0: -260, z1: -10 },
      { x: -13.0, z0: 10, z1: 126 },
      { x: 13.6, z0: -260, z1: -98 },
      { x: 13.0, z0: -80, z1: 140 },
      { x: -13.6, z0: -120, z1: 120 },
      { x: 13.9, z0: -200, z1: 100 },
    ];
    routes.forEach((route) => {
      const p = makePerson(r);
      const t = r();
      p.group.position.set(route.x, L.sidewalkH, route.z0 + (route.z1 - route.z0) * t);
      this.world.scene.add(p.group);
      this.list.push({ ...p, route, dir: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.4, phase: r() * 10, pause: 0 });
    });
  }

  update(dt, player) {
    for (const p of this.list) {
      const pos = p.group.position;
      const dx = player.x - pos.x;
      const dz = player.z - pos.z;
      const near = Math.hypot(dx, dz) < 1.2 && Math.abs(player.y - pos.y) < 2;
      let v = near ? 0 : p.speed;
      pos.z += p.dir * v * dt;
      pos.y = groundHeight(pos.x, pos.z);
      if (pos.z > p.route.z1) p.dir = -1;
      if (pos.z < p.route.z0) p.dir = 1;
      p.group.rotation.y = p.dir > 0 ? 0 : Math.PI;
      p.phase += dt * v * 5;
      const swing = Math.sin(p.phase) * 0.45 * (v > 0 ? 1 : 0);
      p.legs[0].rotation.x = swing;
      p.legs[1].rotation.x = -swing;
    }
  }

  /** Pedestrians as soft circular obstacles for the player. */
  obstacles() {
    return this.list.map((p) => p.group.position);
  }
}
