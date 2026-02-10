# Comic Book Shader

Real-time post-processing shader that transforms a 3D scene into a comic book aesthetic. Built with Three.js and WebGL 2. Combines six print/comic techniques in a single fullscreen shader pass.

## Setup

Requires **Node.js 18+** (tested with Node 20).

```bash
# Install all dependencies (three, lil-gui, vite, typescript, vite-plugin-glsl)
npm install

# Start dev server with hot reload (opens at http://localhost:5173)
npm run dev

# Type-check + production build (outputs to dist/)
npm run build

# Preview the production build locally
npm run preview
```

That's it. No environment variables, no config files to create, no external assets to download. `npm install && npm run dev` is all you need.

---

## Project Structure

```
comic-book-shader/
├── index.html                          # Page: canvas + overlay (title, preset buttons, credits) + flash div
├── package.json                        # Vite 6 + Three.js 0.170 + lil-gui 0.20 + vite-plugin-glsl
├── vite.config.js                      # Just: plugins: [glsl()]
├── tsconfig.json                       # ES2020, strict, bundler moduleResolution
├── src/
│   ├── main.ts                         # Entry: wires everything, presets, GUI, reveal animation, auto-orbit
│   ├── style.css                       # Overlay UI, fonts (Bangers + Inter), preset buttons, lil-gui overrides
│   ├── engine/
│   │   └── Engine.ts                   # WebGLRenderer + EffectComposer + OrbitControls + resize + loop
│   ├── comic/
│   │   ├── ComicScene.ts               # 6 shapes + ground + 4 lights + per-frame animation
│   │   ├── ComicPass.ts                # Custom Pass: normal buffer render + uniform wiring + FullScreenQuad
│   │   └── ComicShader.ts              # Inline GLSL3 shader source + ComicUniforms interface + material factory
│   │   └── shaders/                    # Legacy GLSL1 reference files (NOT used at runtime)
│   │       ├── comic.vert              # varying-based vertex shader (GLSL1)
│   │       ├── comic.frag              # texture2D-based fragment shader (GLSL1, original 3-effect version)
│   │       └── halftone.glsl           # Standalone halftone utility (GLSL1)
│   └── types/
│       └── glsl.d.ts                   # TS declarations for .glsl/.vert/.frag imports
```

**Important**: The actual shaders used at runtime are **inline strings** in `ComicShader.ts` (GLSL 3.00 ES). The files in `shaders/` are earlier GLSL1 versions kept for reference — they are NOT imported anywhere.

---

## Dependencies

```json
{
  "dependencies": {
    "three": "^0.170.0",        // 3D engine
    "lil-gui": "^0.20.0"        // Parameter tweaking UI
  },
  "devDependencies": {
    "@types/three": "^0.170.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vite-plugin-glsl": "^1.3.0" // Enables .glsl/.vert/.frag imports (used for TS declarations only)
  }
}
```

No external textures, models, or assets. Everything is procedural.

---

## Architecture: Rendering Pipeline

### Frame lifecycle (every requestAnimationFrame)

1. **`Engine.start()`** calls `clock.getDelta()`, updates OrbitControls, calls `onUpdate` callback, then `composer.render()`
2. **EffectComposer** runs `RenderPass` first → renders the scene with `MeshStandardMaterial`s into a `WebGLRenderTarget` that has an attached `DepthTexture` (format: `DepthFormat`, type: `UnsignedIntType`, filter: `NearestFilter`)
3. **EffectComposer** then runs `ComicPass`:
   - **Normal pass**: temporarily sets `scene.overrideMaterial = MeshNormalMaterial`, sets `scene.background = null`, renders into a separate `WebGLRenderTarget` (`HalfFloatType`, `NearestFilter`)
   - **Restores** original overrideMaterial and background
   - **Wires uniforms**: `uDiffuse` = readBuffer.texture, `uNormalBuffer` = normalRenderTarget.texture, `uDepthBuffer` = readBuffer.depthTexture, `uResolution` = readBuffer dimensions, `uTime` = `performance.now() * 0.001`
   - **Renders** the `FullScreenQuad` with the comic ShaderMaterial to screen (or writeBuffer if not renderToScreen)

