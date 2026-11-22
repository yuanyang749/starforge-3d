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
  bootLog: string;
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
  loreDesc: string;
  specTelemetry: {
    wingspan: string;
    propulsion: string;
    output: string;
    armorClass: string;
  };
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
  threatTag: string;
  tacticalIntel: string;
  maxHp: number;
  accentColor: string;
  accentHex: number;
  destructibleParts: BossPartSpec[];
}

export const MODEL_ASSETS: Record<ModelKey, ModelAssetSpec> = {
  ship_astra: {
    key: 'ship_astra',
    url: './models/ship_astra.glb',
    bootLog: '[SYNC] X-01 日曜四旋翼穿梭机 · 四联涵道矢量推进阵列校准就绪',
    targetSize: 2.8,
    orientation: { yaw: Math.PI },
  },
  ship_opus: {
    key: 'ship_opus',
    url: './models/ship_opus.glb',
    bootLog: '[SYNC] C-55 铁砧倾转旋翼突击舰 · 倾转短舱与重型偏转护盾充能完毕',
    targetSize: 2.8,
    orientation: { yaw: Math.PI },
  },
  ship_morph: {
    key: 'ship_morph',
    url: './models/ship_morph.glb',
    bootLog: '[SYNC] A-103 苍穹超音速截击机 · 串列座舱、全动翼面与收放起落架自检通过',
    targetSize: 3.35,
    orientation: { yaw: Math.PI },
  },
  ship_aero: {
    key: 'ship_aero',
    url: './models/ship_aero.glb',
    bootLog: '[SYNC] G-08 疾风气动重型战机 · 全动气动舵面与棱镜火控锁定完成',
    targetSize: 3.0,
    orientation: { yaw: Math.PI },
  },
  boss_act1_mech: {
    key: 'boss_act1_mech',
    url: './models/boss_act1_mech.glb',
    bootLog: '[INTEL] 第 1 战区高危目标特征已载入：铁幕四足重炮机甲',
    targetSize: 9.5,
    orientation: { yaw: 0 },
  },
  boss_act2_crab: {
    key: 'boss_act2_crab',
    url: './models/boss_act2_crab.glb',
    bootLog: '[INTEL] 第 2 战区高危目标特征已载入：深渊巨钳螃蟹机甲',
    targetSize: 10.5,
    orientation: { yaw: 0 },
  },
  boss_act3_carrier: {
    key: 'boss_act3_carrier',
    url: './models/boss_act3_carrier.glb',
    bootLog: '[INTEL] 第 3 战区旗舰级目标特征已载入：龙骨桁架星际母舰',
    targetSize: 14.5,
    orientation: { yaw: 0 },
    stripNodes: ['Stand_DisplayBase', 'Stand_Pylons'],
  },
  enemy_drone: {
    key: 'enemy_drone',
    url: './models/enemy_drone.glb',
    bootLog: '[RADAR] 敌方前哨侦察无人机群频段特征已归档',
    targetSize: 2.3,
    orientation: { yaw: 0 },
  },
  enemy_turret: {
    key: 'enemy_turret',
    url: './models/enemy_turret.glb',
    bootLog: '[RADAR] 敌方重装防空炮塔火控特征已归档',
    targetSize: 3.0,
    orientation: { yaw: 0 },
  },
  enemy_rover: {
    key: 'enemy_rover',
    url: './models/enemy_rover.glb',
    bootLog: '[RADAR] 敌方机械臂突击平台信号已归档',
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
    bootLog: '[RADAR] 敌方折翼高速截击机编队特征已归档',
    targetSize: 3.6,
    orientation: { yaw: 0 },
  },
  ally_biplane: {
    key: 'ally_biplane',
    url: './models/ally_biplane.glb',
    bootLog: '[LINK] 无人护航僚机协同数据链握手成功',
    targetSize: 1.55,
    orientation: { yaw: Math.PI },
  },
  prop_city_tile: {
    key: 'prop_city_tile',
    url: './models/prop_city_tile.glb',
    bootLog: '[NAV] 第 1 战区 · 轨道城峡谷三维航道测绘完成',
    targetSize: 18,
    orientation: { yaw: 0 },
  },
  prop_gate: {
    key: 'prop_gate',
    url: './models/prop_gate.glb',
    bootLog: '[NAV] 远距星际跃迁门廊相位信标同步完成',
    targetSize: 44,
    orientation: { yaw: 0 },
  },
};

