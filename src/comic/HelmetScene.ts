import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class HelmetScene {
  private helmet: THREE.Object3D | null = null;
  private group: THREE.Group;
  /** Exposed so main.ts can animate ground color per preset */
  groundMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false; // hidden by default
    scene.add(this.group);
    this.groundMat = this.createGround();
    this.createLights();
    this.loadHelmet();
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  private createGround(): THREE.MeshStandardMaterial {
    const geo = new THREE.PlaneGeometry(500, 500);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe8dfd0,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
    return mat;
  }

  private createLights() {
    // Key light — boosted for PBR helmet to survive cel-shading quantization
    const dirLight = new THREE.DirectionalLight(0xfff5e0, 5.0);
    dirLight.position.set(5, 10, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.bias = -0.001;
    this.group.add(dirLight);

    // Strong ambient — push dark PBR areas into visible cel bands
    const ambientLight = new THREE.AmbientLight(0xd0d4e8, 4.0);
    this.group.add(ambientLight);

    // Fill light — stronger to reduce harsh shadows on textured surfaces
    const fillLight = new THREE.DirectionalLight(0xb0c0e0, 3.5);
    fillLight.position.set(-5, 6, -3);
    this.group.add(fillLight);

    // Rim light — stronger for edge separation through the shader
    const rimLight = new THREE.DirectionalLight(0xffe8d0, 2.0);
    rimLight.position.set(-2, 3, -6);
    this.group.add(rimLight);
  }

  private loadHelmet() {
    const loader = new GLTFLoader();
    loader.load('/models/DamagedHelmet.glb', (gltf) => {
      const model = gltf.scene;
      model.position.set(0, 2.2, 0);
      model.scale.setScalar(1.5);
      model.rotation.x = Math.PI * 0.05;
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Reduce metalness so diffuse color survives the comic shader pipeline
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat.isMeshStandardMaterial) {
            mat.metalness = Math.min(mat.metalness, 0.3);
            mat.roughness = Math.max(mat.roughness, 0.5);
          }
        }
      });
      this.group.add(model);
      this.helmet = model;
    });
  }

  update(dt: number) {
    if (this.helmet) {
      const t = performance.now() * 0.001;
      this.helmet.rotation.y = t * 0.15;
    }
  }
}
