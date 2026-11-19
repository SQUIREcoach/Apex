// Links the legend and the technical drawing: point at one, see the other.

export function initAnatomy() {
  const sec = document.querySelector('.anatomy');
  if (!sec) return;
  const svg = sec.querySelector('svg');
  const items = [...sec.querySelectorAll('.legend__item')];
  let pinned = null;

  const set = (id) => {
    sec.classList.toggle('has-active', !!id);
    svg.querySelectorAll('[data-layer]').forEach((g) => g.classList.toggle('is-active', g.dataset.layer === id));
    items.forEach((li) => {
      const on = li.dataset.layer === id;
      li.classList.toggle('is-active', on);
      li.querySelector('button').setAttribute('aria-pressed', String(on));
    });
  };

  items.forEach((li) => {
    const id = li.dataset.layer;
    const btn = li.querySelector('button');
    btn.setAttribute('aria-pressed', 'false');
    li.addEventListener('pointerenter', () => !pinned && set(id));
    li.addEventListener('pointerleave', () => !pinned && set(null));
    btn.addEventListener('focus', () => !pinned && set(id));
    btn.addEventListener('blur', () => !pinned && set(null));
    btn.addEventListener('click', () => {
      pinned = pinned === id ? null : id;
      set(pinned);
    });
  });

  svg.querySelectorAll('[data-layer]').forEach((g) => {
    g.addEventListener('pointerenter', () => !pinned && set(g.dataset.layer));
    g.addEventListener('pointerleave', () => !pinned && set(null));
    g.addEventListener('click', () => {
      pinned = pinned === g.dataset.layer ? null : g.dataset.layer;
      set(pinned);
    });
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    svg.querySelectorAll('animate').forEach((a) => a.remove());
  }
}
