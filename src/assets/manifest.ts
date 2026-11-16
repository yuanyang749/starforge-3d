export type ModelKey =
  | 'ship_astra'
  | 'ship_opus'
  | 'ship_morph'
  | 'ship_aero'
  | 'boss_act1_mech'
  | 'boss_act2_crab'
  | 'boss_act3_carrier'
  | 'enemy_drone'
  | 'enemy_turret'
  | 'enemy_rover'
  | 'enemy_foldwing'
  | 'ally_biplane'
  | 'prop_city_tile'
  | 'prop_gate';

export type ShipId = 'astra' | 'opus' | 'morph' | 'aero';
export type BossId = 'act1' | 'act2' | 'act3';

export interface OrientationOffset {
  yaw: number;
  pitch?: number;
  roll?: number;
}

export interface ModelAssetSpec {
  key: ModelKey;
  url: string;
  aiModel: string;
  prompt: string;
  targetSize: number;
  orientation: OrientationOffset;
  stripNodes?: string[];
}

export interface ShipConfig {
  id: ShipId;
  modelKey: ModelKey;
  badgeIcon: string;
  factionTag: string;
  nameZh: string;
  codeName: string;
  roleTag: string;
  accentColor: string;
  accentHex: number;
  engineColor: number;
  weaponName: string;
  weaponDesc: string;
  ultimateName: string;
  ultimateDesc: string;
  stats: {
    firepower: number; // 1..5
    speed: number; // 1..5
    shield: number; // 1..5
    agility: number; // 1..5
  };
  baseHp: number;
  moveSpeed: number;
  fireInterval: number;
  bulletDamage: number;
  bulletSpeed: number;
  rollCooldown: number;
  ultimateCost: number;
}

export interface BossPartSpec {
  id: string;
  nodeName: string;
  labelZh: string;
  hp: number;
  hitRadius: number;
  weaponEffectKey: 'leftCannon' | 'rightCannon' | 'leftClaw' | 'rightClaw' | 'dorsalTurret' | 'bowCrane';
}

export interface BossConfig {
  id: BossId;
  act: number;
  modelKey: ModelKey;
  nameZh: string;
  codeName: string;
  subtitle: string;
  aiModel: string;
  prompt: string;
  maxHp: number;
  accentColor: string;
  accentHex: number;
  destructibleParts: BossPartSpec[];
}

