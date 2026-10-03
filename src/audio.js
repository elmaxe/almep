/** Procedural ambience: wind, distant city hum, passing cars, footsteps in snow. */
export class Ambience {
  start() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish noise
      d[i] = last * 3.5;
    }
    this.noise = buf;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    const loop = (filterType, freq, q, gain) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return { f, g };
    };
    this.wind = loop('bandpass', 500, 0.7, 0.18);
    this.hum = loop('lowpass', 140, 0.5, 0.25);
    this.car = loop('lowpass', 300, 0.8, 0);
    this.t = 0;
  }

  setPaused(p) {
    if (!this.ctx) return;
    if (p) this.ctx.suspend(); else this.ctx.resume();
  }

  step(run) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1400 + Math.random() * 900;
    hp.Q.value = 0.8;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    const vol = run ? 0.5 : 0.32;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(hp).connect(g).connect(this.master);
    src.start(now, Math.random() * 2, 0.2);
  }

  /** Short filtered noise burst through `gain`, starting at `when`. */
  burst(when, { type = 'bandpass', freq = 2000, q = 1, vol = 0.5, attack = 0.002, decay = 0.1, out = this.master }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.001, when + attack + decay);
    src.connect(f).connect(g).connect(out);
    src.start(when, Math.random() * 2, attack + decay + 0.05);
  }

  /** A revolver shot: crack, boom, and the echo off the facades. */
  shot() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!this.echo) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.19;
      const fb = ctx.createGain();
      fb.gain.value = 0.42;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      delay.connect(lp).connect(fb).connect(delay);
      lp.connect(this.master);
      this.echo = delay;
    }
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.master);
    bus.connect(this.echo);
    this.burst(now, { type: 'highpass', freq: 1800, q: 0.5, vol: 1.6, attack: 0.001, decay: 0.07, out: bus });
    this.burst(now, { type: 'lowpass', freq: 420, q: 0.9, vol: 3.2, attack: 0.002, decay: 0.32, out: bus });
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.25);
    og.gain.setValueAtTime(0.9, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(og).connect(bus);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Hammer falling on an empty chamber. */
  dryFire() {
    if (!this.ctx) return;
    this.burst(this.ctx.currentTime, { freq: 3200, q: 4, vol: 0.5, decay: 0.03 });
  }

  /** Cylinder swung out, empties dropped, six rounds in, cylinder closed. */
  reload() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const ticks = [0.05, 0.4, 0.75, 0.95, 1.15, 1.35, 1.55, 1.75, 2.1];
    ticks.forEach((t, i) => this.burst(now + t, { freq: i === 0 || i === ticks.length - 1 ? 1800 : 4200, q: 3, vol: i === 0 || i === ticks.length - 1 ? 0.45 : 0.18, decay: 0.035 }));
  }

  update(dt, carDistance) {
    if (!this.ctx) return;
    this.t += dt;
    const now = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(0.12 + 0.1 * (0.5 + 0.5 * Math.sin(this.t * 0.37) * Math.sin(this.t * 0.11)), now, 0.5);
    this.wind.f.frequency.setTargetAtTime(380 + 260 * (0.5 + 0.5 * Math.sin(this.t * 0.23)), now, 0.5);
    const cv = Math.max(0, 1 - carDistance / 45) ** 2;
    this.car.g.gain.setTargetAtTime(cv * 0.9, now, 0.1);
    this.car.f.frequency.setTargetAtTime(180 + cv * 500, now, 0.1);
  }
}
