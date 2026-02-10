import * as THREE from 'three';

export class ComicScene {
  private objects: THREE.Mesh[] = [];
  /** The group containing all primitive shapes + ground + lights */
  group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.createGround();
    this.createShapes();
    this.createLights();
  }

  private createGround() {
    const geo = new THREE.PlaneGeometry(80, 80);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0e0a20,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private createShapes() {
    // Hero: Large torus knot — deep vermilion red, glossy
    const heroGeo = new THREE.TorusKnotGeometry(1.1, 0.38, 200, 40, 2, 3);
    const heroMat = new THREE.MeshPhysicalMaterial({
      color: 0xc41a1a,
      roughness: 0.15,
      metalness: 0.0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    });
    const hero = new THREE.Mesh(heroGeo, heroMat);
    hero.position.set(0, 2.2, 0);
    hero.castShadow = true;
    hero.receiveShadow = true;
    this.group.add(hero);
    this.objects.push(hero);

    // Sphere — warm gold, smooth
    const sphereGeo = new THREE.SphereGeometry(0.85, 64, 64);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xd4940a,
      roughness: 0.08,
      metalness: 0.05,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(-2.2, 0.85, 1.8);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    this.group.add(sphere);
    this.objects.push(sphere);

    // Dodecahedron — coral, chalky matte
    const dodecGeo = new THREE.DodecahedronGeometry(0.75);
    const dodecMat = new THREE.MeshStandardMaterial({
      color: 0xe04e28,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: true,
    });
    const dodec = new THREE.Mesh(dodecGeo, dodecMat);
    dodec.position.set(2.2, 0.85, 1.5);
    dodec.castShadow = true;
    dodec.receiveShadow = true;
    this.group.add(dodec);
    this.objects.push(dodec);

    // Tall cylinder — burnt sienna, satin
    const cylGeo = new THREE.CylinderGeometry(0.4, 0.5, 2.4, 32);
    const cylMat = new THREE.MeshStandardMaterial({
      color: 0xb54020,
      roughness: 0.45,
      metalness: 0.0,
    });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.set(-1.2, 1.2, 3.0);
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    this.group.add(cyl);
    this.objects.push(cyl);

    // Torus — hot rose / magenta, metallic
    const torusGeo = new THREE.TorusGeometry(0.6, 0.2, 32, 64);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xcc2870,
      roughness: 0.2,
      metalness: 0.5,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.position.set(1.5, 1.8, 2.8);
    torus.rotation.x = Math.PI * 0.3;
    torus.castShadow = true;
    torus.receiveShadow = true;
    this.group.add(torus);
    this.objects.push(torus);

    // Small icosahedron — amber, rough matte
    const icoGeo = new THREE.IcosahedronGeometry(0.45, 0);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0xcc6a08,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    ico.position.set(2.8, 0.5, 0.2);
    ico.castShadow = true;
    ico.receiveShadow = true;
    this.group.add(ico);
    this.objects.push(ico);
  }

  private createLights() {
    // Key light — warm, dramatic
    const dirLight = new THREE.DirectionalLight(0xffe0c0, 3.8);
    dirLight.position.set(4, 8, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 20;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 6;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    dirLight.shadow.radius = 3;
    this.group.add(dirLight);

    // Hemisphere — indigo sky / deep warm ground
    const hemiLight = new THREE.HemisphereLight(0x4030a0, 0x402010, 0.6);
    this.group.add(hemiLight);

    // Fill light — cool violet, from opposite side
    const fillLight = new THREE.DirectionalLight(0x8070c0, 0.9);
    fillLight.position.set(-5, 6, -3);
    this.group.add(fillLight);

    // Rim light — warm amber, stronger edge separation
    const rimLight = new THREE.DirectionalLight(0xffc080, 1.4);
    rimLight.position.set(-2, 3, -6);
    this.group.add(rimLight);
  }

  update(_dt: number) {
    const t = performance.now() * 0.001;
    // Hero: slow twist
    if (this.objects[0]) {
      this.objects[0].rotation.y = t * 0.2;
      this.objects[0].rotation.x = Math.sin(t * 0.15) * 0.1;
    }
    // Dodecahedron: tumble
    if (this.objects[2]) {
      this.objects[2].rotation.y = t * 0.35;
      this.objects[2].rotation.z = t * 0.2;
    }
    // Torus: spin
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
