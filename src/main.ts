import * as THREE from 'three';
import { Engine } from './engine/Engine';
import { ComicScene } from './comic/ComicScene';
import { HelmetScene } from './comic/HelmetScene';
import { ComicPass } from './comic/ComicPass';
import GUI from 'lil-gui';

// ─── WebGL support check ─────────────────────────────

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

if (!canvas.getContext('webgl2')) {
  document.body.classList.remove('loading');
  const fallback = document.createElement('div');
  fallback.className = 'no-webgl';
  fallback.innerHTML = '<p>Your browser does not support WebGL 2, which is required for this demo.<br>Please try a recent version of Chrome, Firefox, or Safari.</p>';
  document.body.appendChild(fallback);
  throw new Error('WebGL 2 not supported');
}

// ─── Reduced motion preference ───────────────────────

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const engine = new Engine(canvas);
const comicScene = new ComicScene(engine.scene);
const helmetScene = new HelmetScene(engine.scene);
const comicPass = new ComicPass(engine.scene, engine.camera);
comicPass.renderToScreen = true;
engine.addPass(comicPass);

const u = comicPass.uniforms;

// ─── Per-preset scene colors ─────────────────────────

interface PresetColors {
  background: number;
  ground: number;
  fog: number;
  fogDensity: number;
}

interface PresetUI {
  title: string;
  desc: string;
  issueNum: string;
  edition: string;
  frameColor: string;
  mastheadBg: string;
  mastheadText: string;
  captionBg: string;
  captionBorder: string;
  captionText: string;
  sealColor: string;
  ctrlBg: string;
  ctrlBorder: string;
  ctrlAccent: string;
  ctrlText: string;
}

