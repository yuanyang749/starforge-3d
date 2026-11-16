import * as THREE from 'three';

const SHOCKWAVE_VERT = `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = -mvPos.xyz;
    vec3 nrm = normalMatrix * normal;
    vNormalView = length(nrm) > 1e-5 ? normalize(nrm) : vec3(0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const SHOCKWAVE_FRAG = `
  uniform float uProgress;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;

  void main() {
    vec2 centered = vUv - vec2(0.5);
    float dist = length(centered) * 2.0;
    float outerBand = smoothstep(0.56, 0.78, dist) * (1.0 - smoothstep(0.83, 0.99, dist));
    float innerRipple = smoothstep(0.30, 0.46, dist) * (1.0 - smoothstep(0.50, 0.65, dist)) * 0.38;
    float band = clamp(outerBand + innerRipple, 0.0, 1.0);
    float fade = (1.0 - uProgress) * (1.0 - uProgress);
    float alpha = band * fade;
    if (!(alpha >= 0.01)) discard;

    vec3 hotCore = mix(vec3(1.0, 0.98, 0.92) * 2.25, uColor * 1.65, smoothstep(0.0, 0.42, uProgress));
    vec3 col = mix(uColor * 1.5, hotCore, smoothstep(0.45, 0.92, outerBand));
    gl_FragColor = vec4(col, alpha);
  }
