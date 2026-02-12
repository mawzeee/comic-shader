import * as THREE from 'three';

export class ComicScene {
  private objects: THREE.Mesh[] = [];
  private group: THREE.Group;
  /** Exposed so main.ts can animate ground color per preset */
  groundMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.groundMat = this.createGround();
    this.createShapes();
    this.createLights();
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

  private createShapes() {
    // Torus knot — hero shape
    const knotGeo = new THREE.TorusKnotGeometry(0.9, 0.35, 128, 32);
    const knotMat = new THREE.MeshStandardMaterial({
      color: 0xcc2244,
      roughness: 0.3,
      metalness: 0.15,
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.position.set(0, 2.2, 0);
    knot.castShadow = true;
    knot.receiveShadow = true;
    this.group.add(knot);
    this.objects.push(knot);

    // Sphere — classic comic shape
    const sphereGeo = new THREE.SphereGeometry(0.85, 64, 64);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x2255cc,
      roughness: 0.25,
      metalness: 0.1,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(-2.8, 0.85, 1.5);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    this.group.add(sphere);
    this.objects.push(sphere);

    // Dodecahedron — interesting facets for cel shading
    const dodecGeo = new THREE.DodecahedronGeometry(0.75);
    const dodecMat = new THREE.MeshStandardMaterial({
      color: 0xf0a020,
      roughness: 0.35,
      metalness: 0.1,
      flatShading: true,
    });
    const dodec = new THREE.Mesh(dodecGeo, dodecMat);
    dodec.position.set(2.6, 0.85, 1.8);
    dodec.castShadow = true;
    dodec.receiveShadow = true;
    this.group.add(dodec);
    this.objects.push(dodec);

    // Tall cylinder — pillar
    const cylGeo = new THREE.CylinderGeometry(0.4, 0.5, 2.4, 32);
    const cylMat = new THREE.MeshStandardMaterial({
      color: 0x22aa55,
      roughness: 0.4,
      metalness: 0.05,
    });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.set(-1.2, 1.2, 3.0);
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    this.group.add(cyl);
    this.objects.push(cyl);

    // Torus — ring floating
    const torusGeo = new THREE.TorusGeometry(0.6, 0.2, 32, 64);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xcc44aa,
      roughness: 0.3,
      metalness: 0.2,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.position.set(1.5, 1.8, 2.8);
    torus.rotation.x = Math.PI * 0.3;
    torus.castShadow = true;
    torus.receiveShadow = true;
    this.group.add(torus);
    this.objects.push(torus);

    // Small icosahedron — accent
    const icoGeo = new THREE.IcosahedronGeometry(0.45, 0);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0xff6633,
      roughness: 0.35,
      metalness: 0.1,
      flatShading: true,
    });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    ico.position.set(3.2, 0.5, -0.5);
    ico.castShadow = true;
    ico.receiveShadow = true;
    this.group.add(ico);
    this.objects.push(ico);
  }

  private createLights() {
    // Key light — dramatic
    const dirLight = new THREE.DirectionalLight(0xfff5e0, 3.0);
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

    // Strong ambient — comics are bright, shadows still have color
    const ambientLight = new THREE.AmbientLight(0xd0d4e8, 2.2);
    this.group.add(ambientLight);

    // Fill light — from opposite side to soften shadows
    const fillLight = new THREE.DirectionalLight(0xb0c0e0, 1.8);
    fillLight.position.set(-5, 6, -3);
    this.group.add(fillLight);

    // Rim light from behind for edge separation
    const rimLight = new THREE.DirectionalLight(0xffe8d0, 0.8);
    rimLight.position.set(-2, 3, -6);
    this.group.add(rimLight);
  }

  update(dt: number) {
    const t = performance.now() * 0.001;
    // Torus knot: slow, dramatic spin
    if (this.objects[0]) {
      this.objects[0].rotation.y = t * 0.15;
    }
    // Dodecahedron: tumble
    if (this.objects[2]) {
      this.objects[2].rotation.y = t * 0.35;
      this.objects[2].rotation.z = t * 0.2;
    }
    // Torus ring: spin + bob
    if (this.objects[4]) {
      this.objects[4].rotation.z = t * 0.4;
      this.objects[4].position.y = 1.8 + Math.sin(t * 0.6) * 0.3;
    }
    // Icosahedron: slow rotate
    if (this.objects[5]) {
      this.objects[5].rotation.y = t * -0.3;
      this.objects[5].rotation.x = t * 0.15;
    }
  }
}