export const MODEL_ASSETS: Record<ModelKey, ModelAssetSpec> = {
  ship_astra: {
    key: 'ship_astra',
    url: './models/ship_astra.glb',
    aiModel: 'GPT-6 Astra 3D',
    prompt:
      'Build this complete solarpunk VTOL shuttle as a premium low-poly game prop, six meters long. Ivory hull, orange panels, smoked teal cockpit, four downward-facing ducted turbine pods, landing skids and a rooftop garden. Preserve the reference silhouette. Use clean named mesh parts and 8-12 shared PBR materials. Separate cockpit canopy, four rotors and landing skids as named objects for later animation. Put the origin at bottom center; nose faces forward. Solid bevelled geometry, readable panel detailing, cyan emissive thruster rings, layered broad green leaves. No ground plane, text or backdrop. Budget 30000 triangles.',
    targetSize: 2.8,
    orientation: { yaw: Math.PI },
  },
  ship_opus: {
    key: 'ship_opus',
    url: './models/ship_opus.glb',
    aiModel: 'Claude Opus 5.5 3D',
    prompt:
      'Metal toy spacecraft, game ready, all parts can be animated and joints are physically plausible',
    targetSize: 2.8,
    orientation: { yaw: Math.PI },
  },
  ship_morph: {
    key: 'ship_morph',
    url: './models/ship_morph.glb',
    aiModel: 'GPT-6 Astra · 3D-to-3D',
    prompt:
      'Give the spacecraft retractable landing gear and folding outer wing assemblies, including their attached fans. Add the hinges, struts and gear-bay doors needed for a plausible mechanism. Animate an eight-second transition from parked with wings folded and gear extended to flight-ready with wings spread, gear retracted and bay doors closed, then back to parked. Preserve the hull’s visual identity and maintain clearance throughout the sequence.',
    targetSize: 3.1,
    orientation: { yaw: Math.PI },
  },
  ship_aero: {
    key: 'ship_aero',
    url: './models/ship_aero.glb',
    aiModel: 'GPT-6 Astra · 3D-to-3D',
    prompt:
      'Separate the ailerons and elevator into operable surfaces with clean hinge gaps. Animate symmetric elevator movement and opposing aileron movement through 15 degrees. Preserve the airframe silhouette at neutral and existing textures.',
    targetSize: 3.0,
    orientation: { yaw: Math.PI },
  },
  boss_act1_mech: {
    key: 'boss_act1_mech',
    url: './models/boss_act1_mech.glb',
    aiModel: 'Claude Opus 5.5 3D',
    prompt: 'battle mech',
    targetSize: 9.5,
    orientation: { yaw: 0 },
  },
  boss_act2_crab: {
    key: 'boss_act2_crab',
    url: './models/boss_act2_crab.glb',
    aiModel: 'Claude Opus 5.5 3D',
    prompt: 'crab shape robot mech with 3 pairs of legs and 2 claws',
    targetSize: 10.5,
    orientation: { yaw: 0 },
  },
  boss_act3_carrier: {
    key: 'boss_act3_carrier',
    url: './models/boss_act3_carrier.glb',
    aiModel: 'Claude Opus 5.5 3D',
    prompt:
      'a spine-truss sci-fi carrier model with exposed hangar cradle and fighter craft',
    targetSize: 14.5,
    orientation: { yaw: 0 },
    stripNodes: ['Stand_DisplayBase', 'Stand_Pylons'],
  },
  enemy_drone: {
    key: 'enemy_drone',
    url: './models/enemy_drone.glb',
    aiModel: 'GPT-6 Astra 3D',
    prompt:
      'a compact all-terrain scout drone, matte gray and orange chassis, rugged tires',
    targetSize: 2.3,
    orientation: { yaw: 0 },
  },
  enemy_turret: {
    key: 'enemy_turret',
    url: './models/enemy_turret.glb',
    aiModel: 'GPT-6 Astra · 3D-to-3D',
    prompt:
      'Animate the turret upper assembly swivelling 45 degrees left, then 45 degrees right, and returning to its original orientation over four seconds. Keep the round base stationary and preserve the existing appearance. Make the joint and newly exposed surfaces visually coherent throughout the movement.',
    targetSize: 3.0,
    orientation: { yaw: 0 },
  },
  enemy_rover: {
    key: 'enemy_rover',
    url: './models/enemy_rover.glb',
    aiModel: 'GPT-6 Astra · 3D-to-3D',
    prompt:
      'Add a folding robotic arm with a two-finger gripper mounted on the rover deck. Animate it deploying, picking up a small newly added sample container from the ground beside the rover, and placing it on the deck. Maintain coherent joints and clearances while preserving the existing rover.',
    targetSize: 3.2,
    orientation: { yaw: 0 },
    stripNodes: [
      'SAMPLE 01 | deck receiving cradle',
      'SAMPLE | fixed deck cradle',
      'SAMPLE 02 | sealed S-01 canister',
      'SAMPLE | animated canister',
    ],
  },
  enemy_foldwing: {
    key: 'enemy_foldwing',
    url: './models/enemy_foldwing.glb',
    aiModel: 'GPT-6 Astra · 3D-to-3D',
    prompt:
      'Make both wings fold upward for storage, retaining fixed inner roots and adding plausible hinge hardware and finished exposed joint surfaces. Animate the symmetric movement from flight configuration to 80 degrees folded. Preserve the fuselage, landing gear and texture appearance.',
    targetSize: 3.6,
    orientation: { yaw: 0 },
  },
  ally_biplane: {
    key: 'ally_biplane',
    url: './models/ally_biplane.glb',
    aiModel: 'GPT-6 Astra · 3D-to-3D',
    prompt:
      'Create a short looping animation in which the propeller spins while the aircraft stays stationary. Isolate the propeller if needed and pivot it around its hub. Preserve the wings, body, wheels, materials and overall geometry.',
    targetSize: 1.55,
    orientation: { yaw: Math.PI },
  },
  prop_city_tile: {
    key: 'prop_city_tile',
    url: './models/prop_city_tile.glb',
    aiModel: 'Claude Opus 5.5 3D',
    prompt: 'a modular sci-fi city block terrain kit tile',
    targetSize: 18,
    orientation: { yaw: 0 },
  },
  prop_gate: {
    key: 'prop_gate',
    url: './models/prop_gate.glb',
    aiModel: 'GPT-6 Astra · 3D-to-3D',
    prompt:
      'Animate a four-second vault-opening sequence: turn the handwheel, retract the locking bolts, then swing the door open by 70 degrees around its hinge. Hold it open for the final second. Keep the frame stationary and preserve the industrial materials. The rear of the door and newly exposed opening must remain coherent.',
    targetSize: 34,
    orientation: { yaw: 0 },
  },
};