### Key Three.js patterns used

- `EffectComposer` with custom `Pass` subclass (not ShaderPass — we need the extra normal render)
- `FullScreenQuad` from `three/examples/jsm/postprocessing/Pass.js` for the fullscreen shader
- `scene.overrideMaterial` to render the entire scene with `MeshNormalMaterial` in one call
- `DepthTexture` attached to the main render target for depth-based edge detection
- `THREE.GLSL3` on the ShaderMaterial for modern GLSL syntax (`in`/`out`/`texture()`)

---

## Engine.ts — Detailed

```typescript
class Engine {
  renderer: THREE.WebGLRenderer;    // antialias: false, pixelRatio capped at 2, PCFSoftShadowMap, NoToneMapping
  scene: THREE.Scene;               // background: 0xf5f0e8 (warm off-white)
  camera: THREE.PerspectiveCamera;  // FOV 45, near 0.1, far 100, position (5, 4, 7)
  controls: OrbitControls;          // damping 0.05, target (0, 1.5, 0)
  composer: EffectComposer;         // initialized with custom renderTarget (has depthTexture)
  depthTexture: THREE.DepthTexture; // DepthFormat, UnsignedIntType

  addPass(pass: Pass): void;        // Adds to composer
  start(onUpdate?: (dt: number) => void): void;  // requestAnimationFrame loop
}
```

**Resize**: listens to `window.resize`, updates camera aspect + projection matrix, renderer size, composer size. Does NOT update the depth texture dimensions (the composer handles that).

---

## ComicPass.ts — Detailed

```typescript
class ComicPass extends Pass {
  uniforms: ComicUniforms;                          // All shader uniforms (see below)
  private fsQuad: FullScreenQuad;                   // Renders the fullscreen shader
  private normalRenderTarget: WebGLRenderTarget;    // HalfFloatType, NearestFilter
  private normalOverrideMaterial: MeshNormalMaterial;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  render(renderer, writeBuffer, readBuffer): void;  // See pipeline above
  dispose(): void;                                  // Cleans up render targets + materials
}
```

**Resize**: listens to `window.resize`, resizes `normalRenderTarget` only. The main render target is resized by the composer.

**Constructor flow**:
1. Creates normalRenderTarget (HalfFloatType for precision)
2. Creates MeshNormalMaterial (no special config)
3. Calls `createComicUniforms()` → sets cameraNear/Far from camera
4. Calls `createComicMaterial(uniforms)` → wraps in FullScreenQuad

---

## ComicShader.ts — Detailed

Contains three exports:

### `ComicUniforms` interface

Every uniform is `{ value: T }` following Three.js IUniform pattern. Has an index signature `[uniform: string]: THREE.IUniform` for dynamic access.

