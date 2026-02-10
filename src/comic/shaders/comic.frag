uniform sampler2D uDiffuse;
uniform sampler2D uNormalBuffer;
uniform sampler2D uDepthBuffer;
uniform vec2 uResolution;
uniform float uCameraNear;
uniform float uCameraFar;

// Effect controls (using float instead of bool/int for WebGL compat)
uniform float uOutlineThickness;
uniform float uOutlineThreshold;
uniform float uCelBands;
uniform float uHalftoneSize;
uniform float uHalftoneAngle;
uniform float uSaturationBoost;
uniform float uEnableOutlines;
uniform float uEnableCelShading;
uniform float uEnableHalftone;

varying vec2 vUv;

// --- Halftone utility (inlined) ---
float halftonePattern(vec2 fragCoord, float gridSize, float angle, float radius) {
  float c = cos(angle);
  float s = sin(angle);
  vec2 rotated = vec2(
    fragCoord.x * c - fragCoord.y * s,
    fragCoord.x * s + fragCoord.y * c
  );
  vec2 cell = mod(rotated, gridSize) - gridSize * 0.5;
  float dist = length(cell);
  return 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
}

// Linearize depth from depth buffer
float linearizeDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}

// Luminance
float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// Sobel edge detection on a texture (3-channel)
float sobelEdge(sampler2D tex, vec2 uv, vec2 texelSize, float thickness) {
  vec2 t = texelSize * thickness;

  vec3 tl = texture2D(tex, uv + vec2(-t.x,  t.y)).rgb;
  vec3 tc = texture2D(tex, uv + vec2( 0.0,  t.y)).rgb;
  vec3 tr = texture2D(tex, uv + vec2( t.x,  t.y)).rgb;
  vec3 ml = texture2D(tex, uv + vec2(-t.x,  0.0)).rgb;
  vec3 mr = texture2D(tex, uv + vec2( t.x,  0.0)).rgb;
  vec3 bl = texture2D(tex, uv + vec2(-t.x, -t.y)).rgb;
  vec3 bc = texture2D(tex, uv + vec2( 0.0, -t.y)).rgb;
  vec3 br = texture2D(tex, uv + vec2( t.x, -t.y)).rgb;

  vec3 gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  vec3 gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;

  return length(gx) + length(gy);
}

// Sobel on depth (single channel)
float sobelDepthEdge(vec2 uv, vec2 texelSize, float thickness) {
  vec2 t = texelSize * thickness;

  float tl = linearizeDepth(texture2D(uDepthBuffer, uv + vec2(-t.x,  t.y)).r);
  float tc = linearizeDepth(texture2D(uDepthBuffer, uv + vec2( 0.0,  t.y)).r);
  float tr = linearizeDepth(texture2D(uDepthBuffer, uv + vec2( t.x,  t.y)).r);
  float ml = linearizeDepth(texture2D(uDepthBuffer, uv + vec2(-t.x,  0.0)).r);
  float mr = linearizeDepth(texture2D(uDepthBuffer, uv + vec2( t.x,  0.0)).r);
  float bl = linearizeDepth(texture2D(uDepthBuffer, uv + vec2(-t.x, -t.y)).r);
  float bc = linearizeDepth(texture2D(uDepthBuffer, uv + vec2( 0.0, -t.y)).r);
  float br = linearizeDepth(texture2D(uDepthBuffer, uv + vec2( t.x, -t.y)).r);

  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;

  return abs(gx) + abs(gy);
}

// HSV conversions for saturation boost
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec4 diffuse = texture2D(uDiffuse, vUv);
  vec3 color = diffuse.rgb;

  // --- STEP 1: Cel shading ---
  if (uEnableCelShading > 0.5) {
    float luma = luminance(color);
    float bands = uCelBands;
    float quantized = floor(luma * bands + 0.5) / bands;
    // Apply quantized luminance, preserving hue
    float scale = mix(1.0, quantized / max(luma, 0.001), step(0.001, luma));
    color = clamp(color * scale, 0.0, 1.0);
  }

  // --- STEP 2: Halftone in shadows ---
  if (uEnableHalftone > 0.5) {
    float luma = luminance(color);
    float shadowAmount = smoothstep(0.45, 0.2, luma);

    if (shadowAmount > 0.01) {
      vec2 fragCoord = vUv * uResolution;
      float dotRadius = shadowAmount * uHalftoneSize * 0.45;
      float dotVal = halftonePattern(fragCoord, uHalftoneSize, uHalftoneAngle, dotRadius);

      // In shadow areas: dark dots on slightly lighter base
      vec3 dotColor = color * 0.35;
      vec3 baseColor = color * 1.15;
      vec3 halftoneColor = mix(baseColor, dotColor, dotVal);

      color = mix(color, halftoneColor, shadowAmount);
    }
  }

  // --- STEP 3: Saturation boost ---
  vec3 hsv = rgb2hsv(color);
  hsv.y = clamp(hsv.y * (1.0 + uSaturationBoost), 0.0, 1.0);
  color = hsv2rgb(hsv);

  // --- STEP 4: Edge detection (outlines) ---
  if (uEnableOutlines > 0.5) {
    float centerDepth = linearizeDepth(texture2D(uDepthBuffer, vUv).r);
    float depthFactor = clamp(1.0 - (centerDepth - uCameraNear) / (uCameraFar * 0.3), 0.6, 1.3);
    float thickness = uOutlineThickness * depthFactor;

    float normalEdge = sobelEdge(uNormalBuffer, vUv, texelSize, thickness);
    float depthEdge = sobelDepthEdge(vUv, texelSize, thickness);

    // Normalize depth edge based on distance
    depthEdge = depthEdge / (centerDepth * 0.15 + 0.1);

    // Combine edges
    float edge = max(normalEdge * 0.8, depthEdge * 2.5);
    edge = smoothstep(uOutlineThreshold, uOutlineThreshold + 0.15, edge);

    // Black outlines
    color = mix(color, vec3(0.05, 0.03, 0.02), edge);
  }

  gl_FragColor = vec4(color, 1.0);
}
