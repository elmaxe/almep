import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { L } from './layout.js';
import { rng, gravelTexture, graniteTexture } from './textures.js';
import { planarUV } from './city.js';

function boxAt(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

function churchWallTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e6d9b8';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(180,165,130,0.3)' : 'rgba(255,250,235,0.3)';
    ctx.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
  }
  // pilaster strips at the tile edges
  ctx.fillStyle = '#f2e8cf';
  ctx.fillRect(0, 0, 18, 512);
  ctx.fillRect(238, 0, 18, 512);
  // cornice + plinth
  ctx.fillStyle = '#cbbd98';
  ctx.fillRect(0, 0, 256, 22);
  ctx.fillStyle = '#9c917a';
  ctx.fillRect(0, 470, 256, 42);
  // tall arched window
  const wx = 78, ww = 100, wy = 120, wh = 250;
  ctx.fillStyle = '#d7c9a5';
  ctx.beginPath();
  ctx.moveTo(wx - 10, wy + wh + 10);
  ctx.lineTo(wx - 10, wy);
  ctx.arc(wx + ww / 2, wy, ww / 2 + 10, Math.PI, 0);
  ctx.lineTo(wx + ww + 10, wy + wh + 10);
  ctx.fill();
  const g = ctx.createLinearGradient(0, wy - 50, 0, wy + wh);
  g.addColorStop(0, '#3b3a44');
  g.addColorStop(1, '#16161c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh);
  ctx.lineTo(wx, wy);
  ctx.arc(wx + ww / 2, wy, ww / 2, Math.PI, 0);
  ctx.lineTo(wx + ww, wy + wh);
  ctx.fill();
  ctx.strokeStyle = '#8c8470';
  ctx.lineWidth = 3;
  for (let y = wy; y < wy + wh; y += 30) {
    ctx.beginPath(); ctx.moveTo(wx, y); ctx.lineTo(wx + ww, y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy - ww / 2); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function gableRoof(w, len, rh) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(0, rh);
  s.lineTo(w / 2, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

/** A bare winter tree (lime/elm), built from tapered cylinders. */
export function treeGeometry(seed) {
  const r = rng(seed);
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  const branch = (start, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.65, rad, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    g.applyQuaternion(q);
    g.translate(start.x, start.y, start.z);
    geos.push(g);
    if (depth <= 0) return;
    const end = start.clone().addScaledVector(dir.clone().normalize(), len);
    const kids = depth === 3 ? 4 : 3;
    for (let i = 0; i < kids; i++) {
      const d = dir.clone().normalize();
      const side = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize();
      d.addScaledVector(side, 0.6 + r() * 0.6).addScaledVector(up, 0.35).normalize();
      const from = start.clone().lerp(end, 0.55 + r() * 0.45);
      branch(from, d, len * (0.55 + r() * 0.2), rad * 0.6, depth - 1);
    }
  };
  branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 4.5 + r() * 1.5, 0.32, 3);
  return mergeGeometries(geos);
}

export class Church {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.build();
  }

  build() {
    const scene = this.scene;
    const { x: cx, z: cz } = L.church;
    const base = 0.14;
    const wallH = 13;
    const tex = churchWallTexture();
    tex.repeat.set(1 / 5, 1 / 13);
    const wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0x2a2418, emissiveIntensity: 1 });
    const copper = new THREE.MeshStandardMaterial({ color: 0x46705f, roughness: 0.55, metalness: 0.35, emissive: 0x0b1611 });

    // Greek-cross plan: nave (east–west) and transept (north–south)
    const nave = planarUV(boxAt(cx - 21, cx + 21, base, base + wallH, cz - 7.5, cz + 7.5), 1);
    const trans = planarUV(boxAt(cx - 7.5, cx + 7.5, base, base + wallH, cz - 19, cz + 19), 1);
    // shift v so the plinth sits on the ground
    for (const g of [nave, trans]) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) - base);
    }
    scene.add(new THREE.Mesh(nave, wallMat), new THREE.Mesh(trans, wallMat));
    this.world.addCollider(cx - 21, cx + 21, cz - 7.5, cz + 7.5, Infinity);
    this.world.addCollider(cx - 7.5, cx + 7.5, cz - 19, cz + 19, Infinity);
    this.world.footprints.push({ x0: cx - 21, x1: cx + 21, z0: cz - 7.5, z1: cz + 7.5, h: 30, church: true });
    this.world.footprints.push({ x0: cx - 7.5, x1: cx + 7.5, z0: cz - 19, z1: cz + 19, h: 30, church: true });

    const top = base + wallH;
    const r1 = new THREE.Mesh(gableRoof(16.4, 43, 6), copper);
    r1.rotation.y = Math.PI / 2;
    r1.position.set(cx, top, cz);
    const r2 = new THREE.Mesh(gableRoof(16.4, 39, 6), copper);
    r2.position.set(cx, top, cz);
    scene.add(r1, r2);

    // central drum, dome and lantern
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 8), wallMat);
    drum.position.set(cx, top + 7, cz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), copper);
    dome.scale.y = 0.9;
    dome.position.set(cx, top + 10, cz);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.5, 8), wallMat);
    lantern.position.set(cx, top + 18, cz);
    const lanternDome = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), copper);
    lanternDome.position.set(cx, top + 19.7, cz);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 4, 8), copper);
    spire.position.set(cx, top + 23, cz);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc9a53a, metalness: 0.9, roughness: 0.3 }));
    ball.position.set(cx, top + 25.2, cz);
    scene.add(drum, dome, lantern, lanternDome, spire, ball);

    // west door facing Sveavägen
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 }));
    door.rotation.y = -Math.PI / 2;
    door.position.set(cx - 21.03, base + 2.1, cz);
    scene.add(door);
    this.world.lampSpecs.push({ x: cx - 21.7, y: base + 5.2, z: cz, kind: 'wall' });

    this.grounds(cx, cz, base);
  }

  grounds(cx, cz, base) {
    const scene = this.scene;
    const cy = L.churchyard;
    const r = rng(303);
    // gravel paths
    const paths = [
      [cy.x0, cx - 21, cz - 2.5, cz + 2.5], // from the Sveavägen gate to the west door
      [cx - 25, cx + 25, cz - 23, cz - 19.5], // ring around the church
      [cx - 25, cx + 25, cz + 19.5, cz + 23],
      [cx - 25, cx - 21.5, cz - 23, cz + 23],
      [cx + 21.5, cx + 25, cz - 23, cz + 23],
      [cx - 2.5, cx + 2.5, cy.z0, cz - 23], // to the kyrkogata gate
    ];
    const gt = gravelTexture();
    gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
    const pathGeo = planarUV(mergeGeometries(paths.map(([x0, x1, z0, z1]) => boxAt(x0, x1, base, base + 0.02, z0, z1))), 4);
    scene.add(new THREE.Mesh(pathGeo, new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 })));
    const onPath = (x, z, pad = 1) => paths.some(([x0, x1, z0, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad);
    const onChurch = (x, z, pad = 4) => (Math.abs(x - cx) < 21 + pad && Math.abs(z - cz) < 7.5 + pad) || (Math.abs(x - cx) < 7.5 + pad && Math.abs(z - cz) < 19 + pad);

    // path lamps
    for (const [x, z] of [[28, cz + 3.5], [35, cz - 3.5], [cx - 3.5, -60], [cx + 3.5, -76], [cx - 23, cz + 24], [cx + 23, cz - 24], [cx + 23, cz + 24]]) {
      this.world.lampSpecs.push({ x, y: base + 3.6, z, base, kind: 'post' });
      this.world.addCollider(x - 0.1, x + 0.1, z - 0.1, z + 0.1, Infinity);
    }

    // trees
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 1 });
    const variants = [treeGeometry(1), treeGeometry(2), treeGeometry(3), treeGeometry(4)];
    const trees = [];
    for (let z = cy.z0 + 5; z < cy.z1 - 3; z += 9) trees.push([cy.x0 + 4.5, z], [cy.x1 - 4, z]);
    for (let x = cy.x0 + 13; x < cy.x1 - 6; x += 10) trees.push([x, cy.z0 + 5], [x, cy.z1 - 4]);
    for (let i = 0; i < 18; i++) trees.push([cy.x0 + 8 + r() * (cy.x1 - cy.x0 - 14), cy.z0 + 8 + r() * (cy.z1 - cy.z0 - 14)]);
    for (const [x, z] of trees) {
      if (onPath(x, z, 1.5) || onChurch(x, z, 3)) continue;
      const t = new THREE.Mesh(variants[Math.floor(r() * variants.length)], treeMat);
      t.position.set(x, base, z);
      t.rotation.y = r() * Math.PI * 2;
      t.scale.setScalar(0.9 + r() * 0.5);
      scene.add(t);
      this.world.addCollider(x - 0.35, x + 0.35, z - 0.35, z + 0.35, Infinity);
    }
    // a few trees on Tunnelgatan and Malmskillnadsgatan for variety
    for (const [x, z, y] of [[-96, -30, L.plateauH], [-96, 34, L.plateauH], [-91, -52, L.plateauH]]) {
      const t = new THREE.Mesh(variants[0], treeMat);
      t.position.set(x, y, z);
      t.scale.setScalar(0.8);
      scene.add(t);
    }

    // gravestones
    const stoneGeo = new THREE.BoxGeometry(0.75, 1, 0.2);
    stoneGeo.translate(0, 0.5, 0);
    const stoneMat = new THREE.MeshStandardMaterial({ map: graniteTexture(), color: 0x8a8a8a, roughness: 0.8 });
    const stones = [];
    let tries = 0;
    while (stones.length < 140 && tries++ < 4000) {
      const x = cy.x0 + 4 + r() * (cy.x1 - cy.x0 - 8);
      const z = cy.z0 + 4 + r() * (cy.z1 - cy.z0 - 8);
      if (onPath(x, z, 1.2) || onChurch(x, z, 3)) continue;
      if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 1.5)) continue;
      if (stones.some(([sx, sz]) => Math.abs(sx - x) < 1.6 && Math.abs(sz - z) < 1.2)) continue;
      stones.push([x, z, 0.6 + r() * 0.9, (r() - 0.5) * 0.15]);
    }
    const inst = new THREE.InstancedMesh(stoneGeo, stoneMat, stones.length);
    const m4 = new THREE.Matrix4();
    stones.forEach(([x, z, h, rot], i) => {
      m4.compose(new THREE.Vector3(x, base, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot * 0.5, Math.PI / 2 + rot, 0)), new THREE.Vector3(1, h, 1));
      inst.setMatrixAt(i, m4);
      this.world.addCollider(x - 0.2, x + 0.2, z - 0.45, z + 0.45, Infinity);
    });
    scene.add(inst);
    // snow caps on the stones
    const capGeo = new THREE.BoxGeometry(0.8, 0.06, 0.26);
    const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.9 }), stones.length);
    stones.forEach(([x, z, h, rot], i) => {
      m4.compose(new THREE.Vector3(x, base + h + 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2 + rot, 0)), new THREE.Vector3(1, 1, 1));
      caps.setMatrixAt(i, m4);
    });
    scene.add(caps);

    this.fences();
  }

  fences() {
    const scene = this.scene;
    const cy = L.churchyard;
    const { x: cx, z: cz } = L.church;
    const iron = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.7, roughness: 0.45 });
    const granMat = new THREE.MeshStandardMaterial({ map: graniteTexture(), color: 0x9a9a9a, roughness: 0.85 });
    const bars = [];
    const plinths = [];
    const rails = [];
    const pillars = [];
    const run = (alongX, fixed, a0, a1) => {
      if (alongX) {
        plinths.push(boxAt(a0, a1, 0, 0.45, fixed - 0.2, fixed + 0.2));
        rails.push(boxAt(a0, a1, 1.6, 1.66, fixed - 0.03, fixed + 0.03));
        for (let a = a0 + 0.08; a < a1; a += 0.16) bars.push([a, fixed]);
        this.world.addCollider(a0, a1, fixed - 0.25, fixed + 0.25, Infinity);
      } else {
        plinths.push(boxAt(fixed - 0.2, fixed + 0.2, 0, 0.45, a0, a1));
        rails.push(boxAt(fixed - 0.03, fixed + 0.03, 1.6, 1.66, a0, a1));
        for (let a = a0 + 0.08; a < a1; a += 0.16) bars.push([fixed, a]);
        this.world.addCollider(fixed - 0.25, fixed + 0.25, a0, a1, Infinity);
      }
    };
    const fx = cy.x0 + 0.4;
    const gate1 = [cz - 3, cz + 3];
    run(false, fx, cy.z0, gate1[0]);
    run(false, fx, gate1[1], cy.z1);
    const fz = cy.z0 + 0.3;
    const gate2 = [cx - 3, cx + 3];
    run(true, fz, cy.x0, gate2[0]);
    run(true, fz, gate2[1], cy.x1);
    for (const z of gate1) pillars.push(boxAt(fx - 0.4, fx + 0.4, 0, 2.4, z - 0.4, z + 0.4));
    for (const x of gate2) pillars.push(boxAt(x - 0.4, x + 0.4, 0, 2.4, fz - 0.4, fz + 0.4));

    const barGeo = new THREE.BoxGeometry(0.035, 1.25, 0.035);
    const inst = new THREE.InstancedMesh(barGeo, iron, bars.length);
    const m4 = new THREE.Matrix4();
    bars.forEach(([x, z], i) => {
      m4.makeTranslation(x, 0.45 + 0.62, z);
      inst.setMatrixAt(i, m4);
    });
    scene.add(inst);
    scene.add(new THREE.Mesh(planarUV(mergeGeometries([...plinths, ...pillars]), 2), granMat));
    scene.add(new THREE.Mesh(mergeGeometries(rails), iron));
  }
}
