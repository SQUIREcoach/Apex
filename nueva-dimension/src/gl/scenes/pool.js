import * as THREE from 'three';
import { BRAND, NOISE, WAVES, CAUSTICS, SKY } from '../glsl/common.js';
import { WaterSim } from '../sim.js';
import markUrl from '../mark-texture.png';

// The signature environment: an infinity-edge pool at dusk, open to the sea.
// The same scene is seen from above (hero, final conversation) and from inside
// (immersion, trajectory). Light, refraction and caustics are computed
// analytically in the shaders; ripples come from the GPU simulation.

const DEPTH = 2.8; // pool depth (m)
const EDGE_Z = -34; // infinity edge
const SEA_Y = -42; // sea level far below the terrace

const COMMON = BRAND + NOISE + WAVES + CAUSTICS + SKY;

const POOL_UNIFORMS = () => ({
  uTime: { value: 0 },
  uCam: { value: new THREE.Vector3() },
  uUnder: { value: 0 },
  uSunDir: { value: new THREE.Vector3(-0.42, -0.02, -1).normalize() },
  uDepth: { value: DEPTH },
  uEdgeZ: { value: EDGE_Z },
  uSeaY: { value: SEA_Y },
  tSim: { value: null },
  uSimRect: { value: new THREE.Vector4(0, 0, 1, 0) },
  tMark: { value: null },
  uMarkRect: { value: new THREE.Vector4(0, -9.5, 4.6, 3.49) },
  uWaveAmp: { value: 1 },
  uCaustic: { value: 1 },
  uFog: { value: 0.085 },
  uGlow: { value: 1 },
});

// Pool floor, shared by the refraction ray (seen from above) and the floor mesh
// (seen from inside the water).
const FLOOR = /* glsl */ `
uniform sampler2D tMark;
uniform vec4 uMarkRect;
uniform float uCaustic;
uniform float uGlow;
vec3 floorRadiance(vec2 xz, vec2 surfG, float t){
  vec2 s = xz / vec2(1.8, 0.9);
  vec2 id = floor(s);
  vec2 f = fract(s);
  vec2 m = min(f, 1.0 - f) * vec2(1.8, 0.9);
  float joint = 1.0 - smoothstep(0.004, 0.016, min(m.x, m.y));
  float var = hash12(id) * 0.35 + fbm(xz * 0.9) * 0.3;
  vec3 alb = vec3(0.028, 0.050, 0.082) * (0.75 + var);
  alb = mix(alb, vec3(0.06, 0.08, 0.10), joint * 0.7);

  vec2 muv = (xz - uMarkRect.xy) / (uMarkRect.zw * 2.0) + 0.5;
  muv.y = 1.0 - muv.y;
  vec4 mk = vec4(0.0);
  if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) mk = texture2D(tMark, muv);
  vec3 inlay = pow(mk.rgb, vec3(2.2));
  float gold = smoothstep(0.05, 0.25, mk.r - mk.b);

  // dusk ambient + caustic light focused by the surface above
  float c = caustics(xz * 0.62 + surfG * 2.2, t * 0.55);
  vec3 light = vec3(0.10, 0.16, 0.22) * 0.55 + vec3(1.0, 0.90, 0.74) * c * 1.35 * uCaustic;
  vec3 col = alb * light;
  // inlaid metal catches more light and glows faintly, as brass under water does
  col = mix(col, inlay * (light * 1.15 + 0.05 * uGlow) + CHAMPAGNE * gold * (0.35 + 0.5 * c) * uGlow, mk.a);
  return col;
}
`;

