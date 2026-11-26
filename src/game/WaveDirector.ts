import * as THREE from 'three';
import {
  ACT_THEMES,
  BOSSES,
  type BossConfig,
  type BossId,
  type ModelKey,
} from '../assets/manifest';
import { AssetLoader, type PooledModelInstance } from '../engine/AssetLoader';
import { AnimationRig } from '../engine/AnimationRig';

export type EnemyKind = 'enemy_drone' | 'enemy_turret' | 'enemy_rover' | 'enemy_foldwing';

export interface ActiveEnemy {
  id: number;
  kind: EnemyKind;
  instance: PooledModelInstance;
  rig: AnimationRig;
  hp: number;
  maxHp: number;
  hitRadius: number;
  scoreValue: number;
  pos: THREE.Vector3;
  baseX: number;
  baseY: number;
  targetZ: number;
  age: number;
  fireTimer: number;
  phase: number;
  flashTimer: number;
  isElite: boolean;
}

export interface BossPartRuntime {
  id: string;
  nodeName: string;
  labelZh: string;
  node: THREE.Object3D | null;
  hp: number;
  maxHp: number;
  hitRadius: number;
  destroyed: boolean;
  weaponEffectKey:
    | 'leftWingPod'
    | 'rightWingPod'
    | 'leftCannon'
    | 'rightCannon'
    | 'leftClaw'
    | 'rightClaw'
    | 'dorsalTurret'
    | 'bowCrane';
  worldPos: THREE.Vector3;
}

export interface ActiveBoss {
  config: BossConfig;
  instance: PooledModelInstance;
  rig: AnimationRig;
  hp: number;
  maxHp: number;
  hitRadius: number;
  pos: THREE.Vector3;
  age: number;
  fireTimer: number;
  specialTimer: number;
  escortTimer: number;
  flashTimer: number;
  parts: BossPartRuntime[];
  disabledParts: Set<string>;
  entering: boolean;
  introElapsed: number;
  introDuration: number;
  introStartPos: THREE.Vector3;
  introHoverPos: THREE.Vector3;
  introSweepSign: -1 | 1;
  introBurstDone: boolean;
  introMidSparkDone: boolean;
  dying: boolean;
  deathTimer: number;
  detachQueue: THREE.Object3D[];
}

export interface BoostRing {
  group: THREE.Group;
  outerChassis: THREE.Group;
  innerHolo: THREE.Group;
  ringMesh: THREE.Mesh;
  tunnelMesh: THREE.Mesh;
  ringMat: THREE.ShaderMaterial;
  tunnelMat: THREE.ShaderMaterial;
  active: boolean;
  triggered: boolean;
  triggerAge: number;
  baseScale: number;
  pos: THREE.Vector3;
  radius: number;
}

const BOOST_RING_VERT = /* glsl */ `
  varying vec2 vLocalPos;
  void main() {
    vLocalPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BOOST_RING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uProximity;
  uniform float uTrigger;
  uniform float uFade;
  varying vec2 vLocalPos;

  void main() {
    float r = length(vLocalPos);
    float ang = r > 1e-4 ? atan(vLocalPos.y, vLocalPos.x) : 0.0;
    float t = clamp((r - 1.98) / 1.10, 0.0, 1.0);

    // High-contrast dark obsidian edge bands so the ring stays razor-sharp over bright clouds
    float outerRimMask = smoothstep(0.76, 0.90, t) * (1.0 - smoothstep(0.95, 1.0, t));
    float innerRimMask = smoothstep(0.02, 0.08, t) * (1.0 - smoothstep(0.14, 0.22, t));
    float contrastSilhouette = max(outerRimMask * 0.92, innerRimMask * 0.72);

    // Sweeping 6-segment primary accelerator arc (rotates with uTime + surges on trigger)
    float arcBand = smoothstep(0.28, 0.44, t) * (1.0 - smoothstep(0.68, 0.82, t));
    float sweepWave = clamp(0.5 + 0.5 * cos(ang * 6.0 - uTime * (3.6 + uTrigger * 12.0)), 0.0, 1.0);
    float arcGlow = arcBand * (0.35 + 0.65 * pow(max(1e-4, sweepWave), 1.6));

    // 36 fine radial telemetry degree ticks near inner perimeter
    float tickBand = smoothstep(0.14, 0.20, t) * (1.0 - smoothstep(0.32, 0.38, t));
    float tickPattern = smoothstep(0.55, 0.92, cos(ang * 36.0 + uTime * 1.1));
    float ticks = tickBand * tickPattern * 0.85;

    // Inward-pulling accelerator slipstream ripples
    float ripplePhase = sin(r * 22.0 + uTime * 8.5);
    float ripples = smoothstep(0.35, 0.95, ripplePhase) * (1.0 - smoothstep(0.0, 0.85, abs(t - 0.42) * 1.8));

    vec3 darkRimCol = vec3(0.02, 0.06, 0.14);
    vec3 cyanCol = mix(vec3(0.08, 0.90, 1.0), vec3(0.65, 1.0, 0.94), clamp(uProximity * 0.45 + uTrigger * 0.55, 0.0, 1.0));
    vec3 amberTickCol = mix(vec3(1.0, 0.72, 0.22), vec3(0.45, 1.0, 0.88), clamp(uTrigger, 0.0, 1.0));

    float energySum = arcGlow * (1.15 + uProximity * 0.55 + uTrigger * 0.95) + ripples * 0.65;
    vec3 rgb = mix(darkRimCol, cyanCol, clamp(energySum, 0.0, 1.0));
    rgb = mix(rgb, amberTickCol, clamp(ticks * 0.9, 0.0, 1.0));
    rgb += vec3(0.35, 0.95, 1.0) * clamp(uTrigger, 0.0, 1.0) * arcBand * 0.85;
    rgb = clamp(rgb, 0.0, 2.5);

    float alpha = clamp(max(contrastSilhouette * 0.88, clamp(arcGlow + ticks + ripples * 0.65, 0.0, 1.0)), 0.0, 0.96);
    alpha *= clamp(uFade, 0.0, 1.0);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(rgb, alpha);
  }
`;

