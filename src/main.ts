import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Engine } from './engine/Engine';
import { ComicScene } from './comic/ComicScene';
import { ComicPass } from './comic/ComicPass';
import { ComicEnvironment } from './comic/ComicEnvironment';
import GUI from 'lil-gui';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const engine = new Engine(canvas);
const comicScene = new ComicScene(engine.scene);
const comicEnvironment = new ComicEnvironment(engine.scene);
const comicPass = new ComicPass(engine.scene, engine.camera);
comicPass.renderToScreen = true;
engine.addPass(comicPass);

const u = comicPass.uniforms;

// Pixel-dependent uniforms need DPR scaling so effects look the same on Retina
const dpr = Math.min(window.devicePixelRatio, 2);
const pixelScaledUniforms = new Set([
  'uHalftoneSize', 'uOutlineThickness', 'uWobbleAmount', 'uCmykOffset',
]);

// ─── Presets ────────────────────────────────────────

interface Preset {
  name: string;
  values: Record<string, number>;
}

const presets: Preset[] = [
  {
    name: 'Comic Book',
    values: {
      uOutlineThickness: 1.4, uOutlineThreshold: 0.4,
      uCelBands: 4, uHalftoneSize: 6, uHalftoneAngle: 0.52,
      uSaturationBoost: 0.75, uWobbleAmount: 2.5, uWobbleFreq: 12,
      uCmykOffset: 3.0, uPaperStrength: 0.45,
      uEnableOutlines: 1, uEnableCelShading: 1, uEnableHalftone: 1,
      uEnableWobble: 1, uEnableCmyk: 1, uEnablePaper: 1,
    },
  },
  {
    name: 'Pop Art',
    values: {
      uOutlineThickness: 2.0, uOutlineThreshold: 0.4,
      uCelBands: 3, uHalftoneSize: 10, uHalftoneAngle: 0.26,
      uSaturationBoost: 0.8, uWobbleAmount: 0, uWobbleFreq: 12,
      uCmykOffset: 5, uPaperStrength: 0.1,
      uEnableOutlines: 1, uEnableCelShading: 1, uEnableHalftone: 1,
      uEnableWobble: 0, uEnableCmyk: 1, uEnablePaper: 0,
    },
  },
  {
    name: 'Noir',
    values: {
      uOutlineThickness: 1.5, uOutlineThreshold: 0.3,
      uCelBands: 3, uHalftoneSize: 4, uHalftoneAngle: 0.78,
      uSaturationBoost: -0.85, uWobbleAmount: 3.0, uWobbleFreq: 8,
      uCmykOffset: 0, uPaperStrength: 0.6,
      uEnableOutlines: 1, uEnableCelShading: 1, uEnableHalftone: 1,
      uEnableWobble: 1, uEnableCmyk: 0, uEnablePaper: 1,
    },
  },
  {
    name: 'Manga',
    values: {
      uOutlineThickness: 1.3, uOutlineThreshold: 0.35,
      uCelBands: 4, uHalftoneSize: 3.5, uHalftoneAngle: 0.78,
      uSaturationBoost: -1.0, uWobbleAmount: 1.5, uWobbleFreq: 18,
      uCmykOffset: 0, uPaperStrength: 0.25,
      uEnableOutlines: 1, uEnableCelShading: 1, uEnableHalftone: 1,
      uEnableWobble: 1, uEnableCmyk: 0, uEnablePaper: 1,
    },
  },
  {
    name: 'Vintage',
    values: {
      uOutlineThickness: 0.7, uOutlineThreshold: 0.55,
      uCelBands: 5, uHalftoneSize: 4, uHalftoneAngle: 0.35,
      uSaturationBoost: 0.1, uWobbleAmount: 1.0, uWobbleFreq: 6,
      uCmykOffset: 4, uPaperStrength: 0.8,
      uEnableOutlines: 1, uEnableCelShading: 1, uEnableHalftone: 1,
      uEnableWobble: 1, uEnableCmyk: 1, uEnablePaper: 1,
    },
  },
  {
    name: 'Clean',
    values: {
      uOutlineThickness: 1.0, uOutlineThreshold: 0.45,
      uCelBands: 5, uHalftoneSize: 5, uHalftoneAngle: 0.52,
      uSaturationBoost: 0.25, uWobbleAmount: 0, uWobbleFreq: 12,
      uCmykOffset: 0, uPaperStrength: 0,
      uEnableOutlines: 1, uEnableCelShading: 1, uEnableHalftone: 0,
      uEnableWobble: 0, uEnableCmyk: 0, uEnablePaper: 0,
    },
  },
];

