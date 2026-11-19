// The elevation gauge: the camera's real height relative to the water
// surface of the current world, plus the chapter index (navigation).

export function initGauge(cfg, scrollTo) {
  const g = document.querySelector('.gauge');
  if (!g) return { setActive() {}, setElevation() {} };
  const val = g.querySelector('.gauge__val');
  const links = [...g.querySelectorAll('a[data-target]')];
  const fmt = new Intl.NumberFormat(cfg.lang === 'en' ? 'en-GB' : `${cfg.lang || 'es'}-ES`, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
  });
  let last = '';
  return {
    setActive(id) {
      links.forEach((a) => {
        if (a.dataset.target === id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    },
    setElevation(v) {
      const s = v === null || v === undefined || !isFinite(v) ? '—' : `${fmt.format(Math.abs(v) < 0.005 ? 0 : v)} m`;
      if (s === last) return;
      last = s;
      val.textContent = s;
      g.classList.toggle('is-under', v !== null && v < 0);
    },
    scrollTo,
  };
}
