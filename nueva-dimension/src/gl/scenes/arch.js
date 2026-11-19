import * as THREE from 'three';
import { NOISE, WAVES, CAUSTICS } from '../glsl/common.js';

// Shared toolkit for the architectural concept scenes: an evening sky with a
// low sun, image-based reflections from that sky, ivory "maquette" materials,
// living water and champagne light lines. These scenes are concepts, rendered
// in real time; they do not depict executed works.

const SKY_DAY = /* glsl */ `
uniform vec3 uSun;
uniform float uHaze;
vec3 archSky(vec3 d){
  float h = d.y;
  vec3 navy = vec3(0.0030, 0.0157, 0.0409);
  vec3 zen = vec3(0.004, 0.018, 0.050);
  vec3 hor = vec3(0.10, 0.12, 0.13);
  vec3 col = mix(hor, navy * 1.6, smoothstep(-0.02, 0.28, h));
  col = mix(col, zen, smoothstep(0.28, 0.9, h));
  float s = max(dot(d, normalize(uSun)), 0.0);
  vec3 champ = vec3(0.5841, 0.3968, 0.1470);
  col += champ * pow(s, 6.0) * 0.55 * exp(-max(h, 0.0) * 3.0);
  col += vec3(1.0, 0.82, 0.55) * pow(s, 60.0) * 1.2;
  col += vec3(1.0, 0.92, 0.75) * smoothstep(0.9996, 0.99985, s) * 30.0;
  col += vec3(0.30, 0.27, 0.22) * exp(-abs(h) * 30.0) * uHaze;
  if (h < 0.0) col = mix(col, vec3(0.004, 0.012, 0.022), smoothstep(0.0, -0.25, h));
  return col;
}
`;

export class ArchStage {
  constructor(renderer, quality, { sun = [-0.6, 0.18, -0.75], haze = 0.25, fog = [0.0, 0.0] } = {}) {
    this.renderer = renderer;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2500);
    this.time = { value: 0 };
    this.sunDir = new THREE.Vector3(...sun).normalize();
    this.shadowsDirty = true;

    // sky dome
    this.skyUniforms = {
      uSun: { value: this.sunDir.clone() },
      uHaze: { value: haze },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
        fragmentShader: `precision highp float; varying vec3 vDir; ${SKY_DAY} void main(){ gl_FragColor = vec4(archSky(normalize(vDir)), 1.0); }`,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.sky = sky;
    this.scene.add(sky);

    // environment for reflections
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    this.env = pm.fromScene(envScene, 0.02, 0.1, 2000).texture;
    pm.dispose();
    this.scene.environment = this.env;

    if (fog[1] > 0) this.scene.fog = new THREE.Fog(new THREE.Color().setRGB(0.02, 0.035, 0.055), fog[0], fog[1]);

    // lights
    this.sun = new THREE.DirectionalLight(new THREE.Color().setRGB(1.0, 0.8, 0.56), 5.2);
    this.sun.position.copy(this.sunDir).multiplyScalar(120);
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun, this.sun.target);
    if (quality.shadows) {
      this.sun.castShadow = true;
      const s = this.sun.shadow;
      s.mapSize.set(quality.shadowSize, quality.shadowSize);
      s.bias = -0.0004;
      s.normalBias = 0.03;
      s.radius = 3;
    }
    this.hemi = new THREE.HemisphereLight(
      new THREE.Color().setRGB(0.22, 0.30, 0.44),
      new THREE.Color().setRGB(0.50, 0.40, 0.28),
      1.45,
    );
    this.scene.add(this.hemi);