| Uniform | Type | Default | Description |
|---------|------|---------|-------------|
| `uDiffuse` | `Texture \| null` | `null` | Main scene color (set per frame by ComicPass) |
| `uNormalBuffer` | `Texture \| null` | `null` | World-space normals (set per frame by ComicPass) |
| `uDepthBuffer` | `Texture \| null` | `null` | Depth buffer (set per frame by ComicPass) |
| `uResolution` | `Vector2` | `window.innerWidth/Height` | Viewport size in pixels |
| `uCameraNear` | `number` | `0.1` | Camera near plane |
| `uCameraFar` | `number` | `100` | Camera far plane |
| `uTime` | `number` | `0.0` | Elapsed time in seconds (set per frame by ComicPass) |
| `uOutlineThickness` | `number` | `1.2` | Sobel sample offset multiplier |
| `uOutlineThreshold` | `number` | `0.45` | Edge detection sensitivity (smoothstep lower bound) |
| `uCelBands` | `number` | `4.0` | Number of luminance quantization steps |
| `uHalftoneSize` | `number` | `5.0` | Halftone dot grid spacing in pixels |
| `uHalftoneAngle` | `number` | `0.52` | Halftone grid rotation in radians |
| `uSaturationBoost` | `number` | `0.4` | Saturation multiplier offset (-1 to 1) |
| `uWobbleAmount` | `number` | `2.0` | UV perturbation magnitude in texels |
| `uWobbleFreq` | `number` | `12.0` | Noise frequency for wobble |
| `uCmykOffset` | `number` | `2.5` | CMYK plate offset in texels |
| `uPaperStrength` | `number` | `0.4` | Paper texture blend intensity (0-1) |
| `uEnableOutlines` | `number` | `1.0` | Toggle (0.0 or 1.0) |
| `uEnableCelShading` | `number` | `1.0` | Toggle |
| `uEnableHalftone` | `number` | `1.0` | Toggle |
| `uEnableWobble` | `number` | `1.0` | Toggle |
| `uEnableCmyk` | `number` | `1.0` | Toggle |
| `uEnablePaper` | `number` | `1.0` | Toggle |

Toggles use `float` (not `bool`) because they're animated between 0.0 and 1.0 during preset transitions.

### `createComicUniforms()` → `ComicUniforms`

Returns a fresh uniform object with all defaults.

### `createComicMaterial(uniforms)` → `THREE.ShaderMaterial`

Returns a ShaderMaterial with `glslVersion: THREE.GLSL3`, `depthWrite: false`, `depthTest: false`.

### Vertex Shader (inline)

