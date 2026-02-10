import { Engine } from './engine/Engine';
import { ComicScene } from './comic/ComicScene';
import { ComicPass } from './comic/ComicPass';
import GUI from 'lil-gui';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const engine = new Engine(canvas);
const comicScene = new ComicScene(engine.scene);
const comicPass = new ComicPass(engine.scene, engine.camera);
comicPass.renderToScreen = true;
engine.addPass(comicPass);

const u = comicPass.uniforms;

// ─── Presets ────────────────────────────────────────

interface Preset {
  name: string;
  values: Record<string, number>;
}

const presets: Preset[] = [
  {
    name: 'Comic Book',
    values: {
      uOutlineThickness: 1.2, uOutlineThreshold: 0.45,
      uCelBands: 4, uHalftoneSize: 5, uHalftoneAngle: 0.52,
      uSaturationBoost: 0.4, uWobbleAmount: 2.0, uWobbleFreq: 12,
      uCmykOffset: 2.5, uPaperStrength: 0.4,
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
    name: 'Vintage Print',
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
  0: 2, // Comic Book → Noir
  1: 3, // Pop Art → Manga
  2: 1, // Noir → Pop Art
  3: 0, // Manga → Comic Book
  4: 5, // Vintage Print → Clean
  5: 4, // Clean → Vintage Print
};

let activePresetIndex = 0;

function setLensPreset(preset: Preset) {
  const v = preset.values;
  for (const key of Object.keys(v)) {
    const lensKey = 'uL' + key.slice(1); // uOutlineThickness → uLOutlineThickness
    if (u[lensKey]) {
      (u[lensKey] as { value: number }).value = v[key];
    }
  }
}

let presetAnimationId: number | null = null;

function applyPreset(preset: Preset, animate = true) {
  // Cancel any in-flight preset animation
  if (presetAnimationId !== null) {
    cancelAnimationFrame(presetAnimationId);
    presetAnimationId = null;
  }

  const duration = animate ? 600 : 0;
  const start: Record<string, number> = {};
  const target = preset.values;

  for (const key of Object.keys(target)) {
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
    // Ease out cubic
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

// ─── Preset buttons ─────────────────────────────────

const presetsEl = document.getElementById('presets')!;
let activeBtn: HTMLElement | null = null;

presets.forEach((preset, i) => {
  const btn = document.createElement('button');
  btn.className = 'preset-btn' + (i === 0 ? ' active' : '');
  btn.textContent = preset.name;
  btn.addEventListener('click', () => {
    if (activeBtn) activeBtn.classList.remove('active');
    btn.classList.add('active');
    activeBtn = btn;
    activePresetIndex = i;
    applyPreset(preset);
    setLensPreset(presets[contrastMap[i]]);
  });
  presetsEl.appendChild(btn);
  if (i === 0) activeBtn = btn;
});

// ─── GUI ─────────────────────────────────────────────

const gui = new GUI({ title: 'Controls' });

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

// Close less important folders by default
f4.close();
f5.close();
f6.close();
f7.close();

function updateGuiFromUniforms() {
  for (const [uniform, ctrl] of Object.entries(guiControllers)) {
    const val = (u[uniform] as { value: number }).value;
    // Toggle controllers use boolean display
    if (uniform.startsWith('uEnable')) {
      ctrl.setValue(val > 0.5);
    } else {
      ctrl.setValue(val);
    }
  }
}

// ─── Reveal animation ────────────────────────────────

// Start with raw 3D, then animate effects on
const rawValues: Record<string, number> = {
  uEnableOutlines: 0, uEnableCelShading: 0, uEnableHalftone: 0,
  uEnableWobble: 0, uEnableCmyk: 0, uEnablePaper: 0,
  uSaturationBoost: 0, uOutlineThickness: 0, uCelBands: 4,
  uHalftoneSize: 5, uHalftoneAngle: 0.52, uWobbleAmount: 0,
  uWobbleFreq: 12, uCmykOffset: 0, uPaperStrength: 0,
  uOutlineThreshold: 0.35,
};

// Apply raw state immediately
for (const [key, val] of Object.entries(rawValues)) {
  (u[key] as { value: number }).value = val;
}

const flash = document.getElementById('flash')!;

// After a brief moment, reveal the comic effect
setTimeout(() => {
  flash.classList.add('visible');
  setTimeout(() => {
    applyPreset(presets[0], false);
    updateGuiFromUniforms();
    setLensPreset(presets[contrastMap[0]]);
    flash.classList.remove('visible');
  }, 300);
}, 1200);

// ─── Lens mode toggle ───────────────────────────────

const lensModes = ['PENCIL', 'X-RAY', 'VOID'];
let lensMode = 0;

const lensModeEl = document.createElement('div');
lensModeEl.id = 'lens-mode';
lensModeEl.textContent = lensModes[0];
lensModeEl.addEventListener('click', () => {
  lensMode = (lensMode + 1) % 3;
  u.uLensMode.value = lensMode;
  lensModeEl.textContent = lensModes[lensMode];
});
document.getElementById('overlay')!.appendChild(lensModeEl);

window.addEventListener('keydown', (e) => {
  if (e.key === '1') { lensMode = 0; }
  else if (e.key === '2') { lensMode = 1; }
  else if (e.key === '3') { lensMode = 2; }
  else return;
  u.uLensMode.value = lensMode;
  lensModeEl.textContent = lensModes[lensMode];
});

// ─── Mouse interaction (click-and-hold lens) ─────────

const mousePos = { x: 0.5, y: 0.5 };
const prevMousePos = { x: 0.5, y: 0.5 };
const smoothMouse = { x: 0.5, y: 0.5 };
let lensActive = false;
let currentLensRadius = 0.0;
let lensRadiusVel = 0.0;
const lensRadius = 0.08;
const smoothVel = { x: 0, y: 0 };

// Always track mouse position
window.addEventListener('mousemove', (e) => {
  mousePos.x = e.clientX / window.innerWidth;
  mousePos.y = 1.0 - e.clientY / window.innerHeight;
});

// Lens appears on press, disappears on release
window.addEventListener('mousedown', (e) => {
  // Ignore clicks on UI elements
  if ((e.target as HTMLElement).closest('#overlay, .lil-gui')) return;
  lensActive = true;
});
window.addEventListener('mouseup', () => { lensActive = false; });

// Touch: lens on press, follows finger, gone on lift
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

// ─── Auto-orbit camera ──────────────────────────────

let autoOrbit = true;

// Stop auto-orbit on user interaction
engine.controls.addEventListener('start', () => {
  autoOrbit = false;
});

// Start
engine.start((dt) => {
  comicScene.update(dt);
  const safeDt = Math.min(Math.max(dt, 0.001), 0.05); // clamp: avoid div-by-zero on first frame

  // ── Mouse follow: adaptive lerp (snaps when far, settles when close) ──
  const distToTarget = Math.hypot(mousePos.x - smoothMouse.x, mousePos.y - smoothMouse.y);
  const followRate = 8 + distToTarget * 40; // faster when further away
  const followFactor = 1 - Math.exp(-followRate * safeDt);
  smoothMouse.x += (mousePos.x - smoothMouse.x) * followFactor;
  smoothMouse.y += (mousePos.y - smoothMouse.y) * followFactor;
  u.uMouse.value.set(smoothMouse.x, smoothMouse.y);

  // ── Velocity: asymmetric attack/decay (frame-rate independent) ──
  const rawVelX = (smoothMouse.x - prevMousePos.x) / safeDt;
  const rawVelY = (smoothMouse.y - prevMousePos.y) / safeDt;
  const rawSpeed = Math.hypot(rawVelX, rawVelY);
  const curSpeed = Math.hypot(smoothVel.x, smoothVel.y);
  // Fast attack when accelerating, slow organic decay when settling
  const isAccel = rawSpeed > curSpeed;
  const velRate = isAccel ? 12 : 4;
  const velFactor = 1 - Math.exp(-velRate * safeDt);
  smoothVel.x += (rawVelX - smoothVel.x) * velFactor;
  smoothVel.y += (rawVelY - smoothVel.y) * velFactor;
  u.uMouseVel.value.set(smoothVel.x, smoothVel.y);
  prevMousePos.x = smoothMouse.x;
  prevMousePos.y = smoothMouse.y;

  // ── Lens radius: spring physics (pops open on press, snaps shut on release) ──
  const targetR = lensActive ? lensRadius : 0.0;

  // Underdamped spring: slight overshoot on appear, elastic settle
  const stiffness = 160;
  const damping = 17;
  const springForce = (targetR - currentLensRadius) * stiffness;
  const dampForce = -lensRadiusVel * damping;
  lensRadiusVel += (springForce + dampForce) * safeDt;
  currentLensRadius += lensRadiusVel * safeDt;
  currentLensRadius = Math.max(0, currentLensRadius);
  // Hard cutoff: kill residual spring oscillation so lens fully vanishes
  if (!lensActive && currentLensRadius < 0.005) {
    currentLensRadius = 0;
    lensRadiusVel = 0;
  }
  u.uLensRadius.value = currentLensRadius;

  // ── Camera orbit: layered sine waves for organic drift ──
  if (autoOrbit) {
    const t = performance.now() * 0.001;
    const radius = 9;
    const angle = t * 0.12 + Math.sin(t * 0.037) * 0.15;
    engine.camera.position.x = Math.sin(angle) * radius;
    engine.camera.position.z = Math.cos(angle) * radius;
    engine.camera.position.y = 4 + Math.sin(t * 0.08) * 0.4 + Math.sin(t * 0.031) * 0.2;
    engine.camera.lookAt(0, 1.5, 0);
  }
});
