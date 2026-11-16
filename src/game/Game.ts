import * as THREE from 'three';
import {
  ACT_THEMES,
  MODEL_ASSETS,
  SHIPS,
  type BossConfig,
  type ShipConfig,
  type ShipId,
} from '../assets/manifest';
import { AssetLoader, type PooledModelInstance } from '../engine/AssetLoader';
import { AnimationRig } from '../engine/AnimationRig';
import { SoundEngine, type WeaponVoice } from '../engine/SoundEngine';
import { SaveStore } from './SaveStore';
import {
  UPGRADE_CARDS,
  applyUpgradeCard,
  createInitialUpgradeState,
  pickUpgradeChoices,
  type UpgradeCard,
  type UpgradeState,
} from './Upgrades';
import { VfxSystem } from './VfxSystem';
import {
  WaveDirector,
  type ActiveBoss,
  type ActiveEnemy,
  type BossPartRuntime,
} from './WaveDirector';

export type GameState = 'boot' | 'hangar' | 'playing' | 'upgrade' | 'paused' | 'result';

export interface StarforgeBossPartSnapshot {
  id: string;
  nodeName: string;
  labelZh: string;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface StarforgeBossSnapshot {
  active: boolean;
  id: string;
  act: number;
  hp: number;
  maxHp: number;
  dying: boolean;
  deathTimer: number;
  parts: StarforgeBossPartSnapshot[];
}

export interface StarforgeSnapshot {
  mode: GameState;
  phase: GameState;
  loadProgress: number;
  selectedShipId: ShipId;
  selectedShipIndex: number;
  act: number;
  waveInAct: number;
  endless: boolean;
  endlessWave: number;
  score: number;
  kills: number;
  hp: number;
  maxHp: number;
  invulnTimer: number;
  rollCooldown: number;
  rollActive: boolean;
  ultCharge: number;
  ultMax: number;
  ultActiveTimer: number;
  enemyCount: number;
  enemyBulletCount: number;
  playerBulletCount: number;
  upgrades: Record<string, number>;
  pierceCount: number;
  critChance: number;
  aeroBounceCount: number;
  boss: StarforgeBossSnapshot | null;
  dialogs: {
    upgradeOpen: boolean;
    pauseOpen: boolean;
    resultOpen: boolean;
  };
}

export interface StarforgeQaApi {
  getSnapshot(): StarforgeSnapshot;
  selectShip(index: number): void;
  startSortie(): void;
  forceUpgradeModal(): void;
  spawnBossNow(act: 1 | 2 | 3): void;
  damageBossPart(partId: string, dmg: number): boolean;
  damageBossCore(dmg: number): boolean;
  fillUltimate(): void;
  triggerUltimate(): boolean;
  triggerBarrelRoll(): boolean;
}

declare global {
  interface Window {
    __STARFORGE__?: StarforgeQaApi;
  }
}

interface PlayerBullet {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  pierceLeft: number;
  isHoming: boolean;
  isDeflected: boolean;
  isWingman: boolean;
  isMainWeapon: boolean;
  age: number;
  maxAge: number;
  color: THREE.Color;
  hitIds: Set<number>;
}

interface EnemyBullet {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  age: number;
  maxAge: number;
  color: THREE.Color;
}

interface PickupItem {
  kind: 'repair' | 'energy';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
}

interface WingmanUnit {
  instance: PooledModelInstance;
  rig: AnimationRig;
  side: -1 | 1;
  pos: THREE.Vector3;
}

interface FloatingText {
  el: HTMLDivElement;
  worldPos: THREE.Vector3;
  age: number;
  maxAge: number;
  vy: number;
}

const MAX_PLAYER_BULLETS = 240;
const MAX_ENEMY_BULLETS = 280;
const MAX_PICKUPS = 32;

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  private readonly loader = new AssetLoader();
  private readonly sound: SoundEngine;
  private readonly save = new SaveStore();
  private readonly vfx: VfxSystem;
  private readonly waves: WaveDirector;

  // Lighting & Hangar Pedestal
  private readonly accentPointLight: THREE.PointLight;
  private readonly hangarPedestal = new THREE.Group();
  private readonly beamGroup = new THREE.Group();
  private readonly shieldBubbleMesh: THREE.Mesh;
  private readonly engineGlowMesh: THREE.Mesh;

  // Instanced Projectiles & Pickups
  private readonly playerBulletInst: THREE.InstancedMesh;
  private readonly enemyBulletInst: THREE.InstancedMesh;
  private readonly repairPickupInst: THREE.InstancedMesh;
  private readonly energyPickupInst: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  // State
  private state: GameState = 'boot';
  private loadProgress = 0;
  private selectedShipIndex = 0;
  private hangarShipInstance: PooledModelInstance | null = null;
  private hangarShipRig: AnimationRig | null = null;
  private hangarYaw = 0.55;
  private isDraggingHangar = false;
  private dragStartX = 0;

  // Active Sortie Runtime
  private activeShip: ShipConfig = SHIPS[0];
  private playerInstance: PooledModelInstance | null = null;
  private playerRig: AnimationRig | null = null;
  private readonly wingmen: WingmanUnit[] = [];

