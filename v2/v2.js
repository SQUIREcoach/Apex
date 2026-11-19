/* APEX Piscinas 2.0 · comportamiento
   Sin dependencias. Cada efecto se desactiva con prefers-reduced-motion o si no hay WebGL. */
(() => {
'use strict';

/* ------------------------------------------------------------------
   Configuración de integraciones (rellenar en producción, no inventar IDs)
------------------------------------------------------------------- */
const APEX_CONFIG = window.APEX_CONFIG || {
  hubspot: {
    portalId: '',   // p. ej. el portal EU1 de APEX
    formId: '',     // GUID del formulario de captación
    region: 'eu1',
    // Nombre interno de cada propiedad en HubSpot
    fields: { need: 'necesidad', muni: 'city', mail: 'email', name: 'firstname', tel: 'phone', extra: 'message', sintoma: 'sintoma', step: 'paso_completado' }
  }
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ------------------------------------------------------------------
   Menú
------------------------------------------------------------------- */
const menu = $('#menu'), menuBtn = $('#menuBtn');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.hd-menu-l').textContent = open ? 'Cerrar' : 'Menú';
  if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); document.body.style.overflow = 'hidden'; $('a', menu).focus({ preventScroll: true }); }
  else { menu.classList.remove('is-open'); document.body.style.overflow = ''; setTimeout(() => { if (menuBtn.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, reduce ? 0 : 800); }
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); } });
$$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

/* ------------------------------------------------------------------
   Profundidad: medidor lateral + cabecera + fondo claro/oscuro
------------------------------------------------------------------- */
const secs = $$('main > section[data-depth]');
const hd = $('#hd'), gauge = $('.gauge'), gList = $('#gaugeList'), gFill = $('#gaugeFill');
const depthOut = $('[data-depth-out]'), depthLabel = $('[data-depth-label]');
const fmt = d => d.toFixed(2).replace('.', ',') + ' m';
secs.forEach(s => {
  const li = document.createElement('li');
  li.innerHTML = `<a href="#${s.id}"><b>${fmt(+s.dataset.depth)}</b><span>${s.dataset.label}</span></a>`;
  gList.appendChild(li);
});
const gLinks = $$('a', gList);
const darkIds = new Set(['superficie', 'simulador', 'carlos', 'zonas', 'contacto']);
const hero = $('#superficie'), heroWater = $('.hero-water'), mbar = $('.mbar');

let ticking = false;
function onScroll() {
  ticking = false;
  const y = scrollY, vh = innerHeight, mid = y + vh * .45;
  const heroH = hero.offsetHeight;
  hd.classList.toggle('is-solid', y > heroH * .6);
  gauge.classList.toggle('is-on', y > heroH * .5);
  mbar.classList.toggle('is-on', y > heroH * .8);
  heroWater.style.setProperty('--rise', `${(1 - clamp(y / (heroH * .5), 0, 1)) * 100}%`);
  heroProgress = clamp(y / heroH, 0, 1);

  // Sección actual y profundidad interpolada
  let idx = 0;
  for (let i = 0; i < secs.length; i++) if (secs[i].offsetTop <= mid) idx = i;
  const s = secs[idx], n = secs[idx + 1];
  const d0 = +s.dataset.depth, d1 = n ? +n.dataset.depth : d0;
  const t = n ? clamp((mid - s.offsetTop) / (n.offsetTop - s.offsetTop), 0, 1) : 1;
  const depth = d0 + (d1 - d0) * t;
  depthOut.textContent = fmt(depth);
  depthLabel.textContent = s.dataset.label;
  gLinks.forEach((a, i) => a.setAttribute('aria-current', String(i === idx)));
  const max = +secs[secs.length - 1].dataset.depth;
  gFill.style.height = (depth / max * 100) + '%';
  document.body.classList.toggle('on-dark', darkIds.has(s.id));
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);

/* ------------------------------------------------------------------
   Revelado al entrar en pantalla
------------------------------------------------------------------- */
const rvTargets = $$('.sec-h, .path, .duo-card, .dx, .sim, .carlos-fig, .carlos-txt, .pillars li, .faq details, .zl li, .contact-intro, .lead-form');
if ('IntersectionObserver' in window && !reduce) {
  rvTargets.forEach(el => el.classList.add('rv'));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  rvTargets.forEach((el, i) => { el.style.transitionDelay = ((i % 4) * 70) + 'ms'; io.observe(el); });
}

