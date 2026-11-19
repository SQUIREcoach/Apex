// Technical section drawing of a pool with infinity edge and plant room.
// Each group carries data-layer, matched to the legend in the page.
// Numbered callouts follow technical-drawing convention (drawing ↔ key).

const CALLOUTS = {
  estructura: [375, 300],
  impermeabilizacion: [520, 441],
  revestimiento: [842, 431],
  borde: [1006, 214],
  hidraulica: [610, 505],
  tratamiento: [125, 318],
  climatizacion: [175, 124],
  iluminacion: [948, 300],
  sala: [92, 468],
  mantenimiento: [272, 222],
};

export function anatomySvg(layers, title) {
  const num = (id) => layers.findIndex((l) => l[0] === id) + 1;
  const callout = (id) => {
    const [x, y] = CALLOUTS[id];
    return `<g class="callout" data-layer="${id}"><circle cx="${x}" cy="${y}" r="12"/><text x="${x}" y="${y + 4}" text-anchor="middle">${num(id)}</text></g>`;
  };
  return /* html */ `
<svg class="anatomy__svg" viewBox="0 0 1200 600" role="img" aria-labelledby="anatomy-svg-title">
  <title id="anatomy-svg-title">${title}</title>
  <defs>
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="9" class="hatch-line"/>
    </pattern>
    <pattern id="stipple" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="3" cy="4" r="0.9" class="stipple"/><circle cx="10" cy="10" r="0.7" class="stipple"/><circle cx="11" cy="3" r="0.5" class="stipple"/>
    </pattern>
    <linearGradient id="beam" x1="0" x2="-1" y1="0" y2="0.2">
      <stop offset="0" class="beam-a"/><stop offset="1" class="beam-b"/>
    </linearGradient>
    <clipPath id="waterClip"><rect x="399" y="150" width="582" height="282"/></clipPath>
  </defs>

  <!-- ground -->
  <rect x="0" y="200" width="1200" height="400" fill="url(#hatch)" class="ground"/>
  <line x1="0" y1="200" x2="1200" y2="200" class="ink ground-line"/>

  <g data-layer="estructura" class="layer">
    <path class="conc" fill-rule="evenodd" d="M360 200 H390 V440 H990 V212 H1020 V470 H360 Z"/>
    <path class="conc" d="M1020 212 H1036 V292 H1094 V200 H1110 V308 H1020 Z"/>
    <g class="rebar">
      ${Array.from({ length: 9 }, (_, i) => `<circle cx="375" cy="${222 + i * 26}" r="2"/>`).join('')}
      ${Array.from({ length: 22 }, (_, i) => `<circle cx="${400 + i * 27}" cy="455" r="2"/>`).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<circle cx="1005" cy="${232 + i * 26}" r="2"/>`).join('')}
    </g>
    <path class="ink" d="M360 200 V470 H1020 V212"/>
  </g>

  <g data-layer="impermeabilizacion" class="layer">
    <path class="ink membrane" d="M394 200 V436 H986 V214"/>
    <path class="ink membrane" d="M1040 214 V288 H1090 V204"/>
  </g>

  <g data-layer="revestimiento" class="layer">
    <path class="ink tiles" d="M399 204 V431 H981 V216"/>
  </g>

  <!-- water -->
  <g class="water-body" clip-path="url(#waterClip)">
    <path class="water" d="M399 214 Q 470 208 545 214 T 690 214 T 835 214 T 981 214 V431 H399 Z">
      <animate attributeName="d" dur="6s" repeatCount="indefinite"
        values="M399 214 Q 470 208 545 214 T 690 214 T 835 214 T 981 214 V431 H399 Z;
                M399 214 Q 470 220 545 214 T 690 214 T 835 214 T 981 214 V431 H399 Z;
                M399 214 Q 470 208 545 214 T 690 214 T 835 214 T 981 214 V431 H399 Z"/>
    </path>
  </g>
  <path class="water" d="M1040 270 H1090 V288 H1040 Z"/>

  <g data-layer="borde" class="layer">
    <rect class="stone" x="342" y="190" width="72" height="12"/>
    <path class="ink" d="M342 190 H414 V202 H342 Z"/>
    <path class="ink overflow" d="M981 214 C 995 213 1008 213 1020 216 C 1028 230 1032 250 1040 272"/>
    <rect class="stone" x="1094" y="190" width="106" height="12"/>
    <path class="ink" d="M1094 190 H1200 M1094 202 H1200"/>
    <path class="grate" d="M1036 204 H1094"/>
  </g>

  <g data-layer="iluminacion" class="layer">
    <polygon class="beam" points="984,312 984,348 760,420 720,250" fill="url(#beam)"/>
    <path class="ink lamp" d="M990 318 A 12 12 0 0 0 990 342 Z"/>
  </g>

  <g data-layer="hidraulica" class="layer">
    <path class="pipe" d="M690 440 V505 H300"/>
    <path class="pipe" d="M1065 308 V535 H300"/>
    <path class="pipe" d="M300 330 H394"/>
    <rect class="ink fitting" x="682" y="436" width="16" height="6"/>
    <path class="ink nozzle" d="M394 324 h8 v12 h-8"/>
    <g class="valve" transform="translate(520 505)"><path d="M-9 -7 L9 7 V-7 L-9 7 Z"/></g>
    <g class="valve" transform="translate(840 535)"><path d="M-9 -7 L9 7 V-7 L-9 7 Z"/></g>
    <circle class="ink pump" cx="205" cy="448" r="22"/>
    <path class="ink" d="M205 448 l14 -10 M205 448 l-6 17 M205 448 l-12 -9"/>
  </g>

  <g data-layer="tratamiento" class="layer">
    <rect class="ink equip" x="102" y="336" width="48" height="118" rx="24"/>
    <circle class="ink" cx="126" cy="350" r="6"/>
    <rect class="ink equip" x="238" y="322" width="44" height="16" rx="8"/>
    <rect class="ink equip" x="238" y="350" width="44" height="12" rx="6"/>
  </g>

  <g data-layer="climatizacion" class="layer">
    <rect class="ink equip" x="122" y="146" width="108" height="54"/>
    <circle class="ink" cx="160" cy="173" r="18"/>
    <path class="ink" d="M160 155 V191 M142 173 H178"/>
    <path class="pipe thin" d="M206 200 V300 H238 M220 200 V290 H300"/>
  </g>

  <g data-layer="sala" class="layer">
    <path class="ink wall" d="M60 240 H300 V490 H60 Z"/>
    <rect class="stone" x="54" y="232" width="252" height="10"/>
    <rect class="ink equip" x="66" y="262" width="26" height="40"/>
    <path class="ink" d="M72 272 H86 M72 280 H86 M72 288 H80"/>
  </g>

  <g data-layer="mantenimiento" class="layer">
    <path class="ink" d="M252 200 V240 M292 200 V240"/>
    <rect class="stone" x="248" y="194" width="48" height="7"/>
    <path class="ink ladder" d="M262 240 V488 M282 240 V488 ${Array.from({ length: 10 }, (_, i) => `M262 ${258 + i * 23} H282`).join(' ')}"/>
  </g>

  <g class="callouts">
    ${Object.keys(CALLOUTS).map(callout).join('')}
  </g>
</svg>`;
}
