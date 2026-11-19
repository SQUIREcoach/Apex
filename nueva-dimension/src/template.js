// Server-side (build-time) renderer: one static, fully indexable HTML page
// per language. The WebGL layer is decorative; every word is in the HTML.
import { anatomySvg } from './anatomy-svg.js';

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const MARK_SVG = (cls = 'mark') => `
<svg class="${cls}" viewBox="0 0 400 300" aria-hidden="true" focusable="false">
  <defs><linearGradient id="${cls}-gold" x1="0" x2="1" y1="0" y2="0.25">
    <stop offset="0" stop-color="#8E6B3A"/><stop offset=".45" stop-color="#E6CB97"/><stop offset=".72" stop-color="#C9A96B"/><stop offset="1" stop-color="#9A7442"/>
  </linearGradient></defs>
  <path fill="currentColor" d="M60 240 L190 3 L201 3 L67 240 Z"/>
  <path fill="currentColor" d="M197 3 L209 3 L350 285 L337 285 Z"/>
  <path fill="currentColor" d="M150 277 H342 V286 H150 Z"/>
  <path fill="url(#${cls}-gold)" d="M98 194 C140 160 195 140 245 152 C290 163 335 178 392 160 C346 193 296 199 250 187 C205 175 150 171 98 194 Z"/>
  <path fill="url(#${cls}-gold)" d="M64 244 C110 209 170 187 222 197 C268 206 315 219 364 201 C321 234 271 239 225 229 C180 219 124 216 64 244 Z"/>
</svg>`;

const WORD_SVG = `
<svg class="word" viewBox="0 0 150 42" aria-hidden="true" focusable="false">
  <path d="M2 41 L18 1.5 L34 41 M47 41 V1.5 H62 C72 1.5 76.5 6.5 76.5 12 C76.5 17.5 72 22.5 62 22.5 H47 M91 1.5 H113 M91 21 H110 M91 40.5 H113 M91 1.5 V40.5 M123 1.5 L147 41 M147 1.5 L123 41"/>
</svg>`;

