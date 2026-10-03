import * as THREE from 'three';
import { groundHeight } from './layout.js';

const RADIUS = 0.35;
const EYE = 1.68;
const CROUCH_EYE = 1.05;
const WALK = 3.0;
const RUN = 6.2;
const STEP_UP = 0.45;

/** First-person walker with pointer-lock mouse look and AABB collisions. */
export class Player {
  constructor(camera, world, dom) {
    this.camera = camera;
    this.world = world;
    this.dom = dom;
    this.pos = new THREE.Vector3(-13, 0.12, -150); // feet
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = -Math.PI * 0.62; // looking across at Biografen Grand
    this.pitch = 0.05;
    this.keys = new Set();
    this.touch = { x: 0, y: 0, run: false, crouch: false }; // set by TouchControls
    this.eye = EYE;
    this.bob = 0;
    this.onStep = null;
    this.enabled = false;
    this.obstacles = () => [];

    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.jump();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      this.look(e.movementX, e.movementY, 0.0022);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  jump() {
    if (this.enabled && this.grounded) this.vy = 4.2;
  }

  blocked(x, z) {
    const feet = this.pos.y;
    for (const c of this.world.colliders) {
      if (feet >= c.maxY - STEP_UP) continue;
      if (x + RADIUS > c.x0 && x - RADIUS < c.x1 && z + RADIUS > c.z0 && z - RADIUS < c.z1) return c;
    }
    for (const o of this.obstacles()) {
      if (Math.abs(o.y - feet) < 1.5 && Math.hypot(o.x - x, o.z - z) < RADIUS + 0.3) return o;
    }
    // can't walk up walls of terrain (e.g. the ridge from below)
    if (groundHeight(x, z) - groundHeight(this.pos.x, this.pos.z) > STEP_UP + 0.1) return true;
    return null;
  }

  update(dt) {
    const k = this.keys;
    let fx = 0, fz = 0;
    if (this.enabled) {
      if (k.has('KeyW') || k.has('ArrowUp')) fz -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) fz += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
      if (!fx && !fz) {
        fx = this.touch.x;
        fz = this.touch.y;
      }
    }
    const t = this.touch;
    const crouch = this.enabled && (k.has('KeyC') || k.has('ControlLeft') || t.crouch);
    const run = !crouch && (k.has('ShiftLeft') || k.has('ShiftRight') || t.run);
    const speed = crouch ? 1.4 : run ? RUN : WALK;
    // normalise diagonals, but keep partial analog stick input as a slower walk
    const len = Math.max(1, Math.hypot(fx, fz));
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = ((fx * cos + fz * sin) / len) * speed;
    const wz = ((-fx * sin + fz * cos) / len) * speed;
    const a = 1 - Math.exp(-10 * dt);
    this.vel.x += (wx - this.vel.x) * a;
    this.vel.z += (wz - this.vel.z) * a;

    // move each axis separately so we slide along walls
    const nx = this.pos.x + this.vel.x * dt;
    if (!this.blocked(nx, this.pos.z)) this.pos.x = nx; else this.vel.x = 0;
    const nz = this.pos.z + this.vel.z * dt;
    if (!this.blocked(this.pos.x, nz)) this.pos.z = nz; else this.vel.z = 0;

    // vertical: follow the ground (stairs, kerbs), fall with gravity when airborne
    const g = groundHeight(this.pos.x, this.pos.z);
    if (this.vy > 0 || this.pos.y - g > 0.45) {
      this.vy -= 14 * dt;
      this.pos.y += this.vy * dt;
      this.grounded = false;
      if (this.pos.y <= g) {
        this.pos.y = g;
        this.vy = 0;
        this.grounded = true;
      }
    } else {
      this.pos.y += (g - this.pos.y) * Math.min(1, dt * 15);
      this.vy = 0;
      this.grounded = true;
    }

    // camera
    this.eye += ((crouch ? CROUCH_EYE : EYE) - this.eye) * Math.min(1, dt * 10);
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const prev = this.bob;
    if (this.grounded) this.bob += dt * hspeed * 2.1;
    if (this.onStep && Math.floor(prev / Math.PI) !== Math.floor(this.bob / Math.PI) && hspeed > 0.5) this.onStep(run);
    const bobY = Math.abs(Math.sin(this.bob)) * 0.05 * Math.min(1, hspeed / 3);
    this.camera.position.set(this.pos.x, this.pos.y + this.eye + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.004, 'YXZ');
  }
}
