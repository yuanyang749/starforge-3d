import * as THREE from 'three';

export type EnvMode = 'boot' | 'hangar' | 'combat';

type VistaKey = 'hangar' | 'act1' | 'act2' | 'act3' | 'act4';

interface SkyPalette {
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  nadir: THREE.Color;
  auroraA: THREE.Color;
  auroraB: THREE.Color;
  sunColor: THREE.Color;
  starIntensity: number;
  auroraIntensity: number;
}

interface MegalithState {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  bobPhase: number;
  bobAmp: number;
  crystalScale: number;
}

interface ScrollingMatteProp {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  speedMult: number;
  spanZ: number;
  wrapZ: number;
  baseY?: number;
  bobAmp?: number;
  bobPhase?: number;
  spinZ?: number;
}

interface CorridorStreakState {
  x: number;
  y: number;
  baseY: number;
  z: number;
  speedMult: number;
  length: number;
  thickness?: number;
  vy?: number;
  bobPhase?: number;
}

interface ActVideoSlot {
  act: 1 | 2 | 3 | 4;
  vistaKey: 'act1' | 'act2' | 'act3' | 'act4';
  video: HTMLVideoElement;
  tex: THREE.VideoTexture | null;
  ready: boolean;
}

interface SearchlightState {
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  side: number;
  phase: number;
  speed: number;
}

interface DustParticle {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  thickness: number;
  baseLength: number;
}

const SKY_PALETTES: Record<VistaKey, SkyPalette> = {
  hangar: {
    zenith: new THREE.Color(0x0b2a5b),
    mid: new THREE.Color(0x165b94),
    horizon: new THREE.Color(0x4bc8e8),
    nadir: new THREE.Color(0x123254),
    auroraA: new THREE.Color(0x52f2ff),
    auroraB: new THREE.Color(0xffc966),
    sunColor: new THREE.Color(0xffe1a8),
    starIntensity: 0.72,
    auroraIntensity: 0.55,
  },
  act1: {
    zenith: new THREE.Color(0x040d26),
    mid: new THREE.Color(0x0a214c),
    horizon: new THREE.Color(0x996038),
    nadir: new THREE.Color(0x07152e),
    auroraA: new THREE.Color(0x38c8f0),
    auroraB: new THREE.Color(0xd9924c),
    sunColor: new THREE.Color(0xffcfa0),
    starIntensity: 0.72,
    auroraIntensity: 0.25,
  },
  act2: {
    zenith: new THREE.Color(0x0b254f),
    mid: new THREE.Color(0x164a7e),
    horizon: new THREE.Color(0x5ab8d8),
    nadir: new THREE.Color(0x112a4a),
    auroraA: new THREE.Color(0x3ad8ff),
    auroraB: new THREE.Color(0xffc06a),
    sunColor: new THREE.Color(0xffd796),
    starIntensity: 0.65,
    auroraIntensity: 0.35,
  },
  act3: {
    zenith: new THREE.Color(0x0b0a2b),
    mid: new THREE.Color(0x1b1954),
    horizon: new THREE.Color(0x1da89b),
    nadir: new THREE.Color(0x0e1c3d),
    auroraA: new THREE.Color(0x2be0c8),
    auroraB: new THREE.Color(0xa855f7),
    sunColor: new THREE.Color(0x98ffe8),
    starIntensity: 0.9,
    auroraIntensity: 0.45,
  },
  act4: {
    zenith: new THREE.Color(0x24090f),
    mid: new THREE.Color(0x561517),
    horizon: new THREE.Color(0xd96b28),
    nadir: new THREE.Color(0x220a0d),
    auroraA: new THREE.Color(0xffb347),
    auroraB: new THREE.Color(0xe63946),
    sunColor: new THREE.Color(0xffc46b),
    starIntensity: 0.55,
    auroraIntensity: 0.35,
  },
};

const SCENE_LIGHT_PRESETS: Record<
  VistaKey,
  {
    hemiSky: THREE.Color;
    hemiGround: THREE.Color;
    hemiIntensity: number;
    rimColor: THREE.Color;
    rimIntensity: number;
    fillColor: THREE.Color;
    fillIntensity: number;
    envIntensity: number;
  }
> = {
  hangar: {
    hemiSky: new THREE.Color(0x9ee6ff),
    hemiGround: new THREE.Color(0x0e1428),
    hemiIntensity: 0.78,
    rimColor: new THREE.Color(0x22e8ff),
    rimIntensity: 1.75,
    fillColor: new THREE.Color(0xffa63b),
    fillIntensity: 0.65,
    envIntensity: 1.35,
  },
  act1: {
    hemiSky: new THREE.Color(0x9ee6ff),
    hemiGround: new THREE.Color(0x0e1428),
    hemiIntensity: 0.78,
    rimColor: new THREE.Color(0x22e8ff),
    rimIntensity: 1.75,
    fillColor: new THREE.Color(0xffa63b),
    fillIntensity: 0.72,
    envIntensity: 1.35,
  },
  act2: {
    hemiSky: new THREE.Color(0x9ee6ff),
    hemiGround: new THREE.Color(0x0e1428),
    hemiIntensity: 0.78,
    rimColor: new THREE.Color(0x22e8ff),
    rimIntensity: 1.75,
    fillColor: new THREE.Color(0xffa63b),
    fillIntensity: 0.65,
    envIntensity: 1.35,
  },
  act3: {
    hemiSky: new THREE.Color(0x76e8d8),
    hemiGround: new THREE.Color(0x160c2a),
    hemiIntensity: 0.72,
    rimColor: new THREE.Color(0x36f0d2),
    rimIntensity: 1.55,
    fillColor: new THREE.Color(0xb85cff),
    fillIntensity: 0.72,
    envIntensity: 1.15,
  },
  act4: {
    hemiSky: new THREE.Color(0x8a5248),
    hemiGround: new THREE.Color(0x1a080a),
    hemiIntensity: 0.56,
    rimColor: new THREE.Color(0xff542e),
    rimIntensity: 1.45,
    fillColor: new THREE.Color(0xff9e44),
    fillIntensity: 0.78,
    envIntensity: 0.42,
  },
};

const DUST_COUNT = 340;
const DUST_ACT_COLORS = [
  new THREE.Color(0x94ecff),
  new THREE.Color(0x6de8ff),
  new THREE.Color(0xb8fff0),
  new THREE.Color(0xffb56b),
] as const;
const ACT1_SLIPSTREAM_COUNT = 48;
const ACT2_METRO_PYLON_COUNT = 28;
const ACT2_METRO_ARCH_COUNT = 5;
const ACT2_METRO_TRAFFIC_COUNT = 64;
const ACT3_DEBRIS_COUNT = 24;
const ACT3_WARP_RING_COUNT = 5;
const ACT3_STREAK_COUNT = 64;
const ACT4_ARCH_COUNT = 5;
const ACT4_EMBER_COUNT = 72;

const SKY_VERT = `
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  uniform float uTime;
  uniform float uScroll;
  uniform vec3 uZenithColor;
  uniform vec3 uMidColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uNadirColor;
  uniform vec3 uAuroraA;
  uniform vec3 uAuroraB;
  uniform vec3 uSunColor;
  uniform float uStarIntensity;
  uniform float uAuroraIntensity;
  varying vec3 vWorldDir;

  float hash31(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxx + 33.19);
    return fract((p.xxy + p.yzz) * p.zyx);
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 3; i++) {
      v += a * noise3(p);
      p = p * 2.04 + vec3(13.7, -7.3, 9.1);
      a *= 0.5;
    }
    return v;
  }

  vec3 starLayer(vec3 dir, float scale, float density, float sizeLimit) {
    vec3 p = dir * scale;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    vec3 rnd = hash33(cell);
    float present = step(density, rnd.x);
    vec3 center = (rnd - 0.5) * 0.52;
    float d = length(f - center);
    float radius = mix(0.035, sizeLimit, rnd.y * rnd.y);
    float disc = smoothstep(radius, radius * 0.14, d);
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.8 + rnd.z * 3.8) + rnd.x * 42.0);
    vec3 starCol = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.9, 0.72), rnd.z);
    return starCol * present * disc * twinkle;
  }

  void main() {
    float dirLen = length(vWorldDir);
    vec3 dir = dirLen > 1e-5 ? (vWorldDir / dirLen) : vec3(0.0, 0.0, -1.0);
    float y = dir.y;

    // Multi-stop vertical atmospheric gradient
    vec3 upper = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.34, y));
    upper = mix(upper, uZenithColor, smoothstep(0.30, 0.88, y));
    vec3 lower = mix(uHorizonColor * 0.82, uNadirColor, smoothstep(0.0, -0.45, y));
    vec3 skyCol = y >= 0.0 ? upper : lower;

    // Horizon atmospheric scattering halo
    float horizonGlow = pow(max(1e-4, 1.0 - min(1.0, abs(y))), 5.0);
    skyCol += uHorizonColor * horizonGlow * 0.28;

    // Forward solar / pulsar scattering
    vec3 sunDir = normalize(vec3(0.16, 0.18, -1.0));
    float sunDot = clamp(dot(dir, sunDir), 0.0, 1.0);
    skyCol += uSunColor * pow(max(1e-4, sunDot), 7.0) * 0.26;
    skyCol += uSunColor * pow(max(1e-4, sunDot), 72.0) * 0.65;

    // Seamless 3D FBM aurora & cosmic nebula wisps (skip below horizon / above zenith)
    float bandMask = smoothstep(-0.12, 0.25, y) * (1.0 - smoothstep(0.45, 0.95, y));
    if (bandMask > 0.005 && uAuroraIntensity > 0.01) {
      vec3 wispCoord = dir * vec3(2.3, 4.4, 2.3) + vec3(uTime * 0.015, -uTime * 0.008, uScroll * 0.00018);
      float n1 = fbm3(wispCoord);
      float n2 = fbm3(wispCoord * 1.85 + vec3(4.2, uTime * 0.02, -3.1));
      float ribbon = smoothstep(0.42, 0.78, n1 * 0.65 + n2 * 0.35) * bandMask;
      vec3 auroraCol = mix(uAuroraA, uAuroraB, smoothstep(0.32, 0.70, n2));
      skyCol += auroraCol * ribbon * uAuroraIntensity * 0.52;
    }

    // Soft anti-aliased twinkling circular stars (skip lower hemisphere & strong horizon haze)
    float starFade = smoothstep(-0.22, 0.24, y) * (1.0 - horizonGlow * 0.45);
    if (starFade > 0.005 && uStarIntensity > 0.01) {
      vec3 stars = starLayer(dir, 58.0, 0.76, 0.085) * 1.15
                 + starLayer(dir, 112.0, 0.72, 0.075) * 0.85;
      skyCol += stars * starFade * uStarIntensity;
    }

    gl_FragColor = vec4(skyCol, 1.0);
  }
`;

const CYCLORAMA_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CYCLORAMA_FRAG = `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uTexAIsVideo;
  uniform float uTexBIsVideo;
  uniform float uTexMix;
  uniform float uBrightness;
  uniform float uEdgeFeather;
  uniform float uVertFeatherTop;
  uniform float uVertFeatherBottom;
  uniform float uOpacity;
  varying vec2 vUv;

  vec3 decodeVideoSrgb(vec3 c) {
    vec3 low = c * 0.0773993808;
    vec3 high = pow(max(vec3(1e-5), c * 0.9478672986 + vec3(0.0521327014)), vec3(2.4));
    return mix(high, low, step(c, vec3(0.04045)));
  }

  void main() {
    // Flip horizontal UV because BackSide sphere faces inward toward -Z
    vec2 texUv = vec2(1.0 - vUv.x, vUv.y);
    vec3 colA = texture2D(uTexA, texUv).rgb;
    if (uTexAIsVideo > 0.5) colA = decodeVideoSrgb(colA);
    vec3 colB = texture2D(uTexB, texUv).rgb;
    if (uTexBIsVideo > 0.5) colB = decodeVideoSrgb(colB);
    vec3 vista = mix(colA, colB, uTexMix) * uBrightness;

    float hMask = smoothstep(0.0, uEdgeFeather, vUv.x) * (1.0 - smoothstep(1.0 - uEdgeFeather, 1.0, vUv.x));
    float vMask = smoothstep(0.0, uVertFeatherBottom, vUv.y) * (1.0 - smoothstep(1.0 - uVertFeatherTop, 1.0, vUv.y));
    float cornerDist = length((vUv - 0.5) * vec2(1.92, 1.98));
    float cornerMask = 1.0 - smoothstep(0.86, 1.08, cornerDist);
    float alpha = clamp(hMask * vMask * cornerMask * uOpacity, 0.0, 1.0);
    if (!(alpha >= 0.004)) discard;
    gl_FragColor = vec4(vista, alpha);
  }
`;

const VOLUMETRIC_BEAM_VERT = `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float viewLen = length(mvPos.xyz);
    vViewDir = viewLen > 1e-5 ? (-mvPos.xyz / viewLen) : vec3(0.0, 0.0, 1.0);
    vec3 nView = normalMatrix * normal;
    float nLen = length(nView);
    vNormalView = nLen > 1e-5 ? (nView / nLen) : vec3(0.0, 1.0, 0.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const VOLUMETRIC_BEAM_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uFromBottom;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    float nLen = length(vNormalView);
    float vLen = length(vViewDir);
    vec3 nDir = nLen > 1e-5 ? (vNormalView / nLen) : vec3(0.0, 1.0, 0.0);
    vec3 vDir = vLen > 1e-5 ? (vViewDir / vLen) : vec3(0.0, 0.0, 1.0);
    float edge = clamp(abs(dot(nDir, vDir)), 0.0, 1.0);
    float softEdge = pow(max(1e-4, edge), 1.55);
    float along = clamp(uFromBottom > 0.5 ? vUv.y : (1.0 - vUv.y), 0.0, 1.0);
    float verticalFade = smoothstep(0.0, 0.10, along) * pow(max(1e-4, 1.0 - along), 1.45);
    float shimmer = 0.88 + 0.12 * sin(uTime * 2.4 + vUv.x * 12.56);
    float alpha = clamp(softEdge * verticalFade * uOpacity * shimmer, 0.0, 1.0);
    if (!(alpha >= 0.003)) discard;
    gl_FragColor = vec4(uColor * 1.25, alpha);
  }
`;

