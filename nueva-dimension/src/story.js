// The story: maps the scroll position to what the WebGL stage shows.
// Each section of the document is a place in the water; the transitions
// between them are crossings of the surface (a moving waterline).

const POSE = {
  hero0: { pos: [0, 1.55, 5.6], tgt: [0, -0.35, -10] },
  hero1: { pos: [0, 1.05, 3.4], tgt: [0, -0.6, -10] },
  surf: { pos: [0, 0.14, 1.7], tgt: [0, -0.02, -10] },
  sub: { pos: [0, -0.32, 1.3], tgt: [0, -0.25, -10] },
  under0: { pos: [0, -1.3, 0.4], tgt: [0, -0.95, -10] },
  swim: { pos: [0, -1.45, -2.6], tgt: [0, -1.05, -12] },
  under1: { pos: [0.5, -2.0, -4.2], tgt: [-0.3, 2.4, -9.6], fov: 8 },
  deep0: { pos: [-0.4, -2.3, -6.4], tgt: [0.4, 1.0, -9.6], fov: 10 },
  deep1: { pos: [0.6, -1.4, -11], tgt: [-0.2, 0.9, -16], fov: 4 },
  top0: { pos: [0, 4.2, -2.4], tgt: [0, -2.8, -9.3], calm: 0.55 },
  top1: { pos: [0, 8.8, -8.95], tgt: [0, -2.8, -9.5], calm: 0.85, fov: -4 },
};

