import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type EnvMode = 'boot' | 'hangar' | 'combat';

type VistaKey = 'hangar' | 'act1' | 'act2' | 'act3';

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

interface SpireState {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotY: number;
}

interface RibState {
  x: number;
  y: number;
  z: number;
  side: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
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
    zenith: new THREE.Color(0x103870),
    mid: new THREE.Color(0x216ba8),
    horizon: new THREE.Color(0xf2b968),
    nadir: new THREE.Color(0x1b4e75),
    auroraA: new THREE.Color(0x5ae6ff),
    auroraB: new THREE.Color(0xffbd59),
    sunColor: new THREE.Color(0xffe7b8),
    starIntensity: 0.55,
    auroraIntensity: 0.45,
  },
  act2: {
    zenith: new THREE.Color(0x17144d),
    mid: new THREE.Color(0x2d297a),
    horizon: new THREE.Color(0x28d6bd),
    nadir: new THREE.Color(0x162d59),
    auroraA: new THREE.Color(0x34f5c5),
    auroraB: new THREE.Color(0xc084fc),
    sunColor: new THREE.Color(0xb8fff0),
    starIntensity: 1.0,
    auroraIntensity: 0.85,
  },
  act3: {
    zenith: new THREE.Color(0x38111a),
    mid: new THREE.Color(0x7d211d),
    horizon: new THREE.Color(0xff9238),
    nadir: new THREE.Color(0x361214),
    auroraA: new THREE.Color(0xffc857),
    auroraB: new THREE.Color(0xff4757),
    sunColor: new THREE.Color(0xffd480),
    starIntensity: 0.6,
    auroraIntensity: 0.75,
  },
};

const DUST_COUNT = 240;
const ACT2_MEGALITH_COUNT = 48;
const ACT1_SPIRE_COUNT = 56;
const ACT1_PYLON_COUNT = 28;
const ACT3_RIB_COUNT = 32;

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
  uniform float uTexMix;
  uniform float uBrightness;
  uniform float uEdgeFeather;
  uniform float uVertFeatherTop;
  uniform float uVertFeatherBottom;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    // Flip horizontal UV because BackSide cylinder faces inward toward -Z
    vec2 texUv = vec2(1.0 - vUv.x, vUv.y);
    vec3 colA = texture2D(uTexA, texUv).rgb;
    vec3 colB = texture2D(uTexB, texUv).rgb;
    vec3 vista = mix(colA, colB, uTexMix) * uBrightness;

    float hMask = smoothstep(0.0, uEdgeFeather, vUv.x) * smoothstep(1.0, 1.0 - uEdgeFeather, vUv.x);
    float vMask = smoothstep(0.0, uVertFeatherBottom, vUv.y) * smoothstep(1.0, 1.0 - uVertFeatherTop, vUv.y);
    float alpha = clamp(hMask * vMask * uOpacity, 0.0, 1.0);
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
    float distX = smoothstep(205.0, 95.0, abs(vWorldXZ.x));
    float distZ = smoothstep(-275.0, -145.0, vWorldXZ.y) * smoothstep(42.0, 12.0, vWorldXZ.y);
    float alpha = clamp(distX * distZ, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec2 p = vec2(vWorldXZ.x * 0.022, (vWorldXZ.y - uScrollZ * 0.52) * 0.022);
    float base = fbm2(p + vec2(uTime * 0.025, 0.0));
    float detail = fbm2Detail(p * 2.35 - vec2(uTime * 0.04, uTime * 0.015));
    float cloud = smoothstep(0.28, 0.82, base * 0.68 + detail * 0.32);

    vec3 deepTrough = vec3(0.09, 0.25, 0.44);
    vec3 midCloud = vec3(0.26, 0.56, 0.78);
    vec3 sunlitCrest = vec3(0.95, 0.79, 0.56);
    vec3 col = mix(deepTrough, midCloud, smoothstep(0.0, 0.58, cloud));
    col = mix(col, sunlitCrest, smoothstep(0.55, 0.98, cloud));

    gl_FragColor = vec4(col, alpha);
  }
