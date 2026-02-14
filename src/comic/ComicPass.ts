import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { createComicUniforms, createComicMaterial, type ComicUniforms } from './ComicShader';

export class ComicPass extends Pass {
  uniforms: ComicUniforms;
  private fsQuad: FullScreenQuad;
  private normalRenderTarget: THREE.WebGLRenderTarget;
  private normalOverrideMaterial: THREE.MeshNormalMaterial;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    super();

    this.scene = scene;
    this.camera = camera;

    // Normal buffer — placeholder size, resized by setSize() from EffectComposer.
    // NearestFilter gives discrete per-texel normals so the Sobel kernel
    // produces temporally stable edges (no sub-pixel interpolation drift).
    // FXAA post-pass smooths the final pixel-level aliasing.
    this.normalRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
    });

    this.normalOverrideMaterial = new THREE.MeshNormalMaterial();

    // Shader uniforms and material
    this.uniforms = createComicUniforms();
    this.uniforms.uCameraNear.value = camera.near;
    this.uniforms.uCameraFar.value = camera.far;

    const material = createComicMaterial(this.uniforms);
    this.fsQuad = new FullScreenQuad(material);
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    // Render normals to our target
    const prevOverride = this.scene.overrideMaterial;
    const prevBackground = this.scene.background;

    this.scene.overrideMaterial = this.normalOverrideMaterial;
    this.scene.background = null;

    renderer.setRenderTarget(this.normalRenderTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    this.scene.overrideMaterial = prevOverride;
    this.scene.background = prevBackground;

    // Set uniforms
    this.uniforms.uDiffuse.value = readBuffer.texture;
    this.uniforms.uNormalBuffer.value = this.normalRenderTarget.texture;
    this.uniforms.uDepthBuffer.value = readBuffer.depthTexture;
    this.uniforms.uResolution.value.set(readBuffer.width, readBuffer.height);
    this.uniforms.uTime.value = performance.now() * 0.001;

    // Render fullscreen quad
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
    }
    renderer.clear();
    this.fsQuad.render(renderer);
  }

  setSize(width: number, height: number) {
    this.normalRenderTarget.setSize(width, height);
  }

  dispose() {
    this.normalRenderTarget.dispose();
    this.normalOverrideMaterial.dispose();
    this.fsQuad.material.dispose();
  }
}
