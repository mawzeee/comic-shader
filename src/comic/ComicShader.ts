import * as THREE from 'three';

const comicVert = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const comicFrag = /* glsl */ `
uniform sampler2D uDiffuse;
uniform sampler2D uNormalBuffer;
uniform sampler2D uDepthBuffer;
uniform vec2 uResolution;
uniform float uCameraNear;
uniform float uCameraFar;
uniform float uOutlineThickness;
uniform float uOutlineThreshold;
uniform float uCelBands;
uniform float uHalftoneSize;
uniform float uHalftoneAngle;
uniform float uSaturationBoost;
uniform float uEnableOutlines;
uniform float uEnableCelShading;
uniform float uEnableHalftone;

// New wow uniforms
uniform float uTime;
uniform float uWobbleAmount;
uniform float uWobbleFreq;
uniform float uCmykOffset;
uniform float uEnableCmyk;
uniform float uEnableWobble;
uniform float uEnablePaper;
uniform float uPaperStrength;

in vec2 vUv;
out vec4 fragColor;

// --- Noise for wobble + paper ---
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

float linearizeDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uCameraNear * uCameraFar) /
         (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float halftonePattern(vec2 fc, float grid, float ang, float rad) {
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 r = vec2(fc.x * ca - fc.y * sa, fc.x * sa + fc.y * ca);
  vec2 cell = mod(r, grid) - grid * 0.5;
  return 1.0 - smoothstep(rad - 1.0, rad + 1.0, length(cell));
}

vec3 rgb2hsv(vec3 c) {
  float cMax = max(c.r, max(c.g, c.b));
  float cMin = min(c.r, min(c.g, c.b));
  float delta = cMax - cMin;
  float h = 0.0;
  if (delta > 0.00001) {
    if (cMax == c.r) {
      h = mod((c.g - c.b) / delta, 6.0);
    } else if (cMax == c.g) {
      h = (c.b - c.r) / delta + 2.0;
    } else {
      h = (c.r - c.g) / delta + 4.0;
    }
    h /= 6.0;
    if (h < 0.0) h += 1.0;
  }
  float s = (cMax > 0.00001) ? delta / cMax : 0.0;
  return vec3(h, s, cMax);
}

vec3 hsv2rgb(vec3 c) {
  float h = c.x * 6.0;
  float s = c.y;
  float v = c.z;
  float i = floor(h);
  float f = h - i;
  float p = v * (1.0 - s);
  float q = v * (1.0 - s * f);
  float t = v * (1.0 - s * (1.0 - f));
  int idx = int(mod(i, 6.0));
  if (idx == 0) return vec3(v, t, p);
  if (idx == 1) return vec3(q, v, p);
  if (idx == 2) return vec3(p, v, t);
  if (idx == 3) return vec3(p, q, v);
  if (idx == 4) return vec3(t, p, v);
  return vec3(v, p, q);
}

// --- RGB to CMYK and back ---
vec4 rgb2cmyk(vec3 rgb) {
  float k = 1.0 - max(rgb.r, max(rgb.g, rgb.b));
  if (k >= 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float invK = 1.0 / (1.0 - k);
  float c = (1.0 - rgb.r - k) * invK;
  float m = (1.0 - rgb.g - k) * invK;
  float y = (1.0 - rgb.b - k) * invK;
  return vec4(c, m, y, k);
}

vec3 cmyk2rgb(vec4 cmyk) {
  float invK = 1.0 - cmyk.w;
  return vec3(
    (1.0 - cmyk.x) * invK,
    (1.0 - cmyk.y) * invK,
    (1.0 - cmyk.z) * invK
  );
}

void main() {
  vec2 texel = 1.0 / uResolution;

  // --- Hand-drawn wobble: perturb UVs for all subsequent reads ---
  vec2 uv = vUv;
  if (uEnableWobble > 0.5) {
    vec2 noiseCoord = vUv * uWobbleFreq + uTime * 0.8;
    float wx = (noise(noiseCoord) - 0.5) * 2.0;
    float wy = (noise(noiseCoord + vec2(43.0, 17.0)) - 0.5) * 2.0;
    uv += vec2(wx, wy) * texel * uWobbleAmount;
  }

  vec3 color = texture(uDiffuse, uv).rgb;

  // --- Cel shading ---
  if (uEnableCelShading > 0.5) {
    float l = luma(color);
    // Quantize but keep darkest band at ~15% brightness, not black
    float bands = uCelBands;
    float qv = (floor(l * bands) + 0.5) / bands;
    // Lift shadows: remap from [0,1] to [0.12, 1]
    qv = 0.12 + qv * 0.88;
    float sc = qv / max(l, 0.001);
    color = clamp(color * sc, 0.0, 1.0);
  }

  // --- Halftone in shadows ---
  if (uEnableHalftone > 0.5) {
    float l = luma(color);
    // Only apply in mid-shadow range, not deep shadows
    float shadow = smoothstep(0.55, 0.25, l) * (1.0 - smoothstep(0.15, 0.05, l));
    if (shadow > 0.01) {
      vec2 fc = uv * uResolution;
      float dr = shadow * uHalftoneSize * 0.38;
      float dv = halftonePattern(fc, uHalftoneSize, uHalftoneAngle, dr);
      // Dots darken slightly, base stays close to original
      vec3 dotted = color * (1.0 - dv * 0.4);
      color = mix(color, dotted, shadow * 0.7);
    }
  }

  // --- Saturation boost ---
  vec3 hsv = rgb2hsv(color);
  hsv.y = clamp(hsv.y * (1.0 + uSaturationBoost), 0.0, 1.0);
  color = hsv2rgb(hsv);

  // --- Outlines with wobble applied to sampling ---
  if (uEnableOutlines > 0.5) {
    float cd = linearizeDepth(texture(uDepthBuffer, uv).r);
    float df = clamp(1.0 - (cd - uCameraNear) / (uCameraFar * 0.3), 0.6, 1.3);

    // Extra wobble on outline sampling for hand-drawn feel
    float wobbleMult = 1.0;
    if (uEnableWobble > 0.5) {
      float edgeNoise = noise(uv * uWobbleFreq * 2.0 + uTime * 1.2);
      wobbleMult = 0.7 + edgeNoise * 0.6;
    }
    vec2 t = texel * uOutlineThickness * df * wobbleMult;

    // Sobel on normals
    vec3 ntl = texture(uNormalBuffer, uv + vec2(-t.x, t.y)).rgb;
    vec3 ntc = texture(uNormalBuffer, uv + vec2(0.0, t.y)).rgb;
    vec3 ntr = texture(uNormalBuffer, uv + vec2(t.x, t.y)).rgb;
    vec3 nml = texture(uNormalBuffer, uv + vec2(-t.x, 0.0)).rgb;
    vec3 nmr = texture(uNormalBuffer, uv + vec2(t.x, 0.0)).rgb;
    vec3 nbl = texture(uNormalBuffer, uv + vec2(-t.x, -t.y)).rgb;
    vec3 nbc = texture(uNormalBuffer, uv + vec2(0.0, -t.y)).rgb;
    vec3 nbr = texture(uNormalBuffer, uv + vec2(t.x, -t.y)).rgb;
    vec3 ngx = -ntl - 2.0 * nml - nbl + ntr + 2.0 * nmr + nbr;
    vec3 ngy = -ntl - 2.0 * ntc - ntr + nbl + 2.0 * nbc + nbr;
    float ne = length(ngx) + length(ngy);

    // Sobel on depth
    float dtl = linearizeDepth(texture(uDepthBuffer, uv + vec2(-t.x, t.y)).r);
    float dtc = linearizeDepth(texture(uDepthBuffer, uv + vec2(0.0, t.y)).r);
    float dtr = linearizeDepth(texture(uDepthBuffer, uv + vec2(t.x, t.y)).r);
    float dml = linearizeDepth(texture(uDepthBuffer, uv + vec2(-t.x, 0.0)).r);
    float dmr = linearizeDepth(texture(uDepthBuffer, uv + vec2(t.x, 0.0)).r);
    float dbl = linearizeDepth(texture(uDepthBuffer, uv + vec2(-t.x, -t.y)).r);
    float dbc = linearizeDepth(texture(uDepthBuffer, uv + vec2(0.0, -t.y)).r);
    float dbr = linearizeDepth(texture(uDepthBuffer, uv + vec2(t.x, -t.y)).r);
    float dgx = -dtl - 2.0 * dml - dbl + dtr + 2.0 * dmr + dbr;
    float dgy = -dtl - 2.0 * dtc - dtr + dbl + 2.0 * dbc + dbr;
    float de = (abs(dgx) + abs(dgy)) / (cd * 0.15 + 0.1);

    // Normal edges: clamp sensitivity to avoid flooding curved surfaces
    ne = min(ne, 3.0);
    float edge = max(ne * 0.25, de * 1.2);
    edge = smoothstep(uOutlineThreshold, uOutlineThreshold + 0.5, edge);
    color = mix(color, vec3(0.05, 0.03, 0.02), edge);
  }

  // --- CMYK misregistration ---
  if (uEnableCmyk > 0.5) {
    // Each plate offset at a different angle (like misaligned print rollers)
    float px = uCmykOffset * texel.x;
    float py = uCmykOffset * texel.y;

    // Slight time-based drift for press vibration
    float drift = sin(uTime * 1.5) * 0.3 + 0.7;

    vec2 cOff = vec2( px * 0.7,  py * 1.0) * drift;
    vec2 mOff = vec2(-px * 1.0,  py * 0.5) * drift;
    vec2 yOff = vec2( px * 0.3, -py * 0.8) * drift;
    // K plate stays centered (it's the master)

    // Sample each plate at its offset position
    vec3 cSample = texture(uDiffuse, uv + cOff).rgb;
    vec3 mSample = texture(uDiffuse, uv + mOff).rgb;
    vec3 ySample = texture(uDiffuse, uv + yOff).rgb;
    vec3 kSample = color; // center plate

    // Convert each to CMYK, take each channel from its offset sample
    vec4 cCmyk = rgb2cmyk(cSample);
    vec4 mCmyk = rgb2cmyk(mSample);
    vec4 yCmyk = rgb2cmyk(ySample);
    vec4 kCmyk = rgb2cmyk(kSample);

    // Recombine: C from cyan-offset, M from magenta-offset, etc.
    vec4 misreg = vec4(cCmyk.x, mCmyk.y, yCmyk.z, kCmyk.w);
    color = cmyk2rgb(misreg);
  }

  // --- Paper texture ---
  if (uEnablePaper > 0.5) {
    vec2 paperCoord = vUv * uResolution * 0.15;

    // Paper grain (high frequency noise)
    float grain = fbm(paperCoord * 3.0) * 0.5 + 0.5;
    // Fiber texture (stretched noise)
    float fiber = noise(vec2(paperCoord.x * 4.0, paperCoord.y * 0.5)) * 0.5 + 0.5;
    float paper = mix(grain, fiber, 0.3);

    // Paper color: slight warm yellowing
    vec3 paperColor = vec3(0.95, 0.92, 0.85);

    // Blend: multiply paper texture, mix toward paper color
    color = color * mix(vec3(1.0), vec3(paper * 0.3 + 0.7), uPaperStrength);
    color = mix(color, color * paperColor, uPaperStrength * 0.5);

    // Vignette: darken edges like an old page
    vec2 vig = vUv * (1.0 - vUv);
    float vigAmount = pow(vig.x * vig.y * 20.0, 0.3);
    color *= mix(1.0, vigAmount, uPaperStrength * 0.4);
  }

  fragColor = vec4(color, 1.0);
}
`;