  private playerPos = new THREE.Vector3(0, 0, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerHp = 100;
  private playerMaxHp = 100;
  private invulnTimer = 0;
  private timeSinceHit = 10;
  private fireCooldown = 0;
  private shotCounter = 0;
  private rollTimer = 0;
  private rollDuration = 0.46;
  private rollCooldownTimer = 0;
  private rollDir = 1;
  private ultimateCharge = 0;
  private ultimateActiveTimer = 0;
  private boostFovTimer = 0;
  private hitStopTimer = 0;
  private slowMoTimer = 0;
  private screenShake = 0;
  private score = 0;
  private kills = 0;
  private recordedKillsThisRun = 0;
  private aeroBounceCount = 0;
  private combo = 1.0;
  private comboTimer = 0;
  private runDurationSec = 0;
  private autoFire = true;
  private pointerDown = false;
  private pointerAimNDC = new THREE.Vector2(0, 0);
  private readonly keys = new Set<string>();
  private upgrades: UpgradeState = createInitialUpgradeState();
  private currentUpgradeChoices: UpgradeCard[] = [];

  private readonly playerBullets: PlayerBullet[] = [];
  private readonly enemyBullets: EnemyBullet[] = [];
  private readonly pickups: PickupItem[] = [];
  private readonly floatingTexts: FloatingText[] = [];

  // DOM Elements
  private readonly els: Record<string, HTMLElement>;
  private readonly dialogs: {
    upgrade: HTMLDialogElement;
    pause: HTMLDialogElement;
    result: HTMLDialogElement;
  };

  private bannerTimer = 0;
  private lastRafTime = 0;
  private globalElapsed = 0;
  private bossDetachTick = 0;
  private readonly tmpVec3 = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly upZ = new THREE.Vector3(0, 0, 1);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.sound = new SoundEngine(this.save.isMuted());

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ACT_THEMES[0].bgColor);
    this.scene.fog = new THREE.FogExp2(ACT_THEMES[0].fogColor, 0.0082);

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      420
    );
    this.camera.position.set(0, 2.2, 8.2);

    // Rich 3-point + hemisphere space lighting
    const hemi = new THREE.HemisphereLight(0xa5f3fc, 0x1e1b4b, 1.35);
    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.6);
    keyLight.position.set(14, 24, 18);
    const rimCyan = new THREE.DirectionalLight(0x00f0ff, 1.55);
    rimCyan.position.set(-18, 8, -14);
    const fillWarm = new THREE.DirectionalLight(0xffb347, 0.9);
    fillWarm.position.set(12, -10, -8);
    this.accentPointLight = new THREE.PointLight(0x00f0ff, 2.5, 22);
    this.scene.add(hemi, keyLight, rimCyan, fillWarm, this.accentPointLight);

    this.vfx = new VfxSystem(this.scene);
    this.waves = new WaveDirector(this.scene, this.loader);

    // Hangar turntable pedestal
    const padOuter = new THREE.Mesh(
      new THREE.TorusGeometry(2.65, 0.05, 10, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 })
    );
    padOuter.rotation.x = Math.PI * 0.5;
    padOuter.position.y = -1.6;
    const padInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.03, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.65 })
    );
    padInner.rotation.x = Math.PI * 0.5;
    padInner.position.y = -1.62;
    const padDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.8, 0.12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0b162c,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x082f49,
        emissiveIntensity: 0.65,
      })
    );
    padDisc.position.y = -1.68;
    this.hangarPedestal.add(padOuter, padInner, padDisc);
    this.scene.add(this.hangarPedestal);

    // Player engine thruster aura & roll shield bubble
    this.engineGlowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.engineGlowMesh.scale.set(0.9, 0.9, 2.6);
    this.engineGlowMesh.visible = false;
    this.scene.add(this.engineGlowMesh);

    this.shieldBubbleMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 2),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.shieldBubbleMesh.visible = false;
    this.scene.add(this.shieldBubbleMesh);

    // Astra Ion Beam group
    const beamOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 135, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beamOuter.rotation.x = Math.PI * 0.5;
    beamOuter.position.z = -67.5;
    const beamCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 135, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    beamCore.rotation.x = Math.PI * 0.5;
    beamCore.position.z = -67.5;
    this.beamGroup.add(beamOuter, beamCore);
    this.beamGroup.visible = false;
    this.scene.add(this.beamGroup);

    // Instanced bullets & pickups
    const pBulletGeo = new THREE.BoxGeometry(0.2, 0.2, 1.75);
    const pBulletMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
    this.playerBulletInst = new THREE.InstancedMesh(pBulletGeo, pBulletMat, MAX_PLAYER_BULLETS);
    this.playerBulletInst.frustumCulled = false;
    this.playerBulletInst.setColorAt(0, new THREE.Color(0x00f0ff));
    this.playerBulletInst.count = 0;

    const eBulletGeo = new THREE.OctahedronGeometry(0.36, 1);
    const eBulletMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.enemyBulletInst = new THREE.InstancedMesh(eBulletGeo, eBulletMat, MAX_ENEMY_BULLETS);
    this.enemyBulletInst.frustumCulled = false;
    this.enemyBulletInst.setColorAt(0, new THREE.Color(0xff4757));
    this.enemyBulletInst.count = 0;

    const repairGeo = new THREE.OctahedronGeometry(0.7, 0);
    const repairMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x34d399,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.5,
    });
    this.repairPickupInst = new THREE.InstancedMesh(repairGeo, repairMat, MAX_PICKUPS);
    this.repairPickupInst.frustumCulled = false;
    this.repairPickupInst.count = 0;

    const energyGeo = new THREE.IcosahedronGeometry(0.7, 0);
    const energyMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xc084fc,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.5,
    });
    this.energyPickupInst = new THREE.InstancedMesh(energyGeo, energyMat, MAX_PICKUPS);
    this.energyPickupInst.frustumCulled = false;
    this.energyPickupInst.count = 0;

    this.scene.add(
      this.playerBulletInst,
      this.enemyBulletInst,
      this.repairPickupInst,
      this.energyPickupInst
    );

    // Query required DOM elements & native dialogs
    this.els = this.cacheDomElements([
      'damage-vignette',
      'boot-screen',
      'boot-progress-fill',
      'boot-progress-pct',
      'boot-log',
      'boot-enter-btn',
      'hangar-ui',
      'hangar-career-stats',
      'hangar-mute-btn',
      'hangar-ship-list',
      'hangar-ship-badge',
      'hangar-ai-tag',
      'hangar-ship-name',
      'hangar-ship-code',
      'hangar-ship-record',
      'hangar-stats',
      'hangar-weapon-name',
      'hangar-weapon-desc',
      'hangar-ult-name',
      'hangar-ult-desc',
      'hangar-prompt',
      'hangar-launch-btn',
      'hud-ui',
      'hud-reticle',
      'floating-numbers',
      'hud-ship-badge',
      'hud-ship-name',
      'hud-hp-text',
      'hud-hp-fill',
      'hud-combo-box',
      'hud-combo-val',
      'hud-combo-bar',
      'hud-chip-strip',
      'hud-act-label',
      'hud-score-value',
      'hud-mute-btn',
      'hud-autofire-btn',
      'hud-pause-btn',
      'hud-banner',
      'boss-hud',
      'boss-hud-name',
      'boss-hud-ai-badge',
      'boss-hud-hp-text',
      'boss-hud-hp-fill',
      'boss-parts-row',
      'boss-hud-prompt',
      'hud-roll-card',
      'hud-roll-status',
      'hud-roll-fill',
      'hud-ult-card',
      'hud-ult-pct',
      'hud-ult-fill',
      'upgrade-cards-grid',
      'upgrade-status-hint',
      'result-medal-img',
      'result-dialog-title',
      'result-subtitle',
      'result-stats-grid',
      'result-endless-btn',
    ]);

    this.dialogs = {
      upgrade: this.requireEl<HTMLDialogElement>('upgrade-dialog'),
      pause: this.requireEl<HTMLDialogElement>('pause-dialog'),
      result: this.requireEl<HTMLDialogElement>('result-dialog'),
    };

    this.bindEvents();
    this.registerQaHook();
  }

  private requireEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing DOM element #${id}`);
    return el as T;
  }

  private cacheDomElements(ids: string[]): Record<string, HTMLElement> {
    const map: Record<string, HTMLElement> = {};
    for (const id of ids) {
      map[id] = this.requireEl(id);
    }
    return map;
  }

  async init(): Promise<void> {
    this.startRenderLoop();
    this.updateMuteButtons();

    await this.loader.preloadAll((info) => {
      this.loadProgress = info.percent;
      this.els['boot-progress-fill'].style.width = `${info.percent}%`;
      this.els['boot-progress-pct'].textContent = `${info.percent}%`;
      const row = document.createElement('div');
      row.className = 'boot-log-line';
      row.textContent = info.message;
      const logEl = this.els['boot-log'];
      logEl.appendChild(row);
      logEl.scrollTop = logEl.scrollHeight;
    });

    await this.loader.warmPools(
      this.renderer,
      this.scene,
      this.camera,
      (info) => {
        this.loadProgress = info.percent;
        this.els['boot-progress-fill'].style.width = `${info.percent}%`;
        this.els['boot-progress-pct'].textContent = `${info.percent}%`;
        const row = document.createElement('div');
        row.className = 'boot-log-line is-ready';
        row.textContent = info.message;
        const logEl = this.els['boot-log'];
        logEl.appendChild(row);
        logEl.scrollTop = logEl.scrollHeight;
      },
      this.vfx.getWarmupObjects()
    );

    this.waves.initCorridorProps();

    const enterBtn = this.els['boot-enter-btn'] as HTMLButtonElement;
    enterBtn.disabled = false;
    enterBtn.textContent = '开启机库闸门 · ENTER HANGAR';
  }

  private openHangarFromBoot(): void {
    if (this.state !== 'boot') return;
    this.sound.unlock();
    this.sound.playUiClick();
    this.els['boot-screen'].classList.add('is-open');
    this.els['boot-screen'].style.pointerEvents = 'none';
    window.setTimeout(() => {
      this.els['boot-screen'].hidden = true;
    }, 650);
    this.enterHangar();
  }

  private clearInputState(): void {
    this.keys.clear();
    this.pointerDown = false;
    this.isDraggingHangar = false;
  }

  private closeAllDialogs(): void {
    if (this.dialogs.upgrade.open) this.dialogs.upgrade.close();
    if (this.dialogs.pause.open) this.dialogs.pause.close();
    if (this.dialogs.result.open) this.dialogs.result.close();
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('blur', () => {
      this.clearInputState();
    });

    this.els['boot-enter-btn'].addEventListener('click', () => {
      this.openHangarFromBoot();
    });

    this.els['hangar-launch-btn'].addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playUiClick();
      this.startSortie();
    });

    this.els['hangar-mute-btn'].addEventListener('click', () => this.toggleMute());
    this.els['hud-mute-btn'].addEventListener('click', () => this.toggleMute());

    this.els['hud-autofire-btn'].addEventListener('click', () => {
      this.autoFire = !this.autoFire;
      this.updateAutoFireButton();
      this.sound.playUiClick();
    });

    this.els['hud-pause-btn'].addEventListener('click', () => this.openPauseDialog());
    this.els['hud-roll-card'].addEventListener('click', () => this.tryBarrelRoll());
    this.els['hud-ult-card'].addEventListener('click', () => this.tryUltimate());

    // Pointer input for aiming, manual fire & Hangar turntable inspection
    this.canvas.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      if (this.state === 'hangar') {
        this.isDraggingHangar = true;
        this.dragStartX = e.clientX;
      } else if (this.state === 'playing') {
        if (e.button === 2) {
          this.tryBarrelRoll();
        } else {
          this.pointerDown = true;
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.state === 'hangar' && this.isDraggingHangar) {
        const dx = e.clientX - this.dragStartX;
        this.dragStartX = e.clientX;
        this.hangarYaw += dx * 0.01;
      }
      this.pointerAimNDC.x = THREE.MathUtils.clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      this.pointerAimNDC.y = THREE.MathUtils.clamp(
        -((e.clientY / window.innerHeight) * 2 - 1),
        -1,
        1
      );
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingHangar = false;
      this.pointerDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);

      if (code === 'KeyM') {
        this.toggleMute();
        return;
      }

      if (this.state === 'upgrade') {
        if (code === 'Digit1' && this.currentUpgradeChoices[0]) {
          this.selectUpgradeCard(this.currentUpgradeChoices[0].id);
        } else if (code === 'Digit2' && this.currentUpgradeChoices[1]) {
          this.selectUpgradeCard(this.currentUpgradeChoices[1].id);
        } else if (code === 'Digit3' && this.currentUpgradeChoices[2]) {
          this.selectUpgradeCard(this.currentUpgradeChoices[2].id);
        }
        return;
      }

      if (this.state === 'playing') {
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
          this.tryBarrelRoll();
        } else if (code === 'Space' || code === 'KeyQ') {
          e.preventDefault();
          this.tryUltimate();
        } else if (code === 'KeyF') {
          this.autoFire = !this.autoFire;
          this.updateAutoFireButton();
        } else if (code === 'Escape') {
          this.openPauseDialog();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Native <dialog> handlers following modern-web-guidance strictly
    this.dialogs.upgrade.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.els['upgrade-status-hint'].classList.remove('is-shake');
      void this.els['upgrade-status-hint'].offsetWidth;
      this.els['upgrade-status-hint'].classList.add('is-shake');
    });

    this.dialogs.upgrade.addEventListener('close', () => {
      this.dialogs.upgrade.returnValue = '';
    });

    this.dialogs.pause.addEventListener('close', () => {
      const val = this.dialogs.pause.returnValue;
      this.dialogs.pause.returnValue = '';
      if (this.state !== 'paused') return;
      if (val === 'hangar') {
        this.enterHangar();
      } else if (val === 'restart') {
        this.startSortie();
      } else {
        // '' (Esc) or 'resume' -> resume combat
        this.state = 'playing';
      }
    });

    this.dialogs.result.addEventListener('close', () => {
      const val = this.dialogs.result.returnValue;
      this.dialogs.result.returnValue = '';
      if (this.state !== 'result') return;
      if (val === 'endless') {
        this.enterEndlessMode();
      } else if (val === 'retry') {
        this.startSortie();
      } else {
        this.enterHangar();
      }
    });
  }

  private toggleMute(): void {
    this.sound.unlock();
    const next = !this.sound.isMuted();
    this.sound.setMuted(next);
    this.save.setMuted(next);
    this.updateMuteButtons();
  }

  private updateMuteButtons(): void {
    const label = this.sound.isMuted() ? '音效: 关 [M]' : '音效: 开 [M]';
    this.els['hangar-mute-btn'].textContent = label;
    this.els['hud-mute-btn'].textContent = label;
  }

  private updateAutoFireButton(): void {
    this.els['hud-autofire-btn'].textContent = this.autoFire
      ? '开火: 自动 [F]'
      : '开火: 手动 [F]';
    this.els['hud-autofire-btn'].classList.toggle('is-active', this.autoFire);
  }

  // ==================== HANGAR ====================

  private enterHangar(): void {
    this.closeAllDialogs();
    this.clearInputState();
    this.cleanupCombatObjects();
    this.state = 'hangar';
    this.els['hangar-ui'].hidden = false;
    this.els['hud-ui'].hidden = true;
    this.els['boss-hud'].hidden = true;
    this.hangarPedestal.visible = true;
    this.engineGlowMesh.visible = false;
    this.shieldBubbleMesh.visible = false;
    this.beamGroup.visible = false;

    const saveData = this.save.getAll();
    this.els['hangar-career-stats'].textContent = `总击坠 ${saveData.totalKills} // 出击 ${saveData.totalRuns} 次`;

    this.renderHangarShipList();
    this.selectHangarShip(this.selectedShipIndex);
  }

  private renderHangarShipList(): void {
    const list = this.els['hangar-ship-list'];
    list.innerHTML = '';
    SHIPS.forEach((ship, idx) => {
      const rec = this.save.getShipRecord(ship.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `hangar-ship-card${idx === this.selectedShipIndex ? ' is-selected' : ''}`;
      btn.style.setProperty('--ship-accent', ship.accentColor);
      btn.innerHTML = `
        <img src="${ship.badgeIcon}" class="ship-card-badge" alt="" />
        <div class="ship-card-meta">
          <div class="ship-card-code">${ship.factionTag}</div>
          <div class="ship-card-name">${ship.nameZh}</div>
          <div class="ship-card-role">${ship.roleTag}</div>
          <div class="ship-card-best">${rec.bestScore > 0 ? `最高 ${rec.bestScore.toLocaleString()}` : '待命首航'}</div>
        </div>
      `;
      btn.addEventListener('click', () => {
        this.sound.unlock();
        this.sound.playUiClick();
        this.selectHangarShip(idx);
      });
      list.appendChild(btn);
    });
  }

  private selectHangarShip(index: number): void {
    this.selectedShipIndex = index;
    const ship = SHIPS[index];
    this.activeShip = ship;

    if (this.hangarShipInstance) {
      this.loader.release(this.hangarShipInstance);
      this.hangarShipInstance = null;
      this.hangarShipRig = null;
    }

    const inst = this.loader.instantiateFresh(ship.modelKey, false);
    inst.root.position.set(0, -0.2, 0);
    inst.root.rotation.set(0, this.hangarYaw, 0);
    this.scene.add(inst.root);
    this.hangarShipInstance = inst;
    this.hangarShipRig = new AnimationRig(ship.modelKey, inst.modelRoot, inst.animations, 'hangar');

    this.accentPointLight.color.setHex(ship.accentHex);
    this.accentPointLight.position.set(2.5, 2.5, 3.5);

    // Update UI buttons state
    const cards = this.els['hangar-ship-list'].querySelectorAll('.hangar-ship-card');
    cards.forEach((c, i) => c.classList.toggle('is-selected', i === index));

    const modelSpec = MODEL_ASSETS[ship.modelKey];
    const rec = this.save.getShipRecord(ship.id);
    (this.els['hangar-ship-badge'] as HTMLImageElement).src = ship.badgeIcon;
    this.els['hangar-ai-tag'].textContent = `${modelSpec.aiModel} · CC BY 4.0`;
    this.els['hangar-ship-name'].textContent = ship.nameZh;
    this.els['hangar-ship-code'].textContent = ship.codeName;
    this.els['hangar-weapon-name'].textContent = ship.weaponName;
    this.els['hangar-weapon-desc'].textContent = ship.weaponDesc;
    this.els['hangar-ult-name'].textContent = ship.ultimateName;
    this.els['hangar-ult-desc'].textContent = ship.ultimateDesc;
    this.els['hangar-prompt'].textContent = modelSpec.prompt;

    const clearText =
      rec.bestClearTimeSec !== null ? `${rec.bestClearTimeSec.toFixed(1)}s` : '--';
    this.els['hangar-ship-record'].innerHTML = `
      <span>最佳战绩: <strong>${rec.bestScore.toLocaleString()}</strong></span>
      <span>最快通关: <strong>${clearText}</strong></span>
      <span>无尽波次: <strong>W${rec.bestEndlessWave}</strong></span>
    `;

    const statLabels: [string, number][] = [
      ['主炮火力', ship.stats.firepower],
      ['引擎极速', ship.stats.speed],
      ['偏转护盾', ship.stats.shield],
      ['矢量机动', ship.stats.agility],
    ];
    this.els['hangar-stats'].innerHTML = statLabels
      .map(
        ([lbl, val]) => `
      <div class="stat-row">
        <span class="stat-label">${lbl}</span>
        <div class="stat-pips">${[1, 2, 3, 4, 5]
          .map((n) => `<span class="stat-pip${n <= val ? ' is-filled' : ''}"></span>`)
          .join('')}</div>
      </div>
    `
      )
      .join('');
  }

  // ==================== SORTIE & COMBAT ====================

  private startSortie(): void {
    this.closeAllDialogs();
    this.clearInputState();
    this.cleanupCombatObjects();
    if (this.hangarShipInstance) {
      this.loader.release(this.hangarShipInstance);
      this.hangarShipInstance = null;
      this.hangarShipRig = null;
    }

    this.state = 'playing';
    this.hangarPedestal.visible = false;
    this.els['hangar-ui'].hidden = true;
    this.els['hud-ui'].hidden = false;
    this.els['boss-hud'].hidden = true;

    const ship = SHIPS[this.selectedShipIndex];
    this.activeShip = ship;
    this.upgrades = createInitialUpgradeState(ship.id);
    this.score = 0;
    this.kills = 0;
    this.recordedKillsThisRun = 0;
    this.aeroBounceCount = 0;
    this.combo = 1.0;
    this.comboTimer = 0;
    this.runDurationSec = 0;
    this.invulnTimer = 1.5;
    this.timeSinceHit = 10;
    this.fireCooldown = 0;
    this.shotCounter = 0;
    this.rollTimer = 0;
    this.rollCooldownTimer = 0;
    this.ultimateCharge = 35; // Start with partial juice
    this.ultimateActiveTimer = 0;
    this.boostFovTimer = 0;
    this.hitStopTimer = 0;
    this.slowMoTimer = 0;
    this.screenShake = 0;

    this.playerMaxHp = ship.baseHp;
    this.playerHp = ship.baseHp;
    this.playerPos.set(0, -0.8, 0);
    this.playerVel.set(0, 0, 0);

    const pInst = this.loader.instantiateFresh(ship.modelKey, false);
    this.scene.add(pInst.root);
    this.playerInstance = pInst;
    this.playerRig = new AnimationRig(ship.modelKey, pInst.modelRoot, pInst.animations, 'combat');

    (this.engineGlowMesh.material as THREE.MeshBasicMaterial).color.setHex(ship.engineColor);
    this.engineGlowMesh.visible = true;
    this.accentPointLight.color.setHex(ship.accentHex);

    (this.els['hud-ship-badge'] as HTMLImageElement).src = ship.badgeIcon;
    this.els['hud-ship-name'].textContent = ship.nameZh;
    this.updateAutoFireButton();
    this.renderChipStrip();

    this.sound.startBgm();
    const startEv = this.waves.startCampaign();
    this.handleWaveEvent(startEv);
    this.updateHud();
  }

  private enterEndlessMode(): void {
    this.closeAllDialogs();
    this.clearInputState();
    this.state = 'playing';
    this.els['hud-ui'].hidden = false;
    this.els['boss-hud'].hidden = true;
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + Math.round(this.playerMaxHp * 0.45));
    const ev = this.waves.startEndlessMode();
    this.handleWaveEvent(ev);
    this.updateHud();
  }

  private cleanupCombatObjects(): void {
    this.vfx.clearTransientEffects();
    this.waves.clearCombatEntities();
    this.playerBullets.length = 0;
    this.enemyBullets.length = 0;
    this.pickups.length = 0;
    this.playerBulletInst.count = 0;
    this.enemyBulletInst.count = 0;
    this.repairPickupInst.count = 0;
    this.energyPickupInst.count = 0;
    this.beamGroup.visible = false;
    this.shieldBubbleMesh.visible = false;

    if (this.playerInstance) {
      this.loader.release(this.playerInstance);
      this.playerInstance = null;
      this.playerRig = null;
    }
    for (const w of this.wingmen) {
      this.loader.release(w.instance);
    }
    this.wingmen.length = 0;

    for (const ft of this.floatingTexts) {
      ft.el.remove();
    }
    this.floatingTexts.length = 0;
  }

  private spawnWingmanUnit(): void {
    if (this.wingmen.length >= 2) return;
    const side: -1 | 1 = this.wingmen.length === 0 ? -1 : 1;
    const inst = this.loader.acquire('ally_biplane', false);
    const rig = new AnimationRig('ally_biplane', inst.modelRoot, inst.animations, 'combat');
    const pos = this.playerPos.clone().add(new THREE.Vector3(side * 3.1, 0.55, 1.2));
    inst.root.position.copy(pos);
    this.scene.add(inst.root);
    this.wingmen.push({ instance: inst, rig, side, pos });
  }

  private tryBarrelRoll(): void {
    if (this.state !== 'playing') return;
    if (this.rollCooldownTimer > 0 || this.rollTimer > 0) return;

    this.rollDuration = 0.46 + (this.upgrades.stacks['deflect'] ?? 0) * 0.08;
    this.rollTimer = this.rollDuration;
    this.rollCooldownTimer = Math.max(
      0.35,
      this.activeShip.rollCooldown * this.upgrades.rollCooldownMult
    );
    this.invulnTimer = Math.max(this.invulnTimer, this.rollTimer);
    this.rollDir = this.playerVel.x >= 0 ? 1 : -1;
    this.boostFovTimer = Math.max(this.boostFovTimer, 0.45);
    this.sound.playRoll(false);

    if (this.upgrades.rollBurstShots > 0) {
      const count = this.upgrades.rollBurstShots;
      for (let i = 0; i < count; i++) {
        const spread = ((i / Math.max(1, count - 1)) - 0.5) * 0.65;
        this.spawnPlayerBullet(
          this.playerPos.clone().add(new THREE.Vector3(spread * 2, 0, -1.6)),
          new THREE.Vector3(spread * 45, 0, -this.activeShip.bulletSpeed * 1.1),
          this.activeShip.bulletDamage * 1.15,
          this.upgrades.pierceCount,
          false,
          false,
          false,
          false,
          this.activeShip.accentHex
        );
      }
    }
  }

  private tryUltimate(): void {
    if (this.state !== 'playing') return;
    if (this.ultimateCharge < this.activeShip.ultimateCost) return;

    this.ultimateCharge = 0;
    this.sound.playUltimate();
    this.boostFovTimer = Math.max(this.boostFovTimer, 2.2);
    this.screenShake = Math.max(this.screenShake, 0.55);

    const id: ShipId = this.activeShip.id;
    if (id === 'astra') {
      this.ultimateActiveTimer = 2.5;
      this.showBanner('轨道离子过载光束 // ION OVERDRIVE');
    } else if (id === 'opus') {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 30);
      this.invulnTimer = Math.max(this.invulnTimer, 1.5);
      // Convert every active enemy projectile into a homing allied missile
      for (const eb of this.enemyBullets) {
        this.spawnPlayerBullet(
          eb.pos.clone(),
          new THREE.Vector3(0, 0, -78),
          this.activeShip.bulletDamage * 2.4,
          1,
          true,
          true,
          false,
          false,
          0x00f0ff
        );
      }
      this.enemyBullets.length = 0;
      this.enemyBulletInst.count = 0;
      this.vfx.spawnExplosion(this.playerPos, 3.2, 0x00f0ff, false);
      this.showBanner('电磁护盾新星 · 弹幕转化!');
    } else if (id === 'morph') {
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const offset = new THREE.Vector3(Math.cos(angle) * 1.8, Math.sin(angle) * 1.2, -1.4);
        this.spawnPlayerBullet(
          this.playerPos.clone().add(offset),
          new THREE.Vector3(Math.cos(angle) * 24, Math.sin(angle) * 18, -68),
          this.activeShip.bulletDamage * 1.9,
          0,
          true,
          false,
          false,
          false,
          0xff4757
        );
      }
      this.showBanner('幻影齐射风暴 // 18X MISSILE SALVO');
    } else {
      this.ultimateActiveTimer = 4.0;
      this.showBanner('棱镜时空缓速场 // CHRONO PRISM');
    }
  }

  private openPauseDialog(): void {
    if (this.state !== 'playing') return;
    this.closeAllDialogs();
    this.clearInputState();
    this.state = 'paused';
    this.dialogs.pause.returnValue = '';
    if (!this.dialogs.pause.open) {
      this.dialogs.pause.showModal();
    }
  }

  private openUpgradeDialog(): void {
    this.closeAllDialogs();
    this.clearInputState();
    this.state = 'upgrade';
    this.currentUpgradeChoices = pickUpgradeChoices(this.upgrades, 3);
    const grid = this.els['upgrade-cards-grid'];
    grid.innerHTML = '';

    this.currentUpgradeChoices.forEach((card, idx) => {
      const stacks = this.upgrades.stacks[card.id] ?? 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-card is-${card.accent}`;
      if (idx === 0) btn.autofocus = true;
      btn.innerHTML = `
        <img src="./ui/card_chip_frame.png" class="chip-card-bg" alt="" />
        <img src="${card.icon}" class="chip-socket-icon" alt="" />
        <div class="chip-card-inner">
          <div class="chip-top-row">
            <span class="chip-code">${card.codeName}</span>
            <span class="chip-lv">${stacks > 0 ? `Lv.${stacks + 1}` : 'NEW'}</span>
          </div>
          <img src="${card.icon}" class="chip-showcase-icon" alt="" />
          <h3 class="chip-title">${card.nameZh}</h3>
          <p class="chip-desc">${card.descZh}</p>
          <span class="chip-key-pill">选择装配 [${idx + 1}]</span>
        </div>
      `;
      btn.addEventListener('click', () => this.selectUpgradeCard(card.id));
      grid.appendChild(btn);
    });

    this.dialogs.upgrade.returnValue = '';
    if (!this.dialogs.upgrade.open) {
      this.dialogs.upgrade.showModal();
    }
  }

  private selectUpgradeCard(cardId: string): void {
    if (this.state !== 'upgrade') return;
    const { shieldHeal, ultBoost, newWingmen } = applyUpgradeCard(this.upgrades, cardId);
    if (shieldHeal > 0) {
      this.playerMaxHp = this.activeShip.baseHp + this.upgrades.maxHpBonus;
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + shieldHeal);
    }
    if (ultBoost > 0) {
      this.addUltimateCharge(ultBoost);
    }
    if (newWingmen > 0) {
      this.spawnWingmanUnit();
    }

    this.sound.playUpgrade();
    this.renderChipStrip();
    if (this.dialogs.upgrade.open) {
      this.dialogs.upgrade.close(cardId);
    }
    this.state = 'playing';

    const ev = this.waves.resumeAfterUpgrade();
    if (ev) this.handleWaveEvent(ev);
  }

  private renderChipStrip(): void {
    const strip = this.els['hud-chip-strip'];
    const entries = Object.entries(this.upgrades.stacks).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      strip.innerHTML = '';
      return;
    }
    const cardMap = new Map(UPGRADE_CARDS.map((c) => [c.id, c]));
    strip.innerHTML = entries
      .map(([id, cnt]) => {
        const icon = cardMap.get(id)?.icon ?? `./ui/icons/icon_${id}.png`;
        return `<span class="hud-chip-mini"><img src="${icon}" alt="" /><em>x${cnt}</em></span>`;
      })
      .join('');
  }

  private showResultDialog(victory: boolean): void {
    this.closeAllDialogs();
    this.clearInputState();
    this.state = 'result';
    this.sound.stopBgm();

    const deltaKills = Math.max(0, this.kills - this.recordedKillsThisRun);
    this.recordedKillsThisRun = this.kills;
    const recordInfo = this.save.recordRunResult({
      shipId: this.activeShip.id,
      score: Math.round(this.score),
      kills: deltaKills,
      clearTimeSec: victory ? this.runDurationSec : null,
      endlessWave: this.waves.getEndlessWave(),
      victory,
    });

    (this.els['result-medal-img'] as HTMLImageElement).src = victory
      ? './ui/icons/medal_victory.png'
      : './ui/icons/medal_defeat.png';
    this.els['result-dialog-title'].textContent = victory
      ? '战役凯旋 · CAMPAIGN CLEARED'
      : '机体战损 · SIGNAL LOST';
    this.els['result-subtitle'].textContent = victory
      ? `${this.activeShip.nameZh} 成功摧毁龙骨母舰，千模空域已肃清`
      : `在第 ${this.waves.getAct()} 幕空域遭遇重创，请整备战机再战`;

    const newRecordTag = recordInfo.isNewBestScore ? ' <span class="badge-new">NEW BEST!</span>' : '';
    const endlessRow = this.waves.isEndless()
      ? `<div class="res-stat"><span>无尽波次</span><strong>WAVE ${this.waves.getEndlessWave()}</strong></div>`
      : '';

    this.els['result-stats-grid'].innerHTML = `
      <div class="res-stat"><span>最终战绩</span><strong>${Math.round(this.score).toLocaleString()}${newRecordTag}</strong></div>
      <div class="res-stat"><span>累计击坠</span><strong>${this.kills} 架</strong></div>
      <div class="res-stat"><span>出击耗时</span><strong>${this.runDurationSec.toFixed(1)}s</strong></div>
      ${endlessRow || `<div class="res-stat"><span>最高连击</span><strong>x${this.combo.toFixed(1)}</strong></div>`}
    `;

    const endlessBtn = this.els['result-endless-btn'] as HTMLButtonElement;
    endlessBtn.hidden = !victory;

    this.dialogs.result.returnValue = '';
    if (!this.dialogs.result.open) {
      this.dialogs.result.showModal();
    }
  }

  private handleWaveEvent(ev: ReturnType<WaveDirector['startCampaign']>): void {
    if (ev.type === 'act_banner') {
      const theme = ACT_THEMES[Math.min(ACT_THEMES.length - 1, Math.max(0, ev.act - 1))];
      this.showBanner(`${theme.titleZh} · WAVE ${ev.waveInAct}`);
    } else if (ev.type === 'endless_wave') {
      this.showBanner(`无尽深空 // ENDLESS WAVE ${ev.endlessWave}`);
    } else if (ev.type === 'upgrade_prompt') {
      this.openUpgradeDialog();
    } else if (ev.type === 'boss_intro' && ev.bossConfig) {
      this.sound.playBossWarning();
      this.showBossHud(ev.bossConfig);
      this.showBanner(`⚠ 警报: ${ev.bossConfig.nameZh} 降临!`);
    } else if (ev.type === 'campaign_victory') {
      this.showResultDialog(true);
    }
  }

  private showBossHud(cfg: BossConfig): void {
    this.els['boss-hud'].hidden = false;
    this.els['boss-hud-name'].textContent = cfg.nameZh;
    this.els['boss-hud-ai-badge'].textContent = cfg.aiModel;
    this.els['boss-hud-prompt'].textContent = `PROMPT // "${cfg.prompt}"`;
    this.updateBossHud();
  }

  private updateBossHud(): void {
    const boss = this.waves.activeBoss;
    if (!boss) {
      this.els['boss-hud'].hidden = true;
      return;
    }
    const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
    this.els['boss-hud-hp-fill'].style.width = `${pct}%`;
    this.els['boss-hud-hp-text'].textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`;
    this.els['boss-parts-row'].innerHTML = boss.parts
      .map((p) => {
        if (p.destroyed) {
          return `<span class="boss-part-pill is-broken">${p.labelZh}: 已击毁</span>`;
        }
        const pp = Math.round((p.hp / p.maxHp) * 100);
        return `<span class="boss-part-pill">${p.labelZh} ${pp}%</span>`;
      })
      .join('');
  }

  private showBanner(text: string): void {
    this.els['hud-banner'].textContent = text;
    this.els['hud-banner'].classList.add('is-visible');
    this.bannerTimer = 2.7;
  }

  private flashDamageVignette(kind: 'damage' | 'heal' | 'boost'): void {
    const el = this.els['damage-vignette'];
    el.className = `damage-vignette is-${kind}`;
    window.setTimeout(() => {
      el.className = 'damage-vignette';
    }, 260);
  }

  private spawnFloatingText(
    worldPos: THREE.Vector3,
    text: string,
    kind: 'normal' | 'crit' | 'part' | 'heal' | 'score'
  ): void {
    const el = document.createElement('div');
    el.className = `float-num is-${kind}`;
    el.textContent = text;
    this.els['floating-numbers'].appendChild(el);
    this.floatingTexts.push({
      el,
      worldPos: worldPos.clone(),
      age: 0,
      maxAge: kind === 'part' ? 1.15 : 0.72,
      vy: kind === 'part' ? 38 : 52,
    });
  }

  private addUltimateCharge(rawAmount: number): void {
    if (this.ultimateActiveTimer > 0) return;
    this.ultimateCharge = Math.min(
      this.activeShip.ultimateCost,
      this.ultimateCharge + rawAmount * this.upgrades.ultimateChargeMult
    );
  }

  // ==================== MAIN UPDATE LOOP ====================

  private startRenderLoop(): void {
    this.lastRafTime = performance.now();
    const tick = (now: number) => {
      requestAnimationFrame(tick);
      const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastRafTime) / 1000));
      this.lastRafTime = now;
      this.globalElapsed += rawDt;

      this.frameUpdate(rawDt);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(tick);
  }

  private frameUpdate(rawDt: number): void {
    if (this.state === 'boot') {
      this.waves.updateEnvironment(rawDt, 0.75);
      this.camera.position.set(Math.sin(this.globalElapsed * 0.25) * 1.4, 1.8, 12);
      this.camera.lookAt(0, 0, -40);
      return;
    }

    if (this.state === 'hangar') {
      this.waves.updateEnvironment(rawDt, 0.35);
      if (!this.isDraggingHangar) {
        this.hangarYaw += rawDt * 0.35;
      }
      if (this.hangarShipInstance && this.hangarShipRig) {
        this.hangarShipInstance.root.rotation.y = this.hangarYaw;
        this.hangarShipInstance.root.position.y = Math.sin(this.globalElapsed * 2.1) * 0.08 - 0.15;
        this.hangarShipRig.update({ dt: rawDt, elapsed: this.globalElapsed });
      }
      this.camera.position.lerp(new THREE.Vector3(0.4, 1.45, 5.1), rawDt * 6);
      this.camera.lookAt(0, -0.15, 0);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 50, rawDt * 5);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.state !== 'playing') {
      // Keep floating texts cleanly frozen or slow-faded during modals
      return;
    }

    this.runDurationSec += rawDt;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= rawDt;
      if (this.bannerTimer <= 0) {
        this.els['hud-banner'].classList.remove('is-visible');
      }
    }

    // Hit-stop freezes world simulation briefly on heavy Boss part breaks
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      this.updateCameraAndFloatingTexts(rawDt);
      return;
    }

    let timeScale = 1.0;
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= rawDt;
      timeScale = 0.28;
    }
    const dt = rawDt * timeScale;

    const enemySlowFactor =
      this.activeShip.id === 'aero' && this.ultimateActiveTimer > 0 ? 0.28 : 1.0;

    // 1. Environment & boost ring checks
    const envBoost = this.boostFovTimer > 0 || this.ultimateActiveTimer > 0 ? 1.55 : 1.0;
    this.waves.updateEnvironment(dt, envBoost);
    for (const ring of this.waves.getBoostRings()) {
      if (!ring.active || ring.triggered) continue;
      if (Math.abs(ring.pos.z - this.playerPos.z) < 2.3) {
        const dx = ring.pos.x - this.playerPos.x;
        const dy = ring.pos.y - this.playerPos.y;
        if (dx * dx + dy * dy < ring.radius * ring.radius) {
          ring.triggered = true;
          ring.group.visible = false;
          this.boostFovTimer = 0.9;
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 10);
          this.addUltimateCharge(15);
          this.score += Math.round(250 * this.combo);
          this.comboTimer = 3.5;
          this.sound.playPickup();
          this.flashDamageVignette('boost');
          this.spawnFloatingText(this.playerPos, '+10 护盾 · 加速!', 'heal');
        }
      }
    }

    // 2. Player Movement, Firing, Abilities & Rig
    this.updatePlayer(dt);

    // 3. Wave Director Spawning
    const waveEv = this.waves.updateWaves(dt);
    if (waveEv) this.handleWaveEvent(waveEv);

    // 4. Enemies & Bosses
    this.updateEnemies(dt * enemySlowFactor);
    const bossVictoryEv = this.updateBoss(dt, rawDt, enemySlowFactor);
    if (bossVictoryEv) {
      this.handleWaveEvent(bossVictoryEv);
    }

    // 5. Projectiles, Pickups & VFX
    this.updatePlayerBullets(dt);
    this.updateEnemyBullets(dt * enemySlowFactor);
    this.updatePickups(dt);
    this.vfx.update(dt);

    // 6. Camera, Floating Numbers, Reticle & HUD
    this.updateCameraAndFloatingTexts(rawDt);
    this.updateHud();
  }

  private updatePlayer(dt: number): void {
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.timeSinceHit += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.rollCooldownTimer = Math.max(0, this.rollCooldownTimer - dt);
    this.boostFovTimer = Math.max(0, this.boostFovTimer - dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = Math.max(1.0, +(this.combo - 0.5).toFixed(1));
        if (this.combo > 1.0) this.comboTimer = 2.0;
      }
    }

    if (this.upgrades.shieldRegenPerSec > 0 && this.timeSinceHit >= 2.5 && this.playerHp < this.playerMaxHp) {
      this.playerHp = Math.min(
        this.playerMaxHp,
        this.playerHp + this.upgrades.shieldRegenPerSec * dt
      );
    }

    // Input vector blending WASD/Arrows + Pointer follow
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky -= 1;

    const targetX =
      kx !== 0
        ? THREE.MathUtils.clamp(this.playerPos.x + kx * 6.5, -12, 12)
        : THREE.MathUtils.clamp(this.pointerAimNDC.x * 12, -12, 12);
    const targetY =
      ky !== 0
        ? THREE.MathUtils.clamp(this.playerPos.y + ky * 4.8, -6.4, 6.4)
        : THREE.MathUtils.clamp(this.pointerAimNDC.y * 6.4, -6.4, 6.4);

    const speed = this.activeShip.moveSpeed * this.upgrades.speedMult;
    const desiredVx = (targetX - this.playerPos.x) * (speed * 0.42);
    const desiredVy = (targetY - this.playerPos.y) * (speed * 0.42);
    this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, desiredVx, Math.min(1, dt * 11));
    this.playerVel.y = THREE.MathUtils.lerp(this.playerVel.y, desiredVy, Math.min(1, dt * 11));

    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x + this.playerVel.x * dt, -12.2, 12.2);
    this.playerPos.y = THREE.MathUtils.clamp(this.playerPos.y + this.playerVel.y * dt, -6.5, 6.5);

    // Barrel Roll spin & bullet deflection
    let rollZ = THREE.MathUtils.clamp(-this.playerVel.x * 0.036, -0.58, 0.58);
    if (this.rollTimer > 0) {
      this.rollTimer = Math.max(0, this.rollTimer - dt);
      rollZ +=
        (1 - this.rollTimer / Math.max(0.01, this.rollDuration)) *
        Math.PI *
        2 *
        this.rollDir;
      this.shieldBubbleMesh.visible = this.rollTimer > 0;
      this.shieldBubbleMesh.position.copy(this.playerPos);
      this.shieldBubbleMesh.rotation.y += dt * 7;

      // Deflect enemy bullets nearby
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const eb = this.enemyBullets[i];
        if (eb.pos.distanceToSquared(this.playerPos) < 12.5) {
          this.spawnPlayerBullet(
            eb.pos.clone(),
            new THREE.Vector3(-eb.vel.x * 0.4, -eb.vel.y * 0.4, -85),
            this.activeShip.bulletDamage * 1.65 * this.upgrades.deflectDamageMult,
            1,
            true,
            true,
            false,
            false,
            0x00f0ff
          );
          this.enemyBullets.splice(i, 1);
          this.sound.playRoll(true);
          this.score += Math.round(80 * this.combo);
        }
      }
    } else {
      this.shieldBubbleMesh.visible = false;
    }

    if (this.playerInstance && this.playerRig) {
      this.playerInstance.root.position.copy(this.playerPos);
      const pitchX = THREE.MathUtils.clamp(this.playerVel.y * 0.028, -0.35, 0.35);
      const yawY = THREE.MathUtils.clamp(-this.playerVel.x * 0.02, -0.25, 0.25);
      this.playerInstance.root.rotation.set(pitchX, yawY, rollZ);
      this.playerRig.update({
        dt,
        elapsed: this.globalElapsed,
        vx: this.playerVel.x,
        vy: this.playerVel.y,
      });
    }

    // Engine glow flicker & light
    this.engineGlowMesh.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z + 1.45);
    this.engineGlowMesh.scale.z = 2.2 + Math.sin(this.globalElapsed * 42) * 0.45;
    this.accentPointLight.position.set(this.playerPos.x, this.playerPos.y + 0.8, this.playerPos.z + 1.2);

    // Wingmen escort biplanes
    for (const w of this.wingmen) {
      const desired = new THREE.Vector3(
        this.playerPos.x + w.side * 3.1,
        this.playerPos.y + 0.55 + Math.sin(this.globalElapsed * 3.5 + w.side) * 0.25,
        this.playerPos.z + 1.1
      );
      w.pos.lerp(desired, Math.min(1, dt * 8));
      w.instance.root.position.copy(w.pos);
      w.instance.root.rotation.z = rollZ * 0.6;
      w.rig.update({ dt, elapsed: this.globalElapsed });
    }

    // Firing
    if ((this.autoFire || this.pointerDown) && this.fireCooldown <= 0) {
      this.fireMainWeapons();
    }

    // Sustained Ultimates (Astra Ion Beam / Aero Chrono Field)
    if (this.ultimateActiveTimer > 0) {
      this.ultimateActiveTimer = Math.max(0, this.ultimateActiveTimer - dt);
      if (this.ultimateActiveTimer > 0 && this.activeShip.id === 'astra') {
        this.beamGroup.visible = true;
        this.beamGroup.position.copy(this.playerPos);
        this.beamGroup.rotation.z += dt * 9;
        this.applyAstraBeamDamage(dt);
      } else {
        this.beamGroup.visible = false;
      }
    } else {
      this.beamGroup.visible = false;
    }
  }

  private fireMainWeapons(): void {
    const ship = this.activeShip;
    this.fireCooldown = ship.fireInterval / this.upgrades.fireRateMult;
    this.shotCounter += 1;
    this.sound.playShot(ship.id as WeaponVoice);

    // Velocity scaling follows pierce chip stacks so Morph starts at configured bulletSpeed
    const speedBonus = 1 + (this.upgrades.stacks['pierce'] ?? 0) * 0.22;
    const bSpeed = ship.bulletSpeed * speedBonus;
    const baseDmg = ship.bulletDamage;
    const pierce = this.upgrades.pierceCount;

    if (ship.id === 'opus') {
      // Triple plasma spread
      for (const ang of [-0.14, 0, 0.14]) {
        this.spawnPlayerBullet(
          this.playerPos.clone().add(new THREE.Vector3(Math.sin(ang) * 0.9, 0, -1.6)),
          new THREE.Vector3(Math.sin(ang) * bSpeed * 0.45, 0, -bSpeed),
          baseDmg,
          pierce,
          false,
          false,
          false,
          true,
          ship.accentHex
        );
      }
    } else if (ship.id === 'astra' || ship.id === 'morph') {
      // Twin parallel cannons
      for (const side of [-0.72, 0.72]) {
        this.spawnPlayerBullet(
          this.playerPos.clone().add(new THREE.Vector3(side, -0.05, -1.6)),
          new THREE.Vector3(0, 0, -bSpeed),
          baseDmg,
          pierce,
          false,
          false,
          false,
          true,
          ship.accentHex
        );
      }
    } else {
      // Aero center laser
      this.spawnPlayerBullet(
        this.playerPos.clone().add(new THREE.Vector3(0, -0.05, -1.65)),
        new THREE.Vector3(0, 0, -bSpeed),
        baseDmg * 1.25,
        pierce,
        false,
        false,
        false,
        true,
        ship.accentHex
      );
    }

    // Extra side shots from Split Prism upgrade
    const extraPairs = Math.floor(this.upgrades.extraSideShots / 2);
    for (let p = 1; p <= extraPairs; p++) {
      const ang = 0.13 * p;
      for (const sign of [-1, 1]) {
        this.spawnPlayerBullet(
          this.playerPos.clone().add(new THREE.Vector3(sign * 0.85, 0, -1.4)),
          new THREE.Vector3(sign * Math.sin(ang) * bSpeed, 0, -bSpeed * Math.cos(ang)),
          baseDmg * 0.82,
          pierce,
          false,
          false,
          false,
          true,
          0x00f0ff
        );
      }
    }

    // Homing Missile Salvo chip
    if (
      this.upgrades.homingInterval > 0 &&
      this.shotCounter % this.upgrades.homingInterval === 0
    ) {
      for (let m = 0; m < this.upgrades.homingSalvoCount; m++) {
        const side = m % 2 === 0 ? -1 : 1;
        this.spawnPlayerBullet(
          this.playerPos.clone().add(new THREE.Vector3(side * 1.2, 0.3, -1.0)),
          new THREE.Vector3(side * 18, 6, -64),
          baseDmg * 1.45,
          0,
          true,
          false,
          false,
          false,
          0xffb347
        );
      }
    }

    // Wingman biplanes fire synchronized shots
    if (this.wingmen.length > 0 && this.shotCounter % 2 === 0) {
      for (const w of this.wingmen) {
        this.spawnPlayerBullet(
          w.pos.clone().add(new THREE.Vector3(0, 0, -1.0)),
          new THREE.Vector3(0, 0, -bSpeed * 0.95),
          baseDmg * 0.72,
          0,
          false,
          false,
          true,
          false,
          0x38bdf8
        );
      }
    }
  }

  private spawnPlayerBullet(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    damage: number,
    pierceLeft: number,
    isHoming: boolean,
    isDeflected: boolean,
    isWingman: boolean,
    isMainWeapon: boolean,
    colorHex: number
  ): void {
    if (this.playerBullets.length >= MAX_PLAYER_BULLETS) return;
    this.playerBullets.push({
      pos,
      vel,
      damage,
      pierceLeft,
      isHoming,
      isDeflected,
      isWingman,
      isMainWeapon,
      age: 0,
      maxAge: isHoming ? 2.8 : 1.75,
      color: new THREE.Color(colorHex),
      hitIds: new Set<number>(),
    });
  }

  private applyAstraBeamDamage(dt: number): void {
    // Vaporize enemy projectiles along beam cylinder
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      if (
        eb.pos.z < this.playerPos.z &&
        Math.hypot(eb.pos.x - this.playerPos.x, eb.pos.y - this.playerPos.y) < 3.4
      ) {
        this.vfx.spawnSparks(eb.pos, 3, 0x00f0ff, 12);
        this.enemyBullets.splice(i, 1);
      }
    }

    const dps = 185 * dt;
    for (let i = this.waves.activeEnemies.length - 1; i >= 0; i--) {
      if (i >= this.waves.activeEnemies.length) continue;
      const e = this.waves.activeEnemies[i];
      if (
        e.pos.z < this.playerPos.z &&
        Math.hypot(e.pos.x - this.playerPos.x, e.pos.y - this.playerPos.y) < e.hitRadius + 2.6
      ) {
        this.damageEnemy(e, i, dps, true, true);
      }
    }

    const boss = this.waves.activeBoss;
    if (boss && !boss.dying) {
      let hitPart = false;
      for (const p of boss.parts) {
        if (p.destroyed) continue;
        if (Math.hypot(p.worldPos.x - this.playerPos.x, p.worldPos.y - this.playerPos.y) < p.hitRadius + 2.6) {
          this.damageBossPart(boss, p, dps * 0.9, p.worldPos, true, true);
          hitPart = true;
          break;
        }
      }
      if (!hitPart && Math.hypot(boss.pos.x - this.playerPos.x, boss.pos.y - this.playerPos.y) < boss.hitRadius + 2.8) {
        this.damageBoss(boss, dps * 1.1, boss.pos, true, true);
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.waves.activeEnemies.length - 1; i >= 0; i--) {
      const e = this.waves.activeEnemies[i];
      e.age += dt;
      e.flashTimer = Math.max(0, e.flashTimer - dt);
      this.applyHitFlashVisuals(e.instance, e.flashTimer);

      // Forward approach + archetype flight trajectory
      e.pos.z = THREE.MathUtils.lerp(e.pos.z, e.targetZ, Math.min(1, dt * 1.65));
      if (e.kind === 'enemy_drone') {
        e.pos.x = e.baseX + Math.sin(e.age * 2.4 + e.phase) * 3.4;
        e.pos.y = e.baseY + Math.cos(e.age * 1.8 + e.phase) * 1.3;
      } else if (e.kind === 'enemy_foldwing') {
        e.pos.x = e.baseX + Math.sin(e.age * 3.0 + e.phase) * 4.5;
        e.pos.y = e.baseY + Math.sin(e.age * 2.1) * 2.0;
        e.instance.root.rotation.z = Math.cos(e.age * 3.0 + e.phase) * 0.45;
      } else if (e.kind === 'enemy_rover') {
        e.pos.x = e.baseX + Math.sin(e.age * 1.3 + e.phase) * 2.5;
      } else {
        e.pos.x = e.baseX + Math.sin(e.age * 0.9 + e.phase) * 1.2;
      }

      e.rig.update({
        dt,
        elapsed: this.globalElapsed,
        playerPos: this.playerPos,
        worldPos: e.pos,
      });

      // Firing (suppressed during boss death slow-mo sequence)
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.pos.z > -82 && e.pos.z < -8 && !this.waves.activeBoss?.dying) {
        this.fireEnemyWeapon(e);
      }
    }
  }

  private safeDirectionToPlayer(from: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    out.subVectors(this.playerPos, from);
    if (out.lengthSq() < 1e-6) {
      return out.set(0, 0, 1);
    }
    return out.normalize();
  }

  private fireEnemyWeapon(e: ActiveEnemy): void {
    const actMult = 1 + (this.waves.getAct() - 1) * 0.14;
    if (e.kind === 'enemy_turret') {
      e.fireTimer = Math.max(1.5, 2.5 / actMult);
      for (const offset of [-0.14, 0, 0.14]) {
        const dir = this.safeDirectionToPlayer(e.pos);
        dir.x += offset;
        dir.normalize();
        this.spawnEnemyBullet(e.pos.clone(), dir.multiplyScalar(28 * actMult), 13, 0xff9f43);
      }
    } else if (e.kind === 'enemy_foldwing') {
      e.fireTimer = Math.max(1.2, 2.0 / actMult);
      for (const side of [-0.7, 0.7]) {
        const origin = e.pos.clone().add(new THREE.Vector3(side, 0, 1.0));
        const dir = this.safeDirectionToPlayer(origin);
        this.spawnEnemyBullet(origin, dir.multiplyScalar(36 * actMult), 12, 0xff4757);
      }
    } else if (e.kind === 'enemy_rover') {
      e.fireTimer = Math.max(1.4, 2.3 / actMult);
      const dir = this.safeDirectionToPlayer(e.pos);
      this.spawnEnemyBullet(e.pos.clone().add(new THREE.Vector3(0, 0.8, 1)), dir.multiplyScalar(31 * actMult), 16, 0xfbbf24);
    } else {
      e.fireTimer = Math.max(1.5, 2.6 / actMult);
      const dir = this.safeDirectionToPlayer(e.pos);
      this.spawnEnemyBullet(e.pos.clone(), dir.multiplyScalar(26 * actMult), 10, 0x38bdf8);
    }
  }

  private spawnEnemyBullet(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    damage: number,
    colorHex: number
  ): void {
    if (this.enemyBullets.length >= MAX_ENEMY_BULLETS) return;
    this.enemyBullets.push({
      pos,
      vel,
      damage,
      age: 0,
      maxAge: 4.5,
      color: new THREE.Color(colorHex),
    });
  }

  private updateBoss(
    dt: number,
    rawDt: number,
    enemySlowFactor: number
  ): ReturnType<WaveDirector['onBossDefeated']> {
    const boss = this.waves.activeBoss;
    if (!boss) return null;

    if (boss.dying) {
      // Unscaled real-time timers so multi-part chain explosions play over ~1.8s despite slow-mo
      boss.deathTimer += rawDt;
      this.bossDetachTick += rawDt;
      if (this.bossDetachTick >= 0.15 && boss.detachQueue.length > 0) {
        this.bossDetachTick = 0;
        const node = boss.detachQueue.shift();
        if (node && node.visible) {
          this.vfx.spawnDetachedPart(node, boss.pos, boss.config.accentHex);
          this.sound.playExplosion('medium');
          this.screenShake = Math.max(this.screenShake, 0.35);
        }
      }
      if (boss.deathTimer >= 1.8) {
        this.vfx.spawnExplosion(boss.pos, 5.2, boss.config.accentHex, true);
        this.sound.playExplosion('boss');
        this.screenShake = 0.9;
        this.slowMoTimer = 0;
        this.enemyBullets.length = 0;
        this.enemyBulletInst.count = 0;
        this.invulnTimer = Math.max(this.invulnTimer, 2.0);
        this.els['boss-hud'].hidden = true;
        this.addUltimateCharge(45);
        this.score += Math.round(2500 * boss.config.act * this.combo);
        this.kills += 1;
        return this.waves.onBossDefeated();
      }
      return null;
    }

    const bdt = dt * enemySlowFactor;
    boss.age += bdt;
    boss.flashTimer = Math.max(0, boss.flashTimer - dt);
    this.applyHitFlashVisuals(boss.instance, boss.flashTimer);

    // Boss hovering patrol in front of player
    boss.pos.z = THREE.MathUtils.lerp(boss.pos.z, -38, Math.min(1, bdt * 1.4));
    boss.pos.x = Math.sin(boss.age * 0.72) * 8.5;
    boss.pos.y = 1.6 + Math.cos(boss.age * 1.05) * 1.8;

    boss.rig.update({
      dt: bdt,
      elapsed: this.globalElapsed,
      playerPos: this.playerPos,
      worldPos: boss.pos,
      disabledParts: boss.disabledParts,
    });

    // Sync world coordinates of intact destructible parts
    boss.instance.root.updateMatrixWorld(true);
    for (const p of boss.parts) {
      if (!p.destroyed && p.node) {
        p.node.getWorldPosition(p.worldPos);
      }
    }

    // Boss weapon attacks — genuinely weakened when destructible parts are destroyed!
    boss.fireTimer -= bdt;
    if (boss.fireTimer <= 0 && boss.pos.z > -65) {
      this.fireBossWeapons(boss);
    }

    boss.escortTimer -= bdt;
    if (boss.escortTimer <= 0 && boss.pos.z > -65) {
      boss.escortTimer = boss.config.act === 3 && !boss.disabledParts.has('bow_crane') ? 7.5 : 10.5;
      boss.rig.triggerCarrierLaunch();
      const escortKind = boss.config.act === 1 ? 'enemy_drone' : 'enemy_foldwing';
      this.waves.spawnEscortEnemy(escortKind, boss.pos);
    }

    return null;
  }

  private fireBossWeapons(boss: ActiveBoss): void {
    boss.rig.triggerBossFire();
    const act = boss.config.act;
    const intactCount = boss.parts.filter((p) => !p.destroyed).length;
    boss.fireTimer = Math.max(1.15, 2.1 - act * 0.2 + (boss.parts.length - intactCount) * 0.45);

    const originMain = boss.pos.clone().add(new THREE.Vector3(0, 0.5, 2));
    const toPlayer = this.safeDirectionToPlayer(originMain);
    this.spawnEnemyBullet(originMain, toPlayer.multiplyScalar(34), 16, boss.config.accentHex);

    // Part-driven attacks
    for (const part of boss.parts) {
      if (part.destroyed) continue;
      const pOrigin = part.worldPos.clone();
      const dir = this.safeDirectionToPlayer(pOrigin);
      if (part.weaponEffectKey === 'leftCannon' || part.weaponEffectKey === 'rightCannon') {
        this.spawnEnemyBullet(pOrigin, dir.multiplyScalar(38), 15, 0xff9f43);
      } else if (part.weaponEffectKey === 'leftClaw' || part.weaponEffectKey === 'rightClaw') {
        for (const a of [-0.12, 0.12]) {
          const d = dir.clone();
          d.x += a;
          d.normalize();
          this.spawnEnemyBullet(pOrigin, d.multiplyScalar(33), 13, 0x00f0ff);
        }
      } else if (part.weaponEffectKey === 'dorsalTurret') {
        for (const a of [-0.22, 0, 0.22]) {
          const d = dir.clone();
          d.x += a;
          d.normalize();
          this.spawnEnemyBullet(pOrigin, d.multiplyScalar(39), 15, 0xff4757);
        }
      } else if (part.weaponEffectKey === 'bowCrane') {
        this.spawnEnemyBullet(pOrigin, dir.multiplyScalar(42), 18, 0xffb347);
      }
    }
  }

  private updatePlayerBullets(dt: number): void {
    let instCount = 0;

    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.age += dt;
      if (b.age >= b.maxAge || b.pos.z < -160) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      if (b.isHoming) {
        const target = this.findNearestTargetPos(b.pos);
        if (target) {
          this.tmpDir.subVectors(target, b.pos);
          if (this.tmpDir.lengthSq() > 1e-6) {
            this.tmpDir.normalize();
            const speed = Math.max(1, b.vel.length());
            b.vel.lerp(this.tmpDir.multiplyScalar(speed), Math.min(1, dt * 8.5)).setLength(speed);
          }
        }
      }

      b.pos.addScaledVector(b.vel, dt);

      // 1. Check Enemies
      let removed = false;
      for (let ei = this.waves.activeEnemies.length - 1; ei >= 0; ei--) {
        if (ei >= this.waves.activeEnemies.length) continue;
        const e = this.waves.activeEnemies[ei];
        if (b.hitIds.has(e.id)) continue;
        if (b.pos.distanceToSquared(e.pos) <= (e.hitRadius + 0.55) * (e.hitRadius + 0.55)) {
          b.hitIds.add(e.id);
          const hitOrigin = e.pos.clone();
          const hitId = e.id;
          const isCrit =
            (this.activeShip.id === 'aero' && this.ultimateActiveTimer > 0) ||
            Math.random() < this.upgrades.critChance;
          const dmg = b.damage * (isCrit ? this.upgrades.critMultiplier : 1);
          this.damageEnemy(e, ei, dmg, isCrit, false);
          this.maybeTriggerLightning(hitOrigin, dmg * 0.65, hitId);
          if (this.activeShip.id === 'aero' && b.isMainWeapon) {
            this.triggerAeroRefractiveBounce(hitOrigin, dmg * 0.65, hitId);
          }

          if (b.pierceLeft > 0) {
            b.pierceLeft -= 1;
          } else {
            this.playerBullets.splice(i, 1);
            removed = true;
            break;
          }
        }
      }
      if (removed) continue;

      // 2. Check Boss & Destructible Parts First!
      const boss = this.waves.activeBoss;
      if (boss && !boss.dying) {
        let hitSomething = false;
        let hitDmg = 0;

        // Prioritize intact parts (use negative UIDs to avoid colliding with positive e.id)
        for (let pi = 0; pi < boss.parts.length; pi++) {
          const p = boss.parts[pi];
          if (p.destroyed) continue;
          const partUid = -1000 - pi;
          if (b.hitIds.has(partUid)) continue;
          if (b.pos.distanceToSquared(p.worldPos) <= (p.hitRadius + 0.65) * (p.hitRadius + 0.65)) {
            b.hitIds.add(partUid);
            const isCrit =
              (this.activeShip.id === 'aero' && this.ultimateActiveTimer > 0) ||
              Math.random() < this.upgrades.critChance;
            hitDmg = b.damage * (isCrit ? this.upgrades.critMultiplier : 1);
            this.damageBossPart(boss, p, hitDmg, b.pos, isCrit, false);
            hitSomething = true;
            break;
          }
        }

        // Core hull fallback
        if (!hitSomething && !b.hitIds.has(-9999)) {
          if (b.pos.distanceToSquared(boss.pos) <= (boss.hitRadius + 0.6) * (boss.hitRadius + 0.6)) {
            b.hitIds.add(-9999);
            const isCrit =
              (this.activeShip.id === 'aero' && this.ultimateActiveTimer > 0) ||
              Math.random() < this.upgrades.critChance;
            hitDmg = b.damage * (isCrit ? this.upgrades.critMultiplier : 1);
            this.damageBoss(boss, hitDmg, b.pos, isCrit, false);
            hitSomething = true;
          }
        }

        if (hitSomething) {
          if (this.activeShip.id === 'aero' && b.isMainWeapon) {
            this.triggerAeroRefractiveBounce(b.pos, hitDmg * 0.65, -1);
          }
          if (b.pierceLeft > 0) {
            b.pierceLeft -= 1;
          } else {
            this.playerBullets.splice(i, 1);
            continue;
          }
        }
      }

      if (instCount < MAX_PLAYER_BULLETS) {
        this.dummy.position.copy(b.pos);
        if (this.tmpDir.copy(b.vel).lengthSq() > 1e-6) {
          this.tmpDir.normalize();
          this.dummy.quaternion.setFromUnitVectors(this.upZ, this.tmpDir);
        }
        const s = b.isHoming ? 1.35 : b.isDeflected ? 1.25 : 1.0;
        this.dummy.scale.set(s, s, s * (b.isHoming ? 1.2 : 1.0));
        this.dummy.updateMatrix();
        this.playerBulletInst.setMatrixAt(instCount, this.dummy.matrix);
        this.playerBulletInst.setColorAt(instCount, b.color);
        instCount += 1;
      }
    }

    this.playerBulletInst.count = instCount;
    this.playerBulletInst.instanceMatrix.needsUpdate = true;
    if (this.playerBulletInst.instanceColor) this.playerBulletInst.instanceColor.needsUpdate = true;
  }

  private triggerAeroRefractiveBounce(
    origin: THREE.Vector3,
    bounceDmg: number,
    skipEnemyId: number
  ): void {
    const maxDistSq = 16 * 16;
    let bestIdx = -1;
    let bestDistSq = maxDistSq;

    for (let i = 0; i < this.waves.activeEnemies.length; i++) {
      const candidate = this.waves.activeEnemies[i];
      if (candidate.id === skipEnemyId || candidate.hp <= 0) continue;
      const d2 = origin.distanceToSquared(candidate.pos);
      if (d2 <= bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) return;
    const target = this.waves.activeEnemies[bestIdx];
    this.aeroBounceCount += 1;
    this.vfx.spawnRefractiveBeam(origin, target.pos, 0xc084fc);
    this.vfx.spawnSparks(target.pos, 6, 0xc084fc, 13);
    this.damageEnemy(target, bestIdx, bounceDmg, false, false);
  }

  private damageEnemy(
    e: ActiveEnemy,
    indexInArray: number,
    damage: number,
    isCrit: boolean,
    fromBeam: boolean
  ): void {
    e.hp -= damage;
    e.flashTimer = 0.09;
    this.sound.playHit(isCrit);
    this.vfx.spawnSparks(e.pos, fromBeam ? 2 : 5, isCrit ? 0xffb347 : 0x00f0ff, 12);

    if (!fromBeam || Math.random() < 0.25) {
      this.spawnFloatingText(
        e.pos,
        isCrit ? `${Math.round(damage)}!` : `${Math.round(damage)}`,
        isCrit ? 'crit' : 'normal'
      );
    }

    if (e.hp <= 0) {
      const dropPos = e.pos.clone();
      const scoreGain = Math.round(e.scoreValue * this.combo);
      this.score += scoreGain;
      this.kills += 1;
      this.combo = Math.min(8.0, +(this.combo + 0.2).toFixed(1));
      this.comboTimer = 4.0;
      this.addUltimateCharge(e.isElite ? 12 : 7);

      this.vfx.spawnExplosion(
        dropPos,
        e.isElite ? 2.1 : 1.45,
        e.isElite ? 0xff6b2b : 0x00f0ff,
        true
      );
      this.sound.playExplosion(e.isElite ? 'medium' : 'small');
      this.screenShake = Math.max(this.screenShake, e.isElite ? 0.24 : 0.1);
      this.spawnFloatingText(dropPos, `+${scoreGain}`, 'score');

      if (e.isElite && Math.random() < 0.45) {
        this.spawnPickup(Math.random() < 0.48 ? 'repair' : 'energy', dropPos);
      }
      this.waves.releaseEnemyAt(indexInArray);
    }
  }

  private triggerBossDeath(boss: ActiveBoss): void {
    if (boss.dying) return;
    boss.hp = 0;
    boss.dying = true;
    boss.deathTimer = 0;
    this.bossDetachTick = 0.15;
    this.slowMoTimer = 1.85;
    this.enemyBullets.length = 0;
    this.enemyBulletInst.count = 0;
    this.invulnTimer = Math.max(this.invulnTimer, 3.0);
    this.sound.playExplosion('boss');
    this.updateBossHud();
  }

  private damageBossPart(
    boss: ActiveBoss,
    part: BossPartRuntime,
    damage: number,
    hitPos: THREE.Vector3,
    isCrit: boolean,
    fromBeam = false
  ): void {
    part.hp -= damage;
    // Direct part hits also bleed 70% damage to core boss HP
    boss.hp -= damage * 0.7;
    boss.flashTimer = 0.08;
    this.sound.playHit(isCrit);
    this.vfx.spawnSparks(hitPos, fromBeam ? 2 : 7, 0xffb347, 15);
    if (!fromBeam || Math.random() < 0.25) {
      this.spawnFloatingText(
        hitPos,
        isCrit ? `${Math.round(damage)} CRIT` : `${Math.round(damage)}`,
        isCrit ? 'crit' : 'normal'
      );
    }

    if (part.hp <= 0 && !part.destroyed) {
      part.destroyed = true;
      part.hp = 0;
      boss.disabledParts.add(part.id);
      if (part.node) {
        this.vfx.spawnDetachedPart(part.node, boss.pos, boss.config.accentHex);
      }
      this.hitStopTimer = 0.06;
      this.screenShake = Math.max(this.screenShake, 0.55);
      this.sound.playPartBreak();
      this.addUltimateCharge(22);
      this.score += Math.round(600 * this.combo);
      this.spawnFloatingText(part.worldPos, `${part.labelZh} 击碎!`, 'part');
      this.spawnPickup('repair', part.worldPos.clone().add(new THREE.Vector3(-1.2, 0, 2)));
      this.spawnPickup('energy', part.worldPos.clone().add(new THREE.Vector3(1.2, 0, 2)));
    }

    this.updateBossHud();
    if (boss.hp <= 0 && !boss.dying) {
      this.triggerBossDeath(boss);
    }
  }

  private damageBoss(
    boss: ActiveBoss,
    damage: number,
    hitPos: THREE.Vector3,
    isCrit: boolean,
    fromBeam = false
  ): void {
    boss.hp -= damage;
    boss.flashTimer = 0.07;
    this.sound.playHit(isCrit);
    this.vfx.spawnSparks(hitPos, fromBeam ? 2 : 5, boss.config.accentHex, 13);
    if (!fromBeam ? Math.random() < 0.65 : Math.random() < 0.2) {
      this.spawnFloatingText(
        hitPos,
        isCrit ? `${Math.round(damage)}!` : `${Math.round(damage)}`,
        isCrit ? 'crit' : 'normal'
      );
    }

    this.updateBossHud();
    if (boss.hp <= 0 && !boss.dying) {
      this.triggerBossDeath(boss);
    }
  }

  private maybeTriggerLightning(origin: THREE.Vector3, arcDamage: number, skipId: number): void {
    if (
      this.upgrades.chainLightningChance <= 0 ||
      Math.random() > this.upgrades.chainLightningChance
    ) {
      return;
    }

    const points = [origin.clone()];
    let jumps = 0;
    for (let i = this.waves.activeEnemies.length - 1; i >= 0; i--) {
      if (jumps >= this.upgrades.chainJumps) break;
      if (i >= this.waves.activeEnemies.length) continue;
      const candidate = this.waves.activeEnemies[i];
      if (candidate.id === skipId || candidate.hp <= 0) continue;
      if (candidate.pos.distanceTo(origin) <= 18) {
        points.push(candidate.pos.clone());
        this.damageEnemy(candidate, i, arcDamage, false, true);
        jumps += 1;
      }
    }

    if (jumps < this.upgrades.chainJumps && this.waves.activeBoss && !this.waves.activeBoss.dying) {
      if (this.waves.activeBoss.pos.distanceTo(origin) <= 28) {
        points.push(this.waves.activeBoss.pos.clone());
        this.damageBoss(this.waves.activeBoss, arcDamage, this.waves.activeBoss.pos, false, true);
      }
    }

    if (points.length >= 2) {
      this.vfx.spawnLightningBolt(points, 0x38bdf8);
    }
  }

  private findNearestTargetPos(from: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD2 = Infinity;

    for (const e of this.waves.activeEnemies) {
      const d2 = from.distanceToSquared(e.pos);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e.pos;
      }
    }

    const boss = this.waves.activeBoss;
    if (boss && !boss.dying) {
      for (const p of boss.parts) {
        if (p.destroyed) continue;
        const d2 = from.distanceToSquared(p.worldPos);
        if (d2 < bestD2) {
          bestD2 = d2;
          best = p.worldPos;
        }
      }
      const bd2 = from.distanceToSquared(boss.pos);
      if (bd2 < bestD2) {
        best = boss.pos;
      }
    }
    return best;
  }

  private updateEnemyBullets(dt: number): void {
    let count = 0;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.age += dt;
      if (eb.age >= eb.maxAge || eb.pos.z > 14 || eb.pos.z < -150) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      eb.pos.addScaledVector(eb.vel, dt);

      if (this.invulnTimer <= 0 && eb.pos.distanceToSquared(this.playerPos) < 1.55 * 1.55) {
        this.applyPlayerDamage(eb.damage);
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (count < MAX_ENEMY_BULLETS) {
        this.dummy.position.copy(eb.pos);
        this.dummy.rotation.set(eb.age * 6, eb.age * 5, 0);
        this.dummy.scale.setScalar(1.0);
        this.dummy.updateMatrix();
        this.enemyBulletInst.setMatrixAt(count, this.dummy.matrix);
        this.enemyBulletInst.setColorAt(count, eb.color);
        count += 1;
      }
    }

    this.enemyBulletInst.count = count;
    this.enemyBulletInst.instanceMatrix.needsUpdate = true;
    if (this.enemyBulletInst.instanceColor) this.enemyBulletInst.instanceColor.needsUpdate = true;
  }

  private applyPlayerDamage(dmg: number): void {
    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.invulnTimer = 0.55;
    this.timeSinceHit = 0;
    this.combo = Math.max(1.0, +(this.combo * 0.7).toFixed(1));
    this.screenShake = Math.max(this.screenShake, 0.48);
    this.sound.playShieldHit();
    this.flashDamageVignette('damage');
    this.vfx.spawnSparks(this.playerPos, 10, 0xff4757, 14);

    if (this.playerHp <= 0) {
      this.vfx.spawnExplosion(this.playerPos, 3.4, 0xff4757, true);
      this.sound.playExplosion('boss');
      this.showResultDialog(false);
    }
  }

  private spawnPickup(kind: 'repair' | 'energy', pos: THREE.Vector3): void {
    if (this.pickups.length >= MAX_PICKUPS) return;
    this.pickups.push({
      kind,
      pos: pos.clone(),
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, 18),
      age: 0,
      maxAge: 7.5,
    });
  }

  private updatePickups(dt: number): void {
    let repairCount = 0;
    let energyCount = 0;
    const magnetR2 = this.upgrades.pickupMagnetRadius * this.upgrades.pickupMagnetRadius;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.age += dt;
      if (pk.age >= pk.maxAge || pk.pos.z > 14) {
        this.pickups.splice(i, 1);
        continue;
      }

      const d2 = pk.pos.distanceToSquared(this.playerPos);
      if (d2 < 2.2 * 2.2) {
        this.sound.playPickup();
        if (pk.kind === 'repair') {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 22);
          this.flashDamageVignette('heal');
          this.spawnFloatingText(this.playerPos, '+22 装甲修复', 'heal');
        } else {
          this.addUltimateCharge(25);
          this.spawnFloatingText(this.playerPos, '+25 超频能量', 'score');
        }
        this.pickups.splice(i, 1);
        continue;
      }

      if (d2 < magnetR2) {
        this.tmpDir.subVectors(this.playerPos, pk.pos).normalize();
        pk.pos.addScaledVector(this.tmpDir, 28 * dt);
      } else {
        pk.pos.addScaledVector(pk.vel, dt);
      }

      this.dummy.position.copy(pk.pos);
      this.dummy.rotation.set(pk.age * 2.5, pk.age * 3.8, 0);
      this.dummy.scale.setScalar(1 + Math.sin(pk.age * 7) * 0.12);
      this.dummy.updateMatrix();

      if (pk.kind === 'repair' && repairCount < MAX_PICKUPS) {
        this.repairPickupInst.setMatrixAt(repairCount++, this.dummy.matrix);
      } else if (pk.kind === 'energy' && energyCount < MAX_PICKUPS) {
        this.energyPickupInst.setMatrixAt(energyCount++, this.dummy.matrix);
      }
    }

    this.repairPickupInst.count = repairCount;
    this.repairPickupInst.instanceMatrix.needsUpdate = true;
    this.energyPickupInst.count = energyCount;
    this.energyPickupInst.instanceMatrix.needsUpdate = true;
  }

  private applyHitFlashVisuals(inst: PooledModelInstance, timer: number): void {
    if (inst.materials.length === 0) return;
    if (timer > 0) {
      const k = timer / 0.09;
      for (let i = 0; i < inst.materials.length; i++) {
        inst.materials[i].emissive.setHex(0xffffff).lerp(inst.baseEmissives[i], 1 - k * 0.85);
        inst.materials[i].emissiveIntensity = Math.max(inst.baseEmissiveIntensities[i], 1.6 * k);
      }
    } else {
      for (let i = 0; i < inst.materials.length; i++) {
        inst.materials[i].emissive.copy(inst.baseEmissives[i]);
        inst.materials[i].emissiveIntensity = inst.baseEmissiveIntensities[i];
      }
    }
  }

  private updateCameraAndFloatingTexts(rawDt: number): void {
    this.screenShake = Math.max(0, this.screenShake - rawDt * 1.9);
    const sx = (Math.random() - 0.5) * this.screenShake * 1.25;
    const sy = (Math.random() - 0.5) * this.screenShake * 1.25;

    this.camera.position.lerp(
      new THREE.Vector3(this.playerPos.x * 0.45 + sx, this.playerPos.y * 0.42 + 2.45 + sy, 14.2),
      Math.min(1, rawDt * 8)
    );
    this.camera.lookAt(this.playerPos.x * 0.75, this.playerPos.y * 0.65, -28);

    const targetFov = this.boostFovTimer > 0 || this.ultimateActiveTimer > 0 ? 70 : 58;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, rawDt * 6);
      this.camera.updateProjectionMatrix();
    }

    // Project predictive HUD reticle far ahead along player forward trajectory
    this.tmpVec3.set(
      this.playerPos.x + this.playerVel.x * 0.14,
      this.playerPos.y + this.playerVel.y * 0.14,
      -42
    );
    this.tmpVec3.project(this.camera);
    const rx = (this.tmpVec3.x * 0.5 + 0.5) * window.innerWidth;
    const ry = (-this.tmpVec3.y * 0.5 + 0.5) * window.innerHeight;
    this.els['hud-reticle'].style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;

    // Update floating damage & status numbers
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += rawDt;
      if (ft.age >= ft.maxAge) {
        ft.el.remove();
        this.floatingTexts.splice(i, 1);
        continue;
      }
      this.tmpVec3.copy(ft.worldPos).project(this.camera);
      if (this.tmpVec3.z > 1) {
        ft.el.style.opacity = '0';
        continue;
      }
      const px = (this.tmpVec3.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-this.tmpVec3.y * 0.5 + 0.5) * window.innerHeight - ft.age * ft.vy;
      const alpha = 1 - Math.pow(ft.age / ft.maxAge, 2);
      ft.el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
      ft.el.style.opacity = alpha.toFixed(2);
    }
  }

  private updateHud(): void {
    if (!this.waves.activeBoss && !this.els['boss-hud'].hidden) {
      this.els['boss-hud'].hidden = true;
    }

    const hpPct = Math.max(0, (this.playerHp / this.playerMaxHp) * 100);
    this.els['hud-hp-fill'].style.width = `${hpPct}%`;
    this.els['hud-hp-text'].textContent = `${Math.ceil(this.playerHp)} / ${this.playerMaxHp}`;
    this.els['hud-hp-fill'].classList.toggle('is-low', hpPct <= 30);

    this.els['hud-combo-val'].textContent = `x${this.combo.toFixed(1)}`;
    this.els['hud-combo-box'].classList.toggle('is-hot', this.combo >= 3.0);
    this.els['hud-combo-bar'].style.width = `${Math.min(100, (this.comboTimer / 4.0) * 100)}%`;

    this.els['hud-act-label'].textContent = this.waves.isEndless()
      ? `无尽深空 · WAVE ${this.waves.getEndlessWave()}`
      : `ACT ${this.waves.getAct()} · WAVE ${this.waves.getWaveInAct()}/3`;
    this.els['hud-score-value'].textContent = Math.round(this.score).toLocaleString();

    const rollMax = Math.max(0.35, this.activeShip.rollCooldown * this.upgrades.rollCooldownMult);
    const rollPct = this.rollCooldownTimer <= 0 ? 100 : (1 - this.rollCooldownTimer / rollMax) * 100;
    this.els['hud-roll-fill'].style.width = `${Math.max(0, Math.min(100, rollPct))}%`;
    this.els['hud-roll-status'].textContent =
      this.rollCooldownTimer <= 0 ? 'READY' : `${this.rollCooldownTimer.toFixed(1)}s`;
    this.els['hud-roll-card'].classList.toggle('is-ready', this.rollCooldownTimer <= 0);

    const ultPct = Math.min(100, (this.ultimateCharge / this.activeShip.ultimateCost) * 100);
    this.els['hud-ult-fill'].style.width = `${ultPct}%`;
    this.els['hud-ult-pct'].textContent = ultPct >= 100 ? 'READY!' : `${Math.floor(ultPct)}%`;
    this.els['hud-ult-card'].classList.toggle('is-ready', ultPct >= 100);
  }

  private registerQaHook(): void {
    const api: StarforgeQaApi = {
      getSnapshot: (): StarforgeSnapshot => {
        const boss = this.waves.activeBoss;
        const bossSnapshot = boss
          ? {
              active: !boss.dying,
              id: boss.config.id,
              act: boss.config.act,
              hp: Math.max(0, Math.round(boss.hp)),
              maxHp: boss.maxHp,
              dying: boss.dying,
              deathTimer: +boss.deathTimer.toFixed(3),
              parts: boss.parts.map(
                (p): StarforgeBossPartSnapshot => ({
                  id: p.id,
                  nodeName: p.nodeName,
                  labelZh: p.labelZh,
                  hp: Math.max(0, Math.round(p.hp)),
                  maxHp: p.maxHp,
                  destroyed: p.destroyed,
                })
              ),
            }
          : null;

        return {
          mode: this.state,
          phase: this.state,
          loadProgress: this.loadProgress,
          selectedShipId: this.activeShip.id,
          selectedShipIndex: this.selectedShipIndex,
          act: this.waves.getAct(),
          waveInAct: this.waves.getWaveInAct(),
          endless: this.waves.isEndless(),
          endlessWave: this.waves.getEndlessWave(),
          score: Math.round(this.score),
          kills: this.kills,
          hp: Math.max(0, Math.ceil(this.playerHp)),
          maxHp: this.playerMaxHp,
          invulnTimer: +this.invulnTimer.toFixed(3),
          rollCooldown: +this.rollCooldownTimer.toFixed(3),
          rollActive: this.rollTimer > 0,
          ultCharge: Math.round(this.ultimateCharge),
          ultMax: this.activeShip.ultimateCost,
          ultActiveTimer: +this.ultimateActiveTimer.toFixed(3),
          enemyCount: this.waves.activeEnemies.length,
          enemyBulletCount: this.enemyBullets.length,
          playerBulletCount: this.playerBullets.length,
          upgrades: { ...this.upgrades.stacks },
          pierceCount: this.upgrades.pierceCount,
          critChance: +this.upgrades.critChance.toFixed(3),
          aeroBounceCount: this.aeroBounceCount,
          boss: bossSnapshot,
          dialogs: {
            upgradeOpen: this.dialogs.upgrade.open,
            pauseOpen: this.dialogs.pause.open,
            resultOpen: this.dialogs.result.open,
          },
        };
      },

      selectShip: (index: number): void => {
        const idx = Math.max(0, Math.min(SHIPS.length - 1, Math.floor(index)));
        if (this.state === 'boot') {
          this.openHangarFromBoot();
        }
        if (this.state === 'hangar') {
          this.selectHangarShip(idx);
          return;
        }
        this.selectedShipIndex = idx;
        this.activeShip = SHIPS[idx];
        if (this.state === 'playing') {
          this.startSortie();
        }
      },

      startSortie: (): void => {
        if (this.state === 'boot') {
          this.openHangarFromBoot();
        }
        this.startSortie();
      },

      forceUpgradeModal: (): void => {
        if (this.state === 'boot') {
          this.openHangarFromBoot();
        }
        if (this.state === 'hangar' || this.state === 'result') {
          this.startSortie();
        } else if (this.state === 'paused') {
          this.closeAllDialogs();
          this.state = 'playing';
        }
        if (this.state === 'playing') {
          this.openUpgradeDialog();
        }
      },

      spawnBossNow: (act: 1 | 2 | 3): void => {
        if (this.state === 'boot') {
          this.openHangarFromBoot();
        }
        if (this.state === 'hangar' || this.state === 'result') {
          this.startSortie();
        } else if (this.state === 'paused' || this.state === 'upgrade') {
          this.closeAllDialogs();
          this.clearInputState();
          this.state = 'playing';
        }
        this.enemyBullets.length = 0;
        this.enemyBulletInst.count = 0;
        const ev = this.waves.forceSpawnBoss(act);
        this.handleWaveEvent(ev);
        const boss = this.waves.activeBoss;
        if (boss) {
          boss.pos.set(0, 1.6, -38);
          boss.rig.update({
            dt: 0,
            elapsed: this.globalElapsed,
            playerPos: this.playerPos,
            worldPos: boss.pos,
            disabledParts: boss.disabledParts,
          });
          boss.instance.root.updateMatrixWorld(true);
          for (const p of boss.parts) {
            if (!p.destroyed && p.node) {
              p.node.getWorldPosition(p.worldPos);
            }
          }
          this.updateBossHud();
        }
      },

      damageBossPart: (partId: string, dmg: number): boolean => {
        const boss = this.waves.activeBoss;
        if (!boss || boss.dying) return false;
        const part = boss.parts.find((p) => p.id === partId || p.nodeName === partId);
        if (!part || part.destroyed) return false;
        const safeDmg = Math.max(0, Number.isFinite(dmg) ? dmg : 0);
        this.damageBossPart(boss, part, safeDmg, part.worldPos, false, false);
        return true;
      },

      damageBossCore: (dmg: number): boolean => {
        const boss = this.waves.activeBoss;
        if (!boss || boss.dying) return false;
        const safeDmg = Math.max(0, Number.isFinite(dmg) ? dmg : 0);
        this.damageBoss(boss, safeDmg, boss.pos, false, false);
        return true;
      },

      fillUltimate: (): void => {
        this.ultimateCharge = this.activeShip.ultimateCost;
        this.updateHud();
      },

      triggerUltimate: (): boolean => {
        if (this.state !== 'playing') return false;
        if (this.ultimateCharge < this.activeShip.ultimateCost) return false;
        this.tryUltimate();
        this.updateHud();
        return true;
      },

      triggerBarrelRoll: (): boolean => {
        if (this.state !== 'playing') return false;
        if (this.rollCooldownTimer > 0 || this.rollTimer > 0) return false;
        this.tryBarrelRoll();
        this.updateHud();
        return true;
      },
    };

    window.__STARFORGE__ = api;
  }
}