const VERT_WORLD = /* glsl */ `
varying vec3 vWorld;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// ---------------------------------------------------------------------------
// Background dome: sky + distant sea from above, water volume from below.
const BG_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform vec3 uCam;
uniform float uUnder;
uniform float uTime;
uniform float uSeaY;
uniform float uWaveAmp;
varying vec3 vWorld;

vec3 underFog(vec3 d){
  vec3 deep = vec3(0.0008, 0.0050, 0.0140);
  vec3 mid = vec3(0.0030, 0.0190, 0.0420);
  vec3 up = vec3(0.012, 0.058, 0.092);
  return d.y < 0.0 ? mix(mid, deep, clamp(-d.y * 1.6, 0.0, 1.0)) : mix(mid, up, pow(clamp(d.y, 0.0, 1.0), 0.8));
}

void main(){
  vec3 d = normalize(vWorld - uCam);
  if (uUnder > 0.5){
    gl_FragColor = vec4(underFog(d), 1.0);
    return;
  }
  vec3 col = skyColor(d);
  if (d.y < 0.0){
    // distant sea below the terrace
    float t = (uSeaY - uCam.y) / d.y;
    vec3 p = uCam + d * t;
    vec2 g = waveGrad(p.xz * 0.12, uTime * 0.6, 1.0) * 3.0;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    float cosv = max(dot(-d, n), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
    vec3 r = reflect(d, n); r.y = abs(r.y);
    vec3 sea = mix(vec3(0.0012, 0.0070, 0.0170), skyColor(r), F);
    float fogT = 1.0 - exp(-t * 0.0022);
    col = mix(sea, skyColor(vec3(d.x, 0.0, d.z)), fogT);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Water surface, seen from either side.
const WATER_FRAG = /* glsl */ `
precision highp float;
${COMMON}
${FLOOR}
uniform vec3 uCam;
uniform float uUnder;
uniform float uTime;
uniform float uDepth;
uniform float uEdgeZ;
uniform float uWaveAmp;
uniform float uFog;
uniform sampler2D tSim;
uniform vec4 uSimRect;
varying vec3 vWorld;

vec2 surfaceGrad(vec2 xz){
  vec2 g = waveGrad(xz, uTime, uWaveAmp);
  if (uSimRect.w > 0.5){
    vec2 suv = (xz - uSimRect.xy) / uSimRect.z;
    if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) g += texture2D(tSim, suv).ba;
  }
  return g;
}

vec3 underFog(vec3 d){
  vec3 deep = vec3(0.0008, 0.0050, 0.0140);
  vec3 mid = vec3(0.0030, 0.0190, 0.0420);
  vec3 up = vec3(0.012, 0.058, 0.092);
  return d.y < 0.0 ? mix(mid, deep, clamp(-d.y * 1.6, 0.0, 1.0)) : mix(mid, up, pow(clamp(d.y, 0.0, 1.0), 0.8));
}