const ACT1_MATTE_VERT = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CLOUD_SEA_VERT = `
  varying vec2 vWorldXZ;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const CLOUD_SEA_FRAG = `
  uniform float uTime;
  uniform float uScrollZ;
  varying vec2 vWorldXZ;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm2(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 3; i++) {
      v += a * noise2(p);
      p = p * 2.03 + vec2(17.1, 31.7);
      a *= 0.5;
    }
    return v;
  }

  float fbm2Detail(vec2 p) {
    float v = 0.55 * noise2(p);
    p = p * 2.05 + vec2(23.4, -19.2);
    return v + 0.35 * noise2(p);
  }

  void main() {
    float distX = 1.0 - smoothstep(95.0, 205.0, abs(vWorldXZ.x));
    float distZ = smoothstep(-275.0, -145.0, vWorldXZ.y) * (1.0 - smoothstep(12.0, 42.0, vWorldXZ.y));
    float alpha = clamp(distX * distZ, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec2 p = vec2(vWorldXZ.x * 0.022, (vWorldXZ.y - uScrollZ * 0.52) * 0.022);
    float base = fbm2(p + vec2(uTime * 0.025, 0.0));
    float detail = fbm2Detail(p * 2.35 - vec2(uTime * 0.04, uTime * 0.015));
    float cloud = smoothstep(0.28, 0.82, base * 0.68 + detail * 0.32);

    vec3 deepTrough = vec3(0.08, 0.21, 0.39);
    vec3 midCloud = vec3(0.20, 0.43, 0.65);
    vec3 sunlitCrest = vec3(0.86, 0.68, 0.46);
    vec3 col = mix(deepTrough, midCloud, smoothstep(0.0, 0.58, cloud));
    col = mix(col, sunlitCrest, smoothstep(0.55, 0.98, cloud));

    gl_FragColor = vec4(col, alpha);
  }
`;

const TERRACE_DECK_VERT = `
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const TERRACE_DECK_FRAG = `
  uniform float uTime;
  uniform float uScrollZ;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.5);
    return fract(p.x * p.y);
  }

  void main() {
    float nLen = length(vWorldNormal);
    vec3 n = nLen > 1e-5 ? (vWorldNormal / nLen) : vec3(0.0, 1.0, 0.0);
    float x = vWorldPos.x;
    float z = vWorldPos.z - uScrollZ;

    vec2 bayCoord = vec2(vLocalPos.x * 0.28, z * 0.14);
    vec2 bayCell = floor(bayCoord);
    vec2 bayF = fract(bayCoord);
    float plateTone = 0.86 + 0.26 * hash21(bayCell);

    float baySeam = min(
      smoothstep(0.0, 0.045, bayF.x) * (1.0 - smoothstep(0.955, 1.0, bayF.x)),
      smoothstep(0.0, 0.045, bayF.y) * (1.0 - smoothstep(0.955, 1.0, bayF.y))
    );
    vec2 subF = fract(bayCoord * 2.0);
    float subSeam = min(
      smoothstep(0.0, 0.035, subF.x) * (1.0 - smoothstep(0.965, 1.0, subF.x)),
      smoothstep(0.0, 0.035, subF.y) * (1.0 - smoothstep(0.965, 1.0, subF.y))
    );

    float isTop = step(0.5, n.y);
    vec3 sunDir = normalize(vec3(0.28, 0.65, -0.71));
    float diff = max(0.0, dot(n, sunDir));
    vec3 metal = vec3(0.038, 0.068, 0.114) * plateTone * (0.72 + 0.28 * diff);
    metal *= mix(0.76, 1.0, baySeam) * mix(0.88, 1.0, subSeam);
    metal += vec3(0.02, 0.065, 0.11) * (1.0 - baySeam);

    float conduit = 1.0 - smoothstep(0.15, 0.95, abs(abs(vLocalPos.x) - 5.8));
    float ribTick = step(0.42, fract(z * 0.25));
    metal = mix(metal, metal * 0.68 + vec3(0.015, 0.055, 0.095) * ribTick, conduit * 0.72 * isTop);

    float innerBorder = 1.0 - smoothstep(0.08, 0.52, abs(abs(x) - 14.85));
    float outerBorder = 1.0 - smoothstep(0.10, 0.58, abs(abs(x) - 36.15));
    float flowCyan = 0.52 + 0.48 * pow(max(1e-4, sin(z * 0.32 - uTime * 7.5)), 8.0);
    float flowAmber = pow(max(1e-4, sin(z * 0.22 + uTime * 5.2)), 12.0);

    vec3 cyanLight = vec3(0.06, 0.74, 0.96);
    vec3 amberLight = vec3(1.05, 0.66, 0.20);
    vec3 col = metal;
    col += cyanLight * (innerBorder * 0.72 + outerBorder * 0.58) * flowCyan * isTop;
    col += amberLight * (1.0 - smoothstep(0.05, 0.32, abs(abs(vLocalPos.x) - 9.4))) * flowAmber * 0.78 * isTop;

    float sideRibs = smoothstep(0.88, 0.98, abs(sin(z * 0.45)));
    float sideSlit = 1.0 - smoothstep(0.06, 0.28, abs(vLocalPos.y - 0.18));
    vec3 fasciaCol = vec3(0.036, 0.065, 0.11) + vec3(0.03, 0.08, 0.14) * sideRibs + cyanLight * sideSlit * 0.58;
    col = mix(fasciaCol, col, isTop);

    float farFade = smoothstep(-255.0, -145.0, vWorldPos.z);
    vec3 horizonHaze = vec3(0.10, 0.22, 0.38);
    col = mix(horizonHaze, col, farFade);
    float alpha = clamp(farFade, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const ACT1_MATTE_FRAG = `
  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform vec3 uHazeColor;
  uniform float uOpacity;
  uniform float uHazeStrength;
  uniform float uFarStart;
  uniform float uFarEnd;
  uniform float uNearStart;
  uniform float uNearEnd;
  uniform float uBottomFeather;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.015) discard;
    float farFade = smoothstep(uFarStart, uFarEnd, vWorldPos.z);
    float nearFade = 1.0 - smoothstep(uNearStart, uNearEnd, vWorldPos.z);
    float bottomFade = uBottomFeather > 0.001 ? smoothstep(0.0, uBottomFeather, vUv.y) : 1.0;
    float alpha = clamp(tex.a * uOpacity * farFade * nearFade * bottomFade, 0.0, 1.0);
    if (alpha < 0.01) discard;
    float distHaze = 1.0 - smoothstep(-210.0, -35.0, vWorldPos.z);
    float hazeAmt = clamp(distHaze * uHazeStrength + (1.0 - farFade) * 0.42, 0.0, 0.88);
    vec3 col = mix(tex.rgb * uTint, uHazeColor, hazeAmt);
    gl_FragColor = vec4(col, alpha);
  }
