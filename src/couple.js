import * as THREE from 'three';
import { groundHeight } from './layout.js';
import { rng } from './textures.js';
import { makePerson } from './people.js';

const WALK = 1.15;
const FLEE = 3.0;
const SIDE = 0.32; // each of them walks this far either side of the route

// Their route after the late show: out of Biografen Grand, south on the east
// pavement, over the zebra crossing at Adolf Fredriks kyrkogata, a look in
// Dekorima's window, past the corner of Tunnelgatan and on to Hötorget T-bana.
const ROUTE = [
  { x: 15.4, z: -150 },
  { x: 13.4, z: -147 },
  { x: 13.4, z: -84 },
  { x: 12.0, z: -81 },
  { x: -12.0, z: -81 },
  { x: -13.3, z: -78 },
  { x: -14.6, z: -18 },
  { x: -14.6, z: -16, wait: 14, face: -Math.PI / 2, note: 'window' },
  { x: -13.6, z: -7 },
  { x: -13.3, z: 4 },
  { x: -11.6, z: 130 },
  { x: -11.6, z: 145.5 },
  { x: -13.7, z: 144.2 },
  { x: -13.7, z: 139, gone: true },
];

/**
 * The couple walking home from the cinema. They stay inside Grand until
 * `leave()` is called, then follow ROUTE side by side. A miss, or a drawn
 * gun seen up close, sends them hurrying on towards the T-bana.
 */
export class Couple {
  constructor(world) {
    this.world = world;
    const r = rng(1986);
    this.man = { ...makePerson(r, { coat: 0x1f2227, hat: false, height: 1.8, hair: 0xa29c94 }), who: 'man', side: -1 };
    this.woman = { ...makePerson(r, { coat: 0x5a4a3a, hat: true, height: 1.66 }), who: 'woman', side: 1 };
    this.people = [this.man, this.woman];
    for (const p of this.people) {
      p.group.rotation.order = 'YXZ';
      p.group.visible = false;
      p.down = 0; // 0 standing → 1 lying in the snow
      p.hit = false;
      p.group.traverse((o) => { o.userData.person = p; });
      world.scene.add(p.group);
    }
    this.state = 'inside'; // inside | walking | waiting | gone | stopped
    this.leg = 0; // index of the waypoint being walked towards
    this.at = new THREE.Vector2(ROUTE[0].x, ROUTE[0].z);
    this.heading = Math.PI / 2;
    this.alarmed = false;
    this.wait = 0;
    this.phase = 0;
    this.onReach = null; // (note) => void
  }

  get visible() {
    return this.state !== 'inside' && this.state !== 'gone';
  }

  leave() {
    if (this.state !== 'inside') return;
    this.state = 'walking';
    this.leg = 1;
    for (const p of this.people) p.group.visible = true;
  }

  /** Something frightened them: they skip the window and hurry on. */
  alarm() {
    if (this.alarmed || this.state === 'stopped' || this.state === 'gone') return;
    this.alarmed = true;
    if (this.state === 'waiting') this.state = 'walking';
  }

  /** A bullet hit `p`. The man goes down; the woman is wounded but stays by him. */
  shoot(p) {
    p.hit = true;
    if (p === this.man) {
      this.state = 'stopped';
    } else {
      this.woman.flinch = 1;
      this.alarm();
    }
  }

  /** Target meshes for the weapon's raycast. */
  targets() {
    return this.visible || this.state === 'stopped' ? this.people.map((p) => p.group) : [];
  }

  /** Soft obstacles for the player and walkers for the traffic. */
  positions() {
    return this.visible || this.state === 'stopped' ? this.people.map((p) => p.group.position) : [];
  }

