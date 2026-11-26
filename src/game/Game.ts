import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  ACT_THEMES,
  SHIPS,
  type BossConfig,
  type ShipConfig,
  type ShipId,
} from '../assets/manifest';
import { AssetLoader, type PooledModelInstance } from '../engine/AssetLoader';
import { AnimationRig } from '../engine/AnimationRig';
import {
  SoundEngine,
  type AudioTelemetrySnapshot,
  type BgmTrackId,
  type WeaponVoice,
} from '../engine/SoundEngine';
import { EnvironmentSystem } from './EnvironmentSystem';
import { ProjectileVisuals } from './ProjectileVisuals';
import { SaveStore, type GraphicsPreset } from './SaveStore';
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
export type GameMode = 'arcade' | 'endless';

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

export type HardwareTier = 'low' | 'mid' | 'high';

export interface HardwareProfile {
  gpuName: string;
  cpuCores: number;
  deviceMemoryGb: number | null;
  screenCssW: number;
  screenCssH: number;
  screenPhysicalW: number;
  screenPhysicalH: number;
  nativeDpr: number;
  isHighDpi4k: boolean;
  maxTextureSize: number;
  tier: HardwareTier;
  tierLabelZh: string;
  recommendedPreset: Exclude<GraphicsPreset, 'auto'>;
  recommendedLabelZh: string;
  autoPixelBudget: number;
}

export interface StarforgeSnapshot {
  mode: GameState;
  phase: GameState;
  loadProgress: number;
  selectedShipId: ShipId;
  selectedShipIndex: number;
  selectedGameMode: GameMode;
  activeRunMode: GameMode;
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
  countdownActive: boolean;
  countdownRemaining: number;
  playerDying: boolean;
  activeGateCount: number;
  pickupCount: number;
  enemyCount: number;
  enemyBulletCount: number;
  playerBulletCount: number;
  upgrades: Record<string, number>;
  pierceCount: number;
  critChance: number;
  aeroBounceCount: number;
  boss: StarforgeBossSnapshot | null;
  fps: number;
  frameMs: number;
  graphicsPreset: GraphicsPreset;
  renderPixelRatio: number;
  internalWidth: number;
  internalHeight: number;
  hardware: HardwareProfile;
  audio: AudioTelemetrySnapshot;
  dialogs: {
    upgradeOpen: boolean;
    pauseOpen: boolean;
    resultOpen: boolean;
  };
}

export interface StarforgeQaApi {
  getSnapshot(): StarforgeSnapshot;
  selectShip(index: number): void;
  setGameMode(mode: GameMode): void;
  startSortie(mode?: GameMode): void;
  forceUpgradeModal(): void;
  spawnBossNow(act: 1 | 2 | 3): void;
  damageBossPart(partId: string, dmg: number): boolean;
  damageBossCore(dmg: number): boolean;
  fillUltimate(): void;
  triggerUltimate(): boolean;
  triggerBarrelRoll(): boolean;
  setGraphicsPreset(preset: GraphicsPreset): void;
  spawnGateNow(z?: number, mode?: 'closed' | 'opening' | 'open'): void;
  spawnPickupNow(kind: 'repair' | 'energy', x?: number, y?: number, z?: number): void;
  spawnBoostRingNow(x?: number, y?: number, z?: number): void;
  triggerPickupFeedbackDemo?(): void;
  setPlayerHp(hp: number): void;
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
  shipId: ShipId;
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
  instance: PooledModelInstance;
  haloRing: THREE.Mesh;
  glowSprite: THREE.Sprite;
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

type FloatingTextKind =
  | 'normal'
  | 'crit'
  | 'part'
  | 'heal'
  | 'score'
  | 'pickup-repair'
  | 'pickup-energy'
  | 'pickup-boost';

type PickupToastKind = 'repair' | 'energy' | 'boost' | 'full_repair';

interface FloatingText {
  el: HTMLDivElement;
  worldPos: THREE.Vector3;
  age: number;
  maxAge: number;
  holdRatio: number;
  vy: number;
}

interface ActivePickupToast {
  kind: PickupToastKind;
  count: number;
  age: number;
  maxAge: number;
  leaving: boolean;
  el: HTMLDivElement;
  barEl: HTMLDivElement;
  countEl: HTMLSpanElement;
}

const MAX_PLAYER_BULLETS = 240;
const MAX_ENEMY_BULLETS = 280;
const MAX_PICKUPS = 32;
const GRAPHICS_PRESET_ORDER: readonly GraphicsPreset[] = ['auto', '720p', '1080p', '1440p', 'native'];
const FORBIDDEN_GPU_META_RE =
  /GPT|Claude|Opus|Scenario-Labs|CC BY|PROMPT|提示词|千模|\.glb|\btris\b|AI ARMADA|AI 舰队|真实骨骼|跳字/gi;

function sanitizeGpuName(raw: string): string {
  const noSlashes = raw.replace(/\/{2,}/g, '/').replace(FORBIDDEN_GPU_META_RE, '').trim();
  const lower = noSlashes.toLowerCase();
  if (lower.includes('swiftshader')) return 'SwiftShader 软件光栅';
  if (lower.includes('llvmpipe')) return 'llvmpipe 软件光栅';

  let name = noSlashes;
  const metalMatch = name.match(/ANGLE Metal Renderer:\s*([^,)]+)/i);
  if (metalMatch?.[1]) {
    name = metalMatch[1];
  } else {
    const angleMatch = name.match(/^ANGLE\s*\([^,]+,\s*(.+)\)$/i);
    if (angleMatch?.[1]) {
      name = angleMatch[1];
    }
    name = name
      .replace(/\(0x[0-9a-f]+\)/gi, '')
      .replace(/\b(Direct3D\d*|D3D\d*|OpenGL|Vulkan|vs_\d+_\d+|ps_\d+_\d+|Unspecified Version)\b.*/gi, '')
      .replace(/,.*$/, '');
  }

  const normalized = name.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'WebGL 图形核心';
  return normalized.length > 30 ? `${normalized.slice(0, 29)}…` : normalized;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private readonly loader = new AssetLoader();
  private readonly sound: SoundEngine;
  private readonly save = new SaveStore();
  private readonly envSystem: EnvironmentSystem;
  private readonly projectileVisuals: ProjectileVisuals;
  private readonly vfx: VfxSystem;
  private readonly waves: WaveDirector;

  // Lighting & Hangar Pedestal
  private readonly keyLight: THREE.DirectionalLight;
  private readonly accentPointLight: THREE.PointLight;
  private readonly hangarPedestal = new THREE.Group();
  private readonly beamGroup = new THREE.Group();

  // 3D Pickup Aura & Halo Resources
  private readonly pickupHaloGeo: THREE.TorusGeometry;
  private readonly pickupRepairHaloMat: THREE.MeshBasicMaterial;
  private readonly pickupEnergyHaloMat: THREE.MeshBasicMaterial;
  private readonly pickupGlowTex: THREE.CanvasTexture;
  private readonly pickupRepairGlowMat: THREE.SpriteMaterial;
  private readonly pickupEnergyGlowMat: THREE.SpriteMaterial;

  // State
  private state: GameState = 'boot';
  private selectedGameMode: GameMode = 'arcade';
  private activeRunMode: GameMode = 'arcade';
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
  private showHudLegend = true;
  private settingsOpenedFromPause = false;
  private pointerDown = false;
  private pointerAimNDC = new THREE.Vector2(0, 0);
  private readonly keys = new Set<string>();
  private upgrades: UpgradeState = createInitialUpgradeState();
  private currentUpgradeChoices: UpgradeCard[] = [];

  private readonly playerBullets: PlayerBullet[] = [];
  private readonly enemyBullets: EnemyBullet[] = [];
  private readonly pickups: PickupItem[] = [];
  private readonly floatingTexts: FloatingText[] = [];
  private readonly pickupToasts: ActivePickupToast[] = [];
  private lastPickupCalloutTime = -10;
  private pickupStaggerSlot = 0;
  private healPulseTimer: number | null = null;
  private energyPulseTimer: number | null = null;

  // DOM Elements
  private readonly els: Record<string, HTMLElement>;
  private readonly dialogs: {
    upgrade: HTMLDialogElement;
    pause: HTMLDialogElement;
    result: HTMLDialogElement;
    settings: HTMLDialogElement;
    guide: HTMLDialogElement;
  };