```glsl
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

Standard fullscreen quad passthrough. `uv`, `projectionMatrix`, `modelViewMatrix`, `position` are auto-injected by Three.js.

### Fragment Shader — Effect-by-Effect Breakdown

The shader processes effects in this exact order:

#### 1. Hand-drawn Wobble (first, because it perturbs UVs for everything else)

```glsl
if (uEnableWobble > 0.5) {
  vec2 noiseCoord = vUv * uWobbleFreq + uTime * 0.8;
  float wx = (noise(noiseCoord) - 0.5) * 2.0;            // range [-1, 1]
  float wy = (noise(noiseCoord + vec2(43.0, 17.0)) - 0.5) * 2.0;
  uv += vec2(wx, wy) * texel * uWobbleAmount;
}
```

- Noise scrolls at `uTime * 0.8` for slow drift
- X and Y use different noise samples (offset by `vec2(43, 17)`) so they're uncorrelated
- Result is in texel units, scaled by `uWobbleAmount`
- All subsequent texture reads use this perturbed `uv`

#### 2. Cel Shading

```glsl
float l = luma(color);                      // BT.601 luminance: 0.299R + 0.587G + 0.114B
float qv = (floor(l * bands) + 0.5) / bands;  // quantize to band centers
qv = 0.12 + qv * 0.88;                     // remap [0,1] → [0.12, 1.0] (shadows never go black)
float sc = qv / max(l, 0.001);             // scale factor to apply quantized brightness
color = clamp(color * sc, 0.0, 1.0);       // preserves hue/saturation, just changes brightness
```

- Uses `floor(l * bands) + 0.5` to snap to band **centers** (not edges), avoiding harsh jumps
- Shadow lift to 0.12 ensures darkest areas keep some color/detail

#### 3. Halftone (shadow regions only)

```glsl
float shadow = smoothstep(0.55, 0.25, l) * (1.0 - smoothstep(0.15, 0.05, l));
```

- Active in luminance range ~0.05-0.55
- Fades out in both bright areas AND very dark areas (prevents dots in deep shadow)
- `smoothstep(0.55, 0.25, l)` = 1.0 when l < 0.25, fades to 0 at l = 0.55
- `(1.0 - smoothstep(0.15, 0.05, l))` = 0 when l < 0.05, fades back to 1 at l = 0.15

```glsl
float dr = shadow * uHalftoneSize * 0.38;   // dot radius scales with shadow depth
float dv = halftonePattern(fc, uHalftoneSize, uHalftoneAngle, dr);
vec3 dotted = color * (1.0 - dv * 0.4);     // dots darken by 40%
color = mix(color, dotted, shadow * 0.7);    // blend proportional to shadow, max 70%
```

**halftonePattern function**:
```glsl
float halftonePattern(vec2 fc, float grid, float ang, float rad) {
  // Rotate fragment coordinates by angle
  vec2 r = vec2(fc.x * cos(ang) - fc.y * sin(ang),
                fc.x * sin(ang) + fc.y * cos(ang));
  // Tile into grid, offset to cell center
  vec2 cell = mod(r, grid) - grid * 0.5;
  // Smooth circle: 1 inside dot, 0 outside, 2px transition band
  return 1.0 - smoothstep(rad - 1.0, rad + 1.0, length(cell));
}
```

#### 4. Saturation Boost (always active, not toggleable)

```glsl
vec3 hsv = rgb2hsv(color);
hsv.y = clamp(hsv.y * (1.0 + uSaturationBoost), 0.0, 1.0);
color = hsv2rgb(hsv);
```

- When `uSaturationBoost = 0.4`, saturation is multiplied by 1.4
- When negative (Noir: -0.85), nearly desaturates: `sat * 0.15`
- When -1.0 (Manga), fully grayscale: `sat * 0.0`

#### 5. Outlines (Sobel edge detection)

Two Sobel passes combined:

**Depth-adaptive thickness**:
```glsl
float cd = linearizeDepth(texture(uDepthBuffer, uv).r);
float df = clamp(1.0 - (cd - uCameraNear) / (uCameraFar * 0.3), 0.6, 1.3);
```
- Closer objects get thicker lines (df up to 1.3), distant objects thinner (down to 0.6)

**Extra wobble on outlines** (when wobble enabled):
```glsl
float edgeNoise = noise(uv * uWobbleFreq * 2.0 + uTime * 1.2);
wobbleMult = 0.7 + edgeNoise * 0.6;   // range [0.7, 1.3]
```
- Uses 2x the wobble frequency and faster time scroll than UV wobble
- Makes outline thickness vary locally for hand-inked feel

**Sobel on normals** (3-channel, 8 samples):
```glsl
// Standard Sobel kernels Gx and Gy applied to normal buffer RGB
// ne = length(Gx) + length(Gy)   (L1 norm of gradients)
ne = min(ne, 3.0);  // clamp to prevent curved surfaces from flooding with edges
```

**Sobel on depth** (1-channel, 8 samples):
```glsl
// Standard Sobel on linearized depth values
// de = (abs(Gx) + abs(Gy)) / (cd * 0.15 + 0.1)   (normalized by center depth)
```
- Division by center depth prevents distant edges from being oversensitive

**Combine and threshold**:
```glsl
float edge = max(ne * 0.25, de * 1.2);                          // depth edges weighted 4.8x more than normal edges
edge = smoothstep(uOutlineThreshold, uOutlineThreshold + 0.5, edge);  // 0.5 transition range
color = mix(color, vec3(0.05, 0.03, 0.02), edge);               // near-black ink, slightly warm
```

#### 6. CMYK Misregistration

Simulates misaligned printing plates:

```glsl
float drift = sin(uTime * 1.5) * 0.3 + 0.7;  // oscillates between 0.4 and 1.0