`;

const FIREBALL_VERT = `
  uniform float uProgress;
  uniform float uSeed;
  varying vec3 vLocalPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vLocalPos = position;
    float n = noise3(position * 2.3 + vec3(uSeed, uProgress * 2.5, uSeed * 0.7));
    vec3 displaced = position + normal * ((n - 0.35) * (0.25 + uProgress * 0.55));
    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
    vViewDir = length(mvPos.xyz) > 1e-5 ? normalize(-mvPos.xyz) : vec3(0.0, 0.0, 1.0);
    vec3 nrm = normalMatrix * normal;
    vNormalView = length(nrm) > 1e-5 ? normalize(nrm) : vec3(0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FIREBALL_FRAG = `
  uniform float uProgress;
  uniform float uSeed;
  uniform vec3 uAccent;
  varying vec3 vLocalPos;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    float n = noise3(vLocalPos * 3.1 + vec3(uSeed, uProgress * 3.0, -uSeed)) * 0.65
            + noise3(vLocalPos * 6.4 - vec3(uProgress * 4.0, uSeed, 0.0)) * 0.35;

    float threshold = smoothstep(0.18, 0.98, uProgress) * 1.05;
    if (!(n >= threshold)) discard;

    vec3 nView = length(vNormalView) > 1e-5 ? normalize(vNormalView) : vec3(0.0, 0.0, 1.0);
    vec3 vDir = length(vViewDir) > 1e-5 ? normalize(vViewDir) : vec3(0.0, 0.0, 1.0);
    float rim = clamp(1.0 - max(0.0, dot(nView, vDir)), 0.0, 1.0);
    vec3 coreWhite = vec3(1.0, 0.88, 0.54) * 1.78;
    vec3 midFire = mix(vec3(1.0, 0.32, 0.04), uAccent, 0.38) * 1.38;
    vec3 smokeDark = vec3(0.11, 0.12, 0.16);

    float corePocket = smoothstep(threshold + 0.18, threshold + 0.52, n) * (1.0 - smoothstep(0.06, 0.40, uProgress));
    vec3 col = mix(coreWhite, midFire, smoothstep(0.0, 0.20, uProgress));
    col = mix(col, smokeDark, smoothstep(0.35, 0.84, uProgress));
    col += coreWhite * corePocket * 0.35;
    col += uAccent * rim * (1.0 - uProgress) * 1.15;

    float alpha = (1.0 - smoothstep(0.65, 1.0, uProgress)) * smoothstep(threshold, threshold + 0.14, n);
    gl_FragColor = vec4(col, alpha);
  }
`;

const SPARK_VERT = `
  attribute float aSparkLife;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLife;

  void main() {
    vUv = uv;
    vLife = clamp(aSparkLife, 0.0, 1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0, 0.72, 0.28);
    #endif

    vec4 worldPos = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      worldPos = instanceMatrix * worldPos;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * worldPos;
  }
`;

const SPARK_FRAG = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLife;

  void main() {
    float t = clamp(vUv.y, 0.0, 1.0); // 0 = rear tail, 1 = leading head
    float u = abs(vUv.x - 0.5) * 2.0;

    // Tapered needle profile: fine ionized tail expanding into bright droplet head around t=0.82
    float needleW = mix(0.08, 0.85, pow(max(1e-4, t), 0.8)) * (1.0 - smoothstep(0.82, 1.0, t));
    float d = u / max(0.03, needleW);

    float headCore = exp(-d * d * 11.0) * smoothstep(0.42, 0.88, t) * (1.0 - smoothstep(0.92, 1.0, t));
    float tailPlasma = exp(-d * d * 3.0) * smoothstep(0.0, 0.45, t) * (1.0 - smoothstep(0.88, 1.0, t));
    float fade = 1.0 - smoothstep(0.22, 1.0, vLife);

    float alpha = clamp((tailPlasma * 0.85 + headCore) * fade, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec3 headWhite = vec3(1.0, 0.98, 0.92) * 2.38;
    vec3 tailCol = vColor * 1.65;
    vec3 col = mix(tailCol, headWhite, clamp(headCore * 1.1 + smoothstep(0.72, 0.96, t) * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

const LIGHTNING_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LIGHTNING_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSeed;
  varying vec2 vUv;

  void main() {
    float d = abs(vUv.x);
    float core = exp(-d * d * 26.0);
    float halo = exp(-d * d * 3.8);
    float endFade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
    float flicker = 0.84 + 0.16 * sin(vUv.y * 28.0 + uSeed * 12.0);

    float alpha = clamp((halo * 0.72 + core) * uOpacity * endFade * flicker, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec3 col = uColor * 1.7 * halo + vec3(1.0, 0.98, 1.0) * 2.4 * core;
    gl_FragColor = vec4(col, alpha);
  }
`;

const BEAM_HALO_VERT = `
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

const BEAM_HALO_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uProgress;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vec3 nView = length(vNormalView) > 1e-5 ? normalize(vNormalView) : vec3(0.0, 0.0, 1.0);
    vec3 vDir = length(vViewDir) > 1e-5 ? normalize(vViewDir) : vec3(0.0, 0.0, 1.0);
    float ndv = clamp(abs(dot(nView, vDir)), 0.0, 1.0);
    float radial = pow(max(1e-4, ndv), 2.1);
    float endFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
    float shimmer = 0.85 + 0.15 * sin(vUv.y * 22.0 - uProgress * 24.0);

    float alpha = clamp(radial * uOpacity * endFade * shimmer, 0.0, 1.0);
    if (!(alpha >= 0.01)) discard;

    vec3 col = mix(uColor * 1.68, vec3(1.0, 0.98, 1.0) * 2.1, pow(max(1e-4, ndv), 5.0) * 0.45);
    gl_FragColor = vec4(col, alpha);
  }
`;

function createCrossedSparkGeometry(): THREE.BufferGeometry {
  const hw = 0.16;
  const hl = 0.5;
  const positions = new Float32Array([
    // Horizontal XZ plane
    -hw, 0, -hl,
    hw, 0, -hl,
    hw, 0, hl,
    -hw, 0, hl,
    // Vertical YZ plane
    0, -hw, -hl,
    0, hw, -hl,
    0, hw, hl,
    0, -hw, hl,
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

function createLightningRibbonGeometry(jagged: THREE.Vector3[]): THREE.BufferGeometry {
  const count = jagged.length;
  const positions = new Float32Array(count * 4 * 3);
  const uvs = new Float32Array(count * 4 * 2);
  const indices: number[] = [];

  const tangent = new THREE.Vector3();
  const refUp = new THREE.Vector3(0, 1, 0);
  const refAlt = new THREE.Vector3(1, 0, 0);
  const sideA = new THREE.Vector3();
  const sideB = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const prev = jagged[Math.max(0, i - 1)];
    const next = jagged[Math.min(count - 1, i + 1)];
    tangent.subVectors(next, prev);
    if (tangent.lengthSq() < 1e-6) {
      tangent.set(0, 0, -1);
    } else {
      tangent.normalize();
    }

    const ref = Math.abs(tangent.y) < 0.9 ? refUp : refAlt;
    sideA.crossVectors(tangent, ref).normalize();
    sideB.crossVectors(tangent, sideA).normalize();

    const t = count > 1 ? i / (count - 1) : 0;
    const width = 0.44 * (0.68 + 0.32 * Math.sin(t * Math.PI));
    const p = jagged[i];

    // Ribbon A: vertices i*4 + 0, i*4 + 1
    const baseV = i * 4;
    const pOff = baseV * 3;
    positions[pOff] = p.x - sideA.x * width;
    positions[pOff + 1] = p.y - sideA.y * width;
    positions[pOff + 2] = p.z - sideA.z * width;

    positions[pOff + 3] = p.x + sideA.x * width;
    positions[pOff + 4] = p.y + sideA.y * width;
    positions[pOff + 5] = p.z + sideA.z * width;

    // Ribbon B: vertices i*4 + 2, i*4 + 3
    positions[pOff + 6] = p.x - sideB.x * width;
    positions[pOff + 7] = p.y - sideB.y * width;
    positions[pOff + 8] = p.z - sideB.z * width;

    positions[pOff + 9] = p.x + sideB.x * width;
    positions[pOff + 10] = p.y + sideB.y * width;
    positions[pOff + 11] = p.z + sideB.z * width;

    const uOff = baseV * 2;
    uvs[uOff] = -1;
    uvs[uOff + 1] = t;
    uvs[uOff + 2] = 1;
    uvs[uOff + 3] = t;
    uvs[uOff + 4] = -1;
    uvs[uOff + 5] = t;
    uvs[uOff + 6] = 1;
    uvs[uOff + 7] = t;

    if (i < count - 1) {
      const nextV = (i + 1) * 4;
      // Ribbon A quad
      indices.push(baseV, baseV + 1, nextV + 1, baseV, nextV + 1, nextV);
      // Ribbon B quad
      indices.push(baseV + 2, baseV + 3, nextV + 3, baseV + 2, nextV + 3, nextV + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

interface ExplosionSlot {
  active: boolean;
  age: number;
  duration: number;
  baseScale: number;
  seed: number;
  origin: THREE.Vector3;
  group: THREE.Group;
  flashMesh: THREE.Mesh;
  flashMat: THREE.MeshBasicMaterial;
  fireMesh: THREE.Mesh;
  fireMat: THREE.ShaderMaterial;
  ring1: THREE.Mesh;
  ring2: THREE.Mesh;
  ringMat: THREE.ShaderMaterial;
  light: THREE.PointLight | null;
}

interface DebrisParticle {
  active: boolean;
  age: number;
  maxAge: number;
  scale: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  color: THREE.Color;
}

interface SparkParticle {
  active: boolean;
  age: number;
  maxAge: number;
  thickness: number;
  length: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
}

interface DetachedPart {
  obj: THREE.Object3D;
  baseScale: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  maxAge: number;
  smokeAcc: number;
}

interface LightningBolt {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  maxAge: number;
}

interface RefractiveBeam {
  group: THREE.Group;
  coreMat: THREE.MeshBasicMaterial;
  haloMat: THREE.ShaderMaterial;
  age: number;
  maxAge: number;
}

const MAX_EXPLOSIONS = 18;
const MAX_EXPLOSION_LIGHTS = 6;
const MAX_DEBRIS = 280;
const MAX_SPARKS = 440;
const MAX_DETACHED_PARTS = 24;
const MAX_LIGHTNING_BOLTS = 24;
const MAX_REFRACTIVE_BEAMS = 32;

export class VfxSystem {
  private readonly container = new THREE.Group();
  private readonly explosionSlots: ExplosionSlot[] = [];
  private readonly flashGeo = new THREE.SphereGeometry(1, 14, 10);
  private readonly fireGeo = new THREE.IcosahedronGeometry(1, 2);
  private readonly ringGeo = new THREE.PlaneGeometry(2.6, 2.6);
  private readonly beamCoreGeo = new THREE.CylinderGeometry(0.065, 0.065, 1, 8);
  private readonly beamHaloGeo = new THREE.CylinderGeometry(0.36, 0.36, 1, 14, 1, true);

  private readonly debrisInst: THREE.InstancedMesh;
  private readonly debrisPool: DebrisParticle[] = [];
  private debrisCursor = 0;

  private readonly sparkInst: THREE.InstancedMesh;
  private readonly sparkLifeAttr: THREE.InstancedBufferAttribute;
  private readonly sparkLifeData = new Float32Array(MAX_SPARKS);
  private readonly sparkPool: SparkParticle[] = [];
  private sparkCursor = 0;

  private readonly detachedParts: DetachedPart[] = [];
  private readonly lightningBolts: LightningBolt[] = [];
  private readonly refractiveBeams: RefractiveBeam[] = [];

  private readonly dummyObj = new THREE.Object3D();
  private readonly tmpDir = new THREE.Vector3();
  private readonly upZ = new THREE.Vector3(0, 0, 1);
  private readonly upY = new THREE.Vector3(0, 1, 0);
  private readonly whiteColor = new THREE.Color(0xffffff);
  private readonly warmWhiteColor = new THREE.Color(0xfff1c9);

  constructor(scene: THREE.Scene) {
    this.container.name = 'VfxSystemGroup';
    scene.add(this.container);

    // Build pooled 5-layer explosion slots
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      const group = new THREE.Group();
      group.visible = false;

      const flashMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.1, 1.95, 1.62),
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flashMesh = new THREE.Mesh(this.flashGeo, flashMat);

      const fireMat = new THREE.ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uSeed: { value: Math.random() * 50 },
          uAccent: { value: new THREE.Color(0xff6b2b) },
        },
        vertexShader: FIREBALL_VERT,
        fragmentShader: FIREBALL_FRAG,
        transparent: true,
        depthWrite: false,
      });
      const fireMesh = new THREE.Mesh(this.fireGeo, fireMat);

      const ringMat = new THREE.ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uColor: { value: new THREE.Color(0x00f0ff) },
        },
        vertexShader: SHOCKWAVE_VERT,
        fragmentShader: SHOCKWAVE_FRAG,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring1 = new THREE.Mesh(this.ringGeo, ringMat);
      const ring2 = new THREE.Mesh(this.ringGeo, ringMat);

      let light: THREE.PointLight | null = null;
      if (i < MAX_EXPLOSION_LIGHTS) {
        light = new THREE.PointLight(0xff8c2b, 0, 26, 2);
        this.container.add(light);
      }

      group.add(flashMesh, fireMesh, ring1, ring2);
      this.container.add(group);

      this.explosionSlots.push({
        active: false,
        age: 0,
        duration: 0.7,
        baseScale: 1,
        seed: i * 7.13,
        origin: new THREE.Vector3(),
        group,
        flashMesh,
        flashMat,
        fireMesh,
        fireMat,
        ring1,
        ring2,
        ringMat,
        light,
      });
    }

    // Instanced debris shards
    const debrisGeo = new THREE.IcosahedronGeometry(0.24, 0);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.72,
      emissive: 0x33160a,
      emissiveIntensity: 0.5,
    });
    this.debrisInst = new THREE.InstancedMesh(debrisGeo, debrisMat, MAX_DEBRIS);
    this.debrisInst.frustumCulled = false;
    this.debrisInst.setColorAt(0, new THREE.Color(0xffffff));
    this.debrisInst.count = 0;
    this.container.add(this.debrisInst);

    for (let i = 0; i < MAX_DEBRIS; i++) {
      this.debrisPool.push({
        active: false,
        age: 0,
        maxAge: 1,
        scale: 1,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(),
        color: new THREE.Color(0x94a3b8),
      });
    }

    // Instanced HDR tapered spark needles (custom GLSL ShaderMaterial)
    const sparkGeo = createCrossedSparkGeometry();
    this.sparkLifeData[0] = 0.15;
    this.sparkLifeAttr = new THREE.InstancedBufferAttribute(this.sparkLifeData, 1);
    this.sparkLifeAttr.setUsage(THREE.DynamicDrawUsage);
    sparkGeo.setAttribute('aSparkLife', this.sparkLifeAttr);

    const sparkMat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sparkInst = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    this.sparkInst.frustumCulled = false;
    this.sparkInst.setColorAt(0, new THREE.Color(0xffffff));
    this.sparkInst.count = 0;
    this.container.add(this.sparkInst);

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparkPool.push({
        active: false,
        age: 0,
        maxAge: 0.4,
        thickness: 1,
        length: 1,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(0xffb347),
      });
    }
  }

  getGroup(): THREE.Group {
    return this.container;
  }

  /**
   * Returns lightweight warmup meshes sharing slot-0 GLSL shaders and instanced particle
   * materials so AssetLoader.warmPools can pre-compile all VFX shaders at boot without
   * reparenting live VfxSystem objects out of the scene.
   */
  getWarmupObjects(): THREE.Object3D[] {
    const slot0 = this.explosionSlots[0];
    const warmupFlash = new THREE.Mesh(this.flashGeo, slot0.flashMat);
    const warmupFire = new THREE.Mesh(this.fireGeo, slot0.fireMat);
    const warmupRing = new THREE.Mesh(this.ringGeo, slot0.ringMat);

    const identity = new THREE.Matrix4();

    const warmupDebris = new THREE.InstancedMesh(
      this.debrisInst.geometry,
      this.debrisInst.material,
      1
    );
    warmupDebris.frustumCulled = false;
    warmupDebris.setMatrixAt(0, identity);
    warmupDebris.setColorAt(0, this.whiteColor);
    warmupDebris.count = 1;

    const warmupSparks = new THREE.InstancedMesh(
      this.sparkInst.geometry,
      this.sparkInst.material,
      1
    );
    warmupSparks.frustumCulled = false;
    warmupSparks.setMatrixAt(0, identity);
    warmupSparks.setColorAt(0, this.whiteColor);
    warmupSparks.count = 1;

    const warmupBeamGroup = new THREE.Group();
    const warmupBeamCore = new THREE.Mesh(
      this.beamCoreGeo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.2, 2.2, 2.3),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const warmupBeamHalo = new THREE.Mesh(
      this.beamHaloGeo,
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xc084fc) },
          uOpacity: { value: 0.85 },
          uProgress: { value: 0.1 },
        },
        vertexShader: BEAM_HALO_VERT,
        fragmentShader: BEAM_HALO_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    warmupBeamGroup.add(warmupBeamHalo, warmupBeamCore);

    const warmupLightning = new THREE.Mesh(
      createLightningRibbonGeometry([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1, 0),
      ]),
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0x38bdf8) },
          uOpacity: { value: 1.0 },
          uSeed: { value: 0.5 },
        },
        vertexShader: LIGHTNING_VERT,
        fragmentShader: LIGHTNING_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );

    return [
      warmupFlash,
      warmupFire,
      warmupRing,
      warmupDebris,
      warmupSparks,
      warmupBeamGroup,
      warmupLightning,
    ];
  }

  clear(): void {
    this.clearTransientEffects();
  }

  clearTransientEffects(): void {
    for (const s of this.explosionSlots) {
      s.active = false;
      s.group.visible = false;
      if (s.light) s.light.intensity = 0;
    }
    for (const d of this.debrisPool) d.active = false;
    for (const sp of this.sparkPool) sp.active = false;
    this.debrisInst.count = 0;
    this.sparkInst.count = 0;

    for (const dp of this.detachedParts) {
      dp.obj.removeFromParent();
    }
    this.detachedParts.length = 0;

    for (const lb of this.lightningBolts) {
      lb.mesh.removeFromParent();
      lb.mesh.geometry.dispose();
      lb.mat.dispose();
    }
    this.lightningBolts.length = 0;

    for (const rb of this.refractiveBeams) {
      rb.group.removeFromParent();
      rb.coreMat.dispose();
      rb.haloMat.dispose();
    }
    this.refractiveBeams.length = 0;
  }

  spawnExplosion(pos: THREE.Vector3, scale = 1.6, accentHex = 0xff7b29, withDebris = true): void {
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    const safeScale = Math.max(0.1, Number.isFinite(scale) ? scale : 1.6);

    let slot = this.explosionSlots.find((s) => !s.active);
    if (!slot) {
      slot = this.explosionSlots.reduce((oldest, cur) =>
        cur.age / cur.duration > oldest.age / oldest.duration ? cur : oldest
      );
    }

    slot.active = true;
    slot.age = 0;
    slot.duration = 0.58 + safeScale * 0.14;
    slot.baseScale = safeScale;
    slot.origin.copy(pos);
    slot.group.position.copy(pos);
    slot.group.visible = true;

    slot.flashMesh.visible = true;
    slot.flashMat.opacity = 1;
    slot.flashMesh.scale.setScalar(safeScale * 0.45);
    slot.fireMesh.scale.setScalar(safeScale * 0.55);
    slot.ring1.scale.setScalar(safeScale * 0.35);
    slot.ring2.scale.setScalar(safeScale * 0.35 * 0.88);

    slot.fireMat.uniforms.uProgress.value = 0;
    slot.fireMat.uniforms.uSeed.value = Math.random() * 100;
    (slot.fireMat.uniforms.uAccent.value as THREE.Color).setHex(accentHex);

    slot.ringMat.uniforms.uProgress.value = 0;
    (slot.ringMat.uniforms.uColor.value as THREE.Color).setHex(accentHex);

    slot.ring1.rotation.set(
      (Math.random() - 0.5) * 0.6,
      (Math.random() - 0.5) * 0.6,
      Math.random() * Math.PI
    );
    slot.ring2.rotation.set(
      slot.ring1.rotation.x + Math.PI * 0.45,
      slot.ring1.rotation.y + 0.5,
      Math.random() * Math.PI
    );

    if (slot.light) {
      slot.light.position.copy(pos);
      slot.light.color.setHex(accentHex).lerp(this.warmWhiteColor, 0.35);
      slot.light.intensity = 10 * safeScale;
      slot.light.distance = 22 + safeScale * 6;
    }

    if (withDebris) {
      const debrisCount = Math.min(24, Math.round(7 + safeScale * 5));
      for (let i = 0; i < debrisCount; i++) {
        this.spawnDebris(pos, safeScale, i % 3 === 0 ? accentHex : 0x64748b);
      }
      const sparkCount = Math.min(34, Math.round(10 + safeScale * 7));
      this.spawnSparks(pos, sparkCount, accentHex, 10 + safeScale * 4);
    }
  }

  spawnSparks(pos: THREE.Vector3, count: number, colorHex: number, speed = 15): void {
    const safeCount = Math.min(MAX_SPARKS, Math.max(0, Math.round(count)));
    const safeSpeed = Number.isFinite(speed) ? speed : 15;
    for (let i = 0; i < safeCount; i++) {
      const sp = this.sparkPool[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS;
      sp.active = true;
      sp.age = 0;
      sp.maxAge = 0.22 + Math.random() * 0.3;
      sp.thickness = 0.7 + Math.random() * 0.9;
      sp.length = 0.8 + Math.random() * 1.4;
      sp.pos.copy(pos);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const v = safeSpeed * (0.45 + Math.random() * 0.85);
      sp.vel.set(
        Math.sin(phi) * Math.cos(theta) * v,
        Math.sin(phi) * Math.sin(theta) * v,
        Math.cos(phi) * v
      );
      sp.color.setHex(colorHex);
      if (Math.random() < 0.35) sp.color.lerp(this.whiteColor, 0.6);
    }
  }

  private spawnDebris(pos: THREE.Vector3, scale: number, colorHex: number): void {
    const d = this.debrisPool[this.debrisCursor];
    this.debrisCursor = (this.debrisCursor + 1) % MAX_DEBRIS;
    d.active = true;
    d.age = 0;
    d.maxAge = 0.65 + Math.random() * 0.65;
    d.scale = (0.45 + Math.random() * 0.9) * Math.min(2.4, Math.max(0.7, scale * 0.6));
    d.pos.copy(pos);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const v = (8 + scale * 3.5) * (0.45 + Math.random() * 0.85);
    d.vel.set(
      Math.sin(phi) * Math.cos(theta) * v,
      Math.sin(phi) * Math.sin(theta) * v + 2.5,
      Math.cos(phi) * v + 4
    );
    d.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    d.spin.set(
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 16
    );
    d.color.setHex(colorHex);
  }

  spawnDetachedPart(
    sourceNode: THREE.Object3D,
    blastOrigin: THREE.Vector3,
    accentHex = 0xff7b29
  ): void {
    if (!sourceNode.visible) return;
    sourceNode.updateWorldMatrix(true, true);
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    sourceNode.matrixWorld.decompose(worldPos, worldQuat, worldScale);

    // Clone purely non-skinned visual subtree so detaching leaves boss rig intact
    const fragment = sourceNode.clone(true);
    fragment.position.copy(worldPos);
    fragment.quaternion.copy(worldQuat);
    fragment.scale.copy(worldScale);
    fragment.visible = true;
    this.container.add(fragment);

    sourceNode.visible = false;

    if (this.detachedParts.length >= MAX_DETACHED_PARTS) {
      const oldest = this.detachedParts.shift();
      if (oldest) oldest.obj.removeFromParent();
    }

    const outward = new THREE.Vector3().subVectors(worldPos, blastOrigin);
    if (outward.lengthSq() < 0.01) {
      outward.set((Math.random() - 0.5) * 2, Math.random() + 0.3, (Math.random() - 0.5) * 2);
    }
    outward.normalize();

    const vel = outward.multiplyScalar(11 + Math.random() * 9);
    vel.y += 3 + Math.random() * 4;
    vel.z += 6; // Drift visibly past camera

    this.detachedParts.push({
      obj: fragment,
      baseScale: worldScale.clone(),
      vel,
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9
      ),
      age: 0,
      maxAge: 1.5,
      smokeAcc: 0,
    });

    this.spawnExplosion(worldPos, 1.85, accentHex, true);
  }

  spawnLightningBolt(points: THREE.Vector3[], colorHex = 0x38bdf8): void {
    if (points.length < 2) return;
    if (this.lightningBolts.length >= MAX_LIGHTNING_BOLTS) {
      const oldest = this.lightningBolts.shift();
      if (oldest) {
        oldest.mesh.removeFromParent();
        oldest.mesh.geometry.dispose();
        oldest.mat.dispose();
      }
    }

    const jagged: THREE.Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        if (s > 0) {
          p.x += (Math.random() - 0.5) * 1.1;
          p.y += (Math.random() - 0.5) * 1.1;
          p.z += (Math.random() - 0.5) * 0.7;
        }
        jagged.push(p);
      }
    }
    jagged.push(points[points.length - 1].clone());

    const geo = createLightningRibbonGeometry(jagged);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
        uOpacity: { value: 1.0 },
        uSeed: { value: Math.random() },
      },
      vertexShader: LIGHTNING_VERT,
      fragmentShader: LIGHTNING_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    this.container.add(mesh);
    this.lightningBolts.push({ mesh, mat, age: 0, maxAge: 0.22 });
  }

  /**
   * Renders a crisp HDR refractive laser bounce beam (white-hot core + soft neon outer halo)
   * between two world points (used by Aero passive).
   */
  spawnRefractiveBeam(from: THREE.Vector3, to: THREE.Vector3, colorHex = 0xc084fc): void {
    this.tmpDir.subVectors(to, from);
    const dist = this.tmpDir.length();
    if (!Number.isFinite(dist) || dist < 0.05) return;

    if (this.refractiveBeams.length >= MAX_REFRACTIVE_BEAMS) {
      const oldest = this.refractiveBeams.shift();
      if (oldest) {
        oldest.group.removeFromParent();
        oldest.coreMat.dispose();
        oldest.haloMat.dispose();
      }
    }

    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.25, 2.2, 2.35),
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
        uOpacity: { value: 0.9 },
        uProgress: { value: 0.0 },
      },
      vertexShader: BEAM_HALO_VERT,
      fragmentShader: BEAM_HALO_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const coreMesh = new THREE.Mesh(this.beamCoreGeo, coreMat);
    const haloMesh = new THREE.Mesh(this.beamHaloGeo, haloMat);

    const group = new THREE.Group();
    group.add(haloMesh, coreMesh);
    group.position.addVectors(from, to).multiplyScalar(0.5);
    this.tmpDir.divideScalar(dist);
    group.quaternion.setFromUnitVectors(this.upY, this.tmpDir);
    group.scale.set(1.25, dist, 1.25);

    this.container.add(group);
    this.refractiveBeams.push({ group, coreMat, haloMat, age: 0, maxAge: 0.24 });
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    // 1. Explosions
    for (const s of this.explosionSlots) {
      if (!s.active) continue;
      s.age += dt;
      const p = s.age / s.duration;
      if (p >= 1) {
        s.active = false;
        s.group.visible = false;
        if (s.light) s.light.intensity = 0;
        continue;
      }

      const flashAlpha = Math.max(0, 1 - p / 0.16);
      s.flashMesh.visible = flashAlpha > 0.01;
      s.flashMesh.scale.setScalar(s.baseScale * (0.45 + p * 3.4));
      s.flashMat.opacity = flashAlpha;

      const fireScale = s.baseScale * (0.55 + Math.pow(p, 0.55) * 1.85);
      s.fireMesh.scale.setScalar(fireScale);
      s.fireMesh.rotation.y += dt * 1.8;
      s.fireMat.uniforms.uProgress.value = p;

      const ringScale = s.baseScale * (0.35 + Math.pow(p, 0.45) * 2.9);
      s.ring1.scale.setScalar(ringScale);
      s.ring2.scale.setScalar(ringScale * 0.88);
      s.ringMat.uniforms.uProgress.value = p;

      if (s.light) {
        s.light.intensity = Math.max(0, 1 - p / 0.42) * 10 * s.baseScale;
      }
    }

    // 2. Debris instances
    let activeDebris = 0;
    for (const d of this.debrisPool) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.maxAge) {
        d.active = false;
        continue;
      }
      if (activeDebris >= MAX_DEBRIS) continue;
      const p = d.age / d.maxAge;
      d.vel.multiplyScalar(Math.pow(0.28, dt));
      d.vel.y -= dt * 4.5;
      d.pos.addScaledVector(d.vel, dt);
      d.rot.x += d.spin.x * dt;
      d.rot.y += d.spin.y * dt;
      d.rot.z += d.spin.z * dt;

      this.dummyObj.position.copy(d.pos);
      this.dummyObj.rotation.copy(d.rot);
      this.dummyObj.scale.setScalar(d.scale * (1 - p * 0.85));
      this.dummyObj.updateMatrix();
      this.debrisInst.setMatrixAt(activeDebris, this.dummyObj.matrix);
      this.debrisInst.setColorAt(activeDebris, d.color);
      activeDebris += 1;
    }
    this.debrisInst.count = activeDebris;
    this.debrisInst.instanceMatrix.needsUpdate = true;
    if (this.debrisInst.instanceColor) this.debrisInst.instanceColor.needsUpdate = true;

    // 3. Tapered HDR Spark Needles
    let activeSparks = 0;
    for (const sp of this.sparkPool) {
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.maxAge) {
        sp.active = false;
        continue;
      }
      if (activeSparks >= MAX_SPARKS) continue;
      const p = sp.age / sp.maxAge;
      sp.vel.multiplyScalar(Math.pow(0.18, dt));
      sp.pos.addScaledVector(sp.vel, dt);

      this.dummyObj.position.copy(sp.pos);
      const speed = sp.vel.length();
      if (speed > 0.05) {
        this.tmpDir.copy(sp.vel).divideScalar(speed);
        this.dummyObj.quaternion.setFromUnitVectors(this.upZ, this.tmpDir);
      } else {
        this.dummyObj.quaternion.identity();
      }
      const fade = 1 - p;
      this.dummyObj.scale.set(
        sp.thickness * fade,
        sp.thickness * fade,
        sp.length * (0.45 + fade * 1.15)
      );
      this.dummyObj.updateMatrix();
      this.sparkInst.setMatrixAt(activeSparks, this.dummyObj.matrix);
      this.sparkInst.setColorAt(activeSparks, sp.color);
      this.sparkLifeData[activeSparks] = p;
      activeSparks += 1;
    }
    this.sparkInst.count = activeSparks;
    this.sparkInst.instanceMatrix.needsUpdate = true;
    if (this.sparkInst.instanceColor) this.sparkInst.instanceColor.needsUpdate = true;
    this.sparkLifeAttr.needsUpdate = true;

    // 4. Detached boss child fragments
    for (let i = this.detachedParts.length - 1; i >= 0; i--) {
      const dp = this.detachedParts[i];
      dp.age += dt;
      if (dp.age >= dp.maxAge) {
        this.spawnExplosion(dp.obj.position, 1.1, 0xff6b2b, false);
        dp.obj.removeFromParent();
        this.detachedParts.splice(i, 1);
        continue;
      }
      dp.vel.y -= dt * 3.8;
      dp.obj.position.addScaledVector(dp.vel, dt);
      dp.obj.rotation.x += dp.spin.x * dt;
      dp.obj.rotation.y += dp.spin.y * dt;
      dp.obj.rotation.z += dp.spin.z * dt;
      const shrink = Math.max(0.05, 1 - Math.pow(dp.age / dp.maxAge, 2) * 0.65);
      dp.obj.scale.copy(dp.baseScale).multiplyScalar(shrink);

      dp.smokeAcc += dt;
      if (dp.smokeAcc >= 0.065) {
        dp.smokeAcc = 0;
        this.spawnSparks(dp.obj.position, 3, 0xff8c2b, 6);
      }
    }

    // 5. Chain lightning ribbons (inner white core + neon outer halo)
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const lb = this.lightningBolts[i];
      lb.age += dt;
      const p = lb.age / lb.maxAge;
      if (p >= 1) {
        lb.mesh.removeFromParent();
        lb.mesh.geometry.dispose();
        lb.mat.dispose();
        this.lightningBolts.splice(i, 1);
        continue;
      }
      lb.mat.uniforms.uOpacity.value = 1 - p;
    }

    // 6. Refractive laser bounce beams (inner white core + neon outer halo)
    for (let i = this.refractiveBeams.length - 1; i >= 0; i--) {
      const rb = this.refractiveBeams[i];
      rb.age += dt;
      const p = rb.age / rb.maxAge;
      if (p >= 1) {
        rb.group.removeFromParent();
        rb.coreMat.dispose();
        rb.haloMat.dispose();
        this.refractiveBeams.splice(i, 1);
        continue;
      }
      const fade = 1 - p;
      rb.coreMat.opacity = fade;
      rb.haloMat.uniforms.uOpacity.value = 0.9 * fade;
      rb.haloMat.uniforms.uProgress.value = p;
      const radial = 1.25 * (1 - p * 0.55);
      rb.group.scale.x = radial;
      rb.group.scale.z = radial;
    }
  }
}
