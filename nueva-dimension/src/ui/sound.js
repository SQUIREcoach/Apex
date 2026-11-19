// Ambient sound, synthesised (no audio files): the lap of water above the
// surface, a muffled pressure and sparse bubbles below it. Off by default.

export function initSound(cfg) {
  const btn = document.querySelector('.sound');
  const AC = window.AudioContext || window.webkitAudioContext;
  const T = cfg.t?.ui || {};
  if (!btn || !AC) return { setUnder() {}, unlock() {}, splash() {} };
  btn.hidden = false;

  let ctx = null;
  let master;
  let filter;
  let lfoGain;
  let on = false;
  let under = false;
  let bubbleTimer = null;

  const build = () => {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // brown noise
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    const swell = ctx.createGain();
    swell.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(swell.gain);
    src.connect(filter).connect(swell).connect(master);
    src.start();
    lfo.start();
  };

  // the plunge: a burst of white water, then the muffled thump of the body
  const splash = () => {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(260, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.setValueAtTime(90, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.5, t + 0.07);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.7);
    for (let k = 0; k < 14; k++) setTimeout(bubble, 200 + Math.random() * 1600);
  };

  const bubble = () => {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = 380 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.1);
  };

  const apply = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    filter.frequency.setTargetAtTime(under ? 260 : 950, t, 0.4);
    lfoGain.gain.setTargetAtTime(under ? 0.08 : 0.3, t, 0.4);
    master.gain.setTargetAtTime(on ? (under ? 0.5 : 0.32) : 0, t, 0.6);
    clearInterval(bubbleTimer);
    if (on && under) bubbleTimer = setInterval(() => Math.random() < 0.5 && bubble(), 700);
  };

  btn.addEventListener('click', async () => {
    if (!ctx) build();
    if (ctx.state === 'suspended') await ctx.resume();
    on = !on;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? T.soundOff : T.soundOn);
    apply();
  });

  return {
    setUnder(v) {
      under = v;
      apply();
    },
    unlock() {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    splash,
  };
}