export function renderPage(t, cfg, lang) {
  const L = cfg.languages;
  const here = L.find((l) => l.code === lang);
  const depth = here.path ? '../' : './';
  const url = (l) => `${cfg.siteUrl}/${l.path}`;
  const rel = (l) => (here.path ? (l.path ? `../${l.path}` : '../') : l.path || './');
  const tel = `tel:${cfg.phone}`;
  const mail = `mailto:${cfg.email}`;
  const wa = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(t.dialog.whatsappText)}`;

  const clientCfg = {
    lang,
    phone: cfg.phone,
    email: cfg.email,
    hubspot: cfg.hubspot,
    ga4: cfg.ga4,
    t: {
      ui: t.ui,
      dialog: t.dialog,
      nav: t.nav,
    },
  };

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HomeAndConstructionBusiness',
        '@id': `${cfg.siteUrl}/#org`,
        name: cfg.brand,
        url: `${cfg.siteUrl}/`,
        logo: `${cfg.siteUrl}/img/apex-logo.png`,
        image: `${cfg.siteUrl}/img/og.jpg`,
        telephone: cfg.phone,
        email: cfg.email,
        description: t.meta.description,
        address: { '@type': 'PostalAddress', addressLocality: cfg.city, addressRegion: cfg.region, addressCountry: 'ES' },
        areaServed: cfg.region,
        knowsAbout: t.anatomy.layers.map((l) => l[1]),
        employee: { '@id': `${cfg.siteUrl}/#carlos` },
      },
      {
        '@type': 'Person',
        '@id': `${cfg.siteUrl}/#carlos`,
        name: 'Carlos Callealta',
        jobTitle: t.trajectory.role,
        worksFor: { '@id': `${cfg.siteUrl}/#org` },
        image: `${cfg.siteUrl}/img/carlos-callealta.jpg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${cfg.siteUrl}/#web`,
        url: `${cfg.siteUrl}/`,
        name: cfg.brand,
        inLanguage: L.map((l) => l.code),
      },
    ],
  };

  const nav = t.nav
    .map(
      ([id, label], i) =>
        `<li><a href="#${id}" data-target="${id}"><span class="gauge__tick" aria-hidden="true"></span><span class="gauge__name">${esc(label)}</span></a></li>`,
    )
    .join('');

  const langs = L.map(
    (l) =>
      `<a href="${rel(l)}" hreflang="${l.code}" lang="${l.code}" title="${esc(l.name)}"${l.code === lang ? ' aria-current="true"' : ''}>${l.label}</a>`,
  ).join('');

  const markets = t.markets.items
    .map(
      (m, i) => `
    <article class="market" id="${m.id}" data-scene="${['resort', 'villa', 'sky'][i]}" aria-labelledby="${m.id}-t">
      <div class="market__sticky">
        <div class="market__text">
          <h3 class="market__name" id="${m.id}-t">${esc(m.name)}</h3>
          <p class="market__line">${esc(m.line)}</p>
          <p class="market__body">${esc(m.body)}</p>
          <ul class="market__scope">${m.scope.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
          ${i === 2 ? `<p class="market__also">${esc(t.markets.also)}</p>` : ''}
        </div>
        <p class="concept-note"><span class="concept-note__dot" aria-hidden="true"></span>${esc(t.ui.concept)}</p>
      </div>
    </article>`,
    )
    .join('');

  const layers = t.anatomy.layers
    .map(
      ([id, name, desc], i) => `
      <li class="legend__item" data-layer="${id}">
        <button type="button" class="legend__btn" data-layer="${id}" aria-describedby="lg-${id}">
          <span class="legend__num" aria-hidden="true">${i + 1}</span>
          <span class="legend__name">${esc(name)}</span>
        </button>
        <p class="legend__desc" id="lg-${id}">${esc(desc)}</p>
      </li>`,
    )
    .join('');

  const chapters = t.trajectory.chapters
    .map(
      (c) => `
      <li class="chapter">
        <p class="chapter__fig" aria-hidden="true"><span class="chapter__num">${esc(c.fig)}</span>${c.unit ? `<span class="chapter__unit">${esc(c.unit)}</span>` : ''}</p>
        <h3 class="chapter__title">${esc(c.title)}</h3>
        <p class="chapter__body">${esc(c.body)}</p>
      </li>`,
    )
    .join('');

  const record = t.trajectory.record
    .map(
      ([y, name, place, role]) => `
      <li class="record__row">
        <span class="record__year">${esc(y)}</span>
        <span class="record__name">${esc(name)}</span>
        <span class="record__place">${esc(place)}</span>
        <span class="record__role">${esc(role)}</span>
      </li>`,
    )
    .join('');

  return `<!doctype html>
<html lang="${lang}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.meta.title)}</title>
<meta name="description" content="${esc(t.meta.description)}">
<meta name="robots" content="${cfg.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}">
<meta name="theme-color" content="#0A2239">
<meta name="color-scheme" content="dark light">
<link rel="canonical" href="${url(here)}">
${L.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${url(l)}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${url(L[0])}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.brand)}">
<meta property="og:title" content="${esc(t.meta.title)}">
<meta property="og:description" content="${esc(t.meta.description)}">
<meta property="og:url" content="${url(here)}">
<meta property="og:image" content="${cfg.siteUrl}/img/og.jpg">
<meta property="og:image:alt" content="${esc(t.meta.ogAlt)}">
<meta property="og:locale" content="${t.locale}">
${L.filter((l) => l.code !== lang).map((l) => `<meta property="og:locale:alternate" content="${l.code === 'en' ? 'en_GB' : l.code + '_ES'}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${depth}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${depth}img/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script>document.documentElement.classList.replace('no-js','js');window.__APEX__=${JSON.stringify(clientCfg).replace(/</g, '\\u003c')};</script>
<script type="module" src="${depth}src/main.js"></script>
</head>
<body>
<a class="skip" href="#contenido">${esc(t.ui.skip)}</a>

