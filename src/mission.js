import { L } from './layout.js';

// The couple leave the cinema at this in-game time.
const LEAVE_AT = new Date(1986, 1, 28, 23, 14, 0).getTime();

/**
 * Chapter 2: the couple walk down Sveavägen. Starts them off on time, reacts
 * to the shots, keeps score and reports how it ended through `onEnd`.
 */
export class Mission {
  constructor({ couple, weapon, people, hud, player }) {
    this.couple = couple;
    this.weapon = weapon;
    this.people = people;
    this.hud = hud;
    this.player = player;
    this.over = false;
    this.endTimer = 0;
    this.result = null;
    this.onEnd = null; // (result) => void

    hud.setObjective('Wait for the couple outside Biografen Grand. The late show ends at 23:14.');
    hud.markers = () => (couple.visible || couple.state === 'stopped'
      ? [{ x: couple.at.x, z: couple.at.y, color: couple.state === 'stopped' ? '#9a958a' : '#ffd23f' }]
      : []);

    couple.onReach = (note) => {
      if (this.over) return;
      if (note === 'window') hud.notify('Dekorima', 'They stop to look at the display window on the corner of Tunnelgatan.', 6);
      if (note === 'gone') this.finish(false);
    };
    weapon.onShot = (shot) => this.shot(shot);
  }

  update(dt) {
    const c = this.couple;
    if (c.state === 'inside' && this.hud.time >= LEAVE_AT) {
      c.leave();
      this.hud.notify('Biografen Grand', 'A couple leaves the late show and turns south on Sveavägen, without bodyguards.', 7);
      this.hud.setObjective('Follow the couple down Sveavägen.');
    }
    // a drawn gun in plain sight up close gives the game away
    if (!this.over && c.visible && !c.alarmed && this.weapon.drawn) {
      const p = this.player.pos;
      const dx = p.x - c.at.x, dz = p.z - c.at.y;
      const d = Math.hypot(dx, dz);
      const facing = (dx * Math.sin(c.heading) + dz * Math.cos(c.heading)) / Math.max(d, 0.01);
      if (d < 9 && facing > 0.35) this.spooked('They have seen the gun. They hurry on towards the T-bana.');
    }
    if (this.over && this.result && this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.onEnd?.(this.result);
    }
  }

  spooked(text) {
    if (this.couple.alarmed) return;
    this.couple.alarm();
    this.hud.notify('Spotted', text, 5);
  }

  shot({ origin, person, distance }) {
    this.people.alarm(origin.x, origin.z);
    if (this.over) return;
    const c = this.couple;
    if (!person) {
      if (c.visible && Math.hypot(origin.x - c.at.x, origin.z - c.at.y) < 120) this.spooked('The shot echoes down Sveavägen. They start to run.');
      return;
    }
    if (person.hit) return;
    this.hud.hitMarker();
    c.shoot(person);
    if (person === c.woman) {
      this.collateral = true;
      this.hud.notify('Wounded', 'The bullet grazes her back.', 4);
      return;
    }
    this.distance = distance;
    this.finish(true);
  }

  finish(success) {
    this.over = true;
    const c = this.couple;
    const lines = [];
    if (success) {
      const atCorner = Math.hypot(c.man.group.position.x - L.murderCorner.x, c.man.group.position.z - L.murderCorner.z) < 9;
      const shots = this.weapon.shotsFired;
      lines.push(['Target down', 1000]);
      if (atCorner) lines.push(['At the corner of Tunnelgatan', 500]);
      if (this.distance < 3) lines.push(['Point blank', 200]);
      else if (this.distance > 25) lines.push([`Long shot (${Math.round(this.distance)} m)`, Math.min(500, Math.round((this.distance - 25) * 20))]);
      if (shots <= 2) lines.push([shots === 1 ? 'One shot' : 'Two shots', 300]);
      if (!c.alarmed) lines.push(['They never saw it coming', 250]);
      if (this.collateral) lines.push(['She was hit too', -250]);
      this.hud.setObjective('Get away from Sveavägen.');
      this.hud.notify('23:' + String(new Date(this.hud.time).getMinutes()).padStart(2, '0'), 'He falls on the pavement. She kneels beside him. Somewhere a car door opens.', 6);
    } else {
      this.hud.setObjective('');
      this.hud.notify('Hötorget', 'They have gone down into the T-bana. The moment has passed.', 6);
    }
    const score = lines.reduce((s, [, p]) => s + p, 0);
    this.hud.addScore(score);
    this.result = { success, lines, score, total: this.hud.score, time: this.hud.time };
    this.endTimer = success ? 4.5 : 3;
  }
}
