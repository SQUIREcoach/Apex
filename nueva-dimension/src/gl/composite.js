import * as THREE from 'three';
import { BRAND, NOISE, CAUSTICS, FULLSCREEN_VERT } from './glsl/common.js';

// Final pass. Composes up to two scene renders separated by a living
// waterline, so every change of world is a crossing of the water surface.
// Also does bloom (from mipmaps), tone mapping that preserves the brand
// navy exactly in the shadows, vignette, grain and sRGB encoding.

const FRAG = /* glsl */ `
precision highp float;
${BRAND}
${NOISE}
${CAUSTICS}
uniform sampler2D tUp;
uniform sampler2D tDown;
uniform float uLine;       // waterline height in screen space (0 bottom, 1 top)
uniform float uAmp;        // agitation of the waterline
uniform float uDownWater;  // 1: below the line is a body of water seen through
uniform float uTime;
uniform vec2 uRes;
uniform float uBloom;
uniform float uGrain;
uniform float uFade;       // 0..1 fade to deep navy
uniform float uWet;        // droplets on the lens after surfacing
uniform float uSplash;     // white water at the moment of impact
uniform float uFlash;      // the instant of breaking the surface
uniform float uSpeed;      // radial blur while falling
uniform float uBlur;       // eyes opening under water
varying vec2 vUv;

vec3 softClip(vec3 c){
  // linear below 0.75, smooth shoulder above: keeps the dark brand tones exact
  vec3 k = vec3(0.75);
  vec3 e = max(c - k, 0.0);
  return min(c, k) + (1.0 - k) * (1.0 - exp(-e / (1.0 - k)));
}
vec3 toSRGB(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float waterline(float x){
  // frequencies in screen-height units so phones and desktops match
  float asp = uRes.x / uRes.y;
  x *= asp;
  float a = uAmp * min(1.0, 0.45 + 0.4 * asp);
  return uLine
    + a * 0.020 * sin(x * 3.6 + uTime * 1.6)
    + a * 0.011 * sin(x * 9.0 - uTime * 2.7)
    + a * 0.005 * sin(x * 23.0 + uTime * 4.1);
}
vec3 throughWater(sampler2D tex, vec2 uv, float depth){
  float asp = uRes.x / uRes.y;
  vec2 w = vec2(vnoise(uv * vec2(asp, 1.0) * 3.0 + uTime * 0.35), vnoise(uv * vec2(asp, 1.0) * 3.0 + 7.1 - uTime * 0.3)) - 0.5;
  vec3 c = textureLod(tex, uv + w * 0.05, 3.5).rgb;
  vec3 teal = vec3(0.006, 0.034, 0.062);
  c = mix(c * vec3(0.30, 0.62, 0.80), mix(teal, NAVY * 0.7, depth), 0.45 + 0.5 * depth);
  float cs = caustics(uv * vec2(asp, 1.0) * 5.0, uTime * 0.8);
  c += vec3(0.55, 0.62, 0.62) * cs * 0.035 * (1.0 - depth * 0.6);
  return c;
}

void main(){
  vec2 uv = vUv;
  float wl = waterline(uv.x);
  float d = uv.y - wl;
  float lineVis = step(-0.15, uLine) * step(uLine, 1.15);
  vec3 col;
  float asp0 = uRes.x / uRes.y;
  vec2 q0 = (uv - 0.5) * vec2(asp0, 1.0);
  vec2 suv = uv;
  if (uSplash > 0.0){
    vec2 w = vec2(vnoise(q0 * 4.0 + uTime * 1.3), vnoise(q0 * 4.0 + 5.2 - uTime * 1.1)) - 0.5;
    suv += w * 0.11 * uSplash;
  }
  if (d >= 0.0){
    vec2 o = vec2(0.0, -exp(-d * 55.0) * 0.025 * lineVis);
    col = texture2D(tUp, suv + o).rgb;
    if (uSpeed > 0.0){
      vec3 acc = col;
      vec2 dir = suv - 0.5;
      for (int i = 1; i < 8; i++) acc += texture2D(tUp, suv - dir * float(i) * 0.011 * uSpeed).rgb;
      col = acc / 8.0;
    }
    if (uBlur > 0.0) col = mix(col, textureLod(tUp, suv, 3.2).rgb * vec3(0.75, 0.95, 1.08), uBlur * 0.85);
    if (uBloom > 0.0){
      vec3 b = textureLod(tUp, uv, 3.0).rgb * 0.45 + textureLod(tUp, uv, 4.5).rgb * 0.35 + textureLod(tUp, uv, 6.0).rgb * 0.2;
      col += max(b - 0.18, 0.0) * uBloom;
    }
  } else {
    if (uDownWater > 0.5){
      col = throughWater(tDown, uv, clamp(-d * 1.4, 0.0, 1.0));
    } else {
      vec2 o = vec2(sin(uv.y * 30.0 + uTime * 2.0) * 0.002, exp(d * 40.0) * 0.035) * lineVis;
      col = texture2D(tDown, uv + o).rgb;
    }
  }
  // meniscus: a thin bright line and a darker lens band beneath it
  col += vec3(0.75, 0.85, 0.9) * exp(-abs(d) * 700.0) * 0.45 * lineVis;
  col *= 1.0 - 0.45 * exp(-abs(d + 0.012) * 90.0) * step(d, 0.0) * lineVis;

  // the impact: churned white water, spray, and a flash of broken light
  if (uSplash > 0.0){
    float r = length(q0);
    // churned water: foam veils torn by the plunge, streaming upwards
    float n = fbm(q0 * vec2(2.6, 1.6) + vec2(0.0, -uTime * 2.4));
    float veil = smoothstep(0.62, 0.86, n + uSplash * 0.34 - r * 0.18);
    // trails of air: thin vertical streaks rushing past the lens
    float streak = vnoise(q0 * vec2(26.0, 2.2) + vec2(0.0, uTime * 7.0));
    streak = smoothstep(0.72, 0.95, streak);
    // spray: small sharp droplets
    vec2 sg = q0 * 34.0 + vec2(0.0, uTime * 14.0);
    vec2 sf = fract(sg) - 0.5;
    float sr = hash12(floor(sg));
    float spray = step(0.9, sr) * smoothstep(0.2, 0.04, length(sf + (hash22(floor(sg)) - 0.5) * 0.5));
    float k = clamp(uSplash, 0.0, 1.0);
    col = mix(col, vec3(0.62, 0.74, 0.80), veil * k * 0.78);
    col += vec3(0.75, 0.85, 0.9) * (streak * 0.22 + spray * 0.5) * k;
    // the edge of the crater: darker turbulent water around the bright core
    col *= 1.0 - 0.25 * k * smoothstep(0.2, 0.8, r);
  }
  col += vec3(0.75, 0.85, 0.9) * uFlash * 0.42;

  // droplets running down the lens after surfacing
  if (uWet > 0.0){
    vec2 g = uv * vec2(uRes.x / uRes.y, 1.0) * vec2(9.0, 3.0);
    vec2 id = floor(g);
    float r = hash12(id);
    vec2 f = fract(g + vec2(0.0, uTime * (0.05 + r * 0.25))) - 0.5;
    float drop = smoothstep(0.18, 0.05, length(f * vec2(1.0, 0.6))) * step(0.55, r);
    col = mix(col, col * 1.25 + 0.01, drop * uWet);
  }

  col = softClip(col);
  // vignette
  vec2 q = uv - 0.5;
  col *= 1.0 - dot(q, q) * 0.55;
  col = mix(col, NAVY * 0.6, uFade);
  vec3 s = toSRGB(col);
  // film grain + dithering
  float n = hash12(uv * uRes + fract(uTime * 13.7) * 100.0) - 0.5;
  s += n * uGrain;
  gl_FragColor = vec4(s, 1.0);
}
`;

export class Composite {
  constructor() {
    this.uniforms = {
      tUp: { value: null },
      tDown: { value: null },
      uLine: { value: -1 },
      uAmp: { value: 1 },
      uDownWater: { value: 0 },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uBloom: { value: 0.6 },
      uGrain: { value: 0.035 },
      uFade: { value: 0 },
      uWet: { value: 0 },
      uSplash: { value: 0 },
      uFlash: { value: 0 },
      uSpeed: { value: 0 },
      uBlur: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    q.frustumCulled = false;
    this.scene.add(q);
  }

  render(renderer) {
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
