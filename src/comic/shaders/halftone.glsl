// Halftone dot pattern utility
// Returns 1.0 inside dot, 0.0 outside, with smooth edges

float halftonePattern(vec2 fragCoord, float gridSize, float angle, float radius) {
  // Rotate UV space by angle
  float c = cos(angle);
  float s = sin(angle);
  vec2 rotated = vec2(
    fragCoord.x * c - fragCoord.y * s,
    fragCoord.x * s + fragCoord.y * c
  );

  // Tile into grid
  vec2 cell = mod(rotated, gridSize) - gridSize * 0.5;

  // Distance from center of nearest dot
  float dist = length(cell);

  // Smooth circle: 1 inside, 0 outside
  return 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
}
