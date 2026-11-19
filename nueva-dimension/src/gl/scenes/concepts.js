import * as THREE from 'three';
import { ArchStage } from './arch.js';
import { NOISE, CAUSTICS } from '../glsl/common.js';

// Three architectural concepts, one per strategic market.
// Each scene starts with the camera emerging from its own pool, so the
// passage between worlds is always a crossing of the water surface.

// ---------------------------------------------------------------------------
// Hotels & resorts: a long lagoon pool under a louvred pergola.
export class ResortScene extends ArchStage {
  constructor(renderer, quality) {
    super(renderer, quality, { sun: [-0.62, 0.3, -0.72], haze: 0.35, fog: [70, 300] });
    const M = this.mat;
    // pool 64 x 9 m, deck all around
    this.deck(-90, -60, 90, 40, -32, -4.5, 32, 4.5, M.ivory, 0.6);
    this.pool(-32, -4.5, 32, 4.5, { depth: 1.8, water: -0.12, wall: M.shade });
    // champagne light line under the far coping
    this.slab(-32, -0.16, -4.52, 32, -0.13, -4.46, M.light, { cast: false, receive: false });

    // pergola: slender columns, roof beams and dense louvres
    const pz0 = -15;
    const pz1 = -7.5;
    for (let x = -34; x <= 34; x += 4) {
      this.box(0.22, 3.6, 0.22, x, 1.8, pz0, M.ivory);
      this.box(0.22, 3.6, 0.22, x, 1.8, pz1, M.ivory);
    }
    this.slab(-34.3, 3.6, pz0 - 0.3, 34.3, 3.85, pz0 + 0.1, M.ivory);
    this.slab(-34.3, 3.6, pz1 - 0.1, 34.3, 3.85, pz1 + 0.3, M.ivory);
    const louvres = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.32, pz1 - pz0 + 0.6), M.ivory, 140);
    louvres.castShadow = quality.shadows;
    louvres.receiveShadow = quality.shadows;
    const m4 = new THREE.Matrix4();
    let i = 0;
    for (let x = -34; x <= 34 && i < 140; x += 0.5, i++) {
      m4.makeTranslation(x, 3.72, (pz0 + pz1) / 2);
      louvres.setMatrixAt(i, m4);
    }
    louvres.count = i;
    this.scene.add(louvres);

    // daybeds under the pergola
    for (let x = -30; x <= 30; x += 5) {
      this.box(1.6, 0.42, 2.2, x, 0.21, (pz0 + pz1) / 2 + 0.4, M.stone);
      this.box(1.6, 0.12, 2.0, x, 0.48, (pz0 + pz1) / 2 + 0.5, M.ivory);
    }
    // loungers on the front deck
    for (let x = -28; x <= 28; x += 3.5) {
      this.box(0.8, 0.32, 2.0, x, 0.16, 7.6, M.ivory);
      const back = this.box(0.8, 0.08, 0.8, x, 0.55, 6.85, M.ivory);
      back.rotation.x = -0.7;
    }
    // pavilions
    this.slab(-62, 0, -34, -40, 4.6, -16, M.ivory);
    this.slab(-61.6, 0.4, -16.1, -40.4, 3.8, -15.9, M.glass, { cast: false });
    this.slab(-62.4, 4.6, -34.4, -39.6, 4.9, -15.4, M.ivory);
    this.slab(42, 0, -36, 66, 6.2, -18, M.ivory);
    this.slab(42.4, 0.4, -18.1, 65.6, 5.4, -17.9, M.glass, { cast: false });
    for (let x = 43; x < 66; x += 1.2) this.box(0.12, 5.8, 0.4, x, 3.1, -17.6, M.ivory, { receive: false });
    // terraced garden steps toward the sea
    for (let k = 0; k < 4; k++) this.slab(-90, -0.6 - k * 0.9, 40 + k * 4, 90, -0.3 - k * 0.9, 44 + k * 4, M.stone, { cast: false });

    // sea
    const sea = this.waterPlane(-1400, -1400, 1400, 1400, -6, this.makeWater({ color: 0x07203a, scale: 0.25, amp: 1.2 }));
    sea.position.z = 1200;
    sea.receiveShadow = false;

    this.setShadowFrustum(48, [0, 0, -4], 260);
    this.keys = [
      { pos: [-27, 0.32, 1.2], tgt: [-12, 0.7, -2.5], fov: -2 },
      { pos: [-16, 2.3, 9.5], tgt: [6, 0.9, -6] },
      { pos: [8, 6.0, 19], tgt: [-6, 0.6, -6], fov: 4 },
    ];
  }
}