`;

const CRYSTAL_ROCK_VERT = `
  attribute vec4 aMeta;
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec4 vMeta;
  varying vec3 vInstColor;

  void main() {
    vLocalPos = position;
    vMeta = aMeta;
    #ifdef USE_INSTANCING_COLOR
      vInstColor = instanceColor;
    #else
      vInstColor = vec3(0.55, 0.25, 0.95);
    #endif
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CRYSTAL_ROCK_FRAG = `
  uniform float uTime;
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec4 vMeta;
  varying vec3 vInstColor;

  void main() {
    float nLen = length(vWorldNormal);
    vec3 n = nLen > 1e-5 ? (vWorldNormal / nLen) : vec3(0.0, 1.0, 0.0);
    vec3 lightDir = normalize(vec3(0.25, 0.7, -0.6));
    float diff = max(0.0, dot(n, lightDir));
    vec3 camDelta = cameraPosition - vWorldPos;
    float camLen = length(camDelta);
    vec3 viewDir = camLen > 1e-5 ? (camDelta / camLen) : vec3(0.0, 0.0, 1.0);
    float rimBase = clamp(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 0.0, 1.0);
    float rim = pow(max(1e-4, rimBase), 2.5);

    vec3 rockBase = vec3(0.11, 0.11, 0.22) + vec3(0.16, 0.24, 0.36) * diff;

    // Intersecting crystalline emissive veins across facets
    float v1 = abs(sin((vLocalPos.x * 4.2 + vLocalPos.y * 3.1 + vMeta.x * 5.0)));
    float v2 = abs(cos((vLocalPos.z * 4.6 - vLocalPos.y * 2.8 + vMeta.y * 7.0)));
    float veinBase = clamp(1.0 - min(v1, v2), 0.0, 1.0);
    float vein = pow(max(1e-4, veinBase), 7.5);
    float pulse = 0.78 + 0.22 * sin(uTime * 2.6 + vMeta.z * 9.0);

    vec3 col = rockBase + vInstColor * (vein * 1.65 * pulse + rim * 0.45);
    float farFade = smoothstep(-255.0, -145.0, vWorldPos.z);
    col = mix(vec3(0.13, 0.20, 0.42), col, farFade);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const PLASMA_RIVER_VERT = `
  varying vec2 vWorldXZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PLASMA_RIVER_FRAG = `
  uniform float uTime;
  uniform float uScrollZ;
  varying vec2 vWorldXZ;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm2(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise2(p);
      p = p * 2.05 + vec2(9.2, 13.4);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float meander = sin((vWorldXZ.y - uScrollZ * 0.55) * 0.032) * 8.0;
    float cx = vWorldXZ.x - meander;
    float bankMask = smoothstep(42.0, 6.0, abs(cx));

    vec2 flowUv = vec2(cx * 0.07, (vWorldXZ.y - uScrollZ * 1.1) * 0.045);
    float n1 = fbm2(flowUv + vec2(0.0, uTime * 0.35));
    float n2 = fbm2(flowUv * 1.9 - vec2(uTime * 0.18, -uTime * 0.42));
    float filament = pow(max(1e-4, smoothstep(0.45, 0.92, n1 * 0.55 + n2 * 0.45)), 1.6);
    float coreStream = smoothstep(14.0, 0.0, abs(cx)) * (0.45 + 0.55 * n2);

    vec3 violet = vec3(0.26, 0.10, 0.58);
    vec3 turquoise = vec3(0.05, 0.52, 0.52);
    vec3 emeraldWhite = vec3(0.28, 0.68, 0.66);

    vec3 col = mix(violet, turquoise, smoothstep(0.2, 0.78, n1));
    col = mix(col, emeraldWhite, filament * 0.45 + coreStream * 0.24);

    float farFade = smoothstep(-265.0, -140.0, vWorldXZ.y) * (1.0 - smoothstep(8.0, 36.0, vWorldXZ.y));
    float alpha = clamp(bankMask * farFade * (0.24 + filament * 0.34), 0.0, 0.58);
    if (!(alpha >= 0.01)) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const DUST_VERT = `
  varying vec2 vUv;
  varying vec3 vInstColor;
  void main() {
    vUv = uv;
    #ifdef USE_INSTANCING_COLOR
      vInstColor = instanceColor;
    #else
      vInstColor = vec3(0.7, 0.9, 1.0);
    #endif
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const DUST_FRAG = `
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vInstColor;
  void main() {
    vec2 centered = vUv - vec2(0.5);
    float gx = exp(-centered.x * centered.x * 16.0);
    float gy = exp(-centered.y * centered.y * 7.5);
    float alpha = clamp(gx * gy * uOpacity, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;
    gl_FragColor = vec4(vInstColor * 1.45, alpha);
  }
`;

function createFallbackTexture(hex: number): THREE.DataTexture {
  const c = new THREE.Color(hex);
  const data = new Uint8Array([
    Math.round(c.r * 255),
    Math.round(c.g * 255),
    Math.round(c.b * 255),
    255,
  ]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class EnvironmentSystem {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;

  private readonly envRoot = new THREE.Group();
  private readonly hangarGroup = new THREE.Group();
  private readonly act1Group = new THREE.Group();
  private readonly act2Group = new THREE.Group();
  private readonly act3Group = new THREE.Group();
  private readonly act4Group = new THREE.Group();

  private readonly skySphere: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly cyclorama: THREE.Mesh;
  private readonly cycloramaMat: THREE.ShaderMaterial;
  private readonly dustInst: THREE.InstancedMesh;
  private readonly dustMat: THREE.ShaderMaterial;
  private readonly ambientFillLight: THREE.HemisphereLight;

  private readonly volumetricBeams: THREE.ShaderMaterial[] = [];
  private readonly searchlights: SearchlightState[] = [];

  private act1SlipstreamInst!: THREE.InstancedMesh;
  private readonly act1Slipstreams: CorridorStreakState[] = [];
  private transparentFallbackTex!: THREE.DataTexture;

  // Act 2: Restored Orbital Metropolis Corridor
  private cloudSeaMat!: THREE.ShaderMaterial;
  private highwayDeckMat!: THREE.MeshStandardMaterial;
  private readonly highwayPbrTextures: THREE.Texture[] = [];
  private terraceDeckMat!: THREE.ShaderMaterial;
  private pylonInst!: THREE.InstancedMesh;
  private readonly pylonZ: number[] = [];
  private metroArchMat!: THREE.ShaderMaterial;
  private metroHoloPylonMat!: THREE.ShaderMaterial;
  private metroTowerMatA!: THREE.ShaderMaterial;
  private metroTowerMatB!: THREE.ShaderMaterial;
  private metroFarTowerMatA!: THREE.ShaderMaterial;
  private metroFarTowerMatB!: THREE.ShaderMaterial;
  private readonly metroScrollingProps: ScrollingMatteProp[] = [];
  private metroTrafficInst!: THREE.InstancedMesh;
  private readonly metroTraffic: CorridorStreakState[] = [];

  // Act 3: Fractured Warp Gateway
  private megalithMat!: THREE.ShaderMaterial;
  private megalithInst!: THREE.InstancedMesh;
  private crystalShardInst!: THREE.InstancedMesh;
  private plasmaRiverMat!: THREE.ShaderMaterial;
  private readonly megaliths: MegalithState[] = [];
  private act3WarpRingMat!: THREE.ShaderMaterial;
  private act3CrystalNearAMat!: THREE.ShaderMaterial;
  private act3CrystalNearBMat!: THREE.ShaderMaterial;
  private act3DerelictMidMat!: THREE.ShaderMaterial;
  private act3DerelictFarMat!: THREE.ShaderMaterial;
  private act3CrystalFarMat!: THREE.ShaderMaterial;
  private readonly act3ScrollingProps: ScrollingMatteProp[] = [];
  private act3StreakInst!: THREE.InstancedMesh;
  private readonly act3Streaks: CorridorStreakState[] = [];

  // Act 4: Crimson Dreadnought Citadel
  private act4HullMat!: THREE.MeshStandardMaterial;
  private act4SideDeckMat!: THREE.MeshStandardMaterial;
  private readonly act4HullPbrTextures: THREE.Texture[] = [];
  private act4KeelArchMat!: THREE.ShaderMaterial;
  private act4FlakPylonMat!: THREE.ShaderMaterial;
  private act4BastionMatA!: THREE.ShaderMaterial;
  private act4BastionMatB!: THREE.ShaderMaterial;
  private act4FarBastionMatA!: THREE.ShaderMaterial;
  private act4FarBastionMatB!: THREE.ShaderMaterial;
  private readonly act4ScrollingProps: ScrollingMatteProp[] = [];
  private act4EmberInst!: THREE.InstancedMesh;
  private readonly act4Embers: CorridorStreakState[] = [];

  private hangarVistaMesh!: THREE.Mesh;
  private hangarVistaMat!: THREE.MeshBasicMaterial;
  private hangarDeckMat!: THREE.MeshStandardMaterial;
  private hangarSideDeckMat!: THREE.MeshStandardMaterial;
  private hangarCeilingMat!: THREE.MeshBasicMaterial;
  private hangarBulkheadMat!: THREE.MeshBasicMaterial;
  private readonly hangarParallaxGroup = new THREE.Group();

  private hangarVideoEl: HTMLVideoElement | null = null;
  private hangarVideoTex: THREE.VideoTexture | null = null;
  private hangarVideoReady = false;
  private hangarVideoUnlockHandler: (() => void) | null = null;

  private readonly actVideos = new Map<1 | 2 | 3 | 4, ActVideoSlot>();

  private readonly dustParticles: DustParticle[] = [];
  private readonly dummy = new THREE.Object3D();

  private readonly fallbackTextures: Record<VistaKey, THREE.DataTexture>;
  private readonly activeTextures = new Map<VistaKey, THREE.Texture>();
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private initialized = false;
  private disposed = false;

  private mode: EnvMode = 'boot';
  private currentAct = 1;
  private scrollDistance = 0;

  private currentVistaKey: VistaKey = 'hangar';
  private targetVistaKey: VistaKey = 'hangar';
  private vistaBlend = 1.0;
  private cycloramaPitch = -0.02;

  private currentZenith = new THREE.Color().copy(SKY_PALETTES.hangar.zenith);
  private currentMid = new THREE.Color().copy(SKY_PALETTES.hangar.mid);
  private currentHorizon = new THREE.Color().copy(SKY_PALETTES.hangar.horizon);
  private currentNadir = new THREE.Color().copy(SKY_PALETTES.hangar.nadir);
  private currentAuroraA = new THREE.Color().copy(SKY_PALETTES.hangar.auroraA);
  private currentAuroraB = new THREE.Color().copy(SKY_PALETTES.hangar.auroraB);
  private currentSun = new THREE.Color().copy(SKY_PALETTES.hangar.sunColor);
  private currentStarIntensity = SKY_PALETTES.hangar.starIntensity;
  private currentAuroraIntensity = SKY_PALETTES.hangar.auroraIntensity;

  private sceneHemiLight: THREE.HemisphereLight | null = null;
  private sceneRimLight: THREE.DirectionalLight | null = null;
  private sceneFillLight: THREE.DirectionalLight | null = null;
  private currentHemiSky = new THREE.Color().copy(SCENE_LIGHT_PRESETS.hangar.hemiSky);
  private currentHemiGround = new THREE.Color().copy(SCENE_LIGHT_PRESETS.hangar.hemiGround);
  private currentHemiIntensity = SCENE_LIGHT_PRESETS.hangar.hemiIntensity;
  private currentRimColor = new THREE.Color().copy(SCENE_LIGHT_PRESETS.hangar.rimColor);
  private currentRimIntensity = SCENE_LIGHT_PRESETS.hangar.rimIntensity;
  private currentFillColor = new THREE.Color().copy(SCENE_LIGHT_PRESETS.hangar.fillColor);
  private currentFillIntensity = SCENE_LIGHT_PRESETS.hangar.fillIntensity;
  private currentEnvIntensity = SCENE_LIGHT_PRESETS.hangar.envIntensity;

  private readonly warmupTargets: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.envRoot.name = 'EnvironmentSystemRoot';
    this.hangarGroup.name = 'EnvHangarBay';
    this.act1Group.name = 'EnvAct1Stratosphere';
    this.act2Group.name = 'EnvAct2Metropolis';
    this.act3Group.name = 'EnvAct3Nebula';
    this.act4Group.name = 'EnvAct4Citadel';

    this.fallbackTextures = {
      hangar: createFallbackTexture(0x28679e),
      act1: createFallbackTexture(0x1e4e7a),
      act2: createFallbackTexture(0x3a7ca5),
      act3: createFallbackTexture(0x2d488f),
      act4: createFallbackTexture(0x8c2f24),
    };
    const alphaData = new Uint8Array([0, 0, 0, 0]);
    this.transparentFallbackTex = new THREE.DataTexture(alphaData, 1, 1, THREE.RGBAFormat);
    this.transparentFallbackTex.needsUpdate = true;
    this.activeTextures.set('hangar', this.fallbackTextures.hangar);
    this.activeTextures.set('act1', this.fallbackTextures.act1);
    this.activeTextures.set('act2', this.fallbackTextures.act2);
    this.activeTextures.set('act3', this.fallbackTextures.act3);
    this.activeTextures.set('act4', this.fallbackTextures.act4);

    this.ambientFillLight = new THREE.HemisphereLight(0x8be9ff, 0x1b2e4d, 0.55);
    this.envRoot.add(this.ambientFillLight);

    // 1. Camera-Locked Seamless GLSL Sky Sphere
    const skyGeo = new THREE.SphereGeometry(340, 32, 24);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uZenithColor: { value: this.currentZenith },
        uMidColor: { value: this.currentMid },
        uHorizonColor: { value: this.currentHorizon },
        uNadirColor: { value: this.currentNadir },
        uAuroraA: { value: this.currentAuroraA },
        uAuroraB: { value: this.currentAuroraB },
        uSunColor: { value: this.currentSun },
        uStarIntensity: { value: this.currentStarIntensity },
        uAuroraIntensity: { value: this.currentAuroraIntensity },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skySphere = new THREE.Mesh(skyGeo, this.skyMat);
    this.skySphere.name = 'SkySphere';
    this.skySphere.renderOrder = -100;
    this.skySphere.frustumCulled = false;
    this.envRoot.add(this.skySphere);
    this.warmupTargets.push(this.skySphere);

    // 2. Forward Concentric Spherical Cinema Panorama Dome (~150 deg azimuth x 90 deg elevation)
    const phiLength = THREE.MathUtils.degToRad(150);
    const phiStart = Math.PI * 1.5 - phiLength * 0.5;
    const thetaLength = THREE.MathUtils.degToRad(90);
    const thetaStart = THREE.MathUtils.degToRad(45);
    const cycloramaGeo = new THREE.SphereGeometry(285, 48, 32, phiStart, phiLength, thetaStart, thetaLength);
    this.cycloramaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTexA: { value: this.fallbackTextures.hangar },
        uTexB: { value: this.fallbackTextures.hangar },
        uTexAIsVideo: { value: 0.0 },
        uTexBIsVideo: { value: 0.0 },
        uTexMix: { value: 1.0 },
        uBrightness: { value: 1.05 },
        uEdgeFeather: { value: 0.08 },
        uVertFeatherTop: { value: 0.08 },
        uVertFeatherBottom: { value: 0.08 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: CYCLORAMA_VERT,
      fragmentShader: CYCLORAMA_FRAG,
      side: THREE.BackSide,
      transparent: true,
      fog: false,
      depthWrite: false,
    });
    this.cyclorama = new THREE.Mesh(cycloramaGeo, this.cycloramaMat);
    this.cyclorama.name = 'VistaCyclorama';
    this.cyclorama.renderOrder = -90;
    this.cyclorama.frustumCulled = false;
    this.envRoot.add(this.cyclorama);
    this.warmupTargets.push(this.cyclorama);

    // 3. Build 3D Hangar Bay & 4 Combat Biomes
    this.buildHangarBay();
    this.buildAct1Stratosphere();
    this.buildAct2Metropolis();
    this.buildAct3Nebula();
    this.buildAct4Citadel();

    // 4. Velocity-Stretched Space Dust Streaks (340 soft Gaussian streaks)
    const dustGeo = this.createCrossedStreakGeometry();
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0.55 },
      },
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.dustInst = new THREE.InstancedMesh(dustGeo, this.dustMat, DUST_COUNT);
    this.dustInst.name = 'SpaceDustStreaks';
    this.dustInst.frustumCulled = false;
    this.initDustParticles();
    this.envRoot.add(this.dustInst);
    this.warmupTargets.push(this.dustInst);

    this.envRoot.add(
      this.hangarGroup,
      this.act1Group,
      this.act2Group,
      this.act3Group,
      this.act4Group
    );
    this.scene.add(this.envRoot);

    this.syncVisibility();
  }

  private buildAerospaceIblScene(): {
    iblScene: THREE.Scene;
    cleanup: () => void;
  } {
    const iblScene = new THREE.Scene();
    const disposables: Array<{ dispose: () => void }> = [];

    // High-contrast deep cosmic zenith / cool horizon / dark hangar nadir gradient dome
    const domeGeo = new THREE.SphereGeometry(40, 24, 16);
    const posAttr = domeGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const zenithCol = new THREE.Color(0x050b18);
    const horizonCol = new THREE.Color(0x132744);
    const nadirCol = new THREE.Color(0x091324);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const ny = posAttr.getY(i) / 40;
      if (ny >= 0) {
        const t = Math.pow(ny, 0.72);
        tmpCol.copy(horizonCol).lerp(zenithCol, t);
      } else {
        const t = Math.pow(-ny, 0.65);
        tmpCol.copy(horizonCol).lerp(nadirCol, t);
      }
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const domeMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    iblScene.add(domeMesh);
    disposables.push(domeGeo, domeMat);

    const addStrip = (
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      rgb: [number, number, number]
    ): void => {
      const geo = new THREE.PlaneGeometry(w, h);
      const col = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]);
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      iblScene.add(m);
      disposables.push(geo, mat);
    };

    // Overhead primary solar studio strip + flanking dark baffles for razor-sharp specular contrast
    addStrip(18, 2.4, 0, 14, 6, [5.5, 5.2, 4.6]);
    addStrip(19, 1.4, 0, 13.6, 2.4, [0.02, 0.03, 0.05]);
    addStrip(19, 1.4, 0, 13.6, 9.6, [0.02, 0.03, 0.05]);

    // Port cool cyan orbital rim bar & Starboard warm amber kicker bar
    addStrip(16, 1.8, -14, 4, -6, [1.2, 4.2, 5.2]);
    addStrip(16, 1.2, -13.6, 6.2, -6, [0.02, 0.03, 0.05]);
    addStrip(14, 1.6, 14, 2, -4, [4.4, 2.6, 0.9]);
    addStrip(14, 1.2, 13.6, 4.0, -4, [0.02, 0.03, 0.05]);

    // Forward pale ice-blue horizon band for fuselage & cockpit visor reflections
    addStrip(24, 2.2, 0, 1.5, -18, [2.2, 3.2, 4.0]);

    return {
      iblScene,
      cleanup: () => {
        for (const d of disposables) {
          d.dispose();
        }
      },
    };
  }

  bindSceneLights(
    hemi: THREE.HemisphereLight,
    rim: THREE.DirectionalLight,
    fill: THREE.DirectionalLight
  ): void {
    this.sceneHemiLight = hemi;
    this.sceneRimLight = rim;
    this.sceneFillLight = fill;
    this.syncPaletteUniforms();
  }

  initEnvironment(loadedTextures?: ReadonlyMap<string, THREE.Texture>): void {
    if (this.disposed) return;

    // Assign zero-blur high-contrast Aerospace HDRI reflections once via PMREMGenerator
    if (!this.initialized) {
      this.initialized = true;
      try {
        const gl = this.renderer?.getContext?.();
        if (gl && typeof THREE.PMREMGenerator === 'function') {
          const pmrem = new THREE.PMREMGenerator(this.renderer);
          pmrem.compileEquirectangularShader?.();
          const { iblScene, cleanup } = this.buildAerospaceIblScene();
          this.envRenderTarget = pmrem.fromScene(iblScene, 0.0);
          this.scene.environment = this.envRenderTarget.texture;
          this.scene.environmentIntensity = this.currentEnvIntensity;
          cleanup();
          pmrem.dispose();
        }
      } catch {
        // Safely ignore if WebGL context is unavailable in headless/mock tests
      }
    }

    // Bind loaded 2K panoramic vista textures
    const keys: VistaKey[] = ['hangar', 'act1', 'act2', 'act3', 'act4'];
    for (const k of keys) {
      const tex = loadedTextures?.get(k);
      if (tex) {
        this.activeTextures.set(k, tex);
      }
    }

    // Bind 2K PBR Hangar landing deck & Codex transparent architectural matte layers
    const hangarPoster = loadedTextures?.get('hangar') ?? this.fallbackTextures.hangar;
    if (!this.hangarVideoReady) {
      this.hangarVistaMat.map = hangarPoster;
      this.hangarVistaMat.needsUpdate = true;
    }

    const deckAlbedo = loadedTextures?.get('hangar_deck_albedo');
    const deckNormal = loadedTextures?.get('hangar_deck_normal');
    const deckRoughness = loadedTextures?.get('hangar_deck_roughness');
    const deckEmissive = loadedTextures?.get('hangar_deck_emissive');
    for (const dt of [deckAlbedo, deckNormal, deckRoughness, deckEmissive]) {
      if (dt) {
        dt.wrapS = THREE.MirroredRepeatWrapping;
        dt.wrapT = THREE.MirroredRepeatWrapping;
        dt.needsUpdate = true;
      }
    }
    if (deckAlbedo) this.hangarDeckMat.map = deckAlbedo;
    if (deckNormal) this.hangarDeckMat.normalMap = deckNormal;
    if (deckRoughness) this.hangarDeckMat.roughnessMap = deckRoughness;
    if (deckEmissive) this.hangarDeckMat.emissiveMap = deckEmissive;
    this.hangarDeckMat.needsUpdate = true;

    const sideDeckAlbedo = loadedTextures?.get('hangar_side_deck_albedo');
    const sideDeckNormal = loadedTextures?.get('hangar_side_deck_normal');
    for (const sdt of [sideDeckAlbedo, sideDeckNormal]) {
      if (sdt) {
        sdt.wrapS = THREE.RepeatWrapping;
        sdt.wrapT = THREE.RepeatWrapping;
        sdt.repeat.set(6, 6);
        sdt.needsUpdate = true;
      }
    }
    if (sideDeckAlbedo) {
      this.hangarSideDeckMat.map = sideDeckAlbedo;
    }
    if (sideDeckNormal) {
      this.hangarSideDeckMat.normalMap = sideDeckNormal;
      this.act4SideDeckMat.normalMap = sideDeckNormal;
    }
    this.hangarSideDeckMat.needsUpdate = true;
    this.act4SideDeckMat.needsUpdate = true;

    const ceilingTex = loadedTextures?.get('hangar_ceiling');
    if (ceilingTex) {
      this.hangarCeilingMat.map = ceilingTex;
      this.hangarCeilingMat.needsUpdate = true;
    }
    const bulkheadTex = loadedTextures?.get('hangar_bulkhead');
    if (bulkheadTex) {
      this.hangarBulkheadMat.map = bulkheadTex;
      this.hangarBulkheadMat.needsUpdate = true;
    }

    // Bind Act 2 Orbital Metropolis 2K PBR Highway & Codex transparent architectural matte layers
    this.highwayPbrTextures.length = 0;
    const hwAlbedo = loadedTextures?.get('act2_highway_albedo');
    const hwNormal = loadedTextures?.get('act2_highway_normal');
    const hwRough = loadedTextures?.get('act2_highway_roughness');
    const hwEmissive = loadedTextures?.get('act2_highway_emissive');
    for (const hwt of [hwAlbedo, hwNormal, hwRough, hwEmissive]) {
      if (hwt) {
        hwt.wrapS = THREE.RepeatWrapping;
        hwt.wrapT = THREE.RepeatWrapping;
        hwt.repeat.set(1, 12);
        hwt.needsUpdate = true;
        this.highwayPbrTextures.push(hwt);
      }
    }
    if (hwAlbedo) this.highwayDeckMat.map = hwAlbedo;
    if (hwNormal) this.highwayDeckMat.normalMap = hwNormal;
    if (hwRough) this.highwayDeckMat.roughnessMap = hwRough;
    if (hwEmissive) this.highwayDeckMat.emissiveMap = hwEmissive;
    this.highwayDeckMat.needsUpdate = true;

    const archTex = loadedTextures?.get('act2_sky_arch');
    if (archTex) this.metroArchMat.uniforms.uMap.value = archTex;
    const holoTex = loadedTextures?.get('act2_holo_pylon');
    if (holoTex) this.metroHoloPylonMat.uniforms.uMap.value = holoTex;
    const towerATex = loadedTextures?.get('act2_tower_a');
    if (towerATex) {
      this.metroTowerMatA.uniforms.uMap.value = towerATex;
      this.metroFarTowerMatA.uniforms.uMap.value = towerATex;
    }
    const towerBTex = loadedTextures?.get('act2_tower_b');
    if (towerBTex) {
      this.metroTowerMatB.uniforms.uMap.value = towerBTex;
      this.metroFarTowerMatB.uniforms.uMap.value = towerBTex;
    }

    // Bind Act 3 Fractured Warp Gateway transparent layers
    const warpRingTex = loadedTextures?.get('act3_warp_ring');
    if (warpRingTex) this.act3WarpRingMat.uniforms.uMap.value = warpRingTex;
    const crystalATex = loadedTextures?.get('act3_crystal_a');
    if (crystalATex) {
      this.act3CrystalNearAMat.uniforms.uMap.value = crystalATex;
      this.act3CrystalFarMat.uniforms.uMap.value = crystalATex;
    }
    const crystalBTex = loadedTextures?.get('act3_crystal_b');
    if (crystalBTex) this.act3CrystalNearBMat.uniforms.uMap.value = crystalBTex;
    const derelictTex = loadedTextures?.get('act3_derelict');
    if (derelictTex) {
      this.act3DerelictMidMat.uniforms.uMap.value = derelictTex;
      this.act3DerelictFarMat.uniforms.uMap.value = derelictTex;
    }

    // Bind Act 4 Dreadnought Citadel 2K PBR hull & Codex transparent superstructure layers
    this.act4HullPbrTextures.length = 0;
    const hullAlbedo = loadedTextures?.get('act4_hull_albedo');
    const hullNormal = loadedTextures?.get('act4_hull_normal');
    const hullRough = loadedTextures?.get('act4_hull_roughness');
    const hullEmissive = loadedTextures?.get('act4_hull_emissive');
    for (const ht of [hullAlbedo, hullNormal, hullRough, hullEmissive]) {
      if (ht) {
        ht.wrapS = THREE.RepeatWrapping;
        ht.wrapT = THREE.RepeatWrapping;
        ht.repeat.set(1, 7);
        ht.needsUpdate = true;
        this.act4HullPbrTextures.push(ht);
      }
    }
    if (hullAlbedo) this.act4HullMat.map = hullAlbedo;
    if (hullNormal) this.act4HullMat.normalMap = hullNormal;
    if (hullRough) this.act4HullMat.roughnessMap = hullRough;
    if (hullEmissive) this.act4HullMat.emissiveMap = hullEmissive;
    this.act4HullMat.needsUpdate = true;

    const keelArchTex = loadedTextures?.get('act4_keel_arch');
    if (keelArchTex) this.act4KeelArchMat.uniforms.uMap.value = keelArchTex;
    const flakTex = loadedTextures?.get('act4_flak_pylon');
    if (flakTex) this.act4FlakPylonMat.uniforms.uMap.value = flakTex;
    const bastionATex = loadedTextures?.get('act4_bastion_a');
    if (bastionATex) {
      this.act4BastionMatA.uniforms.uMap.value = bastionATex;
      this.act4FarBastionMatA.uniforms.uMap.value = bastionATex;
    }
    const bastionBTex = loadedTextures?.get('act4_bastion_b');
    if (bastionBTex) {
      this.act4BastionMatB.uniforms.uMap.value = bastionBTex;
      this.act4FarBastionMatB.uniforms.uMap.value = bastionBTex;
    }

    this.initHangarVideo();
    this.initActVideos();

    const activeTex = this.getVistaTexture(this.targetVistaKey);
    this.setCycloramaTexA(activeTex);
    this.setCycloramaTexB(activeTex);
    this.cycloramaMat.uniforms.uTexMix.value = 1.0;
    this.currentVistaKey = this.targetVistaKey;
    this.vistaBlend = 1.0;
    this.syncHangarVideoPlayback();
    this.syncActVideosPlayback();
  }

  setMode(mode: EnvMode): void {
    this.mode = mode;
    this.syncVisibility();
    this.updateVistaTarget(mode === 'boot' || mode === 'hangar');
  }

  setAct(act: number, immediate = false): void {
    const clampedAct = Math.max(1, Math.min(4, Math.round(act)));
    this.currentAct = clampedAct;
    this.syncVisibility();
    this.updateVistaTarget(immediate);
  }

  update(
    dt: number,
    elapsed: number,
    scrollSpeed: number,
    camera: THREE.Camera,
    timeScale = 1.0
  ): void {
    if (this.disposed) return;
    const safeDt = Math.min(0.1, Math.max(0, dt));
    const speed = Number.isFinite(scrollSpeed) ? scrollSpeed : 0;
    this.scrollDistance += speed * safeDt;
    const isHangar = this.mode === 'hangar' || this.mode === 'boot';

    // Smooth sky palette transitions
    this.lerpSkyPalette(safeDt);

    if (!isHangar) {
      // Keep sky dome and spherical panorama cap concentric on camera with subtle per-act pitch
      this.skySphere.position.copy(camera.position);
      const targetPitch = this.currentAct === 1 ? -0.135 : this.currentAct === 4 ? 0.02 : 0.0;
      const targetBright = this.currentAct === 1 ? 1.05 : 1.0;
      this.cycloramaPitch = THREE.MathUtils.lerp(
        this.cycloramaPitch,
        targetPitch,
        Math.min(1, safeDt * 5.0)
      );
      this.cycloramaMat.uniforms.uBrightness.value = THREE.MathUtils.lerp(
        this.cycloramaMat.uniforms.uBrightness.value,
        targetBright,
        Math.min(1, safeDt * 4.0)
      );
      this.cyclorama.position.copy(camera.position);
      this.cyclorama.rotation.x = this.cycloramaPitch;

      // Smooth vista crossfade transitions
      if (this.vistaBlend < 1.0) {
        this.vistaBlend = Math.min(1.0, this.vistaBlend + safeDt * 2.2);
        this.cycloramaMat.uniforms.uTexMix.value = this.vistaBlend;
        if (this.vistaBlend >= 1.0) {
          this.currentVistaKey = this.targetVistaKey;
        }
      }

      this.skyMat.uniforms.uTime.value = elapsed;
      this.skyMat.uniforms.uScroll.value = this.scrollDistance;

      // Sync active combat vista video playback rate smoothly with flight speed / boost / slow-mo
      const activeSlot = this.actVideos.get(this.currentAct as 1 | 2 | 3 | 4);
      if (activeSlot && activeSlot.ready && !activeSlot.video.paused) {
        const rawFactor = speed > 0.5 ? (speed / 36) * timeScale : timeScale;
        const minRate = timeScale < 0.75 ? 0.22 : 0.85;
        const targetRate = THREE.MathUtils.clamp(rawFactor, minRate, 1.65);
        if (Math.abs(activeSlot.video.playbackRate - targetRate) > 0.025) {
          activeSlot.video.playbackRate = THREE.MathUtils.lerp(
            activeSlot.video.playbackRate,
            targetRate,
            Math.min(1, Math.max(0.016, safeDt) * 8.0)
          );
        }
      }
    }

    for (const beamMat of this.volumetricBeams) {
      beamMat.uniforms.uTime.value = elapsed;
    }

    if (isHangar) {
      this.hangarParallaxGroup.position.set(0, 0, 0);
      this.hangarVistaMesh.position.x = Math.sin(elapsed * 0.14) * 0.18;
    }

    if (this.mode === 'combat') {
      if (this.currentAct === 1) {
        this.updateAct1(safeDt, elapsed, speed);
      } else if (this.currentAct === 2) {
        this.updateAct2Metropolis(safeDt, elapsed, speed);
      } else if (this.currentAct === 3) {
        this.updateAct3Nebula(safeDt, elapsed, speed);
      } else {
        this.updateAct4Citadel(safeDt, elapsed, speed);
      }
    }

    this.updateDustParticles(safeDt, speed);
  }

  getWarmupObjects(): THREE.Object3D[] {
    return this.warmupTargets.slice();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.envRenderTarget) {
      if (this.scene.environment === this.envRenderTarget.texture) {
        this.scene.environment = null;
      }
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    this.envRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => materials.add(m));
        } else {
          materials.add(mesh.material);
        }
      }
    });

    this.envRoot.removeFromParent();

    this.disposeHangarVideo();
    this.disposeActVideos();

    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const tex of Object.values(this.fallbackTextures)) tex.dispose();
    this.transparentFallbackTex.dispose();
    this.activeTextures.clear();
    this.warmupTargets.length = 0;
  }

  private setCycloramaTexA(tex: THREE.Texture): void {
    this.cycloramaMat.uniforms.uTexA.value = tex;
    this.cycloramaMat.uniforms.uTexAIsVideo.value = (tex as THREE.VideoTexture).isVideoTexture ? 1.0 : 0.0;
  }

  private setCycloramaTexB(tex: THREE.Texture): void {
    this.cycloramaMat.uniforms.uTexB.value = tex;
    this.cycloramaMat.uniforms.uTexBIsVideo.value = (tex as THREE.VideoTexture).isVideoTexture ? 1.0 : 0.0;
  }

  private getVistaTexture(key: VistaKey): THREE.Texture {
    return this.activeTextures.get(key) ?? this.fallbackTextures[key];
  }

  private resolveTargetVistaKey(): VistaKey {
    if (this.mode === 'hangar' || this.mode === 'boot') return 'hangar';
    if (this.currentAct === 2) return 'act2';
    if (this.currentAct === 3) return 'act3';
    if (this.currentAct === 4) return 'act4';
    return 'act1';
  }

  private updateVistaTarget(immediate: boolean): void {
    const nextKey = this.resolveTargetVistaKey();
    const palette = SKY_PALETTES[nextKey];
    const lightPreset = SCENE_LIGHT_PRESETS[nextKey];

    if (immediate) {
      this.currentZenith.copy(palette.zenith);
      this.currentMid.copy(palette.mid);
      this.currentHorizon.copy(palette.horizon);
      this.currentNadir.copy(palette.nadir);
      this.currentAuroraA.copy(palette.auroraA);
      this.currentAuroraB.copy(palette.auroraB);
      this.currentSun.copy(palette.sunColor);
      this.currentStarIntensity = palette.starIntensity;
      this.currentAuroraIntensity = palette.auroraIntensity;

      this.currentHemiSky.copy(lightPreset.hemiSky);
      this.currentHemiGround.copy(lightPreset.hemiGround);
      this.currentHemiIntensity = lightPreset.hemiIntensity;
      this.currentRimColor.copy(lightPreset.rimColor);
      this.currentRimIntensity = lightPreset.rimIntensity;
      this.currentFillColor.copy(lightPreset.fillColor);
      this.currentFillIntensity = lightPreset.fillIntensity;
      this.currentEnvIntensity = lightPreset.envIntensity;

      this.syncPaletteUniforms();

      const tex = this.getVistaTexture(nextKey);
      this.setCycloramaTexA(tex);
      this.setCycloramaTexB(tex);
      this.cycloramaMat.uniforms.uTexMix.value = 1.0;
      this.currentVistaKey = nextKey;
      this.targetVistaKey = nextKey;
      this.vistaBlend = 1.0;
      this.cycloramaPitch =
        this.mode === 'hangar'
          ? -0.02
          : this.currentAct === 1
            ? -0.135
            : this.currentAct === 4
              ? 0.02
              : 0.0;
      this.cycloramaMat.uniforms.uBrightness.value = this.currentAct === 1 && this.mode === 'combat' ? 1.05 : 1.0;
      this.cyclorama.rotation.x = this.cycloramaPitch;
      return;
    }

    if (nextKey !== this.targetVistaKey) {
      const fromKey = this.vistaBlend >= 0.5 ? this.targetVistaKey : this.currentVistaKey;
      const fromTex = this.getVistaTexture(fromKey);
      const toTex = this.getVistaTexture(nextKey);
      this.currentVistaKey = fromKey;
      this.setCycloramaTexA(fromTex);
      this.setCycloramaTexB(toTex);
      this.cycloramaMat.uniforms.uTexMix.value = 0.0;
      this.targetVistaKey = nextKey;
      this.vistaBlend = 0.0;
    }
  }

  private lerpSkyPalette(dt: number): void {
    const vistaKey = this.resolveTargetVistaKey();
    const target = SKY_PALETTES[vistaKey];
    const lightTarget = SCENE_LIGHT_PRESETS[vistaKey];
    const alpha = Math.min(1, dt * 2.2);

    this.currentZenith.lerp(target.zenith, alpha);
    this.currentMid.lerp(target.mid, alpha);
    this.currentHorizon.lerp(target.horizon, alpha);
    this.currentNadir.lerp(target.nadir, alpha);
    this.currentAuroraA.lerp(target.auroraA, alpha);
    this.currentAuroraB.lerp(target.auroraB, alpha);
    this.currentSun.lerp(target.sunColor, alpha);
    this.currentStarIntensity = THREE.MathUtils.lerp(
      this.currentStarIntensity,
      target.starIntensity,
      alpha
    );
    this.currentAuroraIntensity = THREE.MathUtils.lerp(
      this.currentAuroraIntensity,
      target.auroraIntensity,
      alpha
    );

    this.currentHemiSky.lerp(lightTarget.hemiSky, alpha);
    this.currentHemiGround.lerp(lightTarget.hemiGround, alpha);
    this.currentHemiIntensity = THREE.MathUtils.lerp(
      this.currentHemiIntensity,
      lightTarget.hemiIntensity,
      alpha
    );
    this.currentRimColor.lerp(lightTarget.rimColor, alpha);
    this.currentRimIntensity = THREE.MathUtils.lerp(
      this.currentRimIntensity,
      lightTarget.rimIntensity,
      alpha
    );
    this.currentFillColor.lerp(lightTarget.fillColor, alpha);
    this.currentFillIntensity = THREE.MathUtils.lerp(
      this.currentFillIntensity,
      lightTarget.fillIntensity,
      alpha
    );
    this.currentEnvIntensity = THREE.MathUtils.lerp(
      this.currentEnvIntensity,
      lightTarget.envIntensity,
      alpha
    );

    this.syncPaletteUniforms();
  }

  private syncPaletteUniforms(): void {
    this.skyMat.uniforms.uStarIntensity.value = this.currentStarIntensity;
    this.skyMat.uniforms.uAuroraIntensity.value = this.currentAuroraIntensity;
    this.ambientFillLight.color.copy(this.currentHorizon);
    this.ambientFillLight.groundColor.copy(this.currentNadir);
    if (this.sceneHemiLight) {
      this.sceneHemiLight.color.copy(this.currentHemiSky);
      this.sceneHemiLight.groundColor.copy(this.currentHemiGround);
      this.sceneHemiLight.intensity = this.currentHemiIntensity;
    }
    if (this.sceneRimLight) {
      this.sceneRimLight.color.copy(this.currentRimColor);
      this.sceneRimLight.intensity = this.currentRimIntensity;
    }
    if (this.sceneFillLight) {
      this.sceneFillLight.color.copy(this.currentFillColor);
      this.sceneFillLight.intensity = this.currentFillIntensity;
    }
    if (this.scene.environment) {
      this.scene.environmentIntensity = this.currentEnvIntensity;
    }
  }

  private syncVisibility(): void {
    const isHangar = this.mode === 'hangar' || this.mode === 'boot';
    this.hangarGroup.visible = isHangar;
    this.skySphere.visible = !isHangar;
    this.cyclorama.visible = !isHangar;
    this.act1Group.visible = this.mode === 'combat' && this.currentAct === 1;
    this.act2Group.visible = this.mode === 'combat' && this.currentAct === 2;
    this.act3Group.visible = this.mode === 'combat' && this.currentAct === 3;
    this.act4Group.visible = this.mode === 'combat' && this.currentAct === 4;
    this.dustInst.visible = this.mode === 'combat';
    this.syncHangarVideoPlayback();
    this.syncActVideosPlayback();
  }

  isAct1VideoReady(): boolean {
    return this.actVideos.get(1)?.ready ?? false;
  }

  isActVideoReady(act: 1 | 2 | 3 | 4): boolean {
    return this.actVideos.get(act)?.ready ?? false;
  }

  private createVolumetricBeamMaterial(
    colorHex: number,
    opacity: number,
    fromBottom: boolean
  ): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
        uOpacity: { value: opacity },
        uTime: { value: 0 },
        uFromBottom: { value: fromBottom ? 1.0 : 0.0 },
      },
      vertexShader: VOLUMETRIC_BEAM_VERT,
      fragmentShader: VOLUMETRIC_BEAM_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.volumetricBeams.push(mat);
    return mat;
  }

  private initHangarVideo(): void {
    if (typeof document === 'undefined' || this.hangarVideoEl) return;

    const video = document.createElement('video');
    video.src = './env/hangar_vista_loop.mp4';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    this.hangarVideoEl = video;

    const activateVideoTexture = () => {
      if (this.disposed || this.hangarVideoReady || !this.hangarVideoEl) return;
      if (video.videoWidth <= 0 || video.readyState < 2) return;
      const vtex = new THREE.VideoTexture(video);
      vtex.colorSpace = THREE.SRGBColorSpace;
      vtex.minFilter = THREE.LinearFilter;
      vtex.magFilter = THREE.LinearFilter;
      vtex.generateMipmaps = false;
      this.hangarVideoTex = vtex;
      this.hangarVistaMat.map = vtex;
      this.hangarVistaMat.needsUpdate = true;
      this.hangarVideoReady = true;
    };

    video.addEventListener('loadeddata', activateVideoTexture);
    video.addEventListener('canplay', activateVideoTexture);

    if (typeof window !== 'undefined') {
      const unlockVideo = () => {
        if (this.disposed) return;
        this.syncHangarVideoPlayback();
        this.syncActVideosPlayback();
      };
      this.hangarVideoUnlockHandler = unlockVideo;
      window.addEventListener('pointerdown', unlockVideo, { passive: true });
      window.addEventListener('keydown', unlockVideo, { passive: true });
    }
  }

  private initActVideos(): void {
    if (typeof document === 'undefined' || this.actVideos.size > 0) return;

    const specs: Array<{
      act: 1 | 2 | 3 | 4;
      vistaKey: 'act1' | 'act2' | 'act3' | 'act4';
      url: string;
      preload: 'auto' | 'metadata';
    }> = [
      { act: 1, vistaKey: 'act1', url: './env/stratosphere_vista_loop.mp4', preload: 'auto' },
      { act: 2, vistaKey: 'act2', url: './env/act1_vista_loop.mp4', preload: 'metadata' },
      { act: 3, vistaKey: 'act3', url: './env/act2_vista_loop.mp4', preload: 'metadata' },
      { act: 4, vistaKey: 'act4', url: './env/act3_vista_loop.mp4', preload: 'metadata' },
    ];

    for (const spec of specs) {
      const video = document.createElement('video');
      video.src = spec.url;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = spec.preload;
      video.crossOrigin = 'anonymous';

      const slot: ActVideoSlot = {
        act: spec.act,
        vistaKey: spec.vistaKey,
        video,
        tex: null,
        ready: false,
      };
      this.actVideos.set(spec.act, slot);

      const activateVideoTexture = () => {
        if (this.disposed || slot.ready) return;
        if (video.videoWidth <= 0 || video.readyState < 2) return;
        const vtex = new THREE.VideoTexture(video);
        vtex.colorSpace = THREE.SRGBColorSpace;
        vtex.minFilter = THREE.LinearFilter;
        vtex.magFilter = THREE.LinearFilter;
        vtex.generateMipmaps = false;
        slot.tex = vtex;
        slot.ready = true;
        this.activeTextures.set(slot.vistaKey, vtex);
        if (this.targetVistaKey === slot.vistaKey) {
          this.setCycloramaTexB(vtex);
          if (this.vistaBlend >= 1.0) {
            this.setCycloramaTexA(vtex);
          }
        }
      };

      video.addEventListener('loadeddata', activateVideoTexture);
      video.addEventListener('canplay', activateVideoTexture);
    }
  }

  private syncActVideosPlayback(): void {
    if (this.disposed) return;
    for (const slot of this.actVideos.values()) {
      const shouldPlay = this.mode === 'combat' && this.currentAct === slot.act;
      if (shouldPlay) {
        if (slot.video.paused) {
          const playPromise = slot.video.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
          }
        }
      } else if (!slot.video.paused) {
        slot.video.pause();
      }
    }
  }

  private disposeActVideos(): void {
    for (const slot of this.actVideos.values()) {
      slot.video.pause();
      slot.video.removeAttribute('src');
      try {
        slot.video.load();
      } catch {
        // Ignore in mocked DOM tests
      }
      if (slot.tex) {
        slot.tex.dispose();
        slot.tex = null;
      }
      slot.ready = false;
    }
    this.actVideos.clear();
  }

  private syncHangarVideoPlayback(): void {
    const video = this.hangarVideoEl;
    if (!video || this.disposed) return;
    const shouldPlay = this.mode === 'hangar' || this.mode === 'boot';
    if (shouldPlay) {
      if (video.paused) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }
    } else if (!video.paused) {
      video.pause();
    }
  }

  private disposeHangarVideo(): void {
    if (typeof window !== 'undefined' && this.hangarVideoUnlockHandler) {
      window.removeEventListener('pointerdown', this.hangarVideoUnlockHandler);
      window.removeEventListener('keydown', this.hangarVideoUnlockHandler);
      this.hangarVideoUnlockHandler = null;
    }
    if (this.hangarVideoEl) {
      this.hangarVideoEl.pause();
      this.hangarVideoEl.removeAttribute('src');
      try {
        this.hangarVideoEl.load();
      } catch {
        // Ignore in mocked DOM tests
      }
      this.hangarVideoEl = null;
    }
    if (this.hangarVideoTex) {
      this.hangarVideoTex.dispose();
      this.hangarVideoTex = null;
    }
    this.hangarVideoReady = false;
  }

  private remapPlaneUvs(
    geo: THREE.PlaneGeometry,
    uMin: number,
    uMax: number,
    vMin: number,
    vMax: number
  ): void {
    const uv = geo.attributes.uv;
    if (!uv) return;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, THREE.MathUtils.lerp(uMin, uMax, u), THREE.MathUtils.lerp(vMin, vMax, v));
    }
    uv.needsUpdate = true;
  }

  private createBayContactShadowTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return createFallbackTexture(0x030710);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0.0, 'rgba(3, 7, 16, 0.88)');
      grad.addColorStop(0.28, 'rgba(3, 7, 16, 0.54)');
      grad.addColorStop(0.7, 'rgba(3, 7, 16, 0.16)');
      grad.addColorStop(1.0, 'rgba(3, 7, 16, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private buildHangarBay(): void {
    this.hangarGroup.add(this.hangarParallaxGroup);

    // 1. Gently concave 16:9 Cinema Orbital Vista Backdrop (looping Omni video + 2K poster fallback)
    const vistaGeo = new THREE.PlaneGeometry(58, 32.625, 24, 1);
    const vistaPos = vistaGeo.attributes.position;
    for (let i = 0; i < vistaPos.count; i++) {
      const x = vistaPos.getX(i);
      const curveZ = (x * x) / 155;
      vistaPos.setZ(i, curveZ);
    }
    vistaPos.needsUpdate = true;
    this.hangarVistaMat = new THREE.MeshBasicMaterial({
      color: 0xd8e6f5,
      map: this.fallbackTextures.hangar,
      fog: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.hangarVistaMesh = new THREE.Mesh(vistaGeo, this.hangarVistaMat);
    this.hangarVistaMesh.name = 'HangarOrbitalVistaScreen';
    this.hangarVistaMesh.position.set(0, -2.05, -38.0);
    this.hangarVistaMesh.renderOrder = -85;
    this.hangarGroup.add(this.hangarVistaMesh);
    this.warmupTargets.push(this.hangarVistaMesh);

    // 2. Central 2K PBR Launch Platform Deck & Seamless Mirrored Side-Bay Titanium Plates (y = -1.72)
    this.hangarDeckMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.72,
      roughness: 0.82,
      envMapIntensity: 1.45,
      normalScale: new THREE.Vector2(1.2, 1.2),
      emissive: new THREE.Color(0x9befff),
      emissiveIntensity: 1.45,
    });

    this.hangarSideDeckMat = new THREE.MeshStandardMaterial({
      color: 0xd6e1ee,
      metalness: 0.78,
      roughness: 0.34,
      envMapIntensity: 1.38,
      normalScale: new THREE.Vector2(1.1, 1.1),
    });

    const centerDeckGeo = new THREE.PlaneGeometry(13.2, 13.2, 1, 1);
    centerDeckGeo.rotateX(-Math.PI * 0.5);
    const centerDeckMesh = new THREE.Mesh(centerDeckGeo, this.hangarDeckMat);
    centerDeckMesh.name = 'HangarLandingDeckCenter';
    centerDeckMesh.position.set(0, -1.72, 0);
    centerDeckMesh.receiveShadow = true;

    const fwdApronGeo = new THREE.PlaneGeometry(13.2, 9.9, 1, 1);
    fwdApronGeo.rotateX(-Math.PI * 0.5);
    this.remapPlaneUvs(fwdApronGeo, 0.0, 1.0, 0.805, 0.995);
    const fwdApronMesh = new THREE.Mesh(fwdApronGeo, this.hangarDeckMat);
    fwdApronMesh.name = 'HangarLandingDeckForward';
    fwdApronMesh.position.set(0, -1.721, -11.55);

    const sideWingGeo = new THREE.PlaneGeometry(24.0, 23.4, 1, 1);
    sideWingGeo.rotateX(-Math.PI * 0.5);
    const sideWingL = new THREE.Mesh(sideWingGeo, this.hangarSideDeckMat);
    sideWingL.position.set(-18.6, -1.722, -5.0);

    const sideWingR = new THREE.Mesh(sideWingGeo, this.hangarSideDeckMat);
    sideWingR.position.set(18.6, -1.722, -5.0);

    this.hangarGroup.add(centerDeckMesh, fwdApronMesh, sideWingL, sideWingR);
    this.warmupTargets.push(centerDeckMesh, sideWingL);

    // 3. Wall-to-Wall Recessed Expansion Seam, Launch Trench Rails & Observation Lip (zero abrupt joints)
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x1a2639,
      metalness: 0.88,
      roughness: 0.24,
      emissive: 0x071a2d,
      emissiveIntensity: 0.3,
    });
    const wallToWallSeam = new THREE.Mesh(new THREE.BoxGeometry(56.0, 0.036, 0.34), trimMat);
    wallToWallSeam.position.set(0, -1.708, -6.6);

    const trenchRailGeo = new THREE.BoxGeometry(0.28, 0.045, 23.4);
    for (const side of [-1, 1]) {
      const trenchRail = new THREE.Mesh(trenchRailGeo, trimMat);
      trenchRail.position.set(side * 6.62, -1.705, -5.0);
      this.hangarGroup.add(trenchRail);
    }

    const curbMesh = new THREE.Mesh(new THREE.BoxGeometry(58.0, 0.22, 0.52), trimMat);
    curbMesh.position.set(0, -1.62, -16.52);
    const curbShieldStrip = new THREE.Mesh(
      new THREE.BoxGeometry(56.0, 0.042, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.88 })
    );
    curbShieldStrip.position.set(0, -1.495, -16.52);
    this.hangarGroup.add(wallToWallSeam, curbMesh, curbShieldStrip);

    // 4. Unified Sealed Launch-Bay Portal & Perimeter Titanium Bulkheads (zero floating standees / ultrawide leaks)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x162133,
      metalness: 0.84,
      roughness: 0.32,
      emissive: 0x050e1c,
      emissiveIntensity: 0.26,
    });

    // Outer perimeter bulkheads framing the bay portal opening (x in [-11.5..+11.5], y <= +4.15)
    const outerWingWallGeo = new THREE.BoxGeometry(30.0, 16.5, 0.55);
    const pilasterGeo = new THREE.BoxGeometry(1.12, 16.2, 0.96);
    const accentVertStripGeo = new THREE.BoxGeometry(0.08, 11.0, 0.08);
    const accentCyanMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.68,
    });
    const plinthGeo = new THREE.BoxGeometry(19.0, 0.44, 1.38);
    const bumperWedgeGeo = new THREE.BoxGeometry(1.4, 0.48, 1.48);

    for (const side of [-1, 1]) {
      const wingWall = new THREE.Mesh(outerWingWallGeo, wallMat);
      wingWall.position.set(side * 26.6, 5.8, -16.32);
      this.hangarParallaxGroup.add(wingWall);

      // 3D titanium clamping pilaster exactly at the outer edge of the detailed catwalk pier (x = +-12.85)
      for (const px of [12.85, 17.8, 22.8]) {
        const pilaster = new THREE.Mesh(pilasterGeo, wallMat);
        pilaster.position.set(side * px, 5.7, -15.95);
        const strip = new THREE.Mesh(accentVertStripGeo, accentCyanMat);
        strip.position.set(side * px - side * 0.45, 3.8, -15.44);
        this.hangarParallaxGroup.add(pilaster, strip);
      }

      // 3D grounded armored base plinth bolting the portal piers & side walls firmly into the deck
      const plinth = new THREE.Mesh(plinthGeo, trimMat);
      plinth.position.set(side * 17.5, -1.56, -15.92);

      const innerCornerBumper = new THREE.Mesh(bumperWedgeGeo, trimMat);
      innerCornerBumper.position.set(side * 8.45, -1.56, -15.72);
      innerCornerBumper.rotation.y = side * 0.25;

      // Side enclosure walls far to left/right so 21:9/32:9 screens stay completely enclosed
      const sideBayWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 16.5, 24.5), wallMat);
      sideBayWall.position.set(side * 29.8, 5.8, -4.6);

      this.hangarParallaxGroup.add(plinth, innerCornerBumper, sideBayWall);
    }

    // Upper ceiling fascia sealed directly behind the overhead gantry truss
    const upperFascia = new THREE.Mesh(new THREE.BoxGeometry(84.0, 10.5, 0.55), wallMat);
    upperFascia.position.set(0, 9.3, -16.32);
    this.hangarParallaxGroup.add(upperFascia);

    // 5. Layered 2K Codex Transparent Bay Portal Arch & Catwalk Piers anchored right at the bay opening
    this.hangarCeilingMat = new THREE.MeshBasicMaterial({
      color: 0xe6f1ff,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true,
    });
    const ceilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(21.6, 12.15, 1, 1), this.hangarCeilingMat);
    ceilingMesh.name = 'HangarOverheadGantryMatte';
    ceilingMesh.position.set(0.0, 0.45, -15.92);
    ceilingMesh.renderOrder = 2;
    this.hangarParallaxGroup.add(ceilingMesh);
    this.warmupTargets.push(ceilingMesh);

    this.hangarBulkheadMat = new THREE.MeshBasicMaterial({
      color: 0xe4eefc,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: true,
    });
    const bulkheadGeo = new THREE.PlaneGeometry(8.4, 11.2, 1, 1);
    for (const side of [-1, 1]) {
      const portalPier = new THREE.Mesh(bulkheadGeo, this.hangarBulkheadMat);
      portalPier.position.set(side * 8.85, 3.82, -15.72);
      portalPier.scale.x = side < 0 ? 1 : -1;
      portalPier.rotation.y = side < 0 ? 0.04 : -0.04;
      portalPier.renderOrder = 3;
      this.hangarParallaxGroup.add(portalPier);
    }

    // Grounded soft ambient-occlusion contact shadow strips beneath portal piers & base plinths
    const aoShadowTex = this.createBayContactShadowTexture();
    const aoShadowMat = new THREE.MeshBasicMaterial({
      map: aoShadowTex,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const sideAoGeo = new THREE.PlaneGeometry(22.0, 2.8, 1, 1);
    sideAoGeo.rotateX(-Math.PI * 0.5);
    for (const side of [-1, 1]) {
      const aoPatch = new THREE.Mesh(sideAoGeo, aoShadowMat);
      aoPatch.position.set(side * 18.4, -1.706, -14.2);
      aoPatch.renderOrder = 1;
      this.hangarGroup.add(aoPatch);
    }

    // 6. Soft Volumetric Bay Sunlight Shafts streaming across the hero fighter turntable (0, -0.8, 0)
    const spotGeo = new THREE.CylinderGeometry(0.26, 2.55, 7.8, 18, 1, true);
    spotGeo.translate(0, -3.9, 0);
    const spotConfigs: Array<{ x: number; y: number; z: number; color: number; opacity: number }> = [
      { x: -4.2, y: 4.4, z: -2.2, color: 0xffd28a, opacity: 0.14 },
      { x: 4.2, y: 4.4, z: -2.2, color: 0x38e2ff, opacity: 0.14 },
    ];
    for (const cfg of spotConfigs) {
      const mat = this.createVolumetricBeamMaterial(cfg.color, cfg.opacity, false);
      const beam = new THREE.Mesh(spotGeo, mat);
      beam.position.set(cfg.x, cfg.y, cfg.z);
      beam.lookAt(0, -1.2, 0);
      beam.rotateX(-Math.PI * 0.5);
      this.hangarGroup.add(beam);
      this.warmupTargets.push(beam);
    }
  }

  private createMatteLayerMaterial(opts: {
    tint: number;
    hazeColor?: number;
    hazeStrength: number;
    opacity?: number;
    nearStart?: number;
    nearEnd?: number;
    farStart?: number;
    farEnd?: number;
    bottomFeather?: number;
  }): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.transparentFallbackTex },
        uTint: { value: new THREE.Color(opts.tint) },
        uHazeColor: { value: new THREE.Color(opts.hazeColor ?? 0x1f4b78) },
        uOpacity: { value: opts.opacity ?? 1.0 },
        uHazeStrength: { value: opts.hazeStrength },
        uFarStart: { value: opts.farStart ?? -258.0 },
        uFarEnd: { value: opts.farEnd ?? -146.0 },
        uNearStart: { value: opts.nearStart ?? 2.5 },
        uNearEnd: { value: opts.nearEnd ?? 12.8 },
        uBottomFeather: { value: opts.bottomFeather ?? 0.0 },
      },
      vertexShader: ACT1_MATTE_VERT,
      fragmentShader: ACT1_MATTE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
  }

  private buildAct1Stratosphere(): void {
    // Pure 1080p FPV Cinema Cloud-Skimming Vista carries 100% of the clouds (zero pasted cloud stickers).
    // Peripheral Gaussian-Tapered Stratosphere Slipstream Needles enhance supersonic air-rush parallax.
    const slipGeo = this.createCrossedStreakGeometry();
    const slipMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0.34 },
      },
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.act1SlipstreamInst = new THREE.InstancedMesh(slipGeo, slipMat, ACT1_SLIPSTREAM_COUNT);
    this.act1SlipstreamInst.name = 'Act1SlipstreamRibbons';
    this.act1SlipstreamInst.frustumCulled = false;
    const goldWispCol = new THREE.Color(0xffcfa0);
    const iceWispCol = new THREE.Color(0x88e6ff);

    for (let i = 0; i < ACT1_SLIPSTREAM_COUNT; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const r1 = ((i * 47 + 13) % 100) / 100;
      const r2 = ((i * 71 + 31) % 100) / 100;
      const r3 = ((i * 29 + 59) % 100) / 100;
      const radius = 16 + r1 * 38;
      const x = Math.cos(angle) * radius * 1.28;
      const y = Math.sin(angle) * radius * 0.72;
      const state: CorridorStreakState = {
        x,
        y,
        baseY: y,
        z: -r3 * 255 + 18,
        speedMult: 1.15 + r2 * 0.85,
        length: 3.4 + r3 * 4.8,
        thickness: 0.085,
        bobPhase: r1 * Math.PI * 2,
      };
      this.act1Slipstreams.push(state);
      this.dummy.position.set(state.x, state.y, state.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0.085, 0.085, state.length);
      this.dummy.updateMatrix();
      this.act1SlipstreamInst.setMatrixAt(i, this.dummy.matrix);
      this.act1SlipstreamInst.setColorAt(i, i % 3 === 0 ? goldWispCol : iceWispCol);
    }
    this.act1SlipstreamInst.instanceMatrix.needsUpdate = true;
    if (this.act1SlipstreamInst.instanceColor) this.act1SlipstreamInst.instanceColor.needsUpdate = true;
    this.act1Group.add(this.act1SlipstreamInst);
    this.warmupTargets.push(this.act1SlipstreamInst);
  }

  private buildAct2Metropolis(): void {
    // 1. Animated twilight-dawn FBM Cloud-Sea Floor beneath the elevated Orbital Metropolis (y = -15.6)
    const cloudGeo = new THREE.PlaneGeometry(440, 330, 1, 1);
    cloudGeo.rotateX(-Math.PI * 0.5);
    this.cloudSeaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScrollZ: { value: 0 },
      },
      vertexShader: CLOUD_SEA_VERT,
      fragmentShader: CLOUD_SEA_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const cloudSea = new THREE.Mesh(cloudGeo, this.cloudSeaMat);
    cloudSea.position.set(0, -15.6, -120);
    cloudSea.renderOrder = -20;
    this.act2Group.add(cloudSea);
    this.warmupTargets.push(cloudSea);

    // 2. 2K Seamless Scrolling PBR Elevated Orbital Highway Deck (y = -11.2)
    const deckGeo = new THREE.PlaneGeometry(28, 290, 1, 1);
    deckGeo.rotateX(-Math.PI * 0.5);
    this.highwayDeckMat = new THREE.MeshStandardMaterial({
      color: 0xdce8f7,
      metalness: 0.72,
      roughness: 0.86,
      envMapIntensity: 1.32,
      normalScale: new THREE.Vector2(1.15, 1.15),
      emissive: new THREE.Color(0x6de9ff),
      emissiveIntensity: 1.08,
      transparent: true,
      opacity: 0.98,
    });
    this.highwayDeckMat.customProgramCacheKey = () => 'act2_metro_highway_far_fade';
    this.highwayDeckMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vDeckWorldZ;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvDeckWorldZ = (modelMatrix * vec4( transformed, 1.0 )).z;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vDeckWorldZ;')
        .replace(
          '#include <dithering_fragment>',
          `float deckFarFade = smoothstep(-255.0, -155.0, vDeckWorldZ);
          gl_FragColor.rgb = mix(vec3(0.10, 0.24, 0.41), gl_FragColor.rgb, deckFarFade);
          gl_FragColor.a *= deckFarFade;
          if (!(gl_FragColor.a >= 0.01)) discard;
          #include <dithering_fragment>`
        );
    };
    const highwayDeck = new THREE.Mesh(deckGeo, this.highwayDeckMat);
    highwayDeck.name = 'Act2HighwayPbrDeck';
    highwayDeck.position.set(0, -11.2, -115);
    highwayDeck.renderOrder = -12;
    this.act2Group.add(highwayDeck);
    this.warmupTargets.push(highwayDeck);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x26415e,
      metalness: 0.78,
      roughness: 0.28,
      emissive: 0x0a304d,
      emissiveIntensity: 0.45,
    });
    const railGeo = new THREE.BoxGeometry(0.9, 0.75, 290);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side * 14.3, -10.9, -115);
      this.act2Group.add(rail);
    }

    const terraceGeo = new THREE.BoxGeometry(22.5, 1.4, 285);
    this.terraceDeckMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScrollZ: { value: 0 },
      },
      vertexShader: TERRACE_DECK_VERT,
      fragmentShader: TERRACE_DECK_FRAG,
      transparent: true,
    });
    for (const side of [-1, 1]) {
      const terrace = new THREE.Mesh(terraceGeo, this.terraceDeckMat);
      terrace.position.set(side * 25.5, -10.2, -112);
      terrace.renderOrder = -10;
      this.act2Group.add(terrace);
      this.warmupTargets.push(terrace);
    }

    const pylonGeo = new THREE.BoxGeometry(3.2, 10.5, 4.2);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x182b42,
      metalness: 0.75,
      roughness: 0.35,
    });
    this.pylonInst = new THREE.InstancedMesh(pylonGeo, pylonMat, ACT2_METRO_PYLON_COUNT);
    this.pylonInst.name = 'Act2TerracePylons';
    this.pylonInst.frustumCulled = false;
    for (let i = 0; i < ACT2_METRO_PYLON_COUNT; i++) {
      const pairIdx = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      const z = -pairIdx * 20 + 18;
      this.pylonZ.push(z);
      this.dummy.position.set(side * 25.5, -16.0, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.pylonInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.pylonInst.instanceMatrix.needsUpdate = true;
    this.act2Group.add(this.pylonInst);
    this.warmupTargets.push(this.pylonInst);

    // 3. Codex 2K Transparent Architectural Layers: Overhead Sky Arches + Near Holo Pylons + Dual-Depth Towers
    const unitPlaneGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.metroArchMat = this.createMatteLayerMaterial({
      tint: 0xe6effa,
      hazeStrength: 0.32,
      opacity: 0.96,
      nearStart: 2.2,
      nearEnd: 12.2,
    });
    this.metroHoloPylonMat = this.createMatteLayerMaterial({
      tint: 0xf2f8ff,
      hazeStrength: 0.24,
      opacity: 0.95,
      nearStart: 2.5,
      nearEnd: 12.8,
    });
    this.metroTowerMatA = this.createMatteLayerMaterial({
      tint: 0xdce7f5,
      hazeStrength: 0.34,
      opacity: 0.97,
      nearStart: -6.0,
      nearEnd: 9.0,
      bottomFeather: 0.14,
    });
    this.metroTowerMatB = this.createMatteLayerMaterial({
      tint: 0xdce7f5,
      hazeStrength: 0.34,
      opacity: 0.97,
      nearStart: -6.0,
      nearEnd: 9.0,
      bottomFeather: 0.14,
    });
    this.metroFarTowerMatA = this.createMatteLayerMaterial({
      tint: 0xbdd0e6,
      hazeStrength: 0.58,
      opacity: 0.92,
      nearStart: -10.0,
      nearEnd: 8.0,
      bottomFeather: 0.16,
    });
    this.metroFarTowerMatB = this.createMatteLayerMaterial({
      tint: 0xbdd0e6,
      hazeStrength: 0.58,
      opacity: 0.92,
      nearStart: -10.0,
      nearEnd: 8.0,
      bottomFeather: 0.16,
    });

    const archSpanZ = ACT2_METRO_ARCH_COUNT * 58;
    for (let i = 0; i < ACT2_METRO_ARCH_COUNT; i++) {
      const z = -i * 58 - 18;
      const archMesh = new THREE.Mesh(unitPlaneGeo, this.metroArchMat);
      archMesh.name = `Act2SkyArch_${i}`;
      archMesh.position.set(0, 7.6, z);
      archMesh.scale.set(64, 36.0, 1);
      archMesh.renderOrder = -4;
      this.act2Group.add(archMesh);
      this.metroScrollingProps.push({
        mesh: archMesh,
        x: 0,
        y: 7.6,
        z,
        speedMult: 1.0,
        spanZ: archSpanZ,
        wrapZ: 22,
      });
      if (i === 0) this.warmupTargets.push(archMesh);
    }

    const holoCount = 12;
    const holoSpanZ = (holoCount / 2) * 44;
    for (let i = 0; i < holoCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 53 + 17) % 100) / 100;
      const x = side * (30.5 + rA * 3.8);
      const w = 11.2 + rA * 2.2;
      const h = w * 1.5;
      const y = -10.3 + h * 0.5;
      const z = -pairIdx * 44 - (side > 0 ? 22 : 4);
      const pylonMesh = new THREE.Mesh(unitPlaneGeo, this.metroHoloPylonMat);
      pylonMesh.position.set(x, y, z);
      pylonMesh.rotation.y = side * -0.14;
      pylonMesh.scale.set(side < 0 ? w : -w, h, 1);
      pylonMesh.renderOrder = -4;
      this.act2Group.add(pylonMesh);
      this.metroScrollingProps.push({
        mesh: pylonMesh,
        x,
        y,
        z,
        speedMult: 0.94,
        spanZ: holoSpanZ,
        wrapZ: 24,
      });
      if (i === 0) this.warmupTargets.push(pylonMesh);
    }

    const midCount = 14;
    const midSpanZ = (midCount / 2) * 38;
    for (let i = 0; i < midCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 73 + 19) % 100) / 100;
      const rB = ((i * 37 + 53) % 100) / 100;
      const useB = i % 3 === 1 || i % 4 === 2;
      const mat = useB ? this.metroTowerMatB : this.metroTowerMatA;
      const x = side * (50 + rA * 16);
      const w = 34 + rB * 10;
      const h = w * 1.5;
      const y = -20.5 + h * 0.5;
      const z = -pairIdx * 38 - rB * 14 + 8;
      const flip = (pairIdx + (side > 0 ? 1 : 0)) % 2 === 0 ? 1 : -1;
      const towerMesh = new THREE.Mesh(unitPlaneGeo, mat);
      towerMesh.position.set(x, y, z);
      towerMesh.rotation.y = side * -0.16;
      towerMesh.scale.set(w * flip, h, 1);
      towerMesh.renderOrder = -4;
      this.act2Group.add(towerMesh);
      this.metroScrollingProps.push({
        mesh: towerMesh,
        x,
        y,
        z,
        speedMult: 0.78,
        spanZ: midSpanZ,
        wrapZ: 28,
      });
      if (i < 2) this.warmupTargets.push(towerMesh);
    }

    const farCount = 14;
    const farSpanZ = (farCount / 2) * 40;
    for (let i = 0; i < farCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 61 + 29) % 100) / 100;
      const rB = ((i * 89 + 11) % 100) / 100;
      const useB = (i + 1) % 2 === 0;
      const mat = useB ? this.metroFarTowerMatB : this.metroFarTowerMatA;
      const x = side * (78 + rA * 34);
      const w = 48 + rB * 16;
      const h = w * 1.5;
      const y = -21.0 + h * 0.5;
      const z = -pairIdx * 40 - rA * 16 - 10;
      const flip = i % 2 === 0 ? -1 : 1;
      const farMesh = new THREE.Mesh(unitPlaneGeo, mat);
      farMesh.position.set(x, y, z);
      farMesh.rotation.y = side * -0.18;
      farMesh.scale.set(w * flip, h, 1);
      farMesh.renderOrder = -4;
      this.act2Group.add(farMesh);
      this.metroScrollingProps.push({
        mesh: farMesh,
        x,
        y,
        z,
        speedMult: 0.52,
        spanZ: farSpanZ,
        wrapZ: 30,
      });
      if (i < 2) this.warmupTargets.push(farMesh);
    }

    // 4. 64 Bidirectional Aerial Highway Traffic Light Streaks outside central combat corridor
    const trafficGeo = new THREE.BoxGeometry(0.18, 0.12, 1.0);
    const trafficMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      toneMapped: false,
    });
    this.metroTrafficInst = new THREE.InstancedMesh(trafficGeo, trafficMat, ACT2_METRO_TRAFFIC_COUNT);
    this.metroTrafficInst.name = 'Act2AerialTraffic';
    this.metroTrafficInst.frustumCulled = false;
    const oncomingCol = new THREE.Color(0xffd27a);
    const outboundCol = new THREE.Color(0x45e8ff);

    for (let i = 0; i < ACT2_METRO_TRAFFIC_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const r1 = ((i * 47 + 13) % 100) / 100;
      const r2 = ((i * 71 + 31) % 100) / 100;
      const r3 = ((i * 29 + 59) % 100) / 100;
      const dirSign = i % 3 === 0 ? -1 : 1;
      const state: CorridorStreakState = {
        x: side * (16.5 + r1 * 21.5),
        y: -9.4 + r2 * 6.8,
        baseY: -9.4 + r2 * 6.8,
        z: -r3 * 255 + 18,
        speedMult: dirSign > 0 ? 1.45 + r2 * 0.65 : 0.42 + r1 * 0.25,
        length: 2.2 + r3 * 3.0,
      };
      this.metroTraffic.push(state);
      this.dummy.position.set(state.x, state.y, state.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, state.length);
      this.dummy.updateMatrix();
      this.metroTrafficInst.setMatrixAt(i, this.dummy.matrix);
      this.metroTrafficInst.setColorAt(i, dirSign > 0 ? oncomingCol : outboundCol);
    }
    this.metroTrafficInst.instanceMatrix.needsUpdate = true;
    if (this.metroTrafficInst.instanceColor) this.metroTrafficInst.instanceColor.needsUpdate = true;
    this.act2Group.add(this.metroTrafficInst);
    this.warmupTargets.push(this.metroTrafficInst);

    // 5. Soft Golden Dawn Volumetric Sunbeams Slanting Outside the Central Corridor
    const sunBeamGeo = new THREE.CylinderGeometry(0.45, 5.4, 52, 16, 1, true);
    sunBeamGeo.translate(0, -26, 0);
    const metroSunbeams: Array<{ x: number; y: number; z: number; tiltZ: number; color: number }> = [
      { x: -46, y: 26, z: -58, tiltZ: 0.42, color: 0xffcf88 },
      { x: -34, y: 24, z: -118, tiltZ: 0.36, color: 0xffd79b },
      { x: 34, y: 24, z: -84, tiltZ: -0.34, color: 0x52dcff },
      { x: 46, y: 26, z: -146, tiltZ: -0.40, color: 0xffcf88 },
    ];
    for (const cfg of metroSunbeams) {
      const beamMat = this.createVolumetricBeamMaterial(cfg.color, 0.085, false);
      const beamMesh = new THREE.Mesh(sunBeamGeo, beamMat);
      beamMesh.position.set(cfg.x, cfg.y, cfg.z);
      beamMesh.rotation.z = cfg.tiltZ;
      beamMesh.renderOrder = -3;
      this.act2Group.add(beamMesh);
      this.warmupTargets.push(beamMesh);
    }
  }

  private buildAct3Nebula(): void {
    // 1. 24 Small 3D Tumbling Crystal/Asteroid Shards flanking the outer void (|x| >= 22)
    const rockGeo = this.createFacetedAsteroidGeometry();
    const crystalGeo = this.createCrystalClusterGeometry();

    const metaData = new Float32Array(ACT3_DEBRIS_COUNT * 4);
    this.megalithMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: CRYSTAL_ROCK_VERT,
      fragmentShader: CRYSTAL_ROCK_FRAG,
    });

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x7c3aed,
      emissiveIntensity: 1.05,
      roughness: 0.18,
      metalness: 0.35,
    });

    this.megalithInst = new THREE.InstancedMesh(rockGeo, this.megalithMat, ACT3_DEBRIS_COUNT);
    this.megalithInst.name = 'Act3CrystalMegaliths';
    this.megalithInst.frustumCulled = false;

    this.crystalShardInst = new THREE.InstancedMesh(crystalGeo, crystalMat, ACT3_DEBRIS_COUNT);
    this.crystalShardInst.name = 'Act3CrystalShards';
    this.crystalShardInst.frustumCulled = false;

    const veinPalette = [
      new THREE.Color(0x2be0c8),
      new THREE.Color(0xc084fc),
      new THREE.Color(0x34d399),
      new THREE.Color(0x38bdf8),
    ];

    for (let i = 0; i < ACT3_DEBRIS_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const r1 = ((i * 59 + 13) % 100) / 100;
      const r2 = ((i * 83 + 29) % 100) / 100;
      const r3 = ((i * 41 + 61) % 100) / 100;

      const x = side * (22.5 + r1 * 32.0);
      const y = -13 + r2 * 27;
      const z = -i * 10.6 + 20;
      const baseScale = 0.72 + r3 * 0.75;

      const state: MegalithState = {
        x,
        y,
        z,
        scaleX: baseScale * (0.85 + r1 * 0.4),
        scaleY: baseScale * (0.8 + r2 * 0.45),
        scaleZ: baseScale * (0.85 + r3 * 0.45),
        rotX: r1 * Math.PI * 2,
        rotY: r2 * Math.PI * 2,
        rotZ: r3 * Math.PI * 2,
        spinX: (r1 - 0.5) * 0.65,
        spinY: (r2 - 0.5) * 0.75,
        spinZ: (r3 - 0.5) * 0.55,
        bobPhase: r1 * Math.PI * 2,
        bobAmp: 0.35 + r2 * 0.65,
        crystalScale: baseScale * (0.88 + r2 * 0.32),
      };
      this.megaliths.push(state);

      metaData[i * 4] = r1;
      metaData[i * 4 + 1] = r2;
      metaData[i * 4 + 2] = r3;
      metaData[i * 4 + 3] = 1.0;

      this.dummy.position.set(state.x, state.y, state.z);
      this.dummy.rotation.set(state.rotX, state.rotY, state.rotZ);
      this.dummy.scale.set(state.scaleX, state.scaleY, state.scaleZ);
      this.dummy.updateMatrix();
      this.megalithInst.setMatrixAt(i, this.dummy.matrix);
      this.megalithInst.setColorAt(i, veinPalette[i % veinPalette.length]);

      this.dummy.scale.setScalar(state.crystalScale);
      this.dummy.updateMatrix();
      this.crystalShardInst.setMatrixAt(i, this.dummy.matrix);
      this.crystalShardInst.setColorAt(i, veinPalette[(i + 1) % veinPalette.length]);
    }

    rockGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(metaData, 4));
    this.megalithInst.instanceMatrix.needsUpdate = true;
    if (this.megalithInst.instanceColor) this.megalithInst.instanceColor.needsUpdate = true;
    this.crystalShardInst.instanceMatrix.needsUpdate = true;
    if (this.crystalShardInst.instanceColor) this.crystalShardInst.instanceColor.needsUpdate = true;

    this.act3Group.add(this.megalithInst, this.crystalShardInst);
    this.warmupTargets.push(this.megalithInst, this.crystalShardInst);

    // 2. Subdued Deep-Cosmic Warp Plasma River Below (y = -13.2)
    const riverGeo = new THREE.PlaneGeometry(116, 300, 1, 1);
    riverGeo.rotateX(-Math.PI * 0.5);
    this.plasmaRiverMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScrollZ: { value: 0 },
      },
      vertexShader: PLASMA_RIVER_VERT,
      fragmentShader: PLASMA_RIVER_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const riverMesh = new THREE.Mesh(riverGeo, this.plasmaRiverMat);
    riverMesh.position.set(0, -13.2, -120);
    riverMesh.renderOrder = -15;
    this.act3Group.add(riverMesh);
    this.warmupTargets.push(riverMesh);

    // 3. Codex 2K Transparent Layers: Fractured Warp Rings + Floating Crystal Monoliths + Derelict Station Hulks
    const unitPlaneGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.act3WarpRingMat = this.createMatteLayerMaterial({
      tint: 0xdff7ff,
      hazeColor: 0x161242,
      hazeStrength: 0.32,
      opacity: 0.96,
      nearStart: 2.0,
      nearEnd: 12.2,
    });
    this.act3CrystalNearAMat = this.createMatteLayerMaterial({
      tint: 0xe2f6ff,
      hazeColor: 0x161242,
      hazeStrength: 0.28,
      opacity: 0.96,
      nearStart: -2.0,
      nearEnd: 10.5,
    });
    this.act3CrystalNearBMat = this.createMatteLayerMaterial({
      tint: 0xe6e4ff,
      hazeColor: 0x161242,
      hazeStrength: 0.28,
      opacity: 0.96,
      nearStart: -2.0,
      nearEnd: 10.5,
    });
    this.act3DerelictMidMat = this.createMatteLayerMaterial({
      tint: 0xcfdff5,
      hazeColor: 0x161242,
      hazeStrength: 0.40,
      opacity: 0.95,
      nearStart: -6.0,
      nearEnd: 9.0,
    });
    this.act3DerelictFarMat = this.createMatteLayerMaterial({
      tint: 0xaabbe6,
      hazeColor: 0x161242,
      hazeStrength: 0.62,
      opacity: 0.90,
      nearStart: -10.0,
      nearEnd: 8.0,
    });
    this.act3CrystalFarMat = this.createMatteLayerMaterial({
      tint: 0xaabbe6,
      hazeColor: 0x161242,
      hazeStrength: 0.62,
      opacity: 0.90,
      nearStart: -10.0,
      nearEnd: 8.0,
    });

    const ringSpanZ = ACT3_WARP_RING_COUNT * 58;
    for (let i = 0; i < ACT3_WARP_RING_COUNT; i++) {
      const z = -i * 58 - 18;
      const ringMesh = new THREE.Mesh(unitPlaneGeo, this.act3WarpRingMat);
      ringMesh.name = `Act3WarpRing_${i}`;
      ringMesh.position.set(0, 1.4, z);
      ringMesh.scale.set(62, 34.875, 1);
      ringMesh.rotation.z = (i * Math.PI) / 5;
      ringMesh.renderOrder = -4;
      this.act3Group.add(ringMesh);
      this.act3ScrollingProps.push({
        mesh: ringMesh,
        x: 0,
        y: 1.4,
        z,
        speedMult: 1.0,
        spanZ: ringSpanZ,
        wrapZ: 22,
        spinZ: i % 2 === 0 ? 0.065 : -0.055,
      });
      if (i === 0) this.warmupTargets.push(ringMesh);
    }

    const nearCount = 12;
    const nearSpanZ = (nearCount / 2) * 44;
    for (let i = 0; i < nearCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 53 + 17) % 100) / 100;
      const rB = ((i * 79 + 29) % 100) / 100;
      const mat = i % 2 === 0 ? this.act3CrystalNearAMat : this.act3CrystalNearBMat;
      const x = side * (31 + rA * 12);
      const y = -8.5 + rB * 19.0;
      const size = 14 + rA * 5.0;
      const z = -pairIdx * 44 - (side > 0 ? 22 : 4);
      const mesh = new THREE.Mesh(unitPlaneGeo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = side * -0.15;
      mesh.rotation.z = (rB - 0.5) * 0.45;
      mesh.scale.set(size * (i % 3 === 0 ? -1 : 1), size, 1);
      mesh.renderOrder = -4;
      this.act3Group.add(mesh);
      this.act3ScrollingProps.push({
        mesh,
        x,
        y,
        baseY: y,
        z,
        speedMult: 0.90,
        spanZ: nearSpanZ,
        wrapZ: 24,
        bobAmp: 0.65 + rA * 0.55,
        bobPhase: i * 1.15,
      });
      if (i === 0) this.warmupTargets.push(mesh);
    }

    const midCount = 14;
    const midSpanZ = (midCount / 2) * 38;
    for (let i = 0; i < midCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 73 + 19) % 100) / 100;
      const rB = ((i * 37 + 53) % 100) / 100;
      const isDerelict = i % 3 !== 1;
      const mat = isDerelict
        ? this.act3DerelictMidMat
        : i % 2 === 0
          ? this.act3CrystalNearAMat
          : this.act3CrystalNearBMat;
      const x = side * (49 + rA * 18);
      const w = isDerelict ? 29 + rB * 9 : 25 + rB * 8;
      const h = isDerelict ? w * 1.5 : w;
      const y = -6.0 + rB * 15.0;
      const z = -pairIdx * 38 - rB * 14 + 6;
      const flip = (pairIdx + (side > 0 ? 1 : 0)) % 2 === 0 ? 1 : -1;
      const mesh = new THREE.Mesh(unitPlaneGeo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = side * -0.17;
      mesh.rotation.z = (rA - 0.5) * 0.24;
      mesh.scale.set(w * flip, h, 1);
      mesh.renderOrder = -4;
      this.act3Group.add(mesh);
      this.act3ScrollingProps.push({
        mesh,
        x,
        y,
        baseY: y,
        z,
        speedMult: 0.72,
        spanZ: midSpanZ,
        wrapZ: 28,
        bobAmp: 0.8 + rB * 0.6,
        bobPhase: i * 0.85,
      });
      if (i < 2) this.warmupTargets.push(mesh);
    }

    const farCount = 12;
    const farSpanZ = (farCount / 2) * 44;
    for (let i = 0; i < farCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 61 + 29) % 100) / 100;
      const rB = ((i * 89 + 11) % 100) / 100;
      const isDerelict = i % 2 === 0;
      const mat = isDerelict ? this.act3DerelictFarMat : this.act3CrystalFarMat;
      const x = side * (82 + rA * 33);
      const w = isDerelict ? 44 + rB * 14 : 38 + rB * 12;
      const h = isDerelict ? w * 1.5 : w;
      const y = -5.0 + rA * 18.0;
      const z = -pairIdx * 44 - rA * 16 - 10;
      const mesh = new THREE.Mesh(unitPlaneGeo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = side * -0.18;
      mesh.rotation.z = (rB - 0.5) * 0.18;
      mesh.scale.set(w * (i % 2 === 0 ? -1 : 1), h, 1);
      mesh.renderOrder = -4;
      this.act3Group.add(mesh);
      this.act3ScrollingProps.push({
        mesh,
        x,
        y,
        baseY: y,
        z,
        speedMult: 0.46,
        spanZ: farSpanZ,
        wrapZ: 30,
        bobAmp: 0.9,
        bobPhase: i * 0.65,
      });
      if (i < 2) this.warmupTargets.push(mesh);
    }

    const streakGeo = new THREE.BoxGeometry(0.16, 0.12, 1.0);
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
    });
    this.act3StreakInst = new THREE.InstancedMesh(streakGeo, streakMat, ACT3_STREAK_COUNT);
    this.act3StreakInst.name = 'Act3IonizedWarpStreaks';
    this.act3StreakInst.frustumCulled = false;
    const tealStreak = new THREE.Color(0x34f5c5);
    const violetStreak = new THREE.Color(0xc084fc);

    for (let i = 0; i < ACT3_STREAK_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const r1 = ((i * 43 + 17) % 100) / 100;
      const r2 = ((i * 67 + 31) % 100) / 100;
      const r3 = ((i * 23 + 71) % 100) / 100;
      const baseY = -10.5 + r2 * 21.0;
      const state: CorridorStreakState = {
        x: side * (16.5 + r1 * 23.0),
        y: baseY,
        baseY,
        z: -r3 * 255 + 18,
        speedMult: i % 3 === 0 ? 1.55 + r2 * 0.55 : 0.72 + r1 * 0.35,
        length: 2.0 + r3 * 3.2,
      };
      this.act3Streaks.push(state);
      this.dummy.position.set(state.x, state.y, state.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, state.length);
      this.dummy.updateMatrix();
      this.act3StreakInst.setMatrixAt(i, this.dummy.matrix);
      this.act3StreakInst.setColorAt(i, i % 2 === 0 ? tealStreak : violetStreak);
    }
    this.act3StreakInst.instanceMatrix.needsUpdate = true;
    if (this.act3StreakInst.instanceColor) this.act3StreakInst.instanceColor.needsUpdate = true;
    this.act3Group.add(this.act3StreakInst);
    this.warmupTargets.push(this.act3StreakInst);

    const rayGeo = new THREE.CylinderGeometry(0.5, 5.8, 56, 16, 1, true);
    rayGeo.translate(0, -28, 0);
    const act3Rays: Array<{ x: number; y: number; z: number; tiltZ: number; color: number }> = [
      { x: -46, y: 26, z: -64, tiltZ: 0.44, color: 0x2be0c8 },
      { x: -34, y: 24, z: -124, tiltZ: 0.36, color: 0xa855f7 },
      { x: 34, y: 24, z: -88, tiltZ: -0.36, color: 0x2be0c8 },
      { x: 46, y: 26, z: -148, tiltZ: -0.44, color: 0xc084fc },
    ];
    for (const cfg of act3Rays) {
      const mat = this.createVolumetricBeamMaterial(cfg.color, 0.075, false);
      const ray = new THREE.Mesh(rayGeo, mat);
      ray.position.set(cfg.x, cfg.y, cfg.z);
      ray.rotation.z = cfg.tiltZ;
      ray.renderOrder = -3;
      this.act3Group.add(ray);
      this.warmupTargets.push(ray);
    }
  }

  private buildAct4Citadel(): void {
    // 1. 2K Seamless Scrolling PBR Armored Dreadnought Dorsal Trench Hull (y = -11.4)
    const hullGeo = new THREE.PlaneGeometry(42, 290, 1, 1);
    hullGeo.rotateX(-Math.PI * 0.5);
    this.act4HullMat = new THREE.MeshStandardMaterial({
      color: 0xdcc8c4,
      metalness: 0.46,
      roughness: 0.68,
      envMapIntensity: 0.28,
      normalScale: new THREE.Vector2(1.25, 1.25),
      emissive: new THREE.Color(0xff7830),
      emissiveIntensity: 1.25,
      transparent: true,
      opacity: 0.99,
    });
    this.act4HullMat.customProgramCacheKey = () => 'act4_hull_far_fade';
    this.act4HullMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vHullWorldZ;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvHullWorldZ = (modelMatrix * vec4( transformed, 1.0 )).z;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHullWorldZ;')
        .replace(
          '#include <dithering_fragment>',
          `float hullFarFade = smoothstep(-255.0, -155.0, vHullWorldZ);
          gl_FragColor.rgb = mix(vec3(0.18, 0.055, 0.06), gl_FragColor.rgb, hullFarFade);
          gl_FragColor.a *= hullFarFade;
          if (!(gl_FragColor.a >= 0.01)) discard;
          #include <dithering_fragment>`
        );
    };
    const hullDeck = new THREE.Mesh(hullGeo, this.act4HullMat);
    hullDeck.name = 'Act4DreadnoughtHullPbrDeck';
    hullDeck.position.set(0, -11.4, -116);
    hullDeck.renderOrder = -12;
    this.act4Group.add(hullDeck);
    this.warmupTargets.push(hullDeck);

    this.act4SideDeckMat = new THREE.MeshStandardMaterial({
      color: 0x1b1113,
      metalness: 0.22,
      roughness: 0.84,
      envMapIntensity: 0.14,
      normalScale: new THREE.Vector2(1.1, 1.1),
      emissive: 0x1a0608,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.99,
    });
    this.act4SideDeckMat.customProgramCacheKey = () => 'act4_side_far_fade';
    this.act4SideDeckMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vSideWorldZ;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSideWorldZ = (modelMatrix * vec4( transformed, 1.0 )).z;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vSideWorldZ;')
        .replace(
          '#include <dithering_fragment>',
          `float sideFarFade = smoothstep(-255.0, -155.0, vSideWorldZ);
          gl_FragColor.rgb = mix(vec3(0.18, 0.055, 0.06), gl_FragColor.rgb, sideFarFade);
          gl_FragColor.a *= sideFarFade;
          if (!(gl_FragColor.a >= 0.01)) discard;
          #include <dithering_fragment>`
        );
    };
    const wingDeckGeo = new THREE.BoxGeometry(50, 1.4, 290);
    const wingUv = wingDeckGeo.attributes.uv;
    const wingNorm = wingDeckGeo.attributes.normal;
    if (wingUv && wingNorm) {
      for (let i = 0; i < wingUv.count; i++) {
        if (Math.abs(wingNorm.getY(i)) > 0.5) {
          wingUv.setXY(i, wingUv.getX(i) * 1.8, wingUv.getY(i) * 10);
        }
      }
      wingUv.needsUpdate = true;
    }
    const railGuardGeo = new THREE.BoxGeometry(1.0, 0.95, 290);
    const railGuardMat = new THREE.MeshStandardMaterial({
      color: 0x2b1b20,
      metalness: 0.72,
      roughness: 0.42,
      emissive: 0x5c1118,
      emissiveIntensity: 0.55,
    });
    for (const side of [-1, 1]) {
      const wingDeck = new THREE.Mesh(wingDeckGeo, this.act4SideDeckMat);
      wingDeck.position.set(side * 46.2, -12.12, -116);
      wingDeck.renderOrder = -12;
      const guard = new THREE.Mesh(railGuardGeo, railGuardMat);
      guard.position.set(side * 21.2, -11.0, -116);
      this.act4Group.add(wingDeck, guard);
    }

    const unitPlaneGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.act4KeelArchMat = this.createMatteLayerMaterial({
      tint: 0xf0dada,
      hazeColor: 0x380f14,
      hazeStrength: 0.34,
      opacity: 0.97,
      nearStart: 2.2,
      nearEnd: 12.2,
    });
    this.act4FlakPylonMat = this.createMatteLayerMaterial({
      tint: 0xf2e2e2,
      hazeColor: 0x380f14,
      hazeStrength: 0.26,
      opacity: 0.96,
      nearStart: 2.5,
      nearEnd: 12.8,
    });
    this.act4BastionMatA = this.createMatteLayerMaterial({
      tint: 0xe6d2d2,
      hazeColor: 0x380f14,
      hazeStrength: 0.36,
      opacity: 0.97,
      nearStart: -2.0,
      nearEnd: 10.5,
      bottomFeather: 0.0,
    });
    this.act4BastionMatB = this.createMatteLayerMaterial({
      tint: 0xe6d2d2,
      hazeColor: 0x380f14,
      hazeStrength: 0.36,
      opacity: 0.97,
      nearStart: -2.0,
      nearEnd: 10.5,
      bottomFeather: 0.0,
    });
    this.act4FarBastionMatA = this.createMatteLayerMaterial({
      tint: 0xc9a3a3,
      hazeColor: 0x380f14,
      hazeStrength: 0.62,
      opacity: 0.92,
      nearStart: -10.0,
      nearEnd: 8.0,
      bottomFeather: 0.16,
    });
    this.act4FarBastionMatB = this.createMatteLayerMaterial({
      tint: 0xc9a3a3,
      hazeColor: 0x380f14,
      hazeStrength: 0.62,
      opacity: 0.92,
      nearStart: -10.0,
      nearEnd: 8.0,
      bottomFeather: 0.16,
    });

    const archSpanZ = ACT4_ARCH_COUNT * 58;
    for (let i = 0; i < ACT4_ARCH_COUNT; i++) {
      const z = -i * 58 - 18;
      const archMesh = new THREE.Mesh(unitPlaneGeo, this.act4KeelArchMat);
      archMesh.name = `Act4KeelArch_${i}`;
      archMesh.position.set(0, 7.1, z);
      archMesh.scale.set(66, 37.125, 1);
      archMesh.renderOrder = -4;
      this.act4Group.add(archMesh);
      this.act4ScrollingProps.push({
        mesh: archMesh,
        x: 0,
        y: 7.1,
        z,
        speedMult: 1.0,
        spanZ: archSpanZ,
        wrapZ: 22,
      });
      if (i === 0) this.warmupTargets.push(archMesh);
    }

    const flakCount = 12;
    const flakSpanZ = (flakCount / 2) * 44;
    for (let i = 0; i < flakCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 53 + 17) % 100) / 100;
      const x = side * (26.5 + rA * 5.2);
      const w = 11.8 + rA * 2.4;
      const h = w * 1.5;
      const y = -11.4 + h * 0.5;
      const z = -pairIdx * 44 - (side > 0 ? 22 : 4);
      const mesh = new THREE.Mesh(unitPlaneGeo, this.act4FlakPylonMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = side * -0.14;
      mesh.scale.set(side < 0 ? w : -w, h, 1);
      mesh.renderOrder = -4;
      this.act4Group.add(mesh);
      this.act4ScrollingProps.push({
        mesh,
        x,
        y,
        z,
        speedMult: 0.95,
        spanZ: flakSpanZ,
        wrapZ: 24,
      });
      if (i === 0) this.warmupTargets.push(mesh);
    }

    const midCount = 14;
    const midSpanZ = (midCount / 2) * 38;
    for (let i = 0; i < midCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 73 + 19) % 100) / 100;
      const rB = ((i * 37 + 53) % 100) / 100;
      const useB = i % 3 === 1 || i % 4 === 2;
      const mat = useB ? this.act4BastionMatB : this.act4BastionMatA;
      const x = side * (46 + rA * 17);
      const w = 34 + rB * 9;
      const h = w * 1.5;
      const y = -11.7 + h * 0.5;
      const z = -pairIdx * 38 - rB * 14 + 8;
      const flip = (pairIdx + (side > 0 ? 1 : 0)) % 2 === 0 ? 1 : -1;
      const mesh = new THREE.Mesh(unitPlaneGeo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = side * -0.16;
      mesh.scale.set(w * flip, h, 1);
      mesh.renderOrder = -4;
      this.act4Group.add(mesh);
      this.act4ScrollingProps.push({
        mesh,
        x,
        y,
        z,
        speedMult: 0.78,
        spanZ: midSpanZ,
        wrapZ: 28,
      });
      if (i < 2) this.warmupTargets.push(mesh);
    }

    const farCount = 14;
    const farSpanZ = (farCount / 2) * 40;
    for (let i = 0; i < farCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const rA = ((i * 61 + 29) % 100) / 100;
      const rB = ((i * 89 + 11) % 100) / 100;
      const useB = (i + 1) % 2 === 0;
      const mat = useB ? this.act4FarBastionMatB : this.act4FarBastionMatA;
      const x = side * (78 + rA * 34);
      const w = 48 + rB * 15;
      const h = w * 1.5;
      const y = -18.5 + h * 0.5;
      const z = -pairIdx * 40 - rA * 16 - 10;
      const flip = i % 2 === 0 ? -1 : 1;
      const mesh = new THREE.Mesh(unitPlaneGeo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = side * -0.18;
      mesh.scale.set(w * flip, h, 1);
      mesh.renderOrder = -4;
      this.act4Group.add(mesh);
      this.act4ScrollingProps.push({
        mesh,
        x,
        y,
        z,
        speedMult: 0.52,
        spanZ: farSpanZ,
        wrapZ: 30,
      });
      if (i < 2) this.warmupTargets.push(mesh);
    }

    const coneGeo = new THREE.CylinderGeometry(4.4, 0.28, 44, 16, 1, true);
    coneGeo.translate(0, 22, 0);

    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const baseX = side * (22 + (pairIdx % 2) * 6);
      const baseZ = -26 - pairIdx * 36;
      const mat = this.createVolumetricBeamMaterial(
        i % 3 === 0 ? 0xff4757 : 0xffaa3b,
        0.22,
        true
      );
      const cone = new THREE.Mesh(coneGeo, mat);
      cone.position.set(baseX, -11.4, baseZ);
      cone.renderOrder = -3;
      this.act4Group.add(cone);
      this.warmupTargets.push(cone);
      this.searchlights.push({
        mesh: cone,
        baseX,
        baseZ,
        side,
        phase: i * 1.15,
        speed: 0.75 + (i % 3) * 0.25,
      });
    }

    const emberGeo = new THREE.BoxGeometry(0.14, 0.14, 1.0);
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      toneMapped: false,
    });
    this.act4EmberInst = new THREE.InstancedMesh(emberGeo, emberMat, ACT4_EMBER_COUNT);
    this.act4EmberInst.name = 'Act4FurnaceEmbers';
    this.act4EmberInst.frustumCulled = false;
    const moltenAmber = new THREE.Color(0xffaa3b);
    const crimsonSpark = new THREE.Color(0xff4757);

    for (let i = 0; i < ACT4_EMBER_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const r1 = ((i * 53 + 11) % 100) / 100;
      const r2 = ((i * 79 + 29) % 100) / 100;
      const r3 = ((i * 31 + 61) % 100) / 100;
      const baseY = -10.8 + r2 * 16.0;
      const state: CorridorStreakState = {
        x: side * (15.5 + r1 * 24.0),
        y: baseY,
        baseY,
        z: -r3 * 255 + 18,
        speedMult: 0.85 + r2 * 0.65,
        length: 1.4 + r3 * 2.4,
        vy: 1.8 + r1 * 2.6,
        bobPhase: r2 * Math.PI * 2,
      };
      this.act4Embers.push(state);
      this.dummy.position.set(state.x, state.y, state.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, state.length);
      this.dummy.updateMatrix();
      this.act4EmberInst.setMatrixAt(i, this.dummy.matrix);
      this.act4EmberInst.setColorAt(i, i % 3 === 0 ? crimsonSpark : moltenAmber);
    }
    this.act4EmberInst.instanceMatrix.needsUpdate = true;
    if (this.act4EmberInst.instanceColor) this.act4EmberInst.instanceColor.needsUpdate = true;
    this.act4Group.add(this.act4EmberInst);
    this.warmupTargets.push(this.act4EmberInst);
  }

  private createCrossedStreakGeometry(): THREE.BufferGeometry {
    const p1 = new THREE.PlaneGeometry(1, 1);
    const p2 = new THREE.PlaneGeometry(1, 1);
    p2.rotateY(Math.PI * 0.5);
    p1.rotateX(Math.PI * 0.5);
    p2.rotateX(Math.PI * 0.5);

    const pos1 = p1.attributes.position.array as Float32Array;
    const pos2 = p2.attributes.position.array as Float32Array;
    const uv1 = p1.attributes.uv.array as Float32Array;
    const uv2 = p2.attributes.uv.array as Float32Array;
    const idx1 = p1.index!.array;
    const idx2 = p2.index!.array;

    const positions = new Float32Array(pos1.length + pos2.length);
    positions.set(pos1, 0);
    positions.set(pos2, pos1.length);

    const uvs = new Float32Array(uv1.length + uv2.length);
    uvs.set(uv1, 0);
    uvs.set(uv2, uv1.length);

    const vOffset = pos1.length / 3;
    const indices = new Uint16Array(idx1.length + idx2.length);
    indices.set(idx1, 0);
    for (let i = 0; i < idx2.length; i++) {
      indices[idx1.length + i] = idx2[i] + vOffset;
    }

    p1.dispose();
    p2.dispose();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }

  private createFacetedAsteroidGeometry(): THREE.BufferGeometry {
    const base = new THREE.IcosahedronGeometry(1.0, 1);
    const pos = base.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        Math.sin(v.x * 3.7 + v.y * 2.3) * 0.16 +
        Math.cos(v.z * 4.1 - v.x * 1.9) * 0.14;
      v.multiplyScalar(1.0 + n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    base.computeVertexNormals();
    return base;
  }

  private createCrystalClusterGeometry(): THREE.BufferGeometry {
    const shard = new THREE.ConeGeometry(0.32, 2.3, 5);
    shard.translate(0, 0.9, 0);
    return shard;
  }

  private initDustParticles(): void {
    const dustColor = DUST_ACT_COLORS[0];
    for (let i = 0; i < DUST_COUNT; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const rA = ((i * 37 + 11) % 100) / 100;
      const rB = ((i * 13 + 29) % 100) / 100;
      const rC = ((i * 29 + 41) % 100) / 100;
      const rD = ((i * 53 + 7) % 100) / 100;
      const isFastNeedle = i % 5 >= 3;
      const radius = isFastNeedle ? 10 + rA * 24 : 14 + rA * 44;
      const x = Math.cos(angle) * radius * 1.25;
      const y = Math.sin(angle) * radius * 0.72;
      const z = -((i * 19) % 210) + 18;
      const speedMult = isFastNeedle ? 1.45 + rB * 0.90 : 0.55 + rB * 0.40;
      const thickness = isFastNeedle ? 0.042 + rC * 0.036 : 0.055 + rC * 0.055;
      const baseLength = isFastNeedle ? 1.7 + rD * 2.1 : 0.8 + rD * 1.0;

      this.dustParticles.push({
        x,
        y,
        z,
        speedMult,
        thickness,
        baseLength,
      });
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(thickness, thickness, baseLength);
      this.dummy.updateMatrix();
      this.dustInst.setMatrixAt(i, this.dummy.matrix);
      this.dustInst.setColorAt(i, dustColor);
    }
    this.dustInst.instanceMatrix.needsUpdate = true;
    if (this.dustInst.instanceColor) this.dustInst.instanceColor.needsUpdate = true;
  }

  private advanceScrollingProps(
    props: ScrollingMatteProp[],
    dt: number,
    elapsed: number,
    speed: number
  ): void {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      prop.z += speed * prop.speedMult * dt;
      if (prop.z > prop.wrapZ) {
        prop.z -= prop.spanZ;
      }
      prop.mesh.position.z = prop.z;
      if (prop.baseY !== undefined && prop.bobAmp) {
        prop.mesh.position.y =
          prop.baseY + Math.sin(elapsed * 0.95 + (prop.bobPhase ?? 0)) * prop.bobAmp;
      }
      if (prop.spinZ) {
        prop.mesh.rotation.z += prop.spinZ * dt;
      }
    }
  }

  private advanceCorridorStreaks(
    streaks: CorridorStreakState[],
    inst: THREE.InstancedMesh,
    dt: number,
    elapsed: number,
    speed: number,
    wrapZ: number,
    spanZ: number
  ): void {
    for (let i = 0; i < streaks.length; i++) {
      const tr = streaks[i];
      tr.z += speed * tr.speedMult * dt;
      if (tr.z > wrapZ) {
        tr.z -= spanZ;
        if (tr.vy) tr.y = tr.baseY;
      }
      if (tr.vy) {
        tr.y += tr.vy * dt;
        if (tr.y > 16) tr.y = tr.baseY;
      } else if (tr.bobPhase !== undefined) {
        tr.y = tr.baseY + Math.sin(elapsed * 1.3 + tr.bobPhase) * 0.25;
      }
      this.dummy.position.set(tr.x, tr.y, tr.z);
      this.dummy.rotation.set(0, 0, 0);
      const th = tr.thickness ?? 1;
      this.dummy.scale.set(th, th, tr.length);
      this.dummy.updateMatrix();
      inst.setMatrixAt(i, this.dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  private updateAct1(dt: number, elapsed: number, speed: number): void {
    this.advanceCorridorStreaks(
      this.act1Slipstreams,
      this.act1SlipstreamInst,
      dt,
      elapsed,
      speed,
      24,
      270
    );
  }

  private updateAct2Metropolis(dt: number, elapsed: number, speed: number): void {
    this.cloudSeaMat.uniforms.uTime.value = elapsed;
    this.cloudSeaMat.uniforms.uScrollZ.value = this.scrollDistance;
    this.terraceDeckMat.uniforms.uTime.value = elapsed;
    this.terraceDeckMat.uniforms.uScrollZ.value = this.scrollDistance;

    // Scroll 2K PBR highway textures seamlessly at exact 1:1 world speed (12 tiles across 290m plane)
    const highwayUvOffset = (this.scrollDistance * 12) / 290;
    for (let i = 0; i < this.highwayPbrTextures.length; i++) {
      this.highwayPbrTextures[i].offset.y = highwayUvOffset % 1;
    }

    // Scroll terrace support pylons
    for (let i = 0; i < ACT2_METRO_PYLON_COUNT; i++) {
      this.pylonZ[i] += speed * dt;
      if (this.pylonZ[i] > 28) {
        this.pylonZ[i] -= 280;
      }
      const side = i % 2 === 0 ? -1 : 1;
      this.dummy.position.set(side * 25.5, -16.0, this.pylonZ[i]);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.pylonInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.pylonInst.instanceMatrix.needsUpdate = true;

    this.advanceScrollingProps(this.metroScrollingProps, dt, elapsed, speed);
    this.advanceCorridorStreaks(this.metroTraffic, this.metroTrafficInst, dt, elapsed, speed, 24, 270);
  }

  private updateAct3Nebula(dt: number, elapsed: number, speed: number): void {
    this.megalithMat.uniforms.uTime.value = elapsed;
    this.plasmaRiverMat.uniforms.uTime.value = elapsed;
    this.plasmaRiverMat.uniforms.uScrollZ.value = this.scrollDistance;

    const rockSpeed = speed * 0.85;
    for (let i = 0; i < ACT3_DEBRIS_COUNT; i++) {
      const m = this.megaliths[i];
      m.z += rockSpeed * dt;
      if (m.z > 28) {
        m.z -= 260;
      }
      m.rotX += m.spinX * dt;
      m.rotY += m.spinY * dt;
      m.rotZ += m.spinZ * dt;
      const bobY = m.y + Math.sin(elapsed * 1.1 + m.bobPhase) * m.bobAmp;

      this.dummy.position.set(m.x, bobY, m.z);
      this.dummy.rotation.set(m.rotX, m.rotY, m.rotZ);
      this.dummy.scale.set(m.scaleX, m.scaleY, m.scaleZ);
      this.dummy.updateMatrix();
      this.megalithInst.setMatrixAt(i, this.dummy.matrix);

      this.dummy.scale.setScalar(m.crystalScale);
      this.dummy.updateMatrix();
      this.crystalShardInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.megalithInst.instanceMatrix.needsUpdate = true;
    this.crystalShardInst.instanceMatrix.needsUpdate = true;

    this.advanceScrollingProps(this.act3ScrollingProps, dt, elapsed, speed);
    this.advanceCorridorStreaks(this.act3Streaks, this.act3StreakInst, dt, elapsed, speed, 24, 270);
  }

  private updateAct4Citadel(dt: number, elapsed: number, speed: number): void {
    // Scroll 2K PBR dreadnought hull textures at exact 1:1 world speed (7 tiles across 290m deck)
    const hullUvOffset = (this.scrollDistance * 7) / 290;
    for (let i = 0; i < this.act4HullPbrTextures.length; i++) {
      this.act4HullPbrTextures[i].offset.y = hullUvOffset % 1;
    }

    this.advanceScrollingProps(this.act4ScrollingProps, dt, elapsed, speed);
    this.advanceCorridorStreaks(this.act4Embers, this.act4EmberInst, dt, elapsed, speed, 24, 270);

    // Sweep searchlight cones upward and across the trench
    for (const s of this.searchlights) {
      s.mesh.position.set(s.baseX, -11.4, s.baseZ);
      const t = elapsed * s.speed + s.phase;
      s.mesh.rotation.z = -s.side * (0.26 + Math.sin(t) * 0.24);
      s.mesh.rotation.x = Math.cos(t * 0.85) * 0.22;
    }
  }

  private updateDustParticles(dt: number, speed: number): void {
    if (!this.dustInst.visible) return;

    const stretch = THREE.MathUtils.clamp(speed / 26, 0.75, 3.6);
    const tint = DUST_ACT_COLORS[Math.max(0, Math.min(3, this.currentAct - 1))];

    for (let i = 0; i < DUST_COUNT; i++) {
      const p = this.dustParticles[i];
      p.z += speed * 1.45 * p.speedMult * dt;
      if (p.z > 22) {
        p.z -= 215;
      }
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(p.thickness, p.thickness, p.baseLength * stretch);
      this.dummy.updateMatrix();
      this.dustInst.setMatrixAt(i, this.dummy.matrix);
      this.dustInst.setColorAt(i, tint);
    }
    this.dustInst.instanceMatrix.needsUpdate = true;
    if (this.dustInst.instanceColor) this.dustInst.instanceColor.needsUpdate = true;
  }
}