// Contrasting preset pairs for lens effect
const contrastMap: Record<number, number> = {
  0: 2, 1: 3, 2: 1, 3: 0, 4: 5, 5: 4,
};

let activePresetIndex = 0;

function setLensPreset(preset: Preset) {
  const v = preset.values;
  for (const key of Object.keys(v)) {
    const lensKey = 'uL' + key.slice(1);
    if (u[lensKey]) {
      const scale = pixelScaledUniforms.has(key) ? dpr : 1;
      (u[lensKey] as { value: number }).value = v[key] * scale;
    }
  }
}

let presetAnimationId: number | null = null;

const heroTitle = document.getElementById('hero-title')!;
const titleText = document.getElementById('title-text')!;

function applyPreset(preset: Preset, animate = true) {
  if (presetAnimationId !== null) {
    cancelAnimationFrame(presetAnimationId);
    presetAnimationId = null;
  }

  // Update hero title with comic pop
  if (animate) {
    heroTitle.classList.add('fade-out');
    setTimeout(() => {
      titleText.textContent = preset.name.toUpperCase();
      heroTitle.classList.remove('fade-out');
      heroTitle.classList.remove('pop-in');
      void heroTitle.offsetWidth;
      heroTitle.classList.add('pop-in');
    }, 250);
  } else {
    titleText.textContent = preset.name.toUpperCase();
  }

  // Shader uniform animation — scale pixel-dependent values by DPR
  const duration = animate ? 600 : 0;
  const start: Record<string, number> = {};
  const target: Record<string, number> = {};

  for (const key of Object.keys(preset.values)) {
    const scale = pixelScaledUniforms.has(key) ? dpr : 1;
    target[key] = preset.values[key] * scale;
    start[key] = (u[key] as { value: number }).value;
  }

  if (duration === 0) {
    for (const key of Object.keys(target)) {
      (u[key] as { value: number }).value = target[key];
    }
    updateGuiFromUniforms();
    return;
  }

  const startTime = performance.now();
  function step() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const e = 1 - Math.pow(1 - t, 3);

    for (const key of Object.keys(target)) {
      (u[key] as { value: number }).value = start[key] + (target[key] - start[key]) * e;
    }

    if (t < 1) {
      presetAnimationId = requestAnimationFrame(step);
    } else {
      presetAnimationId = null;
      updateGuiFromUniforms();
    }
  }
  presetAnimationId = requestAnimationFrame(step);
}

// ─── Preset pill bar ─────────────────────────────────

const presetsEl = document.getElementById('presets')!;
let activeBtn: HTMLElement | null = null;

presets.forEach((preset, i) => {
  const btn = document.createElement('button');
  btn.className = 'preset-btn' + (i === 0 ? ' active' : '');
  btn.textContent = preset.name;
  btn.addEventListener('click', () => {
    if (activeBtn) activeBtn.classList.remove('active');
    btn.classList.add('active');
    // Pop animation
    btn.classList.remove('pop');
    void btn.offsetWidth; // force reflow to restart animation
    btn.classList.add('pop');
    activeBtn = btn;
    activePresetIndex = i;
    applyPreset(preset);
    setLensPreset(presets[contrastMap[i]]);
  });
  presetsEl.appendChild(btn);
  if (i === 0) activeBtn = btn;
});

// ─── GUI (inside controls drawer) ───────────────────

const drawerInner = document.getElementById('controls-drawer-inner')!;
const gui = new GUI({ container: drawerInner, title: 'Controls' });

const guiControllers: Record<string, ReturnType<typeof gui.add>> = {};

function addToggle(folder: GUI, label: string, uniform: string) {
  const obj = { [label]: (u[uniform] as { value: number }).value > 0.5 };
  const ctrl = folder.add(obj, label).onChange((v: boolean) => {
    (u[uniform] as { value: number }).value = v ? 1.0 : 0.0;
  });
  guiControllers[uniform] = ctrl;
  return ctrl;
}

function addSlider(folder: GUI, label: string, uniform: string, min: number, max: number, step: number) {
  const obj = { [label]: (u[uniform] as { value: number }).value };
  const ctrl = folder.add(obj, label, min, max, step).onChange((v: number) => {
    (u[uniform] as { value: number }).value = v;
  });
  guiControllers[uniform] = ctrl;
  return ctrl;
}

