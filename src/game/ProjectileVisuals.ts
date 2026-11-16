import * as THREE from 'three';

export interface PlayerProjectileRenderItem {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  age: number;
  isHoming: boolean;
  isDeflected: boolean;
  isWingman: boolean;
  shipId: 'astra' | 'opus' | 'morph' | 'aero';
}

export interface EnemyProjectileRenderItem {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  age: number;
}

interface TrailPuff {
  active: boolean;
  age: number;
  maxAge: number;
  baseScale: number;
  seed: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
}

interface MuzzleFlashSlot {
  active: boolean;
  fresh: boolean;
  age: number;
  duration: number;
  scale: number;
  seed: number;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  color: THREE.Color;
}

interface BulletImpactSlot {
  active: boolean;
  fresh: boolean;
  age: number;
  duration: number;
  scale: number;
  isCrit: boolean;
  seed: number;
  pos: THREE.Vector3;
  color: THREE.Color;
}

interface ContrailParticle {
  active: boolean;
  age: number;
  maxAge: number;
  width: number;
  length: number;
  seed: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  color: THREE.Color;
}

const MAX_PLAYER_BOLTS = 280;
const MAX_HOMING_WARHEADS = 128;
const MAX_MISSILE_TRAILS = 640;
const MAX_ENEMY_ORBS = 320;
const MAX_MUZZLE_FLASHES = 48;
const MAX_IMPACTS = 64;
const MAX_CONTRAILS = 360;

const MUZZLE_DURATION = 0.065;
const IMPACT_DURATION = 0.12;

const SHIP_STYLE_MAP: Record<PlayerProjectileRenderItem['shipId'], number> = {
  astra: 0,
  opus: 1,
  morph: 2,
  aero: 3,
};

// ==================== GLSL SHADERS ====================

const BOLT_VERT = `
  attribute vec3 aBoltMeta; // x = styleId (0..4), y = age, z = scale
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    vUv = uv;
    vMeta = aBoltMeta;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.0, 0.94, 1.0);
    #endif

    float styleId = aBoltMeta.x;
    float s = max(0.001, aBoltMeta.z);
    float widthMult = 1.0;
    float lengthMult = 1.0;

    if (styleId > 0.5 && styleId < 1.5) {
      // Opus plasma crescent: wider arc
      widthMult = 1.32;
      lengthMult = 0.92;
    } else if (styleId >= 1.5 && styleId < 2.5) {
      // Morph hyper-velocity rail slug: extra long & sleek
      widthMult = 0.82;
      lengthMult = 1.45;
    } else if (styleId >= 2.5 && styleId < 3.5) {
      // Aero diamond prism
      widthMult = 1.05;
      lengthMult = 1.08;
    } else if (styleId >= 3.5) {
      // Deflected star flare
      widthMult = 1.38;
      lengthMult = 0.96;
    }

    vec3 local = vec3(
      position.x * widthMult * s,
      position.y * widthMult * s,
      position.z * lengthMult * s
    );

    vec4 worldPos = vec4(local, 1.0);
    #ifdef USE_INSTANCING
      worldPos = instanceMatrix * worldPos;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * worldPos;
  }
`;

const BOLT_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    float style = vMeta.x;
    float age = vMeta.y;
    float t = vUv.y; // 0 = rear tail, 1 = forward spear tip
    float u = abs(vUv.x - 0.5) * 2.0; // 0 = centerline, 1 = outer edge

    float pulse = 0.88 + 0.12 * sin(age * 42.0 + t * 14.0);
    float core = 0.0;
    float sheath = 0.0;
    vec3 sheathCol = vColor;
    vec3 coreCol = vec3(1.0, 0.98, 0.94);

    if (style < 0.5) {
      // 0: Astra twin golden-cyan pulse lance (dual offset lance glow + pulsing nodes)
      float spearWidth = mix(0.18, 0.88, smoothstep(0.0, 0.78, t)) * (1.0 - smoothstep(0.78, 1.0, t));
      float d = u / max(0.04, spearWidth);
      float dualOffset = abs(u - 0.26);
      float dualLanes = exp(-(dualOffset * dualOffset) * 26.0) * smoothstep(0.15, 0.85, t);
      float nodes = 0.78 + 0.22 * sin(t * 24.0 - age * 48.0);
      core = (exp(-d * d * 8.5) + dualLanes * 0.55) * smoothstep(0.05, 0.65, t) * (1.0 - smoothstep(0.92, 1.0, t));
      sheath = exp(-d * d * 2.2) * smoothstep(0.0, 0.35, t) * (1.0 - smoothstep(0.88, 1.0, t)) * nodes;
      sheathCol = mix(vColor, vec3(0.12, 0.92, 1.0), smoothstep(0.25, 0.9, d) * 0.65);
    } else if (style < 1.5) {
      // 1: Opus crackling plasma crescent
      float arcT = t + 0.26 * (u * u);
      float arcDist = (arcT - 0.82) * 7.5;
      float crescent = exp(-(arcDist * arcDist)) * (1.0 - smoothstep(0.55, 1.0, u));
      float wakeD = u / max(0.06, mix(0.10, 0.58, t));
      float crackle = 0.68 + 0.32 * sin(t * 36.0 - age * 55.0 + sin(u * 18.0 + uTime * 20.0));
      float wake = exp(-wakeD * wakeD * 3.5) * smoothstep(0.0, 0.5, t) * (1.0 - smoothstep(0.84, 1.0, t)) * crackle;
      core = (crescent * 1.15 + exp(-wakeD * wakeD * 13.0) * smoothstep(0.25, 0.8, t) * (1.0 - smoothstep(0.88, 1.0, t)));
      sheath = clamp(crescent * 0.95 + wake, 0.0, 1.25);
      sheathCol = mix(vColor, vec3(0.35, 0.98, 1.0), 0.35);
    } else if (style < 2.5) {
      // 2: Morph long hyper-velocity rail slug with crisp Mach shock rings
      float taper = mix(0.14, 0.48, smoothstep(0.0, 0.84, t)) * (1.0 - smoothstep(0.84, 1.0, t));
      float d = u / max(0.03, taper);
      core = exp(-d * d * 12.0) * smoothstep(0.08, 0.72, t) * (1.0 - smoothstep(0.92, 1.0, t));
      sheath = exp(-d * d * 2.8) * smoothstep(0.0, 0.4, t) * (1.0 - smoothstep(0.9, 1.0, t));

      // 3 trailing Mach shock diamonds / rings
      float d1 = (t - 0.68) * 24.0;
      float d2 = (t - 0.48) * 20.0;
      float d3 = (t - 0.28) * 18.0;
      float ring1 = exp(-(d1 * d1)) * (1.0 - smoothstep(0.30, 0.85, u));
      float ring2 = exp(-(d2 * d2)) * (1.0 - smoothstep(0.34, 0.94, u));
      float ring3 = exp(-(d3 * d3)) * (1.0 - smoothstep(0.28, 0.96, u));
      float rings = (ring1 + ring2 * 0.85 + ring3 * 0.68);
      sheath += rings * 1.15;
      core += rings * 0.42;
      sheathCol = mix(vColor, vec3(1.0, 0.45, 0.28), rings * 0.48);
    } else if (style < 3.5) {
      // 3: Aero crystalline diamond prism bolt
      float diamond = 1.0 - smoothstep(0.0, 1.0, abs(u) * 1.18 + abs(t - 0.72) * 3.0);
      float tailW = mix(0.08, 0.62, t);
      float tailD = u / max(0.04, tailW);
      float tail = exp(-tailD * tailD * 4.0) * smoothstep(0.0, 0.68, t) * (1.0 - smoothstep(0.75, 0.98, t));
      float facets = 0.75 + 0.25 * cos(abs(u) * 16.0 - t * 18.0);
      core = clamp(diamond * 1.35 + exp(-tailD * tailD * 12.0) * smoothstep(0.18, 0.75, t) * (1.0 - smoothstep(0.88, 1.0, t)), 0.0, 1.3);
      sheath = clamp(diamond * facets * 1.2 + tail * 0.95, 0.0, 1.25);
      sheathCol = mix(vColor, vec3(0.3, 0.95, 1.0), 0.35 + 0.35 * sin(t * 14.0 - age * 28.0));
    } else {
      // 4: Deflected high-energy star flare
      float cx = u;
      float cy = (t - 0.64) * 2.1;
      float r = length(vec2(cx, cy));
      float starCross = max(exp(-abs(cx) * 8.5) * exp(-abs(cy) * 2.4), exp(-abs(cy) * 8.5) * exp(-abs(cx) * 2.4));
      float orb = exp(-r * r * 6.5);
      float tailD = u / max(0.06, mix(0.12, 0.62, t));
      float tail = exp(-tailD * tailD * 2.8) * smoothstep(0.0, 0.65, t) * (1.0 - smoothstep(0.76, 1.0, t));
      core = clamp(orb * 1.3 + starCross * 1.15, 0.0, 1.4);
      sheath = clamp(exp(-r * r * 2.2) + starCross * 0.95 + tail * 0.9, 0.0, 1.35);
      sheathCol = mix(vColor, vec3(0.55, 0.98, 1.0), 0.45);
    }

    vec3 rgb = sheathCol * 1.58 * sheath + coreCol * 2.38 * core;
    rgb *= pulse;
    float alpha = clamp(sheath * 0.85 + core, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;
    gl_FragColor = vec4(rgb, alpha);
  }