// Each plate offset at a different angle
vec2 cOff = vec2( px * 0.7,  py * 1.0) * drift;   // Cyan: upper-right
vec2 mOff = vec2(-px * 1.0,  py * 0.5) * drift;   // Magenta: upper-left
vec2 yOff = vec2( px * 0.3, -py * 0.8) * drift;   // Yellow: lower-right
// K plate: stays centered
```

For each plate, samples the diffuse at its offset, converts to CMYK, then recombines:
```glsl
vec4 misreg = vec4(cCmyk.x, mCmyk.y, yCmyk.z, kCmyk.w);  // C from cyan sample, M from magenta sample, etc.
color = cmyk2rgb(misreg);
```

**RGB↔CMYK conversion**:
- `rgb2cmyk`: K = 1 - max(R,G,B); C/M/Y = (1 - channel - K) / (1 - K)
- `cmyk2rgb`: channel = (1 - CMYvalue) * (1 - K)

#### 7. Paper Texture

```glsl
vec2 paperCoord = vUv * uResolution * 0.15;   // uses ORIGINAL vUv, not wobbled uv

float grain = fbm(paperCoord * 3.0) * 0.5 + 0.5;                          // 4-octave FBM
float fiber = noise(vec2(paperCoord.x * 4.0, paperCoord.y * 0.5)) * 0.5 + 0.5;  // stretched horizontally
float paper = mix(grain, fiber, 0.3);                                       // 70% grain, 30% fiber

vec3 paperColor = vec3(0.95, 0.92, 0.85);  // warm yellowed white

color = color * mix(vec3(1.0), vec3(paper * 0.3 + 0.7), uPaperStrength);  // multiply by grain
color = mix(color, color * paperColor, uPaperStrength * 0.5);              // warm tint

// Vignette
vec2 vig = vUv * (1.0 - vUv);                    // 0 at edges, 0.25 at center
float vigAmount = pow(vig.x * vig.y * 20.0, 0.3);  // gamma-shaped falloff
color *= mix(1.0, vigAmount, uPaperStrength * 0.4);
```

### Noise Stack (used by wobble + paper)

All procedural, no texture lookups:

```glsl
// Pseudo-random hash
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Smooth value noise (bilinear interpolation of hash, hermite smoothing)
float noise(vec2 p) { ... }

