import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  composer: EffectComposer;
  depthTexture: THREE.DepthTexture;

  private renderTarget: THREE.WebGLRenderTarget;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.dpr = Math.min(window.devicePixelRatio, 2);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f0e8);

    // Environment map
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(5, 4, 7);

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.5, 0);
    this.controls.update();

    // Render target at DEVICE pixel resolution, with depth texture baked in
    const pw = Math.floor(window.innerWidth * this.dpr);
    const ph = Math.floor(window.innerHeight * this.dpr);

    this.depthTexture = new THREE.DepthTexture(pw, ph);
    this.depthTexture.format = THREE.DepthFormat;
    this.depthTexture.type = THREE.UnsignedIntType;

    this.renderTarget = new THREE.WebGLRenderTarget(pw, ph, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthTexture: this.depthTexture,
    });

    // Composer — pass our DPR-scaled render target
    this.composer = new EffectComposer(this.renderer, this.renderTarget);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Resize
    window.addEventListener('resize', () => this.onResize());
  }

  addPass(pass: Pass) {
    this.composer.addPass(pass);
  }

  renderDirect() {
    this.renderer.render(this.scene, this.camera);
  }

  private onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);

    // composer.setSize multiplies by its internal _pixelRatio (from renderer)
    this.composer.setSize(w, h);

    // Depth textures on both render targets need manual resize
    const rt1 = this.composer.renderTarget1;
    const rt2 = this.composer.renderTarget2;
    for (const rt of [rt1, rt2]) {
      if (rt.depthTexture) {
        rt.depthTexture.image.width = rt.width;
        rt.depthTexture.image.height = rt.height;
        rt.depthTexture.needsUpdate = true;
      }
    }
  }

  start(onUpdate?: (dt: number) => void) {
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      this.controls.update();
      if (onUpdate) onUpdate(dt);
    };
    animate();
  }
}