`;

const WARHEAD_VERT = `
  attribute vec2 aMissileMeta; // x = age, y = seed
  varying vec3 vLocalPos;
  varying vec3 vColor;
  varying vec2 vMeta;

  void main() {
    vLocalPos = position;
    vMeta = aMissileMeta;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0, 0.65, 0.25);
    #endif

    vec4 worldPos = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      worldPos = instanceMatrix * worldPos;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * worldPos;
  }
`;

const WARHEAD_FRAG = `
  varying vec3 vLocalPos;
  varying vec3 vColor;
  varying vec2 vMeta;

  void main() {
    float zNorm = clamp((vLocalPos.z + 0.65) / 1.35, 0.0, 1.0); // 0 = rear nozzle, 1 = nose tip
    float flicker = 0.86 + 0.14 * sin(vMeta.x * 48.0 + vMeta.y * 17.0);

    vec3 noseHot = vec3(1.0, 0.96, 0.86) * 2.3;
    vec3 bodyCol = mix(vec3(0.28, 0.34, 0.44), vColor * 1.45, 0.55);
    vec3 exhaustHot = mix(vColor, vec3(1.0, 0.92, 0.7), 0.55) * 2.4 * flicker;

    vec3 col = bodyCol;
    float tipGlow = smoothstep(0.76, 1.0, zNorm);
    float nozzleGlow = 1.0 - smoothstep(0.0, 0.36, zNorm);

    col = mix(col, noseHot, tipGlow * 0.88);
    col = mix(col, exhaustHot, nozzleGlow);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const TRAIL_VERT = `
  attribute vec3 aTrailMeta; // x = lifeNorm (0..1), y = seed, z = scale
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    vUv = uv;
    vMeta = aTrailMeta;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0, 0.55, 0.2);
    #endif

    #ifdef USE_INSTANCING
      vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float sx = length(instanceMatrix[0].xyz);
    #else
      vec3 center = vec3(0.0);
      float sx = 1.0;
    #endif

    float s = max(0.001, sx * aTrailMeta.z);
    vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
    mvCenter.xy += position.xy * s;
    gl_Position = projectionMatrix * mvCenter;
  }
`;

const TRAIL_FRAG = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

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

  void main() {
    float life = clamp(vMeta.x, 0.0, 1.0);
    float seed = vMeta.y;
    vec2 centered = (vUv - vec2(0.5)) * 2.0;
    float r = length(centered);
    if (!(r <= 1.0)) discard;

    float angle = r > 1e-4 ? atan(centered.y, centered.x) : 0.0;
    float wisp = noise2(vec2(angle * 2.0 + seed * 10.0, r * 3.2 - life * 3.5));
    float puff = exp(-r * r * (4.6 - life * 1.1)) * (0.82 + 0.24 * wisp);

    // High-saturation fiery orange-gold -> vivid crimson-magenta -> deep neon violet
    vec3 colStart = mix(vec3(1.65, 0.78, 0.04), vColor, 0.18);
    vec3 colMid = vec3(1.42, 0.12, 0.58);
    vec3 colEnd = vec3(0.68, 0.14, 1.18);

    vec3 col = mix(colStart, colMid, smoothstep(0.0, 0.38, life));
    col = mix(col, colEnd, smoothstep(0.38, 0.92, life));

    float fade = (1.0 - smoothstep(0.12, 1.0, life));
    float alpha = clamp(puff * fade * 0.41, 0.0, 0.52);
    if (!(alpha >= 0.01)) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const ENEMY_ORB_VERT = `
  attribute vec4 aOrbMeta; // xyz = velocity, w = age
  varying vec2 vTailPos;
  varying vec3 vColor;
  varying float vAge;
  varying float vWake;

  void main() {
    vAge = aOrbMeta.w;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0, 0.28, 0.34);
    #endif

    #ifdef USE_INSTANCING
      vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float s = max(0.001, length(instanceMatrix[0].xyz));
    #else
      vec3 center = vec3(0.0);
      float s = 1.0;
    #endif

    vec2 viewVel = (modelViewMatrix * vec4(aOrbMeta.xyz, 0.0)).xy;
    float vel2D = length(viewVel);
    vec2 fwd = vel2D > 0.05 ? viewVel / vel2D : vec2(0.0, -1.0);
    vec2 right = vec2(-fwd.y, fwd.x);
    float wakeStrength = smoothstep(0.05, 0.55, vel2D);
    vWake = wakeStrength;

    // Position quad around orb center (0,0), extending trailing side along -fwd
    float qx = position.x < 0.0
      ? position.x * mix(1.6, 3.1, wakeStrength)
      : position.x * 1.6;
    float qy = position.y * 1.6;

    vTailPos = vec2(qx, qy); // orb center is exactly (0,0), forward rim at +0.8, tail to -1.55

    vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
    mvCenter.xy += (fwd * qx + right * qy) * s;
    gl_Position = projectionMatrix * mvCenter;
  }
`;

const ENEMY_ORB_FRAG = `
  varying vec2 vTailPos;
  varying vec3 vColor;
  varying float vAge;
  varying float vWake;

  void main() {
    float r = length(vTailPos);
    float ang = r > 1e-4 ? atan(vTailPos.y, vTailPos.x) : 0.0;
    float pulse = 0.88 + 0.12 * sin(vAge * 16.0);

    // 1. Directional wake tail behind orb (-x)
    float tailX = clamp(-vTailPos.x / 1.35, 0.0, 1.0);
    float tailW = mix(0.46, 0.08, tailX);
    float tailY = vTailPos.y / max(0.05, tailW);
    float tailBody = smoothstep(0.15, -0.18, vTailPos.x)
      * exp(-(tailY * tailY) * 2.4)
      * (1.0 - smoothstep(0.22, 1.0, tailX))
      * vWake;

    // 2. Swirling plasma core
    float swirl = 0.5 + 0.5 * sin(ang * 3.0 - vAge * 18.0 + r * 12.0);
    float coreHot = exp(-r * r * 34.0);
    float innerPlasma = exp(-r * r * 11.5) * (0.72 + 0.28 * swirl);

    // 3. Pulsing high-contrast double danger rings
    float ring1Pos = 0.34 + 0.025 * sin(vAge * 18.0);
    float ring2Pos = 0.55 + 0.03 * cos(vAge * 14.0);
    float r1d = (r - ring1Pos) * 24.0;
    float r2d = (r - ring2Pos) * 19.0;
    float rcd = (r - 0.44) * 7.2;
    float ring1 = exp(-(r1d * r1d));
    float ring2 = exp(-(r2d * r2d)) * (0.85 + 0.15 * sin(ang * 4.0 + vAge * 12.0));

    // Dark obsidian contrast silhouette behind bright danger rings so shots pop against bright skies
    float contrastHalo = exp(-(rcd * rcd)) * 0.72 + exp(-r * r * 5.0) * 0.38;

    float brightMask = clamp(coreHot + innerPlasma * 0.8 + ring1 + ring2 * 0.88 + tailBody * 0.7, 0.0, 1.4);
    float alpha = clamp(max(contrastHalo * 0.82, brightMask), 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec3 darkBacking = vec3(0.08, 0.015, 0.05);
    vec3 ringCol = vColor * 1.95 * pulse;
    vec3 plasmaCol = mix(vColor, vec3(1.0, 0.55, 0.18), 0.35) * 1.75;
    vec3 hotCol = vec3(1.0, 0.98, 0.94) * 2.35;

    vec3 rgb = mix(darkBacking, plasmaCol, clamp(innerPlasma + tailBody * 0.8, 0.0, 1.0));
    rgb = mix(rgb, ringCol, clamp(ring1 + ring2, 0.0, 1.0));
    rgb = mix(rgb, hotCol, clamp(coreHot * 1.15, 0.0, 1.0));

    gl_FragColor = vec4(rgb, alpha);
  }
`;

const MUZZLE_STAR_VERT = `
  attribute vec3 aMuzzleMeta; // x = progress (0..1), y = seed, z = scale
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    vUv = uv;
    vMeta = aMuzzleMeta;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.0, 0.94, 1.0);
    #endif

    #ifdef USE_INSTANCING
      vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float sx = length(instanceMatrix[0].xyz);
    #else
      vec3 center = vec3(0.0);
      float sx = 1.0;
    #endif

    float p = clamp(aMuzzleMeta.x, 0.0, 1.0);
    float s = max(0.001, sx * aMuzzleMeta.z * (1.15 - p * 0.45));
    float rot = aMuzzleMeta.y * 6.283185;
    float c = cos(rot);
    float sn = sin(rot);
    vec2 rotated = vec2(
      position.x * c - position.y * sn,
      position.x * sn + position.y * c
    ) * s;

    vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
    mvCenter.xy += rotated;
    gl_Position = projectionMatrix * mvCenter;
  }
`;

const MUZZLE_STAR_FRAG = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    float p = clamp(vMeta.x, 0.0, 1.0);
    vec2 c = (vUv - vec2(0.5)) * 2.0;
    float r = length(c);
    if (!(r <= 1.0)) discard;

    float ang = r > 1e-4 ? atan(c.y, c.x) : 0.0;
    float rays4 = pow(max(1e-4, abs(cos(ang * 2.0))), 18.0);
    float rays6 = pow(max(1e-4, abs(cos(ang * 3.0 + 0.5))), 22.0) * 0.65;
    float star = (rays4 + rays6) * exp(-r * 4.4);
    float core = exp(-r * r * 18.0);
    float halo = exp(-r * r * 7.0) * 0.35;

    float env = (1.0 - p) * (1.0 - p);
    float intensity = (core + star + halo) * env;
    if (!(intensity >= 0.01)) discard;

    vec3 col = mix(vColor * 1.7, vec3(1.0, 0.98, 0.92) * 2.4, clamp(core + star * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(col, clamp(intensity, 0.0, 1.0));
  }
`;

const MUZZLE_CONE_VERT = `
  attribute vec3 aMuzzleMeta; // x = progress (0..1), y = seed, z = scale
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    vUv = uv;
    vMeta = aMuzzleMeta;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.0, 0.94, 1.0);
    #endif

    float p = clamp(aMuzzleMeta.x, 0.0, 1.0);
    float s = max(0.001, aMuzzleMeta.z);
    vec3 local = vec3(
      position.x * s * (1.0 - p * 0.45),
      position.y * s * (1.0 - p * 0.45),
      position.z * s * (0.75 + p * 0.55)
    );

    vec4 worldPos = vec4(local, 1.0);
    #ifdef USE_INSTANCING
      worldPos = instanceMatrix * worldPos;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * worldPos;
  }
`;

const MUZZLE_CONE_FRAG = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    float p = clamp(vMeta.x, 0.0, 1.0);
    float t = clamp(vUv.y, 0.0, 1.0); // 0 = muzzle base, 1 = forward blast tip
    float u = abs(vUv.x - 0.5) * 2.0;

    float coneW = mix(0.65, 0.05, pow(max(1e-4, t), 0.75));
    float d = u / max(0.03, coneW);
    float flame = exp(-d * d * 3.8) * smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.55, 1.0, t));
    float core = exp(-d * d * 12.0) * (1.0 - smoothstep(0.25, 0.85, t));

    float env = (1.0 - p) * (1.0 - p);
    float alpha = clamp((flame + core) * env, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec3 col = mix(vColor * 1.65, vec3(1.0, 0.97, 0.9) * 2.35, clamp(core, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

const IMPACT_VERT = `
  attribute vec3 aImpactMeta; // x = progress (0..1), y = isCrit (0 or 1), z = seed
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    vUv = uv;
    vMeta = aImpactMeta;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0, 0.8, 0.3);
    #endif

    #ifdef USE_INSTANCING
      vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float sx = length(instanceMatrix[0].xyz);
    #else
      vec3 center = vec3(0.0);
      float sx = 1.0;
    #endif

    float p = clamp(aImpactMeta.x, 0.0, 1.0);
    float grow = 0.45 + pow(max(1e-4, p), 0.55) * 1.05;
    float s = max(0.001, sx * grow);
    float rot = aImpactMeta.z * 6.283185;
    float c = cos(rot);
    float sn = sin(rot);
    vec2 rotated = vec2(
      position.x * c - position.y * sn,
      position.x * sn + position.y * c
    ) * s;

    vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
    mvCenter.xy += rotated;
    gl_Position = projectionMatrix * mvCenter;
  }