    // materials
    this.mat = {
      ivory: new THREE.MeshStandardMaterial({ color: 0xefebe1, roughness: 0.88, envMapIntensity: 0.6 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.92, envMapIntensity: 0.5 }),
      shade: new THREE.MeshStandardMaterial({ color: 0xbfb6a5, roughness: 0.95, envMapIntensity: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b2a38, roughness: 0.9 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 1.0, flatShading: true }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0a2239, roughness: 0.04, metalness: 0.85, envMapIntensity: 1.4 }),
      light: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.5841, 0.3968, 0.147).multiplyScalar(6) }),
      warm: new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.0, 0.75, 0.42).multiplyScalar(1.6) }),
    };
    this.mat.water = this.makeWater();
  }

  setShadowFrustum(size, center = [0, 0, 0], depth = 400) {
    if (!this.sun.castShadow) return;
    const c = this.sun.shadow.camera;
    c.left = -size;
    c.right = size;
    c.top = size;
    c.bottom = -size;
    c.near = 1;
    c.far = depth;
    c.updateProjectionMatrix();
    this.sun.target.position.set(...center);
    this.sun.position.copy(this.sunDir).multiplyScalar(depth * 0.5).add(this.sun.target.position);
  }

  makeWater({ color = 0x0b2c44, rough = 0.05, scale = 1.0, amp = 1.4 } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0, envMapIntensity: 1.5 });
    const time = this.time;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\n${NOISE}\n${WAVES}`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          vec2 wg = waveGrad(vWPos.xz * ${scale.toFixed(3)}, uTime, ${amp.toFixed(3)});
          vec3 wn = normalize(vec3(-wg.x, 1.0, -wg.y));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);`,
        );
    };
    return m;
  }

  /** Adds an emissive caustic glow to a material, inside a world-space box. */
  causticLight(material, boxMin, boxMax, strength = 1.0) {
    const time = this.time;
    material.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.uniforms.uCMin = { value: new THREE.Vector3(...boxMin) };
      sh.uniforms.uCMax = { value: new THREE.Vector3(...boxMax) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\nuniform float uTime;\nuniform vec3 uCMin;\nuniform vec3 uCMax;\nvarying vec3 vWPos;\n${NOISE}\n${CAUSTICS}`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          vec3 cq = (vWPos - uCMin) / (uCMax - uCMin);
          if (all(greaterThan(cq, vec3(0.0))) && all(lessThan(cq, vec3(1.0)))){
            float fall = smoothstep(0.0, 0.25, cq.y) * smoothstep(1.0, 0.75, cq.y) * smoothstep(0.0, 0.2, cq.x) * smoothstep(1.0, 0.8, cq.x);
            float cc = caustics(vec2(vWPos.x + vWPos.z, vWPos.y) * 0.45, uTime * 0.7);
            totalEmissiveRadiance += vec3(0.75, 0.80, 0.70) * cc * fall * ${strength.toFixed(3)};
          }`,
        );
    };
    return material;
  }

  box(w, h, d, x, y, z, mat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast && this.quality.shadows;
    m.receiveShadow = receive && this.quality.shadows;
    this.scene.add(m);
    return m;
  }

  /** Box from min/max corners. */
  slab(x0, y0, z0, x1, y1, z1, mat, opts) {
    return this.box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, mat, opts);
  }

  waterPlane(x0, z0, x1, z1, y, mat = this.mat.water) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = this.quality.shadows;
    this.scene.add(m);
    return m;
  }

  /** A sunken pool: walls + water, cut into a deck whose top is at y=0. */
  pool(x0, z0, x1, z1, { depth = 1.6, water = -0.1, wall = this.mat.stone, edge = null } = {}) {
    const t = 0.25;
    if (edge !== 'x1') this.slab(x1, -depth, z0, x1 + t, 0, z1, wall, { cast: false });
    if (edge !== 'x0') this.slab(x0 - t, -depth, z0, x0, 0, z1, wall, { cast: false });
    this.slab(x0, -depth, z0 - t, x1, 0, z0, wall, { cast: false });
    this.slab(x0, -depth, z1, x1, 0, z1 + t, wall, { cast: false });
    return this.waterPlane(x0, z0, x1, z1, water);
  }

  /** Deck with a rectangular hole: outer rect, hole rect, top at y=0. */
  deck(ox0, oz0, ox1, oz1, hx0, hz0, hx1, hz1, mat = this.mat.ivory, thick = 0.5) {
    const y0 = -thick;
    this.slab(ox0, y0, oz0, ox1, 0, hz0, mat, { cast: false });
    this.slab(ox0, y0, hz1, ox1, 0, oz1, mat, { cast: false });
    if (hx0 > ox0) this.slab(ox0, y0, hz0, hx0, 0, hz1, mat, { cast: false });
    if (hx1 < ox1) this.slab(hx1, y0, hz0, ox1, 0, hz1, mat, { cast: false });
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.baseFov = w / h < 0.8 ? 58 : w / h < 1.2 ? 48 : 38;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  /** Smooth camera path through keyframes {pos, tgt} at progress p. */
  path(keys, p, parallax) {
    const n = keys.length - 1;
    const f = Math.min(Math.max(p, 0), 1) * n;
    const i = Math.min(Math.floor(f), n - 1);
    let t = f - i;
    t = t * t * (3 - 2 * t);
    const a = keys[i];
    const b = keys[i + 1];
    const c = this.camera;
    c.position.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * t,
      a.pos[1] + (b.pos[1] - a.pos[1]) * t,
      a.pos[2] + (b.pos[2] - a.pos[2]) * t,
    );
    const tx = a.tgt[0] + (b.tgt[0] - a.tgt[0]) * t;
    const ty = a.tgt[1] + (b.tgt[1] - a.tgt[1]) * t;
    const tz = a.tgt[2] + (b.tgt[2] - a.tgt[2]) * t;
    if (parallax) {
      c.position.x += parallax.x * 0.6;
      c.position.y += parallax.y * 0.3;
    }
    c.lookAt(tx, ty, tz);
    const fov = this.baseFov + (a.fov || 0) + ((b.fov || 0) - (a.fov || 0)) * t;
    if (Math.abs(c.fov - fov) > 0.01) {
      c.fov = fov;
      c.updateProjectionMatrix();
    }
  }

  update(dt) {
    this.time.value += dt;
    this.sky.position.copy(this.camera.position);
  }

  render(renderer, target) {
    if (this.quality.shadows) {
      renderer.shadowMap.autoUpdate = false;
      if (this.shadowsDirty) {
        renderer.shadowMap.needsUpdate = true;
        this.shadowsDirty = false;
      }
    }
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}