/* ------------------------------------------------------------------
   Caminos: la foto sigue al cursor (solo con ratón)
------------------------------------------------------------------- */
const prev = $('#pathPreview');
if (matchMedia('(hover: hover) and (min-width: 861px)').matches && !reduce) {
  const pimg = $('img', prev);
  let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
  const loop = () => { px += (tx - px) * .14; py += (ty - py) * .14; prev.style.left = px + 'px'; prev.style.top = py + 'px'; raf = Math.abs(tx - px) + Math.abs(ty - py) > .5 ? requestAnimationFrame(loop) : 0; };
  $$('.path').forEach(p => {
    p.addEventListener('mouseenter', e => { if (pimg.getAttribute('src') !== p.dataset.img) pimg.src = p.dataset.img; px = tx = e.clientX + 180; py = ty = e.clientY; prev.classList.add('on'); });
    p.addEventListener('mousemove', e => { tx = e.clientX + 200; ty = e.clientY; if (!raf) raf = requestAnimationFrame(loop); });
    p.addEventListener('mouseleave', () => prev.classList.remove('on'));
  });
}

/* ------------------------------------------------------------------
   Diagnóstico orientativo (contenido de Agua.dc.html y MiPiscina.dc.html)
------------------------------------------------------------------- */
const R = '../';
const DX = {
  agua: [
    { id: 'verde', label: 'Está verde', kind: 'Tratamiento del agua', behind: 'Crecimiento de algas por falta de desinfección, filtración insuficiente o pH alto. Suele aparecer tras calor, lluvia o unos días sin depuración.', how: 'Tratamiento de choque, limpieza, revisión de la filtración y corrección de parámetros. Muchas veces se recupera sin vaciar.', f: [['Recuperación de agua verde', 'Ficha-agua-verde.dc.html']] },
    { id: 'turbia', label: 'Está turbia o lechosa', kind: 'Tratamiento del agua', behind: 'Partículas que la filtración no retiene: medio filtrante agotado, horas de depuración cortas o química desajustada.', how: 'Diagnóstico de la filtración y tratamiento clarificante cuando corresponde.', f: [['Cambio de arena por vidrio', 'Ficha-arena-vidrio.dc.html'], ['Diagnóstico de filtración', 'Ficha-diag-filtracion.dc.html']] },
    { id: 'irrita', label: 'Irrita los ojos o huele a cloro', kind: 'Tratamiento del agua', behind: 'Normalmente no es exceso de cloro: suele ser un pH desajustado o cloro combinado por desinfección insuficiente.', how: 'Medición y corrección química, con pautas para mantener los parámetros estables.', f: [['Sondas de pH y cloro', 'Ficha-sondas.dc.html']] },
    { id: 'manchas', label: 'Manchas o cal en las paredes', kind: 'Tratamiento del agua', behind: 'Agua dura o pH alto que precipita cal, metales disueltos o restos orgánicos que se fijan al revestimiento.', how: 'Identificamos el tipo de mancha antes de tratarla. Un producto equivocado puede dañar el revestimiento.', f: [['Recuperación de agua verde', 'Ficha-agua-verde.dc.html']] },
    { id: 'tormenta', label: 'Después de una tormenta', kind: 'Tratamiento del agua', behind: 'La lluvia arrastra tierra, polen y materia orgánica, y descompensa el pH y la desinfección en pocas horas.', how: 'Limpieza, desinfección y corrección de parámetros, con comprobación posterior.', f: [['Recuperación de agua verde', 'Ficha-agua-verde.dc.html']] },
    { id: 'parada', label: 'Lleva tiempo sin usarse', kind: 'Tratamiento del agua', behind: 'Semanas sin depuración ni tratamiento: el agua se estanca y los equipos pueden haberse resentido.', how: 'Puesta en marcha completa: agua, filtración y equipos revisados antes de volver a bañarse.', f: [['Preparar la temporada', 'Ficha-temporada-inicio.dc.html']] }
  ],
  inst: [
    { id: 'fuga', label: 'Pierde agua', kind: 'Diagnóstico y reparación', behind: 'Una parte de la bajada de nivel es evaporación normal. Si es mayor, puede haber una pérdida en el vaso, en una pieza empotrada (skimmer, boquillas, focos, sumidero) o en las tuberías.', how: 'Primero descartamos la evaporación y aislamos circuitos para acotar la zona. Con la pérdida localizada, te presentamos la reparación como un encargo aparte.', f: [['Diagnóstico de pérdidas de agua', 'Ficha-diag-perdidas.dc.html'], ['Reparación de pérdidas accesibles', 'Ficha-perdidas-accesibles.dc.html']] },
    { id: 'desague', label: 'Sale agua por el desagüe del filtro', kind: 'Servicio técnico', behind: 'La válvula selectora no cierra bien: juntas internas gastadas, maneta dañada o una válvula que ha llegado al final de su vida.', how: 'Comprobamos que el fallo es de la válvula y no del filtro. Si lo es, la sustituimos por una compatible y probamos todas las posiciones.', f: [['Sustitución de válvula selectora', 'Ficha-Selectora.dc.html'], ['Válvulas y uniones', 'Ficha-valvulas.dc.html']] },
    { id: 'depu', label: 'La depuradora no arranca', kind: 'Servicio técnico', behind: 'Bomba bloqueada o quemada, condensador averiado, temporizador o protección eléctrica que corta el circuito.', how: 'Revisamos la parte eléctrica con seguridad y después la bomba. Te decimos si compensa reparar o sustituir.', f: [['Fallos eléctricos', 'Ficha-electricos.dc.html'], ['Cambio de bomba', 'Ficha-bomba.dc.html']] },
    { id: 'ruido', label: 'Ruidos o burbujas en la depuración', kind: 'Servicio técnico', behind: 'Entrada de aire por la aspiración, prefiltro mal cerrado, nivel de agua bajo en el skimmer o rodamientos de la bomba desgastados.', how: 'Comprobamos el circuito de aspiración y el estado de la bomba. Un diagnóstico evita cambiar piezas que funcionan.', f: [['Cambio de bomba', 'Ficha-bomba.dc.html'], ['Accesorios del skimmer', 'Ficha-accesorios.dc.html']] },
    { id: 'filtra', label: 'Filtra poco o la presión sube', kind: 'Servicio técnico', behind: 'Medio filtrante agotado o apelmazado, lavados insuficientes o un filtro mal dimensionado para la piscina.', how: 'Revisamos filtro, carga y caudal. Muchas veces basta con renovar la carga; a veces conviene pasar de arena a vidrio.', f: [['Cambio de arena por vidrio', 'Ficha-arena-vidrio.dc.html'], ['Sustitución de filtro', 'Ficha-filtro.dc.html']] },
    { id: 'sal', label: 'El salinizador da error', kind: 'Servicio técnico', behind: 'Célula calcificada o al final de su vida útil, sal fuera de rango, falta de caudal o una sonda que mide mal.', how: 'Revisamos célula, sal, caudal y sondas. Te decimos si basta con limpiar y calibrar o si toca sustituir la célula.', f: [['Sustitución de célula salina', 'Ficha-celula.dc.html'], ['Sondas de pH y cloro', 'Ficha-sondas.dc.html']] },
    { id: 'foco', label: 'Los focos no encienden', kind: 'Servicio técnico', behind: 'Lámpara fundida, transformador averiado, entrada de agua en el nicho o un problema en la protección eléctrica.', how: 'Comprobamos la instalación eléctrica con seguridad y el estado del nicho antes de sustituir el foco por uno compatible.', f: [['Sustitución de foco', 'Ficha-foco.dc.html'], ['Fallos eléctricos', 'Ficha-electricos.dc.html']] },
    { id: 'salta', label: 'Saltan las protecciones eléctricas', kind: 'Servicio técnico', behind: 'Humedad en el cuadro, un equipo con derivación a tierra o una protección mal dimensionada.', how: 'Aislamos equipo por equipo hasta encontrar el que deriva. Nada se vuelve a conectar sin estar seguro.', f: [['Fallos eléctricos', 'Ficha-electricos.dc.html']] },
    { id: 'skim', label: 'Skimmer, tapa o cesta rotos', kind: 'Reparación menor', behind: 'Piezas de plástico que el sol y el cloro desgastan con los años: cestas, compuertas, tapas y collarines.', how: 'Identificamos el modelo y sustituimos la pieza por un recambio compatible. Una reparación pequeña también tiene su ficha.', f: [['Accesorios del skimmer', 'Ficha-accesorios.dc.html']] },
    { id: 'nose', label: 'No sé qué le pasa', kind: 'Diagnóstico', behind: 'No hace falta saber el nombre técnico. Lo que ves, oyes o notas ya es información útil.', how: 'Cuéntanos qué notas y mándanos unas fotos. Carlos te orienta sobre el siguiente paso antes de mover nada.', f: [['Diagnóstico del sistema de filtración', 'Ficha-diag-filtracion.dc.html']] }
  ]
};
const dxList = $('#dxList'), dxOut = $('#dxOut');
let dxGroup = 'agua', dxCur = DX.agua[0];
function dxRenderList() {
  dxList.innerHTML = '';
  dxList.setAttribute('aria-labelledby', 'tab-' + dxGroup);
  DX[dxGroup].forEach(it => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.textContent = it.label; b.setAttribute('aria-pressed', String(it === dxCur));
    b.addEventListener('click', () => { dxCur = it; $$('button', dxList).forEach(x => x.setAttribute('aria-pressed', String(x === b))); dxShow(); });
    li.appendChild(b); dxList.appendChild(li);
  });
}
function dxShow() {
  const it = dxCur;
  $('[data-k]', dxOut).textContent = it.kind;
  $('[data-t]', dxOut).textContent = it.label;
  $('[data-behind]', dxOut).textContent = it.behind;
  $('[data-how]', dxOut).textContent = it.how;
  const f = $('[data-fichas]', dxOut); f.innerHTML = '';
  it.f.forEach(([t, h]) => { const a = document.createElement('a'); a.href = R + h; a.textContent = t + ' →'; f.appendChild(a); });
  dxOut.classList.remove('swap'); void dxOut.offsetWidth; dxOut.classList.add('swap');
}
$$('.dx-tab').forEach(tab => tab.addEventListener('click', () => {
  dxGroup = tab.dataset.group; dxCur = DX[dxGroup][0];
  $$('.dx-tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
  dxRenderList(); dxShow();
}));
$('[data-dx-cta]').addEventListener('click', () => {
  form.elements.sintoma.value = dxCur.label;
  const need = dxGroup === 'agua' ? 'agua' : 'reparar';
  const r = $(`input[name="need"][value="${need}"]`, form); r.checked = true;
  save(1, { need, sintoma: dxCur.label });
  go(2, `Anotado: «${dxCur.label}». Seguimos desde aquí.`);
});
dxRenderList(); dxShow();

/* ------------------------------------------------------------------
   Proceso: la sección constructiva avanza con el texto
------------------------------------------------------------------- */
const xs = $('#xs'), cap = $('#procCap'), steps = $$('#procSteps > li');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const st = e.target.dataset.step;
    steps.forEach(s => s.classList.toggle('on', s === e.target));
    xs.dataset.step = st;
    cap.textContent = '0' + st + ' · ' + $('h3', e.target).textContent;
  }), { rootMargin: '-45% 0px -50% 0px' });
  steps.forEach(s => io.observe(s));
} else steps.forEach(s => s.classList.add('on'));