`;

const IMPACT_FRAG = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vMeta;

  void main() {
    float p = clamp(vMeta.x, 0.0, 1.0);
    float isCrit = vMeta.y;
    vec2 c = (vUv - vec2(0.5)) * 2.0;
    float r = length(c);
    if (!(r <= 1.0)) discard;

    // Expanding shock-ring
    float ringR = mix(0.18, 0.90, pow(max(1e-4, p), 0.6));
    float ringW = mix(0.11, 0.04, p);
    float ringDist = (r - ringR) / max(1e-4, ringW);
    float shockRing = exp(-(ringDist * ringDist)) * (1.0 - p);

    // Crisp cross-flare (4-ray normal, 8-ray golden burst on crit)
    float ang = r > 1e-4 ? atan(c.y, c.x) : 0.0;
    float cross4 = pow(max(1e-4, abs(cos(ang * 2.0))), 18.0);
    float cross8 = pow(max(1e-4, abs(cos(ang * 4.0))), 22.0) * isCrit;
    float flareEnv = max(0.0, 1.0 - p * 1.45);
    float crossFlare = (cross4 + cross8 * 0.9) * exp(-r * 3.2) * flareEnv;
    float centerDot = exp(-r * r * 18.0) * flareEnv;

    float alpha = clamp(shockRing + crossFlare + centerDot, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec3 baseCol = mix(vColor, vec3(1.0, 0.78, 0.25), isCrit * 0.65);
    vec3 col = mix(baseCol * 1.75, vec3(1.0, 0.98, 0.90) * 2.4, clamp(centerDot + crossFlare * 0.65, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

const MACH_VERT = `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = length(mvPos.xyz) > 1e-5 ? normalize(-mvPos.xyz) : vec3(0.0, 0.0, 1.0);
    vec3 nrm = normalMatrix * normal;
    vNormalView = length(nrm) > 1e-5 ? normalize(nrm) : vec3(0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const MACH_FRAG = `
  uniform float uTime;
  uniform float uBoost;
  uniform vec3 uAccent;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    // CylinderGeometry vUv.y goes 0 at nozzle (-Y -> z=0) to 1 at plume tip (+Y -> z=1)
    float t = clamp(vUv.y, 0.0, 1.0);
    float around = vUv.x * 6.283185;

    // Soft cylinder silhouette via view-normal alignment
    vec3 nView = length(vNormalView) > 1e-5 ? normalize(vNormalView) : vec3(0.0, 0.0, 1.0);
    vec3 vDir = length(vViewDir) > 1e-5 ? normalize(vViewDir) : vec3(0.0, 0.0, 1.0);
    float ndv = clamp(abs(dot(nView, vDir)), 0.0, 1.0);
    float edgeSoft = pow(max(1e-4, ndv), 1.35);

    // Standing supersonic Mach shock diamonds along exhaust axis
    float diamondFreq = 4.5 + uBoost * 1.0;
    float shockPhase = t * 3.14159265 * diamondFreq;
    float diamondNodes = pow(max(1e-4, abs(cos(shockPhase))), 5.0) * (1.0 - smoothstep(0.62, 1.0, t));
    float highFreq = 0.82 + 0.18 * sin(t * 28.0 - uTime * 54.0 + sin(around * 3.0));
    float streaks = 0.8 + 0.2 * sin(around * 6.0 + uTime * 18.0 - t * 12.0);

    float corePlume = (1.0 - smoothstep(0.08, 0.98, t)) * streaks;
    float intensity = (corePlume * 0.72 + diamondNodes * 1.15) * edgeSoft * highFreq;
    intensity *= smoothstep(0.0, 0.06, t); // Clean blend right at nozzle root

    if (!(intensity >= 0.01)) discard;

    vec3 nozzleWhite = mix(uAccent, vec3(1.0, 0.96, 0.88), 0.72) * 2.05;
    vec3 midPlasma = uAccent * (1.42 + uBoost * 0.42);
    vec3 tipCol = uAccent * 0.85;

    vec3 col = mix(nozzleWhite, midPlasma, smoothstep(0.04, 0.38, t));
    col = mix(col, tipCol, smoothstep(0.45, 1.0, t));
    col += vec3(1.0, 0.97, 0.90) * diamondNodes * 0.85;

    gl_FragColor = vec4(col, clamp(intensity * (0.85 + uBoost * 0.25), 0.0, 1.0));
  }
`;

const CONTRAIL_VERT = `
  attribute vec3 aContrailMeta; // x = lifeNorm (0..1), y = width, z = length
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLife;

  void main() {
    vUv = uv;
    vLife = clamp(aContrailMeta.x, 0.0, 1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(0.0, 0.94, 1.0);
    #endif

    float w = max(0.001, aContrailMeta.y);
    float l = max(0.001, aContrailMeta.z);
    vec3 local = vec3(position.x * w, position.y * w, position.z * l);

    vec4 worldPos = vec4(local, 1.0);
    #ifdef USE_INSTANCING
      worldPos = instanceMatrix * worldPos;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * worldPos;
  }
`;

const CONTRAIL_FRAG = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLife;

  void main() {
    float u = abs(vUv.x - 0.5) * 2.0;
    float t = vUv.y;
    float edgeFade = exp(-u * u * 5.6);
    float segFade = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.88, t);
    float ageFade = (1.0 - smoothstep(0.05, 1.0, vLife));

    float alpha = edgeFade * segFade * ageFade * 0.44;
    if (!(alpha >= 0.01)) discard;

    vec3 col = mix(vec3(0.85, 0.96, 1.0) * 1.15, vColor * 1.05, clamp(vLife * 1.1 + u * 0.45, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

const SHIELD_VERT = `
  varying vec3 vLocalPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vLocalPos = position;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = length(mvPos.xyz) > 1e-5 ? normalize(-mvPos.xyz) : vec3(0.0, 0.0, 1.0);
    vec3 nrm = normalMatrix * normal;
    vNormalView = length(nrm) > 1e-5 ? normalize(nrm) : vec3(0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const SHIELD_FRAG = `
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uTime;
  varying vec3 vLocalPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  float hexDist(vec2 p) {
    p = abs(p);
    float c = dot(p, normalize(vec2(1.0, 1.7320508)));
    return max(c, p.x);
  }

  float hexEdge(vec2 uv) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    float d = 0.5 - hexDist(gv);
    return 1.0 - smoothstep(0.012, 0.048, d);
  }

  void main() {
    vec3 nDir = length(vLocalPos) > 1e-5 ? normalize(vLocalPos) : vec3(0.0, 1.0, 0.0);
    vec3 nView = length(vNormalView) > 1e-5 ? normalize(vNormalView) : vec3(0.0, 0.0, 1.0);
    vec3 vDir = length(vViewDir) > 1e-5 ? normalize(vViewDir) : vec3(0.0, 0.0, 1.0);
    float ndv = clamp(abs(dot(nView, vDir)), 0.0, 1.0);
    float fresnel = pow(max(1e-4, 1.0 - ndv), 2.85);

    // Seamless spherical wraparound hexagonal lattice (integer circumference repeat)
    float safeX = (abs(nDir.x) < 1e-5 && abs(nDir.z) < 1e-5) ? 1e-5 : nDir.x;
    float phi = atan(nDir.z, safeX) / 6.2831853 + 0.5;
    vec2 hexUv = vec2(phi * 16.0, nDir.y * 7.5 + 4.0);
    float hexLine = hexEdge(hexUv);

    // Sweeping ripple waves driven by barrel roll progress (0..1)
    float sweepY = 1.15 - uProgress * 2.3;
    float sweepDiff = (nDir.y - sweepY) * 3.4;
    float sweepWave = exp(-(sweepDiff * sweepDiff));
    float spiralRipple = 0.5 + 0.5 * sin(nDir.z * 9.0 - uProgress * 18.84 + uTime * 8.0);
    float interiorAtten = mix(0.18, 1.0, fresnel);
    float pulseCells = hexLine * (0.24 + 0.56 * sweepWave + 0.25 * spiralRipple) * interiorAtten;

    float env = smoothstep(0.0, 0.12, uProgress) * (1.0 - smoothstep(0.78, 1.0, uProgress));
    float intensity = (fresnel * 0.72 + pulseCells * 0.78 + sweepWave * 0.14 * mix(0.35, 1.0, fresnel)) * env;
    if (!(intensity >= 0.01)) discard;

    vec3 cyanViolet = mix(uColor, vec3(0.54, 0.34, 1.0), 0.36);
    vec3 rimCol = mix(cyanViolet * 1.02, vec3(0.72, 0.94, 1.14), clamp(fresnel * 0.55 + sweepWave * 0.35, 0.0, 1.0));
    vec3 col = mix(cyanViolet * 0.82, rimCol, clamp(hexLine * 0.55 + fresnel, 0.0, 1.0));

    gl_FragColor = vec4(col, clamp(intensity, 0.0, 0.76));
  }
`;

// ==================== GEOMETRY BUILDERS ====================

function createCrossedBoltGeometry(width: number, zMin: number, zMax: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const positions = new Float32Array([
    // Horizontal XZ plane
    -hw, 0, zMin,
    hw, 0, zMin,
    hw, 0, zMax,
    -hw, 0, zMax,
    // Vertical YZ plane
    0, -hw, zMin,
    0, hw, zMin,
    0, hw, zMax,
    0, -hw, zMax,
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createWarheadDartGeometry(): THREE.BufferGeometry {
  // Sleek 3D diamond fuselage + swept stabilizer fins oriented along +Z (nose at +0.72, rear at -0.62)
  const positions = new Float32Array([
    // Nose pyramid (4 tris -> nose at +0.72, mid ring at +0.08)
    0, 0, 0.72,   -0.16, 0, 0.08,   0, 0.16, 0.08,
    0, 0, 0.72,    0, 0.16, 0.08,   0.16, 0, 0.08,
    0, 0, 0.72,    0.16, 0, 0.08,   0, -0.16, 0.08,
    0, 0, 0.72,    0, -0.16, 0.08, -0.16, 0, 0.08,

    // Tail body (4 tris -> mid ring at +0.08, rear nozzle at -0.62)
    0, 0, -0.62,   0, 0.16, 0.08,  -0.16, 0, 0.08,
    0, 0, -0.62,   0.16, 0, 0.08,   0, 0.16, 0.08,
    0, 0, -0.62,   0, -0.16, 0.08,  0.16, 0, 0.08,
    0, 0, -0.62,  -0.16, 0, 0.08,   0, -0.16, 0.08,

    // Horizontal stabilizer fins
    -0.12, 0, -0.15,  -0.44, 0, -0.58,  -0.10, 0, -0.56,
     0.12, 0, -0.15,   0.10, 0, -0.56,   0.44, 0, -0.58,

    // Vertical stabilizer fins
    0, 0.12, -0.15,   0, 0.44, -0.58,   0, 0.10, -0.56,
    0, -0.12, -0.15,  0, -0.10, -0.56,  0, -0.44, -0.58,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

// ==================== PROJECTILE VISUALS SYSTEM ====================

export class ProjectileVisuals {
  private readonly container = new THREE.Group();

  // 1. Player Energy Bolts
  private readonly boltInst: THREE.InstancedMesh;
  private readonly boltMat: THREE.ShaderMaterial;
  private readonly boltMetaAttr: THREE.InstancedBufferAttribute;
  private readonly boltMetaData = new Float32Array(MAX_PLAYER_BOLTS * 3);

  // 2. Homing Missile Warheads & 640-segment Trail Ring-Buffer
  private readonly warheadInst: THREE.InstancedMesh;
  private readonly warheadMat: THREE.ShaderMaterial;
  private readonly missileMetaAttr: THREE.InstancedBufferAttribute;
  private readonly missileMetaData = new Float32Array(MAX_HOMING_WARHEADS * 2);

  private readonly trailInst: THREE.InstancedMesh;
  private readonly trailMat: THREE.ShaderMaterial;
  private readonly trailMetaAttr: THREE.InstancedBufferAttribute;
  private readonly trailMetaData = new Float32Array(MAX_MISSILE_TRAILS * 3);
  private readonly trailPool: TrailPuff[] = [];
  private trailCursor = 0;

  // 3. Enemy Plasma Orbs
  private readonly enemyOrbInst: THREE.InstancedMesh;
  private readonly enemyOrbMat: THREE.ShaderMaterial;
  private readonly orbMetaAttr: THREE.InstancedBufferAttribute;
  private readonly orbMetaData = new Float32Array(MAX_ENEMY_ORBS * 4);

  // 4. Pooled 48-slot Muzzle Flashes (Starburst + Forward Cone)
  private readonly muzzleStarInst: THREE.InstancedMesh;
  private readonly muzzleStarMat: THREE.ShaderMaterial;
  private readonly muzzleConeInst: THREE.InstancedMesh;
  private readonly muzzleConeMat: THREE.ShaderMaterial;
  private readonly muzzleMetaAttr: THREE.InstancedBufferAttribute;
  private readonly muzzleMetaData = new Float32Array(MAX_MUZZLE_FLASHES * 3);
  private readonly muzzlePool: MuzzleFlashSlot[] = [];
  private muzzleCursor = 0;

  // 5. Pooled 64-slot Bullet Hit Micro-Impacts
  private readonly impactInst: THREE.InstancedMesh;
  private readonly impactMat: THREE.ShaderMaterial;
  private readonly impactMetaAttr: THREE.InstancedBufferAttribute;
  private readonly impactMetaData = new Float32Array(MAX_IMPACTS * 3);
  private readonly impactPool: BulletImpactSlot[] = [];
  private impactCursor = 0;

  // 6. Player Mach-Diamond Afterburners + Wingtip Contrails
  private readonly thrusterGroup = new THREE.Group();
  private readonly machOuterMat: THREE.ShaderMaterial;
  private readonly machInnerMat: THREE.ShaderMaterial;
  private readonly machOuterCones: THREE.Mesh[] = [];
  private readonly machInnerCones: THREE.Mesh[] = [];

  private readonly contrailInst: THREE.InstancedMesh;
  private readonly contrailMat: THREE.ShaderMaterial;
  private readonly contrailMetaAttr: THREE.InstancedBufferAttribute;
  private readonly contrailMetaData = new Float32Array(MAX_CONTRAILS * 3);
  private readonly contrailPool: ContrailParticle[] = [];
  private contrailCursor = 0;
  private hasPrevTips = false;
  private readonly prevLeftTip = new THREE.Vector3();
  private readonly prevRightTip = new THREE.Vector3();

  // 7. Fresnel Hexagonal Roll Shield
  private readonly shieldMesh: THREE.Mesh;
  private readonly shieldMat: THREE.ShaderMaterial;

  // Scratch math objects
  private readonly dummy = new THREE.Object3D();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpVecA = new THREE.Vector3();
  private readonly tmpVecB = new THREE.Vector3();
  private readonly tmpColor = new THREE.Color();
  private readonly upZ = new THREE.Vector3(0, 0, 1);
  private readonly whiteColor = new THREE.Color(0xffffff);
  private readonly critGoldColor = new THREE.Color(0xffc94a);
  private readonly trailHotColor = new THREE.Color(0xff9f43);

  constructor(scene: THREE.Scene) {
    this.container.name = 'ProjectileVisualsGroup';
    scene.add(this.container);

    // 1. Player Energy Bolts (Crossed-plane InstancedMesh)
    const boltGeo = createCrossedBoltGeometry(1.08, -2.15, 0.95);
    this.boltMetaData[0] = 0;
    this.boltMetaData[1] = 0.05;
    this.boltMetaData[2] = 1.0;
    this.boltMetaAttr = new THREE.InstancedBufferAttribute(this.boltMetaData, 3);
    this.boltMetaAttr.setUsage(THREE.DynamicDrawUsage);
    boltGeo.setAttribute('aBoltMeta', this.boltMetaAttr);

    this.boltMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: BOLT_VERT,
      fragmentShader: BOLT_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.boltInst = new THREE.InstancedMesh(boltGeo, this.boltMat, MAX_PLAYER_BOLTS);
    this.boltInst.frustumCulled = false;
    this.boltInst.setColorAt(0, new THREE.Color(0x00f0ff));
    this.boltInst.count = 0;
    this.container.add(this.boltInst);

    // 2A. Homing Missile Warheads
    const warheadGeo = createWarheadDartGeometry();
    this.missileMetaData[0] = 0.05;
    this.missileMetaData[1] = 1.0;
    this.missileMetaAttr = new THREE.InstancedBufferAttribute(this.missileMetaData, 2);
    this.missileMetaAttr.setUsage(THREE.DynamicDrawUsage);
    warheadGeo.setAttribute('aMissileMeta', this.missileMetaAttr);

    this.warheadMat = new THREE.ShaderMaterial({
      vertexShader: WARHEAD_VERT,
      fragmentShader: WARHEAD_FRAG,
      side: THREE.DoubleSide,
    });
    this.warheadInst = new THREE.InstancedMesh(warheadGeo, this.warheadMat, MAX_HOMING_WARHEADS);
    this.warheadInst.frustumCulled = false;
    this.warheadInst.setColorAt(0, new THREE.Color(0xffb347));
    this.warheadInst.count = 0;
    this.container.add(this.warheadInst);

    // 2B. Homing Missile Ribbon Exhaust Trails (640-segment ring-buffer)
    const trailGeo = new THREE.PlaneGeometry(1, 1);
    this.trailMetaData[0] = 0.2;
    this.trailMetaData[1] = 0.5;
    this.trailMetaData[2] = 1.0;
    this.trailMetaAttr = new THREE.InstancedBufferAttribute(this.trailMetaData, 3);
    this.trailMetaAttr.setUsage(THREE.DynamicDrawUsage);
    trailGeo.setAttribute('aTrailMeta', this.trailMetaAttr);

    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trailInst = new THREE.InstancedMesh(trailGeo, this.trailMat, MAX_MISSILE_TRAILS);
    this.trailInst.frustumCulled = false;
    this.trailInst.setColorAt(0, this.trailHotColor);
    this.trailInst.count = 0;
    this.container.add(this.trailInst);

    for (let i = 0; i < MAX_MISSILE_TRAILS; i++) {
      this.trailPool.push({
        active: false,
        age: 0,
        maxAge: 0.44,
        baseScale: 0.55,
        seed: i * 0.37,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
      });
    }

    // 3. Enemy Plasma Orbs (Camera-oriented billboard InstancedMesh)
    const enemyOrbGeo = new THREE.PlaneGeometry(1, 1);
    this.orbMetaData[0] = 0;
    this.orbMetaData[1] = 0;
    this.orbMetaData[2] = 30;
    this.orbMetaData[3] = 0.1;
    this.orbMetaAttr = new THREE.InstancedBufferAttribute(this.orbMetaData, 4);
    this.orbMetaAttr.setUsage(THREE.DynamicDrawUsage);
    enemyOrbGeo.setAttribute('aOrbMeta', this.orbMetaAttr);

    this.enemyOrbMat = new THREE.ShaderMaterial({
      vertexShader: ENEMY_ORB_VERT,
      fragmentShader: ENEMY_ORB_FRAG,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    this.enemyOrbInst = new THREE.InstancedMesh(enemyOrbGeo, this.enemyOrbMat, MAX_ENEMY_ORBS);
    this.enemyOrbInst.frustumCulled = false;
    this.enemyOrbInst.setColorAt(0, new THREE.Color(0xff4757));
    this.enemyOrbInst.count = 0;
    this.container.add(this.enemyOrbInst);

    // 4. Pooled 48-slot Muzzle Flashes (Starburst + Forward Cone)
    const muzzleStarGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const muzzleConeGeo = createCrossedBoltGeometry(0.95, 0.0, 1.65);

    this.muzzleMetaData[0] = 0.2;
    this.muzzleMetaData[1] = 0.5;
    this.muzzleMetaData[2] = 1.0;
    this.muzzleMetaAttr = new THREE.InstancedBufferAttribute(this.muzzleMetaData, 3);
    this.muzzleMetaAttr.setUsage(THREE.DynamicDrawUsage);
    muzzleStarGeo.setAttribute('aMuzzleMeta', this.muzzleMetaAttr);
    muzzleConeGeo.setAttribute('aMuzzleMeta', this.muzzleMetaAttr);

    this.muzzleStarMat = new THREE.ShaderMaterial({
      vertexShader: MUZZLE_STAR_VERT,
      fragmentShader: MUZZLE_STAR_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.muzzleStarInst = new THREE.InstancedMesh(muzzleStarGeo, this.muzzleStarMat, MAX_MUZZLE_FLASHES);
    this.muzzleStarInst.frustumCulled = false;
    this.muzzleStarInst.setColorAt(0, this.whiteColor);
    this.muzzleStarInst.count = 0;

    this.muzzleConeMat = new THREE.ShaderMaterial({
      vertexShader: MUZZLE_CONE_VERT,
      fragmentShader: MUZZLE_CONE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.muzzleConeInst = new THREE.InstancedMesh(muzzleConeGeo, this.muzzleConeMat, MAX_MUZZLE_FLASHES);
    this.muzzleConeInst.frustumCulled = false;
    this.muzzleConeInst.setColorAt(0, this.whiteColor);
    this.muzzleConeInst.count = 0;

    this.container.add(this.muzzleStarInst, this.muzzleConeInst);

    for (let i = 0; i < MAX_MUZZLE_FLASHES; i++) {
      this.muzzlePool.push({
        active: false,
        fresh: false,
        age: 0,
        duration: MUZZLE_DURATION,
        scale: 1,
        seed: i * 0.29,
        pos: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, -1),
        color: new THREE.Color(0x00f0ff),
      });
    }

    // 5. Pooled 64-slot Bullet Hit Micro-Impacts
    const impactGeo = new THREE.PlaneGeometry(1.4, 1.4);
    this.impactMetaData[0] = 0.25;
    this.impactMetaData[1] = 0.0;
    this.impactMetaData[2] = 0.5;
    this.impactMetaAttr = new THREE.InstancedBufferAttribute(this.impactMetaData, 3);
    this.impactMetaAttr.setUsage(THREE.DynamicDrawUsage);
    impactGeo.setAttribute('aImpactMeta', this.impactMetaAttr);

    this.impactMat = new THREE.ShaderMaterial({
      vertexShader: IMPACT_VERT,
      fragmentShader: IMPACT_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.impactInst = new THREE.InstancedMesh(impactGeo, this.impactMat, MAX_IMPACTS);
    this.impactInst.frustumCulled = false;
    this.impactInst.setColorAt(0, this.whiteColor);
    this.impactInst.count = 0;
    this.container.add(this.impactInst);

    for (let i = 0; i < MAX_IMPACTS; i++) {
      this.impactPool.push({
        active: false,
        fresh: false,
        age: 0,
        duration: IMPACT_DURATION,
        scale: 1,
        isCrit: false,
        seed: i * 0.41,
        pos: new THREE.Vector3(),
        color: new THREE.Color(0x00f0ff),
      });
    }

    // 6A. Player Dual Mach-Diamond Afterburners (transformed into ship local space)
    const outerConeGeo = new THREE.CylinderGeometry(0.03, 0.27, 1.0, 18, 10, true);
    outerConeGeo.rotateX(Math.PI * 0.5);
    outerConeGeo.translate(0, 0, 0.5); // Nozzle at z=0, plume extends toward +Z

    const innerConeGeo = new THREE.CylinderGeometry(0.015, 0.14, 1.0, 14, 8, true);
    innerConeGeo.rotateX(Math.PI * 0.5);
    innerConeGeo.translate(0, 0, 0.5);

    this.machOuterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBoost: { value: 0 },
        uAccent: { value: new THREE.Color(0x00f0ff) },
      },
      vertexShader: MACH_VERT,
      fragmentShader: MACH_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.machInnerMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBoost: { value: 0 },
        uAccent: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: MACH_VERT,
      fragmentShader: MACH_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (const side of [-1, 1]) {
      const outer = new THREE.Mesh(outerConeGeo, this.machOuterMat);
      outer.position.set(side * 0.46, -0.02, 1.16);
      const inner = new THREE.Mesh(innerConeGeo, this.machInnerMat);
      inner.position.set(side * 0.46, -0.02, 1.16);
      this.machOuterCones.push(outer);
      this.machInnerCones.push(inner);
      this.thrusterGroup.add(outer, inner);
    }
    this.thrusterGroup.visible = false;
    this.container.add(this.thrusterGroup);

    // 6B. Dual Wingtip Energy Contrails
    const contrailGeo = createCrossedBoltGeometry(1.0, -0.5, 0.5);
    this.contrailMetaData[0] = 0.2;
    this.contrailMetaData[1] = 0.14;
    this.contrailMetaData[2] = 1.0;
    this.contrailMetaAttr = new THREE.InstancedBufferAttribute(this.contrailMetaData, 3);
    this.contrailMetaAttr.setUsage(THREE.DynamicDrawUsage);
    contrailGeo.setAttribute('aContrailMeta', this.contrailMetaAttr);

    this.contrailMat = new THREE.ShaderMaterial({
      vertexShader: CONTRAIL_VERT,
      fragmentShader: CONTRAIL_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.contrailInst = new THREE.InstancedMesh(contrailGeo, this.contrailMat, MAX_CONTRAILS);
    this.contrailInst.frustumCulled = false;
    this.contrailInst.setColorAt(0, new THREE.Color(0x00f0ff));
    this.contrailInst.count = 0;
    this.container.add(this.contrailInst);

    for (let i = 0; i < MAX_CONTRAILS; i++) {
      this.contrailPool.push({
        active: false,
        age: 0,
        maxAge: 0.28,
        width: 0.14,
        length: 1.0,
        seed: i * 0.23,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, 1),
        color: new THREE.Color(0x00f0ff),
      });
    }

    // 7. Fresnel Hexagonal Energy Shield
    const shieldGeo = new THREE.SphereGeometry(2.35, 36, 24);
    this.shieldMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x00f0ff) },
        uProgress: { value: 0.5 },
        uTime: { value: 0 },
      },
      vertexShader: SHIELD_VERT,
      fragmentShader: SHIELD_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, this.shieldMat);
    this.shieldMesh.visible = false;
    this.container.add(this.shieldMesh);
  }

  syncPlayerProjectiles(
    items: readonly PlayerProjectileRenderItem[],
    dt: number,
    elapsed: number
  ): void {
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.boltMat.uniforms.uTime.value = elapsed;

    let boltCount = 0;
    let warheadCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.isHoming) {
        if (warheadCount < MAX_HOMING_WARHEADS) {
          this.dummy.position.copy(item.pos);
          if (this.tmpDir.copy(item.vel).lengthSq() > 1e-6) {
            this.tmpDir.normalize();
            this.dummy.quaternion.setFromUnitVectors(this.upZ, this.tmpDir);
          } else {
            this.dummy.quaternion.identity();
            this.tmpDir.set(0, 0, -1);
          }
          const missileScale = item.isDeflected ? 1.25 : 1.08;
          this.dummy.scale.setScalar(missileScale);
          this.dummy.updateMatrix();
          this.warheadInst.setMatrixAt(warheadCount, this.dummy.matrix);
          this.warheadInst.setColorAt(warheadCount, item.color);
          this.missileMetaData[warheadCount * 2] = item.age;
          this.missileMetaData[warheadCount * 2 + 1] = i * 0.37;
          warheadCount += 1;

          // Emit glowing plasma exhaust puffs behind active homing missile
          if (safeDt > 0) {
            this.emitTrailPuff(item.pos, this.tmpDir, item.color, missileScale, 0);
            if (warheadCount <= 18) {
              this.emitTrailPuff(item.pos, this.tmpDir, item.color, missileScale * 0.94, -0.52);
            }
          }
        }
        continue;
      }

      if (boltCount >= MAX_PLAYER_BOLTS) continue;

      this.dummy.position.copy(item.pos);
      if (this.tmpDir.copy(item.vel).lengthSq() > 1e-6) {
        this.tmpDir.normalize();
        this.dummy.quaternion.setFromUnitVectors(this.upZ, this.tmpDir);
      } else {
        this.dummy.quaternion.identity();
      }
      this.dummy.scale.setScalar(1.0);
      this.dummy.updateMatrix();
      this.boltInst.setMatrixAt(boltCount, this.dummy.matrix);
      this.boltInst.setColorAt(boltCount, item.color);

      const styleId = item.isDeflected
        ? 4
        : item.isWingman
          ? 0
          : SHIP_STYLE_MAP[item.shipId];
      const scale = item.isDeflected
        ? 1.28
        : item.isWingman
          ? 0.78
          : item.shipId === 'morph'
            ? 1.15
            : item.shipId === 'opus'
              ? 1.08
              : 1.0;

      const idx3 = boltCount * 3;
      this.boltMetaData[idx3] = styleId;
      this.boltMetaData[idx3 + 1] = item.age;
      this.boltMetaData[idx3 + 2] = scale;
      boltCount += 1;
    }

    this.boltInst.count = boltCount;
    this.boltInst.instanceMatrix.needsUpdate = true;
    if (this.boltInst.instanceColor) this.boltInst.instanceColor.needsUpdate = true;
    this.boltMetaAttr.needsUpdate = true;

    this.warheadInst.count = warheadCount;
    this.warheadInst.instanceMatrix.needsUpdate = true;
    if (this.warheadInst.instanceColor) this.warheadInst.instanceColor.needsUpdate = true;
    this.missileMetaAttr.needsUpdate = true;

    // Advance pooled 640-segment missile trail ring-buffer, 48-slot muzzle flashes, and 64-slot impacts
    this.updateMissileTrails(safeDt);
    this.updateMuzzleFlashes(safeDt);
    this.updateImpacts(safeDt);
  }

  syncEnemyProjectiles(
    items: readonly EnemyProjectileRenderItem[],
    _dt: number,
    _elapsed: number
  ): void {
    let count = 0;
    for (let i = 0; i < items.length && count < MAX_ENEMY_ORBS; i++) {
      const item = items[i];
      this.dummy.position.copy(item.pos);
      this.dummy.quaternion.identity();
      const pulseScale = 1.08 + Math.sin(item.age * 14.0 + i) * 0.08;
      this.dummy.scale.setScalar(pulseScale);
      this.dummy.updateMatrix();
      this.enemyOrbInst.setMatrixAt(count, this.dummy.matrix);
      this.enemyOrbInst.setColorAt(count, item.color);

      const idx4 = count * 4;
      this.orbMetaData[idx4] = item.vel.x;
      this.orbMetaData[idx4 + 1] = item.vel.y;
      this.orbMetaData[idx4 + 2] = item.vel.z;
      this.orbMetaData[idx4 + 3] = item.age;
      count += 1;
    }

    this.enemyOrbInst.count = count;
    this.enemyOrbInst.instanceMatrix.needsUpdate = true;
    if (this.enemyOrbInst.instanceColor) this.enemyOrbInst.instanceColor.needsUpdate = true;
    this.orbMetaAttr.needsUpdate = true;
  }

  spawnMuzzleFlash(
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    colorHex: number,
    scale = 1.0
  ): void {
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    const safeScale = Math.max(0.15, Number.isFinite(scale) ? scale : 1.0);
    const slot = this.muzzlePool[this.muzzleCursor];
    this.muzzleCursor = (this.muzzleCursor + 1) % MAX_MUZZLE_FLASHES;

    slot.active = true;
    slot.fresh = true;
    slot.age = 0;
    slot.duration = MUZZLE_DURATION;
    slot.scale = safeScale;
    slot.seed = Math.random();
    slot.pos.copy(pos);
    if (slot.dir.copy(dir).lengthSq() > 1e-6) {
      slot.dir.normalize();
    } else {
      slot.dir.set(0, 0, -1);
    }
    slot.color.setHex(colorHex);
  }

  spawnBulletImpact(pos: THREE.Vector3, colorHex: number, isCrit = false): void {
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    const slot = this.impactPool[this.impactCursor];
    this.impactCursor = (this.impactCursor + 1) % MAX_IMPACTS;

    slot.active = true;
    slot.fresh = true;
    slot.age = 0;
    slot.duration = IMPACT_DURATION;
    slot.isCrit = isCrit;
    slot.scale = isCrit ? 2.0 : 1.0;
    slot.seed = Math.random();
    slot.pos.copy(pos);
    if (isCrit) {
      slot.color.copy(this.critGoldColor);
    } else {
      slot.color.setHex(colorHex);
    }
  }

  updatePlayerThrusters(
    visible: boolean,
    playerPos: THREE.Vector3,
    playerQuat: THREE.Quaternion,
    playerVel: THREE.Vector3,
    accentHex: number,
    boostActive: boolean,
    dt: number,
    elapsed: number
  ): void {
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;

    if (visible) {
      this.thrusterGroup.visible = true;
      this.thrusterGroup.position.copy(playerPos);
      this.thrusterGroup.quaternion.copy(playerQuat);

      this.tmpColor.setHex(accentHex);
      (this.machOuterMat.uniforms.uAccent.value as THREE.Color).copy(this.tmpColor);
      this.machOuterMat.uniforms.uTime.value = elapsed;
      this.machOuterMat.uniforms.uBoost.value = boostActive ? 1.0 : 0.0;
      this.machInnerMat.uniforms.uTime.value = elapsed;
      this.machInnerMat.uniforms.uBoost.value = boostActive ? 1.0 : 0.0;

      const speedNorm = Math.min(1.0, playerVel.length() / 24);
      const flicker = 1.0 + Math.sin(elapsed * 46.0) * 0.09 + Math.cos(elapsed * 73.0) * 0.05;
      const plumeLength = (boostActive ? 3.25 : 1.9 + speedNorm * 0.55) * flicker;
      const plumeWidth = (boostActive ? 1.32 : 0.96 + speedNorm * 0.14) * (0.96 + Math.sin(elapsed * 52.0) * 0.04);

      for (const cone of this.machOuterCones) {
        cone.scale.set(plumeWidth, plumeWidth, plumeLength);
      }
      for (const core of this.machInnerCones) {
        core.scale.set(plumeWidth * 0.92, plumeWidth * 0.92, plumeLength * 0.78);
      }

      if (safeDt > 0 && safeDt < 0.15) {
        const streamSpeed = boostActive ? 68 : 44;
        // Left & right wingtips in local ship space
        this.tmpVecA.set(-1.42, -0.02, 0.45).applyQuaternion(playerQuat).add(playerPos);
        this.tmpVecB.set(1.42, -0.02, 0.45).applyQuaternion(playerQuat).add(playerPos);

        if (this.hasPrevTips) {
          this.emitContrailSegment(this.prevLeftTip, this.tmpVecA, streamSpeed, safeDt, this.tmpColor, boostActive);
          this.emitContrailSegment(this.prevRightTip, this.tmpVecB, streamSpeed, safeDt, this.tmpColor, boostActive);
        }
        this.prevLeftTip.copy(this.tmpVecA);
        this.prevRightTip.copy(this.tmpVecB);
        this.hasPrevTips = true;
      }
    } else {
      this.thrusterGroup.visible = false;
      this.hasPrevTips = false;
    }

    this.updateContrails(safeDt);
  }

  updateRollShield(
    visible: boolean,
    playerPos: THREE.Vector3,
    progress: number,
    accentHex: number,
    elapsed: number
  ): void {
    this.shieldMesh.visible = visible;
    if (!visible) return;

    this.shieldMesh.position.copy(playerPos);
    this.shieldMesh.rotation.y = elapsed * 2.2;
    this.shieldMesh.rotation.x = Math.sin(elapsed * 1.7) * 0.18;

    (this.shieldMat.uniforms.uColor.value as THREE.Color).setHex(accentHex);
    this.shieldMat.uniforms.uProgress.value = THREE.MathUtils.clamp(progress, 0, 1);
    this.shieldMat.uniforms.uTime.value = elapsed;
  }

  clearTrails(): void {
    for (const p of this.trailPool) p.active = false;
    this.trailInst.count = 0;

    for (const m of this.muzzlePool) m.active = false;
    this.muzzleStarInst.count = 0;
    this.muzzleConeInst.count = 0;

    for (const im of this.impactPool) im.active = false;
    this.impactInst.count = 0;

    for (const c of this.contrailPool) c.active = false;
    this.contrailInst.count = 0;

    this.boltInst.count = 0;
    this.warheadInst.count = 0;
    this.enemyOrbInst.count = 0;
    this.thrusterGroup.visible = false;
    this.shieldMesh.visible = false;
    this.hasPrevTips = false;
  }

  getWarmupObjects(): THREE.Object3D[] {
    return [
      this.boltInst,
      this.warheadInst,
      this.trailInst,
      this.enemyOrbInst,
      this.muzzleStarInst,
      this.muzzleConeInst,
      this.impactInst,
      this.thrusterGroup,
      this.contrailInst,
      this.shieldMesh,
    ];
  }

  dispose(): void {
    this.clearTrails();

    this.boltInst.geometry.dispose();
    this.boltMat.dispose();

    this.warheadInst.geometry.dispose();
    this.warheadMat.dispose();

    this.trailInst.geometry.dispose();
    this.trailMat.dispose();

    this.enemyOrbInst.geometry.dispose();
    this.enemyOrbMat.dispose();

    this.muzzleStarInst.geometry.dispose();
    this.muzzleStarMat.dispose();
    this.muzzleConeInst.geometry.dispose();
    this.muzzleConeMat.dispose();

    this.impactInst.geometry.dispose();
    this.impactMat.dispose();

    if (this.machOuterCones.length > 0) this.machOuterCones[0].geometry.dispose();
    if (this.machInnerCones.length > 0) this.machInnerCones[0].geometry.dispose();
    this.machOuterMat.dispose();
    this.machInnerMat.dispose();

    this.contrailInst.geometry.dispose();
    this.contrailMat.dispose();

    this.shieldMesh.geometry.dispose();
    this.shieldMat.dispose();

    this.container.removeFromParent();
  }

  // ==================== INTERNAL POOL UPDATES ====================

  private emitTrailPuff(
    missilePos: THREE.Vector3,
    missileDir: THREE.Vector3,
    color: THREE.Color,
    scale: number,
    backStep = 0
  ): void {
    const puff = this.trailPool[this.trailCursor];
    this.trailCursor = (this.trailCursor + 1) % MAX_MISSILE_TRAILS;

    puff.active = true;
    puff.age = 0;
    puff.maxAge = 0.24 + Math.random() * 0.06;
    puff.baseScale = (0.44 + Math.random() * 0.08) * scale;
    puff.seed = Math.random();
    puff.pos
      .copy(missilePos)
      .addScaledVector(missileDir, -0.58 + backStep)
      .add(
        this.tmpVecA.set(
          (Math.random() - 0.5) * 0.03,
          (Math.random() - 0.5) * 0.03,
          (Math.random() - 0.5) * 0.03
        )
      );
    // Gentle outward thermal drift + residual wake push
    puff.vel
      .copy(missileDir)
      .multiplyScalar(-1.4)
      .add(
        this.tmpVecA.set(
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.5) * 0.35,
          0.8
        )
      );
    void color;
  }

  private updateMissileTrails(dt: number): void {
    let count = 0;
    for (let i = 0; i < MAX_MISSILE_TRAILS; i++) {
      const puff = this.trailPool[i];
      if (!puff.active) continue;

      if (dt > 0) {
        puff.age += dt;
        if (puff.age >= puff.maxAge) {
          puff.active = false;
          continue;
        }
        puff.vel.multiplyScalar(Math.pow(0.18, dt));
        puff.pos.addScaledVector(puff.vel, dt);
      }

      if (count >= MAX_MISSILE_TRAILS) continue;
      const lifeNorm = puff.age / puff.maxAge;
      const expandScale = puff.baseScale * (0.82 + lifeNorm * 0.52);

      this.dummy.position.copy(puff.pos);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(expandScale);
      this.dummy.updateMatrix();
      this.trailInst.setMatrixAt(count, this.dummy.matrix);
      this.trailInst.setColorAt(count, this.trailHotColor);

      const idx3 = count * 3;
      this.trailMetaData[idx3] = lifeNorm;
      this.trailMetaData[idx3 + 1] = puff.seed;
      this.trailMetaData[idx3 + 2] = 1.0;
      count += 1;
    }

    this.trailInst.count = count;
    this.trailInst.instanceMatrix.needsUpdate = true;
    if (this.trailInst.instanceColor) this.trailInst.instanceColor.needsUpdate = true;
    this.trailMetaAttr.needsUpdate = true;
  }

  private updateMuzzleFlashes(dt: number): void {
    let count = 0;
    for (let i = 0; i < MAX_MUZZLE_FLASHES; i++) {
      const m = this.muzzlePool[i];
      if (!m.active) continue;

      if (m.fresh) {
        m.fresh = false;
      } else if (dt > 0) {
        m.age += dt;
        if (m.age >= m.duration) {
          m.active = false;
          continue;
        }
      }

      if (count >= MAX_MUZZLE_FLASHES) continue;
      const progress = m.age / m.duration;

      this.dummy.position.copy(m.pos);
      this.dummy.quaternion.setFromUnitVectors(this.upZ, m.dir);
      this.dummy.scale.setScalar(1.0);
      this.dummy.updateMatrix();

      this.muzzleStarInst.setMatrixAt(count, this.dummy.matrix);
      this.muzzleStarInst.setColorAt(count, m.color);
      this.muzzleConeInst.setMatrixAt(count, this.dummy.matrix);
      this.muzzleConeInst.setColorAt(count, m.color);

      const idx3 = count * 3;
      this.muzzleMetaData[idx3] = progress;
      this.muzzleMetaData[idx3 + 1] = m.seed;
      this.muzzleMetaData[idx3 + 2] = m.scale;
      count += 1;
    }

    this.muzzleStarInst.count = count;
    this.muzzleStarInst.instanceMatrix.needsUpdate = true;
    if (this.muzzleStarInst.instanceColor) this.muzzleStarInst.instanceColor.needsUpdate = true;

    this.muzzleConeInst.count = count;
    this.muzzleConeInst.instanceMatrix.needsUpdate = true;
    if (this.muzzleConeInst.instanceColor) this.muzzleConeInst.instanceColor.needsUpdate = true;

    this.muzzleMetaAttr.needsUpdate = true;
  }

  private updateImpacts(dt: number): void {
    let count = 0;
    for (let i = 0; i < MAX_IMPACTS; i++) {
      const im = this.impactPool[i];
      if (!im.active) continue;

      if (im.fresh) {
        im.fresh = false;
      } else if (dt > 0) {
        im.age += dt;
        if (im.age >= im.duration) {
          im.active = false;
          continue;
        }
      }

      if (count >= MAX_IMPACTS) continue;
      const progress = im.age / im.duration;

      this.dummy.position.copy(im.pos);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(im.scale);
      this.dummy.updateMatrix();
      this.impactInst.setMatrixAt(count, this.dummy.matrix);
      this.impactInst.setColorAt(count, im.color);

      const idx3 = count * 3;
      this.impactMetaData[idx3] = progress;
      this.impactMetaData[idx3 + 1] = im.isCrit ? 1.0 : 0.0;
      this.impactMetaData[idx3 + 2] = im.seed;
      count += 1;
    }

    this.impactInst.count = count;
    this.impactInst.instanceMatrix.needsUpdate = true;
    if (this.impactInst.instanceColor) this.impactInst.instanceColor.needsUpdate = true;
    this.impactMetaAttr.needsUpdate = true;
  }

  private emitContrailSegment(
    prevTip: THREE.Vector3,
    curTip: THREE.Vector3,
    streamSpeed: number,
    dt: number,
    color: THREE.Color,
    boostActive: boolean
  ): void {
    const seg = this.contrailPool[this.contrailCursor];
    this.contrailCursor = (this.contrailCursor + 1) % MAX_CONTRAILS;

    // Virtual scrolled tail end of this frame's segment
    const scrolledPrevX = prevTip.x;
    const scrolledPrevY = prevTip.y;
    const scrolledPrevZ = prevTip.z + streamSpeed * dt;

    seg.pos.set(
      (curTip.x + scrolledPrevX) * 0.5,
      (curTip.y + scrolledPrevY) * 0.5,
      (curTip.z + scrolledPrevZ) * 0.5
    );
    seg.dir.set(
      scrolledPrevX - curTip.x,
      scrolledPrevY - curTip.y,
      scrolledPrevZ - curTip.z
    );
    const len = seg.dir.length();
    if (len > 1e-5) {
      seg.dir.divideScalar(len);
    } else {
      seg.dir.set(0, 0, 1);
    }

    seg.active = true;
    seg.age = 0;
    seg.maxAge = boostActive ? 0.34 : 0.25;
    seg.width = boostActive ? 0.13 : 0.085;
    seg.length = Math.max(0.45, len * 1.06);
    seg.vel.set(0, 0, streamSpeed);
    seg.color.copy(color);
  }

  private updateContrails(dt: number): void {
    let count = 0;
    for (let i = 0; i < MAX_CONTRAILS; i++) {
      const c = this.contrailPool[i];
      if (!c.active) continue;

      if (dt > 0) {
        c.age += dt;
        if (c.age >= c.maxAge) {
          c.active = false;
          continue;
        }
        c.pos.addScaledVector(c.vel, dt);
      }

      if (count >= MAX_CONTRAILS) continue;
      const lifeNorm = c.age / c.maxAge;

      this.dummy.position.copy(c.pos);
      this.dummy.quaternion.setFromUnitVectors(this.upZ, c.dir);
      this.dummy.scale.setScalar(1.0);
      this.dummy.updateMatrix();
      this.contrailInst.setMatrixAt(count, this.dummy.matrix);
      this.contrailInst.setColorAt(count, c.color);

      const idx3 = count * 3;
      this.contrailMetaData[idx3] = lifeNorm;
      this.contrailMetaData[idx3 + 1] = c.width * (1.0 - lifeNorm * 0.65);
      this.contrailMetaData[idx3 + 2] = c.length;
      count += 1;
    }

    this.contrailInst.count = count;
    this.contrailInst.instanceMatrix.needsUpdate = true;
    if (this.contrailInst.instanceColor) this.contrailInst.instanceColor.needsUpdate = true;
    this.contrailMetaAttr.needsUpdate = true;
  }
}