  private waveCalloutTimer = 0;
  private playerDying = false;
  private playerDeathTimer = 0;
  private playerDeathSecondaryBurstDone = false;
  private playerDeathReason: 'combat' | 'gate_crash' = 'combat';
  private launchCountdownRemaining = 0;
  private launchCountdownStage: -1 | 0 | 1 | 2 | 3 = -1;
  private launchCountdownCombatUnlocked = true;
  private pendingLaunchWaveEvent: ReturnType<WaveDirector['startCampaign']> | null = null;
  private pauseEscGuardActive = false;
  private pauseEscGuardTimer: number | null = null;
  private bootTransitioning = false;
  private hangarIntroGlideTimer = 0;
  private lastRafTime = 0;
  private globalElapsed = 0;
  private bossDetachTick = 0;
  private spotlightRects = new WeakMap<HTMLElement, DOMRect>();
  private spotlightResizeObserver: ResizeObserver | null = null;
  private lastHoveredInteractive: Element | null = null;
  private graphicsPreset: GraphicsPreset = 'auto';
  private hardwareProfile!: HardwareProfile;
  private gfxMenuOpen = false;
  private drsScale = 1.0;
  private useBloom = true;
  private renderPixelRatio = 1;
  private internalWidth = 1280;
  private internalHeight = 720;
  private emaFrameMs = 16.67;
  private currentFps = 60;
  private prevWallTime = 0;
  private fpsUiTimer = 0;
  private drsHighTimer = 0;
  private drsRecoverTimer = 0;
  private lastFpsShown = -1;
  private lastMsShown = '';
  private lastDotClass = '';
  private lastModeKey = '';
  private lastBufSummary = '';
  private rawGpuRenderer = '';
  private readonly lastHudCache = {
    hpText: '',
    hpPct: '',
    hpLow: null as boolean | null,
    comboVal: '',
    comboHot: null as boolean | null,
    comboBar: '',
    actLabel: '',
    score: '',
    rollPct: '',
    rollStatus: '',
    rollReady: null as boolean | null,
    ultPctText: '',
    ultBar: '',
    ultReady: null as boolean | null,
  };
  private readonly tmpVec3 = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpCamTarget = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.sound = new SoundEngine(
      this.save.isMuted(),
      this.save.getBgmVolume(),
      this.save.getSfxVolume()
    );
    this.autoFire = this.save.isAutoFire();
    this.showHudLegend = this.save.isHudLegendVisible();
    this.graphicsPreset = this.save.getGraphicsPreset();
    document.body.dataset.screen = this.state;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.hardwareProfile = this.detectHardwareProfile();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ACT_THEMES[0].bgColor);
    this.scene.fog = new THREE.FogExp2(ACT_THEMES[0].fogColor, 0.0022);

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      420
    );
    this.camera.position.set(0, 2.2, 8.2);

    // Rich 3-point + hemisphere space lighting with real-time Hangar key shadow
    const hemi = new THREE.HemisphereLight(0x9ee6ff, 0x0e1428, 0.78);
    this.keyLight = new THREE.DirectionalLight(0xfff6ea, 2.85);
    this.keyLight.position.set(10, 18, 12);
    this.keyLight.castShadow = false;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 45;
    this.keyLight.shadow.camera.left = -5;
    this.keyLight.shadow.camera.right = 5;
    this.keyLight.shadow.camera.top = 5;
    this.keyLight.shadow.camera.bottom = -5;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    const rimCyan = new THREE.DirectionalLight(0x22e8ff, 1.75);
    rimCyan.position.set(-18, 8, -14);
    const fillWarm = new THREE.DirectionalLight(0xffa63b, 0.65);
    fillWarm.position.set(12, -10, -8);
    this.accentPointLight = new THREE.PointLight(0x00f0ff, 2.5, 22);
    this.scene.add(hemi, this.keyLight, rimCyan, fillWarm, this.accentPointLight);

    this.envSystem = new EnvironmentSystem(this.scene, this.renderer);
    this.envSystem.bindSceneLights(hemi, rimCyan, fillWarm);
    this.projectileVisuals = new ProjectileVisuals(this.scene);
    this.vfx = new VfxSystem(this.scene);
    this.waves = new WaveDirector(this.scene, this.loader);
    this.initPostProcessing();

    // Hangar recessed open-berth turntable pedestal (exposes 2K PBR deck plate & 2K shadow beneath fighter)
    const padOuter = new THREE.Mesh(
      new THREE.TorusGeometry(2.72, 0.028, 10, 72),
      new THREE.MeshBasicMaterial({
        color: 0x22e8ff,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    padOuter.rotation.x = Math.PI * 0.5;
    padOuter.position.y = -1.692;
    const padInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.96, 0.02, 8, 56),
      new THREE.MeshBasicMaterial({
        color: 0xffb347,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    padInner.rotation.x = Math.PI * 0.5;
    padInner.position.y = -1.696;
    const padCollarGeo = new THREE.RingGeometry(2.42, 2.76, 72);
    padCollarGeo.rotateX(-Math.PI * 0.5);
    const padCollar = new THREE.Mesh(
      padCollarGeo,
      new THREE.MeshStandardMaterial({
        color: 0x16243a,
        metalness: 0.9,
        roughness: 0.2,
      })
    );
    padCollar.position.y = -1.706;
    padCollar.receiveShadow = true;
    const padHoloGeo = new THREE.CircleGeometry(2.4, 64);
    padHoloGeo.rotateX(-Math.PI * 0.5);
    const padHolo = new THREE.Mesh(
      padHoloGeo,
      new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    padHolo.position.y = -1.712;
    this.hangarPedestal.add(padOuter, padInner, padCollar, padHolo);
    this.hangarPedestal.visible = false;
    this.scene.add(this.hangarPedestal);

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

    // 3D Pickup Aura & Halo Resources
    this.pickupHaloGeo = new THREE.TorusGeometry(1.22, 0.036, 10, 32);
    this.pickupRepairHaloMat = new THREE.MeshBasicMaterial({
      color: 0x34f5a8,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pickupEnergyHaloMat = new THREE.MeshBasicMaterial({
      color: 0xffbe42,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pickupGlowTex = this.createPickupGlowTexture();
    this.pickupRepairGlowMat = new THREE.SpriteMaterial({
      map: this.pickupGlowTex,
      color: 0x22ff99,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pickupEnergyGlowMat = new THREE.SpriteMaterial({
      map: this.pickupGlowTex,
      color: 0xffaa2b,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Query required DOM elements & native dialogs
    this.els = this.cacheDomElements([
      'damage-vignette',
      'fps-hud',
      'fps-hud-btn',
      'fps-hud-dot',
      'fps-hud-val',
      'fps-hud-ms',
      'fps-hud-mode',
      'gfx-popover-panel',
      'gfx-hw-tier',
      'gfx-hw-gpu',
      'gfx-hw-sys',
      'gfx-hw-buf',
      'gfx-auto-rec-tag',
      'gfx-auto-desc',
      'gfx-opt-list',
      'boot-screen',
      'boot-progress-fill',
      'boot-progress-pct',
      'boot-log',
      'boot-enter-btn',
      'hangar-ui',
      'hangar-career-stats',
      'hangar-guide-btn',
      'hangar-settings-btn',
      'hangar-mute-btn',
      'hangar-ship-list',
      'hangar-ship-badge',
      'hangar-corps-tag',
      'hangar-ship-name',
      'hangar-ship-code',
      'hangar-ship-record',
      'hangar-stats',
      'hangar-blueprint-svg',
      'hangar-spec-grid',
      'hangar-weapon-name',
      'hangar-weapon-desc',
      'hangar-ult-name',
      'hangar-ult-desc',
      'hangar-lore',
      'hangar-mode-selector',
      'hangar-mode-arcade',
      'hangar-mode-endless',
      'hangar-mode-arcade-badge',
      'hangar-mode-endless-badge',
      'hangar-launch-btn',
      'hangar-launch-title',
      'hangar-launch-sub',
      'hud-ui',
      'hud-cluster-tl',
      'hud-reticle',
      'launch-countdown',
      'launch-countdown-num',
      'floating-numbers',
      'pickup-toast-feed',
      'hud-ship-badge',
      'hud-ship-name',
      'hud-ship-code',
      'hud-hp-text',
      'hud-hp-ghost',
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
      'wave-callout',
      'wave-callout-sector',
      'wave-callout-title',
      'wave-callout-fraction',
      'wave-callout-steps',
      'wave-callout-sub',
      'hud-controls-legend',
      'boss-hud',
      'boss-hud-name',
      'boss-hud-threat-badge',
      'boss-hud-hp-text',
      'boss-hud-hp-ghost',
      'boss-hud-hp-fill',
      'boss-parts-row',
      'boss-hud-intel',
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
      'settings-mute-toggle',
      'settings-bgm-slider',
      'settings-bgm-val',
      'settings-sfx-slider',
      'settings-sfx-val',
      'settings-hw-summary',
      'settings-gfx-list',
      'settings-autofire-toggle',
      'settings-legend-toggle',
      'guide-tab-controls',
      'guide-tab-combat',
      'guide-panel-controls',
      'guide-panel-combat',
    ]);

    this.dialogs = {
      upgrade: this.requireEl<HTMLDialogElement>('upgrade-dialog'),
      pause: this.requireEl<HTMLDialogElement>('pause-dialog'),
      result: this.requireEl<HTMLDialogElement>('result-dialog'),
      settings: this.requireEl<HTMLDialogElement>('settings-dialog'),
      guide: this.requireEl<HTMLDialogElement>('guide-dialog'),
    };

    this.syncHardwarePanelStaticInfo();
    this.bindResolutionMediaQuery();
    this.bindEvents();
    this.registerQaHook();
  }

  private detectHardwareProfile(): HardwareProfile {
    const gl = this.renderer.getContext();
    let rawGpu = '';
    try {
      const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
      rawGpu = debugExt
        ? String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || '')
        : String(gl.getParameter(gl.RENDERER) || '');
    } catch {
      rawGpu = '';
    }
    this.rawGpuRenderer = rawGpu;

    const gpuName = sanitizeGpuName(rawGpu);
    const rawLower = rawGpu.toLowerCase();
    const cpuCores = Math.max(1, Math.round(navigator.hardwareConcurrency || 4));
    const navMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const deviceMemoryGb =
      typeof navMem === 'number' && Number.isFinite(navMem) && navMem > 0 ? navMem : null;
    const maxTextureSize = this.renderer.capabilities.maxTextureSize || 4096;

    const isLowGpu =
      /(swiftshader|llvmpipe|software|basic render)/i.test(rawLower) ||
      /(hd graphics|uhd graphics\s*[0-6]|mali-g[35]|adreno\s*\(tm\)\s*[345])/i.test(rawLower) ||
      maxTextureSize < 8192 ||
      (cpuCores <= 4 && deviceMemoryGb !== null && deviceMemoryGb <= 4);

    const isHighGpu =
      !isLowGpu &&
      /(rtx\s*(30[789]0|40[789]0|50[789]0)|radeon\s*rx\s*(6[89]\d0|7[89]\d0|9070)|apple\s*m[1-9]\d?\s*(pro|max|ultra))/i.test(
        rawLower
      ) &&
      cpuCores >= 8 &&
      (deviceMemoryGb === null || deviceMemoryGb >= 8);

    const tier: HardwareTier = isLowGpu ? 'low' : isHighGpu ? 'high' : 'mid';
    const tierLabelZh =
      tier === 'low' ? '核显节能档' : tier === 'high' ? '旗舰独显档' : '主流均衡档';
    const recommendedPreset: Exclude<GraphicsPreset, 'auto'> =
      tier === 'low' ? '720p' : tier === 'high' ? '1440p' : '1080p';
    const recommendedLabelZh =
      tier === 'low' ? '720P 极速' : tier === 'high' ? '2K 超清' : '1080P 均衡';
    const autoPixelBudget =
      tier === 'low' ? 1_100_000 : tier === 'high' ? 3_686_400 : 1_600_000;

    const screenCssW = Math.max(1, Math.round(window.screen?.width || window.innerWidth));
    const screenCssH = Math.max(1, Math.round(window.screen?.height || window.innerHeight));
    const nativeDpr =
      Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;
    const screenPhysicalW = Math.max(window.innerWidth, Math.round(screenCssW * nativeDpr));
    const screenPhysicalH = Math.max(window.innerHeight, Math.round(screenCssH * nativeDpr));
    const isHighDpi4k =
      Math.max(screenPhysicalW, screenPhysicalH) >= 3200 ||
      Math.max(window.innerWidth, window.innerHeight) * Math.min(nativeDpr, 2) >= 3200;

    return {
      gpuName,
      cpuCores,
      deviceMemoryGb,
      screenCssW,
      screenCssH,
      screenPhysicalW,
      screenPhysicalH,
      nativeDpr: +nativeDpr.toFixed(2),
      isHighDpi4k,
      maxTextureSize,
      tier,
      tierLabelZh,
      recommendedPreset,
      recommendedLabelZh,
      autoPixelBudget,
    };
  }

  private refreshHardwareScreenMetrics(): void {
    const screenCssW = Math.max(1, Math.round(window.screen?.width || window.innerWidth));
    const screenCssH = Math.max(1, Math.round(window.screen?.height || window.innerHeight));
    const nativeDpr =
      Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;
    const screenPhysicalW = Math.max(window.innerWidth, Math.round(screenCssW * nativeDpr));
    const screenPhysicalH = Math.max(window.innerHeight, Math.round(screenCssH * nativeDpr));
    const isHighDpi4k =
      Math.max(screenPhysicalW, screenPhysicalH) >= 3200 ||
      Math.max(window.innerWidth, window.innerHeight) * Math.min(nativeDpr, 2) >= 3200;
    this.hardwareProfile.screenCssW = screenCssW;
    this.hardwareProfile.screenCssH = screenCssH;
    this.hardwareProfile.nativeDpr = +nativeDpr.toFixed(2);
    this.hardwareProfile.screenPhysicalW = screenPhysicalW;
    this.hardwareProfile.screenPhysicalH = screenPhysicalH;
    this.hardwareProfile.isHighDpi4k = isHighDpi4k;
    if (!this.rawGpuRenderer && this.hardwareProfile.gpuName === 'WebGL 图形核心') {
      this.hardwareProfile = this.detectHardwareProfile();
    }
  }

  private bindResolutionMediaQuery(): void {
    if (typeof window.matchMedia !== 'function') return;
    const dpr = window.devicePixelRatio || 1;
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    mq.addEventListener(
      'change',
      () => {
        this.refreshHardwareScreenMetrics();
        this.syncHardwarePanelStaticInfo();
        this.applyGraphicsSettings();
        this.bindResolutionMediaQuery();
      },
      { once: true }
    );
  }

  private syncHardwarePanelStaticInfo(): void {
    if (!this.els) return;
    const hp = this.hardwareProfile;
    const tierEl = this.els['gfx-hw-tier'];
    tierEl.textContent = hp.tierLabelZh;
    tierEl.className = `gfx-tier-badge is-${hp.tier}`;

    this.els['gfx-hw-gpu'].textContent = hp.gpuName;
    const memPart = hp.deviceMemoryGb ? ` · ${hp.deviceMemoryGb}GB` : '';
    const fourKTag = hp.isHighDpi4k ? ' (4K)' : '';
    this.els['gfx-hw-sys'].textContent =
      `${hp.cpuCores} 核${memPart} · 屏 ${hp.screenPhysicalW}×${hp.screenPhysicalH}${fourKTag}`;
    this.els['gfx-auto-rec-tag'].textContent = `推荐·${hp.recommendedLabelZh}`;
    this.els['gfx-auto-desc'].textContent =
      `基于「${hp.tierLabelZh}」上限 ${(hp.autoPixelBudget / 1_000_000).toFixed(2)}M 像素 + 动态 DRS`;
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

  private computeRenderResolution(w: number, h: number): {
    dpr: number;
    internalW: number;
    internalH: number;
    bloomW: number;
    bloomH: number;
    useBloom: boolean;
    msaaSamples: number;
  } {
    const preset = this.graphicsPreset;
    const tier = this.hardwareProfile.tier;
    let budget: number;
    let bloomCapW = 640;
    let bloomCapH = 360;
    let useBloom = true;

    if (preset === '720p') {
      budget = 921_600;
      useBloom = false;
      bloomCapW = 480;
      bloomCapH = 270;
    } else if (preset === '1080p') {
      budget = 2_073_600;
      bloomCapW = 640;
      bloomCapH = 360;
    } else if (preset === '1440p') {
      budget = 3_686_400;
      bloomCapW = 960;
      bloomCapH = 540;
    } else if (preset === 'native') {
      budget = 8_294_400;
      bloomCapW = 960;
      bloomCapH = 540;
    } else {
      budget = this.hardwareProfile.autoPixelBudget * this.drsScale * this.drsScale;
      if (tier === 'high') {
        bloomCapW = 960;
        bloomCapH = 540;
      } else if (tier === 'low') {
        bloomCapW = 480;
        bloomCapH = 270;
      }
    }

    const maxDprForBudget = Math.sqrt(budget / Math.max(1, w * h));
    const nativeDpr = window.devicePixelRatio || 1;
    const dpr = THREE.MathUtils.clamp(Math.min(nativeDpr, 2, maxDprForBudget), 0.25, 2);
    const internalW = Math.max(1, Math.round(w * dpr));
    const internalH = Math.max(1, Math.round(h * dpr));
    const bloomW = Math.min(bloomCapW, Math.max(1, Math.round(internalW * 0.25)));
    const bloomH = Math.min(bloomCapH, Math.max(1, Math.round(internalH * 0.25)));
    const maxSamples = this.renderer.capabilities.maxSamples || 0;
    const msaaSamples =
      preset === '720p' || !this.renderer.capabilities.isWebGL2 || tier === 'low'
        ? 0
        : tier === 'high' && internalW * internalH <= 3_700_000
          ? Math.min(4, maxSamples)
          : Math.min(2, maxSamples);
    return { dpr, internalW, internalH, bloomW, bloomH, useBloom, msaaSamples };
  }

  private applyGraphicsSettings(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const res = this.computeRenderResolution(w, h);
    this.renderPixelRatio = res.dpr;
    this.internalWidth = res.internalW;
    this.internalHeight = res.internalH;
    this.useBloom = res.useBloom;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(res.dpr);
    this.renderer.setSize(w, h);

    if (this.composer) {
      if (this.composer.renderTarget1.samples !== res.msaaSamples) {
        try {
          const nextRt = new THREE.WebGLRenderTarget(res.internalW, res.internalH, {
            type: THREE.HalfFloatType,
            samples: res.msaaSamples,
          });
          this.composer.reset(nextRt);
        } catch {
          const fallbackRt = new THREE.WebGLRenderTarget(res.internalW, res.internalH, {
            type: THREE.HalfFloatType,
            samples: 0,
          });
          this.composer.reset(fallbackRt);
        }
      }
      this.composer.setPixelRatio(res.dpr);
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.enabled = res.useBloom;
      this.bloomPass.resolution.set(res.bloomW, res.bloomH);
      this.bloomPass.setSize(res.bloomW, res.bloomH);
    }

    this.updateFpsHudDom(true);
  }

  private initPostProcessing(): void {
    try {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const res = this.computeRenderResolution(w, h);

      const buildComposer = (samples: number): {
        composer: EffectComposer;
        bloomPass: UnrealBloomPass;
      } => {
        const renderTarget = new THREE.WebGLRenderTarget(res.internalW, res.internalH, {
          type: THREE.HalfFloatType,
          samples,
        });
        const composer = new EffectComposer(this.renderer, renderTarget);
        composer.setPixelRatio(res.dpr);
        composer.setSize(w, h);
        composer.addPass(new RenderPass(this.scene, this.camera));
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(res.bloomW, res.bloomH),
          0.28,
          0.22,
          1.18
        );
        bloomPass.enabled = res.useBloom;
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());
        return { composer, bloomPass };
      };

      try {
        const built = buildComposer(res.msaaSamples);
        this.composer = built.composer;
        this.bloomPass = built.bloomPass;
      } catch {
        const built = buildComposer(0);
        this.composer = built.composer;
        this.bloomPass = built.bloomPass;
      }
    } catch {
      this.composer = null;
      this.bloomPass = null;
    }

    this.applyGraphicsSettings();
  }

  private setScreenState(next: GameState): void {
    this.state = next;
    document.body.dataset.screen = next;
    this.keyLight.castShadow = next === 'hangar';
  }

  private promoteFpsHudToTopLayer(): void {
    const el = this.els['fps-hud'] as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    };
    try {
      if (el.matches(':popover-open')) {
        el.hidePopover?.();
      }
      el.showPopover?.();
    } catch {
      // Fallback keeps fixed z-index positioning intact on non-Popover engines
    }
  }

  private setGfxMenuOpen(open: boolean): void {
    this.gfxMenuOpen = open;
    if (!this.els) return;
    const panel = this.els['gfx-popover-panel'];
    const btn = this.els['fps-hud-btn'];
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      this.refreshHardwareScreenMetrics();
      this.syncHardwarePanelStaticInfo();
      this.updateFpsHudDom(true);
      this.clearInputState();
    }
  }

  private cycleGraphicsPreset(): void {
    const idx = GRAPHICS_PRESET_ORDER.indexOf(this.graphicsPreset);
    const next = GRAPHICS_PRESET_ORDER[(idx + 1) % GRAPHICS_PRESET_ORDER.length];
    this.setGraphicsPreset(next);
  }

  private setGraphicsPreset(preset: GraphicsPreset): void {
    this.graphicsPreset = preset;
    this.save.setGraphicsPreset(preset);
    this.drsScale = 1.0;
    this.drsHighTimer = 0;
    this.drsRecoverTimer = 0;
    this.applyGraphicsSettings();
  }

  private updateFpsHudDom(force: boolean): void {
    if (!this.els) return;
    const fps = this.currentFps;
    if (force || fps !== this.lastFpsShown) {
      this.lastFpsShown = fps;
      this.els['fps-hud-val'].textContent = String(fps);
    }

    const msStr = `${this.emaFrameMs.toFixed(1)}ms`;
    if (force || msStr !== this.lastMsShown) {
      this.lastMsShown = msStr;
      this.els['fps-hud-ms'].textContent = msStr;
    }

    const dotClass = fps >= 52 ? 'is-good' : fps >= 36 ? 'is-warn' : 'is-low';
    if (force || dotClass !== this.lastDotClass) {
      this.lastDotClass = dotClass;
      this.els['fps-hud-dot'].className = `fps-hud-dot ${dotClass}`;
    }

    const modeKey = `${this.graphicsPreset}:${this.internalWidth}x${this.internalHeight}`;
    if (force || modeKey !== this.lastModeKey) {
      this.lastModeKey = modeKey;
      const modeEl = this.els['fps-hud-mode'];
      if (this.graphicsPreset === '720p') {
        modeEl.textContent = '720P [G]';
        modeEl.className = 'fps-hud-mode is-720p';
      } else if (this.graphicsPreset === '1080p') {
        modeEl.textContent = '1080P [G]';
        modeEl.className = 'fps-hud-mode is-1080p';
      } else if (this.graphicsPreset === '1440p') {
        modeEl.textContent = '2K [G]';
        modeEl.className = 'fps-hud-mode is-1440p';
      } else if (this.graphicsPreset === 'native') {
        modeEl.textContent = '4K原生 [G]';
        modeEl.className = 'fps-hud-mode is-native';
      } else {
        modeEl.textContent = `自动·${this.internalHeight}P [G]`;
        modeEl.className = 'fps-hud-mode';
      }

      this.els['gfx-opt-list']
        .querySelectorAll<HTMLButtonElement>('.gfx-opt-btn')
        .forEach((optBtn) => {
          optBtn.setAttribute(
            'aria-pressed',
            optBtn.dataset.gfxPreset === this.graphicsPreset ? 'true' : 'false'
          );
        });
    }

    const bufSummary = `${this.internalWidth} × ${this.internalHeight} · ${(
      (this.internalWidth * this.internalHeight) /
      1_000_000
    ).toFixed(2)}M 像素 · ${this.useBloom ? '泛光开' : '泛光关'}`;
    if (force || bufSummary !== this.lastBufSummary) {
      this.lastBufSummary = bufSummary;
      this.els['gfx-hw-buf'].textContent = bufSummary;
    }

    this.syncSettingsGfxUi();
  }

  async init(): Promise<void> {
    this.promoteFpsHudToTopLayer();
    this.updateFpsHudDom(true);
    this.startRenderLoop();
    this.updateMuteButtons();
    this.updateAutoFireButton();
    this.syncHudLegendVisibility();

    const appendBootLog = (message: string, isReady = false): void => {
      const row = document.createElement('div');
      row.className = isReady ? 'boot-log-line is-ready' : 'boot-log-line';
      row.textContent = message;
      const logEl = this.els['boot-log'];
      logEl.appendChild(row);
      logEl.scrollTop = logEl.scrollHeight;
    };

    this.sound.setBgmTrack('boot', 0.35);
    this.sound.unlock();
    const audioPreload = this.sound.preloadAllAudio((msg) => {
      appendBootLog(msg);
    });

    await Promise.all([
      this.loader.preloadAll((info) => {
        this.loadProgress = info.percent;
        this.els['boot-progress-fill'].style.width = `${info.percent}%`;
        this.els['boot-progress-pct'].textContent = `${info.percent}%`;
        appendBootLog(info.message);
      }),
      audioPreload,
    ]);

    this.envSystem.initEnvironment(this.loader.getEnvTextures());
    this.envSystem.setMode('boot');

    const extraWarmup: THREE.Object3D[] = [
      ...this.vfx.getWarmupObjects(),
      ...this.envSystem.getWarmupObjects(),
      ...this.waves.getWarmupObjects(),
      ...this.projectileVisuals.getWarmupObjects(),
    ];

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
      extraWarmup
    );

    this.waves.setCombatActive(false);

    const enterBtn = this.els['boot-enter-btn'] as HTMLButtonElement;
    enterBtn.disabled = false;
    enterBtn.classList.add('is-ready');
    const enterLabel = enterBtn.querySelector('.btn-label-text') ?? enterBtn;
    enterLabel.textContent = '进入星港机库 · ENTER HANGAR';
  }

  private openHangarFromBoot(immediate = false): void {
    if (this.state !== 'boot' || this.bootTransitioning) return;
    const bootEl = this.els['boot-screen'];
    const enterBtn = this.els['boot-enter-btn'] as HTMLButtonElement;

    if (immediate) {
      bootEl.hidden = true;
      bootEl.classList.remove('is-unlocking', 'is-open');
      this.enterHangar(false);
      return;
    }

    this.bootTransitioning = true;
    enterBtn.disabled = true;
    enterBtn.classList.remove('is-ready');
    bootEl.style.pointerEvents = 'none';

    this.sound.unlock();
    this.sound.playUiClick();
    this.sound.playHudDeploy();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      bootEl.classList.add('is-unlocking');
      this.enterHangar(false);
      window.setTimeout(() => {
        bootEl.hidden = true;
        bootEl.classList.remove('is-unlocking', 'is-open');
        this.bootTransitioning = false;
      }, 80);
      return;
    }

    // Beat 1: Console retracts & armored blast doors lock opaque with central airlock seal spin
    bootEl.classList.add('is-unlocking');

    const finalizeClose = () => {
      if (bootEl.hidden) return;
      bootEl.hidden = true;
      bootEl.classList.remove('is-unlocking', 'is-open');
      this.bootTransitioning = false;
    };

    // Beat 2: Stage 3D Hangar silently behind sealed doors, wait 2 rAF for crisp GPU frame, then part doors
    window.setTimeout(() => {
      this.enterHangar(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const leftDoor = bootEl.querySelector<HTMLElement>('.boot-door-left');
          let done = false;
          const finishOnce = () => {
            if (done) return;
            done = true;
            finalizeClose();
          };
          leftDoor?.addEventListener(
            'transitionend',
            (e) => {
              if (e.target === leftDoor && e.propertyName === 'transform') {
                finishOnce();
              }
            },
            { once: true }
          );
          window.setTimeout(finishOnce, 980);

          bootEl.classList.add('is-open');
          this.sound.playBootDoorOpen();

          // Beat 3: Cascade Hangar HUD wings into view midway through door sweep
          window.setTimeout(() => {
            this.els['hangar-ui'].classList.remove('is-entering');
            this.sound.playHudDeploy();
          }, 340);
        });
      });
    }, 220);
  }

  private worldXToPan(x: number): number {
    return THREE.MathUtils.clamp(x / 11, -0.85, 0.85);
  }

  private clearInputState(): void {
    this.keys.clear();
    this.pointerDown = false;
    this.isDraggingHangar = false;
  }

  private armPauseEscGuard(): void {
    this.pauseEscGuardActive = true;
    if (this.pauseEscGuardTimer !== null) {
      window.clearTimeout(this.pauseEscGuardTimer);
    }
    this.pauseEscGuardTimer = window.setTimeout(() => {
      this.pauseEscGuardActive = false;
      this.pauseEscGuardTimer = null;
    }, 360);
  }

  private clearPauseEscGuard(): void {
    this.pauseEscGuardActive = false;
    if (this.pauseEscGuardTimer !== null) {
      window.clearTimeout(this.pauseEscGuardTimer);
      this.pauseEscGuardTimer = null;
    }
  }

  private closeAllDialogs(resetPauseReturn = true): void {
    this.clearPauseEscGuard();
    if (resetPauseReturn) {
      this.settingsOpenedFromPause = false;
    }
    if (this.gfxMenuOpen) this.setGfxMenuOpen(false);
    if (this.dialogs.upgrade.open) this.dialogs.upgrade.close();
    if (this.dialogs.pause.open) this.dialogs.pause.close();
    if (this.dialogs.result.open) this.dialogs.result.close();
    if (this.dialogs.settings.open) this.dialogs.settings.close();
    if (this.dialogs.guide.open) this.dialogs.guide.close();
  }

  private bindEvents(): void {
    const unlockEvents = ['pointerdown', 'keydown', 'touchstart', 'click'] as const;
    const handleFirstAudioGesture = (): void => {
      if (!this.sound.getTelemetry().unlocked) {
        this.sound.unlock();
      }
      if (this.sound.getTelemetry().unlocked) {
        for (const evName of unlockEvents) {
          window.removeEventListener(evName, handleFirstAudioGesture, true);
        }
      }
    };
    for (const evName of unlockEvents) {
      window.addEventListener(evName, handleFirstAudioGesture, {
        capture: true,
        passive: true,
      });
    }

    window.addEventListener('resize', () => {
      this.refreshHardwareScreenMetrics();
      this.syncHardwarePanelStaticInfo();
      this.applyGraphicsSettings();
    });

    window.addEventListener('blur', () => {
      this.clearInputState();
    });

    this.els['fps-hud-btn'].addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playUiClick();
      this.setGfxMenuOpen(!this.gfxMenuOpen);
    });

    this.els['gfx-opt-list'].addEventListener('click', (e) => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>('.gfx-opt-btn');
      if (!btn) return;
      const preset = btn.dataset.gfxPreset as GraphicsPreset | undefined;
      if (!preset || !GRAPHICS_PRESET_ORDER.includes(preset)) return;
      this.sound.unlock();
      this.sound.playUiClick();
      this.setGraphicsPreset(preset);
    });

    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.gfxMenuOpen) return;
        const target = e.target as Node | null;
        if (target && this.els['fps-hud'].contains(target)) return;
        this.setGfxMenuOpen(false);
      },
      { passive: true }
    );

    this.els['boot-enter-btn'].addEventListener('click', () => {
      this.openHangarFromBoot();
    });

    this.els['hangar-mode-selector'].addEventListener('click', (e) => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>('.mode-dock-btn[data-game-mode]');
      if (!btn) return;
      const mode = btn.dataset.gameMode === 'endless' ? 'endless' : 'arcade';
      this.sound.unlock();
      this.sound.playUiClick();
      this.setSelectedGameMode(mode);
    });

    this.els['hangar-launch-btn'].addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playUiClick();
      this.startSortie(this.selectedGameMode);
    });

    this.els['hangar-guide-btn'].addEventListener('click', () => this.openGuideDialog());
    this.els['hangar-settings-btn'].addEventListener('click', () => this.openSettingsDialog());
    this.els['hangar-mute-btn'].addEventListener('click', () => this.toggleMute());
    this.els['hud-mute-btn'].addEventListener('click', () => this.toggleMute());

    this.els['settings-mute-toggle'].addEventListener('click', () => {
      this.toggleMute();
      this.sound.playUiClick();
    });

    const bgmSlider = this.els['settings-bgm-slider'] as HTMLInputElement;
    bgmSlider.addEventListener('input', () => {
      const vol = Number(bgmSlider.value) / 100;
      this.sound.unlock();
      this.sound.setBgmVolume(vol);
      this.save.setBgmVolume(vol);
      this.syncSettingsDialogUi();
    });

    const sfxSlider = this.els['settings-sfx-slider'] as HTMLInputElement;
    sfxSlider.addEventListener('input', () => {
      const vol = Number(sfxSlider.value) / 100;
      this.sound.unlock();
      this.sound.setSfxVolume(vol);
      this.save.setSfxVolume(vol);
      this.syncSettingsDialogUi();
    });
    sfxSlider.addEventListener('change', () => {
      this.sound.playUiClick();
    });

    this.els['settings-gfx-list'].addEventListener('click', (e) => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>('.settings-gfx-btn');
      if (!btn) return;
      const preset = btn.dataset.settingsGfxPreset as GraphicsPreset | undefined;
      if (!preset || !GRAPHICS_PRESET_ORDER.includes(preset)) return;
      this.sound.unlock();
      this.sound.playUiClick();
      this.setGraphicsPreset(preset);
    });

    this.els['settings-autofire-toggle'].addEventListener('click', () => {
      this.autoFire = !this.autoFire;
      this.save.setAutoFire(this.autoFire);
      this.updateAutoFireButton();
      this.sound.unlock();
      this.sound.playUiClick();
    });

    this.els['settings-legend-toggle'].addEventListener('click', () => {
      this.showHudLegend = !this.showHudLegend;
      this.save.setHudLegendVisible(this.showHudLegend);
      this.syncHudLegendVisibility();
      this.syncSettingsDialogUi();
      this.sound.unlock();
      this.sound.playUiClick();
    });

    this.els['guide-tab-controls'].addEventListener('click', () => {
      this.setGuideTab('controls');
      this.sound.unlock();
      this.sound.playUiClick();
    });
    this.els['guide-tab-combat'].addEventListener('click', () => {
      this.setGuideTab('combat');
      this.sound.unlock();
      this.sound.playUiClick();
    });

    this.els['hud-autofire-btn'].addEventListener('click', () => {
      this.autoFire = !this.autoFire;
      this.save.setAutoFire(this.autoFire);
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

    this.setupInteractiveSpotlightAndHover();

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

      if (code === 'Escape' && this.gfxMenuOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.setGfxMenuOpen(false);
        this.els['fps-hud-btn'].focus();
        return;
      }

      if (code === 'KeyG' && !e.repeat) {
        this.cycleGraphicsPreset();
        return;
      }

      if (this.state === 'boot') {
        if ((code === 'Enter' || code === 'Space') && !e.repeat) {
          const enterBtn = this.els['boot-enter-btn'] as HTMLButtonElement;
          if (!this.bootTransitioning && !enterBtn.disabled) {
            e.preventDefault();
            this.openHangarFromBoot();
          }
        }
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
          this.save.setAutoFire(this.autoFire);
          this.updateAutoFireButton();
        } else if (code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) {
            this.openPauseDialog(true);
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Escape' && this.pauseEscGuardActive) {
        if (this.pauseEscGuardTimer !== null) {
          window.clearTimeout(this.pauseEscGuardTimer);
        }
        this.pauseEscGuardTimer = window.setTimeout(() => {
          this.pauseEscGuardActive = false;
          this.pauseEscGuardTimer = null;
        }, 40);
      }
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

    this.dialogs.pause.addEventListener('cancel', (e) => {
      if (this.pauseEscGuardActive) {
        e.preventDefault();
      }
    });

    this.dialogs.pause.addEventListener('close', () => {
      this.clearPauseEscGuard();
      const val = this.dialogs.pause.returnValue;
      this.dialogs.pause.returnValue = '';
      if (this.state !== 'paused') return;
      if (val === 'settings') {
        this.openSettingsDialog(true);
      } else if (val === 'hangar') {
        this.enterHangar();
      } else if (val === 'restart') {
        this.startSortie(this.activeRunMode);
      } else {
        // '' (Esc) or 'resume' -> resume combat
        this.sound.setMuffled(false);
        this.setScreenState('playing');
      }
    });

    this.dialogs.result.addEventListener('close', () => {
      const val = this.dialogs.result.returnValue;
      this.dialogs.result.returnValue = '';
      if (this.state !== 'result') return;
      if (val === 'endless') {
        this.enterEndlessMode();
      } else if (val === 'retry') {
        this.startSortie(this.activeRunMode);
      } else {
        this.enterHangar();
      }
    });

    this.dialogs.settings.addEventListener('close', () => {
      this.dialogs.settings.returnValue = '';
      this.sound.playUiClick();
      if (this.settingsOpenedFromPause && this.state === 'paused') {
        this.settingsOpenedFromPause = false;
        this.armPauseEscGuard();
        if (!this.dialogs.pause.open) {
          this.dialogs.pause.showModal();
        }
        this.promoteFpsHudToTopLayer();
      } else {
        this.settingsOpenedFromPause = false;
      }
    });

    this.dialogs.guide.addEventListener('close', () => {
      this.dialogs.guide.returnValue = '';
      this.sound.playUiClick();
    });

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent, dialog: HTMLDialogElement): boolean => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener('pointerup', (e) => {
          if (pressedOutside && outside(e, dialog)) dialog.close();
        });
      }
    }
  }

  private toggleMute(): void {
    this.sound.unlock();
    const next = !this.sound.isMuted();
    this.sound.setMuted(next);
    this.save.setMuted(next);
    this.updateMuteButtons();
  }

  private setupInteractiveSpotlightAndHover(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.spotlightResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          this.spotlightRects.set(el, el.getBoundingClientRect());
        }
      });
    }

    window.addEventListener('resize', () => {
      this.spotlightRects = new WeakMap();
    });

    window.addEventListener('pagehide', () => {
      this.spotlightResizeObserver?.disconnect();
      this.spotlightResizeObserver = null;
    });

    document.addEventListener(
      'pointerover',
      (e) => {
        const target = e.target as Element | null;
        const btn = target?.closest('button:not(:disabled)') ?? null;
        if (!btn) {
          this.lastHoveredInteractive = null;
          return;
        }
        if (btn !== this.lastHoveredInteractive) {
          this.lastHoveredInteractive = btn;
          this.sound.playUiHover();
        }
      },
      { passive: true }
    );

    document.addEventListener(
      'pointerout',
      (e) => {
        const related = e.relatedTarget as Element | null;
        if (!related?.closest('button')) {
          this.lastHoveredInteractive = null;
        }
      },
      { passive: true }
    );

    this.registerSpotlightElements(document);
  }

  private registerSpotlightElements(root: ParentNode = document): void {
    const candidates: HTMLElement[] = [];
    if (root instanceof HTMLElement && root.hasAttribute('data-spotlight')) {
      candidates.push(root);
    }
    root.querySelectorAll<HTMLElement>('[data-spotlight]').forEach((el) => {
      candidates.push(el);
    });

    for (const el of candidates) {
      if (el.dataset.spotlightWired === '1') continue;
      el.dataset.spotlightWired = '1';
      this.spotlightRects.set(el, el.getBoundingClientRect());
      this.spotlightResizeObserver?.observe(el);

      const updateCoords = (clientX: number, clientY: number) => {
        let rect = this.spotlightRects.get(el);
        if (!rect || rect.width === 0 || rect.height === 0) {
          rect = el.getBoundingClientRect();
          this.spotlightRects.set(el, rect);
        }
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        el.style.setProperty('--mouse-x', `${x.toFixed(1)}px`);
        el.style.setProperty('--mouse-y', `${y.toFixed(1)}px`);
      };

      el.addEventListener(
        'pointerenter',
        (e) => {
          this.spotlightRects.set(el, el.getBoundingClientRect());
          updateCoords(e.clientX, e.clientY);
        },
        { passive: true }
      );

      el.addEventListener(
        'pointermove',
        (e) => {
          updateCoords(e.clientX, e.clientY);
        },
        { passive: true }
      );
    }
  }

  private updateMuteButtons(): void {
    const muted = this.sound.isMuted();
    const label = muted ? '音效: 关 [M]' : '音效: 开 [M]';
    const shortLabel = muted ? '音效关' : '音效开';
    const hangarBtn = this.els['hangar-mute-btn'];
    hangarBtn.classList.toggle('is-muted', muted);
    hangarBtn.setAttribute('aria-label', label);
    const hangarSpan = hangarBtn.querySelector('.topbar-btn-label') ?? hangarBtn.querySelector('span:last-child');
    if (hangarSpan) {
      hangarSpan.textContent = shortLabel;
    } else {
      hangarBtn.textContent = shortLabel;
    }
    const hudBtn = this.els['hud-mute-btn'];
    hudBtn.classList.toggle('is-muted', muted);
    hudBtn.setAttribute('aria-label', label);
    const hudLabel =
      hudBtn.querySelector('.btn-hud-label') ??
      hudBtn.querySelector('span:last-child');
    if (hudLabel) {
      hudLabel.textContent = shortLabel;
    } else {
      hudBtn.textContent = shortLabel;
    }
    this.syncSettingsDialogUi();
  }

  private updateAutoFireButton(): void {
    const label = this.autoFire ? '开火: 自动 [F]' : '开火: 手动 [F]';
    const hudBtn = this.els['hud-autofire-btn'];
    hudBtn.setAttribute('aria-label', label);
    const textEl = hudBtn.querySelector('.btn-hud-label');
    if (textEl) {
      textEl.textContent = this.autoFire ? '自动' : '手动';
    } else {
      hudBtn.textContent = label;
    }
    hudBtn.classList.toggle('is-active', this.autoFire);
    this.syncSettingsDialogUi();
  }

  private syncHudLegendVisibility(): void {
    if (!this.els) return;
    this.els['hud-controls-legend'].hidden = !this.showHudLegend;
  }

  private syncSettingsGfxUi(): void {
    if (!this.els) return;
    this.els['settings-gfx-list']
      .querySelectorAll<HTMLButtonElement>('.settings-gfx-btn')
      .forEach((btn) => {
        btn.setAttribute(
          'aria-pressed',
          btn.dataset.settingsGfxPreset === this.graphicsPreset ? 'true' : 'false'
        );
      });
    const hwName = this.hardwareProfile?.gpuName ?? 'GPU 就绪';
    this.els['settings-hw-summary'].textContent = `${hwName} · ${this.internalWidth}×${this.internalHeight} · ${this.useBloom ? '泛光开' : '泛光关'}`;
  }

  private syncSettingsDialogUi(): void {
    if (!this.els) return;
    const muted = this.sound.isMuted();
    const muteToggle = this.els['settings-mute-toggle'];
    muteToggle.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteToggle.classList.toggle('is-muted-state', muted);
    muteToggle.classList.toggle('is-on', !muted);
    const muteLabel = muteToggle.querySelector('span:last-child');
    if (muteLabel) muteLabel.textContent = muted ? '静音已启用' : '声音已开启';

    const bgmPct = Math.round(this.sound.getBgmVolume() * 100);
    const sfxPct = Math.round(this.sound.getSfxVolume() * 100);
    (this.els['settings-bgm-slider'] as HTMLInputElement).value = String(bgmPct);
    this.els['settings-bgm-val'].textContent = `${bgmPct}%`;
    (this.els['settings-sfx-slider'] as HTMLInputElement).value = String(sfxPct);
    this.els['settings-sfx-val'].textContent = `${sfxPct}%`;

    const autoBtn = this.els['settings-autofire-toggle'];
    autoBtn.setAttribute('aria-pressed', this.autoFire ? 'true' : 'false');
    autoBtn.classList.toggle('is-on', this.autoFire);
    const autoLabel = autoBtn.querySelector('span:last-child');
    if (autoLabel) autoLabel.textContent = this.autoFire ? '自动连射 ON' : '手动点射 OFF';

    const legendBtn = this.els['settings-legend-toggle'];
    legendBtn.setAttribute('aria-pressed', this.showHudLegend ? 'true' : 'false');
    legendBtn.classList.toggle('is-on', this.showHudLegend);
    const legendLabel = legendBtn.querySelector('span:last-child');
    if (legendLabel) legendLabel.textContent = this.showHudLegend ? '显示 ON' : '隐藏 OFF';

    this.syncSettingsGfxUi();
  }

  private setGuideTab(tab: 'controls' | 'combat'): void {
    const isControls = tab === 'controls';
    const tabControls = this.els['guide-tab-controls'];
    const tabCombat = this.els['guide-tab-combat'];
    tabControls.classList.toggle('is-active', isControls);
    tabControls.setAttribute('aria-selected', isControls ? 'true' : 'false');
    tabCombat.classList.toggle('is-active', !isControls);
    tabCombat.setAttribute('aria-selected', !isControls ? 'true' : 'false');
    this.els['guide-panel-controls'].hidden = !isControls;
    this.els['guide-panel-combat'].hidden = isControls;
  }

  private openSettingsDialog(fromPause = false): void {
    this.closeAllDialogs(!fromPause);
    this.settingsOpenedFromPause = fromPause;
    this.clearInputState();
    this.sound.unlock();
    this.sound.playHudDeploy();
    this.syncSettingsDialogUi();
    this.dialogs.settings.returnValue = '';
    if (!this.dialogs.settings.open) {
      this.dialogs.settings.showModal();
    }
    if (fromPause) {
      this.promoteFpsHudToTopLayer();
    }
  }

  private openGuideDialog(): void {
    this.closeAllDialogs();
    this.clearInputState();
    this.sound.unlock();
    this.sound.playHudDeploy();
    this.setGuideTab('controls');
    this.dialogs.guide.returnValue = '';
    if (!this.dialogs.guide.open) {
      this.dialogs.guide.showModal();
    }
  }

  // ==================== HANGAR ====================

  private enterHangar(fromBootTransition = false): void {
    this.clearLaunchCountdown(false);
    this.hideWaveCallout();
    this.playerDying = false;
    this.playerDeathTimer = 0;
    this.playerDeathSecondaryBurstDone = false;
    this.playerDeathReason = 'combat';
    this.closeAllDialogs();
    this.clearInputState();
    this.cleanupCombatObjects();
    this.setScreenState('hangar');
    this.sound.setMuffled(false);
    this.sound.setBgmTrack('hangar');
    this.waves.setCombatActive(false);
    this.envSystem.setMode('hangar');
    this.els['hangar-ui'].hidden = false;
    this.els['hud-ui'].hidden = true;
    this.els['boss-hud'].hidden = true;
    this.hangarPedestal.visible = true;
    this.beamGroup.visible = false;

    if (fromBootTransition) {
      this.els['hangar-ui'].classList.add('is-entering');
      this.camera.position.set(0.95, 2.35, 10.6);
      this.camera.fov = 60;
      this.camera.lookAt(0, -0.15, 0);
      this.camera.updateProjectionMatrix();
      this.hangarYaw = -0.52;
      this.hangarIntroGlideTimer = 1.25;
    } else {
      this.els['hangar-ui'].classList.remove('is-entering');
      this.hangarIntroGlideTimer = 0;
    }

    const saveData = this.save.getAll();
    this.els['hangar-career-stats'].textContent = `总击坠 ${saveData.totalKills} · 出击 ${saveData.totalRuns} 次`;

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
      btn.dataset.spotlight = '';
      btn.style.setProperty('--ship-accent', ship.accentColor);
      btn.innerHTML = `
        <img class="slot-frame-bg slot-frame-base" src="./ui/frames/card_slot_cyan.webp" alt="" aria-hidden="true" />
        <img class="slot-frame-bg slot-frame-active" src="./ui/frames/card_slot_amber.webp" alt="" aria-hidden="true" />
        <span class="ui-spotlight" aria-hidden="true"></span>
        <span class="ui-corners" aria-hidden="true"></span>
        <img src="${ship.badgeIcon}" class="ship-card-badge" alt="" />
        <div class="ship-card-meta">
          <div class="ship-card-header">
            <span class="ship-card-corps">${ship.factionTag}</span>
            <span class="ship-card-badge-code">${ship.codeName}</span>
          </div>
          <div class="ship-card-name">${ship.nameZh}</div>
          <div class="ship-card-sub">
            <span class="ship-card-role">${ship.roleTag}</span>
            <span class="ship-card-best">${rec.bestScore > 0 ? `最高 ${rec.bestScore.toLocaleString()}` : '待命首航'}</span>
          </div>
        </div>
      `;
      btn.addEventListener('click', () => {
        this.sound.unlock();
        this.sound.playShipSelect();
        this.selectHangarShip(idx);
      });
      list.appendChild(btn);
    });
    this.registerSpotlightElements(list);
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
    inst.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = false;
      }
    });
    this.scene.add(inst.root);
    this.hangarShipInstance = inst;
    this.hangarShipRig = new AnimationRig(ship.modelKey, inst.modelRoot, inst.animations, 'hangar');

    this.accentPointLight.color.setHex(ship.accentHex);
    this.accentPointLight.position.set(2.5, 2.5, 3.5);

    // Update UI buttons state
    const cards = this.els['hangar-ship-list'].querySelectorAll('.hangar-ship-card');
    cards.forEach((c, i) => c.classList.toggle('is-selected', i === index));

    const rec = this.save.getShipRecord(ship.id);
    (this.els['hangar-ship-badge'] as HTMLImageElement).src = ship.badgeIcon;
    this.els['hangar-corps-tag'].textContent = ship.factionTag;
    this.els['hangar-ship-name'].textContent = ship.nameZh;
    this.els['hangar-ship-code'].textContent = ship.codeName;
    this.els['hangar-weapon-name'].textContent = ship.weaponName;
    this.els['hangar-weapon-desc'].textContent = ship.weaponDesc;
    this.els['hangar-ult-name'].textContent = ship.ultimateName;
    this.els['hangar-ult-desc'].textContent = ship.ultimateDesc;
    this.els['hangar-lore'].textContent = ship.loreDesc;

    const clearText =
      rec.bestClearTimeSec !== null ? `${rec.bestClearTimeSec.toFixed(1)}s` : '--';
    this.els['hangar-ship-record'].innerHTML = `
      <div class="record-cell"><span>最佳战绩</span><strong>${rec.bestScore.toLocaleString()}</strong></div>
      <div class="record-cell"><span>最快通关</span><strong>${clearText}</strong></div>
      <div class="record-cell"><span>无尽波次</span><strong>W${rec.bestEndlessWave}</strong></div>
    `;

    const statLabels: [string, number][] = [
      ['主炮火力', ship.stats.firepower],
      ['引擎极速', ship.stats.speed],
      ['偏转护盾', ship.stats.shield],
      ['矢量机动', ship.stats.agility],
    ];
    this.els['hangar-stats'].innerHTML = statLabels
      .map(([lbl, val]) => {
        const pct = Math.min(100, Math.max(0, Math.round((val / 5) * 100)));
        const filled = Math.round((pct / 100) * 12);
        const pips = Array.from({ length: 12 }, (_, idx) => {
          const seg = idx + 1;
          const activeClass = seg <= filled ? ` is-filled${seg >= 9 ? ' is-hot' : ''}` : '';
          return `<span class="stat-pip${activeClass}"></span>`;
        }).join('');
        return `
      <div class="stat-row">
        <span class="stat-label">${lbl}</span>
        <div class="stat-pips">${pips}</div>
        <span class="stat-val">${pct}</span>
      </div>
    `;
      })
      .join('');

    this.els['hangar-blueprint-svg'].innerHTML = this.renderShipBlueprintSvg(ship.id);
    this.els['hangar-spec-grid'].innerHTML = `
      <div class="bp-spec-cell"><span>翼展</span><strong>${ship.specTelemetry.wingspan}</strong></div>
      <div class="bp-spec-cell"><span>推进</span><strong>${ship.specTelemetry.propulsion}</strong></div>
      <div class="bp-spec-cell"><span>出力</span><strong>${ship.specTelemetry.output}</strong></div>
      <div class="bp-spec-cell"><span>装甲</span><strong>${ship.specTelemetry.armorClass}</strong></div>
    `;

    this.syncHangarModeUi();
  }

  private setSelectedGameMode(mode: GameMode): void {
    this.selectedGameMode = mode;
    this.syncHangarModeUi();
  }

  private syncHangarModeUi(): void {
    if (!this.els) return;
    const isEndless = this.selectedGameMode === 'endless';
    const arcadeBtn = this.els['hangar-mode-arcade'] as HTMLButtonElement;
    const endlessBtn = this.els['hangar-mode-endless'] as HTMLButtonElement;
    arcadeBtn.classList.toggle('is-active', !isEndless);
    arcadeBtn.setAttribute('aria-pressed', String(!isEndless));
    endlessBtn.classList.toggle('is-active', isEndless);
    endlessBtn.setAttribute('aria-pressed', String(isEndless));

    const rec = this.save.getShipRecord(this.activeShip.id);
    const endlessUnlocked = this.save.isEndlessUnlocked();
    this.els['hangar-mode-arcade-badge'].textContent =
      rec.clears > 0 ? `已通关 ${rec.clears} 次` : '3 幕战役';
    this.els['hangar-mode-endless-badge'].textContent =
      rec.bestEndlessWave > 0
        ? `最高 W${rec.bestEndlessWave}`
        : endlessUnlocked
          ? '已解锁 · 冲榜'
          : '无限挑战';

    const launchBtn = this.els['hangar-launch-btn'];
    launchBtn.classList.toggle('is-endless-mode', isEndless);
    this.els['hangar-launch-title'].textContent = isEndless ? '跃迁无尽' : '点火出击';
    this.els['hangar-launch-sub'].textContent = isEndless ? 'ENTER ENDLESS' : 'IGNITE & LAUNCH';
  }

  private renderShipBlueprintSvg(shipId: ShipId): string {
    const grid = `
      <g stroke="rgba(0,240,255,0.22)" stroke-width="0.8" fill="none">
        <line x1="12" y1="60" x2="268" y2="60" stroke-dasharray="4 3" />
        <line x1="140" y1="8" x2="140" y2="112" stroke-dasharray="3 3" />
        <circle cx="140" cy="60" r="46" stroke-dasharray="2 4" />
      </g>`;

    if (shipId === 'astra') {
      return `<svg viewBox="0 -8 280 136" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${grid}
        <g stroke="#00f0ff" stroke-width="1.5" fill="rgba(0,240,255,0.09)">
          <path d="M62 52 L115 48 L186 45 L226 60 L186 75 L115 72 L62 68 Z" />
          <path d="M98 48 L92 26 L112 26 L124 48 M98 72 L92 94 L112 94 L124 72" />
          <path d="M168 46 L176 30 L194 30 L188 47 M168 74 L176 90 L194 90 L188 73" />
          <ellipse cx="172" cy="60" rx="22" ry="7" fill="rgba(0,240,255,0.22)" />
          <circle cx="102" cy="24" r="14" />
          <circle cx="102" cy="96" r="14" />
          <circle cx="185" cy="28" r="13" />
          <circle cx="185" cy="92" r="13" />
        </g>
        <g stroke="#ffb347" stroke-width="1.4" fill="none">
          <line x1="226" y1="53" x2="246" y2="53" />
          <line x1="226" y1="67" x2="246" y2="67" />
          <circle cx="102" cy="24" r="5" />
          <circle cx="102" cy="96" r="5" />
          <circle cx="185" cy="28" r="4.5" />
          <circle cx="185" cy="92" r="4.5" />
        </g>
      </svg>`;
    }

    if (shipId === 'opus') {
      return `<svg viewBox="0 -8 280 136" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${grid}
        <g stroke="#00f0ff" stroke-width="1.6" fill="rgba(0,240,255,0.1)">
          <path d="M46 46 L94 40 L204 42 L230 53 L230 67 L204 78 L94 80 L46 74 Z" />
          <path d="M108 40 L120 22 L152 22 L158 41 M108 80 L120 98 L152 98 L158 79" />
          <rect x="164" y="51" width="38" height="18" rx="4" fill="rgba(0,240,255,0.22)" />
          <circle cx="136" cy="22" r="17" />
          <circle cx="136" cy="98" r="17" />
          <line x1="68" y1="42" x2="68" y2="78" />
          <line x1="94" y1="40" x2="94" y2="80" />
        </g>
        <g stroke="#ffb347" stroke-width="1.5" fill="none">
          <line x1="230" y1="54" x2="252" y2="54" />
          <line x1="230" y1="60" x2="256" y2="60" />
          <line x1="230" y1="66" x2="252" y2="66" />
          <circle cx="136" cy="22" r="7" />
          <circle cx="136" cy="98" r="7" />
        </g>
      </svg>`;
    }

    if (shipId === 'morph') {
      return `<svg viewBox="0 -8 280 136" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${grid}
        <g stroke="#00f0ff" stroke-width="1.5" fill="rgba(0,240,255,0.1)">
          <path d="M52 54 L118 47 L218 53 L252 60 L218 67 L118 73 L52 66 Z" />
          <path d="M150 49 L92 14 L64 18 L108 49" />
          <path d="M150 71 L92 106 L64 102 L108 71" />
          <path d="M204 52 L176 34 L164 36 L184 51" />
          <path d="M204 68 L176 86 L164 84 L184 69" />
          <ellipse cx="192" cy="60" rx="20" ry="5" fill="rgba(0,240,255,0.24)" />
        </g>
        <g stroke="#ffb347" stroke-width="1.4" fill="none">
          <circle cx="118" cy="44" r="5" />
          <circle cx="118" cy="76" r="5" />
          <path d="M40 53 L52 53 M40 67 L52 67" stroke-width="2" />
          <line x1="252" y1="60" x2="266" y2="60" />
        </g>
      </svg>`;
    }

    return `<svg viewBox="0 -8 280 136" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${grid}
      <g stroke="#00f0ff" stroke-width="1.5" fill="rgba(0,240,255,0.09)">
        <path d="M52 55 L112 49 L210 52 L246 60 L210 68 L112 71 L52 65 Z" />
        <ellipse cx="142" cy="60" rx="44" ry="44" fill="none" />
        <ellipse cx="142" cy="60" rx="35" ry="35" stroke-dasharray="6 4" fill="none" />
        <path d="M196 52 L178 28 L168 30 L182 52" />
        <path d="M196 68 L178 92 L168 90 L182 68" />
        <ellipse cx="186" cy="60" rx="18" ry="6" fill="rgba(0,240,255,0.24)" />
      </g>
      <g stroke="#ffb347" stroke-width="1.4" fill="none">
        <circle cx="142" cy="60" r="10" />
        <circle cx="142" cy="16" r="3" fill="#ffb347" />
        <circle cx="142" cy="104" r="3" fill="#ffb347" />
        <line x1="42" y1="56" x2="52" y2="56" />
        <line x1="42" y1="64" x2="52" y2="64" />
      </g>
    </svg>`;
  }

  // ==================== SORTIE & COMBAT ====================

  private startSortie(mode: GameMode = this.selectedGameMode): void {
    this.activeRunMode = mode;
    this.closeAllDialogs();
    this.clearInputState();
    this.cleanupCombatObjects();
    if (this.hangarShipInstance) {
      this.loader.release(this.hangarShipInstance);
      this.hangarShipInstance = null;
      this.hangarShipRig = null;
    }

    this.setScreenState('playing');
    this.hangarPedestal.visible = false;
    this.waves.setCombatActive(true);
    this.envSystem.setMode('combat');
    this.els['hangar-ui'].hidden = true;
    this.els['hud-ui'].hidden = false;
    this.els['boss-hud'].hidden = true;
    this.hideWaveCallout();

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
    this.playerDying = false;
    this.playerDeathTimer = 0;
    this.playerDeathSecondaryBurstDone = false;
    this.playerDeathReason = 'combat';

    this.playerMaxHp = ship.baseHp;
    this.playerHp = ship.baseHp;
    this.playerPos.set(0, -0.8, 0);
    this.playerVel.set(0, 0, 0);

    const pInst = this.loader.instantiateFresh(ship.modelKey, false);
    this.scene.add(pInst.root);
    this.playerInstance = pInst;
    this.playerRig = new AnimationRig(ship.modelKey, pInst.modelRoot, pInst.animations, 'combat');

    this.accentPointLight.color.setHex(ship.accentHex);

    (this.els['hud-ship-badge'] as HTMLImageElement).src = ship.badgeIcon;
    this.els['hud-ship-name'].textContent = ship.nameZh;
    this.els['hud-ship-code'].textContent = ship.codeName;
    this.els['hud-hp-ghost'].style.width = '100%';
    this.updateAutoFireButton();
    this.renderChipStrip();

    this.sound.setMuffled(false);
    this.sound.playHudDeploy();
    if (mode === 'endless') {
      this.sound.setBgmTrack('act3');
      const startEv = this.waves.startEndlessMode();
      this.envSystem.setAct(this.waves.getAct(), true);
      this.beginLaunchCountdown(startEv);
    } else {
      this.sound.setBgmTrack('act1');
      const startEv = this.waves.startCampaign();
      this.envSystem.setAct(1, true);
      this.beginLaunchCountdown(startEv);
    }
    this.updateHud();
  }

  private enterEndlessMode(): void {
    this.activeRunMode = 'endless';
    this.selectedGameMode = 'endless';
    this.closeAllDialogs();
    this.clearInputState();
    this.setScreenState('playing');
    this.playerDying = false;
    this.playerDeathTimer = 0;
    this.playerDeathSecondaryBurstDone = false;
    this.playerDeathReason = 'combat';
    if (this.playerInstance) {
      this.playerInstance.root.visible = true;
    }
    this.clearPickups();
    this.sound.setMuffled(false);
    this.sound.playHudDeploy();
    this.envSystem.setMode('combat');
    this.els['hud-ui'].hidden = false;
    this.els['boss-hud'].hidden = true;
    this.playerHp = this.playerMaxHp;
    const ev = this.waves.startEndlessMode();
    this.sound.setBgmTrack('act3');
    this.envSystem.setAct(this.waves.getAct(), true);
    this.beginLaunchCountdown(ev);
    this.updateHud();
  }

  private beginLaunchCountdown(waveEvent: ReturnType<WaveDirector['startCampaign']>): void {
    this.pendingLaunchWaveEvent = waveEvent;
    this.launchCountdownRemaining = 2.85;
    this.launchCountdownStage = -1;
    this.launchCountdownCombatUnlocked = false;
    this.waves.setCombatActive(false);
    this.hideWaveCallout();
    this.applyLaunchCountdownStage(3);
  }

  private clearLaunchCountdown(unlockCombat: boolean): void {
    const pendingEv = this.pendingLaunchWaveEvent;
    this.pendingLaunchWaveEvent = null;
    this.launchCountdownRemaining = 0;
    this.launchCountdownStage = -1;
    this.launchCountdownCombatUnlocked = true;
    const overlay = this.els['launch-countdown'];
    overlay.hidden = true;
    overlay.classList.remove('is-engage');
    if (unlockCombat) {
      this.waves.setCombatActive(true);
      if (pendingEv) {
        this.handleWaveEvent(pendingEv);
      }
    }
  }

  private applyLaunchCountdownStage(stage: 3 | 2 | 1 | 0): void {
    if (this.launchCountdownStage === stage) return;
    this.launchCountdownStage = stage;
    const overlay = this.els['launch-countdown'];
    const numEl = this.els['launch-countdown-num'];
    const coreEl = overlay.querySelector<HTMLElement>('.launch-countdown-core');

    overlay.hidden = false;
    overlay.classList.toggle('is-engage', stage === 0);
    numEl.textContent = stage === 0 ? '出击' : String(stage);

    if (coreEl) {
      coreEl.classList.remove('is-pulse');
      void coreEl.offsetWidth;
      coreEl.classList.add('is-pulse');
    }

    this.sound.playCountdownTick(stage);

    if (stage === 0 && !this.launchCountdownCombatUnlocked) {
      this.launchCountdownCombatUnlocked = true;
      this.boostFovTimer = Math.max(this.boostFovTimer, 0.75);
      this.flashDamageVignette('boost');
      this.waves.setCombatActive(true);
      const pendingEv = this.pendingLaunchWaveEvent;
      this.pendingLaunchWaveEvent = null;
      if (pendingEv) {
        this.handleWaveEvent(pendingEv);
      }
    }
  }

  private updateLaunchCountdown(dt: number): void {
    if (this.launchCountdownRemaining <= 0) return;
    this.launchCountdownRemaining = Math.max(0, this.launchCountdownRemaining - dt);
    const rem = this.launchCountdownRemaining;
    if (rem > 2.05) {
      this.applyLaunchCountdownStage(3);
    } else if (rem > 1.25) {
      this.applyLaunchCountdownStage(2);
    } else if (rem > 0.45) {
      this.applyLaunchCountdownStage(1);
    } else if (rem > 0) {
      this.applyLaunchCountdownStage(0);
    } else {
      this.applyLaunchCountdownStage(0);
      this.els['launch-countdown'].hidden = true;
      this.els['launch-countdown'].classList.remove('is-engage');
      this.launchCountdownStage = -1;
    }
  }

  private cleanupCombatObjects(): void {
    this.playerDying = false;
    this.playerDeathTimer = 0;
    this.playerDeathSecondaryBurstDone = false;
    this.playerDeathReason = 'combat';
    this.vfx.clearTransientEffects();
    this.projectileVisuals.clearTrails();
    this.waves.clearCombatEntities();
    this.playerBullets.length = 0;
    this.enemyBullets.length = 0;
    this.clearPickups();
    this.beamGroup.visible = false;

    if (this.playerInstance) {
      this.playerInstance.root.visible = true;
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

    for (const toast of this.pickupToasts) {
      toast.el.remove();
    }
    this.pickupToasts.length = 0;
    this.els['hud-cluster-tl']?.classList.remove('is-heal-pulse');
    this.els['hud-ult-card']?.classList.remove('is-energy-pulse');
    if (this.healPulseTimer !== null) {
      window.clearTimeout(this.healPulseTimer);
      this.healPulseTimer = null;
    }
    if (this.energyPulseTimer !== null) {
      window.clearTimeout(this.energyPulseTimer);
      this.energyPulseTimer = null;
    }
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
    if (this.state !== 'playing' || this.playerDying) return;
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
    this.sound.playRoll(false, this.worldXToPan(this.playerPos.x));

    if (this.upgrades.rollBurstShots > 0) {
      const count = this.upgrades.rollBurstShots;
      this.projectileVisuals.spawnMuzzleFlash(
        this.playerPos.clone().add(new THREE.Vector3(0, 0, -1.6)),
        new THREE.Vector3(0, 0, -1),
        this.activeShip.accentHex,
        0.95
      );
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
    if (this.state !== 'playing' || this.playerDying) return;
    if (this.ultimateCharge < this.activeShip.ultimateCost) return;

    const id: ShipId = this.activeShip.id;
    this.ultimateCharge = 0;
    this.sound.playUltimate(id as WeaponVoice);
    this.boostFovTimer = Math.max(this.boostFovTimer, 2.2);
    this.screenShake = Math.max(this.screenShake, 0.55);

    if (id === 'astra') {
      this.ultimateActiveTimer = 2.5;
      this.showWaveCallout({
        sector: '终极过载 · ULTIMATE',
        title: '轨道离子过载光束',
        fraction: 'ION OVERDRIVE',
        sub: '贯穿主炮全功率输出 · 灼烧路径目标',
        isEndless: true,
        durationSec: 1.75,
      });
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
      this.projectileVisuals.syncEnemyProjectiles(this.enemyBullets, 0, this.globalElapsed);
      this.vfx.spawnExplosion(this.playerPos, 3.2, 0x00f0ff, false);
      this.projectileVisuals.spawnMuzzleFlash(
        this.playerPos.clone().add(new THREE.Vector3(0, 0, -1.6)),
        new THREE.Vector3(0, 0, -1),
        0x00f0ff,
        1.5
      );
      this.showWaveCallout({
        sector: '终极过载 · ULTIMATE',
        title: '电磁护盾新星',
        fraction: 'AEGIS NOVA',
        sub: '护盾回复 +30 · 敌方弹幕全面转化',
        isEndless: true,
        durationSec: 1.75,
      });
    } else if (id === 'morph') {
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const offset = new THREE.Vector3(Math.cos(angle) * 1.8, Math.sin(angle) * 1.2, -1.4);
        const vel = new THREE.Vector3(Math.cos(angle) * 24, Math.sin(angle) * 18, -68);
        const launchPos = this.playerPos.clone().add(offset);
        this.spawnPlayerBullet(
          launchPos,
          vel,
          this.activeShip.bulletDamage * 1.9,
          0,
          true,
          false,
          false,
          false,
          0xff4757
        );
        if (i % 3 === 0) {
          this.projectileVisuals.spawnMuzzleFlash(launchPos, vel, 0xff4757, 0.9);
        }
      }
      this.showWaveCallout({
        sector: '终极过载 · ULTIMATE',
        title: '幻影齐射风暴',
        fraction: '18X SALVO',
        sub: '18 枚制导追踪导弹全向齐射',
        isEndless: true,
        durationSec: 1.75,
      });
    } else {
      this.ultimateActiveTimer = 4.0;
      this.showWaveCallout({
        sector: '终极过载 · ULTIMATE',
        title: '棱镜时空缓速场',
        fraction: 'CHRONO PRISM',
        sub: '敌群与弹幕进入 4 秒时空减速',
        isEndless: true,
        durationSec: 1.75,
      });
    }
  }

  private openPauseDialog(fromEscape = false): void {
    if (this.state !== 'playing' || this.playerDying) return;
    this.closeAllDialogs();
    this.clearInputState();
    this.setScreenState('paused');
    this.sound.setMuffled(true);
    this.sound.playHudDeploy();
    if (fromEscape) {
      // Guard against Chromium CloseWatcher firing `cancel` on keyup of the opening Escape press.
      this.armPauseEscGuard();
    }
    this.dialogs.pause.returnValue = '';
    if (!this.dialogs.pause.open) {
      this.dialogs.pause.showModal();
    }
    this.promoteFpsHudToTopLayer();
  }

  private openUpgradeDialog(): void {
    this.closeAllDialogs();
    this.hideWaveCallout();
    this.clearInputState();
    this.setScreenState('upgrade');
    this.sound.setMuffled(true);
    this.sound.playHudDeploy();
    this.currentUpgradeChoices = pickUpgradeChoices(this.upgrades, 3);
    const grid = this.els['upgrade-cards-grid'];
    grid.innerHTML = '';

    this.currentUpgradeChoices.forEach((card, idx) => {
      const stacks = this.upgrades.stacks[card.id] ?? 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-card is-${card.accent}`;
      btn.dataset.spotlight = '';
      if (idx === 0) btn.autofocus = true;
      btn.innerHTML = `
        <img src="./ui/card_chip_frame.png" class="chip-card-bg" alt="" />
        <img src="${card.icon}" class="chip-socket-icon" alt="" />
        <span class="ui-spotlight" aria-hidden="true"></span>
        <span class="ui-corners" aria-hidden="true"></span>
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
    this.registerSpotlightElements(grid);

    this.dialogs.upgrade.returnValue = '';
    if (!this.dialogs.upgrade.open) {
      this.dialogs.upgrade.showModal();
    }
    this.promoteFpsHudToTopLayer();
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

    this.sound.setMuffled(false);
    this.sound.playUpgrade();
    this.renderChipStrip();
    if (this.dialogs.upgrade.open) {
      this.dialogs.upgrade.close(cardId);
    }
    this.setScreenState('playing');

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
    this.clearLaunchCountdown(false);
    this.hideWaveCallout();
    this.closeAllDialogs();
    this.clearInputState();
    this.setScreenState('result');
    this.sound.setMuffled(false);
    this.sound.playResultStinger(victory);
    this.projectileVisuals.updateRollShield(
      false,
      this.playerPos,
      0,
      this.activeShip.accentHex,
      this.globalElapsed
    );
    if (!victory) {
      this.projectileVisuals.updatePlayerThrusters(
        false,
        this.playerPos,
        this.tmpQuat,
        this.playerVel,
        this.activeShip.engineColor,
        false,
        0,
        this.globalElapsed
      );
    }

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
      ? `${this.activeShip.nameZh} 成功摧毁龙骨母舰，破晓航道已全面肃清`
      : this.playerDeathReason === 'gate_crash'
        ? `${this.activeShip.nameZh} 高速撞击星际跃迁闸门装甲结构，机体已爆炸解体`
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
    endlessBtn.hidden = !victory || this.waves.isEndless();

    this.dialogs.result.returnValue = '';
    if (!this.dialogs.result.open) {
      this.dialogs.result.showModal();
    }
    this.promoteFpsHudToTopLayer();
  }

  private handleWaveEvent(ev: ReturnType<WaveDirector['startCampaign']>): void {
    if (ev.type === 'act_banner') {
      this.envSystem.setAct(ev.act, false);
      const track: BgmTrackId = ev.act === 1 ? 'act1' : ev.act === 2 ? 'act2' : 'act3';
      this.sound.setBgmTrack(track);
      const theme = ACT_THEMES[Math.min(ACT_THEMES.length - 1, Math.max(0, ev.act - 1))];
      this.showWaveCallout({
        sector: theme.titleZh,
        title: `第 ${ev.waveInAct} 波`,
        fraction: `WAVE ${ev.waveInAct} / 3`,
        sub: ev.waveInAct === 1 ? '先遣敌机编队突入航道' : '高威胁增援编队压境',
        waveStep: ev.waveInAct === 2 ? 2 : 1,
      });
    } else if (ev.type === 'endless_wave') {
      this.envSystem.setAct(ev.act, false);
      this.sound.setBgmTrack('act3');
      this.showWaveCallout({
        sector: '无尽深空 · ENDLESS',
        title: `第 ${ev.endlessWave} 波`,
        fraction: `WAVE ${String(ev.endlessWave).padStart(2, '0')}`,
        sub: '敌群火力持续强化 · 全力突破极限',
        isEndless: true,
      });
    } else if (ev.type === 'upgrade_prompt') {
      this.openUpgradeDialog();
    } else if (ev.type === 'boss_intro' && ev.bossConfig) {
      this.envSystem.setAct(ev.act, false);
      this.sound.playBossWarning();
      this.sound.setBgmTrack('boss', 0.9);
      this.showBossHud(ev.bossConfig);
      this.showWaveCallout({
        sector: `ACT ${ev.act} · 最终拦截阶段`,
        title: '第 3 波 · 首领降临',
        fraction: 'BOSS 3 / 3',
        sub: `${ev.bossConfig.nameZh} · ${ev.bossConfig.threatTag}`,
        waveStep: 3,
        isBoss: true,
      });
    } else if (ev.type === 'campaign_victory') {
      this.showResultDialog(true);
    }
  }

  private showBossHud(cfg: BossConfig): void {
    this.els['boss-hud'].hidden = false;
    this.els['boss-hud-name'].textContent = cfg.nameZh;
    this.els['boss-hud-threat-badge'].textContent = cfg.threatTag;
    this.els['boss-hud-intel'].textContent = cfg.tacticalIntel;
    this.els['boss-hud-hp-ghost'].style.width = '100%';
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
    this.els['boss-hud-hp-ghost'].style.width = `${pct}%`;
    this.els['boss-hud-hp-text'].textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`;
    this.els['boss-parts-row'].innerHTML = boss.parts
      .map((p) => {
        if (p.destroyed) {
          return `<span class="boss-part-pill is-broken">${p.labelZh}: 已击毁</span>`;
        }
        const pp = Math.round((p.hp / p.maxHp) * 100);
        return `<span class="boss-part-pill" style="--part-pct:${pp}%">${p.labelZh} <em>${pp}%</em></span>`;
      })
      .join('');
  }

  private hideWaveCallout(): void {
    this.waveCalloutTimer = 0;
    this.els['wave-callout']?.classList.remove('is-visible');
  }

  private showWaveCallout(opts: {
    sector: string;
    title: string;
    fraction: string;
    sub: string;
    waveStep?: 1 | 2 | 3;
    isBoss?: boolean;
    isEndless?: boolean;
    durationSec?: number;
  }): void {
    const root = this.els['wave-callout'];
    if (!root) return;
    this.els['wave-callout-sector'].textContent = opts.sector;
    this.els['wave-callout-title'].textContent = opts.title;
    this.els['wave-callout-fraction'].textContent = opts.fraction;
    this.els['wave-callout-sub'].textContent = opts.sub;
    root.classList.toggle('is-boss', Boolean(opts.isBoss));
    root.classList.toggle('is-endless', Boolean(opts.isEndless));

    if (!opts.isEndless && opts.waveStep) {
      const targetStep = opts.waveStep;
      this.els['wave-callout-steps']
        .querySelectorAll<HTMLElement>('[data-wave-step]')
        .forEach((node) => {
          const stepNum = Number(node.dataset.waveStep || '1');
          node.classList.toggle('is-done', stepNum < targetStep);
          node.classList.toggle('is-current', stepNum === targetStep);
          node.classList.toggle('is-upcoming', stepNum > targetStep);
        });
    }

    root.classList.remove('is-visible');
    void root.offsetWidth;
    root.classList.add('is-visible');
    this.waveCalloutTimer = opts.durationSec ?? 2.45;
  }

  private flashDamageVignette(kind: 'damage' | 'heal' | 'boost'): void {
    const el = this.els['damage-vignette'];
    el.className = `damage-vignette is-${kind}`;
    window.setTimeout(() => {
      el.className = 'damage-vignette';
    }, 260);
  }

  private pulseHudReaction(kind: PickupToastKind): void {
    if (kind === 'repair' || kind === 'full_repair' || kind === 'boost') {
      const hpCard = this.els['hud-cluster-tl'];
      hpCard?.classList.add('is-heal-pulse');
      if (this.healPulseTimer !== null) window.clearTimeout(this.healPulseTimer);
      this.healPulseTimer = window.setTimeout(() => {
        hpCard?.classList.remove('is-heal-pulse');
        this.healPulseTimer = null;
      }, 450);
    }
    if (kind === 'energy' || kind === 'boost') {
      const ultCard = this.els['hud-ult-card'];
      ultCard?.classList.add('is-energy-pulse');
      if (this.energyPulseTimer !== null) window.clearTimeout(this.energyPulseTimer);
      this.energyPulseTimer = window.setTimeout(() => {
        ultCard?.classList.remove('is-energy-pulse');
        this.energyPulseTimer = null;
      }, 450);
    }
  }

  private showPickupToast(
    kind: PickupToastKind,
    valueText: string,
    titleZh: string,
    subEn: string,
    iconUrl: string
  ): void {
    // Suppress notifications while modal dialogs capture focus
    if (
      this.dialogs.upgrade.open ||
      this.dialogs.pause.open ||
      this.dialogs.result.open ||
      this.dialogs.settings.open ||
      this.dialogs.guide.open
    ) {
      return;
    }

    this.pulseHudReaction(kind);

    const existing = this.pickupToasts.find((t) => !t.leaving && t.kind === kind && t.age < 1.6);
    if (existing) {
      existing.count += 1;
      existing.age = 0;
      existing.countEl.textContent = `×${existing.count}`;
      existing.countEl.hidden = false;
      existing.barEl.style.transform = 'scaleX(1)';
      return;
    }

    const feed = this.els['pickup-toast-feed'];
    if (!feed) return;

    while (this.pickupToasts.length >= 3) {
      const oldest = this.pickupToasts.shift();
      oldest?.el.remove();
    }

    const card = document.createElement('div');
    card.className = `pickup-toast is-${kind}`;

    const icon = document.createElement('img');
    icon.className = 'pickup-toast-icon';
    icon.src = iconUrl;
    icon.alt = '';
    icon.width = 34;
    icon.height = 34;

    const body = document.createElement('div');
    body.className = 'pickup-toast-body';

    const head = document.createElement('div');
    head.className = 'pickup-toast-head';

    const valSpan = document.createElement('span');
    valSpan.className = 'pickup-toast-val';
    valSpan.textContent = valueText;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'pickup-toast-title';
    titleSpan.textContent = titleZh;

    head.append(valSpan, titleSpan);

    const subSpan = document.createElement('span');
    subSpan.className = 'pickup-toast-sub';
    subSpan.textContent = subEn;

    body.append(head, subSpan);

    const countSpan = document.createElement('span');
    countSpan.className = 'pickup-toast-count';
    countSpan.hidden = true;
    countSpan.textContent = '×1';

    const barEl = document.createElement('div');
    barEl.className = 'pickup-toast-bar';

    card.append(icon, body, countSpan, barEl);
    feed.appendChild(card);

    this.pickupToasts.push({
      kind,
      count: 1,
      age: 0,
      maxAge: 2.35,
      leaving: false,
      el: card,
      barEl,
      countEl: countSpan,
    });
  }

  private spawnFloatingText(
    worldPos: THREE.Vector3,
    text: string,
    kind: FloatingTextKind,
    iconUrl?: string
  ): void {
    const isPickupKind =
      kind === 'pickup-repair' || kind === 'pickup-energy' || kind === 'pickup-boost' || kind === 'heal';

    const pos = worldPos.clone();
    if (isPickupKind) {
      if (this.globalElapsed - this.lastPickupCalloutTime < 0.95) {
        this.pickupStaggerSlot = (this.pickupStaggerSlot + 1) % 3;
      } else {
        this.pickupStaggerSlot = 0;
      }
      this.lastPickupCalloutTime = this.globalElapsed;
      pos.y += 1.35 + this.pickupStaggerSlot * 0.9;
    }

    const el = document.createElement('div');
    el.className = `float-num is-${kind}`;

    const inner = document.createElement('span');
    inner.className = 'float-num-inner';

    if (iconUrl) {
      const icon = document.createElement('img');
      icon.className = 'float-num-icon';
      icon.src = iconUrl;
      icon.alt = '';
      inner.appendChild(icon);
    }

    const label = document.createElement('span');
    label.className = 'float-num-label';
    label.textContent = text;
    inner.appendChild(label);
    el.appendChild(inner);

    this.els['floating-numbers'].appendChild(el);

    let maxAge = 0.72;
    let vy = 52;
    let holdRatio = 0.35;
    if (isPickupKind) {
      maxAge = 1.45;
      vy = 34;
      holdRatio = 0.66;
    } else if (kind === 'part') {
      maxAge = 1.45;
      vy = 30;
      holdRatio = 0.65;
    } else if (kind === 'crit') {
      maxAge = 0.92;
      vy = 56;
      holdRatio = 0.45;
    }

    this.floatingTexts.push({
      el,
      worldPos: pos,
      age: 0,
      maxAge,
      holdRatio,
      vy,
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
    this.prevWallTime = this.lastRafTime;
    const tick = (now: number) => {
      requestAnimationFrame(tick);
      if (document.hidden) {
        this.lastRafTime = now;
        this.prevWallTime = now;
        return;
      }

      const wallMs = now - this.prevWallTime;
      this.prevWallTime = now;
      if (wallMs > 0 && wallMs < 500) {
        this.emaFrameMs = this.emaFrameMs * 0.88 + wallMs * 0.12;
        this.currentFps = Math.max(1, Math.round(1000 / Math.max(1, this.emaFrameMs)));
        const wallSec = wallMs / 1000;
        this.fpsUiTimer += wallSec;

        if (
          this.graphicsPreset === 'auto' &&
          this.loadProgress >= 100 &&
          (this.state === 'hangar' || this.state === 'playing')
        ) {
          if (this.emaFrameMs > 24.0) {
            this.drsHighTimer += wallSec;
            this.drsRecoverTimer = 0;
            if (this.drsHighTimer >= 1.4 && this.drsScale > 0.78) {
              this.drsHighTimer = 0;
              this.drsScale = Math.max(0.78, +(this.drsScale - 0.08).toFixed(2));
              this.applyGraphicsSettings();
            }
          } else if (this.emaFrameMs <= 18.5 && this.drsScale < 1.0) {
            this.drsHighTimer = 0;
            this.drsRecoverTimer += wallSec;
            if (this.drsRecoverTimer >= 3.0) {
              this.drsRecoverTimer = 0;
              this.drsScale = Math.min(1.0, +(this.drsScale + 0.08).toFixed(2));
              this.applyGraphicsSettings();
            }
          } else {
            this.drsHighTimer = 0;
            if (this.emaFrameMs > 18.5) {
              this.drsRecoverTimer = 0;
            }
          }
        }

        if (this.fpsUiTimer >= 0.25) {
          this.fpsUiTimer = 0;
          this.updateFpsHudDom(false);
        }
      }

      const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastRafTime) / 1000));
      this.lastRafTime = now;
      this.globalElapsed += rawDt;

      this.frameUpdate(rawDt);
      if (this.useBloom && this.composer) {
        this.composer.render(rawDt);
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    requestAnimationFrame(tick);
  }

  private frameUpdate(rawDt: number): void {
    if (this.state === 'boot') {
      this.waves.updateEnvironment(rawDt, 0.75);
      this.camera.position.set(Math.sin(this.globalElapsed * 0.25) * 1.4, 1.8, 12);
      this.camera.lookAt(0, 0, -40);
      this.envSystem.update(rawDt, this.globalElapsed, 36 * 0.75, this.camera);
      this.projectileVisuals.updatePlayerThrusters(
        false,
        this.playerPos,
        this.tmpQuat,
        this.playerVel,
        this.activeShip.engineColor,
        false,
        rawDt,
        this.globalElapsed
      );
      return;
    }

    if (this.state === 'hangar') {
      this.waves.updateEnvironment(rawDt, 0.35);
      this.hangarPedestal.rotation.y += rawDt * 0.14;
      if (!this.isDraggingHangar) {
        this.hangarYaw += rawDt * 0.35;
      }
      if (this.hangarShipInstance && this.hangarShipRig) {
        this.hangarShipInstance.root.rotation.y = this.hangarYaw;
        this.hangarShipInstance.root.position.y = Math.sin(this.globalElapsed * 2.1) * 0.08 - 0.15;
        this.hangarShipRig.update({ dt: rawDt, elapsed: this.globalElapsed });
      }
      if (this.hangarIntroGlideTimer > 0) {
        this.hangarIntroGlideTimer = Math.max(0, this.hangarIntroGlideTimer - rawDt);
      }
      const camPosRate = this.hangarIntroGlideTimer > 0 ? rawDt * 3.1 : rawDt * 6;
      const camFovRate = this.hangarIntroGlideTimer > 0 ? rawDt * 3.2 : rawDt * 5;
      this.camera.position.lerp(
        this.tmpCamTarget.set(
          0.4 + Math.sin(this.globalElapsed * 0.32) * 0.12,
          1.45 + Math.cos(this.globalElapsed * 0.24) * 0.035,
          5.1
        ),
        camPosRate
      );
      this.camera.lookAt(0, -0.15, 0);
      if (Math.abs(this.camera.fov - 50) > 0.01) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 50, camFovRate);
        if (Math.abs(this.camera.fov - 50) <= 0.01) {
          this.camera.fov = 50;
        }
        this.camera.updateProjectionMatrix();
      }
      this.envSystem.update(rawDt, this.globalElapsed, 36 * 0.35, this.camera);
      this.projectileVisuals.updatePlayerThrusters(
        false,
        this.playerPos,
        this.tmpQuat,
        this.playerVel,
        this.activeShip.engineColor,
        false,
        rawDt,
        this.globalElapsed
      );
      return;
    }

    if (this.state !== 'playing') {
      // Keep floating texts cleanly frozen or slow-faded during modals
      return;
    }

    this.runDurationSec += rawDt;
    if (this.waveCalloutTimer > 0) {
      this.waveCalloutTimer -= rawDt;
      if (this.waveCalloutTimer <= 0) {
        this.els['wave-callout'].classList.remove('is-visible');
      }
    }

    // Hit-stop freezes world simulation briefly on heavy Boss part breaks
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      this.updateCameraAndFloatingTexts(rawDt);
      this.envSystem.update(0, this.globalElapsed, 0, this.camera);
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

    if (this.playerDying) {
      this.playerDeathTimer -= rawDt;
      if (this.playerDeathTimer <= 0.48 && !this.playerDeathSecondaryBurstDone) {
        this.playerDeathSecondaryBurstDone = true;
        this.vfx.spawnExplosion(
          this.playerPos.clone().add(new THREE.Vector3(-0.45, 0.25, 0.2)),
          3.4,
          0xff6b2b,
          true
        );
        this.vfx.spawnSparks(this.playerPos, 18, 0xffb347, 22);
      }

      this.waves.updateEnvironment(dt, 0.85);
      this.vfx.update(dt);
      this.updatePlayerBullets(dt);
      this.updateEnemyBullets(dt * enemySlowFactor);
      this.updateCameraAndFloatingTexts(rawDt);
      this.envSystem.update(dt, this.globalElapsed, 36 * 0.85, this.camera);
      this.updateHud();

      if (this.playerDeathTimer <= 0) {
        this.playerDying = false;
        this.showResultDialog(false);
      }
      return;
    }

    // 0. Launch Countdown Transition (3 -> 2 -> 1 -> ENGAGE)
    this.updateLaunchCountdown(dt);

    // 1. Environment & boost ring checks
    const envBoost = this.boostFovTimer > 0 || this.ultimateActiveTimer > 0 ? 1.55 : 1.0;
    this.waves.updateEnvironment(dt, envBoost);
    for (const ring of this.waves.getBoostRings()) {
      if (!ring.active || ring.triggered) continue;
      if (Math.abs(ring.pos.z - this.playerPos.z) < 2.3) {
        const dx = ring.pos.x - this.playerPos.x;
        const dy = ring.pos.y - this.playerPos.y;
        if (dx * dx + dy * dy < ring.radius * ring.radius) {
          this.waves.triggerBoostRing(ring);
          this.vfx.spawnSparks(this.playerPos, 20, 0x22f0ff, 22);
          this.vfx.spawnSparks(this.playerPos, 10, 0xffbe3b, 18);
          this.boostFovTimer = 0.9;
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 10);
          this.addUltimateCharge(15);
          this.score += Math.round(250 * this.combo);
          this.comboTimer = 3.5;
          this.sound.playPickup();
          this.flashDamageVignette('boost');
          this.spawnFloatingText(
            this.playerPos,
            '+10 护盾 · 穿环加速',
            'pickup-boost',
            './ui/icons/icon_thruster.png'
          );
          this.showPickupToast(
            'boost',
            '+10 护盾',
            '穿环加速 · 能量+15%',
            'SLIPSTREAM OVERBOOST',
            './ui/icons/icon_thruster.png'
          );
        }
      }
    }

    // 2. Player Movement, Firing, Abilities & Rig
    this.updatePlayer(dt);

    // Solid obstacle impact test against Act 2/3 Warp Gate bulkhead & door armor
    if (!this.playerDying && this.launchCountdownCombatUnlocked) {
      const gateHit = this.waves.checkGateSolidCollision(this.playerPos, 1.1);
      if (gateHit !== null) {
        this.triggerPlayerCrashDestruction();
        return;
      }
    }

    // 3. Wave Director Spawning (held until countdown reaches ENGAGE)
    if (this.launchCountdownCombatUnlocked) {
      const waveEv = this.waves.updateWaves(dt);
      if (waveEv) this.handleWaveEvent(waveEv);
    }

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

    // 6. Camera, Atmosphere Sync, Floating Numbers & HUD
    this.updateCameraAndFloatingTexts(rawDt);
    this.envSystem.update(dt, this.globalElapsed, 36 * envBoost, this.camera);
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
      const rollProgress = 1 - this.rollTimer / Math.max(0.01, this.rollDuration);
      rollZ += rollProgress * Math.PI * 2 * this.rollDir;
      this.projectileVisuals.updateRollShield(
        this.rollTimer > 0,
        this.playerPos,
        rollProgress,
        this.activeShip.accentHex,
        this.globalElapsed
      );

      // Deflect enemy bullets nearby
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const eb = this.enemyBullets[i];
        if (eb.pos.distanceToSquared(this.playerPos) < 12.5) {
          this.projectileVisuals.spawnBulletImpact(eb.pos, 0x00f0ff, false);
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
          this.sound.playRoll(true, this.worldXToPan(eb.pos.x));
          this.score += Math.round(80 * this.combo);
        }
      }
    } else {
      this.projectileVisuals.updateRollShield(
        false,
        this.playerPos,
        0,
        this.activeShip.accentHex,
        this.globalElapsed
      );
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

    // Dual Mach-diamond afterburners, wingtip contrails & point light
    const playerQuat = this.playerInstance ? this.playerInstance.root.quaternion : this.tmpQuat;
    this.projectileVisuals.updatePlayerThrusters(
      true,
      this.playerPos,
      playerQuat,
      this.playerVel,
      this.activeShip.engineColor,
      this.boostFovTimer > 0 || this.ultimateActiveTimer > 0,
      dt,
      this.globalElapsed
    );
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

    // Firing (held cleanly until 3-2-1 launch countdown completes)
    if (!this.launchCountdownCombatUnlocked) {
      this.invulnTimer = Math.max(this.invulnTimer, 0.8);
    } else if ((this.autoFire || this.pointerDown) && this.fireCooldown <= 0) {
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
    this.sound.playShot(ship.id as WeaponVoice, this.worldXToPan(this.playerPos.x));

    // Velocity scaling follows pierce chip stacks so Morph starts at configured bulletSpeed
    const speedBonus = 1 + (this.upgrades.stacks['pierce'] ?? 0) * 0.22;
    const bSpeed = ship.bulletSpeed * speedBonus;
    const baseDmg = ship.bulletDamage;
    const pierce = this.upgrades.pierceCount;

    if (ship.id === 'opus') {
      // Triple plasma spread
      for (const ang of [-0.14, 0, 0.14]) {
        const muzzlePos = this.playerPos.clone().add(new THREE.Vector3(Math.sin(ang) * 0.9, 0, -1.6));
        const vel = new THREE.Vector3(Math.sin(ang) * bSpeed * 0.45, 0, -bSpeed);
        this.projectileVisuals.spawnMuzzleFlash(muzzlePos, vel, ship.accentHex, 0.78);
        this.spawnPlayerBullet(
          muzzlePos,
          vel,
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
        const muzzlePos = this.playerPos.clone().add(new THREE.Vector3(side, -0.05, -1.6));
        const vel = new THREE.Vector3(0, 0, -bSpeed);
        this.projectileVisuals.spawnMuzzleFlash(muzzlePos, vel, ship.accentHex, 0.85);
        this.spawnPlayerBullet(
          muzzlePos,
          vel,
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
      const muzzlePos = this.playerPos.clone().add(new THREE.Vector3(0, -0.05, -1.65));
      const vel = new THREE.Vector3(0, 0, -bSpeed);
      this.projectileVisuals.spawnMuzzleFlash(muzzlePos, vel, ship.accentHex, 0.95);
      this.spawnPlayerBullet(
        muzzlePos,
        vel,
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
        const launchPos = this.playerPos.clone().add(new THREE.Vector3(side * 1.2, 0.3, -1.0));
        const vel = new THREE.Vector3(side * 18, 6, -64);
        this.projectileVisuals.spawnMuzzleFlash(launchPos, vel, 0xffb347, 0.72);
        this.spawnPlayerBullet(
          launchPos,
          vel,
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
        const muzzlePos = w.pos.clone().add(new THREE.Vector3(0, 0, -1.0));
        const vel = new THREE.Vector3(0, 0, -bSpeed * 0.95);
        this.projectileVisuals.spawnMuzzleFlash(muzzlePos, vel, 0x38bdf8, 0.62);
        this.spawnPlayerBullet(
          muzzlePos,
          vel,
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
      shipId: this.activeShip.id,
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
        this.projectileVisuals.spawnBulletImpact(eb.pos, 0x00f0ff, false);
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
      const centerDir = this.safeDirectionToPlayer(e.pos);
      this.projectileVisuals.spawnMuzzleFlash(e.pos, centerDir, 0xff9f43, 0.9);
      for (const offset of [-0.14, 0, 0.14]) {
        const dir = centerDir.clone();
        dir.x += offset;
        dir.normalize();
        this.spawnEnemyBullet(e.pos.clone(), dir.multiplyScalar(28 * actMult), 13, 0xff9f43);
      }
    } else if (e.kind === 'enemy_foldwing') {
      e.fireTimer = Math.max(1.2, 2.0 / actMult);
      for (const side of [-0.7, 0.7]) {
        const origin = e.pos.clone().add(new THREE.Vector3(side, 0, 1.0));
        const dir = this.safeDirectionToPlayer(origin);
        this.projectileVisuals.spawnMuzzleFlash(origin, dir, 0xff4757, 0.85);
        this.spawnEnemyBullet(origin, dir.multiplyScalar(36 * actMult), 12, 0xff4757);
      }
    } else if (e.kind === 'enemy_rover') {
      e.fireTimer = Math.max(1.4, 2.3 / actMult);
      const muzzlePos = e.pos.clone().add(new THREE.Vector3(0, 0.8, 1));
      const dir = this.safeDirectionToPlayer(muzzlePos);
      this.projectileVisuals.spawnMuzzleFlash(muzzlePos, dir, 0xfbbf24, 1.0);
      this.spawnEnemyBullet(muzzlePos, dir.multiplyScalar(31 * actMult), 16, 0xfbbf24);
    } else {
      e.fireTimer = Math.max(1.5, 2.6 / actMult);
      const dir = this.safeDirectionToPlayer(e.pos);
      this.projectileVisuals.spawnMuzzleFlash(e.pos, dir, 0x38bdf8, 0.72);
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
          node.getWorldPosition(this.tmpVec3);
          this.vfx.spawnDetachedPart(node, boss.pos, boss.config.accentHex);
          this.sound.playExplosion('medium', this.worldXToPan(this.tmpVec3.x));
          this.screenShake = Math.max(this.screenShake, 0.35);
        }
      }
      if (boss.deathTimer >= 1.8) {
        this.vfx.spawnExplosion(boss.pos, 5.2, boss.config.accentHex, true);
        this.sound.playExplosion('boss', this.worldXToPan(boss.pos.x));
        this.screenShake = 0.9;
        this.slowMoTimer = 0;
        this.enemyBullets.length = 0;
        this.projectileVisuals.syncEnemyProjectiles(this.enemyBullets, 0, this.globalElapsed);
        this.invulnTimer = Math.max(this.invulnTimer, 2.0);
        this.els['boss-hud'].hidden = true;
        this.addUltimateCharge(45);
        this.score += Math.round(2500 * boss.config.act * this.combo);
        this.kills += 1;
        const missingHp = Math.max(0, this.playerMaxHp - this.playerHp);
        this.playerHp = this.playerMaxHp;
        if (missingHp > 0) {
          this.flashDamageVignette('heal');
          this.spawnFloatingText(
            this.playerPos,
            '通关整备 · 护盾全满',
            'pickup-repair',
            './ui/icons/icon_shield.png'
          );
          this.showPickupToast(
            'full_repair',
            'MAX',
            '通关修复 · 护盾全满',
            'FULL ARMOR RESTORATION',
            './ui/icons/icon_shield.png'
          );
        }
        this.updateHud();
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
    this.projectileVisuals.spawnMuzzleFlash(originMain, toPlayer, boss.config.accentHex, 1.45);
    this.spawnEnemyBullet(originMain, toPlayer.multiplyScalar(34), 16, boss.config.accentHex);

    // Part-driven attacks
    for (const part of boss.parts) {
      if (part.destroyed) continue;
      const pOrigin = part.worldPos.clone();
      const dir = this.safeDirectionToPlayer(pOrigin);
      if (part.weaponEffectKey === 'leftCannon' || part.weaponEffectKey === 'rightCannon') {
        this.projectileVisuals.spawnMuzzleFlash(pOrigin, dir, 0xff9f43, 1.25);
        this.spawnEnemyBullet(pOrigin, dir.multiplyScalar(38), 15, 0xff9f43);
      } else if (part.weaponEffectKey === 'leftClaw' || part.weaponEffectKey === 'rightClaw') {
        this.projectileVisuals.spawnMuzzleFlash(pOrigin, dir, 0x00f0ff, 1.15);
        for (const a of [-0.12, 0.12]) {
          const d = dir.clone();
          d.x += a;
          d.normalize();
          this.spawnEnemyBullet(pOrigin, d.multiplyScalar(33), 13, 0x00f0ff);
        }
      } else if (part.weaponEffectKey === 'dorsalTurret') {
        this.projectileVisuals.spawnMuzzleFlash(pOrigin, dir, 0xff4757, 1.35);
        for (const a of [-0.22, 0, 0.22]) {
          const d = dir.clone();
          d.x += a;
          d.normalize();
          this.spawnEnemyBullet(pOrigin, d.multiplyScalar(39), 15, 0xff4757);
        }
      } else if (part.weaponEffectKey === 'bowCrane') {
        this.projectileVisuals.spawnMuzzleFlash(pOrigin, dir, 0xffb347, 1.3);
        this.spawnEnemyBullet(pOrigin, dir.multiplyScalar(42), 18, 0xffb347);
      }
    }
  }

  private updatePlayerBullets(dt: number): void {
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

      if (this.waves.checkGateSolidCollision(b.pos, 0.55) !== null) {
        this.projectileVisuals.spawnBulletImpact(b.pos, 0xffb347, false);
        this.vfx.spawnSparks(b.pos, 4, 0xffb347, 10);
        this.playerBullets.splice(i, 1);
        continue;
      }

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
    }

    this.projectileVisuals.syncPlayerProjectiles(this.playerBullets, dt, this.globalElapsed);
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
    this.sound.playHit(isCrit, this.worldXToPan(e.pos.x), this.combo);
    this.vfx.spawnSparks(e.pos, fromBeam ? 2 : 5, isCrit ? 0xffb347 : 0x00f0ff, 12);
    if (!fromBeam) {
      this.projectileVisuals.spawnBulletImpact(e.pos, isCrit ? 0xffb347 : 0x00f0ff, isCrit);
    }

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
      this.sound.playExplosion(
        e.isElite ? 'medium' : 'small',
        this.worldXToPan(dropPos.x)
      );
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
    this.projectileVisuals.syncEnemyProjectiles(this.enemyBullets, 0, this.globalElapsed);
    this.invulnTimer = Math.max(this.invulnTimer, 3.0);
    this.sound.playExplosion('boss', this.worldXToPan(boss.pos.x));
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
    this.sound.playHit(isCrit, this.worldXToPan(hitPos.x), this.combo);
    this.vfx.spawnSparks(hitPos, fromBeam ? 2 : 7, 0xffb347, 15);
    if (!fromBeam) {
      this.projectileVisuals.spawnBulletImpact(hitPos, isCrit ? 0xffb347 : 0xff9f43, isCrit);
    }
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
      this.sound.playPartBreak(this.worldXToPan(part.worldPos.x));
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
    this.sound.playHit(isCrit, this.worldXToPan(hitPos.x), this.combo);
    this.vfx.spawnSparks(hitPos, fromBeam ? 2 : 5, boss.config.accentHex, 13);
    if (!fromBeam) {
      this.projectileVisuals.spawnBulletImpact(
        hitPos,
        isCrit ? 0xffb347 : boss.config.accentHex,
        isCrit
      );
    }
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
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.age += dt;
      if (eb.age >= eb.maxAge || eb.pos.z > 14 || eb.pos.z < -150) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      eb.pos.addScaledVector(eb.vel, dt);

      if (!this.playerDying && this.invulnTimer <= 0 && eb.pos.distanceToSquared(this.playerPos) < 1.55 * 1.55) {
        this.applyPlayerDamage(eb.damage);
        this.enemyBullets.splice(i, 1);
        continue;
      }
    }

    this.projectileVisuals.syncEnemyProjectiles(this.enemyBullets, dt, this.globalElapsed);
  }

  private triggerPlayerCrashDestruction(): void {
    if (this.playerDying) return;
    this.playerDying = true;
    this.playerDeathTimer = 0.85;
    this.playerDeathSecondaryBurstDone = false;
    this.playerDeathReason = 'gate_crash';
    this.playerHp = 0;
    this.slowMoTimer = Math.max(this.slowMoTimer, 0.72);
    this.screenShake = 1.25;

    if (this.playerInstance) {
      this.playerInstance.root.visible = false;
    }
    this.beamGroup.visible = false;
    this.projectileVisuals.updateRollShield(
      false,
      this.playerPos,
      0,
      this.activeShip.accentHex,
      this.globalElapsed
    );
    this.projectileVisuals.updatePlayerThrusters(
      false,
      this.playerPos,
      this.tmpQuat,
      this.playerVel,
      this.activeShip.engineColor,
      false,
      0,
      this.globalElapsed
    );

    this.vfx.spawnExplosion(this.playerPos, 4.4, 0xff4757, true);
    this.vfx.spawnExplosion(
      this.playerPos.clone().add(new THREE.Vector3(0.55, 0.35, -0.35)),
      2.8,
      0xffb347,
      false
    );
    this.vfx.spawnSparks(this.playerPos, 32, 0xff8c2b, 26);
    this.vfx.spawnSparks(this.playerPos, 24, 0x00f0ff, 20);

    this.sound.playShieldHit();
    this.sound.playExplosion('boss');
    this.flashDamageVignette('damage');
    this.showWaveCallout({
      sector: '⚠ 致命撞击警报',
      title: '撞击闸门装甲',
      fraction: 'HULL BREACH',
      sub: '机体高速撞毁解体 · 跃迁闸门拦截',
      isBoss: true,
      isEndless: true,
      durationSec: 2.0,
    });
    this.updateHud();
  }

  private applyPlayerDamage(dmg: number): void {
    if (this.playerDying) return;
    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.invulnTimer = 0.55;
    this.timeSinceHit = 0;
    this.combo = Math.max(1.0, +(this.combo * 0.7).toFixed(1));
    this.screenShake = Math.max(this.screenShake, 0.48);
    this.sound.playShieldHit();
    this.flashDamageVignette('damage');
    this.vfx.spawnSparks(this.playerPos, 10, 0xff4757, 14);
    this.projectileVisuals.spawnBulletImpact(this.playerPos, 0xff4757, false);

    if (this.playerHp <= 0) {
      this.playerDeathReason = 'combat';
      this.vfx.spawnExplosion(this.playerPos, 3.4, 0xff4757, true);
      this.sound.playExplosion('boss');
      this.showResultDialog(false);
    }
  }

  private createPickupGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.32, 'rgba(255, 255, 255, 0.72)');
      grad.addColorStop(0.68, 'rgba(255, 255, 255, 0.20)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private releasePickup(pk: PickupItem): void {
    pk.haloRing.removeFromParent();
    pk.glowSprite.removeFromParent();
    this.loader.release(pk.instance);
  }

  private clearPickups(): void {
    for (const pk of this.pickups) {
      this.releasePickup(pk);
    }
    this.pickups.length = 0;
  }

  private spawnPickup(kind: 'repair' | 'energy', pos: THREE.Vector3, initialVel?: THREE.Vector3): void {
    if (this.pickups.length >= MAX_PICKUPS) return;
    const instance = this.loader.acquire(
      kind === 'repair' ? 'pickup_repair' : 'pickup_energy',
      false
    );
    const haloRing = new THREE.Mesh(
      this.pickupHaloGeo,
      kind === 'repair' ? this.pickupRepairHaloMat : this.pickupEnergyHaloMat
    );
    const glowSprite = new THREE.Sprite(
      kind === 'repair' ? this.pickupRepairGlowMat : this.pickupEnergyGlowMat
    );
    glowSprite.scale.setScalar(2.05);
    instance.root.add(glowSprite, haloRing);
    instance.root.position.copy(pos);
    this.scene.add(instance.root);

    this.pickups.push({
      kind,
      instance,
      haloRing,
      glowSprite,
      pos: pos.clone(),
      vel: initialVel
        ? initialVel.clone()
        : new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, 18),
      age: 0,
      maxAge: 7.5,
    });
  }

  private updatePickups(dt: number): void {
    const magnetR2 = this.upgrades.pickupMagnetRadius * this.upgrades.pickupMagnetRadius;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.age += dt;
      if (pk.age >= pk.maxAge || pk.pos.z > 14) {
        this.releasePickup(pk);
        this.pickups.splice(i, 1);
        continue;
      }

      const d2 = pk.pos.distanceToSquared(this.playerPos);
      if (d2 < 2.2 * 2.2) {
        this.sound.playPickup(this.worldXToPan(pk.pos.x));
        if (pk.kind === 'repair') {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 22);
          this.flashDamageVignette('heal');
          this.spawnFloatingText(
            this.playerPos,
            '+22 装甲修复',
            'pickup-repair',
            './ui/icons/icon_pickup_repair.png'
          );
          this.showPickupToast(
            'repair',
            '+22',
            '装甲修复',
            'HULL INTEGRITY RESTORED',
            './ui/icons/icon_pickup_repair.png'
          );
        } else {
          this.addUltimateCharge(25);
          this.spawnFloatingText(
            this.playerPos,
            '+25% 超频能量',
            'pickup-energy',
            './ui/icons/icon_pickup_energy.png'
          );
          this.showPickupToast(
            'energy',
            '+25%',
            '超频能量',
            'OVERDRIVE CAPACITOR CHARGED',
            './ui/icons/icon_pickup_energy.png'
          );
        }
        this.releasePickup(pk);
        this.pickups.splice(i, 1);
        continue;
      }

      const inMagnet = d2 < magnetR2;
      if (inMagnet) {
        this.tmpDir.subVectors(this.playerPos, pk.pos).normalize();
        pk.pos.addScaledVector(this.tmpDir, 28 * dt);
      } else {
        pk.pos.addScaledVector(pk.vel, dt);
      }

      pk.instance.root.position.copy(pk.pos);
      pk.instance.modelRoot.rotation.set(
        0.32 + Math.sin(pk.age * 2.4) * 0.14,
        pk.age * (inMagnet ? 5.6 : 2.5),
        Math.sin(pk.age * 1.9) * 0.1
      );
      pk.instance.modelRoot.scale.setScalar(1.0 + Math.sin(pk.age * 6.5) * 0.07);
      pk.haloRing.rotation.set(Math.PI * 0.35 + pk.age * 1.8, pk.age * 2.3, 0);
    }
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
      this.tmpCamTarget.set(this.playerPos.x * 0.45 + sx, this.playerPos.y * 0.42 + 2.45 + sy, 14.2),
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
      const lifeRatio = ft.age / ft.maxAge;
      const fadeRatio =
        lifeRatio <= ft.holdRatio
          ? 0
          : (lifeRatio - ft.holdRatio) / Math.max(0.01, 1 - ft.holdRatio);
      const alpha = 1 - fadeRatio * fadeRatio;
      ft.el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
      ft.el.style.opacity = alpha.toFixed(2);
    }

    // Update left-mid tactical pickup acquisition toast feed countdown bars
    for (let i = this.pickupToasts.length - 1; i >= 0; i--) {
      const toast = this.pickupToasts[i];
      toast.age += rawDt;
      const rem = Math.max(0, 1 - toast.age / toast.maxAge);
      toast.barEl.style.transform = `scaleX(${rem.toFixed(3)})`;
      if (!toast.leaving && toast.age >= toast.maxAge - 0.24) {
        toast.leaving = true;
        toast.el.classList.add('is-leaving');
      }
      if (toast.age >= toast.maxAge) {
        toast.el.remove();
        this.pickupToasts.splice(i, 1);
      }
    }
  }

  private updateHud(): void {
    if (!this.waves.activeBoss && !this.els['boss-hud'].hidden) {
      this.els['boss-hud'].hidden = true;
    }

    const hpPctNum = Math.max(0, (this.playerHp / this.playerMaxHp) * 100);
    const hpPctStr = `${hpPctNum.toFixed(1)}%`;
    const hpText = `${Math.ceil(this.playerHp)} / ${this.playerMaxHp}`;
    const hpLow = hpPctNum <= 30;
    const cache = this.lastHudCache;

    if (hpPctStr !== cache.hpPct) {
      cache.hpPct = hpPctStr;
      this.els['hud-hp-fill'].style.width = hpPctStr;
      this.els['hud-hp-ghost'].style.width = hpPctStr;
    }
    if (hpText !== cache.hpText) {
      cache.hpText = hpText;
      this.els['hud-hp-text'].textContent = hpText;
    }
    if (hpLow !== cache.hpLow) {
      cache.hpLow = hpLow;
      this.els['hud-hp-fill'].classList.toggle('is-low', hpLow);
      this.els['hud-cluster-tl'].classList.toggle('is-danger', hpLow);
    }

    const comboVal = `x${this.combo.toFixed(1)}`;
    const comboHot = this.combo >= 3.0;
    const comboBar = `${Math.min(100, (this.comboTimer / 4.0) * 100).toFixed(1)}%`;
    if (comboVal !== cache.comboVal) {
      cache.comboVal = comboVal;
      this.els['hud-combo-val'].textContent = comboVal;
    }
    if (comboHot !== cache.comboHot) {
      cache.comboHot = comboHot;
      this.els['hud-combo-box'].classList.toggle('is-hot', comboHot);
    }
    if (comboBar !== cache.comboBar) {
      cache.comboBar = comboBar;
      this.els['hud-combo-bar'].style.width = comboBar;
    }

    const actLabel = this.waves.isEndless()
      ? `无尽深空 · WAVE ${this.waves.getEndlessWave()}`
      : `ACT ${this.waves.getAct()} · WAVE ${this.waves.getWaveInAct()}/3`;
    if (actLabel !== cache.actLabel) {
      cache.actLabel = actLabel;
      this.els['hud-act-label'].textContent = actLabel;
    }

    const scoreStr = Math.round(this.score).toLocaleString();
    if (scoreStr !== cache.score) {
      cache.score = scoreStr;
      this.els['hud-score-value'].textContent = scoreStr;
    }

    const rollMax = Math.max(0.35, this.activeShip.rollCooldown * this.upgrades.rollCooldownMult);
    const rollPctNum = this.rollCooldownTimer <= 0 ? 100 : (1 - this.rollCooldownTimer / rollMax) * 100;
    const rollPct = `${Math.max(0, Math.min(100, rollPctNum)).toFixed(1)}%`;
    const rollStatus = this.rollCooldownTimer <= 0 ? 'READY' : `${this.rollCooldownTimer.toFixed(1)}s`;
    const rollReady = this.rollCooldownTimer <= 0;
    if (rollPct !== cache.rollPct) {
      cache.rollPct = rollPct;
      this.els['hud-roll-fill'].style.width = rollPct;
    }
    if (rollStatus !== cache.rollStatus) {
      cache.rollStatus = rollStatus;
      this.els['hud-roll-status'].textContent = rollStatus;
    }
    if (rollReady !== cache.rollReady) {
      cache.rollReady = rollReady;
      this.els['hud-roll-card'].classList.toggle('is-ready', rollReady);
    }

    const ultPctNum = Math.min(100, (this.ultimateCharge / this.activeShip.ultimateCost) * 100);
    const ultBar = `${ultPctNum.toFixed(1)}%`;
    const ultReady = ultPctNum >= 100;
    const ultPctText = ultReady ? 'READY!' : `${Math.floor(ultPctNum)}%`;
    if (ultBar !== cache.ultBar) {
      cache.ultBar = ultBar;
      this.els['hud-ult-fill'].style.width = ultBar;
    }
    if (ultPctText !== cache.ultPctText) {
      cache.ultPctText = ultPctText;
      this.els['hud-ult-pct'].textContent = ultPctText;
    }
    if (ultReady !== cache.ultReady) {
      cache.ultReady = ultReady;
      this.els['hud-ult-card'].classList.toggle('is-ready', ultReady);
      this.els['hud-reticle'].classList.toggle('is-ult-ready', ultReady);
    }
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
          selectedGameMode: this.selectedGameMode,
          activeRunMode: this.activeRunMode,
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
          countdownActive: !this.launchCountdownCombatUnlocked,
          countdownRemaining: +Math.max(0, this.launchCountdownRemaining).toFixed(2),
          playerDying: this.playerDying,
          activeGateCount: this.waves.getActiveGateCount(),
          pickupCount: this.pickups.length,
          enemyCount: this.waves.activeEnemies.length,
          enemyBulletCount: this.enemyBullets.length,
          playerBulletCount: this.playerBullets.length,
          upgrades: { ...this.upgrades.stacks },
          pierceCount: this.upgrades.pierceCount,
          critChance: +this.upgrades.critChance.toFixed(3),
          aeroBounceCount: this.aeroBounceCount,
          boss: bossSnapshot,
          fps: this.currentFps,
          frameMs: +this.emaFrameMs.toFixed(1),
          graphicsPreset: this.graphicsPreset,
          renderPixelRatio: +this.renderPixelRatio.toFixed(2),
          internalWidth: this.internalWidth,
          internalHeight: this.internalHeight,
          hardware: { ...this.hardwareProfile },
          audio: this.sound.getTelemetry(),
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
          this.openHangarFromBoot(true);
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

      setGameMode: (mode: GameMode): void => {
        this.setSelectedGameMode(mode === 'endless' ? 'endless' : 'arcade');
      },

      startSortie: (mode?: GameMode): void => {
        if (this.state === 'boot') {
          this.openHangarFromBoot(true);
        }
        this.startSortie(mode ?? this.selectedGameMode);
      },

      forceUpgradeModal: (): void => {
        if (this.state === 'boot') {
          this.openHangarFromBoot(true);
        }
        if (this.state === 'hangar' || this.state === 'result') {
          this.startSortie();
        } else if (this.state === 'paused') {
          this.closeAllDialogs();
          this.setScreenState('playing');
        }
        if (this.state === 'playing') {
          this.clearLaunchCountdown(true);
          this.openUpgradeDialog();
        }
      },

      spawnBossNow: (act: 1 | 2 | 3): void => {
        if (this.state === 'boot') {
          this.openHangarFromBoot(true);
        }
        if (this.state === 'hangar' || this.state === 'result') {
          this.startSortie();
        } else if (this.state === 'paused' || this.state === 'upgrade') {
          this.closeAllDialogs();
          this.clearInputState();
          this.setScreenState('playing');
        }
        this.playerDying = false;
        this.playerDeathTimer = 0;
        this.playerDeathSecondaryBurstDone = false;
        this.playerDeathReason = 'combat';
        if (this.playerInstance) {
          this.playerInstance.root.visible = true;
        }
        this.clearLaunchCountdown(false);
        this.enemyBullets.length = 0;
        this.projectileVisuals.syncEnemyProjectiles(this.enemyBullets, 0, this.globalElapsed);
        const ev = this.waves.forceSpawnBoss(act);
        this.handleWaveEvent(ev);
        this.waves.setCombatActive(true);
        this.envSystem.setMode('combat');
        this.envSystem.setAct(act, true);
        this.waves.updateEnvironment(0, 1.0);
        this.envSystem.update(0, this.globalElapsed, 36, this.camera);
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

      setGraphicsPreset: (preset: GraphicsPreset): void => {
        this.setGraphicsPreset(preset);
      },

      spawnGateNow: (z = -220, mode: 'closed' | 'opening' | 'open' = 'open'): void => {
        if (this.state !== 'playing') return;
        this.clearLaunchCountdown(false);
        this.waves.setCombatActive(true);
        this.waves.forceSpawnGate(z, mode);
        this.waves.updateEnvironment(0, 1.0);
      },

      spawnPickupNow: (kind: 'repair' | 'energy', x = 0, y = 0, z = -14): void => {
        if (this.state !== 'playing') return;
        this.clearLaunchCountdown(false);
        this.spawnPickup(kind, new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 1.5));
      },

      spawnBoostRingNow: (x = 0, y = 0, z = -16): void => {
        if (this.state !== 'playing') return;
        this.clearLaunchCountdown(false);
        this.waves.setCombatActive(true);
        this.waves.forceSpawnBoostRing(x, y, z);
        this.waves.updateEnvironment(0, 1.0);
      },

      triggerPickupFeedbackDemo: (): void => {
        if (this.state !== 'playing') return;
        this.clearLaunchCountdown(false);
        this.spawnFloatingText(
          this.playerPos.clone().add(new THREE.Vector3(-2.6, 0.2, -3)),
          '1840!',
          'crit'
        );
        this.spawnFloatingText(
          this.playerPos,
          '+22 装甲修复',
          'pickup-repair',
          './ui/icons/icon_pickup_repair.png'
        );
        this.showPickupToast(
          'repair',
          '+22',
          '装甲修复',
          'HULL INTEGRITY RESTORED',
          './ui/icons/icon_pickup_repair.png'
        );
        this.spawnFloatingText(
          this.playerPos,
          '+25% 超频能量',
          'pickup-energy',
          './ui/icons/icon_pickup_energy.png'
        );
        this.showPickupToast(
          'energy',
          '+25%',
          '超频能量',
          'OVERDRIVE CAPACITOR CHARGED',
          './ui/icons/icon_pickup_energy.png'
        );
        this.spawnFloatingText(
          this.playerPos,
          '+10 护盾 · 穿环加速',
          'pickup-boost',
          './ui/icons/icon_thruster.png'
        );
        this.showPickupToast(
          'boost',
          '+10 护盾',
          '穿环加速 · 能量+15%',
          'SLIPSTREAM OVERBOOST',
          './ui/icons/icon_thruster.png'
        );
      },

      setPlayerHp: (hp: number): void => {
        const clamped = THREE.MathUtils.clamp(
          Math.round(Number.isFinite(hp) ? hp : this.playerMaxHp),
          1,
          this.playerMaxHp
        );
        this.playerHp = clamped;
        this.updateHud();
      },
    };

    window.__STARFORGE__ = api;
  }
}