`;

const HIGHWAY_DECK_VERT = `
  varying vec2 vLocalXZ;
  varying float vWorldZ;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vLocalXZ = position.xz;
    vWorldZ = worldPos.z;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const HIGHWAY_DECK_FRAG = `
  uniform float uTime;
  uniform float uScrollZ;
  varying vec2 vLocalXZ;
  varying float vWorldZ;

  void main() {
    float x = vLocalXZ.x;
    float z = vLocalXZ.y - uScrollZ;

    // Metallic deck plating seams
    float crossRib = smoothstep(0.92, 0.99, abs(sin(z * 0.392699)));
    float panelGrid = smoothstep(0.96, 1.0, abs(sin(x * 1.15))) * 0.4;
    vec3 baseMetal = vec3(0.08, 0.14, 0.23) + vec3(0.06, 0.12, 0.18) * crossRib + vec3(0.04) * panelGrid;

    // Center & outer glowing cyan lane guides
    float centerSplit = smoothstep(0.28, 0.06, abs(x)) * step(0.35, fract(z * 0.08));
    float laneDashL = smoothstep(0.18, 0.04, abs(x + 5.2)) * step(0.45, fract(z * 0.14));
    float laneDashR = smoothstep(0.18, 0.04, abs(x - 5.2)) * step(0.45, fract(z * 0.14));
    float shoulderL = smoothstep(0.35, 0.08, abs(x + 12.4));
    float shoulderR = smoothstep(0.35, 0.08, abs(x - 12.4));

    // Scrolling traffic pulse nodes
    float trafficA = smoothstep(0.26, 0.05, abs(x + 8.6)) * pow(max(1e-4, sin((z - uTime * 38.0) * 0.35)), 12.0);
    float trafficB = smoothstep(0.26, 0.05, abs(x - 8.6)) * pow(max(1e-4, sin((z + uTime * 32.0) * 0.35)), 12.0);
    float trafficC = smoothstep(0.22, 0.04, abs(x + 2.6)) * pow(max(1e-4, sin((z - uTime * 46.0) * 0.42)), 14.0);
    float trafficD = smoothstep(0.22, 0.04, abs(x - 2.6)) * pow(max(1e-4, sin((z + uTime * 40.0) * 0.42)), 14.0);

    vec3 cyanGlow = vec3(0.05, 0.92, 1.15);
    vec3 amberGlow = vec3(1.25, 0.78, 0.25);

    vec3 col = baseMetal;
    col += cyanGlow * (centerSplit * 0.85 + (laneDashL + laneDashR) * 0.95 + (shoulderL + shoulderR) * 0.9);
    col += amberGlow * (trafficA + trafficC) * 1.1;
    col += cyanGlow * (trafficB + trafficD) * 1.1;

    float farFade = smoothstep(-255.0, -165.0, vWorldZ);
    vec3 horizonHaze = vec3(0.26, 0.58, 0.78);
    col = mix(horizonHaze, col, farFade);

    gl_FragColor = vec4(col, farFade);
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

    // Sci-fi armored deck plating grid + micro sub-panel seams
    vec2 bayCoord = vec2(vLocalPos.x * 0.28, z * 0.14);
    vec2 bayCell = floor(bayCoord);
    vec2 bayF = fract(bayCoord);
    float plateTone = 0.86 + 0.26 * hash21(bayCell);

    float baySeam = min(
      smoothstep(0.0, 0.045, bayF.x) * smoothstep(1.0, 0.955, bayF.x),
      smoothstep(0.0, 0.045, bayF.y) * smoothstep(1.0, 0.955, bayF.y)
    );
    vec2 subF = fract(bayCoord * 2.0);
    float subSeam = min(
      smoothstep(0.0, 0.035, subF.x) * smoothstep(1.0, 0.965, subF.x),
      smoothstep(0.0, 0.035, subF.y) * smoothstep(1.0, 0.965, subF.y)
    );

    float isTop = step(0.5, n.y);
    vec3 sunDir = normalize(vec3(0.28, 0.65, -0.71));
    float diff = max(0.0, dot(n, sunDir));
    vec3 metal = vec3(0.10, 0.20, 0.32) * plateTone * (0.72 + 0.28 * diff);
    metal *= mix(0.84, 1.0, baySeam) * mix(0.92, 1.0, subSeam);
    metal += vec3(0.05, 0.14, 0.22) * (1.0 - baySeam);

    // Recessed structural maintenance channel along terrace spine
    float conduit = smoothstep(0.95, 0.15, abs(abs(vLocalPos.x) - 5.8));
    float ribTick = step(0.42, fract(z * 0.25));
    metal = mix(metal, metal * 0.72 + vec3(0.03, 0.11, 0.18) * ribTick, conduit * 0.65 * isTop);

    // Flowing cyan inner/outer edge rails & subtle amber data pulses
    float innerBorder = smoothstep(0.52, 0.08, abs(abs(x) - 14.85));
    float outerBorder = smoothstep(0.58, 0.10, abs(abs(x) - 36.15));
    float flowCyan = 0.55 + 0.45 * pow(max(1e-4, sin(z * 0.32 - uTime * 7.5)), 8.0);
    float flowAmber = pow(max(1e-4, sin(z * 0.22 + uTime * 5.2)), 12.0);

    vec3 cyanLight = vec3(0.10, 0.85, 1.08);
    vec3 amberLight = vec3(1.12, 0.72, 0.24);
    vec3 col = metal;
    col += cyanLight * (innerBorder * 0.82 + outerBorder * 0.70) * flowCyan * isTop;
    col += amberLight * smoothstep(0.32, 0.05, abs(abs(vLocalPos.x) - 9.4)) * flowAmber * 0.85 * isTop;

    // Vertical outer fascia trim
    float sideRibs = smoothstep(0.88, 0.98, abs(sin(z * 0.45)));
    float sideSlit = smoothstep(0.28, 0.06, abs(vLocalPos.y - 0.18));
    vec3 fasciaCol = vec3(0.09, 0.17, 0.28) + vec3(0.06, 0.14, 0.22) * sideRibs + cyanLight * sideSlit * 0.7;
    col = mix(fasciaCol, col, isTop);

    float farFade = smoothstep(-255.0, -145.0, vWorldPos.z);
    vec3 horizonHaze = vec3(0.26, 0.58, 0.78);
    col = mix(horizonHaze, col, farFade);
    float alpha = clamp(farFade, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

const SPIRE_VERT = `
  attribute vec4 aMeta;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec4 vMeta;
  varying vec3 vInstColor;

  void main() {
    vUv = uv;
    vMeta = aMeta;
    #ifdef USE_INSTANCING_COLOR
      vInstColor = instanceColor;
    #else
      vInstColor = vec3(0.2, 0.85, 1.0);
    #endif
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SPIRE_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec4 vMeta;
  varying vec3 vInstColor;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    float nLen = length(vWorldNormal);
    vec3 n = nLen > 1e-5 ? (vWorldNormal / nLen) : vec3(0.0, 1.0, 0.0);
    vec3 sunDir = normalize(vec3(0.35, 0.55, -0.75));
    float ndl = max(0.0, dot(n, sunDir));
    float skyAmbient = 0.48 + 0.52 * max(0.0, n.y);

    vec3 hullBase = vec3(0.11, 0.19, 0.30) * skyAmbient + vec3(0.38, 0.44, 0.52) * ndl;

    // Architectural glowing window bands on vertical tower faces
    float isSide = 1.0 - abs(n.y);
    float floors = vMeta.y * 1.1;
    float cols = vMeta.x * 1.6;
    vec2 cell = floor(vec2(vUv.x * cols, vUv.y * floors));
    vec2 cellUv = fract(vec2(vUv.x * cols, vUv.y * floors));
    float lit = step(0.44, hash12(cell + vec2(vMeta.z * 17.0, vMeta.w * 23.0)));
    float windowMask = step(0.18, cellUv.x) * step(cellUv.x, 0.82) * step(0.28, cellUv.y) * step(cellUv.y, 0.72);
    float bandAccent = smoothstep(0.95, 1.0, sin(vUv.y * 18.0 + vMeta.z * 6.0));
    float pulse = 0.88 + 0.12 * sin(uTime * 1.8 + vMeta.z * 12.0);

    vec3 col = hullBase + vInstColor * isSide * (lit * windowMask * 1.15 + bandAccent * 0.75) * pulse;
    // Rooftop crown beacon
    float roofGlow = smoothstep(0.95, 1.0, vUv.y);
    col += vInstColor * roofGlow * 1.1;

    float farFade = smoothstep(-250.0, -145.0, vWorldPos.z);
    vec3 haze = vec3(0.24, 0.54, 0.76);
    col = mix(haze, col, farFade);

    gl_FragColor = vec4(col, 1.0);
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

    vec3 violet = vec3(0.45, 0.18, 0.88);
    vec3 turquoise = vec3(0.08, 0.92, 0.85);
    vec3 emeraldWhite = vec3(0.75, 1.35, 1.2);

    vec3 col = mix(violet, turquoise, smoothstep(0.2, 0.78, n1));
    col = mix(col, emeraldWhite, filament * 0.72 + coreStream * 0.45);

    float farFade = smoothstep(-265.0, -140.0, vWorldXZ.y) * smoothstep(36.0, 8.0, vWorldXZ.y);
    float alpha = clamp(bankMask * farFade * (0.45 + filament * 0.55), 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const DREADNOUGHT_FLOOR_VERT = `
  varying vec2 vWorldXZ;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const DREADNOUGHT_FLOOR_FRAG = `
  uniform float uTime;
  uniform float uScrollZ;
  varying vec2 vWorldXZ;

  float hash21(vec2 p) {
    p = fract(p * vec2(147.2, 319.8));
    p += dot(p, p + 19.7);
    return fract(p.x * p.y);
  }

  void main() {
    float x = vWorldXZ.x;
    float z = vWorldXZ.y - uScrollZ;

    // Armored hull plate grid
    vec2 tileCoord = vec2(x * 0.16, z * 0.12);
    vec2 cell = floor(tileCoord);
    vec2 f = fract(tileCoord);
    float plateTone = 0.82 + 0.36 * hash21(cell);
    float seam = min(
      smoothstep(0.0, 0.05, f.x) * smoothstep(1.0, 0.95, f.x),
      smoothstep(0.0, 0.05, f.y) * smoothstep(1.0, 0.95, f.y)
    );

    vec3 armor = vec3(0.14, 0.08, 0.09) * plateTone * (0.65 + 0.35 * seam);
    // Specular sheen from Dyson star ahead
    armor += vec3(0.32, 0.15, 0.09) * (1.0 - seam) * 0.6;

    // Central molten reactor cooling grate trench
    float inTrench = smoothstep(9.5, 6.2, abs(x));
    float grateBars = smoothstep(0.35, 0.58, abs(sin(z * 1.45)));
    float crossBars = smoothstep(0.25, 0.52, abs(sin(x * 1.25)));
    float opening = (1.0 - grateBars * 0.72) * (1.0 - crossBars * 0.35);

    float heatWave = 0.72 + 0.28 * sin(z * 0.25 - uTime * 3.8 + x * 0.4);
    vec3 molten = mix(vec3(1.15, 0.22, 0.08), vec3(1.65, 0.92, 0.24), heatWave * opening);
    vec3 col = mix(armor, armor * 0.45 + molten * opening * 1.25, inTrench);

    // Side crimson runway warning rails
    float railGlow = smoothstep(0.45, 0.08, abs(abs(x) - 12.2));
    col += vec3(1.2, 0.26, 0.22) * railGlow * (0.65 + 0.35 * sin(z * 0.4 - uTime * 4.5));

    float sideFade = smoothstep(72.0, 34.0, abs(x));
    float farFade = smoothstep(-255.0, -145.0, vWorldXZ.y);
    col = mix(vec3(0.48, 0.15, 0.12), col, farFade);
    float alpha = clamp(sideFade * farFade, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

const DREADNOUGHT_RIB_VERT = `
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vLocalPos = position;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = (modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const DREADNOUGHT_RIB_FRAG = `
  uniform float uTime;
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(153.7, 291.3));
    p += dot(p, p + 27.9);
    return fract(p.x * p.y);
  }

  void main() {
    float nLen = length(vWorldNormal);
    vec3 n = nLen > 1e-5 ? (vWorldNormal / nLen) : vec3(0.0, 1.0, 0.0);
    vec3 sunDir = normalize(vec3(0.18, 0.35, -0.92));
    float ndl = max(0.0, dot(n, sunDir));
    float skyFill = 0.34 + 0.52 * max(0.0, n.y);
    float moltenBounce = max(0.0, -n.y) * 0.45 + max(0.0, 1.0 - abs(n.y)) * 0.18;

    vec3 camDelta = cameraPosition - vWorldPos;
    float camLen = length(camDelta);
    vec3 viewDir = camLen > 1e-5 ? (camDelta / camLen) : vec3(0.0, 0.0, 1.0);
    float rimBase = clamp(1.0 - abs(dot(n, viewDir)), 0.0, 1.0);
    float rim = pow(max(1e-4, rimBase), 2.8);

    // Fine multi-panel armored plating seams
    vec2 plateUv = vec2(vLocalPos.z * 3.8 + vLocalPos.x * 2.4, vLocalPos.y * 8.5);
    vec2 plateCell = floor(plateUv);
    vec2 plateF = fract(plateUv);
    float plateTone = 0.82 + 0.34 * hash21(plateCell);
    float seam = min(
      smoothstep(0.0, 0.06, plateF.x) * smoothstep(1.0, 0.94, plateF.x),
      smoothstep(0.0, 0.06, plateF.y) * smoothstep(1.0, 0.94, plateF.y)
    );

    vec3 steelBase = vec3(0.14, 0.14, 0.18) * plateTone * skyFill
                   + vec3(0.38, 0.24, 0.17) * ndl
                   + vec3(0.55, 0.19, 0.07) * moltenBounce;
    steelBase *= mix(0.68, 1.0, seam);
    steelBase += vec3(0.24, 0.30, 0.38) * rim * 0.48;

    // Fine recessed louver vents in mid-core + hairline cyan/amber indicator slits
    float inMidBay = smoothstep(0.21, 0.26, vLocalPos.y) * (1.0 - smoothstep(0.68, 0.73, vLocalPos.y));
    float louver = smoothstep(0.92, 0.99, abs(sin(vLocalPos.z * 26.0))) * inMidBay;
    float ventSlit = smoothstep(0.955, 0.992, abs(sin(vLocalPos.y * 28.0))) * inMidBay * step(0.35, hash21(plateCell + vec2(3.1, 7.4)));
    float eaveLine = smoothstep(0.03, 0.0, abs(vLocalPos.y - 0.78)) * step(0.15, fract(vLocalPos.z * 3.2));

    float pulse = 0.78 + 0.22 * sin(uTime * 2.8 + vWorldPos.z * 0.2 + vLocalPos.z * 4.0);
    vec3 col = steelBase;
    col += vec3(1.15, 0.46, 0.14) * ventSlit * pulse * 0.75;
    col += vec3(0.18, 0.78, 0.98) * (eaveLine * 0.72 + louver * 0.16);

    float farFade = smoothstep(-255.0, -140.0, vWorldPos.z);
    col = mix(vec3(0.45, 0.16, 0.13), col, farFade);
    gl_FragColor = vec4(col, 1.0);
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

  private readonly skySphere: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly cyclorama: THREE.Mesh;
  private readonly cycloramaMat: THREE.ShaderMaterial;
  private readonly dustInst: THREE.InstancedMesh;
  private readonly dustMat: THREE.ShaderMaterial;
  private readonly ambientFillLight: THREE.HemisphereLight;

  private readonly volumetricBeams: THREE.ShaderMaterial[] = [];
  private readonly searchlights: SearchlightState[] = [];

  private cloudSeaMat!: THREE.ShaderMaterial;
  private highwayDeckMat!: THREE.ShaderMaterial;
  private terraceDeckMat!: THREE.ShaderMaterial;
  private spireMat!: THREE.ShaderMaterial;
  private spireInst!: THREE.InstancedMesh;
  private pylonInst!: THREE.InstancedMesh;
  private readonly spires: SpireState[] = [];
  private readonly pylonZ: number[] = [];

  private megalithMat!: THREE.ShaderMaterial;
  private megalithInst!: THREE.InstancedMesh;
  private crystalShardInst!: THREE.InstancedMesh;
  private plasmaRiverMat!: THREE.ShaderMaterial;
  private readonly megaliths: MegalithState[] = [];

  private dreadnoughtFloorMat!: THREE.ShaderMaterial;
  private dreadnoughtRibMat!: THREE.ShaderMaterial;
  private dreadnoughtRibInst!: THREE.InstancedMesh;
  private readonly ribs: RibState[] = [];

  private hangarVistaMesh!: THREE.Mesh;
  private hangarVistaMat!: THREE.MeshBasicMaterial;
  private hangarDeckMat!: THREE.MeshPhysicalMaterial;
  private hangarSideDeckMat!: THREE.MeshPhysicalMaterial;
  private hangarCeilingMat!: THREE.MeshBasicMaterial;
  private hangarBulkheadMat!: THREE.MeshBasicMaterial;
  private readonly hangarParallaxGroup = new THREE.Group();

  private hangarVideoEl: HTMLVideoElement | null = null;
  private hangarVideoTex: THREE.VideoTexture | null = null;
  private hangarVideoReady = false;
  private hangarVideoUnlockHandler: (() => void) | null = null;

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
  private cycloramaYOffset = -16;

  private currentZenith = new THREE.Color().copy(SKY_PALETTES.hangar.zenith);
  private currentMid = new THREE.Color().copy(SKY_PALETTES.hangar.mid);
  private currentHorizon = new THREE.Color().copy(SKY_PALETTES.hangar.horizon);
  private currentNadir = new THREE.Color().copy(SKY_PALETTES.hangar.nadir);
  private currentAuroraA = new THREE.Color().copy(SKY_PALETTES.hangar.auroraA);
  private currentAuroraB = new THREE.Color().copy(SKY_PALETTES.hangar.auroraB);
  private currentSun = new THREE.Color().copy(SKY_PALETTES.hangar.sunColor);
  private currentStarIntensity = SKY_PALETTES.hangar.starIntensity;
  private currentAuroraIntensity = SKY_PALETTES.hangar.auroraIntensity;

  private readonly warmupTargets: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.envRoot.name = 'EnvironmentSystemRoot';
    this.hangarGroup.name = 'EnvHangarBay';
    this.act1Group.name = 'EnvAct1Metropolis';
    this.act2Group.name = 'EnvAct2Nebula';
    this.act3Group.name = 'EnvAct3Citadel';

    this.fallbackTextures = {
      hangar: createFallbackTexture(0x28679e),
      act1: createFallbackTexture(0x3a7ca5),
      act2: createFallbackTexture(0x2d488f),
      act3: createFallbackTexture(0x8c2f24),
    };
    this.activeTextures.set('hangar', this.fallbackTextures.hangar);
    this.activeTextures.set('act1', this.fallbackTextures.act1);
    this.activeTextures.set('act2', this.fallbackTextures.act2);
    this.activeTextures.set('act3', this.fallbackTextures.act3);

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

    // 2. Forward Curved 2K Vista Cyclorama (~155 deg horizontal FOV toward -Z)
    const thetaLength = THREE.MathUtils.degToRad(155);
    const thetaStart = Math.PI - thetaLength * 0.5;
    const cycloramaGeo = new THREE.CylinderGeometry(270, 270, 250, 48, 1, true, thetaStart, thetaLength);
    this.cycloramaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTexA: { value: this.fallbackTextures.hangar },
        uTexB: { value: this.fallbackTextures.hangar },
        uTexMix: { value: 1.0 },
        uBrightness: { value: 0.82 },
        uEdgeFeather: { value: 0.16 },
        uVertFeatherTop: { value: 0.20 },
        uVertFeatherBottom: { value: 0.18 },
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

    // 3. Build 3D Hangar Bay & 3 Combat Biomes
    this.buildHangarBay();
    this.buildAct1Metropolis();
    this.buildAct2Nebula();
    this.buildAct3Citadel();

    // 4. Velocity-Stretched Space Dust Streaks (240 soft Gaussian streaks)
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

    this.envRoot.add(this.hangarGroup, this.act1Group, this.act2Group, this.act3Group);
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
          this.scene.environmentIntensity = 1.35;
          cleanup();
          pmrem.dispose();
        }
      } catch {
        // Safely ignore if WebGL context is unavailable in headless/mock tests
      }
    }

    // Bind loaded 2K panoramic vista textures
    const keys: VistaKey[] = ['hangar', 'act1', 'act2', 'act3'];
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
    if (sideDeckAlbedo) this.hangarSideDeckMat.map = sideDeckAlbedo;
    if (sideDeckNormal) this.hangarSideDeckMat.normalMap = sideDeckNormal;
    this.hangarSideDeckMat.needsUpdate = true;

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

    this.initHangarVideo();

    const activeTex = this.getVistaTexture(this.targetVistaKey);
    this.cycloramaMat.uniforms.uTexA.value = activeTex;
    this.cycloramaMat.uniforms.uTexB.value = activeTex;
    this.cycloramaMat.uniforms.uTexMix.value = 1.0;
    this.currentVistaKey = this.targetVistaKey;
    this.vistaBlend = 1.0;
    this.syncHangarVideoPlayback();
  }

  setMode(mode: EnvMode): void {
    this.mode = mode;
    this.syncVisibility();
    this.updateVistaTarget(mode === 'boot' || mode === 'hangar');
  }

  setAct(act: number, immediate = false): void {
    const clampedAct = Math.max(1, Math.min(3, Math.round(act)));
    this.currentAct = clampedAct;
    this.syncVisibility();
    this.updateVistaTarget(immediate);
  }

  update(dt: number, elapsed: number, scrollSpeed: number, camera: THREE.Camera): void {
    if (this.disposed) return;
    const safeDt = Math.min(0.1, Math.max(0, dt));
    const speed = Number.isFinite(scrollSpeed) ? scrollSpeed : 0;
    this.scrollDistance += speed * safeDt;

    // Keep sky dome locked on camera and cyclorama centered toward -Z ahead of camera
    this.skySphere.position.copy(camera.position);
    const desiredOffset = this.mode === 'hangar' ? -20 : -10;
    this.cycloramaYOffset = THREE.MathUtils.lerp(
      this.cycloramaYOffset,
      desiredOffset,
      Math.min(1, safeDt * 5.0)
    );
    this.cyclorama.position.set(
      camera.position.x,
      camera.position.y + this.cycloramaYOffset,
      camera.position.z
    );

    // Smooth sky palette and vista crossfade transitions
    this.lerpSkyPalette(safeDt);
    if (this.vistaBlend < 1.0) {
      this.vistaBlend = Math.min(1.0, this.vistaBlend + safeDt * 2.2);
      this.cycloramaMat.uniforms.uTexMix.value = this.vistaBlend;
      if (this.vistaBlend >= 1.0) {
        this.currentVistaKey = this.targetVistaKey;
      }
    }

    this.skyMat.uniforms.uTime.value = elapsed;
    this.skyMat.uniforms.uScroll.value = this.scrollDistance;

    for (const beamMat of this.volumetricBeams) {
      beamMat.uniforms.uTime.value = elapsed;
    }

    if (this.mode === 'hangar' || this.mode === 'boot') {
      this.hangarParallaxGroup.position.set(0, 0, 0);
      this.hangarVistaMesh.position.x = Math.sin(elapsed * 0.14) * 0.18;
    }

    if (this.mode === 'combat') {
      if (this.currentAct === 1) {
        this.updateAct1(safeDt, elapsed, speed);
      } else if (this.currentAct === 2) {
        this.updateAct2(safeDt, elapsed, speed);
      } else {
        this.updateAct3(safeDt, elapsed, speed);
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

    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const tex of Object.values(this.fallbackTextures)) tex.dispose();
    this.activeTextures.clear();
    this.warmupTargets.length = 0;
  }

  private getVistaTexture(key: VistaKey): THREE.Texture {
    return this.activeTextures.get(key) ?? this.fallbackTextures[key];
  }

  private resolveTargetVistaKey(): VistaKey {
    if (this.mode === 'hangar' || this.mode === 'boot') return 'hangar';
    if (this.currentAct === 2) return 'act2';
    if (this.currentAct === 3) return 'act3';
    return 'act1';
  }

  private updateVistaTarget(immediate: boolean): void {
    const nextKey = this.resolveTargetVistaKey();
    const palette = SKY_PALETTES[nextKey];

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
      this.syncPaletteUniforms();

      const tex = this.getVistaTexture(nextKey);
      this.cycloramaMat.uniforms.uTexA.value = tex;
      this.cycloramaMat.uniforms.uTexB.value = tex;
      this.cycloramaMat.uniforms.uTexMix.value = 1.0;
      this.currentVistaKey = nextKey;
      this.targetVistaKey = nextKey;
      this.vistaBlend = 1.0;
      this.cycloramaYOffset = this.mode === 'hangar' ? -20 : -10;
      return;
    }

    if (nextKey !== this.targetVistaKey) {
      const fromKey = this.vistaBlend >= 0.5 ? this.targetVistaKey : this.currentVistaKey;
      const fromTex = this.getVistaTexture(fromKey);
      const toTex = this.getVistaTexture(nextKey);
      this.currentVistaKey = fromKey;
      this.cycloramaMat.uniforms.uTexA.value = fromTex;
      this.cycloramaMat.uniforms.uTexB.value = toTex;
      this.cycloramaMat.uniforms.uTexMix.value = 0.0;
      this.targetVistaKey = nextKey;
      this.vistaBlend = 0.0;
    }
  }

  private lerpSkyPalette(dt: number): void {
    const target = SKY_PALETTES[this.resolveTargetVistaKey()];
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
    this.syncPaletteUniforms();
  }

  private syncPaletteUniforms(): void {
    this.skyMat.uniforms.uStarIntensity.value = this.currentStarIntensity;
    this.skyMat.uniforms.uAuroraIntensity.value = this.currentAuroraIntensity;
    this.ambientFillLight.color.copy(this.currentHorizon);
    this.ambientFillLight.groundColor.copy(this.currentNadir);
  }

  private syncVisibility(): void {
    const isHangar = this.mode === 'hangar' || this.mode === 'boot';
    this.hangarGroup.visible = isHangar;
    this.cyclorama.visible = !isHangar;
    this.act1Group.visible = this.mode === 'combat' && this.currentAct === 1;
    this.act2Group.visible = this.mode === 'combat' && this.currentAct === 2;
    this.act3Group.visible = this.mode === 'combat' && this.currentAct === 3;
    this.dustInst.visible = this.mode === 'combat';
    this.syncHangarVideoPlayback();
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
      };
      this.hangarVideoUnlockHandler = unlockVideo;
      window.addEventListener('pointerdown', unlockVideo, { passive: true });
      window.addEventListener('keydown', unlockVideo, { passive: true });
    }
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
    this.hangarDeckMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.72,
      roughness: 0.9,
      clearcoat: 0.48,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.4,
      normalScale: new THREE.Vector2(1.2, 1.2),
      emissive: new THREE.Color(0x9befff),
      emissiveIntensity: 1.45,
    });

    this.hangarSideDeckMat = new THREE.MeshPhysicalMaterial({
      color: 0xd6e1ee,
      metalness: 0.76,
      roughness: 0.38,
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.32,
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
    fwdApronMesh.receiveShadow = true;

    const sideWingGeo = new THREE.PlaneGeometry(24.0, 23.4, 1, 1);
    sideWingGeo.rotateX(-Math.PI * 0.5);
    const sideWingL = new THREE.Mesh(sideWingGeo, this.hangarSideDeckMat);
    sideWingL.position.set(-18.6, -1.722, -5.0);
    sideWingL.receiveShadow = true;

    const sideWingR = new THREE.Mesh(sideWingGeo, this.hangarSideDeckMat);
    sideWingR.position.set(18.6, -1.722, -5.0);
    sideWingR.receiveShadow = true;

    this.hangarGroup.add(centerDeckMesh, fwdApronMesh, sideWingL, sideWingR);
    this.warmupTargets.push(centerDeckMesh, sideWingL);

    // 3. Wall-to-Wall Recessed Expansion Seam, Launch Trench Rails & Observation Lip (zero abrupt joints)
    const trimMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a2639,
      metalness: 0.88,
      roughness: 0.26,
      clearcoat: 0.55,
      emissive: 0x071a2d,
      emissiveIntensity: 0.3,
    });
    const wallToWallSeam = new THREE.Mesh(new THREE.BoxGeometry(56.0, 0.036, 0.34), trimMat);
    wallToWallSeam.position.set(0, -1.708, -6.6);
    wallToWallSeam.receiveShadow = true;

    const trenchRailGeo = new THREE.BoxGeometry(0.28, 0.045, 23.4);
    for (const side of [-1, 1]) {
      const trenchRail = new THREE.Mesh(trenchRailGeo, trimMat);
      trenchRail.position.set(side * 6.62, -1.705, -5.0);
      trenchRail.receiveShadow = true;
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
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0x162133,
      metalness: 0.84,
      roughness: 0.34,
      clearcoat: 0.36,
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
      plinth.receiveShadow = true;

      const innerCornerBumper = new THREE.Mesh(bumperWedgeGeo, trimMat);
      innerCornerBumper.position.set(side * 8.45, -1.56, -15.72);
      innerCornerBumper.rotation.y = side * 0.25;
      innerCornerBumper.receiveShadow = true;

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

  private buildAct1Metropolis(): void {
    // 1. Animated sunlit/cyan FBM Cloud-Sea Floor (y = -14.8)
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
    cloudSea.position.set(0, -14.8, -120);
    cloudSea.renderOrder = -20;
    this.act1Group.add(cloudSea);
    this.warmupTargets.push(cloudSea);

    // 2. Illuminated Orbital Highway Deck (y = -11.2)
    const deckGeo = new THREE.PlaneGeometry(28, 290, 1, 1);
    deckGeo.rotateX(-Math.PI * 0.5);
    this.highwayDeckMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScrollZ: { value: 0 },
      },
      vertexShader: HIGHWAY_DECK_VERT,
      fragmentShader: HIGHWAY_DECK_FRAG,
      transparent: true,
    });
    const highwayDeck = new THREE.Mesh(deckGeo, this.highwayDeckMat);
    highwayDeck.position.set(0, -11.2, -115);
    this.act1Group.add(highwayDeck);
    this.warmupTargets.push(highwayDeck);

    // Structural highway side guard girders
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
      this.act1Group.add(rail);
    }

    // 3. Side Structural Terraces (x = ±25.5, y = -10.2) flanking the orbital highway corridor
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
      this.act1Group.add(terrace);
      this.warmupTargets.push(terrace);
    }

    // Scrolling structural terrace pylons descending into cloud-sea
    const pylonGeo = new THREE.BoxGeometry(3.2, 10.5, 4.2);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x182b42,
      metalness: 0.75,
      roughness: 0.35,
    });
    this.pylonInst = new THREE.InstancedMesh(pylonGeo, pylonMat, ACT1_PYLON_COUNT);
    this.pylonInst.name = 'Act1TerracePylons';
    this.pylonInst.frustumCulled = false;
    for (let i = 0; i < ACT1_PYLON_COUNT; i++) {
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
    this.act1Group.add(this.pylonInst);
    this.warmupTargets.push(this.pylonInst);

    // 4. Distant Instanced Illuminated Skyline Spires (x = ±52..88)
    const spireGeo = new THREE.BoxGeometry(1, 1, 1);
    spireGeo.translate(0, 0.5, 0);
    const spireMeta = new Float32Array(ACT1_SPIRE_COUNT * 4);
    this.spireMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: SPIRE_VERT,
      fragmentShader: SPIRE_FRAG,
    });
    this.spireInst = new THREE.InstancedMesh(spireGeo, this.spireMat, ACT1_SPIRE_COUNT);
    this.spireInst.name = 'Act1SkylineSpires';
    this.spireInst.frustumCulled = false;

    const spireColors = [
      new THREE.Color(0x38bdf8),
      new THREE.Color(0xffb347),
      new THREE.Color(0x22d3ee),
      new THREE.Color(0xffd073),
    ];

    for (let i = 0; i < ACT1_SPIRE_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const randA = ((i * 73 + 19) % 100) / 100;
      const randB = ((i * 37 + 53) % 100) / 100;
      const randC = ((i * 91 + 7) % 100) / 100;

      const x = side * (52 + randA * 36);
      const z = -row * 9.5 + 22 - randB * 4.5;
      const width = 6.5 + randB * 7.5;
      const depth = 6.5 + randC * 7.5;
      const height = 28 + randA * 42;
      const rotY = (randC - 0.5) * 0.32;

      this.spires.push({ x, z, width, depth, height, rotY });

      spireMeta[i * 4] = width;
      spireMeta[i * 4 + 1] = height;
      spireMeta[i * 4 + 2] = randA;
      spireMeta[i * 4 + 3] = randB;

      this.dummy.position.set(x, -16.5, z);
      this.dummy.rotation.set(0, rotY, 0);
      this.dummy.scale.set(width, height, depth);
      this.dummy.updateMatrix();
      this.spireInst.setMatrixAt(i, this.dummy.matrix);
      this.spireInst.setColorAt(i, spireColors[i % spireColors.length]);
    }
    spireGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(spireMeta, 4));
    this.spireInst.instanceMatrix.needsUpdate = true;
    if (this.spireInst.instanceColor) this.spireInst.instanceColor.needsUpdate = true;
    this.act1Group.add(this.spireInst);
    this.warmupTargets.push(this.spireInst);
  }

  private buildAct2Nebula(): void {
    // 1. 48 Instanced Tumbling Crystal/Asteroid Megaliths (x = ±18..65, y = -16..18)
    const rockGeo = this.createFacetedAsteroidGeometry();
    const crystalGeo = this.createCrystalClusterGeometry();

    const metaData = new Float32Array(ACT2_MEGALITH_COUNT * 4);
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
      emissiveIntensity: 1.15,
      roughness: 0.16,
      metalness: 0.35,
    });

    this.megalithInst = new THREE.InstancedMesh(rockGeo, this.megalithMat, ACT2_MEGALITH_COUNT);
    this.megalithInst.name = 'Act2CrystalMegaliths';
    this.megalithInst.frustumCulled = false;

    this.crystalShardInst = new THREE.InstancedMesh(crystalGeo, crystalMat, ACT2_MEGALITH_COUNT);
    this.crystalShardInst.name = 'Act2CrystalShards';
    this.crystalShardInst.frustumCulled = false;

    const veinPalette = [
      new THREE.Color(0x2be0c8),
      new THREE.Color(0xc084fc),
      new THREE.Color(0x34d399),
      new THREE.Color(0x38bdf8),
    ];

    for (let i = 0; i < ACT2_MEGALITH_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const r1 = ((i * 59 + 13) % 100) / 100;
      const r2 = ((i * 83 + 29) % 100) / 100;
      const r3 = ((i * 41 + 61) % 100) / 100;

      const x = side * (18.5 + r1 * 46.5);
      const y = -16 + r2 * 34;
      const z = -i * 5.4 + 24;
      const baseScale = 1.65 + r3 * 2.65;

      const state: MegalithState = {
        x,
        y,
        z,
        scaleX: baseScale * (0.85 + r1 * 0.4),
        scaleY: baseScale * (0.8 + r2 * 0.5),
        scaleZ: baseScale * (0.85 + r3 * 0.45),
        rotX: r1 * Math.PI * 2,
        rotY: r2 * Math.PI * 2,
        rotZ: r3 * Math.PI * 2,
        spinX: (r1 - 0.5) * 0.55,
        spinY: (r2 - 0.5) * 0.65,
        spinZ: (r3 - 0.5) * 0.45,
        bobPhase: r1 * Math.PI * 2,
        bobAmp: 0.4 + r2 * 0.9,
        crystalScale: baseScale * (0.9 + r2 * 0.35),
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

    this.act2Group.add(this.megalithInst, this.crystalShardInst);
    this.warmupTargets.push(this.megalithInst, this.crystalShardInst);

    // 2. Scrolling Luminous Warp Plasma River Below (y = -11.5)
    const riverGeo = new THREE.PlaneGeometry(110, 300, 1, 1);
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
    riverMesh.position.set(0, -11.5, -120);
    riverMesh.renderOrder = -15;
    this.act2Group.add(riverMesh);
    this.warmupTargets.push(riverMesh);
  }

  private buildAct3Citadel(): void {
    // 1. Armored Metallic Hull Floor Deck (y = -11.5) with Molten Reactor Cooling Grates
    const hullGeo = new THREE.PlaneGeometry(150, 300, 1, 1);
    hullGeo.rotateX(-Math.PI * 0.5);
    this.dreadnoughtFloorMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScrollZ: { value: 0 },
      },
      vertexShader: DREADNOUGHT_FLOOR_VERT,
      fragmentShader: DREADNOUGHT_FLOOR_FRAG,
      transparent: true,
    });
    const hullDeck = new THREE.Mesh(hullGeo, this.dreadnoughtFloorMat);
    hullDeck.position.set(0, -11.5, -118);
    this.act3Group.add(hullDeck);
    this.warmupTargets.push(hullDeck);

    // 2. Flanking InstancedMesh Stepped Dreadnought Armored Bulkheads (x = ±25..34)
    const ribGeo = this.createSteppedBulkheadGeometry();
    this.dreadnoughtRibMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: DREADNOUGHT_RIB_VERT,
      fragmentShader: DREADNOUGHT_RIB_FRAG,
    });
    this.dreadnoughtRibInst = new THREE.InstancedMesh(
      ribGeo,
      this.dreadnoughtRibMat,
      ACT3_RIB_COUNT
    );
    this.dreadnoughtRibInst.name = 'Act3DreadnoughtRibs';
    this.dreadnoughtRibInst.frustumCulled = false;

    for (let i = 0; i < ACT3_RIB_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const r1 = ((i * 43 + 11) % 100) / 100;
      const r2 = ((i * 67 + 23) % 100) / 100;

      const x = side * (25.5 + r1 * 8.0);
      const y = -11.5;
      const z = -pairIdx * 16.5 + 22;
      const state: RibState = {
        x,
        y,
        z,
        side,
        scaleX: 5.4 + r1 * 3.4,
        scaleY: 12.5 + r2 * 6.5,
        scaleZ: 5.2 + r2 * 2.4,
        rotY: side > 0 ? Math.PI : 0,
      };
      this.ribs.push(state);

      this.dummy.position.set(state.x, state.y, state.z);
      this.dummy.rotation.set(0, state.rotY, 0);
      this.dummy.scale.set(state.scaleX, state.scaleY, state.scaleZ);
      this.dummy.updateMatrix();
      this.dreadnoughtRibInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.dreadnoughtRibInst.instanceMatrix.needsUpdate = true;
    this.act3Group.add(this.dreadnoughtRibInst);
    this.warmupTargets.push(this.dreadnoughtRibInst);

    // 3. Upward Sweeping Volumetric Searchlight Cones (narrow at deck emitter, wide upward)
    const coneGeo = new THREE.CylinderGeometry(4.4, 0.28, 44, 16, 1, true);
    coneGeo.translate(0, 22, 0);

    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const pairIdx = Math.floor(i / 2);
      const baseX = side * (22 + (pairIdx % 2) * 6);
      const baseZ = -26 - pairIdx * 36;
      const mat = this.createVolumetricBeamMaterial(
        i % 3 === 0 ? 0xff4757 : 0xffaa3b,
        0.26,
        true
      );
      const cone = new THREE.Mesh(coneGeo, mat);
      cone.position.set(baseX, -11.4, baseZ);
      this.act3Group.add(cone);
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

  private createSteppedBulkheadGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const addTier = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number
    ): void => {
      const box = new THREE.BoxGeometry(w, h, d);
      box.translate(x, y, z);
      parts.push(box);
    };

    // Multi-tier stepped armored bulkhead (+X faces inward toward trench center)
    addTier(1.22, 0.22, 1.16, -0.08, 0.11, 0.0); // Heavy base armor plinth
    addTier(0.72, 0.48, 0.86, -0.18, 0.46, 0.0); // Recessed machinery bulkhead
    addTier(0.94, 0.54, 0.18, -0.02, 0.49, 0.42); // Front vertical buttress rib
    addTier(0.94, 0.54, 0.18, -0.02, 0.49, -0.42); // Rear vertical buttress rib
    addTier(0.92, 0.16, 1.04, 0.06, 0.78, 0.0); // Inward cantilevered armor eave
    addTier(0.48, 0.14, 0.68, -0.16, 0.93, 0.0); // Upper radiator housing crest

    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (merged) return merged;

    const fallback = new THREE.BoxGeometry(1, 1, 1);
    fallback.translate(0, 0.5, 0);
    return fallback;
  }

  private initDustParticles(): void {
    const dustColor = new THREE.Color(0x9be7ff);
    for (let i = 0; i < DUST_COUNT; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const radius = 3.5 + ((i * 37) % 100) / 100 * 24;
      const x = Math.cos(angle) * radius * 1.25;
      const y = Math.sin(angle) * radius * 0.72;
      const z = -((i * 19) % 210) + 18;
      this.dustParticles.push({
        x,
        y,
        z,
        speedMult: 0.85 + ((i * 13) % 100) / 100 * 0.65,
        thickness: 0.06 + ((i * 29) % 100) / 100 * 0.08,
        baseLength: 1.1 + ((i * 53) % 100) / 100 * 1.6,
      });
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(0.08, 0.08, 2.0);
      this.dummy.updateMatrix();
      this.dustInst.setMatrixAt(i, this.dummy.matrix);
      this.dustInst.setColorAt(i, dustColor);
    }
    this.dustInst.instanceMatrix.needsUpdate = true;
    if (this.dustInst.instanceColor) this.dustInst.instanceColor.needsUpdate = true;
  }

  private updateAct1(dt: number, elapsed: number, speed: number): void {
    this.cloudSeaMat.uniforms.uTime.value = elapsed;
    this.cloudSeaMat.uniforms.uScrollZ.value = this.scrollDistance;
    this.highwayDeckMat.uniforms.uTime.value = elapsed;
    this.highwayDeckMat.uniforms.uScrollZ.value = this.scrollDistance;
    this.terraceDeckMat.uniforms.uTime.value = elapsed;
    this.terraceDeckMat.uniforms.uScrollZ.value = this.scrollDistance;
    this.spireMat.uniforms.uTime.value = elapsed;

    // Scroll terrace support pylons
    for (let i = 0; i < ACT1_PYLON_COUNT; i++) {
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

    // Scroll distant skyline spires with depth parallax
    const spireSpeed = speed * 0.72;
    for (let i = 0; i < ACT1_SPIRE_COUNT; i++) {
      const s = this.spires[i];
      s.z += spireSpeed * dt;
      if (s.z > 32) {
        s.z -= 266;
      }
      this.dummy.position.set(s.x, -16.5, s.z);
      this.dummy.rotation.set(0, s.rotY, 0);
      this.dummy.scale.set(s.width, s.height, s.depth);
      this.dummy.updateMatrix();
      this.spireInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.spireInst.instanceMatrix.needsUpdate = true;
  }

  private updateAct2(dt: number, elapsed: number, speed: number): void {
    this.megalithMat.uniforms.uTime.value = elapsed;
    this.plasmaRiverMat.uniforms.uTime.value = elapsed;
    this.plasmaRiverMat.uniforms.uScrollZ.value = this.scrollDistance;

    const rockSpeed = speed * 0.85;
    for (let i = 0; i < ACT2_MEGALITH_COUNT; i++) {
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
  }

  private updateAct3(dt: number, elapsed: number, speed: number): void {
    this.dreadnoughtFloorMat.uniforms.uTime.value = elapsed;
    this.dreadnoughtFloorMat.uniforms.uScrollZ.value = this.scrollDistance;
    this.dreadnoughtRibMat.uniforms.uTime.value = elapsed;

    for (let i = 0; i < ACT3_RIB_COUNT; i++) {
      const r = this.ribs[i];
      r.z += speed * dt;
      if (r.z > 28) {
        r.z -= 264;
      }
      this.dummy.position.set(r.x, r.y, r.z);
      this.dummy.rotation.set(0, r.rotY, 0);
      this.dummy.scale.set(r.scaleX, r.scaleY, r.scaleZ);
      this.dummy.updateMatrix();
      this.dreadnoughtRibInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.dreadnoughtRibInst.instanceMatrix.needsUpdate = true;

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

    const stretch = THREE.MathUtils.clamp(speed / 28, 0.7, 3.2);
    const dustColors = [
      new THREE.Color(0x88e8ff),
      new THREE.Color(0xb8fff0),
      new THREE.Color(0xffb56b),
    ];
    const tint = dustColors[Math.max(0, Math.min(2, this.currentAct - 1))];

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