/* ------------------------------------------------------------------
   Formulario por pasos (guardado progresivo)
   HubSpot: save() se llama al terminar CADA paso. Pasos 1-2 quedan en local y
   ligados a la cookie hubspotutk; desde el paso 3 (email) se envía a HubSpot.
------------------------------------------------------------------- */
const form = $('#leadForm'), bar = $('#lfBar'), count = $('#lfCount'), back = $('#lfBack'), saved = $('#lfSaved');
const TOTAL = 5;
let step = 1, lead = lsGet('apex_lead') || {};
function go(n, msg) {
  step = n;
  $$('[data-s]', form).forEach(el => { el.hidden = +el.dataset.s !== n; });
  bar.style.width = Math.min(n, TOTAL) / TOTAL * 100 + '%';
  count.textContent = n > TOTAL ? '✓' : `${n} / ${TOTAL}`;
  back.hidden = n === 1 || n > TOTAL;
  saved.textContent = msg || (n > 1 && n <= TOTAL ? 'Guardado. Si lo dejas aquí, no pierdes lo que ya nos has contado.' : '');
  const cur = $(`[data-s="${n}"]`, form);
  if (msg) $('#contacto').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  const f = $('input:not([type=hidden]):not([type=radio]), textarea', cur);
  if (n > TOTAL) cur.focus(); else if (f && n > 1) setTimeout(() => f.focus({ preventScroll: true }), 50);
}
function hutk() { const m = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]+)/); return m ? m[1] : undefined; }
function save(s, data) {
  lead = Object.assign({}, lead, data, { step: s });
  lsSet('apex_lead', lead);
  if (typeof window.APEX_LEAD_HANDLER === 'function') { try { window.APEX_LEAD_HANDLER(lead); } catch (e) {} }
  const hs = APEX_CONFIG.hubspot;
  if (!hs.portalId || !hs.formId || !lead.mail) return;  // sin email HubSpot no crea contacto
  const fields = Object.entries(hs.fields).filter(([k]) => lead[k] != null && lead[k] !== '').map(([k, name]) => ({ name, value: String(lead[k]) }));
  fetch(`https://api-${hs.region}.hsforms.com/submissions/v3/integration/submit/${hs.portalId}/${hs.formId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ fields, context: { hutk: hutk(), pageUri: location.href, pageName: document.title } })
  }).catch(() => {});
}
$$('input[name="need"]', form).forEach(r => r.addEventListener('change', () => { save(1, { need: r.value }); go(2); }));
back.addEventListener('click', () => go(step - 1, ''));
const err = (k, on) => { $(`[data-err="${k}"]`, form).hidden = !on; };
form.addEventListener('submit', e => {
  e.preventDefault();
  const el = form.elements;
  if (step === 2) { if (!el.muni.value.trim()) { el.muni.focus(); return; } save(2, { muni: el.muni.value.trim() }); go(3); }
  else if (step === 3) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.mail.value.trim()); err('mail', !ok);
    if (!ok) { el.mail.focus(); return; }
    save(3, { mail: el.mail.value.trim(), fotos: el.fotos.files.length }); go(4);
  }
  else if (step === 4) {
    const ok = el.name.value.trim() && el.tel.value.replace(/\D/g, '').length >= 9 && el.ok.checked; err('s4', !ok);
    if (!ok) return;
    save(4, { name: el.name.value.trim(), tel: el.tel.value.trim() }); go(5);
  }
  else if (step === 5) { save(5, { extra: el.extra.value.trim(), sintoma: el.sintoma.value || lead.sintoma }); go(6, ''); try { localStorage.removeItem('apex_lead'); } catch (e) {} }
});
// Reanudar un formulario a medias
if (lead && lead.step && lead.step < 5) {
  ['muni', 'mail', 'name', 'tel'].forEach(k => { if (lead[k] && form.elements[k]) form.elements[k].value = lead[k]; });
  if (lead.need) { const r = $(`input[name="need"][value="${lead.need}"]`, form); if (r) r.checked = true; }
}

/* ------------------------------------------------------------------
   WebGL compartido
------------------------------------------------------------------- */
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}';
const CAUSTIC = `
float caustic(vec2 p,float t){
  vec2 i=p;float c=1.;
  for(int n=0;n<4;n++){
    float tt=t*(1.-(3.5/float(n+1)));
    i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
    c+=1./max(length(vec2(p.x/(sin(i.x+tt)/.005),p.y/(cos(i.y+tt)/.005))),1e-3);
  }
  c/=4.;c=1.17-pow(clamp(c,0.,8.),1.4);return clamp(pow(abs(c),8.),0.,1.2);
}`;
function glSetup(canvas, fs) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false });
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; };
  const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(pr, i); U[u.name.replace('[0]', '')] = gl.getUniformLocation(pr, u.name); }
  return { gl, U };
}
function fit(canvas, gl, maxDpr) {
  const d = Math.min(devicePixelRatio || 1, maxDpr);
  const w = Math.round(canvas.clientWidth * d), h = Math.round(canvas.clientHeight * d);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
}
function whenVisible(el, cb) { // ejecuta solo mientras el elemento está en pantalla
  let vis = false;
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) cb(); }, { rootMargin: '100px' }).observe(el);
  return () => vis && !document.hidden;
}

/* ------------------------------------------------------------------
   Hero: refracción del agua, ondas al pasar el cursor e inmersión al bajar
------------------------------------------------------------------- */
let heroProgress = 0;
(function heroGL() {
  const c = $('#heroGL'), img = $('.hero-img');
  if (reduce || !c) return;
  const FS = `precision mediump float;varying vec2 v;
  uniform sampler2D img;uniform vec2 res,ires;uniform float t,sink;uniform vec4 rip[6];
  ${CAUSTIC}
  void main(){
    float rs=res.x/res.y,ri=ires.x/ires.y;
    vec2 sc=rs>ri?vec2(1.,ri/rs):vec2(rs/ri,1.);
    vec2 uv=(v-.5)*sc+.5;
    float water=smoothstep(.5,.7,uv.y);               // la lámina de agua de la foto
    float k=mix(water,1.,sink);                        // al bajar, todo queda bajo el agua
    vec2 off=k*vec2(sin(uv.y*70.+t*1.3)+sin(uv.x*23.-t*.8),cos(uv.x*55.+t*1.1))*(.0016+.004*sink);
    vec2 a=vec2(rs,1.);
    for(int i=0;i<6;i++){
      vec4 r=rip[i];float age=t-r.z;
      if(age<0.||age>4.)continue;
      vec2 dv=(v-r.xy)*a;float d=length(dv);
      float w=sin(d*90.-age*14.)*exp(-age*1.4)*exp(-d*6.)*r.w;
      off+=normalize(dv+1e-5)*w*.006/a;
    }
    vec3 col=texture2D(img,uv+off).rgb;
    float cs=caustic(uv*vec2(ri,1.)*7.+vec2(0.,t*.05),t*.45);
    col+=k*cs*vec3(1.,.93,.8)*(.09+.22*sink);
    vec3 deep=vec3(.03,.12,.2);
    col=mix(col,col*vec3(.55,.8,.95)+deep*.6,sink*.85);
    gl_FragColor=vec4(col,1.);
  }`;
  const g = glSetup(c, FS); if (!g) return;
  const { gl, U } = g;
  const tex = gl.createTexture();
  const start = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.uniform2f(U.ires, img.naturalWidth, img.naturalHeight);
    c.classList.add('is-ready');
    const rips = new Float32Array(24); let ri = 0, last = 0;
    const add = (x, y, amp) => { const tt = performance.now() / 1000; rips.set([x, y, tt, amp], (ri++ % 6) * 4); };
    hero.addEventListener('pointermove', e => { const now = performance.now(); if (now - last < 140) return; last = now; const r = c.getBoundingClientRect(); add((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, .35); }, { passive: true });
    hero.addEventListener('pointerdown', e => { const r = c.getBoundingClientRect(); add((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 1); });
    const alive = whenVisible(hero, () => requestAnimationFrame(frame));
    let running = false;
    function frame() {
      if (!alive()) { running = false; return; }
      running = true;
      fit(c, gl, 1.5);
      gl.uniform2f(U.res, c.width, c.height);
      gl.uniform1f(U.t, performance.now() / 1000);
      gl.uniform1f(U.sink, heroProgress);
      gl.uniform4fv(U.rip, rips);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !running) requestAnimationFrame(frame); });
  };
  if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
})();

/* ------------------------------------------------------------------
   Simulador: revestimiento × luz × estado del agua
   Modelo simplificado de absorción (Beer-Lambert) y dispersión.
------------------------------------------------------------------- */
const COATS = [
  { n: 'Blanco', c: '#ECEAE3', tile: 0., d: 'Agua turquesa y luminosa. Refleja mucha luz y deja ver el fondo con nitidez.' },
  { n: 'Arena', c: '#D6C29A', tile: 0., d: 'Turquesa cálido, de cala mediterránea. Disimula bien el polvo y la cal.' },
  { n: 'Gris perla', c: '#B5BAB9', tile: 0., d: 'Azul sereno y contemporáneo. Encaja con piedra natural y arquitectura actual.' },
  { n: 'Gresite celeste', c: '#86BFDA', tile: 1., d: 'El azul piscina clásico, con el brillo del mosaico vítreo.' },
  { n: 'Gresite azul', c: '#2E6D9C', tile: 1., d: 'Azul profundo e intenso. Aporta presencia a la lámina de agua.' },
  { n: 'Antracita', c: '#3A3F44', tile: 0., d: 'Agua oscura con efecto espejo. Refleja el cielo y el paisaje; se calienta algo más.' }
];
(function sim() {
  const c = $('#simGL'); if (!c) return;
  const swWrap = $('#swCoat'), coatName = $('#coatName'), rg = $('#rgWater'), wsTxt = $('#waterState'), tip = $('.sim-tip');
  let coat = 3, light = 0, water = 0;
  COATS.forEach((k, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.style.setProperty('--c', k.c);
    b.setAttribute('aria-label', k.n); b.setAttribute('aria-pressed', String(i === coat));
    b.addEventListener('click', () => { coat = i; $$('button', swWrap).forEach(x => x.setAttribute('aria-pressed', String(x === b))); coatName.textContent = k.n + ' · ' + k.d; kick(); });
    swWrap.appendChild(b);
  });
  coatName.textContent = COATS[coat].n + ' · ' + COATS[coat].d;
  $$('#segLight button').forEach(b => b.addEventListener('click', () => { light = +b.dataset.light; $$('#segLight button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); kick(); }));
  const WS = ['Agua equilibrada y bien filtrada.', 'Empieza a perder transparencia: filtración o química desajustadas.', 'Turbia: la filtración no retiene las partículas.', 'Verde: proliferan las algas. Suele recuperarse sin vaciar.'];
  rg.addEventListener('input', () => { water = rg.value / 100; wsTxt.textContent = WS[Math.min(3, Math.floor(water * 3.999))]; rg.setAttribute('aria-valuetext', wsTxt.textContent); kick(); });

  const FS = `precision highp float;varying vec2 v;
  uniform vec2 res;uniform float t,turb,green,tile,light;uniform vec3 coat;uniform vec4 rip[6];
  ${CAUSTIC}
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
  void main(){
    vec2 a=vec2(res.x/res.y,1.);vec2 p=v*a;                   // coordenadas en "metros" aprox.
    vec2 lo=vec2(.09,.13)*a,hi=vec2(.91,.87)*a;                 // borde del vaso
    float day=clamp(1.-light,0.,1.),dusk=1.-abs(light-1.),night=clamp(light-1.,0.,1.);
    vec3 L=day*vec3(1.,.98,.94)+dusk*vec3(1.,.8,.64)*.8+night*vec3(.05,.07,.12);
    // ¿dentro del agua?
    vec2 q=min(p-lo,hi-p);float inside=step(0.,min(q.x,q.y));float edge=min(q.x,q.y);
    // cubierta y coronación
    float cope=step(-.035,min(q.x,q.y))*(1.-inside);
    vec3 deck=vec3(.86,.82,.75)*(.9+.1*n2(p*90.))*(.92+.08*n2(p*7.));
    vec3 col=mix(deck,vec3(.95,.93,.89),cope)*L;
    if(night>0.){col+=night*vec3(.25,.45,.55)*exp(-max(-edge,0.)*30.)*.5;}
    if(inside>.5){
      float x=(p.x-lo.x)/(hi.x-lo.x);
      float depth=mix(1.,2.,smoothstep(.35,.75,x));             // 1,0 m → 2,0 m
      // superficie: normal animada + ondas al tocar
      vec2 gr=vec2(sin(p.x*18.+t*1.1)+sin(p.y*23.-t*.9+p.x*6.),cos(p.y*19.+t*1.3)+cos(p.x*15.-t*.7))*.012;
      for(int i=0;i<6;i++){vec4 r=rip[i];float age=t-r.z;if(age<0.||age>5.)continue;
        vec2 dv=p-r.xy*a;float d=length(dv);gr+=normalize(dv+1e-5)*sin(d*60.-age*9.)*exp(-age*1.)*exp(-d*5.)*.06;}
      vec2 fp=p+gr*depth*.6;                                     // refracción hacia el fondo
      // fondo: revestimiento
      vec3 fl=coat;
      if(tile>.5){vec2 g=fract(fp*95.);float j=smoothstep(.0,.08,g.x)*smoothstep(.0,.08,g.y)*smoothstep(1.,.92,g.x)*smoothstep(1.,.92,g.y);
        fl*=mix(.78,1.,j)*(.9+.2*h(floor(fp*95.)));}
      else fl*=.94+.06*n2(fp*60.);
      fl*=.62+.38*smoothstep(0.,.06,edge);                        // sombra de las paredes
      float clear=1.-max(turb,green);
      float cs=caustic(fp*8.+vec2(t*.08,0.),t*.6);
      vec3 lit=fl*(L*(.75+.9*cs*clear*(day+dusk*.6)));
      // focos subacuáticos en los muros largos
      vec3 lamp=vec3(0.);
      for(int i=0;i<3;i++){float lx=mix(lo.x,hi.x,.2+.3*float(i));
        lamp+=exp(-length((fp-vec2(lx,lo.y+.01))*vec2(1.,1.6))*5.)+exp(-length((fp-vec2(lx,hi.y-.01))*vec2(1.,1.6))*5.);}
      lit+=night*fl*lamp*vec3(.95,.97,1.)*1.6;
      // absorción del agua (ida y vuelta) y dispersión
      vec3 ab=vec3(.30,.06,.035)+green*vec3(.18,-.02,.6)+turb*vec3(.15,.12,.1);
      vec3 T=exp(-ab*depth*2.*1.15);
      vec3 sc=mix(vec3(.02,.17,.32),vec3(.42,.47,.42),turb*.8);
      sc=mix(sc,vec3(.2,.32,.09),green);
      float fog=1.-exp(-(.25+turb*2.2+green*2.8)*depth);
      vec3 sL=L+night*lamp*.35*vec3(.7,.9,1.);
      col=mix(lit*T,sc*sL,fog);
      // reflejo y destellos
      vec3 sky=day*vec3(.55,.75,.95)+dusk*vec3(1.,.62,.42)+night*vec3(.02,.03,.06);
      col+=sky*.06;
      vec3 n=normalize(vec3(-gr*6.,1.));
      vec3 hv=normalize(vec3(.35,-.25,1.));
      col+=pow(max(dot(n,hv),0.),220.)*(day*1.2+dusk*1.6)*vec3(1.,.95,.85);
    }
    col=pow(col,vec3(1./1.08));
    gl_FragColor=vec4(col,1.);
  }`;
  const g = glSetup(c, FS);
  if (!g) { c.replaceWith(Object.assign(document.createElement('p'), { className: 'sim-note', textContent: 'Tu navegador no permite mostrar la simulación.' })); return; }
  const { gl, U } = g;
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const rips = new Float32Array(24); let ri = 0;
  const add = (x, y) => { rips.set([x, y, performance.now() / 1000, 1], (ri++ % 6) * 4); tip.classList.add('off'); kick(); };
  c.addEventListener('pointerdown', e => { const r = c.getBoundingClientRect(); add((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
  let cur = { coat: hex(COATS[coat].c), tile: COATS[coat].tile, turb: 0, green: 0, light: 0 };
  let running = false, idleUntil = 0;
  const alive = whenVisible(c, () => kick());
  function kick() { idleUntil = performance.now() + 6000; if (!running) { running = true; requestAnimationFrame(frame); } }
  function frame() {
    const now = performance.now();
    if (!alive() || (reduce && now > idleUntil)) { running = false; return; }
    const tg = hex(COATS[coat].c), e = reduce ? 1 : .08;
    cur.coat = cur.coat.map((x, i) => x + (tg[i] - x) * e);
    cur.tile = COATS[coat].tile;
    const turbT = clamp(water / .66, 0, 1) * (1 - clamp((water - .66) / .34, 0, 1) * .5), greenT = clamp((water - .55) / .45, 0, 1);
    cur.turb += (turbT - cur.turb) * e; cur.green += (greenT - cur.green) * e; cur.light += (light - cur.light) * e;
    fit(c, gl, 1.5);
    gl.uniform2f(U.res, c.width, c.height);
    gl.uniform1f(U.t, reduce ? 0 : now / 1000);
    gl.uniform3fv(U.coat, cur.coat);
    gl.uniform1f(U.tile, cur.tile); gl.uniform1f(U.turb, cur.turb); gl.uniform1f(U.green, cur.green); gl.uniform1f(U.light, cur.light);
    gl.uniform4fv(U.rip, rips);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }
})();

onScroll();
})();
