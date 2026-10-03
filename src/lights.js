import * as THREE from 'three';
import { L, groundHeight } from './layout.js';
import { glowTexture } from './textures.js';

const LAMP_COLOR = new THREE.Color(0xffd6a0);
const POOL_SIZE = 12;

/**
 * Street lighting in the Stockholm manner: lamps hung on wires strung
 * across the street, plus post lamps in the churchyard. Every lamp gets an
 * emissive fixture, a halo sprite and a light pool decal on the ground; a
 * small pool of real PointLights is moved to the lamps nearest the player.
 */
export class StreetLights {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.specs = world.lampSpecs;
    this.wires = [];
    this.poles = [];
    this.layoutWires();
    this.buildVisuals();
    this.buildPool();
    this.timer = 0;
  }

  hang(x, y, z) { this.specs.push({ x, y, z, kind: 'hang' }); }

  wire(ax, ay, az, bx, by, bz, sag = 0.5) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector3(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * sag, az + (bz - az) * t));
    }
    for (let i = 0; i < pts.length - 1; i++) this.wires.push(pts[i], pts[i + 1]);
  }

  pole(x, z, h, base = 0) {
    this.poles.push({ x, z, h, base });
    this.world.addCollider(x - 0.15, x + 0.15, z - 0.15, z + 0.15, Infinity);
  }

  layoutWires() {
    const k = L.kungsgatan;
    const gapW = (z) => (z > L.tunnel.z0 - 1 && z < L.tunnel.z1 + 1) || (z > k.z0 - 1 && z < k.z1 + 1);
    const gapE = (z) => (z > L.kyrkogata.z0 - 1 && z < L.churchyard.z1 + 1) || (z > k.z0 - 1 && z < k.z1 + 1);
    // Sveavägen
    for (let z = L.zNorth + 12; z < L.zSouth - 4; z += 28) {
      const wx = gapW(z) ? -15.4 : -16;
      const ex = gapE(z) ? 15.4 : 16;
      if (gapW(z)) this.pole(-15.4, z, 10.2, L.sidewalkH);
      if (gapE(z)) this.pole(15.4, z, 10.2, L.sidewalkH);
      this.wire(wx, 10, z, ex, 10, z, 0.7);
      this.hang(-5.6, 9.1, z);
      this.hang(5.6, 9.1, z);
      this.wire(-5.6, 9.45, z, -5.6, 9.2, z, 0);
      this.wire(5.6, 9.45, z, 5.6, 9.2, z, 0);
    }
    // Tunnelgatan
    for (const x of [-27, -45, -63]) {
      this.wire(x, 8, L.tunnel.z0, x, 8, L.tunnel.z1, 0.3);
      this.hang(x, 7.4, 0);
    }
    // wall lamps on the stair walls
    for (const x of [-75, -81, -86.5]) {
      const h = Math.max(1, ((L.stairs.x1 - x) / (L.stairs.x1 - L.stairs.x0)) * L.plateauH);
      this.specs.push({ x, y: h + 2.4, z: L.stairs.z0 + 0.25, kind: 'wall' });
    }
    // Malmskillnadsgatan
    for (let z = -56; z <= 60; z += 24) {
      this.wire(L.malm.x0, L.plateauH + 8, z, L.stairs.x0, L.plateauH + 8, z, 0.4);
      this.hang(-94, L.plateauH + 7.3, z);
    }
    // Adolf Fredriks kyrkogata
    for (const x of [34, 62, 92]) {
      this.pole(x, L.kyrkogata.z1 - 0.4, 8.5, L.sidewalkH);
      this.wire(x, 8, L.kyrkogata.z0, x, 8, L.kyrkogata.z1 - 0.4, 0.3);
      this.hang(x, 7.4, (L.kyrkogata.road0 + L.kyrkogata.road1) / 2);
    }
    // Kungsgatan
    for (const x of [-58, -32, 32, 58]) {
      this.wire(x, 9, k.z0, x, 9, k.z1, 0.4);
      this.hang(x, 8.3, (k.z0 + k.z1) / 2);
    }
  }

  buildVisuals() {
    const scene = this.scene;
    const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.6, roughness: 0.5 });
    // wires
    const wg = new THREE.BufferGeometry().setFromPoints(this.wires);
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x101214 })));
    // poles
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 1, 8);
    const poles = new THREE.InstancedMesh(poleGeo, metal, Math.max(1, this.poles.length));
    const m4 = new THREE.Matrix4();
    this.poles.forEach((p, i) => {
      m4.compose(new THREE.Vector3(p.x, p.base + p.h / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(1, p.h, 1));
      poles.setMatrixAt(i, m4);
    });
    scene.add(poles);

    // fixtures
    const n = this.specs.length;
    const shadeGeo = new THREE.CylinderGeometry(0.18, 0.55, 0.38, 14, 1, true);
    const bulbGeo = new THREE.CircleGeometry(0.5, 14).rotateX(Math.PI / 2);
    const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 1, 6);
    const shades = new THREE.InstancedMesh(shadeGeo, new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide }), n);
    const bulbMat = new THREE.MeshBasicMaterial({ color: LAMP_COLOR.clone().multiplyScalar(3.2), side: THREE.DoubleSide });
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, n);
    const posts = this.specs.filter((s) => s.kind === 'post');
    const postMesh = new THREE.InstancedMesh(postGeo, metal, Math.max(1, posts.length));
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: LAMP_COLOR.clone().multiplyScalar(0.85), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: LAMP_COLOR.clone().multiplyScalar(0.26), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 });
    const pools = [...this.specs, ...this.world.extraGlows.map((g) => ({ ...g, y: 6, kind: 'extra' }))];
    const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, pools.length);
    poolMesh.renderOrder = 1;

    const q = new THREE.Quaternion();
    let pi = 0;
    this.specs.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, s.y + 0.2, s.z), q, new THREE.Vector3(1, 1, 1).multiplyScalar(s.kind === 'hang' ? 1 : 0.55));
      shades.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(s.x, s.y + 0.02, s.z), q, new THREE.Vector3(1, 1, 1).multiplyScalar(s.kind === 'hang' ? 0.85 : 0.5));
      bulbs.setMatrixAt(i, m4);
      if (s.kind === 'post') {
        m4.compose(new THREE.Vector3(s.x, (s.y + s.base) / 2, s.z), q, new THREE.Vector3(1, s.y - s.base, 1));
        postMesh.setMatrixAt(pi++, m4);
      }
      const halo = new THREE.Sprite(glowMat);
      halo.position.set(s.x, s.y - 0.1, s.z);
      halo.scale.setScalar(s.kind === 'hang' ? 3.2 : 1.8);
      scene.add(halo);
    });
    pools.forEach((s, i) => {
      const gy = groundHeight(s.x, s.z) + 0.03;
      const r = s.r ?? (s.kind === 'hang' ? Math.min(16, s.y * 1.6) : 7);
      m4.compose(new THREE.Vector3(s.x, gy, s.z), q, new THREE.Vector3(r * 2, 1, r * 2));
      poolMesh.setMatrixAt(i, m4);
    });
    scene.add(shades, bulbs, postMesh, poolMesh);
  }

  buildPool() {
    this.candidates = [
      ...this.specs.map((s) => Object.assign(new THREE.Vector3(s.x, s.y - 0.3, s.z), { power: s.kind === 'hang' ? 38 : s.kind === 'post' ? 12 : 6 })),
      ...this.world.lamps.map((p) => Object.assign(p, { power: p.power ?? 20 })),
    ];
    this.lights = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = new THREE.PointLight(LAMP_COLOR, 0, 30, 1.6);
      this.scene.add(l);
      this.lights.push(l);
    }
  }

  update(dt, playerPos) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.2;
    const sorted = this.candidates
      .map((p) => [p, p.distanceToSquared(playerPos)])
      .sort((a, b) => a[1] - b[1]);
    this.lights.forEach((l, i) => {
      const c = sorted[i];
      if (!c) { l.intensity = 0; return; }
      l.position.copy(c[0]);
      l.intensity = c[0].power;
    });
  }
}
