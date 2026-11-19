// Device capability tiers. The visual experience degrades gracefully:
//   0  no WebGL (or data saver)      → CSS/SVG water, all content intact
//   1  modest devices                 → procedural water, no shadows, few effects
//   2  capable phones / tablets       → simulation, shadows, reduced resolution
//   3  desktops                       → everything, MSAA, higher resolution
// The stage also adapts its pixel ratio at runtime from measured frame times.

export function detectQuality() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('q');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;

  let gl2 = null;
  try {
    const c = document.createElement('canvas');
    gl2 = c.getContext('webgl2', { failIfMajorPerformanceCaveat: forced ? false : true });
  } catch (e) {
    gl2 = null;
  }

  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;

  let tier = 3;
  if (!gl2 || saveData) tier = 0;
  else if (mem <= 2 || cores <= 2) tier = 1;
  else if (coarse || small) tier = 2;

  let floatRT = false;
  if (gl2) {
    floatRT = !!(gl2.getExtension('EXT_color_buffer_half_float') || gl2.getExtension('EXT_color_buffer_float'));
    const lose = gl2.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }
  if (tier > 0 && !floatRT) tier = 1;
  if (forced !== null && forced !== '') tier = Math.max(0, Math.min(3, parseInt(forced, 10) || 0));

  const presets = {
    0: {},
    1: { sim: false, simSize: 0, dust: 500, shadows: false, shadowSize: 0, msaa: 0, dprCap: 1, rtScale: 0.75, bloom: 0.0 },
    2: { sim: true, simSize: 128, dust: 1100, shadows: true, shadowSize: 1024, msaa: 0, dprCap: 1.5, rtScale: 0.85, bloom: 0.45 },
    3: { sim: true, simSize: 256, dust: 2200, shadows: true, shadowSize: 2048, msaa: 4, dprCap: 1.75, rtScale: 1, bloom: 0.6 },
  };
  return {
    tier,
    webgl: tier > 0,
    motion: !reduced,
    reduced,
    adaptive: tier > 0 && !params.has('fixed'),
    ...presets[tier],
  };
}
