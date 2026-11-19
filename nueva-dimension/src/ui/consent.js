// Consent (GDPR/LSSI): nothing that sets cookies loads before the visitor
// accepts. A single, quiet strip; never a modal. GA4 + HubSpot tracking.

const KEY = 'apex-consent';
let gaReady = false;

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
};
const write = (v) => {
  try {
    v === null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v);
  } catch (e) {
    /* storage unavailable: ask again next visit */
  }
};

function loadScript(src, attrs = {}) {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  document.head.appendChild(s);
}

function enable(cfg) {
  if (cfg.ga4 && !gaReady) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    });
    window.gtag('js', new Date());
    window.gtag('config', cfg.ga4, { anonymize_ip: true });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4)}`);
    gaReady = true;
  }
  const hs = cfg.hubspot || {};
  if (hs.portalId && !document.getElementById('hs-script-loader')) {
    const host = hs.region === 'eu1' ? 'js-eu1.hs-scripts.com' : 'js.hs-scripts.com';
    loadScript(`https://${host}/${encodeURIComponent(hs.portalId)}.js`, { id: 'hs-script-loader', defer: '' });
  }
}

export function track(name, params = {}) {
  if (gaReady && window.gtag) window.gtag('event', name, params);
}

export function initConsent(cfg) {
  const bar = document.querySelector('.consent');
  const needed = !!(cfg.ga4 || cfg.hubspot?.portalId);
  if (!bar || !needed) return;
  const choice = read();
  if (choice === 'granted') enable(cfg);
  if (!choice) {
    // appears once the visitor has begun to explore, never over the opening
    const show = () => {
      if (window.scrollY < innerHeight * 0.9) return;
      bar.hidden = false;
      window.removeEventListener('scroll', show);
    };
    window.addEventListener('scroll', show, { passive: true });
    setTimeout(() => {
      if (bar.hidden && !read()) {
        window.removeEventListener('scroll', show);
        bar.hidden = false;
      }
    }, 25000);
  }

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    write(b.dataset.consent);
    bar.hidden = true;
    if (b.dataset.consent === 'granted') enable(cfg);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-consent-reset]')) return;
    write(null);
    document.getElementById('privacy-sheet')?.close();
    bar.hidden = false;
    bar.querySelector('button')?.focus();
  });
}