const f1 = gui.addFolder('Outlines');
addToggle(f1, 'Enable', 'uEnableOutlines');
addSlider(f1, 'Thickness', 'uOutlineThickness', 0.3, 4.0, 0.1);
addSlider(f1, 'Threshold', 'uOutlineThreshold', 0.05, 1.0, 0.01);

const f2 = gui.addFolder('Cel Shading');
addToggle(f2, 'Enable', 'uEnableCelShading');
addSlider(f2, 'Bands', 'uCelBands', 2, 8, 1);

const f3 = gui.addFolder('Halftone');
addToggle(f3, 'Enable', 'uEnableHalftone');
addSlider(f3, 'Dot Size', 'uHalftoneSize', 2, 20, 0.5);
addSlider(f3, 'Angle', 'uHalftoneAngle', 0, 1.57, 0.01);

const f4 = gui.addFolder('Hand-drawn');
addToggle(f4, 'Enable', 'uEnableWobble');
addSlider(f4, 'Amount', 'uWobbleAmount', 0, 8, 0.1);
addSlider(f4, 'Frequency', 'uWobbleFreq', 4, 40, 1);

const f5 = gui.addFolder('CMYK Misregistration');
addToggle(f5, 'Enable', 'uEnableCmyk');
addSlider(f5, 'Offset', 'uCmykOffset', 0, 10, 0.5);

const f6 = gui.addFolder('Paper');
addToggle(f6, 'Enable', 'uEnablePaper');
addSlider(f6, 'Strength', 'uPaperStrength', 0, 1, 0.05);

const f7 = gui.addFolder('Color');
addSlider(f7, 'Saturation', 'uSaturationBoost', -1, 1, 0.05);

f4.close();
f5.close();
f6.close();
f7.close();

function updateGuiFromUniforms() {
  for (const [uniform, ctrl] of Object.entries(guiControllers)) {
    const val = (u[uniform] as { value: number }).value;
    if (uniform.startsWith('uEnable')) {
      ctrl.setValue(val > 0.5);
    } else {
      ctrl.setValue(val);
    }
  }
}

// ─── Controls drawer toggle ──────────────────────────

const controlsToggle = document.getElementById('controls-toggle')!;
const controlsDrawer = document.getElementById('controls-drawer')!;

controlsToggle.addEventListener('click', () => {
  const isOpen = controlsDrawer.classList.toggle('open');
  controlsToggle.classList.toggle('active', isOpen);
});

// ─── Compare toggle (hold to show raw 3D) ───────────

const compareEl = document.getElementById('compare')!;
let shaderEnabled = true;

compareEl.addEventListener('mousedown', (e) => {
  e.preventDefault();
  shaderEnabled = false;
  compareEl.classList.add('active');
});

window.addEventListener('mouseup', () => {
  if (!shaderEnabled) {
    shaderEnabled = true;
    compareEl.classList.remove('active');
  }
});

compareEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  shaderEnabled = false;
  compareEl.classList.add('active');
});

window.addEventListener('touchend', () => {
  if (!shaderEnabled) {
    shaderEnabled = true;
    compareEl.classList.remove('active');
  }
});

// ─── Model Switcher ──────────────────────────────────

interface ModelEntry {
  name: string;
  url: string | null; // null = primitives scene
}

const models: ModelEntry[] = [
  { name: 'Primitives', url: null },
  { name: 'Helmet', url: '/models/DamagedHelmet.glb' },
];

let activeModelIndex = 0;
let loadedModel: THREE.Group | null = null;
let isTransitioning = false;
const gltfLoader = new GLTFLoader();

const modelBtn = document.getElementById('model-btn')!;

modelBtn.addEventListener('click', () => {
  if (isTransitioning) return;
  const nextIndex = (activeModelIndex + 1) % models.length;
  switchModel(nextIndex);
});

