// Contact: always reachable, never insistent. Three ways only:
// call, write (HubSpot form or email) and book a visit (HubSpot Meetings).

export function initContact(cfg, track, { lenis } = {}) {
  const sheet = document.getElementById('contact-sheet');
  const privacy = document.getElementById('privacy-sheet');
  const T = cfg.t?.dialog || {};
  if (!sheet) return {};

  const tabs = [...sheet.querySelectorAll('[role="tab"]')];
  const panes = [...sheet.querySelectorAll('[role="tabpanel"]')];
  const select = (name, focus = false) => {
    tabs.forEach((t) => {
      const on = t.id === `tab-${name}`;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panes.forEach((p) => (p.hidden = p.id !== `pane-${name}`));
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.id.slice(4)));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length].id.slice(4), true);
    });
  });

  const open = (dlg, tab) => {
    if (tab) select(tab);
    lenis?.stop();
    dlg.showModal();
    document.documentElement.classList.add('sheet-open');
  };
  const close = (dlg) => dlg.close();
  for (const dlg of [sheet, privacy]) {
    if (!dlg) continue;
    dlg.addEventListener('close', () => {
      lenis?.start();
      document.documentElement.classList.remove('sheet-open');
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) close(dlg);
    });
  }

  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open-contact]');
    if (o) {
      e.preventDefault();
      const tab = o.dataset.openContact || 'call';
      open(sheet, tab);
      track('contact_open', { method: tab });
      return;
    }
    if (e.target.closest('[data-open-privacy]')) {
      e.preventDefault();
      if (privacy) open(privacy);
      return;
    }
    const a = e.target.closest('[data-action]');
    if (a) track('contact_click', { method: a.dataset.action });
  });

  // ---- write: HubSpot Forms API, with email as the fallback ---------------
  const form = sheet.querySelector('.form');
  const status = sheet.querySelector('.form__status');
  const send = sheet.querySelector('.form__send');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    let bad = 0;
    for (const el of form.querySelectorAll('[required]')) {
      const ok = el.type === 'checkbox' ? el.checked : el.value.trim() && el.checkValidity();
      el.setAttribute('aria-invalid', String(!ok));
      if (!ok) bad++;
    }
    if (bad) {
      status.textContent = T.invalid || '';
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const hs = cfg.hubspot || {};
    if (!hs.portalId || !hs.formGuid) {
      // no form configured: hand over to the visitor's mail client
      const body = `${fd.get('message')}\n\n${fd.get('firstname')}\n${fd.get('phone') || ''}`;
      location.href = `mailto:${cfg.email}?subject=${encodeURIComponent('APEX — ' + fd.get('firstname'))}&body=${encodeURIComponent(body)}`;
      track('generate_lead', { method: 'mailto' });
      return;
    }
    send.disabled = true;
    status.textContent = T.sending || '';
    const host = hs.region === 'eu1' ? 'https://api-eu1.hsforms.com' : 'https://api.hsforms.com';
    const hutk = document.cookie.match(/(?:^|; )hubspotutk=([^;]+)/)?.[1];
    const payload = {
      fields: ['firstname', 'email', 'phone', 'message']
        .filter((k) => fd.get(k))
        .map((k) => ({ objectTypeId: '0-1', name: k, value: String(fd.get(k)) })),
      context: { pageUri: location.href, pageName: document.title, ...(hutk ? { hutk } : {}) },
      legalConsentOptions: { consent: { consentToProcess: true, text: T.consent || '' } },
    };
    try {
      const res = await fetch(`${host}/submissions/v3/integration/submit/${hs.portalId}/${hs.formGuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      status.textContent = T.sent || '';
      track('generate_lead', { method: 'hubspot_form' });
    } catch (err) {
      status.innerHTML = `${T.error || ''} <a href="mailto:${cfg.email}">${cfg.email}</a>.`;
    } finally {
      send.disabled = false;
    }
  });

  // ---- visit: HubSpot Meetings, loaded only when asked ---------------------
  const meet = sheet.querySelector('.meetings');
  meet?.querySelector('[data-load-meetings]')?.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = meet.dataset.src;
    f.title = T.visitTab || 'HubSpot Meetings';
    f.loading = 'lazy';
    f.className = 'meetings__frame';
    meet.replaceChildren(f);
    track('contact_click', { method: 'meetings' });
  });

  return { open: (tab) => open(sheet, tab) };
}