export const SHIPS: ShipConfig[] = [
  {
    id: 'astra',
    modelKey: 'ship_astra',
    badgeIcon: './ui/icons/badge_astra.png',
    factionTag: 'GPT-6 ASTRA 3D',
    nameZh: '日曜四旋翼穿梭机',
    codeName: 'SOLARIS VTOL // X-01',
    roleTag: '均衡激光 · 离子光柱',
    accentColor: '#ffb347',
    accentHex: 0xffb347,
    engineColor: 0xff8c2b,
    weaponName: '高频双联脉冲激光',
    weaponDesc: '高射速双轨金色脉冲，配合四台独立矢量旋翼稳定悬停，攻守兼备。',
    ultimateName: '轨道离子过载光束',
    ultimateDesc: '释放持续 2.5 秒的贯穿级离子主炮光柱，焚毁路径敌弹并高频灼烧所有目标。',
    stats: { firepower: 4, speed: 4, shield: 3, agility: 4 },
    baseHp: 100,
    moveSpeed: 18.5,
    fireInterval: 0.125,
    bulletDamage: 16,
    bulletSpeed: 98,
    rollCooldown: 1.55,
    ultimateCost: 100,
  },
  {
    id: 'opus',
    modelKey: 'ship_opus',
    badgeIcon: './ui/icons/badge_opus.png',
    factionTag: 'CLAUDE OPUS 5.5 3D',
    nameZh: '铁砧倾转旋翼突击舰',
    codeName: 'ANVIL GUNSHIP // C-55',
    roleTag: '重盾三联炮 · 弹幕转化',
    accentColor: '#00f0ff',
    accentHex: 0x00f0ff,
    engineColor: 0x22d3ee,
    weaponName: '三向扇形电浆炮',
    weaponDesc: '一次倾泻三发高冲击电浆弹幕，自带 8 段原生机械变形与高容量护盾。',
    ultimateName: '电磁护盾新星',
    ultimateDesc: '瞬间回复 30 点护盾，并将全场所有敌方弹幕转化为追踪敌机的友方反击导弹！',
    stats: { firepower: 4, speed: 3, shield: 5, agility: 3 },
    baseHp: 135,
    moveSpeed: 16.5,
    fireInterval: 0.21,
    bulletDamage: 14,
    bulletSpeed: 88,
    rollCooldown: 1.75,
    ultimateCost: 100,
  },
  {
    id: 'morph',
    modelKey: 'ship_morph',
    badgeIcon: './ui/icons/badge_morph.png',
    factionTag: 'GPT-6 ASTRA · 3D-RIG',
    nameZh: '苍穹百轨变形截击舰',
    codeName: 'VALKYRIE MORPH-WING // A-103',
    roleTag: '百轨折翼 · 极速穿甲',
    accentColor: '#ff4757',
    accentHex: 0xff4757,
    engineColor: 0xff3b5c,
    weaponName: '极速穿甲磁轨双炮',
    weaponDesc: '103 段液压起落架与折叠外翼联动作动，具备最高移速与最短翻滚冷却。',
    ultimateName: '幻影齐射风暴',
    ultimateDesc: '火控全开瞬间齐射 18 枚高爆追踪导弹，自动锁定清空屏幕敌群与 Boss 部位。',
    stats: { firepower: 5, speed: 5, shield: 2, agility: 5 },
    baseHp: 90,
    moveSpeed: 21.5,
    fireInterval: 0.14,
    bulletDamage: 19,
    bulletSpeed: 112,
    rollCooldown: 1.1,
    ultimateCost: 100,
  },
  {
    id: 'aero',
    modelKey: 'ship_aero',
    badgeIcon: './ui/icons/badge_aero.png',
    factionTag: 'GPT-6 ASTRA · AERO-RIG',
    nameZh: '疾风气动重型战机',
    codeName: 'TEMPEST AERO-STRIKER // G-08',
    roleTag: '气动舵面 · 时空缓速',
    accentColor: '#c084fc',
    accentHex: 0xc084fc,
    engineColor: 0xf97316,
    weaponName: '高暴击折射激光机炮',
    weaponDesc: '实装可动副翼与升降舵气动操控面，命中后折射弹射邻近敌人且高暴击。',
    ultimateName: '棱镜时空缓速场',
    ultimateDesc: '展开持续 4 秒的时空力场，全体敌机与敌弹减速 70%，期间主武器必定暴击。',
    stats: { firepower: 4, speed: 4, shield: 3, agility: 4 },
    baseHp: 100,
    moveSpeed: 19.2,
    fireInterval: 0.15,
    bulletDamage: 15,
    bulletSpeed: 96,
    rollCooldown: 1.45,
    ultimateCost: 100,
  },
];