export const SHIPS: ShipConfig[] = [
  {
    id: 'astra',
    modelKey: 'ship_astra',
    badgeIcon: './ui/icons/badge_astra.png',
    factionTag: '赫利俄斯航宇',
    nameZh: '日曜四旋翼穿梭机',
    codeName: 'X-01',
    roleTag: '均衡激光 · 离子光柱',
    loreDesc:
      '赫利俄斯轨道船坞主力多用途突击穿梭机。四座涵道矢量风扇赋予其极佳的空域机动响应，搭载高能聚变电容，可在危急时刻倾泻贯穿战场的轨道离子光柱。',
    specTelemetry: {
      wingspan: '14.2 m',
      propulsion: '四联矢量涵道风扇',
      output: '4,800 MW',
      armorClass: '中型复合装甲',
    },
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
    factionTag: '伏尔甘重工',
    nameZh: '铁砧倾转旋翼突击舰',
    codeName: 'C-55',
    roleTag: '重盾三联炮 · 弹幕逆转',
    loreDesc:
      '伏尔甘重工专为强袭突破打造的倾转旋翼炮艇。加厚复合装甲与双冗余偏转护盾令其无惧密集防空火力，电磁脉冲核心更可逆转敌军弹幕反噬敌阵。',
    specTelemetry: {
      wingspan: '16.8 m',
      propulsion: '双倾转重型电浆短舱',
      output: '6,200 MW',
      armorClass: '重型反应装甲',
    },
    accentColor: '#00f0ff',
    accentHex: 0x00f0ff,
    engineColor: 0x22d3ee,
    weaponName: '三向扇形电浆炮',
    weaponDesc: '一次倾泻三发高冲击电浆弹幕，倾转旋翼短舱兼顾重甲防御与广域火力压制。',
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
    factionTag: '瓦尔基里特装',
    nameZh: '苍穹超音速截击机',
    codeName: 'A-103',
    roleTag: '全动掠翼 · 极速穿甲',
    loreDesc:
      '瓦尔基里特装局秘密研制的高机动超音速空优截击机，配备串列气泡座舱、可收放三点式起落架与全动副翼尾舵。双联磁轨炮具备原生穿甲贯穿能力，过载时可齐射蜂群追踪导弹清场。',
    specTelemetry: {
      wingspan: '14.8 m',
      propulsion: '双进气矢量加力涡扇',
      output: '5,650 MW',
      armorClass: '钛碳隐身蒙皮',
    },
    accentColor: '#ff4757',
    accentHex: 0xff4757,
    engineColor: 0xff3b5c,
    weaponName: '极速穿甲磁轨双炮',
    weaponDesc: '修长掠翼与高速电磁导轨协同运作，自带穿甲贯穿效能并拥有最短翻滚冷却。',
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
    factionTag: '暴风气动院',
    nameZh: '疾风气动重型战机',
    codeName: 'G-08',
    roleTag: '气动舵面 · 时空缓速',
    loreDesc:
      '搭载实验级时空棱镜核心的高敏锐重型战机。精密气动控制面配合高暴击折射主炮，可在敌群间引发连锁光束弹射，并能展开时空缓速力场主宰战局。',
    specTelemetry: {
      wingspan: '13.9 m',
      propulsion: '全动舵面棱镜引擎',
      output: '5,300 MW',
      armorClass: '棱镜偏转镀层',
    },
    accentColor: '#c084fc',
    accentHex: 0xc084fc,
    engineColor: 0xf97316,
    weaponName: '高暴击折射激光机炮',
    weaponDesc: '全动副翼与升降舵提供凌厉转向，高暴击棱镜激光命中后可自动折射弹射邻近敌机。',
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
    codeName: 'IRONCLAD MK-IV',
    subtitle: '第 1 幕关底 · 轨道城重装防卫要塞',
    threatTag: '威胁 IV 级 · 重装要塞',
    tacticalIntel: '战术弱点：优先摧毁左右肩部重炮，瓦解交叉火力封锁',
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
    codeName: 'ABYSSAL MK-V',
    subtitle: '第 2 幕关底 · 碎星门廊电磁风暴守卫',
    threatTag: '威胁 V 级 · 裂隙机兵',
    tacticalIntel: '战术弱点：集中火力击碎双侧电弧巨钳，阻断高能等离子齐射',
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
    codeName: 'OVERLORD FLAGSHIP',
    subtitle: '第 3 幕终极决战 · 深空封锁舰队旗舰',
    threatTag: '终极威胁 · 封锁旗舰',
    tacticalIntel: '战术弱点：优先击破背脊防空主炮与舰首投射臂，瘫痪舰载机投送',
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