<div class="loader" aria-hidden="true">
  ${MARK_SVG('loader__mark')}
  <div class="loader__line"><span></span></div>
  <p class="loader__text">${esc(t.ui.loading)}</p>
</div>

<canvas class="stage" aria-hidden="true"></canvas>
<p class="plunge-tag" aria-hidden="true">${esc(t.dive)}</p>
<div class="still" aria-hidden="true">
  <svg class="still__svg" preserveAspectRatio="none" viewBox="0 0 100 100"><defs>
    <filter id="still-water"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" seed="3"><animate attributeName="baseFrequency" dur="24s" values="0.012 0.04;0.016 0.05;0.012 0.04" repeatCount="indefinite"/></feTurbulence><feColorMatrix values="0 0 0 0 0.79  0 0 0 0 0.66  0 0 0 0 0.42  0 0 0 9 -5.2"/></filter>
  </defs><rect width="100" height="100" filter="url(#still-water)" opacity="0.07"/></svg>
</div>

<header class="hdr">
  <a class="brand" href="${rel(here)}" aria-label="${esc(cfg.brand)} — ${esc(t.ui.home)}">${MARK_SVG('mark')}${WORD_SVG}</a>
  <div class="hdr__right">
    <nav class="lang" aria-label="${esc(t.ui.langLabel)}">${langs}</nav>
    <button type="button" class="sound" aria-pressed="false" aria-label="${esc(t.ui.soundOn)}" hidden>
      <span class="sound__bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="sound__label">${esc(t.ui.sound)}</span>
    </button>
    <button type="button" class="hdr__contact" data-open-contact>${esc(t.ui.contact)}</button>
  </div>
</header>

<nav class="gauge" aria-label="${esc(t.ui.chapters)}">
  <p class="gauge__read" title="${esc(t.ui.elevationHelp)}"><span class="gauge__label">${esc(t.ui.elevation)}</span><span class="gauge__val" aria-hidden="true">+1,55 m</span></p>
  <ol>${nav}</ol>
</nav>