interface Preset {
  name: string;
  values: Record<string, number>;
  colors: PresetColors;
  helmetColors: PresetColors;
  ui: PresetUI;
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
      uHalftoneIntensity: 0.7, uOutlineVariation: 0.8, uSpecularPop: 0.7,
      uRimStrength: 0.3, uRimThreshold: 0.65, uColorPunch: 0.4,
    },
    colors: {
      background: 0xf5f0e8,
      ground: 0xe8dfd0,
      fog: 0xf0ebe0,
      fogDensity: 0.012,
    },
    helmetColors: {
      background: 0x080c1a,
      ground: 0x0a1025,
      fog: 0x060a15,
      fogDensity: 0.025,
    },
    ui: {
      title: 'COMIC BOOK',
      desc: 'Real-time post-processing combining cel shading, Ben-Day halftone, CMYK misregistration, and hand-drawn line wobble.',
      issueNum: 'No.01',
      edition: '1ST ED.',
      frameColor: '#f5f0e1',
      mastheadBg: '#c41e2a',
      mastheadText: '#fff',
      captionBg: '#f7e44c',
      captionBorder: '#1a1a1a',
      captionText: '#1a1a1a',
      sealColor: '#1a8c3f',
      ctrlBg: 'rgba(40, 25, 10, 0.5)',
      ctrlBorder: 'rgba(245, 240, 225, 0.15)',
      ctrlAccent: 'rgba(196, 30, 42, 0.35)',
      ctrlText: 'rgba(255, 255, 255, 0.7)',
    },
  },
  {
    name: 'Pop Art',
    values: {
      uOutlineThickness: 2.0, uOutlineThreshold: 0.35,
      uCelBands: 3, uHalftoneSize: 10, uHalftoneAngle: 0.26,
      uSaturationBoost: 0.8, uWobbleAmount: 0, uWobbleFreq: 12,
      uCmykOffset: 3, uPaperStrength: 0,
      uEnableOutlines: 1, uEnableCelShading: 1, uEnableHalftone: 1,
      uEnableWobble: 0, uEnableCmyk: 1, uEnablePaper: 0,
      uHalftoneIntensity: 0.75, uOutlineVariation: 0.2, uSpecularPop: 0.8,
      uRimStrength: 0.15, uRimThreshold: 0.75, uColorPunch: 0.7,
    },
    colors: {
      background: 0xfff8d0,
      ground: 0xfff0c0,
      fog: 0xfff5d0,
      fogDensity: 0.005,
    },
    helmetColors: {
      background: 0xf0d000,
      ground: 0xe0c400,
      fog: 0xe8cc00,
      fogDensity: 0.008,
    },
    ui: {
      title: 'POP ART',
      desc: 'Bold color blocking with oversized Ben-Day dots and heavy outlines. Warhol meets Lichtenstein.',
      issueNum: 'No.02',
      edition: 'LTD ED.',
      frameColor: '#f8f0d8',
      mastheadBg: '#f7d31e',
      mastheadText: '#1a1a1a',
      captionBg: '#ff3b77',
      captionBorder: '#1a1a1a',
      captionText: '#fff',
      sealColor: '#1a6bcc',
      ctrlBg: 'rgba(50, 35, 10, 0.5)',
      ctrlBorder: 'rgba(248, 240, 216, 0.15)',
      ctrlAccent: 'rgba(247, 211, 30, 0.4)',
      ctrlText: 'rgba(255, 255, 255, 0.7)',
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
      uHalftoneIntensity: 0.4, uOutlineVariation: 1.0, uSpecularPop: 0.5,
      uRimStrength: 0.6, uRimThreshold: 0.55, uColorPunch: 0.0,
    },
    colors: {
      background: 0x252030,
      ground: 0x201820,
      fog: 0x201828,
      fogDensity: 0.035,
    },
    helmetColors: {
      background: 0x04060a,
      ground: 0x060a12,
      fog: 0x030508,
      fogDensity: 0.040,
    },
    ui: {
      title: 'NOIR',
      desc: 'High-contrast black & white with dramatic ink pooling, deep shadows, and textured paper grain.',
      issueNum: 'No.03',
      edition: 'SPECIAL',
      frameColor: '#1a1525',
      mastheadBg: '#1a1525',
      mastheadText: '#a09888',
      captionBg: '#2a2530',
      captionBorder: '#4a4050',
      captionText: '#a09888',
      sealColor: '#4a4050',
      ctrlBg: 'rgba(15, 10, 25, 0.6)',
      ctrlBorder: 'rgba(74, 64, 80, 0.3)',
      ctrlAccent: 'rgba(74, 64, 80, 0.5)',
      ctrlText: 'rgba(160, 152, 136, 0.7)',
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
      uHalftoneIntensity: 0.6, uOutlineVariation: 0.9, uSpecularPop: 0.6,
      uRimStrength: 0.4, uRimThreshold: 0.6, uColorPunch: 0.0,
    },
    colors: {
      background: 0xe8e5e0,
      ground: 0xd8d5d0,
      fog: 0xe0ddd8,
      fogDensity: 0.012,
    },
    helmetColors: {
      background: 0x0a0e18,
      ground: 0x0c1222,
      fog: 0x080c16,
      fogDensity: 0.028,
    },
    ui: {
      title: 'MANGA',
      desc: 'Japanese ink style with fine screentone, crisp edges, and desaturated tonal range.',
      issueNum: 'No.04',
      edition: 'DELUXE',
      frameColor: '#e8e5e0',
      mastheadBg: '#f5f5f0',
      mastheadText: '#1a1a1a',
      captionBg: '#ffffff',
      captionBorder: '#1a1a1a',
      captionText: '#1a1a1a',
      sealColor: '#1a1a1a',
      ctrlBg: 'rgba(20, 20, 20, 0.55)',
      ctrlBorder: 'rgba(200, 200, 200, 0.12)',
      ctrlAccent: 'rgba(26, 26, 26, 0.3)',
      ctrlText: 'rgba(255, 255, 255, 0.7)',
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
      uHalftoneIntensity: 0.8, uOutlineVariation: 0.6, uSpecularPop: 0.3,
      uRimStrength: 0.2, uRimThreshold: 0.7, uColorPunch: 0.3,
    },
    colors: {
      background: 0xd8c8a8,
      ground: 0xc8b898,
      fog: 0xd0c0a5,
      fogDensity: 0.015,
    },
    helmetColors: {
      background: 0x08101a,
      ground: 0x0a1422,
      fog: 0x060c15,
      fogDensity: 0.028,
    },
    ui: {
      title: 'VINTAGE PRINT',
      desc: 'Faded four-color process with heavy paper texture, slight misregistration, and aged yellowing.',
      issueNum: 'No.05',
      edition: 'REPRINT',
      frameColor: '#d8c8a0',
      mastheadBg: '#6b4423',
      mastheadText: '#e8d8b0',
      captionBg: '#e8d8b0',
      captionBorder: '#6b4423',
      captionText: '#3a2a15',
      sealColor: '#6b4423',
      ctrlBg: 'rgba(50, 30, 15, 0.5)',
      ctrlBorder: 'rgba(216, 200, 160, 0.15)',
      ctrlAccent: 'rgba(107, 68, 35, 0.4)',
      ctrlText: 'rgba(255, 255, 255, 0.7)',
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
      uHalftoneIntensity: 0, uOutlineVariation: 0.3, uSpecularPop: 0.8,
      uRimStrength: 0.35, uRimThreshold: 0.6, uColorPunch: 0.15,
    },
    colors: {
      background: 0xf5f5f5,
      ground: 0xeeeeee,
      fog: 0xf2f2f2,
      fogDensity: 0.006,
    },
    helmetColors: {
      background: 0x080c14,
      ground: 0x0a1020,
      fog: 0x080a12,
      fogDensity: 0.020,
    },
    ui: {
      title: 'CLEAN',
      desc: 'Pure cel shading with sharp outlines. No halftone, no paper, no grit \u2014 just clean vector style.',
      issueNum: 'No.06',
      edition: 'VARIANT',
      frameColor: '#ffffff',
      mastheadBg: '#1a1a1a',
      mastheadText: '#fff',
      captionBg: '#f0f0f0',
      captionBorder: '#1a1a1a',
      captionText: '#1a1a1a',
      sealColor: '#1a1a1a',
      ctrlBg: 'rgba(10, 10, 10, 0.45)',
      ctrlBorder: 'rgba(255, 255, 255, 0.1)',
      ctrlAccent: 'rgba(26, 26, 26, 0.3)',
      ctrlText: 'rgba(255, 255, 255, 0.7)',
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
let activeScene = 0;

function setLensPreset(preset: Preset) {
  const v = preset.values;
  for (const key of Object.keys(v)) {
    const lensKey = 'uL' + key.slice(1); // uOutlineThickness → uLOutlineThickness
    if (u[lensKey]) {
      (u[lensKey] as { value: number }).value = v[key];
    }
  }
}

// ─── Color animation state ───────────────────────────

const colorAnim = {
  startBg: new THREE.Color(),
  targetBg: new THREE.Color(),
  startGround: new THREE.Color(),
  targetGround: new THREE.Color(),
  startFog: new THREE.Color(),
  targetFog: new THREE.Color(),
  startFogDensity: 0.012,
  targetFogDensity: 0.012,
  startTime: 0,
  duration: 800,
  active: false,
};

function applyPresetColors(preset: Preset, animate = true) {
  const colors = activeScene === 1 ? preset.helmetColors : preset.colors;
  const bg = engine.scene.background as THREE.Color;
  const fog = engine.scene.fog as THREE.FogExp2;

  colorAnim.startBg.copy(bg);
  colorAnim.targetBg.setHex(colors.background);
  colorAnim.startGround.copy(comicScene.groundMat.color);
  colorAnim.targetGround.setHex(colors.ground);
  colorAnim.startFog.copy(fog.color);
  colorAnim.targetFog.setHex(colors.fog);
  colorAnim.startFogDensity = fog.density;
  colorAnim.targetFogDensity = colors.fogDensity;

  if (!animate) {
    bg.copy(colorAnim.targetBg);
    comicScene.groundMat.color.copy(colorAnim.targetGround);
    helmetScene.groundMat.color.copy(colorAnim.targetGround);
    fog.color.copy(colorAnim.targetFog);
    fog.density = colorAnim.targetFogDensity;
    colorAnim.active = false;
    return;
  }

  colorAnim.startTime = performance.now();
  colorAnim.active = true;
}

function updateColorAnimation() {
  if (!colorAnim.active) return;

  const elapsed = performance.now() - colorAnim.startTime;
  const t = Math.min(elapsed / colorAnim.duration, 1);
  const e = 1 - Math.pow(1 - t, 3); // ease-out cubic

  const bg = engine.scene.background as THREE.Color;
  const fog = engine.scene.fog as THREE.FogExp2;

  bg.copy(colorAnim.startBg).lerp(colorAnim.targetBg, e);
  comicScene.groundMat.color.copy(colorAnim.startGround).lerp(colorAnim.targetGround, e);
  helmetScene.groundMat.color.copy(comicScene.groundMat.color);
  fog.color.copy(colorAnim.startFog).lerp(colorAnim.targetFog, e);
  fog.density = colorAnim.startFogDensity + (colorAnim.targetFogDensity - colorAnim.startFogDensity) * e;

  if (t >= 1) colorAnim.active = false;
}

// ─── Preset UI (title/font/desc swap) ────────────────

const mastheadTitle = document.querySelector('.masthead-title') as HTMLElement;
const mastheadIssue = document.querySelector('.masthead-issue') as HTMLElement;
const mastheadDate = document.querySelector('.masthead-date') as HTMLElement;
const mastheadEdition = document.querySelector('.masthead-edition') as HTMLElement;
const captionP = document.querySelector('#caption p') as HTMLElement;

const coverTextEls = [mastheadTitle, mastheadIssue, mastheadDate, mastheadEdition, captionP];

function setCoverStyles(ui: PresetUI) {
  // Text content
  mastheadTitle.textContent = ui.title;
  mastheadIssue.textContent = ui.issueNum;
  mastheadEdition.textContent = ui.edition;
  captionP.textContent = ui.desc;

  // CSS custom properties on :root — browser resolves + transitions computed values
  const root = document.documentElement.style;
  root.setProperty('--frame-color', ui.frameColor);
  root.setProperty('--masthead-bg', ui.mastheadBg);
  root.setProperty('--masthead-text', ui.mastheadText);
  root.setProperty('--caption-bg', ui.captionBg);
  root.setProperty('--caption-border', ui.captionBorder);
  root.setProperty('--caption-text', ui.captionText);
  root.setProperty('--seal-color', ui.sealColor);
  root.setProperty('--ctrl-bg', ui.ctrlBg);
  root.setProperty('--ctrl-border', ui.ctrlBorder);
  root.setProperty('--ctrl-accent', ui.ctrlAccent);
  root.setProperty('--ctrl-text', ui.ctrlText);
}

function applyPresetUI(ui: PresetUI, animate: boolean) {
  if (!animate) {
    setCoverStyles(ui);
    return;
  }

  // Fade out all text elements (180ms)
  for (const el of coverTextEls) el.style.opacity = '0';

  setTimeout(() => {
    // Swap content & CSS vars while invisible
    setCoverStyles(ui);

    // Fade in (use rAF to ensure style flush)
    requestAnimationFrame(() => {
      for (const el of coverTextEls) el.style.opacity = '1';
    });
  }, 180);
}

// ─── Preset animation ────────────────────────────────

let presetAnimationId: number | null = null;

function applyPreset(preset: Preset, animate = true) {
  if (prefersReducedMotion) animate = false;

  // Cancel any in-flight preset animation
  if (presetAnimationId !== null) {
    cancelAnimationFrame(presetAnimationId);
    presetAnimationId = null;
  }

  // Animate scene colors alongside shader uniforms
  applyPresetColors(preset, animate);

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

// ─── Preset buttons (unified toggle bar) ────────────

const presetsEl = document.getElementById('presets')!;
let activeBtn: HTMLElement | null = null;
const presetBtns: HTMLButtonElement[] = [];

// Cursor-following hover highlight (Apple-style)
const hoverHighlight = document.createElement('div');
hoverHighlight.className = 'preset-hover';
presetsEl.appendChild(hoverHighlight);

// Sliding indicator
const indicator = document.createElement('div');
indicator.className = 'preset-indicator';
presetsEl.appendChild(indicator);

// Preview popup
const previewEl = document.createElement('div');
previewEl.className = 'preset-preview';
const previewImg = document.createElement('img');
previewImg.alt = '';
previewEl.appendChild(previewImg);
presetsEl.appendChild(previewEl);

const previewThumbnails: string[] = [];

function updateIndicator(btn: HTMLElement) {
  indicator.style.left = btn.offsetLeft + 'px';
  indicator.style.width = btn.offsetWidth + 'px';
}

function updateHoverHighlight(btn: HTMLElement) {
  hoverHighlight.style.left = btn.offsetLeft + 'px';
  hoverHighlight.style.width = btn.offsetWidth + 'px';
}

function showPreviewForBtn(btn: HTMLElement, index: number) {
  if (!previewThumbnails[index]) return;
  previewImg.src = previewThumbnails[index];
  const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
  const previewWidth = 200;
  let left = btnCenter - previewWidth / 2;
  left = Math.max(4, Math.min(left, presetsEl.offsetWidth - previewWidth - 4));
  previewEl.style.left = left + 'px';
  previewEl.classList.add('visible');
}

presets.forEach((preset, i) => {
  const btn = document.createElement('button');
  btn.className = 'preset-btn' + (i === 0 ? ' active' : '');
  btn.textContent = preset.name;
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
  btn.setAttribute('aria-label', `${preset.name} preset`);

  btn.addEventListener('click', () => {
    if (activeBtn) {
      activeBtn.classList.remove('active');
      activeBtn.setAttribute('aria-selected', 'false');
    }
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    activeBtn = btn;
    activePresetIndex = i;
    applyPreset(preset);
    applyPresetUI(preset.ui, true);
    setLensPreset(presets[contrastMap[i]]);
    updateIndicator(btn);
  });

  btn.addEventListener('mouseenter', () => {
    updateHoverHighlight(btn);
    hoverHighlight.classList.add('visible');
    showPreviewForBtn(btn, i);
  });

  presetsEl.appendChild(btn);
  presetBtns.push(btn);
  if (i === 0) {
    activeBtn = btn;
    requestAnimationFrame(() => updateIndicator(btn));
  }
});

// Hide hover highlight + preview when leaving the bar entirely
presetsEl.addEventListener('mouseleave', () => {
  hoverHighlight.classList.remove('visible');
  previewEl.classList.remove('visible');
});

// Capture preview thumbnails for each preset
function capturePreviewThumbnails() {
  const origIndex = activePresetIndex;
  const origPreset = presets[origIndex];

  previewThumbnails.length = 0;

  for (let i = 0; i < presets.length; i++) {
    const p = presets[i];
    for (const key of Object.keys(p.values)) {
      (u[key] as { value: number }).value = p.values[key];
    }
    applyPresetColors(p, false);
    engine.composer.render();

    const tmp = document.createElement('canvas');
    tmp.width = 400;
    tmp.height = 260;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    previewThumbnails.push(tmp.toDataURL('image/jpeg', 0.7));
  }

  // Restore original
  for (const key of Object.keys(origPreset.values)) {
    (u[key] as { value: number }).value = origPreset.values[key];
  }
  applyPresetColors(origPreset, false);
  engine.composer.render();
}

// ─── GUI ─────────────────────────────────────────────

const gui = new GUI({ title: 'Controls' });

// Toggle button for GUI visibility
const guiToggle = document.createElement('button');
guiToggle.id = 'gui-toggle';
guiToggle.innerHTML = '&#9881; CONTROLS';
guiToggle.setAttribute('aria-label', 'Toggle shader controls panel');
guiToggle.setAttribute('aria-expanded', 'false');
document.getElementById('overlay')!.appendChild(guiToggle);

// Start hidden
gui.domElement.classList.add('gui-hidden');
let guiVisible = false;

guiToggle.addEventListener('click', () => {
  guiVisible = !guiVisible;
  gui.domElement.classList.toggle('gui-hidden', !guiVisible);
  guiToggle.classList.toggle('active', guiVisible);
  guiToggle.setAttribute('aria-expanded', String(guiVisible));
});

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
addSlider(f1, 'Ink Variation', 'uOutlineVariation', 0, 1, 0.05);

const f2 = gui.addFolder('Cel Shading');
addToggle(f2, 'Enable', 'uEnableCelShading');
addSlider(f2, 'Bands', 'uCelBands', 2, 8, 1);
addSlider(f2, 'Specular Pop', 'uSpecularPop', 0, 1, 0.05);
addSlider(f2, 'Rim Strength', 'uRimStrength', 0, 1, 0.05);
addSlider(f2, 'Rim Threshold', 'uRimThreshold', 0, 1, 0.05);

const f3 = gui.addFolder('Halftone');
addToggle(f3, 'Enable', 'uEnableHalftone');
addSlider(f3, 'Dot Size', 'uHalftoneSize', 2, 20, 0.5);
addSlider(f3, 'Angle', 'uHalftoneAngle', 0, 1.57, 0.01);
addSlider(f3, 'CMYK Intensity', 'uHalftoneIntensity', 0, 1, 0.05);

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
addSlider(f7, 'Color Punch', 'uColorPunch', 0, 1, 0.05);

// ─── Helmet Scene tuning GUI ─────────────────────────
const fHelmet = gui.addFolder('Helmet Scene');
const helmetParams = {
  'Rotation Speed': helmetScene.rotationSpeed,
  'Mtn Brightness': helmetScene.mountainBrightness,
  'Fog Density': 0.025,
};
fHelmet.add(helmetParams, 'Rotation Speed', 0, 0.3, 0.005).onChange((v: number) => {
  helmetScene.rotationSpeed = v;
});
fHelmet.add(helmetParams, 'Mtn Brightness', 0, 0.4, 0.01).onChange((v: number) => {
  helmetScene.mountainBrightness = v;
});
fHelmet.add(helmetParams, 'Fog Density', 0, 0.05, 0.001).onChange((v: number) => {
  (engine.scene.fog as THREE.FogExp2).density = v;
});
fHelmet.open();

// ─── Camera position readout ─────────────────────────
const fCam = gui.addFolder('Camera Position');
const camReadout = { x: 0, y: 0, z: 0, 'Copy Values': () => {
  const pos = engine.camera.position;
  const text = `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
  navigator.clipboard.writeText(text);
  console.log('Camera position:', text);
}};
fCam.add(camReadout, 'x').listen().disable();
fCam.add(camReadout, 'y').listen().disable();
fCam.add(camReadout, 'z').listen().disable();
fCam.add(camReadout, 'Copy Values');
// Close less important folders by default
f3.close();
f4.close();
f5.close();
f6.close();
f7.close();
fHelmet.close();
fCam.close();

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
  uHalftoneIntensity: 0, uOutlineVariation: 0, uSpecularPop: 0,
  uRimStrength: 0, uRimThreshold: 0.65, uColorPunch: 0,
};

// Apply raw state immediately
for (const [key, val] of Object.entries(rawValues)) {
  (u[key] as { value: number }).value = val;
}

// Apply initial colors immediately (no animation)
applyPresetColors(presets[0], false);

const flash = document.getElementById('flash')!;

// After a brief moment, reveal the comic effect
document.body.classList.remove('loading');

if (prefersReducedMotion) {
  // Skip reveal animation — apply immediately
  applyPreset(presets[0], false);
  applyPresetUI(presets[0].ui, false);
  updateGuiFromUniforms();
  setLensPreset(presets[contrastMap[0]]);
  setTimeout(() => capturePreviewThumbnails(), 400);
} else {
  setTimeout(() => {
    flash.classList.add('visible');
    setTimeout(() => {
      applyPreset(presets[0], false);
      applyPresetUI(presets[0].ui, false);
      updateGuiFromUniforms();
      setLensPreset(presets[contrastMap[0]]);
      flash.classList.remove('visible');

      // Capture thumbnails once the scene is revealed
      setTimeout(() => capturePreviewThumbnails(), 800);
    }, 300);
  }, 1200);
}

// ─── Scene switcher ─────────────────────────────────

const sceneNames = ['SHAPES', 'HELMET'];

const sceneContainer = document.createElement('div');
sceneContainer.id = 'lens-modes';
const sceneBtns: HTMLButtonElement[] = [];

function switchScene(index: number) {
  activeScene = index;
  comicScene.setVisible(index === 0);
  helmetScene.setVisible(index === 1);
  sceneBtns.forEach(b => b.classList.remove('active'));
  sceneBtns[index].classList.add('active');
  // Animate bg/fog to the new scene's color palette
  applyPresetColors(presets[activePresetIndex]);
  // Re-capture preview thumbnails for the new scene
  setTimeout(() => capturePreviewThumbnails(), 400);
}

sceneNames.forEach((name, i) => {
  const btn = document.createElement('button');
  btn.className = 'lens-btn' + (i === 0 ? ' active' : '');
  btn.textContent = name;
  btn.setAttribute('aria-label', `Switch to ${name} scene`);
  btn.addEventListener('click', () => switchScene(i));
  sceneContainer.appendChild(btn);
  sceneBtns.push(btn);
});

document.getElementById('overlay')!.appendChild(sceneContainer);

window.addEventListener('keydown', (e) => {
  if (e.key === '1') switchScene(0);
  else if (e.key === '2') switchScene(1);
});

// ─── Compare toggle (hold to see raw 3D) ────────────

let comparing = false;
const compareBtn = document.getElementById('compare')!;

function startCompare() {
  comparing = true;
  compareBtn.classList.add('active');
}
function stopCompare() {
  comparing = false;
  compareBtn.classList.remove('active');
}

compareBtn.addEventListener('mousedown', startCompare);
compareBtn.addEventListener('mouseup', stopCompare);
compareBtn.addEventListener('mouseleave', stopCompare);
compareBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startCompare(); });
compareBtn.addEventListener('touchend', stopCompare);
compareBtn.addEventListener('touchcancel', stopCompare);

window.addEventListener('keydown', (e) => {
  if (e.key === 'c' || e.key === 'C') {
    if (!e.repeat) startCompare();
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (!e.repeat) startCompare();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'c' || e.key === 'C') stopCompare();
  if (e.key === ' ') stopCompare();
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
let orbitAngle = 0.2; // starting angle
let orbitResumeTimer = 0;

const ORBIT_RESUME_DELAY = 4.0; // seconds before auto-orbit resumes

engine.controls.addEventListener('start', () => {
  autoOrbit = false;
  orbitResumeTimer = 0;
});

engine.controls.addEventListener('end', () => {
  orbitResumeTimer = 0;
});

// ─── Render loop ─────────────────────────────────────

engine.start((dt) => {
  if (!prefersReducedMotion) {
    comicScene.update(dt);
    helmetScene.update(dt);
  }
  const safeDt = Math.min(Math.max(dt, 0.001), 0.05);

  // ── Camera readout ──
  camReadout.x = +engine.camera.position.x.toFixed(2);
  camReadout.y = +engine.camera.position.y.toFixed(2);
  camReadout.z = +engine.camera.position.z.toFixed(2);

  // ── Color animation tick ──
  updateColorAnimation();

  // ── Mouse follow: adaptive lerp (snaps when far, settles when close) ──
  const distToTarget = Math.hypot(mousePos.x - smoothMouse.x, mousePos.y - smoothMouse.y);
  const followRate = 8 + distToTarget * 40;
  const followFactor = 1 - Math.exp(-followRate * safeDt);
  smoothMouse.x += (mousePos.x - smoothMouse.x) * followFactor;
  smoothMouse.y += (mousePos.y - smoothMouse.y) * followFactor;
  u.uMouse.value.set(smoothMouse.x, smoothMouse.y);

  // ── Velocity: asymmetric attack/decay (frame-rate independent) ──
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

  // ── Lens radius: spring physics ──
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

  // ── Camera: auto-orbit with smooth resume + parallax ──
  if (!autoOrbit) {
    // Count time since user stopped interacting
    orbitResumeTimer += safeDt;
    if (orbitResumeTimer > ORBIT_RESUME_DELAY && !lensActive) {
      autoOrbit = true;
      // Sync orbit angle to current camera position for seamless resume
      orbitAngle = Math.atan2(engine.camera.position.x, engine.camera.position.z);
    }
    // User is in control — let OrbitControls drive
    engine.controls.update();
  }

  if (autoOrbit) {
    // Gentle pendulum sway around the best composition angle
    // instead of a full 360° orbit that hits bad views
    const t = performance.now() * 0.001;
    const isHelmet = activeScene === 1;
    const baseAngle = isHelmet ? 0.24 : 0.62;
    const swayAmount = isHelmet ? 0.26 : 0.4;
    const angle = baseAngle + Math.sin(t * (isHelmet ? 0.25 : 0.08)) * swayAmount
                            + Math.sin(t * (isHelmet ? 0.09 : 0.031)) * swayAmount * 0.3;

    const radius = isHelmet ? 8.61 : 8.5;
    const targetX = Math.sin(angle) * radius;
    const targetZ = Math.cos(angle) * radius;
    const baseY = isHelmet ? 2.57 : 3.8;
    const targetY = baseY + Math.sin(t * 0.06) * (isHelmet ? 0.05 : 0.25);

    // Smooth blend toward orbit position (prevents jump on resume)
    const blend = 1 - Math.exp(-2.5 * safeDt);
    engine.camera.position.x += (targetX - engine.camera.position.x) * blend;
    engine.camera.position.z += (targetZ - engine.camera.position.z) * blend;
    engine.camera.position.y += (targetY - engine.camera.position.y) * blend;

    engine.camera.lookAt(0, 1.5, 0);
  }

  // ── Disable wobble on helmet scene or reduced motion ──
  const presetWobble = presets[activePresetIndex].values.uWobbleAmount ?? 0;
  u.uWobbleAmount.value = (activeScene === 1 || prefersReducedMotion) ? 0 : presetWobble;

  // ── Render ──
  if (comparing) {
    engine.renderDirect();
  } else {
    engine.composer.render();
  }
});
