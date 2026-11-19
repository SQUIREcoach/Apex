import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/jost/index.css';
import './styles/main.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { detectQuality } from './quality.js';
import { Story } from './story.js';
import { initContact } from './ui/contact.js';
import { initConsent, track } from './ui/consent.js';
import { initAnatomy } from './ui/anatomy.js';
import { initMotion } from './ui/motion.js';
import { initGauge } from './ui/gauge.js';
import { initSound } from './ui/sound.js';

gsap.registerPlugin(ScrollTrigger);

const cfg = window.__APEX__ || { t: { ui: {} } };
const root = document.documentElement;
const quality = detectQuality();
root.dataset.tier = String(quality.tier);
root.classList.toggle('reduced', quality.reduced);
root.classList.toggle('webgl', quality.webgl);
root.classList.toggle('touch', window.matchMedia('(pointer: coarse)').matches);

const yearEl = document.querySelector('[data-year]');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// ---------------------------------------------------------------------------
// Smooth scroll (off when the visitor prefers reduced motion)
let lenis = null;
if (quality.motion) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  root.classList.add('lenis');
}
const scrollTo = (target) => {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: quality.reduced ? 'auto' : 'smooth' });
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  const id = a.getAttribute('href').slice(1);
  if (!document.getElementById(id)) return;
  e.preventDefault();
  scrollTo(id);
  history.replaceState(null, '', `#${id}`);
});

// ---------------------------------------------------------------------------
const story = new Story(quality.reduced);
const ui = {
  contact: initContact(cfg, track, { lenis }),
  gauge: initGauge(cfg, scrollTo),
  sound: initSound(cfg),
};
initConsent(cfg);
initAnatomy();
const motion = initMotion(quality);

let stage = null;
const canvas = document.querySelector('.stage');
const loader = document.querySelector('.loader');

function measure() {
  story.measure();
  ScrollTrigger.refresh();
}
window.addEventListener('resize', () => requestAnimationFrame(measure), { passive: true });
document.fonts?.ready.then(measure);
measure();

// ---------------------------------------------------------------------------
// Frame loop: one ticker drives scroll, story and WebGL.
let lastNav = null;
let hiddenState = null;
const ivoryEl = document.querySelector('.anatomy');
let ivoryHdr = null;
let ivoryGauge = null;
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time) => {
  if (lenis) lenis.raf(time * 1000);
  const y = lenis ? lenis.scroll : window.scrollY;
  const st = story.at(y);
  if (!st) return;
  if (st.nav !== lastNav) {
    lastNav = st.nav;
    ui.gauge.setActive(st.nav);
    root.dataset.chapter = st.name;
    ui.sound.setUnder(st.frame?.up?.pose ? st.frame.up.pose.pos[1] < 0 : false);
  }
  if (ivoryEl) {
    const r = ivoryEl.getBoundingClientRect();
    const h = r.top < 44 && r.bottom > 44;
    const g = r.top < innerHeight / 2 && r.bottom > innerHeight / 2;
    if (h !== ivoryHdr) root.classList.toggle('on-ivory', (ivoryHdr = h));
    if (g !== ivoryGauge) root.classList.toggle('gauge-ivory', (ivoryGauge = g));
  }
  if (hiddenState !== st.hidden) {
    hiddenState = st.hidden;
    root.classList.toggle('stage-hidden', st.hidden);
  }
  if (stage) {
    stage.frame = st.frame;
    stage.setVisible(!st.hidden && !document.hidden);
    for (const n of story.upcoming(st.name)) stage.ensure(n);
    stage.tick();
    ui.gauge.setElevation(st.hidden ? null : stage.elevation);
  } else {
    const p = st.frame?.up?.pose;
    ui.gauge.setElevation(p ? p.pos[1] : null);
  }
});

// ---------------------------------------------------------------------------
// WebGL: progressive. The page is fully usable before (and without) it.
async function bootGL() {
  if (!quality.webgl) return reveal();
  try {
    const { Stage } = await import('./gl/stage.js');
    stage = new Stage(canvas, quality);
    stage.interactive = true;
    const pointer = (e) => stage && stage.pointer(e.clientX, e.clientY);
    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      pointer(e);
      motion.firstTouch();
    }, { passive: true });
    // ripple when hovering a contact action
    document.querySelectorAll('.action').forEach((a) =>
      a.addEventListener('pointerenter', () => stage?.scenes.pool.ripple(1.2)),
    );
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      stage = null;
      root.classList.remove('webgl');
    });
    // first frames, then reveal
    stage.frame = story.at(window.scrollY)?.frame;
    stage.tick();
    root.classList.add('gl-ready');
    // warm the next world in the background
    setTimeout(() => stage?.ensure('resort'), 1200);
  } catch (err) {
    console.warn('[APEX] WebGL unavailable, using still water.', err);
    stage = null;
    root.classList.remove('webgl');
  }
  reveal();
}

let revealed = false;
function reveal() {
  if (revealed) return;
  revealed = true;
  loader?.classList.add('is-out');
  motion.intro();
  setTimeout(() => loader?.remove(), 1600);
}
setTimeout(reveal, 6000); // never hold the visitor

Promise.all([document.fonts?.ready, new Promise((r) => setTimeout(r, quality.reduced ? 0 : 900))]).then(bootGL);

window.addEventListener('pointerdown', () => ui.sound.unlock(), { once: true });
document.addEventListener('visibilitychange', () => {
  if (stage) stage.setVisible(!document.hidden);
});

// expose for debugging and automated checks
window.__apexDebug = { story, lenis, get stage() { return stage; }, quality, scrollTo };
