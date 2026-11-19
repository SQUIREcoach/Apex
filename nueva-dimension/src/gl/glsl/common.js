// Shared GLSL chunks. All colours are authored in LINEAR space;
// the composite pass does tone mapping and sRGB encoding once.
//
// Brand references (sRGB → linear):
//   APEX navy   #0A2239 → (0.0030, 0.0157, 0.0409)
//   Ivory       #EFEBE1 → (0.8632, 0.8308, 0.7529)
//   Champagne   #C9A96B → (0.5841, 0.3968, 0.1470)

export const BRAND = /* glsl */ `
const vec3 NAVY = vec3(0.0030, 0.0157, 0.0409);
const vec3 IVORY = vec3(0.8632, 0.8308, 0.7529);
const vec3 CHAMPAGNE = vec3(0.5841, 0.3968, 0.1470);
const float PI = 3.14159265359;
`;

// Hash / value noise / fbm. Original implementation (no third-party code).
export const NOISE = /* glsl */ `
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

// Small-scale wind waves: sum of directional sines with analytic gradient.
// Returns d(height)/dx, d(height)/dz in metres per metre.
export const WAVES = /* glsl */ `
vec2 waveGrad(vec2 p, float t, float amp){
  vec2 g = vec2(0.0);
  // direction, wavelength (m), amplitude (m), speed
  const int N = 7;
  vec4 W[7];
  W[0] = vec4( 0.95,  0.31, 3.10, 0.010);
  W[1] = vec4( 0.62, -0.78, 1.85, 0.006);
  W[2] = vec4(-0.45,  0.89, 1.20, 0.004);
  W[3] = vec4( 0.20,  0.98, 0.73, 0.0024);
  W[4] = vec4(-0.86, -0.51, 0.51, 0.0016);
  W[5] = vec4( 0.71,  0.70, 0.33, 0.0010);
  W[6] = vec4(-0.15, -0.99, 0.21, 0.0006);
  for (int i = 0; i < N; i++){
    vec2 d = W[i].xy;
    float k = 6.2831853 / W[i].z;
    float w = sqrt(9.81 * k);
    float ph = dot(d, p) * k - w * t * 0.55 + float(i) * 1.7;
    g += d * (W[i].w * k * cos(ph));
  }
  // break up the regularity with a slowly drifting noise field
  float e = 0.15;
  vec2 q = p * 0.35 + vec2(t * 0.03, -t * 0.02);
  float n0 = fbm(q);
  g += vec2(fbm(q + vec2(e, 0.0)) - n0, fbm(q + vec2(0.0, e)) - n0) / e * 0.012;
  return g * amp;
}
`;

// Animated caustic network: two warped cellular layers, edges brightened.
export const CAUSTICS = /* glsl */ `
float cellEdge(vec2 x, float t){
  vec2 n = floor(x);
  vec2 f = fract(x);
  float d1 = 8.0, d2 = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    o = 0.5 + 0.42 * sin(t + 6.2831853 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
float caustics(vec2 p, float t){
  vec2 w = vec2(vnoise(p * 0.6 + t * 0.07), vnoise(p * 0.6 + 9.3 - t * 0.05)) - 0.5;
  p += w * 0.9;
  float a = cellEdge(p, t * 0.9);
  float b = cellEdge(p * 1.43 + vec2(5.2, 1.3), t * 1.1 + 2.0);
  float ca = 1.0 - smoothstep(0.0, 0.22, a);
  float cb = 1.0 - smoothstep(0.0, 0.22, b);
  return ca * ca * 0.75 + cb * cb * cb * 0.55;
}
`;

// Dusk sky over the sea. Used for the background, for reflections and,
// boosted, for the view through Snell's window from under the surface.
export const SKY = /* glsl */ `
uniform vec3 uSunDir;
vec3 skyColor(vec3 d){
  float h = d.y;
  vec3 zen = vec3(0.0012, 0.0062, 0.0185);
  vec3 hor = vec3(0.012, 0.030, 0.058);
  vec3 col = mix(hor, NAVY, smoothstep(-0.02, 0.14, h));
  col = mix(col, zen, smoothstep(0.16, 0.8, h));
  vec2 dz = normalize(d.xz + vec2(1e-5));
  float az = max(dot(dz, normalize(uSunDir.xz)), 0.0);
  float hh = max(h, 0.0);
  col += CHAMPAGNE * exp(-hh * 24.0) * (0.018 + 0.20 * pow(az, 8.0));
  col += vec3(0.95, 0.80, 0.58) * exp(-hh * 80.0) * (0.010 + 0.24 * pow(az, 16.0));
  col += IVORY * exp(-abs(h) * 320.0) * (0.015 + 0.08 * pow(az, 10.0));
  // a handful of faint stars high up
  vec2 sp = d.xz / max(d.y, 0.05) * 90.0;
  float st = step(0.9965, hash12(floor(sp))) * smoothstep(0.25, 0.6, h);
  col += vec3(0.5, 0.55, 0.6) * st * 0.06;
  return col;
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
