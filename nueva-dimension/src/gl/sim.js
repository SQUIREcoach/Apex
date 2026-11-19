import * as THREE from 'three';
import { FULLSCREEN_VERT } from './glsl/common.js';

// GPU heightfield simulation of a water surface (wave equation on a grid).
// Texture channels: r = height (m), g = vertical velocity,
//                   b,a = surface gradient dh/dx, dh/dz.
// The grid maps to a square region of the pool in world space; the edges are
// damped so the simulated ripples fade seamlessly into the procedural waves.

const UPDATE = /* glsl */ `
precision highp float;
uniform sampler2D tPrev;
uniform vec2 uDelta;
uniform float uDamping;
varying vec2 vUv;
void main(){
  vec4 info = texture2D(tPrev, vUv);
  vec2 dx = vec2(uDelta.x, 0.0);
  vec2 dy = vec2(0.0, uDelta.y);
  float avg = (
    texture2D(tPrev, vUv - dx).r + texture2D(tPrev, vUv + dx).r +
    texture2D(tPrev, vUv - dy).r + texture2D(tPrev, vUv + dy).r) * 0.25;
  info.g += (avg - info.r) * 2.0;
  info.g *= uDamping;
  info.r += info.g;
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = smoothstep(0.0, 0.07, min(e.x, e.y));
  info.rg *= mix(0.86, 1.0, edge);
  gl_FragColor = info;
}`;

const DROP = /* glsl */ `
precision highp float;
uniform sampler2D tPrev;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uStrength;
varying vec2 vUv;
void main(){
  vec4 info = texture2D(tPrev, vUv);
  float d = max(0.0, 1.0 - length(uCenter - vUv) / uRadius);
  d = 0.5 - cos(d * 3.14159265) * 0.5;
  info.r += d * uStrength;
  gl_FragColor = info;
}`;

const GRADIENT = /* glsl */ `
precision highp float;
uniform sampler2D tPrev;
uniform vec2 uDelta;
uniform float uTexel;
varying vec2 vUv;
void main(){
  vec4 info = texture2D(tPrev, vUv);
  float hx = texture2D(tPrev, vUv + vec2(uDelta.x, 0.0)).r - texture2D(tPrev, vUv - vec2(uDelta.x, 0.0)).r;
  float hz = texture2D(tPrev, vUv + vec2(0.0, uDelta.y)).r - texture2D(tPrev, vUv - vec2(0.0, uDelta.y)).r;
  info.ba = vec2(hx, hz) / (2.0 * uTexel);
  gl_FragColor = info;
}`;

export class WaterSim {
  constructor(renderer, { size = 256, worldSize = 18, center = new THREE.Vector2(0, -6) } = {}) {
    this.renderer = renderer;
    this.size = size;
    this.worldSize = worldSize;
    this.center = center;
    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    };
    this.read = new THREE.WebGLRenderTarget(size, size, opts);
    this.write = new THREE.WebGLRenderTarget(size, size, opts);
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    const delta = new THREE.Vector2(1 / size, 1 / size);
    const mk = (fragmentShader, uniforms) =>
      new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader,
        uniforms: { tPrev: { value: null }, ...uniforms },
        depthTest: false,
        depthWrite: false,
      });
    this.updateMat = mk(UPDATE, { uDelta: { value: delta }, uDamping: { value: 0.993 } });
    this.dropMat = mk(DROP, {
      uCenter: { value: new THREE.Vector2() },
      uRadius: { value: 0.02 },
      uStrength: { value: 0.01 },
    });
    this.gradMat = mk(GRADIENT, { uDelta: { value: delta }, uTexel: { value: worldSize / size } });

    this.queue = [];
    this.acc = 0;
    this.clear();
  }

  clear() {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const cc = new THREE.Color();
    r.getClearColor(cc);
    const ca = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    for (const t of [this.read, this.write]) {
      r.setRenderTarget(t);
      r.clear(true, false, false);
    }
    r.setRenderTarget(prev);
    r.setClearColor(cc, ca);
  }

  /** Rect in world XZ covered by the grid: x0, z0, size. */
  get rect() {
    const h = this.worldSize / 2;
    return new THREE.Vector4(this.center.x - h, this.center.y - h, this.worldSize, 1);
  }

  /** Queue a drop at world coordinates (x, z). radius in metres, strength in metres. */
  dropAt(x, z, radius = 0.3, strength = 0.012) {
    const h = this.worldSize / 2;
    const u = (x - (this.center.x - h)) / this.worldSize;
    const v = (z - (this.center.y - h)) / this.worldSize;
    if (u < 0.02 || u > 0.98 || v < 0.02 || v > 0.98) return;
    if (this.queue.length > 24) this.queue.shift();
    this.queue.push([u, v, radius / this.worldSize, strength]);
  }

  pass(mat) {
    mat.uniforms.tPrev.value = this.read.texture;
    this.quad.material = mat;
    this.renderer.setRenderTarget(this.write);
    this.renderer.render(this.scene, this.camera);
    const t = this.read;
    this.read = this.write;
    this.write = t;
  }

  step(dt) {
    const prev = this.renderer.getRenderTarget();
    const drops = this.queue.splice(0, 8);
    for (const [u, v, rad, s] of drops) {
      this.dropMat.uniforms.uCenter.value.set(u, v);
      this.dropMat.uniforms.uRadius.value = rad;
      this.dropMat.uniforms.uStrength.value = s;
      this.pass(this.dropMat);
    }
    // fixed 60 Hz stepping, two wave updates per tick, at most two ticks per frame
    this.acc = Math.min(this.acc + dt, 2 / 60);
    let ticked = drops.length > 0;
    while (this.acc >= 1 / 60) {
      this.acc -= 1 / 60;
      this.pass(this.updateMat);
      this.pass(this.updateMat);
      ticked = true;
    }
    if (ticked) this.pass(this.gradMat);
    this.renderer.setRenderTarget(prev);
  }

  get texture() {
    return this.read.texture;
  }

  dispose() {
    this.read.dispose();
    this.write.dispose();
    [this.updateMat, this.dropMat, this.gradMat].forEach((m) => m.dispose());
  }
}
