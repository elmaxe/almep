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
