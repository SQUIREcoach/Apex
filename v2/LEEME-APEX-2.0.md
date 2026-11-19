# APEX Piscinas 2.0: entorno de pruebas

Esta carpeta `v2/` contiene la nueva home. Es independiente: no toca ningún archivo de la web actual ni la rama `main`.
Mientras tanto, enlaza con las páginas actuales (`../Construir.dc.html`, etc.) para conservar todas las rutas.

Vista local: `python3 -m http.server` en la raíz del repositorio y abrir `/v2/`.

## Tres direcciones creativas

**A · Inmersión (la que se ha desarrollado)**
La página es un descenso. Se empieza en la superficie, con luz y blanco cálido, y se termina en el fondo, en azul marino, donde está el contacto.
Un medidor de profundidad (0,00 m → 2,20 m) sirve de navegación. El agua es el lenguaje visual: refracción en la foto principal, ondas al pasar el cursor y cáusticas.
Referentes: la narrativa de scroll de Awwwards y la calma de Aman.

**B · Arquitectura del silencio**
Una home editorial y casi estática, con mucho espacio en blanco, fotografía a sangre y tipografía de revista de arquitectura. Se apoya en materiales, luz y silencio.
Referentes: Aman y los estudios de arquitectura.
Riesgo: sin fotografía propia de obras reales de gran calidad, se queda corta.

**C · Ingeniería visible**
Precisión técnica al estilo Porsche o Bang & Olufsen: vistas explosionadas del cuarto técnico, fichas como especificaciones y el diagnóstico como producto central.
Transmite mucha solvencia técnica, pero menos deseo.

Se eligió A porque es la única que convierte el agua en identidad de marca y además incorpora lo mejor de B (sobriedad editorial) y de C (diagnóstico y proceso técnico).

## Qué incluye la home 2.0

| Bloque | Para qué sirve |
| --- | --- |
| Superficie (WebGL) | La foto respira como agua. Al bajar, la imagen se hunde y se tiñe de azul: es la entrada en la experiencia. |
| Medidor de profundidad | Navegación lateral memorable, con la profundidad también visible en la cabecera. |
| Caminos | 4 situaciones; en escritorio, la foto sigue al cursor. Mantenimiento y Wellness como accesos secundarios. |
| Diagnóstico orientativo | 16 síntomas (agua e instalación), con los textos reales de Agua y MiPiscina. «Contar mi caso» lleva al formulario ya en el paso 2. |
| Laboratorio de agua | Simulador: 6 revestimientos × 3 luces (mediodía, atardecer, noche con focos) × estado del agua (equilibrada → turbia → verde). Se avisa de que es orientativo. |
| Proceso | Sección constructiva en SVG que avanza con las 5 fases reales de Construir: idea, estudio, diseño, obra y llenado. |
| Carlos | Bloque editorial solo con datos confirmados. |
| Criterio, preguntas frecuentes, zonas, contacto | Contenido actual reordenado. El formulario de 5 pasos guarda cada paso. |

Técnica: HTML, CSS y JS sin dependencias; imágenes en WebP (de 30 a 160 KB). Se respeta `prefers-reduced-motion`, la animación se pausa fuera de pantalla y hay alternativa si no hay WebGL. Diseño pensado primero para móvil, con barra fija de «Llamar / Agendar visita», sin desbordamiento horizontal y con datos estructurados LocalBusiness.

## Pendiente de APEX antes de publicar (no se ha inventado nada)

1. **HubSpot**: rellenar `portalId` y `formId` en `APEX_CONFIG` (`v2.js`) y revisar los nombres de las propiedades. El repositorio no contiene ningún identificador real de HubSpot. Las fotos del formulario requieren un endpoint en servidor para poder enviarse.
2. **Analítica**: el repositorio no contiene ninguna etiqueta (GA4, GTM o Meta). Hay que incorporarla desde donde esté configurada en producción.
3. **Idiomas**: el selector ES/CA/EN de la web actual no tiene traducciones detrás. La 2.0 se ha hecho solo en castellano; las versiones CA y EN quedan por traducir.
4. **Datos contradictorios en la web actual**: «+450 piscinas construidas» frente a «[—]»; «10 años de garantía estructural» frente a «Pendiente de confirmar»; «−80 % de consumo» en bombas. En la 2.0 se han omitido o suavizado hasta que se confirmen.
5. **Carlos**: falta su origen en el oficio y una cita suya. Hay un hueco marcado en el HTML.
6. **Opiniones de clientes**: en la web actual son marcadores vacíos. No se muestran hasta tener las reseñas reales de Google.
7. **Fotografías**: varias imágenes parecen generadas o repiten la misma escena (por ejemplo, las de obra y reforma). Por eso no se ha construido el comparador antes/después con ellas. En cuanto haya pares reales de una misma obra, se añade.
8. Al publicar, quitar `<meta name="robots" content="noindex">`.