// ---------------------------------------------------------------------------
// High-end residence: a cantilevered house, a long pool ending in an
// infinity edge over the cliff.
export class VillaScene extends ArchStage {
  constructor(renderer, quality) {
    super(renderer, quality, { sun: [0.85, 0.2, -0.5], haze: 0.3, fog: [80, 420] });
    const M = this.mat;
    // terrace with pool cut; edge of the terrace is x = 20
    this.deck(-30, -16, 20, 16, -6, 2, 20, 7.5, M.ivory, 0.6);
    this.pool(-6, 2, 20, 7.5, { depth: 1.6, water: -0.05, wall: M.shade, edge: 'x1' });
    // overflow channel below the infinity edge
    this.slab(20, -1.6, 1.75, 21.2, -0.9, 7.75, M.shade, { cast: false });
    this.waterPlane(20.1, 2, 21.1, 7.5, -1.0);
    this.slab(19.98, -0.9, 2, 20.02, -0.05, 7.5, this.makeWater({ color: 0x0c3048, amp: 0.4 }), { cast: false });

    // cliff mass
    const rock = M.rock;
    this.slab(-40, -70, -26, 22, -0.6, 18, rock, { cast: false });
    this.slab(-60, -70, -60, -10, 6, -24, rock, { cast: false });

    // lower volume
    this.slab(-24, 0, -12, -2, 3.3, 0, M.ivory);
    this.slab(-23.6, 0.1, 0.02, -2.4, 3.1, 0.1, M.glass, { cast: false });
    for (let x = -22; x < -2; x += 3.6) this.box(0.08, 3.0, 0.1, x, 1.6, 0.12, M.ivory, { receive: false });
    // recessed joint
    this.slab(-23.6, 3.3, -11.6, -2.4, 3.55, -0.4, M.dark, { cast: false });
    // upper volume cantilevering over the pool
    this.slab(-18, 3.55, -10, 11, 6.9, 1.2, M.ivory);
    this.slab(-17.6, 3.95, 1.22, 10.6, 6.4, 1.3, M.glass, { cast: false });
    this.slab(11.02, 3.95, -9.6, 11.1, 6.4, 0.8, M.glass, { cast: false });
    // champagne line in the soffit
    this.slab(-2, 3.52, 0.9, 10.8, 3.56, 1.0, M.light, { cast: false, receive: false });
    // warm interior glow behind the lower glazing
    this.slab(-23.4, 0.2, -1.2, -2.6, 3.0, -1.1, M.warm, { cast: false, receive: false });
    // garden wall and steps
    this.slab(-30, 0, -16, -24.5, 1.4, 16, M.stone);
    this.slab(-30, 0, 12, 4, 0.9, 12.6, M.stone);
    // sea far below
    const sea = this.waterPlane(-1500, -1500, 1500, 1500, -60, this.makeWater({ color: 0x07203a, scale: 0.18, amp: 1.0 }));
    sea.receiveShadow = false;

    this.setShadowFrustum(40, [-4, 0, -2], 240);
    this.keys = [
      { pos: [17.5, 0.28, 4.6], tgt: [-8, 1.8, 3.5], fov: -2 },
      { pos: [24, 3.0, 15], tgt: [-4, 2.4, 0] },
      { pos: [34, 7.5, 26], tgt: [-2, 1.6, -1], fov: 3 },
    ];
  }
}

// ---------------------------------------------------------------------------
// Extraordinary projects: a glass-bottomed pool suspended between two towers.
const SKYPOOL_FRAG = /* glsl */ `
precision highp float;
${NOISE}
${CAUSTICS}
uniform float uTime;
uniform vec3 uCam;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  vec3 V = normalize(vWorld - uCam);
  vec3 N = normalize(vNormal);
  float F = pow(1.0 - abs(dot(V, N)), 3.0);
  vec3 deep = vec3(0.004, 0.035, 0.065);
  vec3 lit = vec3(0.05, 0.22, 0.30);
  float c = caustics(vWorld.xz * 0.55, uTime * 0.6);
  vec3 col;
  if (N.y < -0.5){
    // glass floor seen from below: the sky through 2.5 m of water
    col = mix(lit, vec3(0.45, 0.58, 0.60), c * 0.55) * 1.4;
  } else if (N.y > 0.5){
    col = mix(deep, lit, 0.4) + c * 0.05;
  } else {
    float hgt = clamp((vWorld.y - 70.0) / 2.5, 0.0, 1.0);
    col = mix(deep, lit * 1.2, hgt) + vec3(0.3, 0.4, 0.42) * c * 0.12;
    col += vec3(0.9, 0.95, 1.0) * smoothstep(0.96, 1.0, hgt) * 0.4; // waterline
  }
  col += vec3(0.6, 0.62, 0.62) * F * 0.25;
  gl_FragColor = vec4(col, 0.86);
}
`;

