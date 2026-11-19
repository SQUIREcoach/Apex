import * as THREE from 'three';
import { Composite } from './composite.js';
import { PoolScene } from './scenes/pool.js';

const WATER_LEVEL = { pool: 0, resort: -0.12, villa: -0.05, sky: 72.35 };
const PLACEHOLDER = { scene: 'pool', pose: { pos: [0.5, -2.0, -4.2], tgt: [-0.3, 2.4, -9.6], fov: 8 } };

// The WebGL stage: one fixed canvas behind the document. The story module
// tells it, every frame, which world is above the waterline and which below.
//
// frame = {
//   up:   { scene: 'pool' | 'resort' | 'villa' | 'sky', pose|p, side? },
//   down: { ... } | null,        // what is seen below the waterline
//   line: number,                // waterline height in screen space
//   downWater: boolean,          // below the line: water body over `down`
//   amp, wet, fade
// }

export class Stage {
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x0a2239, 1);
    renderer.shadowMap.enabled = !!quality.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    this.renderer = renderer;

    this.dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
    this.composite = new Composite();
    this.composite.uniforms.uBloom.value = quality.bloom;
    this.rtUp = this.makeRT();
    this.rtDown = this.makeRT();
    this.rtExtra = this.makeRT();

    this.scenes = { pool: new PoolScene(renderer, quality) };
    this.loading = {};
    this.parallax = new THREE.Vector2();
    this.parallaxTarget = new THREE.Vector2();
    this.last = performance.now();
    this.running = false;
    this.visible = true;
    this.frame = null;
    this.frameTimes = [];
    this.interactive = true;

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    this.resize();
  }

  makeRT() {
    const rt = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      samples: this.quality.msaa,
    });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return rt;
  }

  /** Lazily build the concept scenes (code-split). */
  async ensure(name) {
    if (this.scenes[name]) return this.scenes[name];
    if (this.loading[name]) return this.loading[name];
    this.loading[name] = import('./scenes/concepts.js').then((mod) => {
      const Ctor = { resort: mod.ResortScene, villa: mod.VillaScene, sky: mod.SkyPoolScene }[name];
      const s = new Ctor(this.renderer, this.quality);
      s.resize(this.w, this.h);
      // compile shaders ahead of time to avoid a hitch at the crossing
      this.renderer.compile(s.scene, s.camera);
      this.scenes[name] = s;
      return s;
    });
    return this.loading[name];
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    const s = this.quality.rtScale;
    const rw = Math.max(2, Math.round(w * this.dpr * s));
    const rh = Math.max(2, Math.round(h * this.dpr * s));
    for (const rt of [this.rtUp, this.rtDown, this.rtExtra]) rt.setSize(rw, rh);
    this.composite.uniforms.uRes.value.set(w * this.dpr, h * this.dpr);
    for (const sc of Object.values(this.scenes)) {
      if (sc instanceof PoolScene) sc.resize(w, h, this.dpr * s);
      else sc.resize(w, h);
    }
  }

  setDpr(dpr) {
    this.dpr = dpr;
    this.resize();
  }

  pointer(x, y) {
    const nx = (x / this.w) * 2 - 1;
    const ny = -(y / this.h) * 2 + 1;
    this.parallaxTarget.set(nx, ny);
    this.scenes.pool.pointerMove(nx, ny);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setVisible(v) {
    this.visible = v;
  }

  /** Prepare a world for a view: pose camera, choose side of the surface. */
  stageView(view) {
    if (!this.scenes[view.scene]) {
      // not loaded yet: keep the visitor under water while it arrives
      this.ensure(view.scene);
      view = PLACEHOLDER;
    }
    const sc = this.scenes[view.scene];
    const par = this.quality.motion ? this.parallax : null;
    if (view.scene === 'pool') {
      sc.setPose(view.pose, par);
      if (view.side) sc.setSide(view.side === 'under');
    } else {
      sc.path(sc.keys, view.p ?? 0, par);
    }
    return sc;
  }

  tick() {
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    if (!this.visible || !this.frame) return;
    this.trackPerf(dt);
    const f = this.frame;
    const k = 1 - Math.exp(-dt * 3);
    this.parallax.lerp(this.parallaxTarget, k);

    const C = this.composite.uniforms;
    C.uTime.value += dt;
    C.uLine.value = f.line ?? -1;
    C.uAmp.value = f.amp ?? 1;
    C.uDownWater.value = f.downWater ? 1 : 0;
    C.uWet.value = f.wet || 0;
    C.uFade.value = f.fade || 0;
    const fx = f.fx || {};
    C.uSplash.value = fx.splash || 0;
    C.uFlash.value = fx.flash || 0;
    C.uSpeed.value = fx.speed || 0;
    C.uBlur.value = fx.blur || 0;
    this.scenes.pool.setWindows(f.windows);

    // the pool simulation runs whenever the pool is involved
    const usesPool = f.up.scene === 'pool' || (f.down && f.down.scene === 'pool');

    const upScene = this.stageView(f.up);
    this.elevation = upScene.camera.position.y - (WATER_LEVEL[this.scenes.pool === upScene ? 'pool' : f.up.scene] ?? 0);
    // the pool keeps simulating in the background so it is alive on return
    this.scenes.pool.update(dt, this.interactive && usesPool);
    if (upScene !== this.scenes.pool) upScene.update(dt);
    upScene.render(this.renderer, this.rtUp);
    C.tUp.value = this.rtUp.texture;
    this.windowRects = upScene === this.scenes.pool ? upScene.computeWindowRects(this.w, this.h) : null;

    const showDown = f.down && f.line > -0.15;
    if (showDown) {
      const same = f.down.scene === f.up.scene && !f.down.pose && f.down.p === undefined;
      if (same) {
        C.tDown.value = this.rtUp.texture;
      } else {
        const downScene = this.stageView(f.down);
        if (downScene) {
          if (downScene !== this.scenes.pool && downScene !== upScene) downScene.update(dt);
          downScene.render(this.renderer, this.rtDown);
          C.tDown.value = this.rtDown.texture;
        }
      }
    } else {
      C.tDown.value = this.rtUp.texture;
    }
    this.composite.render(this.renderer);
  }

  trackPerf(dt) {
    if (!this.quality.adaptive) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 1 / 38 && this.dpr > 0.75) {
      this.setDpr(Math.max(0.75, this.dpr - 0.25));
    } else if (avg < 1 / 58 && this.dpr < Math.min(window.devicePixelRatio || 1, this.quality.dprCap)) {
      this.setDpr(Math.min(this.dpr + 0.25, this.quality.dprCap));
    }
  }

  /** Render a single frame immediately (reduced motion, screenshots). */
  renderOnce() {
    this.tick();
  }
}