  update(dt, player) {
    if (this.state === 'inside' || this.state === 'gone') return;
    if (this.state === 'stopped') {
      this.aftermath(dt);
      return;
    }

    let speed = 0;
    if (this.state === 'waiting') {
      this.wait -= dt;
      if (this.wait <= 0) this.state = 'walking';
    }
    if (this.state === 'walking') {
      speed = this.alarmed ? FLEE : WALK;
      const target = ROUTE[this.leg];
      const dx = target.x - this.at.x;
      const dz = target.z - this.at.y;
      const dist = Math.hypot(dx, dz);
      // don't walk through the player
      const ahead = (player.x - this.at.x) * Math.sin(this.heading) + (player.z - this.at.y) * Math.cos(this.heading);
      const across = Math.abs((player.x - this.at.x) * Math.cos(this.heading) - (player.z - this.at.y) * Math.sin(this.heading));
      if (!this.alarmed && ahead > 0 && ahead < 1.3 && across < 0.9 && Math.abs(player.y - groundHeight(this.at.x, this.at.y)) < 1.5) speed = 0;
      const step = speed * dt;
      const want = Math.atan2(dx, dz);
      this.heading += angleDelta(this.heading, want) * Math.min(1, dt * 6);
      if (dist <= step) {
        this.at.set(target.x, target.z);
        this.arrive(target);
      } else {
        this.at.x += (dx / dist) * step;
        this.at.y += (dz / dist) * step;
      }
    } else if (this.state === 'waiting') {
      this.heading += angleDelta(this.heading, ROUTE[this.leg - 1].face) * Math.min(1, dt * 3);
    }
    this.place(dt, speed);
  }

  arrive(target) {
    if (target.note) this.onReach?.(target.note);
    if (target.gone) {
      this.state = 'gone';
      for (const p of this.people) p.group.visible = false;
      this.onReach?.('gone');
      return;
    }
    this.leg++;
    if (target.wait && !this.alarmed) {
      this.state = 'waiting';
      this.wait = target.wait;
    }
  }

  place(dt, speed) {
    const s = Math.sin(this.heading), c = Math.cos(this.heading);
    this.phase += dt * speed * 5;
    const swing = Math.sin(this.phase) * (this.alarmed ? 0.7 : 0.45) * (speed > 0 ? 1 : 0);
    // near the T-bana they go down the stairs
    const last = ROUTE[ROUTE.length - 1];
    const sink = this.leg === ROUTE.length - 1 ? Math.max(0, 1 - Math.hypot(this.at.x - last.x, this.at.y - last.z) / 5.2) * 2.6 : 0;
    for (const p of this.people) {
      const x = this.at.x + c * SIDE * p.side;
      const z = this.at.y - s * SIDE * p.side;
      p.group.position.set(x, groundHeight(x, z) - sink, z);
      p.group.rotation.y = this.heading;
      p.legs[0].rotation.x = swing * p.side;
      p.legs[1].rotation.x = -swing * p.side;
      if (p.flinch) {
        p.flinch = Math.max(0, p.flinch - dt * 2.5);
        p.group.rotation.z = Math.sin(p.flinch * 9) * 0.12 * p.flinch;
      }
    }
  }

  /** He falls; she kneels down beside him. */
  aftermath(dt) {
    const m = this.man, w = this.woman;
    if (m.down < 1) {
      m.down = Math.min(1, m.down + dt * 1.8);
      const k = easeIn(m.down);
      m.group.rotation.x = k * Math.PI * 0.5; // forwards, into the snow
      m.group.position.y = groundHeight(m.group.position.x, m.group.position.z) + k * 0.22;
      for (const leg of m.legs) leg.rotation.x *= 1 - k;
    }
    if (w.down < 1 && m.down > 0.5) {
      w.down = Math.min(1, w.down + dt * 0.9);
      const k = easeOut(w.down);
      const g = w.group;
      // turn towards him
      const want = Math.atan2(m.group.position.x - g.position.x, m.group.position.z - g.position.z);
      g.rotation.y += angleDelta(g.rotation.y, want) * Math.min(1, dt * 4);
      g.rotation.z = 0;
      g.position.y = groundHeight(g.position.x, g.position.z) - k * 0.42;
      g.rotation.x = k * 0.35;
      for (const leg of w.legs) leg.rotation.x = k * 1.5;
    }
  }
}

function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
