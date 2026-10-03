import * as THREE from 'three';
import { flakeTexture } from './textures.js';

const COUNT = 7000;
const BOX = { x: 70, y: 32, z: 70 };

/** Falling snow in a box that follows the camera. */
export class Snow {
  constructor(scene) {
    const pos = new Float32Array(COUNT * 3);
    this.speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOX.x;
      pos[i * 3 + 1] = Math.random() * BOX.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
      this.speed[i] = 0.6 + Math.random() * 0.9;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: flakeTexture(), size: 0.07, color: 0xdde4f0, transparent: true,
      depthWrite: false, opacity: 0.85, sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.t = 0;
  }

  update(dt, center) {
    this.t += dt;
    const p = this.geo.attributes.position.array;
    const windX = Math.sin(this.t * 0.3) * 0.6 + 0.4;
    const windZ = Math.cos(this.t * 0.21) * 0.3;
    const hx = BOX.x / 2, hz = BOX.z / 2;
    const base = center.y - 8;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3;
      p[j] += (windX + Math.sin(this.t * 1.3 + i) * 0.25) * dt;
      p[j + 1] -= this.speed[i] * dt;
      p[j + 2] += (windZ + Math.cos(this.t * 1.1 + i * 0.7) * 0.25) * dt;
      // wrap around the camera
      let dx = p[j] - center.x;
      if (dx > hx) p[j] -= BOX.x; else if (dx < -hx) p[j] += BOX.x;
      let dz = p[j + 2] - center.z;
      if (dz > hz) p[j + 2] -= BOX.z; else if (dz < -hz) p[j + 2] += BOX.z;
      if (p[j + 1] < base || p[j + 1] < 0) p[j + 1] += BOX.y;
      else if (p[j + 1] > base + BOX.y) p[j + 1] -= BOX.y;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