const WATER_LEVEL = { pool: 0, resort: -0.12, villa: -0.05, sky: 72.35 };
export const NAV_OF = {
  hero: 'superficie',
  immersion: 'inmersion',
  resort: 'hoteles',
  villa: 'residencias',
  sky: 'extraordinarios',
  anatomy: 'anatomia',
  trajectory: 'trayectoria',
  contact: 'conversacion',
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const pose = (a, b, t) => ({
  pos: lerp3(a.pos, b.pos, t),
  tgt: lerp3(a.tgt, b.tgt, t),
  fov: lerp(a.fov || 0, b.fov || 0, t),
  calm: lerp(a.calm || 0, b.calm || 0, t),
  roll: lerp(a.roll || 0, b.roll || 0, t),
});
const seg = (p, a, b) => clamp01((p - a) / (b - a));

export class Story {
  constructor(reduced = false) {
    this.reduced = reduced;
    this.sections = [];
  }

  measure() {
    const y = window.scrollY;
    this.vh = window.innerHeight;
    this.sections = [...document.querySelectorAll('[data-scene]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { el, name: el.dataset.scene, top: r.top + y, height: r.height };
    });
  }

  /** progress of the viewport through a section */
  progress(s, y) {
    return (y - s.top) / Math.max(s.height - this.vh, this.vh);
  }

  at(y) {
    const S = this.sections;
    if (!S.length) return null;
    let i = 0;
    for (let k = 0; k < S.length; k++) if (S[k].top <= y + 1) i = k;
    const s = S[i];
    let p = clamp01(this.progress(s, y));
    const out = { name: s.name, nav: NAV_OF[s.name], hidden: false, frame: null };

    if (s.name === 'anatomy') {
      out.hidden = s.top <= y && s.top + s.height >= y + this.vh;
      const tr = S.find((q) => q.name === 'trajectory');
      out.frame = this.frame('trajectory', 0);
      if (tr && !out.hidden && y + this.vh > tr.top) out.nav = 'anatomia';
      return out;
    }
    out.frame = this.frame(s.name, p);
    return out;
  }

  frame(name, p) {
    const R = this.reduced;
    const cam = (t) => (R ? 0.5 : t);
    const line = (t, from, to) => (R ? (t < 0.5 ? from : to) : lerp(from, to, t));
    const F = { up: null, down: null, line: -1, downWater: false, amp: 1, wet: 0, windows: null, fx: null };

    switch (name) {
      case 'hero':
        F.up = { scene: 'pool', pose: pose(POSE.hero0, POSE.hero1, ease(cam(p))) };
        break;
      case 'immersion': {
        // swimming forward through the options, then deeper for the manifesto
        const pp =
          p < 0.3
            ? pose(POSE.under0, POSE.swim, ease(seg(cam(p), 0.04, 0.3)))
            : pose(POSE.swim, POSE.under1, ease(seg(cam(p), 0.3, 1)));
        F.up = { scene: 'pool', pose: pp };
        F.windows = R ? null : { emerge: 1, pass: seg(p, 0.05, 0.3) };
        break;
      }
      case 'resort': {
        const camP = cam(p);
        if (p < 0.14) {
          const t = seg(p, 0, 0.14);
          F.up = { scene: 'resort', p: camP };
          F.down = { scene: 'pool', pose: POSE.under1 };
          F.line = line(t, 1.16, -0.12);
        } else if (p > 0.86) {
          F.up = { scene: 'resort', p: camP };
          F.down = { scene: 'resort' };
          F.downWater = true;
          F.line = line(seg(p, 0.86, 1), -0.12, 1.2);
        } else {
          F.up = { scene: 'resort', p: camP };
        }
        F.wet = R ? 0 : 1 - seg(p, 0.12, 0.32);
        break;
      }
      case 'villa':
      case 'sky': {
        const camP = cam(p);
        const sc = name;
        F.up = { scene: sc, p: camP };
        if (p < 0.14) {
          F.down = { scene: sc };
          F.downWater = true;
          F.line = line(seg(p, 0, 0.14), 1.2, -0.12);
        } else if (sc === 'villa' && p > 0.86) {
          F.down = { scene: sc };
          F.downWater = true;
          F.line = line(seg(p, 0.86, 1), -0.12, 1.2);
        }
        F.wet = R ? 0 : 1 - seg(p, 0.12, 0.32);
        break;
      }
      case 'trajectory':
        F.up = { scene: 'pool', pose: pose(POSE.deep0, POSE.deep1, cam(p)) };
        break;
      case 'contact': {
        if (p < 0.3) {
          const t = seg(p, 0, 0.3);
          F.up = { scene: 'pool', pose: POSE.top0, side: 'above' };
          F.down = { scene: 'pool', pose: POSE.deep1, side: 'under' };
          F.line = line(t, 1.16, -0.12);
          F.amp = 1.2;
          F.wet = 0;
        } else {
          const pp = pose(POSE.top0, POSE.top1, ease(cam(seg(p, 0.3, 0.8))));
          // on wide screens the mark sits to the right of the words
          const wide = innerWidth / innerHeight > 1.15 ? -2.7 * ease(cam(seg(p, 0.3, 0.8))) : 0;
          pp.pos[0] += wide;
          pp.tgt[0] += wide;
          F.up = { scene: 'pool', pose: pp };
          F.wet = R ? 0 : 1 - seg(p, 0.3, 0.5);
        }
        break;
      }
      default:
        F.up = { scene: 'pool', pose: POSE.hero0 };
    }
    return F;
  }

  /** Scenes needed soon, to preload ahead of the crossing. */
  upcoming(name) {
    const order = ['hero', 'immersion', 'resort', 'villa', 'sky'];
    const i = order.indexOf(name);
    if (i < 0) return [];
    return order.slice(i, i + 3).filter((n) => ['resort', 'villa', 'sky'].includes(n));
  }
}

export function elevationOf(view, camY) {
  const w = WATER_LEVEL[view.scene] ?? 0;
  return camY - w;
}

// ---------------------------------------------------------------------------
// The plunge: a timed, cinematic jump into the pool (p: 0 → 1).
// Anticipation at the edge, free fall, impact, momentum under water, and the
// options rising out of the blue as the body settles.
const PLUNGE = [
  [0.0, POSE.hero0],
  [0.14, { pos: [0, 1.95, 4.9], tgt: [0, -1.4, -3.6], fov: 2 }],
  [0.4, { pos: [0.12, 0.02, 1.5], tgt: [0.08, -3.4, -0.9], fov: 15, roll: -0.07 }],
  [0.53, { pos: [0.18, -0.95, 1.05], tgt: [0.1, -3.2, -1.4], fov: 9, roll: -0.04 }],
  [0.74, { pos: [0.06, -1.45, 0.55], tgt: [0, -1.3, -6], fov: 2 }],
  [1.0, POSE.under0],
];
const SEG_EASE = [
  (t) => t * t * (3 - 2 * t), // lean over the edge
  (t) => Math.pow(t, 2.1), // free fall, accelerating
  (t) => 1 - Math.pow(1 - t, 2.4), // momentum through the water
  (t) => 1 - Math.pow(1 - t, 2), // levelling out
  (t) => t * t * (3 - 2 * t), // settle
];
export const IMPACT = 0.4;

export function plungeFrame(p, reduced = false) {
  const F = { up: null, down: null, line: -1, amp: 1, wet: 0, windows: null, fx: null };
  if (reduced) {
    // no fall: a short dissolve from the surface to the depth
    F.up = { scene: 'pool', pose: p < 0.5 ? POSE.hero0 : POSE.under0 };
    F.fade = 1 - Math.abs(p * 2 - 1);
    return F;
  }
  let i = 0;
  while (i < PLUNGE.length - 2 && p > PLUNGE[i + 1][0]) i++;
  const [p0, a] = PLUNGE[i];
  const [p1, b] = PLUNGE[i + 1];
  const pp = pose(a, b, SEG_EASE[i](clamp01((p - p0) / (p1 - p0))));
  const after = p - IMPACT;
  // the body takes the hit: a short, decaying shake
  if (after > 0 && after < 0.14) {
    const k = Math.pow(1 - after / 0.14, 2);
    pp.roll += Math.sin(after * 420) * 0.035 * k;
    pp.pos[0] += Math.sin(after * 310 + 1.3) * 0.04 * k;
    pp.pos[1] += Math.cos(after * 270) * 0.03 * k;
  }
  F.up = { scene: 'pool', pose: pp };
  const rise = clamp01((after + 0.004) / 0.012);
  F.fx = {
    speed: p < IMPACT ? seg(p, 0.2, IMPACT) : 0,
    flash: after >= 0 ? Math.pow(Math.max(0, 1 - after / 0.035), 2) : 0,
    splash: after >= -0.004 ? rise * Math.pow(1 - seg(p, IMPACT + 0.008, 0.53), 1.6) : 0,
    blur: after >= 0 ? 1 - seg(p, 0.42, 0.8) : 0,
  };
  F.windows = { emerge: seg(p, 0.66, 1), pass: 0 };
  return F;
}

// Surfacing again when the visitor scrolls back up to the top.
export function surfaceFrame(p, reduced = false) {
  const F = { up: null, down: null, line: -1, amp: 1.3, wet: 0, windows: null, fx: null };
  if (reduced) {
    F.up = { scene: 'pool', pose: p < 0.5 ? POSE.under0 : POSE.hero0 };
    F.fade = 1 - Math.abs(p * 2 - 1);
    return F;
  }
  if (p < 0.45) {
    F.up = { scene: 'pool', pose: pose(POSE.under0, POSE.sub, ease(seg(p, 0, 0.45))) };
    F.windows = { emerge: 1 - seg(p, 0, 0.3), pass: 0 };
  } else if (p < 0.78) {
    const t = seg(p, 0.45, 0.78);
    F.up = { scene: 'pool', pose: pose(POSE.surf, POSE.hero0, ease(t)), side: 'above' };
    F.down = { scene: 'pool', pose: POSE.sub, side: 'under' };
    F.line = lerp(1.16, -0.12, t);
  } else {
    F.up = { scene: 'pool', pose: POSE.hero0 };
    F.wet = 1 - seg(p, 0.78, 1);
  }
  return F;
}