// 4-octave fractional Brownian motion
float fbm(vec2 p) {
  // octaves: amplitude halves, frequency doubles, shift by vec2(100) each octave
}
```

---

## ComicScene.ts — Detailed

### Ground

- `PlaneGeometry(30, 30)`, color `0xe8dfd0`, roughness 0.95, rotation -PI/2, receiveShadow only

### Shapes (stored in `this.objects[]` array by index)

| Index | Shape | Geometry | Color | Position | Notes |
|-------|-------|----------|-------|----------|-------|
| 0 | Torus Knot | `TorusKnotGeometry(1.1, 0.38, 200, 40, 2, 3)` | `0xe02020` (red) | `(0, 2.2, 0)` | roughness 0.3, metalness 0.15 |
| 1 | Sphere | `SphereGeometry(0.85, 64, 64)` | `0x2255cc` (blue) | `(-2.8, 0.85, 1.5)` | roughness 0.25, metalness 0.1 |
| 2 | Dodecahedron | `DodecahedronGeometry(0.75)` | `0xf0a020` (orange) | `(2.6, 0.85, 1.8)` | **flatShading: true** |
| 3 | Cylinder | `CylinderGeometry(0.4, 0.5, 2.4, 32)` | `0x22aa55` (green) | `(-1.2, 1.2, 3.0)` | roughness 0.4 |
| 4 | Torus | `TorusGeometry(0.6, 0.2, 32, 64)` | `0xcc44aa` (magenta) | `(1.5, 1.8, 2.8)` | rotation.x = PI*0.3, metalness 0.2 |
| 5 | Icosahedron | `IcosahedronGeometry(0.45, 0)` | `0xff6633` (orange-red) | `(3.2, 0.5, -0.5)` | **flatShading: true**, detail=0 |

All shapes: `castShadow = true`, `receiveShadow = true`, `MeshStandardMaterial`.

### Lights

| Light | Type | Color | Intensity | Position | Notes |
|-------|------|-------|-----------|----------|-------|
| Key | DirectionalLight | `0xfff5e0` | 3.0 | `(5, 10, 4)` | castShadow, 2048 shadow map, bias -0.001, frustum +-10 |
| Ambient | AmbientLight | `0xd0d4e8` | 2.2 | — | Cool-tinted fill |
| Fill | DirectionalLight | `0xb0c0e0` | 1.8 | `(-5, 6, -3)` | No shadows |
| Rim | DirectionalLight | `0xffe8d0` | 0.8 | `(-2, 3, -6)` | Warm edge light from behind |

### Animation (`update(dt)`)

Uses `performance.now() * 0.001` (not accumulated dt):
- **objects[0]** (torus knot): `rotation.y = t * 0.2`, `rotation.x = sin(t * 0.15) * 0.1`
- **objects[2]** (dodecahedron): `rotation.y = t * 0.35`, `rotation.z = t * 0.2`
- **objects[4]** (torus): `rotation.z = t * 0.4`, `position.y = 1.8 + sin(t * 0.6) * 0.3` (bobbing)
- **objects[5]** (icosahedron): `rotation.y = t * -0.3`, `rotation.x = t * 0.15`
- objects[1] (sphere) and objects[3] (cylinder): **static**

---

## main.ts — Detailed

### Initialization Order

1. Get `<canvas id="canvas">` element
2. Create `Engine(canvas)`
3. Create `ComicScene(engine.scene)` → adds shapes + lights
4. Create `ComicPass(engine.scene, engine.camera)` → sets `renderToScreen = true`
5. `engine.addPass(comicPass)` → adds to composer after RenderPass
6. Store `comicPass.uniforms` as `u` for quick access

### Preset System

6 presets stored as `{ name: string, values: Record<string, number> }`:

| Preset | Key characteristics |
|--------|-------------------|
| **Comic Book** | All effects on. Thickness 1.2, 4 bands, halftone 5px, wobble 2.0, CMYK 2.5, paper 0.4, saturation +0.4 |
| **Pop Art** | Thick outlines (2.0), 3 bands, BIG halftone (10px), high saturation (+0.8), strong CMYK (5), NO wobble, NO paper |
| **Noir** | Desaturated (-0.85), 3 bands, heavy wobble (3.0, freq 8), paper 0.6, NO CMYK |
| **Manga** | Fully desaturated (-1.0), 4 bands, fine halftone (3.5px), high-freq wobble (1.5, freq 18), NO CMYK |
| **Vintage Print** | Thin outlines (0.7), high threshold (0.55), 5 bands, strong CMYK (4), heavy paper (0.8), low wobble (1.0) |
| **Clean** | Outlines + cel only. 5 bands, saturation +0.25. NO halftone, wobble, CMYK, or paper |

### `applyPreset(preset, animate = true)`

- If `animate = false`: sets all uniform values immediately, calls `updateGuiFromUniforms()`
- If `animate = true`: interpolates all uniform values over 600ms using `requestAnimationFrame` with cubic ease-out: `e = 1 - (1 - t)^3`
- Interpolation formula: `value = start + (target - start) * e`
- GUI is updated only after animation completes

### Preset Buttons (DOM)

Created dynamically from the presets array. Buttons are `<button class="preset-btn">` appended to `<div id="presets">`. First button gets `.active` class. Click handler removes `.active` from previous, adds to clicked, calls `applyPreset()`.

### GUI (lil-gui)

Created with `new GUI({ title: 'Controls' })`. Uses two helper functions:

**`addToggle(folder, label, uniform)`**: Creates a boolean checkbox. Reads initial value as `uniform.value > 0.5`. On change, sets uniform to `1.0` or `0.0`.

**`addSlider(folder, label, uniform, min, max, step)`**: Creates a numeric slider. On change, sets uniform value directly.

Both store the controller in `guiControllers[uniformName]` for later sync.

7 folders:
| Folder | Controls | Open by default |
|--------|----------|-----------------|
| Outlines | Enable, Thickness (0.3-4.0, step 0.1), Threshold (0.05-1.0, step 0.01) | Yes |
| Cel Shading | Enable, Bands (2-8, step 1) | Yes |
| Halftone | Enable, Dot Size (2-20, step 0.5), Angle (0-1.57, step 0.01) | Yes |
| Hand-drawn | Enable, Amount (0-8, step 0.1), Frequency (4-40, step 1) | No |
| CMYK Misregistration | Enable, Offset (0-10, step 0.5) | No |
| Paper | Enable, Strength (0-1, step 0.05) | No |
| Color | Saturation (-1 to 1, step 0.05) | No |

**`updateGuiFromUniforms()`**: Syncs all GUI controllers from current uniform values. Toggle uniforms (`uEnable*`) are converted to boolean (`> 0.5`). Called after preset application.

### Reveal Animation

1. On load, `rawValues` object sets ALL effects to off (enable=0, amounts=0)
2. These are applied immediately to uniforms
3. After 1200ms: white flash div gets `.visible` class (opacity 1, transition 0.4s)
4. After 1200+300ms: `applyPreset(presets[0], false)` applies Comic Book preset instantly, `updateGuiFromUniforms()` syncs GUI, flash removed

### Auto-orbit Camera

```javascript
let autoOrbit = true;
engine.controls.addEventListener('start', () => { autoOrbit = false; });
```

When active (inside `engine.start` callback):
```javascript
const radius = 9;
const speed = 0.12;
const angle = t * speed;
camera.position.x = Math.sin(angle) * radius;
camera.position.z = Math.cos(angle) * radius;
camera.position.y = 4 + Math.sin(t * 0.08) * 0.5;  // gentle vertical bob
camera.lookAt(0, 1.5, 0);
```

Stops permanently on first OrbitControls interaction (mouse/touch).

---

## index.html

```html
<canvas id="canvas"></canvas>           <!-- Full-viewport 3D canvas -->
<div id="flash"></div>                   <!-- White overlay for reveal animation -->
<div id="overlay">                       <!-- Fixed overlay, pointer-events: none -->
  <div id="header">                      <!-- Top-left: title + description -->
    <h1>COMIC BOOK</h1>
    <p>Real-time post-processing shader...</p>
  </div>
  <div id="presets"></div>               <!-- Bottom-left: dynamically filled with preset buttons -->
  <div id="credits">                     <!-- Bottom-right: tech credits -->
    <a href="#">Three.js · WebGL 2</a>
  </div>