export const BOSSES: Record<BossId, BossConfig> = {
  act1: {
    id: 'act1',
    act: 1,
    modelKey: 'boss_act1_mech',
    nameZh: '铁幕四足重炮机甲',
    codeName: 'UNIT-OPUS // QUADRUPED SIEGE',
    subtitle: '第 1 幕关底 · 四足三段关节重装要塞',
    aiModel: MODEL_ASSETS.boss_act1_mech.aiModel,
    prompt: MODEL_ASSETS.boss_act1_mech.prompt,
    maxHp: 950,
    accentColor: '#ff9f43',
    accentHex: 0xff9f43,
    destructibleParts: [
      {
        id: 'cannon_l',
        nodeName: 'Cannon_L',
        labelZh: '左肩重炮',
        hp: 230,
        hitRadius: 1.9,
        weaponEffectKey: 'leftCannon',
      },
      {
        id: 'cannon_r',
        nodeName: 'Cannon_R',
        labelZh: '右肩重炮',
        hp: 230,
        hitRadius: 1.9,
        weaponEffectKey: 'rightCannon',
      },
    ],
  },
  act2: {
    id: 'act2',
    act: 2,
    modelKey: 'boss_act2_crab',
    nameZh: '深渊巨钳螃蟹机甲',
    codeName: 'UNIT-OPUS // HEXAPOD CRAB MECH',
    subtitle: '第 2 幕关底 · 碎星门廊电磁风暴核心',
    aiModel: MODEL_ASSETS.boss_act2_crab.aiModel,
    prompt: MODEL_ASSETS.boss_act2_crab.prompt,
    maxHp: 1550,
    accentColor: '#00f0ff',
    accentHex: 0x00f0ff,
    destructibleParts: [
      {
        id: 'claw_l',
        nodeName: 'Claw_L',
        labelZh: '左电弧巨钳',
        hp: 350,
        hitRadius: 2.3,
        weaponEffectKey: 'leftClaw',
      },
      {
        id: 'claw_r',
        nodeName: 'Claw_R',
        labelZh: '右电弧巨钳',
        hp: 350,
        hitRadius: 2.3,
        weaponEffectKey: 'rightClaw',
      },
    ],
  },
  act3: {
    id: 'act3',
    act: 3,
    modelKey: 'boss_act3_carrier',
    nameZh: '龙骨桁架星际母舰',
    codeName: 'FLAGSHIP-OPUS // SPINE-TRUSS CARRIER',
    subtitle: '第 3 幕终极决战 · AI 舰队总枢纽',
    aiModel: MODEL_ASSETS.boss_act3_carrier.aiModel,
    prompt: MODEL_ASSETS.boss_act3_carrier.prompt,
    maxHp: 2450,
    accentColor: '#ff4757',
    accentHex: 0xff4757,
    destructibleParts: [
      {
        id: 'dorsal_turret',
        nodeName: 'DorsalTurret',
        labelZh: '背脊防空主炮',
        hp: 480,
        hitRadius: 2.5,
        weaponEffectKey: 'dorsalTurret',
      },
      {
        id: 'bow_crane',
        nodeName: 'BowCraneArms',
        labelZh: '舰首投射臂',
        hp: 430,
        hitRadius: 2.6,
        weaponEffectKey: 'bowCrane',
      },
    ],
  },
};

export interface ActTheme {
  act: number;
  titleZh: string;
  subtitle: string;
  fogColor: number;
  bgColor: number;
  gridColor: number;
  accentColor: number;
}

export const ACT_THEMES: ActTheme[] = [
  {
    act: 1,
    titleZh: 'ACT I · 轨道城峡谷',
    subtitle: 'ORBITAL METROPOLIS CORRIDOR',
    fogColor: 0x0d2847,
    bgColor: 0x0a1e38,
    gridColor: 0x164e63,
    accentColor: 0x00f0ff,
  },
  {
    act: 2,
    titleZh: 'ACT II · 碎星跃迁门廊',
    subtitle: 'FRACTURED WARP GATEWAY',
    fogColor: 0x18133d,
    bgColor: 0x110d2e,
    gridColor: 0x581c87,
    accentColor: 0xc084fc,
  },
  {
    act: 3,
    titleZh: 'ACT III · 龙骨母舰空域',
    subtitle: 'CRIMSON DREADNOUGHT CITADEL',
    fogColor: 0x2d0f16,
    bgColor: 0x21090e,
    gridColor: 0x7f1d1d,
    accentColor: 0xff4757,
  },
];