<main id="contenido">
  <noscript><p class="noscript">${esc(t.noscript)}</p></noscript>

  <section id="superficie" class="hero" data-scene="hero" aria-labelledby="hero-title">
    <div class="hero__inner">
      <h1 class="hero__title" id="hero-title">${t.hero.title.map((l) => `<span class="hero__line"><span>${esc(l)}</span></span>`).join(' ')}</h1>
      <p class="hero__lead">${esc(t.hero.lead)}</p>
    </div>
    <p class="hero__hint" aria-hidden="true"><span class="hint-touch">${esc(t.ui.touch)}</span><span class="hint-pointer">${esc(t.ui.pointer)}</span></p>
    <a class="hero__cue" href="#inmersion" data-plunge><span>${esc(t.hero.cue)}</span><i aria-hidden="true"></i></a>
  </section>

  <section id="inmersion" class="immersion" data-scene="immersion" aria-labelledby="opt-title">
    <div class="immersion__sticky">
      <p class="immersion__tag">${esc(t.dive)}</p>
      <div class="options">
        <h2 class="options__title" id="opt-title">${esc(t.immersion.optionsTitle)}</h2>
        <ul class="options__list">
          ${t.markets.items
            .map(
              (m, i) => `<li><a class="option" href="#${m.id}" data-i="${i}">
            <img src="${depth}${m.render.src}" alt="${esc(m.render.alt)}" width="1280" height="720" loading="lazy" decoding="async">
            <span class="option__name">${esc(m.name)}</span>
          </a></li>`,
            )
            .join('')}
        </ul>
        <p class="options__note"><span class="concept-note__dot" aria-hidden="true"></span>${esc(t.immersion.optionsNote)}</p>
        <ul class="options__more">${t.immersion.more.map(([id, l]) => `<li><a href="#${id}">${esc(l)}</a></li>`).join('')}</ul>
      </div>
      <div class="manifesto">
        <h2 class="immersion__title" id="imm-title">${esc(t.immersion.title)}</h2>
        <p class="immersion__body" data-words>${esc(t.immersion.body)}</p>
        <p class="immersion__second">${esc(t.immersion.second)}</p>
      </div>
    </div>
  </section>

  <section class="markets" aria-label="${esc(t.markets.label)}">${markets}
  </section>

  <section id="anatomia" class="anatomy" data-scene="anatomy" aria-labelledby="anat-title">
    <div class="anatomy__head">
      <h2 class="anatomy__title" id="anat-title">${esc(t.anatomy.title)}</h2>
      <p class="anatomy__intro">${esc(t.anatomy.intro)}</p>
    </div>
    <figure class="anatomy__figure">
      ${anatomySvg(t.anatomy.layers, t.anatomy.title)}
      <figcaption class="anatomy__hint">${esc(t.anatomy.hint)}</figcaption>
    </figure>
    <ol class="legend">${layers}</ol>
  </section>

  <section id="trayectoria" class="trajectory" data-scene="trajectory" aria-labelledby="tra-title">
    <div class="trajectory__head">
      <h2 class="trajectory__title" id="tra-title">${esc(t.trajectory.title)}</h2>
      <p class="trajectory__lead">${esc(t.trajectory.lead)}</p>
    </div>
    <div class="trajectory__grid">
      <figure class="portrait">
        <div class="portrait__frame">
          <picture>
            <source srcset="${depth}img/carlos-callealta.webp" type="image/webp">
            <img src="${depth}img/carlos-callealta.jpg" alt="${esc(t.trajectory.portraitAlt)}" width="1000" height="1007" loading="lazy" decoding="async">
          </picture>
        </div>
        <figcaption><span class="portrait__name">Carlos Callealta</span><span class="portrait__role">${esc(t.trajectory.role)}</span></figcaption>
      </figure>
      <ol class="chapters">${chapters}</ol>
    </div>
    <div class="record">
      <h3 class="record__title">${esc(t.trajectory.recordTitle)}</h3>
      <p class="record__note">${esc(t.trajectory.recordNote)}</p>
      <ol class="record__list">${record}</ol>
    </div>
  </section>

  <section id="conversacion" class="contact" data-scene="contact" aria-labelledby="con-title">
    <div class="contact__sticky">
      <h2 class="contact__title" id="con-title">${esc(t.contact.title)}</h2>
      <p class="contact__lead">${esc(t.contact.lead)}</p>
      <ul class="actions">
        <li><a class="action" href="${tel}" data-action="call"><span class="action__verb">${esc(t.contact.call)}</span><span class="action__detail">${esc(cfg.phoneDisplay)}</span></a></li>
        <li><a class="action" href="${mail}" data-action="write" data-open-contact="write"><span class="action__verb">${esc(t.contact.write)}</span><span class="action__detail">${esc(cfg.email)}</span></a></li>
        <li><a class="action" href="${esc(cfg.hubspot.meetingsUrl)}" target="_blank" rel="noopener" data-action="visit" data-open-contact="visit"><span class="action__verb">${esc(t.contact.visit)}</span><span class="action__detail">${esc(t.contact.visitDetail)}</span></a></li>
      </ul>
      <p class="contact__base">${esc(t.contact.base)}</p>
    </div>
  </section>
</main>

<footer class="ftr">
  <div class="ftr__brand">
    <img src="${depth}img/apex-logo.webp" alt="${esc(cfg.brand)}" width="480" height="442" loading="lazy" decoding="async">
  </div>
  <div class="ftr__col">
    <a href="${tel}">${esc(cfg.phoneDisplay)}</a>
    <a href="${mail}">${esc(cfg.email)}</a>
    <a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>
  </div>
  <div class="ftr__col">
    <div class="lang lang--footer">${langs}</div>
    <button type="button" class="link" data-open-privacy>${esc(t.footer.privacy)}</button>
  </div>
  <p class="ftr__concepts">${esc(t.footer.concepts)}</p>
  <p class="ftr__legal">© <span data-year>2026</span> ${esc(cfg.brand)}. ${esc(t.footer.rights)}</p>
