// The story: maps the scroll position to what the WebGL stage shows.
// Each section of the document is a place in the water; the transitions
// between them are crossings of the surface (a moving waterline).

const POSE = {
  hero0: { pos: [0, 1.55, 5.6], tgt: [0, -0.35, -10] },
  hero1: { pos: [0, 1.05, 3.4], tgt: [0, -0.6, -10] },
  surf: { pos: [0, 0.14, 1.7], tgt: [0, -0.02, -10] },
  sub: { pos: [0, -0.32, 1.3], tgt: [0, -0.25, -10] },
  under0: { pos: [0, -1.2, 0.4], tgt: [0, -0.65, -10] },
  under1: { pos: [0.5, -2.0, -4.2], tgt: [-0.3, 2.4, -9.6], fov: 8 },
  deep0: { pos: [-0.4, -2.3, -6.4], tgt: [0.4, 1.0, -9.6], fov: 10 },
  deep1: { pos: [0.6, -1.4, -11], tgt: [-0.2, 0.9, -16], fov: 4 },
  top0: { pos: [0, 4.2, -2.4], tgt: [0, -2.8, -9.3], calm: 0.55 },
  top1: { pos: [0, 8.8, -8.95], tgt: [0, -2.8, -9.5], calm: 0.85, fov: -4 },
};

const WATER_LEVEL = { pool: 0, resort: -0.12, villa: -0.05, sky: 72.35 };
export const NAV_OF = {
  hero: 'superficie',
  dive: 'superficie',
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
    const F = { up: null, down: null, line: -1, downWater: false, amp: 1, wet: 0 };

    switch (name) {
      case 'hero':
        F.up = { scene: 'pool', pose: pose(POSE.hero0, POSE.hero1, ease(cam(p))) };
        break;
      case 'dive': {
        if (p < 0.42) {
          F.up = { scene: 'pool', pose: pose(POSE.hero1, POSE.surf, ease(seg(p, 0, 0.42))) };
        } else if (p < 0.64) {
          const t = seg(p, 0.42, 0.64);
          const pp = pose(POSE.surf, POSE.sub, t);
          F.up = { scene: 'pool', pose: pp, side: 'above' };
          F.down = { scene: 'pool', pose: pp, side: 'under' };
          F.line = line(t, -0.12, 1.16);
          F.amp = 1.4;
        } else {
          F.up = { scene: 'pool', pose: pose(POSE.sub, POSE.under0, ease(seg(p, 0.64, 1))) };
        }
        break;
      }
      case 'immersion':
        F.up = { scene: 'pool', pose: pose(POSE.under0, POSE.under1, ease(cam(p))) };
        break;
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
    const order = ['hero', 'dive', 'immersion', 'resort', 'villa', 'sky'];
    const i = order.indexOf(name);
    if (i < 0) return [];
    return order.slice(i, i + 3).filter((n) => ['resort', 'villa', 'sky'].includes(n));
  }
}

export function elevationOf(view, camY) {
  const w = WATER_LEVEL[view.scene] ?? 0;
  return camY - w;
}