export class SkyPoolScene extends ArchStage {
  constructor(renderer, quality) {
    super(renderer, quality, { sun: [0.55, 0.42, 0.72], haze: 0.45, fog: [120, 700] });
    const M = this.mat;
    const H = 92;
    const tower = this.causticLight(
      new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.85, envMapIntensity: 0.6 }),
      [-8.6, 56, -9],
      [8.6, 70.2, 9],
      0.9,
    );
    // tower cores
    this.slab(-24, 0, -8, -8, H, 8, M.glass);
    this.slab(8, 0, -8, 24, H, 8, M.glass);
    // fins on all faces
    const finGeo = new THREE.BoxGeometry(0.35, H, 0.9);
    const fins = new THREE.InstancedMesh(finGeo, tower, 220);
    fins.castShadow = quality.shadows;
    fins.receiveShadow = quality.shadows;
    const m4 = new THREE.Matrix4();
    let n = 0;
    const put = (x, z, rotY) => {
      m4.makeRotationY(rotY);
      m4.setPosition(x, H / 2, z);
      fins.setMatrixAt(n++, m4);
    };
    for (const [x0, x1] of [[-24, -8], [8, 24]]) {
      for (let x = x0 + 0.4; x <= x1 - 0.3; x += 1.6) {
        put(x, 8.45, 0);
        put(x, -8.45, 0);
      }
      for (let z = -7.6; z <= 7.7; z += 1.6) {
        put(x0 - 0.45, z, Math.PI / 2);
        put(x1 + 0.45, z, Math.PI / 2);
      }
    }
    fins.count = n;
    this.scene.add(fins);
    // floor bands every 4.2 m
    for (const [x0, x1] of [[-24, -8], [8, 24]]) {
      for (let y = 4.2; y < H; y += 4.2) this.slab(x0 - 0.1, y, -8.1, x1 + 0.1, y + 0.35, 8.1, tower, { cast: false });
      this.slab(x0 - 0.6, H, -8.6, x1 + 0.6, H + 1.2, 8.6, tower);
    }
    // the suspended pool: glass box with water, steel edge
    const poolGeo = new THREE.BoxGeometry(17.2, 2.5, 6.2);
    this.poolUniforms = { uTime: this.time, uCam: { value: new THREE.Vector3() } };
    const glassPool = new THREE.Mesh(
      poolGeo,
      new THREE.ShaderMaterial({
        uniforms: this.poolUniforms,
        vertexShader: `varying vec3 vWorld; varying vec3 vNormal; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: SKYPOOL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    glassPool.position.set(0, 71.25, 0);
    glassPool.renderOrder = 2;
    this.scene.add(glassPool);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(poolGeo),
      new THREE.LineBasicMaterial({ color: new THREE.Color().setRGB(0.5841, 0.3968, 0.147).multiplyScalar(2.2) }),
    );
    edges.position.copy(glassPool.position);
    this.scene.add(edges);
    this.waterPlane(-8.6, -3.1, 8.6, 3.1, 72.35, this.makeWater({ color: 0x0d3550, amp: 0.6 }));
    // plaza and a city of low volumes lost in the haze
    this.slab(-200, -0.5, -200, 200, 0, 200, M.stone, { cast: false });
    const cityGeo = new THREE.BoxGeometry(1, 1, 1);
    const city = new THREE.InstancedMesh(cityGeo, M.shade, 260);
    city.receiveShadow = quality.shadows;
    let c = 0;
    const rnd = mulberry(7);
    for (let k = 0; k < 400 && c < 260; k++) {
      const x = (rnd() - 0.5) * 900;
      const z = (rnd() - 0.5) * 900;
      if (Math.abs(x) < 60 && Math.abs(z) < 60) continue;
      const h = 6 + rnd() * rnd() * 70;
      const w = 10 + rnd() * 24;
      const d = 10 + rnd() * 24;
      m4.makeScale(w, h, d);
      m4.setPosition(x, h / 2, z);
      city.setMatrixAt(c++, m4);
    }
    city.count = c;
    this.scene.add(city);

    this.setShadowFrustum(70, [0, 46, 0], 400);
    this.keys = [
      { pos: [1.5, 1.7, 10.5], tgt: [0, 71, 0], fov: 6 },
      { pos: [7, 40, 40], tgt: [0, 68, 0], fov: 0 },
      { pos: [14, 84, 74], tgt: [0, 71, 0], fov: -6 },
    ];
  }

  update(dt) {
    super.update(dt);
    this.poolUniforms.uCam.value.copy(this.camera.position);
  }
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
