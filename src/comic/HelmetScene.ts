import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class HelmetScene {
  private helmet: THREE.Object3D | null = null;
  private group: THREE.Group;
  /** Exposed so main.ts can animate ground color per preset */
  groundMat: THREE.MeshStandardMaterial;

  // Tunable parameters (exposed for GUI)
  rotationSpeed = 0.03;
  mountainBrightness = 0.12;

  // Environment materials — colors derived from groundMat each frame
  private mountainMats: THREE.MeshStandardMaterial[] = [];
  private mountainMeshes: THREE.Mesh[] = [];
  private rockMats: THREE.MeshStandardMaterial[] = [];
  private fissureMats: THREE.MeshStandardMaterial[] = [];
  private monolithMats: THREE.MeshStandardMaterial[] = [];
  private pedestalMat: THREE.MeshStandardMaterial | null = null;
  private hsl = { h: 0, s: 0, l: 0 };

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.groundMat = this.createGround();
    this.createLights();
    this.createPedestal();
    this.createMountains();
    this.createRockFormations();
    this.createFissures();
    this.createMonoliths();
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
    const dirLight = new THREE.DirectionalLight(0xfff5e0, 5.0);
    dirLight.position.set(5, 10, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.bias = -0.001;
    this.group.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xd0d4e8, 4.0);
    this.group.add(ambientLight);

    const fillLight = new THREE.DirectionalLight(0xb0c0e0, 3.5);
    fillLight.position.set(-5, 6, -3);
    this.group.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffe8d0, 2.0);
    rimLight.position.set(-2, 3, -6);
    this.group.add(rimLight);
  }

  private createPedestal() {
    const geo = new THREE.CylinderGeometry(1.6, 1.8, 0.5, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.4,
      metalness: 0.1,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.25, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.pedestalMat = mat;
  }

  private createMountains() {
    const configs = [
      { x: -18, z: -26, r: 12, h: 18, seg: 6, tilt: 0.05 },
      { x: -6, z: -24, r: 8, h: 14, seg: 5, tilt: -0.03 },
      { x: -12, z: -35, r: 15, h: 22, seg: 7, tilt: 0.04 },
      { x: 2, z: -30, r: 10, h: 16, seg: 6, tilt: -0.06 },
      { x: -22, z: -20, r: 6, h: 10, seg: 5, tilt: 0.03 },
      { x: 8, z: -26, r: 7, h: 12, seg: 5, tilt: -0.04 },
    ];

    for (const c of configs) {
      const geo = new THREE.ConeGeometry(c.r, c.h, c.seg);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        metalness: 0.05,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.h / 2, c.z);
      mesh.rotation.z = c.tilt;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.mountainMats.push(mat);
      this.mountainMeshes.push(mesh);
    }
  }

  private createRockFormations() {
    const configs = [
      { x: -5, z: 4, sx: 1.5, sy: 0.8, sz: 1.2, ry: 0.4 },
      { x: 6, z: 3, sx: 1.0, sy: 1.3, sz: 1.0, ry: 1.8 },
      { x: -7, z: -4, sx: 1.2, sy: 0.6, sz: 1.3, ry: 3.1 },
    ];

    for (const c of configs) {
      const geo = new THREE.DodecahedronGeometry(1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        metalness: 0.08,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.sy * 0.5, c.z);
      mesh.scale.set(c.sx, c.sy, c.sz);
      mesh.rotation.y = c.ry;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.rockMats.push(mat);
    }
  }

  private createFissures() {
    // Energy fissures radiating outward from the pedestal
    const configs = [
      { dir: 0.5, startR: 2.5, endR: 14 },
      { dir: 2.6, startR: 2.5, endR: 11 },
      { dir: 4.3, startR: 2.5, endR: 13 },
    ];

    for (const c of configs) {
      const midR = (c.startR + c.endR) / 2;
      const length = c.endR - c.startR;
      const cx = Math.cos(c.dir) * midR;
      const cz = Math.sin(c.dir) * midR;

      const geo = new THREE.BoxGeometry(0.35, 0.15, length);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.3,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, 0.08, cz);
      mesh.rotation.y = Math.PI / 2 - c.dir;
      this.group.add(mesh);
      this.fissureMats.push(mat);
    }
  }

  private createMonoliths() {
    const configs = [
      { x: -10, z: -12, h: 8, w: 0.6, d: 0.4, ry: 0.15 },
      { x: 12, z: -10, h: 6, w: 0.5, d: 0.5, ry: -0.1 },
    ];

    for (const c of configs) {
      const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.35,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.h / 2, c.z);
      mesh.rotation.y = c.ry;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.monolithMats.push(mat);
    }
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

  /** Derive all environment colors from groundMat so everything shifts with presets */
  private syncEnvironmentColors() {
    this.groundMat.color.getHSL(this.hsl);
    const { h, s, l } = this.hsl;

    // Mountains: silhouettes against sky
    for (const mat of this.mountainMats) {
      mat.color.setHSL(h, Math.min(s + 0.1, 1), Math.max(l * 0.55, this.mountainBrightness));
    }

    // Rocks: between ground and mountain darkness
    for (const mat of this.rockMats) {
      mat.color.setHSL(h, Math.min(s + 0.05, 1), l * 0.7);
    }

    // Fissures: neon green energy
    for (const mat of this.fissureMats) {
      mat.color.setHSL(0.35, 0.9, 0.35 + l * 2);
    }

    // Monoliths: very dark silhouettes
    for (const mat of this.monolithMats) {
      mat.color.setHSL(h, s * 0.6, l * 0.25);
    }

    // Pedestal: dark, grounded
    if (this.pedestalMat) {
      this.pedestalMat.color.setHSL(h, Math.min(s + 0.05, 1), l * 0.4);
    }
  }

  update(dt: number) {
    const t = performance.now() * 0.001;

    if (this.helmet) {
      this.helmet.rotation.y = -Math.sin(t * 0.25) * 0.26;
    }

    this.syncEnvironmentColors();
  }
}
