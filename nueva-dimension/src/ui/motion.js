import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Typography in motion. One orchestrated entrance (the title surfacing),
// then everything else is tied to the visitor's own scrolling.

export function initMotion(quality) {
  const root = document.documentElement;
  const R = quality.reduced;
  const q = (s, c = document) => c.querySelector(s);
  const qa = (s, c = document) => [...c.querySelectorAll(s)];

  // split a paragraph into words (kept readable for assistive tech)
  const splitWords = (el) => {
    const text = el.textContent;
    const words = text
      .split(/(\s+)/)
      .map((w) => (w.trim() ? `<span class="w">${w}</span>` : w))
      .join('');
    el.innerHTML = `<span class="sr-only"></span><span aria-hidden="true">${words}</span>`;
    el.firstChild.textContent = text;
    return qa('.w', el);
  };

  if (R) {
    root.classList.add('motion-off');
    return { intro() {}, firstTouch() {} };
  }

  gsap.set('.hero__line > span', { yPercent: 115 });
  gsap.set(['.hero__lead', '.hero__cue', '.hero__hint', '.hdr', '.gauge'], { autoAlpha: 0 });

  // ---- dive: the line appears as the surface is crossed --------------------
  const diveLine = q('.dive__line');
  const dive = q('.dive');
  if (diveLine && dive) {
    // positions expressed in the story's own progress (sticky range)
    const at = (p) => () => `top+=${Math.round(p * Math.max(dive.offsetHeight - innerHeight, innerHeight))}`;
    gsap.fromTo(
      diveLine,
      { opacity: 0, letterSpacing: '0.16em', filter: 'blur(8px)' },
      {
        opacity: 1,
        letterSpacing: '0.01em',
        filter: 'blur(0px)',
        ease: 'none',
        scrollTrigger: { trigger: dive, start: at(0.46), end: at(0.7), scrub: true },
      },
    );
    gsap.to(diveLine, {
      opacity: 0,
      y: -40,
      ease: 'none',
      immediateRender: false,
      scrollTrigger: { trigger: dive, start: at(0.86), end: at(1.0), scrub: true },
    });
  }

  // ---- immersion: reading at the speed of descent --------------------------
  const imm = q('.immersion');
  if (imm) {
    const words = splitWords(q('[data-words]', imm));
    const tl = gsap.timeline({
      scrollTrigger: { trigger: imm, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });
    tl.fromTo('.immersion__title', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.12 }, 0)
      .fromTo(words, { opacity: 0.12 }, { opacity: 1, stagger: 0.5 / words.length, duration: 0.05 }, 0.1)
      .fromTo('.immersion__second', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.12 }, 0.66)
      .to(imm.querySelector('.immersion__sticky'), { opacity: 0, y: -30, duration: 0.1 }, 0.9)
      .set({}, {}, 1);
  }

  // ---- markets: text arrives after surfacing, leaves before diving ----------
  qa('.market').forEach((m) => {
    const text = q('.market__text', m);
    const note = q('.concept-note', m);
    const tl = gsap.timeline({
      scrollTrigger: { trigger: m, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
    });
    tl.fromTo(
      q('.market__name', m),
      { opacity: 0, clipPath: 'inset(100% 0 0 0)', y: 30 },
      { opacity: 1, clipPath: 'inset(0% 0 0 0)', y: 0, duration: 0.1 },
      0.12,
    )
      .fromTo(
        qa('.market__intro, .market__line, .market__body', m),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, stagger: 0.03, duration: 0.08 },
        0.17,
      )
      .fromTo(qa('.market__scope li, .market__also', m), { opacity: 0 }, { opacity: 1, stagger: 0.012, duration: 0.05 }, 0.25)
      .fromTo(note, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.2)
      .to([text, note], { opacity: 0, y: -24, duration: 0.05 }, m.id === 'extraordinarios' ? 0.95 : 0.8)
      .set({}, {}, 1);
  });

  // ---- anatomy: the drawing is traced as it arrives -------------------------
  const svg = q('.anatomy__svg');
  if (svg) {
    const paths = qa('.ink, .pipe', svg).filter((p) => p.getTotalLength);
    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    ScrollTrigger.create({
      trigger: svg,
      start: 'top 75%',
      once: true,
      onEnter: () => {
        gsap.to(paths, {
          strokeDashoffset: 0,
          duration: 2.4,
          ease: 'power2.inOut',
          stagger: 0.02,
          onComplete: () => paths.forEach((p) => (p.style.strokeDasharray = '')),
        });
        gsap.fromTo(qa('.callout', svg), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, stagger: 0.06, delay: 1.2, duration: 0.5 });
      },
    });
  }

  // ---- trajectory: figures rise out of the water line ----------------------
  qa('.chapter').forEach((c) => {
    gsap.fromTo(
      q('.chapter__num', c),
      { clipPath: 'inset(100% 0 0 0)', yPercent: 30 },
      {
        clipPath: 'inset(0% 0 0 0)',
        yPercent: 0,
        ease: 'none',
        scrollTrigger: { trigger: c, start: 'top 85%', end: 'top 45%', scrub: 0.4 },
      },
    );
  });
  const portrait = q('.portrait__frame');
  if (portrait) {
    gsap.fromTo(
      portrait,
      { clipPath: 'inset(100% 0 0 0)' },
      { clipPath: 'inset(0% 0 0 0)', ease: 'none', scrollTrigger: { trigger: portrait, start: 'top 90%', end: 'top 35%', scrub: 0.4 } },
    );
  }

  // ---- conversation ---------------------------------------------------------
  const con = q('.contact');
  if (con) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: con, start: 'top top', end: 'bottom bottom', scrub: 0.5 } });
    tl.fromTo('.contact__title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.12 }, 0.26)
      .fromTo('.contact__lead', { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.34)
      .fromTo('.action', { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.04, duration: 0.1 }, 0.38)
      .fromTo('.contact__base', { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.5)
      .set({}, {}, 1);
  }

  // ---- hero leaves as the descent begins -----------------------------------
  gsap.to('.hero__inner, .hero__cue, .hero__hint', {
    opacity: 0,
    y: -60,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '70% top', scrub: true },
  });

  let touched = false;
  return {
    intro() {
      const tl = gsap.timeline({ delay: 0.15 });
      tl.to('.hero__line > span', { yPercent: 0, duration: 1.8, ease: 'expo.out', stagger: 0.16 })
        .fromTo('.hero__line', { filter: 'blur(10px)' }, { filter: 'blur(0px)', duration: 1.6, ease: 'power2.out', stagger: 0.16 }, 0)
        .to(['.hdr', '.gauge'], { autoAlpha: 1, duration: 1.2, ease: 'power2.out' }, 0.7)
        .to('.hero__lead', { autoAlpha: 1, duration: 1.2, ease: 'power2.out' }, 0.9)
        .to('.hero__cue', { autoAlpha: 1, duration: 1 }, 1.3)
        .to('.hero__hint', { autoAlpha: touched ? 0 : 1, duration: 1 }, 1.6);
    },
    firstTouch() {
      if (touched) return;
      touched = true;
      gsap.to('.hero__hint', { autoAlpha: 0, duration: 1.2, delay: 1.5 });
    },
  };
}