</footer>

<dialog class="sheet" id="contact-sheet" aria-labelledby="sheet-title">
  <div class="sheet__inner">
    <div class="sheet__head">
      <h2 class="sheet__title" id="sheet-title">${esc(t.dialog.title)}</h2>
      <button type="button" class="sheet__close" data-close aria-label="${esc(t.ui.close)}"><i aria-hidden="true"></i></button>
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" type="button" id="tab-call" aria-controls="pane-call" aria-selected="true">${esc(t.dialog.callTab)}</button>
      <button role="tab" type="button" id="tab-write" aria-controls="pane-write" aria-selected="false" tabindex="-1">${esc(t.dialog.writeTab)}</button>
      <button role="tab" type="button" id="tab-visit" aria-controls="pane-visit" aria-selected="false" tabindex="-1">${esc(t.dialog.visitTab)}</button>
    </div>
    <div class="pane" role="tabpanel" id="pane-call" aria-labelledby="tab-call">
      <a class="pane__big" href="${tel}" data-action="call">${esc(cfg.phoneDisplay)}</a>
      <p class="pane__note">${esc(t.dialog.callBody)}</p>
      <a class="pane__link" href="${wa}" target="_blank" rel="noopener" data-action="whatsapp">${esc(t.dialog.whatsapp)}</a>
    </div>
    <div class="pane" role="tabpanel" id="pane-write" aria-labelledby="tab-write" hidden>
      <p class="pane__note">${esc(t.dialog.formIntro)}</p>
      <form class="form" novalidate>
        <div class="field"><label for="f-name">${esc(t.dialog.name)}</label><input id="f-name" name="firstname" autocomplete="name" required></div>
        <div class="field"><label for="f-email">${esc(t.dialog.email)}</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="f-phone">${esc(t.dialog.phone)}</label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="field"><label for="f-msg">${esc(t.dialog.message)}</label><textarea id="f-msg" name="message" rows="4" required></textarea></div>
        <div class="check"><input id="f-ok" name="consent" type="checkbox" required><label for="f-ok">${esc(t.dialog.consent)}</label></div>
        <button class="form__send" type="submit">${esc(t.dialog.send)}</button>
        <p class="form__status" role="status" aria-live="polite"></p>
      </form>
      <a class="pane__link" href="${mail}" data-action="email">${esc(cfg.email)}</a>
    </div>
    <div class="pane" role="tabpanel" id="pane-visit" aria-labelledby="tab-visit" hidden>
      <p class="pane__note">${esc(t.dialog.visitIntro)}</p>
      <div class="meetings" data-src="${esc(cfg.hubspot.meetingsUrl)}?embed=true">
        <button type="button" class="form__send" data-load-meetings>${esc(t.dialog.visitLoad)}</button>
        <p class="pane__fine">${esc(t.dialog.visitNote)}</p>
      </div>
    </div>
  </div>
</dialog>

<dialog class="sheet sheet--privacy" id="privacy-sheet" aria-labelledby="privacy-title">
  <div class="sheet__inner">
    <div class="sheet__head">
      <h2 class="sheet__title" id="privacy-title">${esc(t.privacy.title)}</h2>
      <button type="button" class="sheet__close" data-close aria-label="${esc(t.ui.close)}"><i aria-hidden="true"></i></button>
    </div>
    ${t.privacy.body.map((p) => `<p class="pane__note">${esc(p)}</p>`).join('')}
    <button type="button" class="form__send" data-consent-reset>${esc(t.privacy.change)}</button>
  </div>
</dialog>

<div class="consent" role="region" aria-label="${esc(t.consent.more)}" hidden>
  <p>${esc(t.consent.text)}</p>
  <div class="consent__btns">
    <button type="button" data-consent="granted">${esc(t.consent.accept)}</button>
    <button type="button" data-consent="denied">${esc(t.consent.reject)}</button>
    <button type="button" class="link" data-open-privacy>${esc(t.consent.more)}</button>
  </div>
</div>
</body>
</html>
`;
}
