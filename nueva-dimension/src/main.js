import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/jost/index.css';
import './styles/main.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { detectQuality } from './quality.js';
import { Story, plungeFrame, surfaceFrame, IMPACT } from './story.js';
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
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// The plunge state machine: surface → plunging → under → surfacing → surface
const plunge = { state: 'surface', p: 0, splashed: false };
const immersionTop = () => story.sections.find((q) => q.name === 'immersion')?.top ?? innerHeight;
const jump = (y) => {
  if (lenis) {
    lenis.start();
    lenis.scrollTo(y, { immediate: true, force: true });
  } else window.scrollTo(0, y);
};
const glide = (el) => {
  if (lenis) lenis.scrollTo(el, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: quality.reduced ? 'auto' : 'smooth' });
};
const scrollTo = (target) => {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  if (plunge.state === 'plunging' || plunge.state === 'surfacing') return;
  if (stage && plunge.state === 'surface' && el.id !== 'superficie') return startPlunge(el.id === 'inmersion' ? null : el);
  if (stage && plunge.state === 'under' && el.id === 'superficie') return startSurface();
  glide(el);
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
const optionEls = [...document.querySelectorAll('.option')];

function startPlunge(target = null) {
  if (!stage || plunge.state !== 'surface') return;
  plunge.state = 'plunging';
  plunge.splashed = false;
  plunge.p = 0;
  lenis?.stop();
  root.classList.add('is-plunging');
  const dur = quality.reduced ? 0.8 : 3.6;
  motion.plungeOut(dur);
  ui.sound.setUnder(false);
  const o = { p: 0 };
  gsap.to(o, {
    p: 1,
    duration: dur,
    ease: 'none',
    onUpdate() {
      plunge.p = o.p;
      if (!plunge.splashed && o.p >= IMPACT) {
        plunge.splashed = true;
        if (!quality.reduced) stage?.scenes.pool.plungeSplash();
        ui.sound.splash();
        ui.sound.setUnder(true);
      }
    },
    onComplete() {
      jump(immersionTop());
      plunge.state = 'under';
      root.classList.remove('is-plunging');
      motion.plungeLanded();
      if (target) setTimeout(() => glide(target), 250);
    },
  });
}

function startSurface() {
  if (!stage || plunge.state !== 'under') return;
  plunge.state = 'surfacing';
  plunge.p = 0;
  lenis?.stop();
  root.classList.add('is-plunging');
  const o = { p: 0 };
  gsap.to(o, {
    p: 1,
    duration: quality.reduced ? 0.8 : 2.4,
    ease: 'power1.inOut',
    onUpdate() {
      plunge.p = o.p;
      if (o.p > 0.6) ui.sound.setUnder(false);
    },
    onComplete() {
      jump(0);
      plunge.state = 'surface';
      root.classList.remove('is-plunging');
      motion.heroIn();
    },
  });
}
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
  // a downward scroll from the surface is a jump into the water
  if (stage && root.classList.contains('gl-ready')) {
    const top = immersionTop();
    if (plunge.state === 'surface' && y > 24 && y < top - 2) startPlunge();
    else if (plunge.state === 'under' && y < top - 6) startSurface();
  }
  const st = story.at(y);
  if (!st) return;
  if (plunge.state === 'plunging') {
    st.frame = plungeFrame(plunge.p, quality.reduced);
    st.nav = plunge.p > IMPACT ? 'inmersion' : 'superficie';
    st.hidden = false;
  } else if (plunge.state === 'surfacing') {
    st.frame = surfaceFrame(plunge.p, quality.reduced);
    st.nav = plunge.p > 0.6 ? 'superficie' : 'inmersion';
    st.hidden = false;
  }
  if (st.nav !== lastNav) {
    lastNav = st.nav;
    ui.gauge.setActive(st.nav);
    root.dataset.chapter = st.name;
    if (plunge.state === 'surface' || plunge.state === 'under') ui.sound.setUnder(st.frame?.up?.pose ? st.frame.up.pose.pos[1] < 0 : false);
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
    if (!quality.reduced) placeOptions(stage.windowRects, plunge.state === 'under');
  } else {
    const p = st.frame?.up?.pose;
    ui.gauge.setElevation(p ? p.pos[1] : null);
  }
});

// The labels of the windows follow them through the water.
function placeOptions(rects, live) {
  for (let i = 0; i < optionEls.length; i++) {
    const a = optionEls[i];
    const r = live && rects ? rects[i] : null;
    if (!r || r.a < 0.02) {
      if (a.style.visibility !== 'hidden') a.style.visibility = 'hidden';
      continue;
    }
    a.style.visibility = 'visible';
    a.style.opacity = r.a.toFixed(3);
    a.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
    a.style.width = `${r.w.toFixed(1)}px`;
    a.style.height = `${r.h.toFixed(1)}px`;
  }
}

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
    // the renders become windows of light in the water
    if (!quality.reduced) stage.scenes.pool.setWindowImages(optionEls.map((a) => a.querySelector('img').currentSrc || a.querySelector('img').src));
    optionEls.forEach((a, i) => {
      a.addEventListener('pointerenter', () => stage?.scenes.pool.hoverWindow(i, true));
      a.addEventListener('pointerleave', () => stage?.scenes.pool.hoverWindow(i, false));
      a.addEventListener('focus', () => stage?.scenes.pool.hoverWindow(i, true));
      a.addEventListener('blur', () => stage?.scenes.pool.hoverWindow(i, false));
    });
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
    // arriving mid-page (a link to a chapter): already in the water
    if (window.scrollY >= immersionTop() - 2) plunge.state = 'under';
    else if (window.scrollY > 0) jump(0);
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
window.__apexDebug = { story, lenis, plunge, get stage() { return stage; }, quality, scrollTo, startPlunge, startSurface };