const BOOST_TUNNEL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BOOST_TUNNEL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uProximity;
  uniform float uTrigger;
  uniform float uFade;
  varying vec2 vUv;

  void main() {
    // Feather both longitudinal Z ends seamlessly to 0 with strictly positive pow() base
    float uvY = clamp(vUv.y, 0.0, 1.0);
    float sinAxial = max(1e-4, sin(uvY * 3.14159265));
    float axialFade = pow(sinAxial, 1.35) * smoothstep(0.0, 0.08, uvY) * smoothstep(1.0, 0.92, uvY);

    // Forward-streaming slipstream streaks + chevron rings flowing into the aperture
    float streaks = clamp(0.5 + 0.5 * cos(vUv.x * 75.39822 + sin(uvY * 6.28318 - uTime * 2.5)), 0.0, 1.0);
    streaks = pow(max(1e-4, streaks), 3.0);

    float chevPhase = fract(uvY * 2.4 + uTime * (2.6 + uTrigger * 5.0));
    float pulseRing = smoothstep(0.0, 0.22, chevPhase) * (1.0 - smoothstep(0.22, 0.65, chevPhase));

    float energy = (0.14 + streaks * 0.42 + pulseRing * (0.48 + uProximity * 0.35)) * axialFade;
    vec3 col = mix(vec3(0.06, 0.88, 1.0), vec3(0.68, 1.0, 0.88), clamp(uTrigger * 0.7 + pulseRing * 0.25, 0.0, 1.0));
    col = clamp(col * (1.0 + clamp(uTrigger, 0.0, 1.0) * 0.8), 0.0, 2.5);

    float alpha = clamp(energy * (0.36 + uProximity * 0.24 + uTrigger * 0.38) * clamp(uFade, 0.0, 1.0), 0.0, 0.92);
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

interface CorridorProp {
  instance: PooledModelInstance;
  rig: AnimationRig | null;
  kind: 'gate';
  beaconRing: THREE.Mesh | null;
}

export interface WaveEvent {
  type: 'act_banner' | 'upgrade_prompt' | 'boss_intro' | 'campaign_victory' | 'endless_wave';
  act: number;
  waveInAct: number;
  endlessWave: number;
  bossConfig?: BossConfig;
}

export type GateHitKind = 'door' | 'frame' | null;

// Analytical prop_gate dimensions derived from GLB bounds (maxDim=4.52, targetSize=44).
const GATE_SCALE = 44 / 4.52;
const GATE_FRAME_HALF_X = 2.26 * GATE_SCALE;
const GATE_FRAME_HALF_Y = 1.98 * GATE_SCALE;
const GATE_FRAME_Z_OFFSET = -0.08 * GATE_SCALE;
const GATE_FRAME_HALF_Z = 0.34 * GATE_SCALE;
const GATE_APERTURE_R = 1.47 * GATE_SCALE;
const GATE_HINGE_X = 1.698 * GATE_SCALE;
const GATE_HINGE_Y = -0.007 * GATE_SCALE;
const GATE_HINGE_Z = 0.250 * GATE_SCALE;
const GATE_DOOR_CENTER_DX = -1.698 * GATE_SCALE;
const GATE_DOOR_CENTER_DZ = -0.330 * GATE_SCALE;
const GATE_DOOR_R = 1.47 * GATE_SCALE;
const GATE_DOOR_HALF_THICK = 0.51 * GATE_SCALE;

const ENEMY_CAPS: Record<EnemyKind, number> = {
  enemy_drone: 8,
  enemy_turret: 5,
  enemy_rover: 3,
  enemy_foldwing: 4,
};

export class WaveDirector {
  private readonly scene: THREE.Scene;
  private readonly loader: AssetLoader;

  private readonly envGroup = new THREE.Group();
  private readonly corridorProps: CorridorProp[] = [];
  private readonly boostRings: BoostRing[] = [];
  private readonly gateBeaconGeo = new THREE.TorusGeometry(9.2, 0.18, 12, 48);
  private readonly gateBeaconMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
  });
  private readonly gateBeaconWarnMat = new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
  });

  private combatActive = false;
  private currentAct = 1;
  private waveInAct = 1; // 1, 2, 3 (3 = boss)
  private endlessMode = false;
  private endlessWave = 0;

  private phaseState:
    | 'idle'
    | 'spawning_wave'
    | 'awaiting_clear'
    | 'awaiting_upgrade'
    | 'boss_fight' = 'idle';

  private spawnTimer = 0;
  private boostRingTimer = 6.0;
  private gateSpawnCooldown = 14.0;
  private envElapsed = 0;
  private spawnedInWave = 0;
  private targetSpawnsInWave = 0;
  private nextEnemyId = 1;

  readonly activeEnemies: ActiveEnemy[] = [];
  activeBoss: ActiveBoss | null = null;
  private bossScaleFactor = 1.0;

  private currentFogColor = new THREE.Color(ACT_THEMES[0].fogColor);
  private targetFogColor = new THREE.Color(ACT_THEMES[0].fogColor);
  private currentBgColor = new THREE.Color(ACT_THEMES[0].bgColor);
  private targetBgColor = new THREE.Color(ACT_THEMES[0].bgColor);

  constructor(scene: THREE.Scene, loader: AssetLoader) {
    this.scene = scene;
    this.loader = loader;
    this.envGroup.name = 'CorridorEnvironment';
    this.envGroup.visible = false;
    scene.add(this.envGroup);

    // Pooled AAA segmented aerospace Boost Rings (3 slots)
    const arcGeo = new THREE.TorusGeometry(3.16, 0.145, 10, 14, Math.PI / 3 - 0.18);
    const pylonBodyGeo = new THREE.BoxGeometry(0.46, 0.34, 0.88);
    const pylonFinGeo = new THREE.BoxGeometry(0.32, 0.1, 1.18);
    const emitterLensGeo = new THREE.BoxGeometry(0.16, 0.22, 0.46);
    const chevronGeo = new THREE.ConeGeometry(0.2, 0.5, 3);
    const holoRingGeo = new THREE.RingGeometry(1.98, 3.08, 72, 1);
    const tunnelGeo = new THREE.CylinderGeometry(2.86, 2.28, 3.6, 48, 1, true);
    tunnelGeo.rotateX(Math.PI * 0.5);

    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0x16243a,
      metalness: 0.9,
      roughness: 0.22,
      clearcoat: 0.72,
      clearcoatRoughness: 0.16,
      emissive: 0x062036,
      emissiveIntensity: 0.35,
    });
    const emitterMat = new THREE.MeshStandardMaterial({
      color: 0x22f0ff,
      emissive: 0x1ef4ff,
      emissiveIntensity: 2.1,
      metalness: 0.2,
      roughness: 0.15,
    });
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0xffc14d,
      emissive: 0xff9d2e,
      emissiveIntensity: 1.45,
      metalness: 0.35,
      roughness: 0.25,
    });

    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group();
      group.name = `BoostRingSlot_${i}`;
      const outerChassis = new THREE.Group();
      const innerHolo = new THREE.Group();

      for (let k = 0; k < 6; k++) {
        const theta = k * (Math.PI / 3);

        // Curved segmented titanium hull arc
        const arc = new THREE.Mesh(arcGeo, chassisMat);
        arc.rotation.z = theta + 0.09;
        outerChassis.add(arc);

        // Radial capacitor pylon with inward plasma emitter lens
        const pylon = new THREE.Group();
        pylon.position.set(Math.cos(theta) * 3.22, Math.sin(theta) * 3.22, 0);
        pylon.rotation.z = theta;

        const housing = new THREE.Mesh(pylonBodyGeo, chassisMat);
        const fin = new THREE.Mesh(pylonFinGeo, chassisMat);
        fin.position.set(0.18, 0, 0);
        const lens = new THREE.Mesh(emitterLensGeo, emitterMat);
        lens.position.set(-0.22, 0, 0);
        pylon.add(housing, fin, lens);
        outerChassis.add(pylon);

        // Counter-rotating amber guide chevrons pointing straight inward toward center aperture
        const chev = new THREE.Mesh(chevronGeo, chevronMat);
        chev.position.set(Math.cos(theta) * 2.66, Math.sin(theta) * 2.66, 0.06);
        chev.rotation.z = theta + Math.PI * 0.5;
        chev.scale.set(1.0, 1.0, 0.35);
        innerHolo.add(chev);
      }

      const ringMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uProximity: { value: 0 },
          uTrigger: { value: 0 },
          uFade: { value: 1 },
        },
        vertexShader: BOOST_RING_VERT,
        fragmentShader: BOOST_RING_FRAG,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(holoRingGeo, ringMat);
      ringMesh.renderOrder = 2;

      const tunnelMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uProximity: { value: 0 },
          uTrigger: { value: 0 },
          uFade: { value: 1 },
        },
        vertexShader: BOOST_TUNNEL_VERT,
        fragmentShader: BOOST_TUNNEL_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
      tunnelMesh.renderOrder = 1;

      group.add(outerChassis, innerHolo, ringMesh, tunnelMesh);
      group.visible = false;
      this.envGroup.add(group);
      this.boostRings.push({
        group,
        outerChassis,
        innerHolo,
        ringMesh,
        tunnelMesh,
        ringMat,
        tunnelMat,
        active: false,
        triggered: false,
        triggerAge: -1,
        baseScale: 1.0,
        pos: new THREE.Vector3(0, 0, -200),
        radius: 3.4,
      });
    }
  }

  setCombatActive(active: boolean): void {
    this.combatActive = active;
    this.envGroup.visible = active;
  }

  clearCorridorProps(): void {
    for (const p of this.corridorProps) {
      if (p.beaconRing) p.beaconRing.removeFromParent();
      p.rig?.dispose();
      this.loader.release(p.instance);
    }
    this.corridorProps.length = 0;
  }

  private clearTransientCorridorGates(): void {
    for (let i = this.corridorProps.length - 1; i >= 0; i--) {
      const p = this.corridorProps[i];
      if (p.kind !== 'gate') continue;
      if (p.beaconRing) p.beaconRing.removeFromParent();
      p.rig?.dispose();
      this.loader.release(p.instance);
      this.corridorProps.splice(i, 1);
    }
  }

  clearCombatEntities(): void {
    this.combatActive = false;
    this.phaseState = 'idle';
    this.boostRingTimer = 5.5;
    this.envGroup.visible = false;
    for (const e of this.activeEnemies) {
      this.loader.release(e.instance);
    }
    this.activeEnemies.length = 0;

    if (this.activeBoss) {
      this.loader.release(this.activeBoss.instance);
      this.activeBoss = null;
    }

    for (const r of this.boostRings) {
      r.active = false;
      r.triggered = false;
      r.triggerAge = -1;
      r.group.scale.setScalar(1.0);
      r.group.visible = false;
    }

    this.clearTransientCorridorGates();
  }

  getBoostRings(): BoostRing[] {
    return this.boostRings;
  }

  getWarmupObjects(): THREE.Object3D[] {
    const slot0 = this.boostRings[0];
    if (!slot0) return [];
    return [slot0.ringMesh, slot0.tunnelMesh];
  }

  triggerBoostRing(ring: BoostRing): void {
    ring.triggered = true;
    ring.triggerAge = 0;
  }

  forceSpawnBoostRing(x = 0, y = 0, z = -18): void {
    const slot = this.boostRings[0];
    if (!slot) return;
    slot.active = true;
    slot.triggered = false;
    slot.triggerAge = -1;
    slot.baseScale = 1.0;
    slot.pos.set(x, y, z);
    slot.group.position.copy(slot.pos);
    slot.group.scale.setScalar(1.0);
    slot.ringMat.uniforms.uTrigger.value = 0;
    slot.ringMat.uniforms.uFade.value = 1;
    slot.tunnelMat.uniforms.uTrigger.value = 0;
    slot.tunnelMat.uniforms.uFade.value = 1;
    slot.group.visible = true;
  }

  getAct(): number {
    return this.currentAct;
  }

  getWaveInAct(): number {
    return this.waveInAct;
  }

  isEndless(): boolean {
    return this.endlessMode;
  }

  getEndlessWave(): number {
    return this.endlessWave;
  }

  startCampaign(): WaveEvent {
    this.clearCombatEntities();

    this.combatActive = true;
    this.envGroup.visible = true;
    this.currentAct = 1;
    this.waveInAct = 1;
    this.endlessMode = false;
    this.endlessWave = 0;
    this.bossScaleFactor = 1.0;
    this.gateSpawnCooldown = 10.0;
    this.boostRingTimer = 5.5;
    this.applyActTheme(1, true);
    return this.beginWave(1, 1);
  }

  startEndlessMode(): WaveEvent {
    this.clearCombatEntities();

    this.combatActive = true;
    this.envGroup.visible = true;
    this.endlessMode = true;
    this.endlessWave = 1;
    this.currentAct = 1;
    this.waveInAct = 1;
    this.bossScaleFactor = 1.35;
    this.gateSpawnCooldown = 4.0;
    this.boostRingTimer = 5.5;
    this.applyActTheme(1, false);
    return this.beginWave(1, 1);
  }

  forceSpawnBoss(act: 1 | 2 | 3 | 4): WaveEvent {
    this.clearCombatEntities();
    this.combatActive = true;
    this.envGroup.visible = true;
    this.currentAct = act;
    this.waveInAct = 3;
    if (act >= 3) {
      this.gateSpawnCooldown = 2.0;
    }
    this.applyActTheme(act, false);
    return this.beginBossWave(act);
  }

  resumeAfterUpgrade(): WaveEvent | null {
    if (this.phaseState !== 'awaiting_upgrade') return null;
    if (this.endlessMode) {
      this.endlessWave += 1;
      const themeAct = ((this.endlessWave - 1) % 4) + 1;
      this.currentAct = themeAct;
      this.bossScaleFactor = 1 + this.endlessWave * 0.22;
      this.applyActTheme(themeAct, false);
      if (this.endlessWave % 3 === 0) {
        this.waveInAct = 3;
        return this.beginBossWave(themeAct);
      }
      this.waveInAct = 2;
      return this.beginWave(themeAct, 2);
    }

    this.waveInAct += 1;
    if (this.waveInAct === 2) {
      return this.beginWave(this.currentAct, 2);
    }
    return this.beginBossWave(this.currentAct);
  }

  onBossDefeated(): WaveEvent | null {
    if (this.activeBoss) {
      this.loader.release(this.activeBoss.instance);
      this.activeBoss = null;
    }

    if (this.endlessMode) {
      this.phaseState = 'awaiting_upgrade';
      return {
        type: 'upgrade_prompt',
        act: this.currentAct,
        waveInAct: this.waveInAct,
        endlessWave: this.endlessWave,
      };
    }

    if (this.currentAct < 4) {
      this.currentAct += 1;
      this.waveInAct = 1;
      if (this.currentAct === 3) {
        this.gateSpawnCooldown = Math.min(this.gateSpawnCooldown, 3.5);
      }
      this.applyActTheme(this.currentAct, false);
      return this.beginWave(this.currentAct, 1);
    }

    this.phaseState = 'idle';
    this.combatActive = false;
    return {
      type: 'campaign_victory',
      act: 4,
      waveInAct: 3,
      endlessWave: 0,
    };
  }

  private beginWave(act: number, waveInAct: number): WaveEvent {
    this.phaseState = 'spawning_wave';
    this.spawnedInWave = 0;
    this.spawnTimer = 0.6;
    this.targetSpawnsInWave = this.endlessMode
      ? 9 + this.endlessWave * 2
      : 6 + act * 2 + waveInAct * 2;

    if (this.endlessMode) {
      return {
        type: 'endless_wave',
        act,
        waveInAct,
        endlessWave: this.endlessWave,
      };
    }

    return {
      type: 'act_banner',
      act,
      waveInAct,
      endlessWave: 0,
    };
  }

  private beginBossWave(act: number): WaveEvent {
    this.phaseState = 'boss_fight';
    this.waveInAct = 3;
    const bossId: BossId = act === 1 ? 'act1' : act === 2 ? 'act2' : act === 3 ? 'act3' : 'act4';
    const cfg = BOSSES[bossId];
    const inst = this.loader.acquire(cfg.modelKey, true);
    const rig = new AnimationRig(cfg.modelKey, inst.modelRoot, inst.animations, 'combat');

    const scale = this.bossScaleFactor;
    const scaledMaxHp = Math.round(cfg.maxHp * scale);

    const introStartPos =
      act === 1
        ? new THREE.Vector3(0, 24.5, -138)
        : act === 2
          ? new THREE.Vector3(0, 17.5, -124)
          : act === 3
            ? new THREE.Vector3(-15, 7.5, -132)
            : new THREE.Vector3(0, 5.2, -148);
    const introHoverPos =
      act === 4
        ? new THREE.Vector3(0, 2.2, -40)
        : act === 1
          ? new THREE.Vector3(0, 2.1, -36)
          : new THREE.Vector3(0, 1.8, -37);
    const introSweepSign: -1 | 1 = act % 2 === 1 ? 1 : -1;

    inst.root.position.copy(introStartPos);
    this.scene.add(inst.root);

    const parts: BossPartRuntime[] = cfg.destructibleParts.map((spec) => {
      let node: THREE.Object3D | null = null;
      inst.modelRoot.traverse((obj) => {
        if (!node && obj.name === spec.nodeName) {
          node = obj;
        }
      });
      return {
        id: spec.id,
        nodeName: spec.nodeName,
        labelZh: spec.labelZh,
        node,
        hp: Math.round(spec.hp * scale),
        maxHp: Math.round(spec.hp * scale),
        hitRadius: spec.hitRadius,
        destroyed: false,
        weaponEffectKey: spec.weaponEffectKey,
        worldPos: new THREE.Vector3(),
      };
    });

    // Collect top-most detachable part subtrees without pushing nested descendants of already-queued ancestors
    const detachQueue: THREE.Object3D[] = [];
    const detachRegex =
      /leg_|cannon_|claw_|turret|fighter_|bowcranearms|dorsalturret|antenna|eye_|bosswingpod|wingfold_pivot/i;
    const collectDetachable = (node: THREE.Object3D): void => {
      if (detachQueue.length >= 16) return;
      if (node !== inst.modelRoot && node.name && detachRegex.test(node.name)) {
        detachQueue.push(node);
        return;
      }
      for (const child of node.children) {
        collectDetachable(child);
        if (detachQueue.length >= 16) break;
      }
    };
    collectDetachable(inst.modelRoot);

    this.activeBoss = {
      config: cfg,
      instance: inst,
      rig,
      hp: scaledMaxHp,
      maxHp: scaledMaxHp,
      hitRadius: act === 4 ? 6.2 : act === 1 ? 5.2 : 4.8,
      pos: inst.root.position,
      age: 0,
      fireTimer: 1.5,
      specialTimer: 5.5,
      escortTimer: 7.5,
      flashTimer: 0,
      parts,
      disabledParts: new Set<string>(),
      entering: true,
      introElapsed: 0,
      introDuration: 2.65,
      introStartPos,
      introHoverPos,
      introSweepSign,
      introBurstDone: false,
      introMidSparkDone: false,
      dying: false,
      deathTimer: 0,
      detachQueue,
    };

    return {
      type: 'boss_intro',
      act,
      waveInAct: 3,
      endlessWave: this.endlessWave,
      bossConfig: cfg,
    };
  }

  private applyActTheme(act: number, immediate: boolean): void {
    const theme = ACT_THEMES[Math.min(ACT_THEMES.length - 1, Math.max(0, act - 1))];
    this.targetFogColor.setHex(theme.fogColor);
    this.targetBgColor.setHex(theme.bgColor);
    if (immediate) {
      this.currentFogColor.copy(this.targetFogColor);
      this.currentBgColor.copy(this.targetBgColor);
      this.scene.background = this.currentBgColor;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(this.currentFogColor);
        this.scene.fog.density = 0.0022;
      }
    }
  }

  updateEnvironment(dt: number, speedMultiplier: number): void {
    const scrollSpeed = 36 * speedMultiplier;
    this.envElapsed += dt;

    // Smoothly transition atmosphere per Act with crisp low-density cosmic haze
    this.currentFogColor.lerp(this.targetFogColor, dt * 1.6);
    this.currentBgColor.lerp(this.targetBgColor, dt * 1.6);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.currentBgColor);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.currentFogColor);
      this.scene.fog.density = 0.0022;
    }

    // Move and animate Act 2/3 Warp Gateways
    for (let i = this.corridorProps.length - 1; i >= 0; i--) {
      const p = this.corridorProps[i];
      p.instance.root.position.z += scrollSpeed * dt;
      if (p.rig) {
        p.rig.update({ dt, elapsed: performance.now() * 0.001, worldPos: p.instance.root.position });
      }
      if (p.beaconRing) {
        p.beaconRing.rotation.z += dt * 1.8;
        const doorAngle = p.rig ? p.rig.getGateDoorAngleRad() : 0;
        p.beaconRing.material = doorAngle < 1.48 ? this.gateBeaconWarnMat : this.gateBeaconMat;
      }

      if (p.instance.root.position.z > 34) {
        if (p.beaconRing) p.beaconRing.removeFromParent();
        p.rig?.dispose();
        this.loader.release(p.instance);
        this.corridorProps.splice(i, 1);
      }
    }

    // Periodic Warp Gateway (prop_gate) in Act 3 and Act 4
    if (this.combatActive && this.currentAct >= 3 && this.phaseState !== 'idle') {
      this.gateSpawnCooldown -= dt;
      if (this.gateSpawnCooldown <= 0) {
        this.gateSpawnCooldown = 16.5;
        this.spawnCorridorGate();
      }
    }

    // Boost rings spawning and scrolling (strictly in active combat waves)
    if (
      this.combatActive &&
      (this.phaseState === 'spawning_wave' || this.phaseState === 'awaiting_clear')
    ) {
      this.boostRingTimer -= dt;
      if (this.boostRingTimer <= 0) {
        this.boostRingTimer = 7.2 + Math.random() * 3.5;
        this.spawnBoostRing();
      }
    }

    for (const ring of this.boostRings) {
      if (!ring.active) continue;
      ring.pos.z += scrollSpeed * 0.92 * dt;
      ring.group.position.copy(ring.pos);

      const proximity = THREE.MathUtils.clamp((ring.pos.z + 65) / 60, 0, 1);
      ring.ringMat.uniforms.uTime.value = this.envElapsed;
      ring.ringMat.uniforms.uProximity.value = proximity;
      ring.tunnelMat.uniforms.uTime.value = this.envElapsed;
      ring.tunnelMat.uniforms.uProximity.value = proximity;

      if (ring.triggered && ring.triggerAge >= 0) {
        ring.triggerAge += dt;
        const p = THREE.MathUtils.clamp(ring.triggerAge / 0.42, 0, 1);
        ring.group.scale.setScalar(ring.baseScale * (1.0 + Math.pow(p, 0.55) * 1.55));
        ring.outerChassis.rotation.z += dt * 1.8;
        ring.innerHolo.rotation.z -= dt * 9.0;
        const fade = 1.0 - p;
        ring.ringMat.uniforms.uTrigger.value = 1.0;
        ring.ringMat.uniforms.uFade.value = fade;
        ring.tunnelMat.uniforms.uTrigger.value = 1.0;
        ring.tunnelMat.uniforms.uFade.value = fade;
        if (p >= 1.0 || ring.pos.z > 24) {
          ring.active = false;
          ring.triggered = false;
          ring.triggerAge = -1;
          ring.group.scale.setScalar(1.0);
          ring.group.visible = false;
        }
      } else {
        ring.group.scale.setScalar(ring.baseScale);
        ring.outerChassis.rotation.z += dt * 0.72;
        ring.innerHolo.rotation.z -= dt * 1.85;
        ring.ringMat.uniforms.uTrigger.value = 0.0;
        ring.ringMat.uniforms.uFade.value = 1.0;
        ring.tunnelMat.uniforms.uTrigger.value = 0.0;
        ring.tunnelMat.uniforms.uFade.value = 1.0;
        if (ring.pos.z > 22) {
          ring.active = false;
          ring.triggered = false;
          ring.triggerAge = -1;
          ring.group.scale.setScalar(1.0);
          ring.group.visible = false;
        }
      }
    }
  }

  forceSpawnGate(z = -220, mode: 'closed' | 'opening' | 'open' = 'closed'): void {
    this.clearTransientCorridorGates();
    this.spawnCorridorGate(z, mode);
  }

  getActiveGateCount(): number {
    let count = 0;
    for (const p of this.corridorProps) {
      if (p.kind === 'gate') count += 1;
    }
    return count;
  }

  checkGateSolidCollision(point: THREE.Vector3, radius: number): GateHitKind {
    for (const p of this.corridorProps) {
      if (p.kind !== 'gate') continue;
      const gPos = p.instance.root.position;
      const lx = point.x - gPos.x;
      const ly = point.y - gPos.y;
      const lz = point.z - gPos.z;
      if (Math.abs(lz) > 42 || Math.abs(lx) > 36 || Math.abs(ly) > 26) continue;

      // Exact rotated vault door solid disc test around right-side vertical hinge.
      const theta = p.rig ? p.rig.getGateDoorAngleRad() : 0;
      const rx = lx - GATE_HINGE_X;
      const ry = ly - GATE_HINGE_Y;
      const rz = lz - GATE_HINGE_Z;
      const c = Math.cos(theta);
      const sn = Math.sin(theta);
      const ux = rx * c - rz * sn;
      const uz = rx * sn + rz * c;
      const radDist = Math.hypot(ux - GATE_DOOR_CENTER_DX, ry);
      const axialDist = Math.abs(uz - GATE_DOOR_CENTER_DZ);
      const dr = Math.max(0, radDist - GATE_DOOR_R);
      const dz = Math.max(0, axialDist - GATE_DOOR_HALF_THICK);
      if (dr * dr + dz * dz < radius * radius) {
        return 'door';
      }

      // Bulkhead outer frame test outside circular portal aperture.
      if (
        Math.abs(lz - GATE_FRAME_Z_OFFSET) < GATE_FRAME_HALF_Z + radius &&
        Math.abs(lx) < GATE_FRAME_HALF_X + radius &&
        Math.abs(ly) < GATE_FRAME_HALF_Y + radius
      ) {
        if (Math.hypot(lx, ly) > GATE_APERTURE_R - radius * 0.85) {
          return 'frame';
        }
      }
    }
    return null;
  }

  private spawnCorridorGate(
    startZ = -220,
    initialMode: 'closed' | 'opening' | 'open' = 'closed'
  ): void {
    // Cap concurrent active gates at 2
    const activeGates = this.corridorProps.filter((p) => p.kind === 'gate').length;
    if (activeGates >= 2) return;

    const inst = this.loader.acquire('prop_gate', false);
    const rig = new AnimationRig('prop_gate', inst.modelRoot, inst.animations, initialMode);
    inst.root.position.set(0, 0, startZ);
    inst.root.rotation.set(0, 0, 0);

    // Holographic guidance ring indicating safe open passage inside the circular aperture.
    const initMat = rig.getGateDoorAngleRad() < 1.48 ? this.gateBeaconWarnMat : this.gateBeaconMat;
    const beaconRing = new THREE.Mesh(this.gateBeaconGeo, initMat);
    beaconRing.position.set(0, 0, 1.4);
    inst.root.add(beaconRing);

    this.envGroup.add(inst.root);
    this.corridorProps.push({
      instance: inst,
      rig,
      kind: 'gate',
      beaconRing,
    });
  }

  private spawnBoostRing(): void {
    const slot = this.boostRings.find((r) => !r.active);
    if (!slot) return;
    slot.active = true;
    slot.triggered = false;
    slot.triggerAge = -1;
    slot.baseScale = 1.0;
    slot.pos.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, -145);
    slot.group.position.copy(slot.pos);
    slot.group.scale.setScalar(1.0);
    slot.ringMat.uniforms.uTrigger.value = 0;
    slot.ringMat.uniforms.uFade.value = 1;
    slot.tunnelMat.uniforms.uTrigger.value = 0;
    slot.tunnelMat.uniforms.uFade.value = 1;
    slot.group.visible = true;
  }

  updateWaves(dt: number): WaveEvent | null {
    if (this.phaseState === 'spawning_wave') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.spawnedInWave < this.targetSpawnsInWave) {
        this.spawnEnemyByWavePlan();
        this.spawnTimer = Math.max(0.75, 1.85 - this.currentAct * 0.25);
      }
      if (this.spawnedInWave >= this.targetSpawnsInWave && this.activeEnemies.length === 0) {
        if (this.endlessMode) {
          this.phaseState = 'awaiting_upgrade';
          return {
            type: 'upgrade_prompt',
            act: this.currentAct,
            waveInAct: this.waveInAct,
            endlessWave: this.endlessWave,
          };
        }
        if (this.waveInAct === 1) {
          this.waveInAct = 2;
          return this.beginWave(this.currentAct, 2);
        }
        this.phaseState = 'awaiting_upgrade';
        return {
          type: 'upgrade_prompt',
          act: this.currentAct,
          waveInAct: this.waveInAct,
          endlessWave: this.endlessWave,
        };
      }
    }
    return null;
  }

  private countKind(kind: EnemyKind): number {
    let c = 0;
    for (const e of this.activeEnemies) {
      if (e.kind === kind) c += 1;
    }
    return c;
  }

  private pickAllowedEnemyKind(): EnemyKind {
    const candidates: EnemyKind[] =
      this.currentAct === 1
        ? ['enemy_drone', 'enemy_turret', 'enemy_rover', 'enemy_foldwing']
        : ['enemy_foldwing', 'enemy_turret', 'enemy_rover', 'enemy_drone'];

    const weighted: EnemyKind[] = [];
    for (const k of candidates) {
      if (this.countKind(k) >= ENEMY_CAPS[k]) continue;
      if (k === 'enemy_drone') weighted.push(k, k, k);
      else if (k === 'enemy_turret') weighted.push(k, k);
      else if (k === 'enemy_foldwing') weighted.push(k, k);
      else if (k === 'enemy_rover' && (this.currentAct >= 2 || this.waveInAct >= 2)) {
        weighted.push(k);
      }
    }

    if (weighted.length === 0) return 'enemy_drone';
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  spawnEscortEnemy(kind: EnemyKind, originPos: THREE.Vector3): void {
    if (this.countKind(kind) >= ENEMY_CAPS[kind]) return;
    const clampedX = THREE.MathUtils.clamp(originPos.x + (Math.random() - 0.5) * 9, -11.5, 11.5);
    const clampedY = THREE.MathUtils.clamp(originPos.y, -6.2, 6.2);
    this.spawnEnemyInstance(kind, clampedX, clampedY, originPos.z + 4);
  }

  private spawnEnemyByWavePlan(): void {
    const batch = this.waveInAct === 2 || this.currentAct >= 2 ? 2 : 1;
    for (let i = 0; i < batch && this.spawnedInWave < this.targetSpawnsInWave; i++) {
      const kind = this.pickAllowedEnemyKind();
      if (this.countKind(kind) >= ENEMY_CAPS[kind]) continue;
      const x = (Math.random() - 0.5) * 20;
      const y =
        kind === 'enemy_rover'
          ? -3.5 + (Math.random() - 0.5) * 2.5
          : (Math.random() - 0.5) * 10;
      this.spawnEnemyInstance(kind, x, y, -128 - i * 10);
      this.spawnedInWave += 1;
    }
  }

  private spawnEnemyInstance(kind: EnemyKind, x: number, y: number, z: number): void {
    const inst = this.loader.acquire(kind as ModelKey, true);
    const rig = new AnimationRig(kind, inst.modelRoot, inst.animations, 'combat');

    const scale = this.endlessMode ? 1 + this.endlessWave * 0.18 : 1 + (this.currentAct - 1) * 0.25;
    let baseHp = 45;
    let hitRadius = 1.8;
    let score = 120;
    let targetZ = -26;
    let isElite = false;

    if (kind === 'enemy_turret') {
      baseHp = 95;
      hitRadius = 2.2;
      score = 220;
      targetZ = -32;
      isElite = true;
    } else if (kind === 'enemy_rover') {
      baseHp = 135;
      hitRadius = 2.35;
      score = 320;
      targetZ = -24;
      isElite = true;
    } else if (kind === 'enemy_foldwing') {
      baseHp = 78;
      hitRadius = 2.1;
      score = 240;
      targetZ = -28;
      isElite = true;
    }

    const hp = Math.round(baseHp * scale);
    inst.root.position.set(x, y, z);
    this.scene.add(inst.root);

    this.activeEnemies.push({
      id: this.nextEnemyId++,
      kind,
      instance: inst,
      rig,
      hp,
      maxHp: hp,
      hitRadius,
      scoreValue: score,
      pos: inst.root.position,
      baseX: THREE.MathUtils.clamp(x, -11.5, 11.5),
      baseY: THREE.MathUtils.clamp(y, -6.2, 6.2),
      targetZ: targetZ + (Math.random() - 0.5) * 9,
      age: 0,
      fireTimer: 0.9 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      flashTimer: 0,
      isElite,
    });
  }

  releaseEnemyAt(index: number): void {
    if (index < 0 || index >= this.activeEnemies.length) return;
    const e = this.activeEnemies[index];
    this.loader.release(e.instance);
    this.activeEnemies.splice(index, 1);
  }
}