void main(){
  vec2 g = surfaceGrad(vWorld.xz);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(vWorld - uCam);
  float dist = length(vWorld - uCam);
  vec3 col;

  if (uUnder < 0.5){
    // ---- seen from above -------------------------------------------------
    float cosv = max(dot(-V, n), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
    vec3 R = reflect(V, n);
    R.y = abs(R.y);
    vec3 refl = skyColor(R);

    vec3 T = refract(V, n, 1.0 / 1.333);
    float tt = (-uDepth - vWorld.y) / min(T.y, -0.05);
    vec3 hit = vWorld + T * tt;
    vec3 bottom;
    if (hit.z < uEdgeZ){
      // back wall of the infinity edge
      float tw = (uEdgeZ - vWorld.z) / min(T.z, -0.001);
      tt = tw;
      bottom = vec3(0.004, 0.012, 0.024);
    } else {
      bottom = floorRadiance(hit.xz, g, uTime);
    }
    vec3 absorb = vec3(0.20, 0.12, 0.09);
    vec3 trans = exp(-absorb * (tt + uDepth * 0.6));
    vec3 scatter = vec3(0.0025, 0.016, 0.034);
    vec3 refr = bottom * trans + scatter * (1.0 - trans);

    col = mix(refr, refl, F);

    // the water sheet spilling over the infinity edge catches the last light
    float lip = exp(-max(vWorld.z - uEdgeZ, 0.0) * 6.0);
    col += CHAMPAGNE * lip * 0.05 * (0.6 + 0.4 * sin(vWorld.x * 0.7 + uTime));
    col += IVORY * exp(-max(vWorld.z - uEdgeZ, 0.0) * 30.0) * 0.03;

    // aerial perspective
    float fogT = 1.0 - exp(-dist * 0.010);
    col = mix(col, skyColor(vec3(V.x, 0.0, V.z)) * 0.9, fogT * 0.55);
  } else {
    // ---- seen from inside the water ---------------------------------------
    vec3 nd = -n;
    vec3 T = refract(V, nd, 1.333);
    float cosi = max(dot(-V, nd), 0.0);
    vec3 below = underFog(reflect(V, nd)) * 1.25;
    if (dot(T, T) < 1e-4){
      // total internal reflection: the surface becomes a dark, moving mirror
      col = below;
    } else {
      float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
      vec3 sky = skyColor(T);
      // Snell's window: the sky compressed into a luminous circle
      vec3 window = sky * 3.4 + vec3(0.06, 0.10, 0.13) * pow(max(T.y, 0.0), 2.0) + CHAMPAGNE * 0.03;
      col = mix(window, below, F);
      // bright rim at the edge of the window
      col += vec3(0.25, 0.35, 0.40) * smoothstep(0.6, 0.98, 1.0 - cosi) * (1.0 - F) * 0.5;
    }
    col = mix(underFog(V), col, exp(-dist * uFog));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Pool floor and back wall, only drawn when the camera is inside the water.
const FLOOR_FRAG = /* glsl */ `
precision highp float;
${COMMON}
${FLOOR}
uniform vec3 uCam;
uniform float uTime;
uniform float uFog;
uniform float uWaveAmp;
uniform sampler2D tSim;
uniform vec4 uSimRect;
varying vec3 vWorld;
vec3 underFog(vec3 d){
  vec3 deep = vec3(0.0008, 0.0050, 0.0140);
  vec3 mid = vec3(0.0030, 0.0190, 0.0420);
  vec3 up = vec3(0.012, 0.058, 0.092);
  return d.y < 0.0 ? mix(mid, deep, clamp(-d.y * 1.6, 0.0, 1.0)) : mix(mid, up, pow(clamp(d.y, 0.0, 1.0), 0.8));
}
void main(){
  vec2 g = waveGrad(vWorld.xz, uTime, uWaveAmp);
  if (uSimRect.w > 0.5){
    vec2 suv = (vWorld.xz - uSimRect.xy) / uSimRect.z;
    if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) g += texture2D(tSim, suv).ba;
  }
  vec3 col = floorRadiance(vWorld.xz, g, uTime) * 1.15;
  vec3 V = normalize(vWorld - uCam);
  float dist = length(vWorld - uCam);
  col = mix(underFog(V), col, exp(-dist * uFog));
  gl_FragColor = vec4(col, 1.0);
}
`;

const WALL_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform vec3 uCam;
uniform float uTime;
uniform float uFog;
varying vec3 vWorld;
void main(){
  vec3 V = normalize(vWorld - uCam);
  float dist = length(vWorld - uCam);
  float c = caustics(vWorld.xy * 0.7, uTime * 0.5) * smoothstep(-2.8, 0.0, vWorld.y);
  vec3 col = vec3(0.004, 0.014, 0.028) + vec3(0.6, 0.55, 0.45) * c * 0.04;
  vec3 mid = vec3(0.0030, 0.0190, 0.0420);
  col = mix(mid, col, exp(-dist * uFog));
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Light shafts under the surface.
const SHAFT_VERT = /* glsl */ `
attribute vec4 aShaft; // x, z, width, seed
uniform vec3 uCam;
uniform float uDepth;
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vDist;
varying float vY;
void main(){
  vec3 base = vec3(aShaft.x, 0.0, aShaft.y);
  vec3 toCam = uCam - base; toCam.y = 0.0;
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + 1e-4)));
  float slant = 0.9;
  float y = -position.y * (uDepth + 0.2);
  vec3 p = base + side * position.x * aShaft.z + vec3(slant * y * -0.4, y, slant * y * -0.6);
  vUv = vec2(position.x + 0.5, position.y);
  vSeed = aShaft.w;
  vDist = length(p - uCam);
  vY = y;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const SHAFT_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uFog;
uniform float uIntensity;
varying vec2 vUv;
varying float vSeed;
varying float vDist;
varying float vY;
void main(){
  float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
  float along = smoothstep(0.0, 0.06, vUv.y) * pow(1.0 - vUv.y, 1.6);
  float flick = 0.55 + 0.45 * sin(uTime * (0.6 + vSeed * 0.9) + vSeed * 40.0);
  float a = across * across * along * flick * exp(-vDist * uFog * 0.9) * uIntensity;
  gl_FragColor = vec4(vec3(0.55, 0.70, 0.78) * a * 0.075, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Suspended particles with a depth-of-field approximation.
const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform vec3 uCam;
uniform float uTime;
uniform float uDepth;
uniform float uPx;
uniform float uFocus;
varying float vAlpha;
varying float vCoc;
void main(){
  vec3 box = vec3(14.0, uDepth, 14.0);
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aSeed * 12.0) * 0.25;
  p.z += cos(uTime * 0.09 + aSeed * 7.0) * 0.25;
  p.y += sin(uTime * 0.07 + aSeed * 3.0) * 0.1 + uTime * 0.012 * (aSeed - 0.3);
  vec3 c = vec3(uCam.x, -uDepth * 0.5, uCam.z);
  p.xz = mod(p.xz - c.xz + box.xz * 0.5, box.xz) - box.xz * 0.5 + c.xz;
  p.y = mod(p.y + uDepth, uDepth) - uDepth;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float coc = clamp(abs(dist - uFocus) * 0.55, 0.0, 4.0);
  vCoc = coc;
  gl_PointSize = min((0.0025 + aSeed * 0.0045) * (1.0 + coc * 2.4) * uPx / max(dist, 0.4), 90.0);
  vAlpha = (0.35 + 0.65 * aSeed) / (1.0 + coc * coc * 1.6) * exp(-dist * 0.07);
  gl_Position = projectionMatrix * mv;
}
`;
const DUST_FRAG = /* glsl */ `
precision highp float;
uniform float uIntensity;
varying float vAlpha;
varying float vCoc;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float soft = mix(0.12, 0.42, clamp(vCoc / 3.0, 0.0, 1.0));
  float a = smoothstep(0.5, 0.5 - soft, r) * vAlpha * uIntensity;
  gl_FragColor = vec4(vec3(0.75, 0.80, 0.78) * a * 0.55, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Bubbles released by the cursor under water.
const BUBBLE_VERT = /* glsl */ `
attribute float aSize;
attribute float aLife;
uniform float uPx;
varying float vLife;
void main(){
  vec4 mv = viewMatrix * vec4(position, 1.0);
  float dist = -mv.z;
  vLife = aLife;
  gl_PointSize = min(aSize * uPx / max(dist, 0.3), 110.0);
  gl_Position = projectionMatrix * mv;
}
`;
const BUBBLE_FRAG = /* glsl */ `
precision highp float;
varying float vLife;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0 || vLife <= 0.0) discard;
  float rim = smoothstep(0.62, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
  float hi = smoothstep(0.28, 0.0, length(c - vec2(-0.16, 0.16)));
  float a = (rim * 0.55 + hi * 0.9 + 0.04) * clamp(vLife * 3.0, 0.0, 1.0);
  gl_FragColor = vec4(vec3(0.80, 0.90, 0.95) * a * 0.6, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Windows of light suspended in the water: the options, showing the worlds
// (conceptual renders) seen through the water, with caustics playing on them.
const WIN_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const WIN_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tImg;
uniform vec3 uCam;
uniform float uTime;
uniform float uFog;
uniform float uAlpha;
uniform float uSeed;
uniform float uAspect;
uniform float uHover;
varying vec2 vUv;
varying vec3 vWorld;
vec3 underFog(vec3 d){
  vec3 deep = vec3(0.0008, 0.0050, 0.0140);
  vec3 mid = vec3(0.0030, 0.0190, 0.0420);
  vec3 up = vec3(0.012, 0.058, 0.092);
  return d.y < 0.0 ? mix(mid, deep, clamp(-d.y * 1.6, 0.0, 1.0)) : mix(mid, up, pow(clamp(d.y, 0.0, 1.0), 0.8));
}
void main(){
  vec2 w = vec2(vnoise(vUv * 5.0 + uTime * 0.45 + uSeed), vnoise(vUv * 5.0 + 3.7 - uTime * 0.4)) - 0.5;
  vec2 uv = vUv + w * (0.014 - uHover * 0.008);
  vec3 img = texture2D(tImg, uv).rgb;
  // seen through water: a little absorption of red, caustic light dancing on it
  img *= vec3(0.80, 0.94, 1.0);
  float c = caustics(vWorld.xy * 1.3 + uSeed, uTime * 0.6);
  img *= 0.78 + c * 0.42;
  vec2 e = min(vUv, 1.0 - vUv) * vec2(uAspect, 1.0);
  float edge = 1.0 - smoothstep(0.0, 0.010 + uHover * 0.006, min(e.x, e.y));
  vec3 col = mix(img, CHAMPAGNE * (2.0 + uHover * 2.0), edge * 0.85);
  float dist = length(vWorld - uCam);
  col = mix(underFog(normalize(vWorld - uCam)), col, exp(-dist * uFog * 0.9));
  gl_FragColor = vec4(col, uAlpha);
}
`;

export class PoolScene {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 900);
    this.uniforms = POOL_UNIFORMS();
    this.under = false;
    this.time = 0;
    this.pointer = { active: false, ndc: new THREE.Vector2(), moved: 0, lastWorld: null };
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ambientTimer = 0;
    this.calm = 0;

    const tex = new THREE.TextureLoader().load(markUrl);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.uniforms.tMark.value = tex;

    if (quality.sim) {
      this.sim = new WaterSim(renderer, {
        size: quality.simSize,
        worldSize: 20,
        center: new THREE.Vector2(0, -7),
      });
      this.uniforms.tSim.value = this.sim.texture;
      this.uniforms.uSimRect.value.copy(this.sim.rect);
    }

    const U = this.uniforms;

    // background dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(600, 48, 24),
      new THREE.ShaderMaterial({
        vertexShader: VERT_WORLD,
        fragmentShader: BG_FRAG,
        uniforms: U,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.dome = dome;
    this.scene.add(dome);

    // water surface: from far behind the camera to the infinity edge
    const wGeo = new THREE.PlaneGeometry(260, 34 - EDGE_Z + 0.0, 1, 1);
    wGeo.rotateX(-Math.PI / 2);
    wGeo.translate(0, 0, (34 + EDGE_Z) / 2);
    this.water = new THREE.Mesh(
      wGeo,
      new THREE.ShaderMaterial({
        vertexShader: VERT_WORLD,
        fragmentShader: WATER_FRAG,
        uniforms: U,
        side: THREE.DoubleSide,
      }),
    );
    this.water.frustumCulled = false;
    this.scene.add(this.water);

    // floor + back wall (inside view)
    const fGeo = new THREE.PlaneGeometry(260, 34 - EDGE_Z, 1, 1);
    fGeo.rotateX(-Math.PI / 2);
    fGeo.translate(0, -DEPTH, (34 + EDGE_Z) / 2);
    this.floor = new THREE.Mesh(
      fGeo,
      new THREE.ShaderMaterial({ vertexShader: VERT_WORLD, fragmentShader: FLOOR_FRAG, uniforms: U }),
    );
    this.floor.frustumCulled = false;
    this.scene.add(this.floor);

    const wallGeo = new THREE.PlaneGeometry(260, DEPTH);
    wallGeo.translate(0, -DEPTH / 2, EDGE_Z);
    this.wall = new THREE.Mesh(
      wallGeo,
      new THREE.ShaderMaterial({ vertexShader: VERT_WORLD, fragmentShader: WALL_FRAG, uniforms: U }),
    );
    this.scene.add(this.wall);

    // light shafts
    const shaftCount = quality.tier >= 3 ? 26 : quality.tier === 2 ? 16 : 0;
    if (shaftCount) {
      const base = new THREE.PlaneGeometry(1, 1, 1, 1);
      base.translate(0, 0.5, 0);
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = base.index;
      geo.attributes.position = base.attributes.position;
      geo.attributes.uv = base.attributes.uv;
      const data = new Float32Array(shaftCount * 4);
      for (let i = 0; i < shaftCount; i++) {
        data[i * 4] = (Math.random() - 0.5) * 16;
        data[i * 4 + 1] = -2 - Math.random() * 16;
        data[i * 4 + 2] = 0.08 + Math.random() * Math.random() * 0.9;
        data[i * 4 + 3] = Math.random();
      }
      geo.setAttribute('aShaft', new THREE.InstancedBufferAttribute(data, 4));
      geo.instanceCount = shaftCount;
      this.shaftUniforms = { ...U, uIntensity: { value: 1 } };
      this.shafts = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: SHAFT_VERT,
          fragmentShader: SHAFT_FRAG,
          uniforms: this.shaftUniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      this.shafts.frustumCulled = false;
      this.scene.add(this.shafts);
    }

    // suspended particles
    const dustCount = quality.dust;
    if (dustCount) {
      const pos = new Float32Array(dustCount * 3);
      const seed = new Float32Array(dustCount);
      for (let i = 0; i < dustCount; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 14;
        pos[i * 3 + 1] = -Math.random() * DEPTH;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 14;
        seed[i] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      this.dustUniforms = {
        ...U,
        uPx: { value: 300 },
        uFocus: { value: 3.2 },
        uIntensity: { value: 1 },
      };
      this.dust = new THREE.Points(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: DUST_VERT,
          fragmentShader: DUST_FRAG,
          uniforms: this.dustUniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      this.dust.frustumCulled = false;
      this.scene.add(this.dust);
    }

    // bubbles
    this.bubbleMax = 460;
    this.bubbles = [];
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.bubbleMax * 3), 3));
    bGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.bubbleMax), 1));
    bGeo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(this.bubbleMax), 1));
    this.bubbleUniforms = { uPx: { value: 300 } };
    this.bubblePoints = new THREE.Points(
      bGeo,
      new THREE.ShaderMaterial({
        vertexShader: BUBBLE_VERT,
        fragmentShader: BUBBLE_FRAG,
        uniforms: this.bubbleUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.bubblePoints.frustumCulled = false;
    this.scene.add(this.bubblePoints);

    this._tmpV = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this.windows = [];
    this.winEmerge = 0;
    this.winPass = 0;
    this.winRects = [];
  }

  /** Builds the option windows from image URLs (the renders). */
  setWindowImages(urls) {
    if (this.windows.length) return;
    const loader = new THREE.TextureLoader();
    const geo = new THREE.PlaneGeometry(1, 1);
    urls.forEach((url, i) => {
      const tex = loader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const u = {
        ...this.uniforms,
        tImg: { value: tex },
        uAlpha: { value: 0 },
        uSeed: { value: i * 3.17 },
        uAspect: { value: 16 / 9 },
        uHover: { value: 0 },
      };
      const m = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: WIN_VERT,
          fragmentShader: WIN_FRAG,
          uniforms: u,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.renderOrder = 3;
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this.windows.push({ mesh: m, u, hover: 0, hoverTarget: 0 });
    });
  }

  setWindows(w) {
    this.winEmerge = w ? w.emerge : 0;
    this.winPass = w ? w.pass : 0;
  }

  hoverWindow(i, on) {
    const w = this.windows[i];
    if (!w) return;
    w.hoverTarget = on ? 1 : 0;
    if (on) {
      const p = w.mesh.position;
      for (let k = 0; k < 14; k++) {
        this.emitBubbles(new THREE.Vector3(p.x + (Math.random() - 0.5) * w.mesh.scale.x, p.y - w.mesh.scale.y * 0.5, p.z), 1);
      }
    }
  }

  _layoutWindows(dt) {
    const n = this.windows.length;
    if (!n) return;
    const wide = this.camera.aspect >= 1;
    const e = this.winEmerge;
    const pass = this.winPass;
    const ease = (t) => t * t * (3 - 2 * t);
    // size the arrangement to the visible width at the windows' distance
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.baseFov || 42) / 2);
    const halfW = tanV * this.camera.aspect * 3.4;
    // portrait: a column kept between the line at the top and the links below
    const colW = Math.min(halfW * 1.25, 1.2, ((tanV * 3.4 * 2 * 0.56) / 3 - 0.12) * (16 / 9));
    const colStep = colW / (16 / 9) + 0.12;
    for (let i = 0; i < n; i++) {
      const W = this.windows[i];
      const m = W.mesh;
      const ei = ease(Math.min(1, Math.max(0, e * 1.7 - i * 0.35)));
      const k = 1 - ei;
      const base = wide
        ? { x: (i - 1) * halfW * 0.66, y: -1.1, z: -3.0, w: halfW * 0.56 }
        : { x: 0, y: -1.15 + (1 - i) * colStep, z: -3.0, w: colW };
      W.hover += (W.hoverTarget - W.hover) * Math.min(1, dt * 6);
      const bob = Math.sin(this.time * 0.6 + i * 2.1) * 0.035;
      m.position.set(base.x * (1 + pass * 1.7), base.y - k * 0.8 + bob, base.z - k * k * 11 + pass * 4.4);
      const s = base.w * (1 + W.hover * 0.04);
      m.scale.set(s, s / (16 / 9), 1);
      m.lookAt(base.x * 0.35, -1.25, 2.2);
      const alpha = Math.pow(ei, 1.4) * (1 - Math.min(1, Math.max(0, (pass - 0.55) / 0.45)));
      W.u.uAlpha.value = alpha;
      W.u.uHover.value = W.hover;
      m.visible = alpha > 0.003;
      // rising bubbles while a window surfaces from the depth
      if (ei > 0.05 && ei < 0.95 && Math.random() < 0.25) {
        this.emitBubbles(new THREE.Vector3(m.position.x + (Math.random() - 0.5) * s, m.position.y - s * 0.28, m.position.z), 1);
      }
      W.alpha = alpha;
    }
  }

  /** Screen rectangles of the windows (CSS px), for the clickable labels. */
  computeWindowRects(w, h) {
    const out = [];
    const v = this._tmpV;
    for (const W of this.windows) {
      if (!this.under || !W.mesh.visible) {
        out.push(null);
        continue;
      }
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity,
        behind = false;
      for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        v.set(cx, cy, 0).applyMatrix4(W.mesh.matrixWorld).project(this.camera);
        if (v.z > 1) behind = true;
        const sx = ((v.x + 1) / 2) * w;
        const sy = ((1 - v.y) / 2) * h;
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy);
        y1 = Math.max(y1, sy);
      }
      out.push(behind ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0, a: W.alpha });
    }
    this.winRects = out;
    return out;
  }

  /** The moment of impact: a crown of ripples and a cloud of bubbles. */
  plungeSplash() {
    const c = this.camera.position;
    if (this.sim) {
      this.sim.dropAt(c.x, c.z - 0.5, 1.1, 0.09);
      for (let k = 0; k < 7; k++) {
        this.sim.dropAt(c.x + (Math.random() - 0.5) * 1.8, c.z - 0.5 + (Math.random() - 0.5) * 1.8, 0.4, 0.03);
      }
    }
    for (let i = 0; i < 300; i++) {
      if (this.bubbles.length >= this.bubbleMax) this.bubbles.shift();
      // a column of air dragged down by the body, kept clear of the lens
      const ang = Math.random() * Math.PI * 2;
      const rad = 0.45 + Math.pow(Math.random(), 0.7) * 1.6;
      this.bubbles.push({
        x: c.x + Math.cos(ang) * rad,
        y: -0.15 - Math.random() * 2.0,
        z: c.z - 0.9 + Math.sin(ang) * rad - Math.random() * 1.4,
        vy: 0.5 + Math.random() * 1.5,
        size: 0.004 + Math.pow(Math.random(), 3) * 0.028,
        ph: Math.random() * 6.28,
        life: 1,
      });
    }
  }

  resize(w, h, pxScale) {
    this.camera.aspect = w / h;
    this.baseFov = w / h < 0.8 ? 62 : w / h < 1.2 ? 52 : 42;
    this.camera.updateProjectionMatrix();
    this.viewH = h * pxScale;
  }

  /** pose: {pos:[x,y,z], tgt:[x,y,z], fov?, calm?} */
  setPose(pose, parallax) {
    const c = this.camera;
    c.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    this._look.set(pose.tgt[0], pose.tgt[1], pose.tgt[2]);
    if (parallax) {
      c.position.x += parallax.x * 0.35;
      c.position.y += parallax.y * 0.12 * (Math.abs(pose.pos[1]) > 0.4 ? 1 : 0);
      this._look.x += parallax.x * 0.6;
    }
    c.up.set(0, 1, 0);
    c.lookAt(this._look);
    if (pose.roll) c.rotateZ(pose.roll);
    const fov = (pose.fov || 0) + this.baseFov;
    if (Math.abs(c.fov - fov) > 0.01) {
      c.fov = fov;
      c.updateProjectionMatrix();
    }
    this.calm = pose.calm || 0;
  }

  /** Force the camera to one side of the surface (used while crossing it). */
  setSide(under) {
    this.under = under;
    const y = this.camera.position.y;
    if (under && y > -0.04) this.camera.position.y = -0.04;
    if (!under && y < 0.04) this.camera.position.y = 0.04;
    this.camera.updateMatrixWorld();
  }

  pointerMove(ndcX, ndcY) {
    this.pointer.ndc.set(ndcX, ndcY);
    this.pointer.active = true;
    this.pointer.moved += 1;
  }

  _pointerWorld() {
    this.raycaster.setFromCamera(this.pointer.ndc, this.camera);
    if (!this.under) {
      const hit = this.raycaster.ray.intersectPlane(this.plane, this._tmpV);
      return hit ? hit.clone() : null;
    }
    return this.raycaster.ray.at(2.6, this._tmpV).clone();
  }

  ripple(strength = 1) {
    // a centred ripple, used when the visitor hovers a contact action
    if (!this.sim) return;
    const p = this._pointerWorld();
    if (p) this.sim.dropAt(p.x, p.z, 0.6, 0.03 * strength);
  }

  update(dt, interactive) {
    this.time += dt;
    const U = this.uniforms;
    U.uTime.value = this.time;
    U.uWaveAmp.value = 1 - this.calm * 0.75;
    this.camera.updateMatrixWorld();

    if (interactive && this.pointer.active && this.pointer.moved > 0) {
      const p = this._pointerWorld();
      if (p) {
        if (!this.under && this.sim) {
          const last = this.pointer.lastWorld;
          const steps = last ? Math.min(6, Math.ceil(last.distanceTo(p) / 0.25)) : 1;
          for (let i = 1; i <= steps; i++) {
            const q = last ? last.clone().lerp(p, i / steps) : p;
            this.sim.dropAt(q.x, q.z, 0.32, 0.006);
          }
        } else if (this.under) {
          this.emitBubbles(p, 2);
        }
        this.pointer.lastWorld = p;
      }
      this.pointer.moved = 0;
    }

    // ambient drops keep the surface alive without interaction
    if (this.sim) {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = 0.5 + Math.random() * 1.6;
        const x = (Math.random() - 0.5) * 14;
        const z = -2 - Math.random() * 12;
        this.sim.dropAt(x, z, 0.25 + Math.random() * 0.25, 0.004 + Math.random() * 0.006);
      }
      this.sim.step(dt);
      U.tSim.value = this.sim.texture;
    }

    this._layoutWindows(dt);
    this._updateBubbles(dt);
  }

  emitBubbles(p, n) {
    for (let i = 0; i < n; i++) {
      if (this.bubbles.length >= this.bubbleMax) this.bubbles.shift();
      this.bubbles.push({
        x: p.x + (Math.random() - 0.5) * 0.15,
        y: Math.min(p.y, -0.15) + (Math.random() - 0.5) * 0.1,
        z: p.z + (Math.random() - 0.5) * 0.15,
        vy: 0.35 + Math.random() * 0.5,
        size: 0.006 + Math.random() * 0.016,
        ph: Math.random() * 6.28,
        life: 1,
      });
    }
  }

  _updateBubbles(dt) {
    const geo = this.bubblePoints.geometry;
    const pos = geo.attributes.position.array;
    const size = geo.attributes.aSize.array;
    const life = geo.attributes.aLife.array;
    const alive = [];
    for (const b of this.bubbles) {
      b.vy += dt * 0.25;
      b.y += b.vy * dt;
      b.ph += dt * (3 + b.size);
      b.x += Math.sin(b.ph) * dt * 0.08;
      b.z += Math.cos(b.ph * 0.8) * dt * 0.06;
      b.size += dt * 0.002;
      if (b.y >= -0.02) {
        if (this.sim) this.sim.dropAt(b.x, b.z, 0.12, 0.002);
        continue;
      }
      alive.push(b);
    }
    this.bubbles = alive;
    for (let i = 0; i < this.bubbleMax; i++) {
      const b = alive[i];
      if (b) {
        pos[i * 3] = b.x;
        pos[i * 3 + 1] = b.y;
        pos[i * 3 + 2] = b.z;
        size[i] = b.size;
        life[i] = Math.min(1, -b.y * 2);
      } else {
        life[i] = 0;
        size[i] = 0;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true;
    geo.setDrawRange(0, Math.max(1, alive.length));
  }

  render(renderer, target) {
    const U = this.uniforms;
    const under = this.camera.position.y < 0;
    this.under = under;
    U.uUnder.value = under ? 1 : 0;
    U.uCam.value.copy(this.camera.position);
    this.dome.position.copy(this.camera.position);
    this.floor.visible = under;
    this.wall.visible = under;
    if (this.shafts) this.shafts.visible = under;
    if (this.dust) this.dust.visible = under;
    this.bubblePoints.visible = under && this.bubbles.length > 0;
    for (const W of this.windows) W.mesh.visible = under && (W.alpha || 0) > 0.003;
    // projection scale in pixels per metre at 1 m, for point sprites
    const proj = (this.viewH || 800) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    if (this.dustUniforms) this.dustUniforms.uPx.value = proj;
    this.bubbleUniforms.uPx.value = proj;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.sim?.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose?.();
    });
  }
}
