import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  composer: EffectComposer;
  depthTexture: THREE.DepthTexture;

  private renderTarget: THREE.WebGLRenderTarget;

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5f0e8);
    this.scene.fog = new THREE.FogExp2(0xf0ebe0, 0.012);

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

    // Composer — let EffectComposer create its own render targets so
    // setSize() applies DPR correctly without double-multiplication.
    this.composer = new EffectComposer(this.renderer);

    // Attach depth textures to BOTH ping-pong render targets so the
    // depth buffer is available regardless of which target is the readBuffer.
    this.renderTarget = this.composer.renderTarget1;
    const rt1 = this.composer.renderTarget1;
    const rt2 = this.composer.renderTarget2;

    this.depthTexture = new THREE.DepthTexture(rt1.width, rt1.height);
    this.depthTexture.format = THREE.DepthFormat;
    this.depthTexture.type = THREE.UnsignedIntType;
    rt1.depthTexture = this.depthTexture;

    const depthTexture2 = new THREE.DepthTexture(rt2.width, rt2.height);
    depthTexture2.format = THREE.DepthFormat;
    depthTexture2.type = THREE.UnsignedIntType;
    rt2.depthTexture = depthTexture2;
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
    // composer.setSize handles renderTarget1 (= this.renderTarget) with pixel ratio,
    // and notifies passes via pass.setSize(). Don't resize renderTarget again —
    // that would undo the pixel-ratio scaling and mismatch the ping-pong buffers.
    this.composer.setSize(w, h);
  }

  start(onUpdate?: (dt: number) => void) {
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (onUpdate) onUpdate(dt);
    };
    animate();
  }
}