</div>
<script type="module" src="/src/main.ts"></script>
```

---

## style.css

- **Fonts**: Google Fonts — Bangers (title), Inter 300/400/500 (body)
- **Canvas**: `display: block; width: 100%; height: 100%`
- **Overlay**: `position: fixed; pointer-events: none; z-index: 10` (children selectively enable pointer-events)
- **Title**: Bangers 52px, white with black text-shadow (4 offsets for outline effect)
- **Preset buttons**: `rgba(255,255,255,0.1)` bg, `backdrop-filter: blur(12px)`, 6px radius, uppercase. Active state: white bg, dark text
- **Flash**: `position: fixed; z-index: 100; opacity: 0; transition: opacity 0.4s ease-out`. `.visible` sets opacity to 1
- **lil-gui override**: forced to `top: 32px; right: 36px; width: 240px; max-height: calc(100vh - 100px); z-index: 20`

---

## What's NOT in the project

- No external textures or models (everything is procedural geometry + procedural noise)
- No post-processing bloom, FXAA, or other passes (just the single ComicPass)
- No mobile-specific handling (OrbitControls handles touch natively)
- No build-time shader compilation (shaders are inline strings in ComicShader.ts)
- The `shaders/` directory files are dead code / reference from an earlier GLSL1 iteration
