# APEX Piscinas — Una nueva dimensión del agua

Experiencia digital de marca construida desde cero, independiente de la web
publicada (no comparte código, estructura ni dominio con ella).

**Idea rectora:** el agua no es una imagen, es la interfaz. La visita empieza
en el borde de una piscina desbordante al anochecer (la superficie responde al
cursor con una simulación física real). Al desplazarse hacia abajo, **el
visitante se tira al agua**: la cámara se asoma al borde, cae con aceleración,
impacta (espuma, estela de aire, sacudida, sonido), atraviesa la superficie y
se hunde entre burbujas hasta quedar suspendida. **Buceando, las opciones
emergen del fondo**: tres ventanas de luz con los renders de cada mercado,
flotando en el agua, con las cáusticas jugando sobre ellas, y los accesos a
Anatomía, Trayectoria y Contacto. Desde ahí se nada hacia el manifiesto y se
emerge en tres mundos arquitectónicos 3D. Al volver arriba, se sale a la
superficie. Un indicador lateral muestra la **cota real de la cámara**
respecto al agua.

| Capítulo | Escena | Qué comunica |
|---|---|---|
| Superficie | Piscina desbordante en tiempo real, interactiva | Quiénes somos |
| El salto | Secuencia cinematográfica de 3,6 s: caída, impacto, burbujas | La sensación de entrar en el agua |
| Inmersión | Opciones emergiendo del fondo (renders en ventanas de luz) y manifiesto | Qué ofrecemos y cómo pensamos |
| Hoteles y resorts · Residencias · Proyectos extraordinarios | Tres conceptos arquitectónicos 3D (rotulados como concepto) | Mercados estratégicos |
| Anatomía | Plano técnico interactivo con leyenda numerada | Qué hacemos, capa a capa (sin fichas de servicio) |
| Trayectoria | Profundidad submarina + narrativa editorial | Autoridad: Carlos Callealta |
| Conversación | Vista cenital sobre la marca APEX bajo el agua | Llamar · Escribir · Concertar visita |

## Puesta en marcha

```bash
npm install
npm run dev       # http://localhost:5173  (genera / , /ca/ , /en/)
npm run build     # salida estática en dist/
npm run preview   # sirve dist/
```

Requiere Node 22+. La salida de `dist/` es estática y usa rutas relativas:
funciona en cualquier hosting (Netlify, Vercel, Cloudflare Pages, S3, un
subdirectorio…).

Parámetros de depuración por URL: `?q=0..3` fuerza un nivel de calidad
(0 = sin WebGL) y `?fixed` desactiva el ajuste dinámico de resolución.

## Configuración

Todo está en `site.config.mjs` y puede sobrescribirse con variables de entorno
(o un fichero `.env`, ver `.env.example`):

| Variable | Uso |
|---|---|
| `SITE_URL` | Dominio final. Canonical, hreflang, sitemap, Open Graph. |
| `INDEXABLE` | `false` por defecto: la versión de pruebas lleva `noindex` y `robots.txt` bloqueante para no competir con la web publicada. Poner `true` solo en el build de producción. |
| `HUBSPOT_PORTAL_ID` | Cuenta HubSpot (EU1). Por defecto `149296330`, **confirmar**. Se usa para el seguimiento (solo tras consentimiento). |
| `HUBSPOT_FORM_GUID` | Formulario de HubSpot al que envía «Escribir» (Forms API v3). Si está vacío, el formulario abre el correo del visitante. |
| `HUBSPOT_MEETINGS_URL` | Agenda de «Concertar una visita» (se carga solo al pedirla). |
| `GA4_ID` | ID de Google Analytics 4 (`G-…`). Vacío = sin analítica. |

## Integraciones y privacidad

- **Consentimiento:** nada que use cookies se carga antes de aceptar. Franja
  discreta que aparece cuando el visitante ya ha empezado a explorar; aceptar y
  rechazar tienen el mismo peso. Revocable desde «Privacidad y cookies».
- **GA4:** se carga tras el consentimiento. Eventos: `contact_open`,
  `contact_click` (call / write / visit / whatsapp / meetings), `generate_lead`.
- **HubSpot:** código de seguimiento (tras consentimiento), envío del
  formulario por Forms API v3 con `hutk`, y agenda Meetings embebida bajo demanda.
- **Fuentes autoalojadas** (Bodoni Moda + Jost vía Fontsource): ninguna petición
  a Google Fonts.

## Arquitectura

```
site.config.mjs          configuración única
scripts/pages.mjs        genera un HTML estático por idioma + robots + sitemap
src/template.js          plantilla (todo el contenido está en el HTML: SEO)
src/i18n/{es,ca,en}.js   textos
src/anatomy-svg.js       plano técnico
src/main.js              arranque: scroll (Lenis), guion, WebGL progresivo
src/story.js             guion: scroll → cámara, escena y línea de agua
src/quality.js           niveles de calidad por dispositivo
src/gl/stage.js          lienzo WebGL, render targets, bucle
src/gl/sim.js            simulación GPU de la superficie (ecuación de onda)
src/gl/composite.js      paso final: línea de agua, bloom, tono, grano
src/gl/scenes/pool.js    piscina: superficie, refracción, cáusticas, Snell, partículas, burbujas
src/gl/scenes/arch.js    utilidades de maqueta (cielo, reflejos, agua, sombras)
src/gl/scenes/concepts.js  resort, residencia, piscina suspendida (carga diferida)
src/ui/*                 contacto, consentimiento, anatomía, indicador, sonido, tipografía cinética
```

### Rendimiento y accesibilidad

- WebGL se carga después del contenido (import dinámico) y las escenas
  arquitectónicas en un segundo chunk, precargadas antes de llegar a ellas.
- Niveles: 3 escritorio (MSAA, sombras 2048, simulación 256²), 2 móvil
  (simulación 128², sombras 1024), 1 equipos modestos (agua procedural),
  0 sin WebGL o ahorro de datos (agua estática en CSS/SVG). La resolución se
  adapta en tiempo real según los fotogramas medidos.
- `prefers-reduced-motion`: sin scroll suave, el salto se convierte en un
  fundido breve, sin movimientos de cámara continuos (cortes en lugar de
  barridos), sin animaciones de texto; las opciones se muestran como lista
  con imágenes.
- Todo el contenido es HTML semántico; el lienzo es decorativo (`aria-hidden`).
  Auditoría axe-core sin incidencias en ES, CA y EN.

## Contenido: hechos y conceptos

- Las **escenas 3D y los renders son conceptos** y así se indica en cada
  capítulo, junto a las opciones y en el pie. Los renders proceden del material
  gráfico de la web actual (`public/img/conceptos/`).
- Los datos de trayectoria (Astral/Fluidra, Mundial de Natación 2003 en el
  Palau Sant Jordi, Piscinas Condal, obra civil, registro de obras 2003‑2014)
  proceden de la documentación de la web actual. **Pendiente de verificación
  final por APEX**, en especial: papel exacto en cada obra del registro,
  nombre del hotel de Canillo y si alguna de esas obras debe omitirse.
- No hay testimonios, clientes ni cifras inventadas.

## Pendiente antes de producción

1. Confirmar portal de HubSpot y crear/indicar el formulario (`HUBSPOT_FORM_GUID`).
2. Facilitar el ID de GA4.
3. Textos legales completos (aviso legal, privacidad, cookies) con los datos
   societarios.
4. Validar los textos de trayectoria con Carlos Callealta.
5. Build con `SITE_URL` definitivo e `INDEXABLE=true`.
