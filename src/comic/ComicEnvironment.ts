import * as THREE from 'three';

// ─── Palette — Deep indigo/violet family ─────────────────────────────
// These live in the same color world as the background (purple-black).
// They emerge from the fog like shadows with subtle color variation.
// A few get warm accents — echoes of the hero palette.
const INDIGO = [
  0x18123a, // deep indigo
  0x1a1440, // purple night
  0x141030, // near-black violet
  0x201848, // rich purple
  0x161238, // dark plum
];

const WARM_ACCENT = [
  0x3a1818, // deep crimson shadow
  0x382010, // ember
  0x301520, // dark rose
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function envColor(): number {
  // 80% indigo, 20% warm accent — occasional warmth linking to hero
  return Math.random() < 0.8 ? pick(INDIGO) : pick(WARM_ACCENT);
}

function poissonPoints(
  count: number,
  rMin: number,
  rMax: number,
  minSep: number,
  existing: THREE.Vector2[] = [],
  maxAttempts = 200,
): THREE.Vector2[] {
  const points: THREE.Vector2[] = [...existing];
  const result: THREE.Vector2[] = [];

  while (result.length < count) {
    let placed = false;
    for (let a = 0; a < maxAttempts; a++) {
      const angle = Math.random() * Math.PI * 2;
      const r = randRange(rMin, rMax);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const candidate = new THREE.Vector2(x, z);

      let tooClose = false;
      for (const p of points) {
        if (candidate.distanceTo(p) < minSep) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        points.push(candidate);
        result.push(candidate);
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
  return result;
}

// ─── Landmarks — Architectural forms in deep indigo ──────────────────
// Medium-sized, intentionally placed. They define the space
// like columns in a cathedral — structural, not decorative.

function createLandmarks(group: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  const mat = (color: number) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

  // Tall pillar — back left
  const pillar1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 4.0, 6),
    mat(0x18123a),
  );
  pillar1.position.set(-10, 2.0, -6);
  pillar1.receiveShadow = true;
  meshes.push(pillar1);

  // Tall pillar — back right
  const pillar2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 3.5, 6),
    mat(0x1a1440),
  );
  pillar2.position.set(12, 1.75, -4);
  pillar2.receiveShadow = true;
  meshes.push(pillar2);

  // Low arch — mid left
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.12, 10, 20),
    mat(0x201848),
  );
  arch.position.set(-8, 1.0, 8);
  arch.rotation.x = Math.PI / 2;
  arch.receiveShadow = true;
  meshes.push(arch);

  // Faceted boulder — far back center-right
  const boulder = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 0),
    mat(0x141030),
  );
  boulder.position.set(6, 1.0, -12);
  boulder.receiveShadow = true;
  meshes.push(boulder);

  // Obelisk — far right
  const obelisk = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 3.2, 4),
    mat(0x161238),
  );
  obelisk.position.set(16, 1.6, 6);
  obelisk.receiveShadow = true;
  meshes.push(obelisk);

  // Low slab — near left (warm accent — links to hero)
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.4, 0.6),
    mat(0x3a1818),
  );
  slab.position.set(-12, 0.2, -10);
  slab.receiveShadow = true;
  meshes.push(slab);

  // Crystal — far back left (warm accent)
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    mat(0x382010),
  );
  crystal.position.set(-14, 0.7, -12);
  crystal.receiveShadow = true;
  meshes.push(crystal);

  for (const m of meshes) {
    group.add(m);
  }

  return meshes;
}

// ─── Instanced Scatter ────────────────────────────────────────────────
// Small forms in deep indigo. They give the shader texture across
// the frame — the halftone and outlines pick them up as silhouettes.

interface ScatterGroup {
  mesh: THREE.InstancedMesh;
}

