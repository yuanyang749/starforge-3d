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
  dying: boolean;
  deathTimer: number;
  detachQueue: THREE.Object3D[];
}

export interface BoostRing {
  group: THREE.Group;
  active: boolean;
  triggered: boolean;
  pos: THREE.Vector3;
  radius: number;
}

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
    scene.add(this.envGroup);

    // Pooled holographic boost rings (3 rings)
    const ringGeo = new THREE.TorusGeometry(2.85, 0.14, 12, 32);
    const innerGeo = new THREE.TorusGeometry(2.35, 0.05, 8, 28);
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group();
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffb347,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      });
      group.add(new THREE.Mesh(ringGeo, outerMat), new THREE.Mesh(innerGeo, innerMat));
      group.visible = false;
      this.envGroup.add(group);
      this.boostRings.push({
        group,
        active: false,
        triggered: false,
        pos: new THREE.Vector3(0, 0, -200),
        radius: 3.4,
      });
    }
  }

  setCombatActive(active: boolean): void {
    this.combatActive = active;
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
      r.group.visible = false;
    }

    this.clearTransientCorridorGates();
  }

  getBoostRings(): BoostRing[] {
    return this.boostRings;
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
    this.endlessMode = true;
    this.endlessWave = 1;
    this.currentAct = 2;
    this.waveInAct = 1;
    this.bossScaleFactor = 1.35;
    this.gateSpawnCooldown = 4.0;
    this.boostRingTimer = 5.5;
    this.applyActTheme(2, false);
    return this.beginWave(2, 1);
  }

  forceSpawnBoss(act: 1 | 2 | 3): WaveEvent {
    this.clearCombatEntities();
    this.combatActive = true;
    this.currentAct = act;
    this.waveInAct = 3;
    if (act >= 2) {
      this.gateSpawnCooldown = 2.0;
    }
    this.applyActTheme(act, false);
    return this.beginBossWave(act);
  }

  resumeAfterUpgrade(): WaveEvent | null {
    if (this.phaseState !== 'awaiting_upgrade') return null;
    if (this.endlessMode) {
      this.endlessWave += 1;
      const themeAct = ((this.endlessWave - 1) % 3) + 1;
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

    if (this.currentAct < 3) {
      this.currentAct += 1;
      this.waveInAct = 1;
      if (this.currentAct === 2) {
        this.gateSpawnCooldown = Math.min(this.gateSpawnCooldown, 3.5);
      }
      this.applyActTheme(this.currentAct, false);
      return this.beginWave(this.currentAct, 1);
    }

    this.phaseState = 'idle';
    this.combatActive = false;
    return {
      type: 'campaign_victory',
      act: 3,
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
    const bossId: BossId = act === 1 ? 'act1' : act === 2 ? 'act2' : 'act3';
    const cfg = BOSSES[bossId];
    const inst = this.loader.acquire(cfg.modelKey, true);
    const rig = new AnimationRig(cfg.modelKey, inst.modelRoot, inst.animations, 'combat');

    const scale = this.bossScaleFactor;
    const scaledMaxHp = Math.round(cfg.maxHp * scale);

    inst.root.position.set(0, 2.5, -145);
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
    const detachRegex = /leg_|cannon_|claw_|turret|fighter_|bowcranearms|dorsalturret|antenna|eye_/i;
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
      hitRadius: act === 3 ? 6.2 : 4.8,
      pos: inst.root.position,
      age: 0,
      fireTimer: 1.8,
      specialTimer: 5.5,
      escortTimer: 7.5,
      flashTimer: 0,
      parts,
      disabledParts: new Set<string>(),
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

    // Periodic Warp Gateway (prop_gate) in Act 2 and Act 3
    if (this.combatActive && this.currentAct >= 2 && this.phaseState !== 'idle') {
      this.gateSpawnCooldown -= dt;
      if (this.gateSpawnCooldown <= 0) {
        this.gateSpawnCooldown = 16.5;
        this.spawnCorridorGate();
      }
    }

    // Boost rings spawning and scrolling
    if (this.phaseState === 'spawning_wave' || this.phaseState === 'awaiting_clear') {
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
      ring.group.rotation.z += dt * 2.2;
      if (ring.pos.z > 22) {
        ring.active = false;
        ring.triggered = false;
        ring.group.visible = false;
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
    slot.pos.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, -145);
    slot.group.position.copy(slot.pos);
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
