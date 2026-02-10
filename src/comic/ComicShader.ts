import * as THREE from 'three';

const comicVert = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const comicFrag = /* glsl */ `
// Shared scene data
uniform sampler2D uDiffuse;
uniform sampler2D uNormalBuffer;
uniform sampler2D uDepthBuffer;
uniform vec2 uResolution;
uniform float uCameraNear;
uniform float uCameraFar;
uniform float uTime;
uniform vec2 uMouse;

// Main style
uniform float uOutlineThickness;
uniform float uOutlineThreshold;
uniform float uCelBands;
uniform float uHalftoneSize;
uniform float uHalftoneAngle;
uniform float uSaturationBoost;
uniform float uWobbleAmount;
uniform float uWobbleFreq;
uniform float uCmykOffset;
uniform float uPaperStrength;
uniform float uEnableOutlines;
uniform float uEnableCelShading;
uniform float uEnableHalftone;
uniform float uEnableWobble;
uniform float uEnableCmyk;
uniform float uEnablePaper;

// Lens style
uniform float uLOutlineThickness;
uniform float uLOutlineThreshold;
uniform float uLCelBands;
uniform float uLHalftoneSize;
uniform float uLHalftoneAngle;
uniform float uLSaturationBoost;
uniform float uLWobbleAmount;
uniform float uLWobbleFreq;
uniform float uLCmykOffset;
uniform float uLPaperStrength;
uniform float uLEnableOutlines;
uniform float uLEnableCelShading;
uniform float uLEnableHalftone;
uniform float uLEnableWobble;
uniform float uLEnableCmyk;
uniform float uLEnablePaper;

// Lens geometry
uniform float uLensRadius;
uniform float uLensSmooth;
uniform vec2 uMouseVel;
uniform float uLensMode; // 0 = sketch, 1 = normals, 2 = void

in vec2 vUv;
out vec4 fragColor;

// ─── Style parameters ────────────────────────────────

struct Style {
  float outlineThickness;
  float outlineThreshold;
  float celBands;
  float halftoneSize;
  float halftoneAngle;
  float saturationBoost;
  float wobbleAmount;
  float wobbleFreq;
  float cmykOffset;
  float paperStrength;
  float enableOutlines;
  float enableCelShading;
  float enableHalftone;
  float enableWobble;
  float enableCmyk;
  float enablePaper;
};

// ─── Noise ───────────────────────────────────────────

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

// ─── Utilities ───────────────────────────────────────

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

// ─── Color conversion ────────────────────────────────

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

// ─── Effect pipeline ─────────────────────────────────

vec3 applyStyle(vec2 baseUv, vec2 texel, Style s) {
  vec2 uv = baseUv;

  // Hand-drawn wobble: perturb UVs for all subsequent reads
  if (s.enableWobble > 0.5) {
    vec2 noiseCoord = baseUv * s.wobbleFreq + uTime * 0.8;
    float wx = (noise(noiseCoord) - 0.5) * 2.0;
    float wy = (noise(noiseCoord + vec2(43.0, 17.0)) - 0.5) * 2.0;
    uv += vec2(wx, wy) * texel * s.wobbleAmount;
  }

  vec3 color = texture(uDiffuse, uv).rgb;

  // Cel shading
  if (s.enableCelShading > 0.5) {
    float l = luma(color);
    float bands = s.celBands;
    float qv = (floor(l * bands) + 0.5) / bands;
    qv = 0.12 + qv * 0.88;
    float sc = qv / max(l, 0.001);
    color = clamp(color * sc, 0.0, 1.0);
  }

  // Halftone in shadows
  if (s.enableHalftone > 0.5) {
    float l = luma(color);
    float shadow = smoothstep(0.55, 0.25, l) * (1.0 - smoothstep(0.15, 0.05, l));
    if (shadow > 0.01) {
      vec2 fc = uv * uResolution;
      float dr = shadow * s.halftoneSize * 0.38;
      float dv = halftonePattern(fc, s.halftoneSize, s.halftoneAngle, dr);
      vec3 dotted = color * (1.0 - dv * 0.4);
      color = mix(color, dotted, shadow * 0.7);
    }
  }

  // Saturation boost
  vec3 hsv = rgb2hsv(color);
  hsv.y = clamp(hsv.y * (1.0 + s.saturationBoost), 0.0, 1.0);
  color = hsv2rgb(hsv);

  // Outlines (Sobel on normals + depth)
  if (s.enableOutlines > 0.5) {
    float cd = linearizeDepth(texture(uDepthBuffer, uv).r);
    float df = clamp(1.0 - (cd - uCameraNear) / (uCameraFar * 0.3), 0.6, 1.3);
    float wobbleMult = 1.0;
    if (s.enableWobble > 0.5) {
      float edgeNoise = noise(uv * s.wobbleFreq * 2.0 + uTime * 1.2);
      wobbleMult = 0.7 + edgeNoise * 0.6;
    }
    vec2 t = texel * s.outlineThickness * df * wobbleMult;

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
    // Quadratic normalization kills grazing-angle artifacts on the ground plane
    float de = (abs(dgx) + abs(dgy)) / (cd * cd * 0.12 + cd * 0.3 + 0.15);

    ne = min(ne, 3.0);
    float edge = max(ne * 0.25, de * 1.2);
    edge = smoothstep(s.outlineThreshold, s.outlineThreshold + 0.5, edge);
    color = mix(color, vec3(0.05, 0.03, 0.02), edge);
  }

  // CMYK misregistration
  if (s.enableCmyk > 0.5) {
    float px = s.cmykOffset * texel.x;
    float py = s.cmykOffset * texel.y;
    float drift = sin(uTime * 1.5) * 0.3 + 0.7;
    vec2 cOff = vec2( px * 0.7,  py * 1.0) * drift;
    vec2 mOff = vec2(-px * 1.0,  py * 0.5) * drift;
    vec2 yOff = vec2( px * 0.3, -py * 0.8) * drift;
    vec3 cSample = texture(uDiffuse, uv + cOff).rgb;
    vec3 mSample = texture(uDiffuse, uv + mOff).rgb;
    vec3 ySample = texture(uDiffuse, uv + yOff).rgb;
    vec3 kSample = color;
    vec4 cCmyk = rgb2cmyk(cSample);
    vec4 mCmyk = rgb2cmyk(mSample);
    vec4 yCmyk = rgb2cmyk(ySample);
    vec4 kCmyk = rgb2cmyk(kSample);
    vec4 misreg = vec4(cCmyk.x, mCmyk.y, yCmyk.z, kCmyk.w);
    color = cmyk2rgb(misreg);
  }

  // Paper texture
  if (s.enablePaper > 0.5) {
    vec2 paperCoord = baseUv * uResolution * 0.15;
    float grain = fbm(paperCoord * 3.0) * 0.5 + 0.5;
    float fiber = noise(vec2(paperCoord.x * 4.0, paperCoord.y * 0.5)) * 0.5 + 0.5;
    float paper = mix(grain, fiber, 0.3);
    vec3 paperColor = vec3(0.95, 0.92, 0.85);
    color = color * mix(vec3(1.0), vec3(paper * 0.3 + 0.7), s.paperStrength);
    color = mix(color, color * paperColor, s.paperStrength * 0.5);
    vec2 vig = baseUv * (1.0 - baseUv);
    float vigAmount = pow(vig.x * vig.y * 20.0, 0.3);
    color *= mix(1.0, vigAmount, s.paperStrength * 0.4);
  }

  return color;
}

// ─── Sobel edge helper ───────────────────────────────

float sobelEdge(vec2 uv, vec2 t) {
  vec3 ntl = texture(uNormalBuffer, uv + vec2(-t.x, t.y)).rgb;
  vec3 ntc = texture(uNormalBuffer, uv + vec2(0.0, t.y)).rgb;
  vec3 ntr = texture(uNormalBuffer, uv + vec2(t.x, t.y)).rgb;
  vec3 nml = texture(uNormalBuffer, uv + vec2(-t.x, 0.0)).rgb;
  vec3 nmr = texture(uNormalBuffer, uv + vec2(t.x, 0.0)).rgb;
  vec3 nbl = texture(uNormalBuffer, uv + vec2(-t.x, -t.y)).rgb;
  vec3 nbc = texture(uNormalBuffer, uv + vec2(0.0, -t.y)).rgb;
  vec3 nbr = texture(uNormalBuffer, uv + vec2(t.x, -t.y)).rgb;
  vec3 ngx = -ntl - 2.0*nml - nbl + ntr + 2.0*nmr + nbr;
  vec3 ngy = -ntl - 2.0*ntc - ntr + nbl + 2.0*nbc + nbr;
  float ne = min(length(ngx) + length(ngy), 3.0);

  float cd = linearizeDepth(texture(uDepthBuffer, uv).r);
  float dtl = linearizeDepth(texture(uDepthBuffer, uv + vec2(-t.x, t.y)).r);
  float dtc = linearizeDepth(texture(uDepthBuffer, uv + vec2(0.0, t.y)).r);
  float dtr = linearizeDepth(texture(uDepthBuffer, uv + vec2(t.x, t.y)).r);
  float dml = linearizeDepth(texture(uDepthBuffer, uv + vec2(-t.x, 0.0)).r);
  float dmr = linearizeDepth(texture(uDepthBuffer, uv + vec2(t.x, 0.0)).r);
  float dbl = linearizeDepth(texture(uDepthBuffer, uv + vec2(-t.x, -t.y)).r);
  float dbc = linearizeDepth(texture(uDepthBuffer, uv + vec2(0.0, -t.y)).r);
  float dbr = linearizeDepth(texture(uDepthBuffer, uv + vec2(t.x, -t.y)).r);
  float dgx = -dtl - 2.0*dml - dbl + dtr + 2.0*dmr + dbr;
  float dgy = -dtl - 2.0*dtc - dtr + dbl + 2.0*dbc + dbr;
  float de = (abs(dgx) + abs(dgy)) / (cd * cd * 0.12 + cd * 0.3 + 0.15);

  return max(ne * 0.25, de * 1.2);
}

// ─── Lens mode: Pencil Sketch ────────────────────────

vec3 lensSketch(vec2 baseUv, vec2 texel) {
  vec3 scene = texture(uDiffuse, baseUv).rgb;
  float l = luma(scene);

  // Paper with grain
  vec2 paperCoord = baseUv * uResolution * 0.15;
  float paperNoise = fbm(paperCoord * 3.0) * 0.5 + 0.5;
  vec3 paper = vec3(0.95, 0.92, 0.87) * (0.93 + paperNoise * 0.07);

  // Cross-hatch coordinates with hand-drawn wobble
  vec2 hc = baseUv * uResolution * 0.06;
  float wbX = noise(baseUv * 30.0 + uTime * 0.15) * 0.2;
  float wbY = noise(baseUv * 30.0 + vec2(50.0, 0.0) + uTime * 0.15) * 0.2;
  hc += vec2(wbX, wbY);

  // Layer 1: 45 degrees — light shadows
  float h1 = abs(fract(hc.x + hc.y) - 0.5) * 2.0;
  float line1 = smoothstep(0.88, 0.94, h1);
  float mask1 = smoothstep(0.65, 0.3, l);

  // Layer 2: -45 degrees — medium shadows
  float h2 = abs(fract(hc.x - hc.y) - 0.5) * 2.0;
  float line2 = smoothstep(0.88, 0.94, h2);
  float mask2 = smoothstep(0.42, 0.15, l);

  // Layer 3: steep angle — dark shadows
  float h3 = abs(fract(hc.y * 1.4 + hc.x * 0.3) - 0.5) * 2.0;
  float line3 = smoothstep(0.86, 0.93, h3);
  float mask3 = smoothstep(0.22, 0.05, l);

  float hatch = min(line1 * mask1 + line2 * mask2 + line3 * mask3, 1.0);

  vec3 graphite = vec3(0.18, 0.15, 0.13);
  vec3 result = mix(paper, graphite, hatch * 0.6);

  // Pencil outlines — thick, wobbly
  float ew = noise(baseUv * 40.0 + uTime * 0.3);
  vec2 t = texel * 1.8 * (0.8 + ew * 0.5);
  float edge = sobelEdge(baseUv, t);
  edge = smoothstep(0.2, 0.65, edge);
  result = mix(result, graphite * 0.5, edge * 0.9);

  return result;
}

// ─── Lens mode: Normal Map (X-Ray) ──────────────────

vec3 lensNormals(vec2 baseUv) {
  vec3 n = texture(uNormalBuffer, baseUv).rgb;
  // Boost vibrancy and contrast
  n = pow(n, vec3(0.8));
  n = clamp((n - 0.5) * 1.3 + 0.5, 0.0, 1.0);

  // Subtle scanlines for technical feel
  float scan = sin(baseUv.y * uResolution.y * 1.5) * 0.5 + 0.5;
  scan = smoothstep(0.3, 0.7, scan);
  n *= 0.92 + scan * 0.08;

  return n;
}

// ─── Lens mode: Void (Through the Page) ─────────────

vec3 lensVoid(vec2 baseUv, vec2 texel) {
  float depth = linearizeDepth(texture(uDepthBuffer, baseUv).r);
  float depthFade = smoothstep(1.0, 18.0, depth);

  // Dark void base
  vec3 voidBase = vec3(0.01, 0.01, 0.03);

  // Glowing edges
  float ew = noise(baseUv * 30.0 + uTime * 0.3);
  vec2 t = texel * 1.5 * (0.8 + ew * 0.4);
  float edge = sobelEdge(baseUv, t);
  edge = smoothstep(0.15, 0.7, edge);

  // Glow color shifts between cyan and blue
  vec3 glowColor = mix(vec3(0.15, 0.45, 1.0), vec3(0.0, 0.75, 0.85), ew);

  // Subtle background grid
  vec2 gridCoord = baseUv * uResolution * 0.015;
  float gridX = smoothstep(0.97, 1.0, fract(gridCoord.x));
  float gridY = smoothstep(0.97, 1.0, fract(gridCoord.y));
  float grid = max(gridX, gridY);

  // Sparse floating particles
  float p1 = noise(baseUv * 250.0 + uTime * 0.4);
  float p2 = noise(baseUv * 180.0 - uTime * 0.25 + vec2(100.0, 0.0));
  float particles = smoothstep(0.96, 1.0, p1) + smoothstep(0.97, 1.0, p2);

  vec3 result = voidBase;
  result += glowColor * edge * (1.0 - depthFade) * 0.85;
  result += vec3(0.04, 0.08, 0.15) * grid * 0.2 * (1.0 - depthFade * 0.5);
  result += vec3(0.3, 0.5, 0.85) * particles * 0.35;

  return result;
}

// ─── Main ────────────────────────────────────────────

void main() {
  vec2 texel = 1.0 / uResolution;
  float aspect = uResolution.x / uResolution.y;

  // Build styles from uniforms
  Style mainStyle = Style(
    uOutlineThickness, uOutlineThreshold, uCelBands,
    uHalftoneSize, uHalftoneAngle, uSaturationBoost,
    uWobbleAmount, uWobbleFreq, uCmykOffset, uPaperStrength,
    uEnableOutlines, uEnableCelShading, uEnableHalftone,
    uEnableWobble, uEnableCmyk, uEnablePaper
  );

  Style lensStyle = Style(
    uLOutlineThickness, uLOutlineThreshold, uLCelBands,
    uLHalftoneSize, uLHalftoneAngle, uLSaturationBoost,
    uLWobbleAmount, uLWobbleFreq, uLCmykOffset, uLPaperStrength,
    uLEnableOutlines, uLEnableCelShading, uLEnableHalftone,
    uLEnableWobble, uLEnableCmyk, uLEnablePaper
  );

  // Lens mask
  vec2 mA = vec2(uMouse.x * aspect, uMouse.y);
  vec2 uvA = vec2(vUv.x * aspect, vUv.y);
  vec2 delta = uvA - mA;
  float dist = length(delta);

  // Wobble + meteor deformation — always alive, morphs into comet on fast moves
  float theta = atan(delta.y, delta.x);
  float vel = length(uMouseVel);
  vec2 velDir = uMouseVel / max(vel, 0.0001);

  // Breathing: slow organic pulsation — the blob is alive
  float breath = sin(uTime * 0.41) * 0.003 + sin(uTime * 0.17) * 0.002;

  // Base wobble: golden-ratio-spaced frequencies so the pattern never visibly loops
  float wb = (noise(vec2(theta * 3.0 + uTime * 0.71, uTime * 0.31)) - 0.5) * 0.018;
  wb += (noise(vec2(theta * 8.0 - uTime * 1.15, uTime * 0.51 + 5.0)) - 0.5) * 0.010;
  wb += (noise(vec2(theta * 5.0 + uTime * 1.86, uTime * 0.83 + 11.0)) - 0.5) * 0.006;
  wb += sin(theta * 2.0 + uTime * 0.53) * 0.004;
  wb += breath;

  // Motion wobble: scales with radius so it shrinks proportionally
  float mw = (noise(vec2(theta * 5.0 + uTime * 2.5, uTime * 1.1)) - 0.5) * vel * 0.05 * uLensRadius;
  mw += (noise(vec2(theta * 11.0 - uTime * 1.7, vel * 2.0 + 3.0)) - 0.5) * vel * 0.03 * uLensRadius;

  // Meteor shape: long trailing tail, tight compact front
  vec2 nDelta = normalize(delta + vec2(0.0001));
  float dirDot = dot(nDelta, velDir);
  float behind = max(-dirDot, 0.0);
  float ahead = max(dirDot, 0.0);
  // Tail: subtle stretch behind, scales with radius so it shrinks too
  float tailStretch = pow(behind, 0.35) * vel * 0.12 * uLensRadius;
  tailStretch += pow(behind, 2.0) * vel * 0.06 * uLensRadius;
  // Front: compress hard so the head is tight
  float frontSquish = pow(ahead, 0.8) * vel * 0.03 * uLensRadius;
  float chase = frontSquish - tailStretch;

  float edgeWobble = wb + mw + chase;
  float effectiveDist = dist + edgeWobble;

  float lensMask = 1.0 - smoothstep(uLensRadius - uLensSmooth, uLensRadius, effectiveDist);

  // Main style (always computed)
  vec3 mainColor = applyStyle(vUv, texel, mainStyle);
  vec3 finalColor = mainColor;

  // Lens effect (only when active and near cursor)
  if (uLensRadius > 0.001 && lensMask > 0.001) {
    vec3 lensColor;
    if (uLensMode < 0.5) {
      lensColor = lensSketch(vUv, texel);
    } else if (uLensMode < 1.5) {
      lensColor = lensNormals(vUv);
    } else {
      lensColor = lensVoid(vUv, texel);
    }
    finalColor = mix(mainColor, lensColor, lensMask);
  }

  // Ink border ring — breathes slowly, variable thickness like a real ink stroke
  if (uLensRadius > 0.001) {
    float thicknessVar = noise(vec2(theta * 5.0, uTime * 0.18));
    float ringBreath = 1.0 + sin(uTime * 0.61) * 0.12;
    float ringW = mix(0.003, 0.009, thicknessVar) * ringBreath;
    float ringDist = abs(effectiveDist - uLensRadius);
    float ring = 1.0 - smoothstep(0.0, ringW, ringDist);
    // Opacity varies around the ring — ink pools in some spots
    float inkDensity = 0.75 + noise(vec2(theta * 3.0 + 7.0, uTime * 0.12)) * 0.25;
    finalColor = mix(finalColor, vec3(0.05, 0.03, 0.02), ring * inkDensity);
  }

  fragColor = vec4(finalColor, 1.0);
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
  uMouse: { value: THREE.Vector2 };
  // Lens style
  uLOutlineThickness: { value: number };
  uLOutlineThreshold: { value: number };
  uLCelBands: { value: number };
  uLHalftoneSize: { value: number };
  uLHalftoneAngle: { value: number };
  uLSaturationBoost: { value: number };
  uLWobbleAmount: { value: number };
  uLWobbleFreq: { value: number };
  uLCmykOffset: { value: number };
  uLPaperStrength: { value: number };
  uLEnableOutlines: { value: number };
  uLEnableCelShading: { value: number };
  uLEnableHalftone: { value: number };
  uLEnableWobble: { value: number };
  uLEnableCmyk: { value: number };
  uLEnablePaper: { value: number };
  // Lens geometry
  uLensRadius: { value: number };
  uLensSmooth: { value: number };
  uMouseVel: { value: THREE.Vector2 };
  uLensMode: { value: number };
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
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    // Lens style (defaults to Noir — contrast of default Comic Book)
    uLOutlineThickness: { value: 1.5 },
    uLOutlineThreshold: { value: 0.3 },
    uLCelBands: { value: 3.0 },
    uLHalftoneSize: { value: 4.0 },
    uLHalftoneAngle: { value: 0.78 },
    uLSaturationBoost: { value: -0.85 },
    uLWobbleAmount: { value: 3.0 },
    uLWobbleFreq: { value: 8.0 },
    uLCmykOffset: { value: 0.0 },
    uLPaperStrength: { value: 0.6 },
    uLEnableOutlines: { value: 1.0 },
    uLEnableCelShading: { value: 1.0 },
    uLEnableHalftone: { value: 1.0 },
    uLEnableWobble: { value: 1.0 },
    uLEnableCmyk: { value: 0.0 },
    uLEnablePaper: { value: 1.0 },
    // Lens geometry
    uLensRadius: { value: 0.0 },
    uLensSmooth: { value: 0.022 },
    uMouseVel: { value: new THREE.Vector2(0, 0) },
    uLensMode: { value: 0.0 },
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