function createScatter(
  group: THREE.Group,
  ring: 'near' | 'far',
): ScatterGroup[] {
  const isNear = ring === 'near';
  const count = isNear ? 18 : 14;
  const rMin = isNear ? 9 : 20;
  const rMax = isNear ? 20 : 38;
  const scaleMin = isNear ? 0.12 : 0.3;
  const scaleMax = isNear ? 0.4 : 1.2;
  const minSep = isNear ? 2.0 : 3.0;

  const geos: THREE.BufferGeometry[] = isNear
    ? [
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.TetrahedronGeometry(0.5, 0),
      ]
    : [
        new THREE.CylinderGeometry(0.2, 0.25, 2.5, 6),
        new THREE.IcosahedronGeometry(0.8, 0),
        new THREE.ConeGeometry(0.35, 2.0, 5),
      ];

  const perType = Math.ceil(count / geos.length);
  const existingPositions: THREE.Vector2[] = [];
  const groups: ScatterGroup[] = [];
  const dummy = new THREE.Object3D();

  for (let gi = 0; gi < geos.length; gi++) {
    const geo = geos[gi];
    const typeCount = Math.min(perType, count - gi * perType);
    if (typeCount <= 0) continue;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    const instMesh = new THREE.InstancedMesh(geo, mat, typeCount);
    instMesh.receiveShadow = true;

    const points = poissonPoints(typeCount, rMin, rMax, minSep, existingPositions);
    existingPositions.push(...points);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const s = randRange(scaleMin, scaleMax);

      dummy.position.set(p.x, isNear ? s * 0.5 : s * 0.6, p.y);
      dummy.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);

      const color = new THREE.Color(envColor());
      instMesh.setColorAt(i, color);
    }

    for (let i = points.length; i < typeCount; i++) {
      dummy.position.set(0, -100, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }

    instMesh.instanceMatrix.needsUpdate = true;
    if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;

    group.add(instMesh);
    groups.push({ mesh: instMesh });
  }

  return groups;
}

// ─── Floating objects ─────────────────────────────────────────────────

interface FloatingObject {
  mesh: THREE.Mesh;
  baseY: number;
  bobSpeed: number;
  bobAmp: number;
}

function createFloaters(group: THREE.Group): FloatingObject[] {
  const floaters: FloatingObject[] = [];
  const geos = [
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.TetrahedronGeometry(0.18, 0),
    new THREE.OctahedronGeometry(0.14, 0),
  ];

  const count = 4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = randRange(8, 22);
    const baseY = randRange(3, 5.5);

    const geo = pick(geos);
    const mat = new THREE.MeshStandardMaterial({
      color: envColor(),
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.cos(angle) * r, baseY, Math.sin(angle) * r);
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    mesh.receiveShadow = true;
    group.add(mesh);

    floaters.push({
      mesh,
      baseY,
      bobSpeed: randRange(0.2, 0.4),
      bobAmp: randRange(0.15, 0.35),
    });
  }

  return floaters;
}

// ─── Animated landmarks ───────────────────────────────────────────────

interface AnimatedLandmark {
  mesh: THREE.Mesh;
  rotSpeed: number;
  bobSpeed: number;
  bobAmp: number;
  baseY: number;
}

// ═══════════════════════════════════════════════════════════════════════

export class ComicEnvironment {
  group: THREE.Group;
  private floaters: FloatingObject[] = [];
  private animatedLandmarks: AnimatedLandmark[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const landmarks = createLandmarks(this.group);

    // Animate 2 landmarks — very slow, barely perceptible
    const animIndices = [0, 4];
    for (const idx of animIndices) {
      if (landmarks[idx]) {
        this.animatedLandmarks.push({
          mesh: landmarks[idx],
          rotSpeed: randRange(0.02, 0.06),
          bobSpeed: randRange(0.1, 0.25),
          bobAmp: randRange(0.02, 0.06),
          baseY: landmarks[idx].position.y,
        });
      }
    }

    createScatter(this.group, 'near');
    createScatter(this.group, 'far');
    this.floaters = createFloaters(this.group);
  }

  update(_dt: number) {
    const t = performance.now() * 0.001;

    for (const f of this.floaters) {
      f.mesh.position.y = f.baseY + Math.sin(t * f.bobSpeed) * f.bobAmp;
      f.mesh.rotation.y += 0.002;
    }

    for (const lm of this.animatedLandmarks) {
      lm.mesh.rotation.y = t * lm.rotSpeed;
      lm.mesh.position.y = lm.baseY + Math.sin(t * lm.bobSpeed) * lm.bobAmp;
    }
  }
}
