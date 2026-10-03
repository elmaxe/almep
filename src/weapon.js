import * as THREE from 'three';
import { groundHeight } from './layout.js';
import { glowTexture } from './textures.js';

const CHAMBERS = 6;
const RANGE = 160;
const RELOAD_TIME = 2.2;
const FIRE_DELAY = 0.38; // double action: a heavy trigger pull between shots

/**
 * A six-shot revolver held in the right hand. Hitscan from the centre of the
 * screen against `targets()`, blocked by buildings, parked cars and the ground.
 */
export class Weapon {
  constructor(camera, world, dom, { targets, onShot, audio }) {
    this.camera = camera;
    this.world = world;
    this.dom = dom;
    this.targets = targets;
    this.onShot = onShot; // ({ origin, point, person, distance }) => void
    this.audio = audio;
    this.enabled = false;
    this.drawn = false;
    this.show = 0; // 0 holstered → 1 aimed
    this.rounds = CHAMBERS;
    this.reloading = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this.flash = 0;
    this.spin = 0;
    this.shotsFired = 0;
    this.onChange = null; // () => void, for the HUD
    this.ray = new THREE.Raycaster();
    this.ray.far = RANGE;

    this.build();
    this.puffs = [];
    const puffMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc9ced8, transparent: true, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(puffMat.clone());
      s.visible = false;
      world.scene.add(s);
      this.puffs.push({ s, t: 0 });
    }

    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'KeyF' || e.code === 'Digit1') this.toggle();
      if (e.code === 'KeyR') this.reload();
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.enabled && document.pointerLockElement === dom) this.trigger();
    });
  }

  build() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.8, roughness: 0.32, emissive: 0x101216 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.6, emissive: 0x0a0503 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x18171a, roughness: 0.75, emissive: 0x050505 });
    const gun = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      gun.add(m);
      return m;
    };
    // barrel with an underlug, along -z
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 12), steel, 0, 0.022, -0.13, Math.PI / 2);
    add(new THREE.BoxGeometry(0.016, 0.014, 0.15), steel, 0, 0.006, -0.125);
    add(new THREE.BoxGeometry(0.006, 0.012, 0.012), steel, 0, 0.038, -0.2); // front sight
    // cylinder
    this.cylinder = add(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 6), steel, 0, 0.012, -0.025, Math.PI / 2);
    // frame, top strap, hammer and trigger guard
    add(new THREE.BoxGeometry(0.022, 0.05, 0.06), steel, 0, 0.004, 0.012);
    add(new THREE.BoxGeometry(0.018, 0.008, 0.075), steel, 0, 0.04, -0.02);
    this.hammer = add(new THREE.BoxGeometry(0.008, 0.02, 0.012), steel, 0, 0.034, 0.04);
    const guard = add(new THREE.TorusGeometry(0.016, 0.003, 6, 12, Math.PI), steel, 0, -0.022, 0.01);
    guard.rotation.set(0, Math.PI / 2, Math.PI);
    // grip
    const grip = add(new THREE.BoxGeometry(0.024, 0.075, 0.032), wood, 0, -0.04, 0.05);
    grip.rotation.x = -0.32;
    // gloved hand wrapped round the grip
    const hand = add(new THREE.BoxGeometry(0.05, 0.06, 0.055), glove, -0.004, -0.045, 0.055);
    hand.rotation.x = -0.32;
    add(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.9 }), 0, -0.07, 0.22, Math.PI / 2 - 0.25); // coat sleeve

    // muzzle flash: sprite at the barrel tip plus a real light (added up front
    // so the scene's light count, and with it every shader, never changes)
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(3, 2.1, 1.1), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.flashSprite.position.set(0, 0.022, -0.24);
    this.flashSprite.scale.setScalar(0.1);
    this.flashSprite.visible = false;
    gun.add(this.flashSprite);
    this.light = new THREE.PointLight(0xffb060, 0, 14, 1.6);
    this.light.position.set(0, 0.03, -0.35);
    gun.add(this.light);

    gun.traverse((o) => { o.frustumCulled = false; });
    this.gun = gun;
    this.camera.add(gun);
  }

  toggle() {
    if (this.reloading) return;
    this.drawn = !this.drawn;
    this.onChange?.();
  }

  holster() {
    this.drawn = false;
    this.onChange?.();
  }

  reload() {
    if (this.reloading || this.rounds === CHAMBERS) return;
    this.drawn = true;
    this.reloading = RELOAD_TIME;
    this.audio?.reload();
    this.onChange?.();
  }

  /** Pull the trigger: draws the gun first if it's in the coat. */
  trigger() {
    if (!this.enabled) return;
    if (!this.drawn) { this.toggle(); return; }
    if (this.reloading || this.cooldown > 0 || this.show < 0.9) return;
    if (this.rounds === 0) {
      this.audio?.dryFire();
      this.cooldown = 0.3;
      this.reload();
      return;
    }
    this.rounds--;
    this.shotsFired++;
    this.cooldown = FIRE_DELAY;
    this.recoil = 1;
    this.flash = 0.06;
    this.spin += Math.PI / 3;
    this.audio?.shot();
    this.fire();
    this.onChange?.();
  }

  fire() {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    this.camera.getWorldDirection(dir);
    const wall = this.blockDistance(origin, dir);
    this.ray.set(origin, dir);
    const hits = this.ray.intersectObjects(this.targets(), true).filter((h) => h.object.userData.person);
    const hit = hits.find((h) => h.distance < wall);
    if (hit) {
      this.onShot?.({ origin, point: hit.point, person: hit.object.userData.person, distance: hit.distance });
    } else {
      const point = origin.clone().addScaledVector(dir, Math.min(wall, RANGE));
      if (wall < RANGE) this.puff(point.addScaledVector(dir, -0.05));
      this.onShot?.({ origin, point, person: null, distance: wall });
    }
  }

  /** Distance along the ray to the first building, car or patch of ground. */
  blockDistance(o, d) {
    let best = RANGE;
    for (const c of this.world.colliders) {
      const t = slab(o, d, c.x0, c.x1, -1, Math.min(c.maxY, 80), c.z0, c.z1);
      if (t !== null && t < best) best = t;
    }
    if (d.y < 0) {
      for (let t = 0.25; t < best; t += 0.25) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (y < groundHeight(x, z)) return t;
      }
    }
    return best;
  }

  puff(p) {
    const puff = this.puffs.find((q) => q.t <= 0) ?? this.puffs[0];
    puff.t = 0.5;
    puff.s.position.copy(p);
    puff.s.visible = true;
  }

  update(dt, player) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading) {
      this.reloading = Math.max(0, this.reloading - dt);
      if (!this.reloading) {
        this.rounds = CHAMBERS;
        this.onChange?.();
      }
    }
    const want = this.drawn && this.enabled ? 1 : 0;
    this.show += (want - this.show) * Math.min(1, dt * 9);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.flash = Math.max(0, this.flash - dt);

    // hold it low and to the right; bob with the stride, kick up when fired
    const g = this.gun;
    const hide = 1 - this.show;
    const bob = player.bob ?? 0;
    const sway = Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 3);
    const rl = this.reloading ? Math.sin(Math.min(1, (RELOAD_TIME - this.reloading) / RELOAD_TIME) * Math.PI) : 0;
    g.position.set(
      0.16 + Math.sin(bob) * 0.008 * sway,
      -0.13 - hide * 0.35 - Math.abs(Math.cos(bob)) * 0.006 * sway - rl * 0.05,
      -0.34 + this.recoil * 0.045,
    );
    g.rotation.set(this.recoil * 0.32 + hide * -0.9 + rl * 0.5, 0.04, rl * 0.7);
    g.visible = this.show > 0.02;
    this.cylinder.rotation.y += (this.spin - this.cylinder.rotation.y) * Math.min(1, dt * 20);
    this.hammer.rotation.x = this.cooldown > 0 ? 0 : -0.5;

    this.flashSprite.visible = this.flash > 0;
    this.flashSprite.material.rotation = Math.random() * Math.PI;
    this.light.intensity = this.flash > 0 ? 40 : 0;

    for (const p of this.puffs) {
      if (p.t <= 0) continue;
      p.t -= dt;
      const k = 1 - p.t / 0.5;
      p.s.scale.setScalar(0.2 + k * 0.8);
      p.s.material.opacity = (1 - k) * 0.7;
      p.s.position.y += dt * 0.3;
      if (p.t <= 0) p.s.visible = false;
    }
  }
}

/** Ray/box intersection: distance to the box along the ray, or null. */
function slab(o, d, x0, x1, y0, y1, z0, z1) {
  let tmin = 0, tmax = Infinity;
  for (const [oa, da, a0, a1] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(da) < 1e-9) {
      if (oa < a0 || oa > a1) return null;
      continue;
    }
    let t0 = (a0 - oa) / da, t1 = (a1 - oa) / da;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return null;
  }
  return tmin;
}

export { CHAMBERS };