function switchModel(index: number) {
  if (index === activeModelIndex || isTransitioning) return;
  isTransitioning = true;

  const targetEntry = models[index];
  const currentGroup = activeModelIndex === 0 ? comicScene.group : loadedModel;

  // Scale down current
  animateScale(currentGroup, 1, 0, 300, () => {
    // Hide current
    if (currentGroup) currentGroup.visible = false;

    if (targetEntry.url === null) {
      // Show primitives
      comicScene.group.visible = true;
      animateScale(comicScene.group, 0, 1, 400, () => {
        activeModelIndex = index;
        isTransitioning = false;
        modelBtn.textContent = targetEntry.name.toUpperCase();
      });
    } else {
      // Load or show GLTF model
      if (loadedModel) {
        loadedModel.visible = true;
        animateScale(loadedModel, 0, 1, 400, () => {
          activeModelIndex = index;
          isTransitioning = false;
          modelBtn.textContent = targetEntry.name.toUpperCase();
        });
      } else {
        gltfLoader.load(targetEntry.url, (gltf) => {
          loadedModel = new THREE.Group();
          const model = gltf.scene;

          // Center and scale the helmet
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 4.0 / maxDim;
          model.scale.setScalar(scale);
          model.position.sub(center.multiplyScalar(scale));
          model.position.y += 2.0; // Lift to eye level

          // Enable shadows on all meshes
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          loadedModel.add(model);
          engine.scene.add(loadedModel);

          animateScale(loadedModel, 0, 1, 400, () => {
            activeModelIndex = index;
            isTransitioning = false;
            modelBtn.textContent = targetEntry.name.toUpperCase();
          });
        });
      }
    }
  });
}

function animateScale(
  target: THREE.Object3D | null,
  from: number,
  to: number,
  duration: number,
  onComplete: () => void
) {
  if (!target) { onComplete(); return; }
  const startTime = performance.now();
  target.scale.setScalar(from);

  function tick() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const e = 1 - Math.pow(1 - t, 3);
    const s = from + (to - from) * e;
    target!.scale.setScalar(s);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      target!.scale.setScalar(to);
      onComplete();
    }
  }
  requestAnimationFrame(tick);
}

// ─── Reveal animation ────────────────────────────────

const rawValues: Record<string, number> = {
  uEnableOutlines: 0, uEnableCelShading: 0, uEnableHalftone: 0,
  uEnableWobble: 0, uEnableCmyk: 0, uEnablePaper: 0,
  uSaturationBoost: 0, uOutlineThickness: 0, uCelBands: 4,
  uHalftoneSize: 5, uHalftoneAngle: 0.52, uWobbleAmount: 0,
  uWobbleFreq: 12, uCmykOffset: 0, uPaperStrength: 0,
  uOutlineThreshold: 0.35,
};

for (const [key, val] of Object.entries(rawValues)) {
  (u[key] as { value: number }).value = val;
}

const flash = document.getElementById('flash')!;

setTimeout(() => {
  flash.classList.add('visible');
  setTimeout(() => {
    applyPreset(presets[0], false);
    updateGuiFromUniforms();
    setLensPreset(presets[contrastMap[0]]);
    flash.classList.remove('visible');
  }, 300);
}, 1200);

// ─── Mouse interaction (click-and-hold lens) ─────────

const mousePos = { x: 0.5, y: 0.5 };
const prevMousePos = { x: 0.5, y: 0.5 };
const smoothMouse = { x: 0.5, y: 0.5 };
let lensActive = false;
let currentLensRadius = 0.0;
let lensRadiusVel = 0.0;
const lensRadius = 0.08;
const smoothVel = { x: 0, y: 0 };

window.addEventListener('mousemove', (e) => {
  mousePos.x = e.clientX / window.innerWidth;
  mousePos.y = 1.0 - e.clientY / window.innerHeight;
});

window.addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).closest('#overlay, .lil-gui')) return;
  lensActive = true;
});
window.addEventListener('mouseup', () => { lensActive = false; });

window.addEventListener('touchstart', (e) => {
  if ((e.target as HTMLElement).closest('#overlay, .lil-gui')) return;
  lensActive = true;
  const touch = e.touches[0];
  mousePos.x = touch.clientX / window.innerWidth;
  mousePos.y = 1.0 - touch.clientY / window.innerHeight;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  const touch = e.touches[0];
  mousePos.x = touch.clientX / window.innerWidth;
  mousePos.y = 1.0 - touch.clientY / window.innerHeight;
}, { passive: true });

window.addEventListener('touchend', () => { lensActive = false; }, { passive: true });
window.addEventListener('touchcancel', () => { lensActive = false; }, { passive: true });

// ─── Auto-orbit camera (smooth pause/resume) ────────

let orbitAngle = 0;
let orbitSpeed = 1.0;
let orbitBobPhase = 0;
let orbitDriftPhase = 0;
let userDragging = false;

engine.controls.addEventListener('start', () => { userDragging = true; });
engine.controls.addEventListener('end', () => { userDragging = false; });

// ─── Cursor parallax (subtle camera offset) ─────────

const baseCameraTarget = new THREE.Vector3(0, 1.8, 0);
const parallaxStrength = 0.03; // ~2-3 degrees max