export interface ComicUniforms {
  [uniform: string]: THREE.IUniform;
  uDiffuse: { value: THREE.Texture | null };
  uNormalBuffer: { value: THREE.Texture | null };
  uDepthBuffer: { value: THREE.Texture | null };
  uResolution: { value: THREE.Vector2 };
  uCameraNear: { value: number };
  uCameraFar: { value: number };
  uOutlineThickness: { value: number };
  uOutlineThreshold: { value: number };
  uCelBands: { value: number };
  uHalftoneSize: { value: number };
  uHalftoneAngle: { value: number };
  uSaturationBoost: { value: number };
  uEnableOutlines: { value: number };
  uEnableCelShading: { value: number };
  uEnableHalftone: { value: number };
  uTime: { value: number };
  uWobbleAmount: { value: number };
  uWobbleFreq: { value: number };
  uCmykOffset: { value: number };
  uEnableCmyk: { value: number };
  uEnableWobble: { value: number };
  uEnablePaper: { value: number };
  uPaperStrength: { value: number };
}

export function createComicUniforms(): ComicUniforms {
  return {
    uDiffuse: { value: null },
    uNormalBuffer: { value: null },
    uDepthBuffer: { value: null },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 100 },
    uOutlineThickness: { value: 1.2 },
    uOutlineThreshold: { value: 0.45 },
    uCelBands: { value: 4.0 },
    uHalftoneSize: { value: 5.0 },
    uHalftoneAngle: { value: 0.52 },
    uSaturationBoost: { value: 0.4 },
    uEnableOutlines: { value: 1.0 },
    uEnableCelShading: { value: 1.0 },
    uEnableHalftone: { value: 1.0 },
    uTime: { value: 0.0 },
    uWobbleAmount: { value: 2.0 },
    uWobbleFreq: { value: 12.0 },
    uCmykOffset: { value: 2.5 },
    uEnableCmyk: { value: 1.0 },
    uEnableWobble: { value: 1.0 },
    uEnablePaper: { value: 1.0 },
    uPaperStrength: { value: 0.4 },
  };
}

export function createComicMaterial(uniforms: ComicUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: comicVert,
    fragmentShader: comicFrag,
    glslVersion: THREE.GLSL3,
    depthWrite: false,
    depthTest: false,
  });
}
