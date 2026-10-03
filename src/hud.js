import { L, ROADS, SIDEWALKS, POIS, placeName } from './layout.js';

const MAP_SCALE = 2; // px per metre in the pre-rendered map
const X0 = -150, X1 = 140, Z0 = L.zNorth - 20, Z1 = L.zSouth + 20;

const DAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

/** Clock, place name, captions for points of interest and a minimap. */
export class Hud {
  constructor(world) {
    this.world = world;
    this.el = {
      place: document.getElementById('place'),
      clock: document.getElementById('clock'),
      score: document.getElementById('score'),
      caption: document.getElementById('caption'),
      captionTitle: document.querySelector('#caption h3'),
      captionText: document.querySelector('#caption p'),
      map: document.getElementById('minimap'),
    };
    this.ctx = this.el.map.getContext('2d');
    // in-game time: Friday 28 February 1986, 23:12
    this.time = new Date(1986, 1, 28, 23, 12, 0).getTime();
    this.score = 0;
    this.activePoi = null;
    this.bigMap = false;
    this.renderBaseMap();
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMap();
    });
  }

  toggleMap() {
    this.bigMap = !this.bigMap;
    this.el.map.classList.toggle('big', this.bigMap);
  }

  renderBaseMap() {
    const w = (X1 - X0) * MAP_SCALE;
    const h = (Z1 - Z0) * MAP_SCALE;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const rect = (x0, x1, z0, z1, fill) => {
      ctx.fillStyle = fill;
      ctx.fillRect((x0 - X0) * MAP_SCALE, (z0 - Z0) * MAP_SCALE, (x1 - x0) * MAP_SCALE, (z1 - z0) * MAP_SCALE);
    };
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, w, h);
    rect(-150, L.stairs.x0, -90, 90, '#1c1f26'); // ridge
    for (const r of ROADS) rect(r[0], r[1], r[2], r[3], '#3a3d44');
    for (const s of SIDEWALKS) rect(s[0], s[1], s[2], s[3], '#5a5d64');
    const cy = L.churchyard;
    rect(cy.x0, cy.x1, cy.z0, cy.z1, '#b9c2cf');
    rect(L.stairs.x0, L.stairs.x1, L.stairs.z0, L.stairs.z1, '#7b7f88');
    for (const f of this.world.footprints) {
      rect(f.x0, f.x1, f.z0, f.z1, f.church ? '#e6d9b8' : f.base > 0 ? '#5b4d40' : '#6e5a48');
    }
    ctx.strokeStyle = '#0d0f14';
    ctx.lineWidth = 1;
    for (const f of this.world.footprints) {
      if (f.church) continue;
      ctx.strokeRect((f.x0 - X0) * MAP_SCALE, (f.z0 - Z0) * MAP_SCALE, (f.x1 - f.x0) * MAP_SCALE, (f.z1 - f.z0) * MAP_SCALE);
    }
    // labels
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 16px Helvetica, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of ROADS) {
      const cx = ((r[0] + r[1]) / 2 - X0) * MAP_SCALE;
      const cz = ((r[2] + r[3]) / 2 - Z0) * MAP_SCALE;
      ctx.save();
      ctx.translate(cx, cz);
      if (r[1] - r[0] < r[3] - r[2]) ctx.rotate(-Math.PI / 2);
      if (r[4] === 'Sveavägen') {
        for (const off of [-300, 0, 260]) ctx.fillText(r[4].toUpperCase(), off, 0);
      } else ctx.fillText(r[4].toUpperCase(), 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 14px Helvetica, Arial';
    const lbl = (txt, x, z) => ctx.fillText(txt, (x - X0) * MAP_SCALE, (z - Z0) * MAP_SCALE);
    lbl('GRAND', 28, (L.grand.z0 + L.grand.z1) / 2);
    lbl('DEKORIMA', -28, -19);
    ctx.fillStyle = '#3a3020';
    lbl('ADOLF FREDRIKS KYRKA', L.church.x, L.church.z);
    this.base = c;
  }

  addScore(points) {
    this.score += points;
  }

  update(dt, player) {
    this.time += dt * 1000;
    const d = new Date(this.time);
    const pad = (n) => String(n).padStart(2, '0');
    this.el.clock.textContent = `${DAYS[d.getDay()]} 28 feb 1986  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    this.el.place.textContent = placeName(player.pos.x, player.pos.z, player.pos.y);
    this.el.score.textContent = this.score;

    // points of interest
    let poi = null;
    for (const p of POIS) if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < p.r) poi = p;
    if (poi !== this.activePoi) {
      this.activePoi = poi;
      if (poi) {
        this.el.captionTitle.textContent = poi.title;
        this.el.captionText.textContent = poi.text;
      }
      this.el.caption.classList.toggle('show', !!poi);
    }
    this.drawMap(player);
  }

  drawMap(player) {
    const c = this.el.map;
    const ctx = this.ctx;
    const w = c.width, h = c.height;
    const zoom = this.bigMap ? 0.8 : 1.2; // screen px per world metre
    ctx.save();
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom / MAP_SCALE, zoom / MAP_SCALE);
    ctx.translate(-(player.pos.x - X0) * MAP_SCALE, -(player.pos.z - Z0) * MAP_SCALE);
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();
    // player arrow (north-up map)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#ff3344';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 12px Helvetica, Arial';
    ctx.fillText('N', w / 2 - 4, 14);
  }
}