// ─── Render loop ─────────────────────────────────────

engine.start((dt) => {
  comicScene.update(dt);
  comicEnvironment.update(dt);
  const safeDt = Math.min(Math.max(dt, 0.001), 0.05);

  // Mouse follow
  const distToTarget = Math.hypot(mousePos.x - smoothMouse.x, mousePos.y - smoothMouse.y);
  const followRate = 8 + distToTarget * 40;
  const followFactor = 1 - Math.exp(-followRate * safeDt);
  smoothMouse.x += (mousePos.x - smoothMouse.x) * followFactor;
  smoothMouse.y += (mousePos.y - smoothMouse.y) * followFactor;
  u.uMouse.value.set(smoothMouse.x, smoothMouse.y);

  // Velocity
  const rawVelX = (smoothMouse.x - prevMousePos.x) / safeDt;
  const rawVelY = (smoothMouse.y - prevMousePos.y) / safeDt;
  const rawSpeed = Math.hypot(rawVelX, rawVelY);
  const curSpeed = Math.hypot(smoothVel.x, smoothVel.y);
  const isAccel = rawSpeed > curSpeed;
  const velRate = isAccel ? 12 : 4;
  const velFactor = 1 - Math.exp(-velRate * safeDt);
  smoothVel.x += (rawVelX - smoothVel.x) * velFactor;
  smoothVel.y += (rawVelY - smoothVel.y) * velFactor;
  u.uMouseVel.value.set(smoothVel.x, smoothVel.y);
  prevMousePos.x = smoothMouse.x;
  prevMousePos.y = smoothMouse.y;

  // Lens radius spring
  const targetR = lensActive ? lensRadius : 0.0;
  const stiffness = 160;
  const damping = 17;
  const springForce = (targetR - currentLensRadius) * stiffness;
  const dampForce = -lensRadiusVel * damping;
  lensRadiusVel += (springForce + dampForce) * safeDt;
  currentLensRadius += lensRadiusVel * safeDt;
  currentLensRadius = Math.max(0, currentLensRadius);
  if (!lensActive && currentLensRadius < 0.005) {
    currentLensRadius = 0;
    lensRadiusVel = 0;
  }
  u.uLensRadius.value = currentLensRadius;

  // Camera orbit — smooth pause on hold/drag, resume on release
  const orbitPaused = lensActive || userDragging;
  const orbitTargetSpeed = orbitPaused ? 0 : 1;
  const orbitLerpRate = orbitPaused ? 4.0 : 1.8;
  orbitSpeed += (orbitTargetSpeed - orbitSpeed) * (1 - Math.exp(-orbitLerpRate * safeDt));

  // Advance orbit phases
  const baseOrbitSpeed = 0.12;
  orbitAngle += baseOrbitSpeed * orbitSpeed * safeDt;
  orbitDriftPhase += 0.037 * orbitSpeed * safeDt;
  orbitBobPhase += orbitSpeed * safeDt;

  if (!lensActive && !userDragging && orbitSpeed > 0.01) {
    // Auto-orbit: blend camera toward orbit path
    const radius = 9;
    const angle = orbitAngle + Math.sin(orbitDriftPhase) * 0.15;
    const orbitX = Math.sin(angle) * radius;
    const orbitZ = Math.cos(angle) * radius;
    const orbitY = 5.2 + Math.sin(orbitBobPhase * 0.08) * 0.3 + Math.sin(orbitBobPhase * 0.031) * 0.15;

    const blend = 1 - Math.exp(-8 * orbitSpeed * safeDt);
    engine.camera.position.x += (orbitX - engine.camera.position.x) * blend;
    engine.camera.position.z += (orbitZ - engine.camera.position.z) * blend;
    engine.camera.position.y += (orbitY - engine.camera.position.y) * blend;

    // Parallax lookAt
    const px = (mousePos.x - 0.5) * parallaxStrength;
    const py = (mousePos.y - 0.5) * parallaxStrength;
    engine.camera.lookAt(
      baseCameraTarget.x + px * 10,
      baseCameraTarget.y + py * 6,
      baseCameraTarget.z
    );
  } else {
    // Paused: OrbitControls drives camera. Sync orbit angle for seamless resume.
    orbitAngle = Math.atan2(engine.camera.position.x, engine.camera.position.z);
  }

  // Render: composer (shader) or direct (raw 3D for compare)
  if (shaderEnabled) {
    engine.composer.render();
  } else {
    engine.renderDirect();
  }
});
