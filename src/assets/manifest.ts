export type BiomeEnemyKey =
  | 'e1_wasp_dart'
  | 'e1_gyro_rotor'
  | 'e1_sky_jelly'
  | 'e1_lance_bomber'
  | 'e1_aegis_prism'
  | 'e1_valkyrie_mech'
  | 'e2_road_strider'
  | 'e2_siege_tank'
  | 'e2_spider_turret'
  | 'e2_neon_blade'
  | 'e2_riot_enforcer'
  | 'e2_swarmer_pod'
  | 'e3_void_mantis'
  | 'e3_crystal_obelisk'
  | 'e3_hull_crawler'
  | 'e3_rift_frigate'
  | 'e3_grav_ram'
  | 'e3_wraith_frame'
  | 'e4_dune_scorpion'
  | 'e4_sand_juggernaut'
  | 'e4_canyon_walker'
  | 'e4_scarab_drone'
  | 'e4_mirage_wasp'
  | 'e4_solar_obelisk'
  | 'e5_iron_goliath'
  | 'e5_deck_bastion'
  | 'e5_furnace_roller'
  | 'e5_crimson_reaper'
  | 'e5_eclipse_sentinel'
  | 'e5_dread_gunship';

export type EnemyKind = BiomeEnemyKey;

export type ModelKey =
  | 'ship_astra'
  | 'ship_opus'
  | 'ship_morph'
  | 'ship_aero'
  | 'boss_act1_skywing'
  | 'boss_act1_mech'
  | 'boss_act2_crab'
  | 'boss_act4_scarab'
  | 'boss_act3_carrier'
  | BiomeEnemyKey
  | 'ally_biplane'
  | 'pickup_repair'
  | 'pickup_energy'
  | 'prop_gate';

export type EnemyLocomotion = 'air' | 'hover' | 'ground';
export type EnemyFirePattern = 'single' | 'twin' | 'spread3' | 'heavy' | 'burst' | 'radial4';

export interface EnemyRosterSpec {
  key: EnemyKind;
  act: 1 | 2 | 3 | 4 | 5;
  nameZh: string;
  archetype: 'interceptor' | 'gunship' | 'turret' | 'walker' | 'tank' | 'mech';
  locomotion: EnemyLocomotion;
  baseHp: number;
  hitRadius: number;
  scoreValue: number;
  targetZ: number;
  isElite: boolean;
  weight: number;
  cap: number;
  firePattern: EnemyFirePattern;
  fireInterval: number;
  bulletSpeed: number;
  bulletDamage: number;
  bulletColor: number;
}

export type ShipId = 'astra' | 'opus' | 'morph' | 'aero';
export type BossId = 'act1' | 'act2' | 'act3' | 'act4' | 'act5';

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
  weaponEffectKey:
    | 'leftWingPod'
    | 'rightWingPod'
    | 'leftCannon'
    | 'rightCannon'
    | 'leftClaw'
    | 'rightClaw'
    | 'leftSolarCannon'
    | 'rightSolarCannon'
    | 'dorsalTurret'
    | 'bowCrane';
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
    bootLog: '[SYNC] A-103 苍穹可变翼截击舰 · 15 骨骼可变掠翼与双联磁轨武装校准就绪',
    targetSize: 3.45,
    orientation: { yaw: 0 },
  },
  ship_aero: {
    key: 'ship_aero',
    url: './models/ship_aero.glb',
    bootLog: '[SYNC] G-08 疾风气动重型战机 · 全动气动舵面与棱镜火控锁定完成',
    targetSize: 3.0,
    orientation: { yaw: Math.PI },
  },
  boss_act1_skywing: {
    key: 'boss_act1_skywing',
    url: './models/enemy_foldwing.glb',
    bootLog: '[INTEL] 第 1 战区高空指挥目标特征已载入：云穹折翼指挥舰',
    targetSize: 12.4,
    orientation: { yaw: 0 },
    stripNodes: [
      'LandingGear_Main_L',
      'LandingGear_Main_R',
      'LandingGear_Tail',
      'Wheel_Main_L',
      'Wheel_Main_R',
      'Wheel_Tail',
    ],
  },
  boss_act1_mech: {
    key: 'boss_act1_mech',
    url: './models/boss_act1_mech.glb',
    bootLog: '[INTEL] 第 2 战区高危目标特征已载入：铁幕四足重炮机甲',
    targetSize: 9.5,
    orientation: { yaw: 0 },
  },
  boss_act2_crab: {
    key: 'boss_act2_crab',
    url: './models/boss_act2_crab.glb',
    bootLog: '[INTEL] 第 3 战区高危目标特征已载入：深渊巨钳螃蟹机甲',
    targetSize: 10.5,
    orientation: { yaw: 0 },
  },
  boss_act4_scarab: {
    key: 'boss_act4_scarab',
    url: './models/boss_act4_scarab.glb',
    bootLog: '[INTEL] 第 4 战区烈阳沙暴堡垒特征已载入：日冕圣甲虫悬浮堡垒',
    targetSize: 12.2,
    orientation: { yaw: 0 },
  },
  boss_act3_carrier: {
    key: 'boss_act3_carrier',
    url: './models/boss_act3_carrier.glb',
    bootLog: '[INTEL] 第 5 战区旗舰级目标特征已载入：龙骨桁架星际母舰',
    targetSize: 14.5,
    orientation: { yaw: 0 },
    stripNodes: ['Stand_DisplayBase', 'Stand_Pylons'],
  },
  // ==================== ACT 1: Stratosphere Cloudfront (01-06) ====================
  e1_wasp_dart: {
    key: 'e1_wasp_dart',
    url: './models/e1_wasp_dart.glb',
    bootLog: '[RADAR] ACT 1 蜂刺高速截击机气动特征归档',
    targetSize: 2.9,
    orientation: { yaw: 0 },
  },
  e1_gyro_rotor: {
    key: 'e1_gyro_rotor',
    url: './models/e1_gyro_rotor.glb',
    bootLog: '[RADAR] ACT 1 云穹双旋翼武装艇旋翼频谱归档',
    targetSize: 3.2,
    orientation: { yaw: 0 },
  },
  e1_sky_jelly: {
    key: 'e1_sky_jelly',
    url: './models/e1_sky_jelly.glb',
    bootLog: '[RADAR] ACT 1 高空电离浮空雷母电磁特征归档',
    targetSize: 2.9,
    orientation: { yaw: 0 },
  },
  e1_lance_bomber: {
    key: 'e1_lance_bomber',
    url: './models/e1_lance_bomber.glb',
    bootLog: '[RADAR] ACT 1 云层双体投弹艇重型信号归档',
    targetSize: 3.8,
    orientation: { yaw: 0 },
  },
  e1_aegis_prism: {
    key: 'e1_aegis_prism',
    url: './models/e1_aegis_prism.glb',
    bootLog: '[RADAR] ACT 1 平流层折光护盾蜂频段归档',
    targetSize: 3.1,
    orientation: { yaw: 0 },
  },
  e1_valkyrie_mech: {
    key: 'e1_valkyrie_mech',
    url: './models/e1_valkyrie_mech.glb',
    bootLog: '[RADAR] ACT 1 空降喷射突击机甲火控特征归档',
    targetSize: 3.5,
    orientation: { yaw: 0 },
  },
  // ==================== ACT 2: Orbital Metropolis (07-12) ====================
  e2_road_strider: {
    key: 'e2_road_strider',
    url: './models/e2_road_strider.glb',
    bootLog: '[RADAR] ACT 2 霓虹双足巡逻机甲步态特征归档',
    targetSize: 3.3,
    orientation: { yaw: 0 },
  },
  e2_siege_tank: {
    key: 'e2_siege_tank',
    url: './models/e2_siege_tank.glb',
    bootLog: '[RADAR] ACT 2 轨道磁轨履带战车重甲信号归档',
    targetSize: 3.6,
    orientation: { yaw: 0 },
  },
  e2_spider_turret: {
    key: 'e2_spider_turret',
    url: './models/e2_spider_turret.glb',
    bootLog: '[RADAR] ACT 2 四足防空自走炮台火控特征归档',
    targetSize: 3.5,
    orientation: { yaw: 0 },
  },
  e2_neon_blade: {
    key: 'e2_neon_blade',
    url: './models/e2_neon_blade.glb',
    bootLog: '[RADAR] ACT 2 都市前掠翼拦截机隐身特征归档',
    targetSize: 3.1,
    orientation: { yaw: 0 },
  },
  e2_riot_enforcer: {
    key: 'e2_riot_enforcer',
    url: './models/e2_riot_enforcer.glb',
    bootLog: '[RADAR] ACT 2 重装盾牌悬浮执法机信号归档',
    targetSize: 3.5,
    orientation: { yaw: 0 },
  },
  e2_swarmer_pod: {
    key: 'e2_swarmer_pod',
    url: './models/e2_swarmer_pod.glb',
    bootLog: '[RADAR] ACT 2 蜂巢战术无人机母舱信号归档',
    targetSize: 3.3,
    orientation: { yaw: 0 },
  },
  // ==================== ACT 3: Fractured Warp Gateway (13-18) ====================
  e3_void_mantis: {
    key: 'e3_void_mantis',
    url: './models/e3_void_mantis.glb',
    bootLog: '[RADAR] ACT 3 虚空镰翼猎杀机相位特征归档',
    targetSize: 3.3,
    orientation: { yaw: 0 },
  },
  e3_crystal_obelisk: {
    key: 'e3_crystal_obelisk',
    url: './models/e3_crystal_obelisk.glb',
    bootLog: '[RADAR] ACT 3 棱镜跃迁炮塔阵列频谱归档',
    targetSize: 3.3,
    orientation: { yaw: 0 },
  },
  e3_hull_crawler: {
    key: 'e3_hull_crawler',
    url: './models/e3_hull_crawler.glb',
    bootLog: '[RADAR] ACT 3 星骸六足攀附工兵蛛特征归档',
    targetSize: 3.6,
    orientation: { yaw: 0 },
  },
  e3_rift_frigate: {
    key: 'e3_rift_frigate',
    url: './models/e3_rift_frigate.glb',
    bootLog: '[RADAR] ACT 3 裂隙重型炮艇舰体特征归档',
    targetSize: 3.9,
    orientation: { yaw: 0 },
  },
  e3_grav_ram: {
    key: 'e3_grav_ram',
    url: './models/e3_grav_ram.glb',
    bootLog: '[RADAR] ACT 3 引力冲撞球形机雷质量场归档',
    targetSize: 3.0,
    orientation: { yaw: 0 },
  },
  e3_wraith_frame: {
    key: 'e3_wraith_frame',
    url: './models/e3_wraith_frame.glb',
    bootLog: '[RADAR] ACT 3 相位幽灵机动装甲浮游信号归档',
    targetSize: 3.6,
    orientation: { yaw: 0 },
  },
  // ==================== ACT 4: Solar Canyon Sandstorm (19-24) ====================
  e4_dune_scorpion: {
    key: 'e4_dune_scorpion',
    url: './models/e4_dune_scorpion.glb',
    bootLog: '[RADAR] ACT 4 沙暴重装甲蝎战车热源特征归档',
    targetSize: 3.6,
    orientation: { yaw: 0 },
  },
  e4_sand_juggernaut: {
    key: 'e4_sand_juggernaut',
    url: './models/e4_sand_juggernaut.glb',
    bootLog: '[RADAR] ACT 4 烈阳履带重炮突击车特征归档',
    targetSize: 3.9,
    orientation: { yaw: 0 },
  },
  e4_canyon_walker: {
    key: 'e4_canyon_walker',
    url: './models/e4_canyon_walker.glb',
    bootLog: '[RADAR] ACT 4 峡谷双足沙暴机甲火控特征归档',
    targetSize: 3.5,
    orientation: { yaw: 0 },
  },
  e4_scarab_drone: {
    key: 'e4_scarab_drone',
    url: './models/e4_scarab_drone.glb',
    bootLog: '[RADAR] ACT 4 日冕聚光碟形侦察机特征归档',
    targetSize: 3.0,
    orientation: { yaw: 0 },
  },
  e4_mirage_wasp: {
    key: 'e4_mirage_wasp',
    url: './models/e4_mirage_wasp.glb',
    bootLog: '[RADAR] ACT 4 沙尘喷气低空攻击机特征归档',
    targetSize: 3.3,
    orientation: { yaw: 0 },
  },
  e4_solar_obelisk: {
    key: 'e4_solar_obelisk',
    url: './models/e4_solar_obelisk.glb',
    bootLog: '[RADAR] ACT 4 烈阳浮空聚光炮台热能归档',
    targetSize: 3.4,
    orientation: { yaw: 0 },
  },
  // ==================== ACT 5: Crimson Dreadnought Citadel (25-30) ====================
  e5_iron_goliath: {
    key: 'e5_iron_goliath',
    url: './models/e5_iron_goliath.glb',
    bootLog: '[RADAR] ACT 5 猩红重装攻城泰坦核心特征归档',
    targetSize: 3.9,
    orientation: { yaw: 0 },
  },
  e5_deck_bastion: {
    key: 'e5_deck_bastion',
    url: './models/e5_deck_bastion.glb',
    bootLog: '[RADAR] ACT 5 甲板四足重型移动堡垒归档',
    targetSize: 3.9,
    orientation: { yaw: 0 },
  },
  e5_furnace_roller: {
    key: 'e5_furnace_roller',
    url: './models/e5_furnace_roller.glb',
    bootLog: '[RADAR] ACT 5 熔炉履带破阵战车装甲特征归档',
    targetSize: 3.8,
    orientation: { yaw: 0 },
  },
  e5_crimson_reaper: {
    key: 'e5_crimson_reaper',
    url: './models/e5_crimson_reaper.glb',
    bootLog: '[RADAR] ACT 5 帝国猩红双翼死神机信号归档',
    targetSize: 3.3,
    orientation: { yaw: 0 },
  },
  e5_eclipse_sentinel: {
    key: 'e5_eclipse_sentinel',
    url: './models/e5_eclipse_sentinel.glb',
    bootLog: '[RADAR] ACT 5 黑洞奇点浮游卫士引力特征归档',
    targetSize: 3.4,
    orientation: { yaw: 0 },
  },
  e5_dread_gunship: {
    key: 'e5_dread_gunship',
    url: './models/e5_dread_gunship.glb',
    bootLog: '[RADAR] ACT 5 母舰重型炮击驱逐艇特征归档',
    targetSize: 4.1,
    orientation: { yaw: 0 },
  },
  ally_biplane: {
    key: 'ally_biplane',
    url: './models/ally_biplane.glb',
    bootLog: '[LINK] 无人护航僚机协同数据链握手成功',
    targetSize: 1.55,
    orientation: { yaw: Math.PI },
  },
  pickup_repair: {
    key: 'pickup_repair',
    url: './models/pickup_repair.glb',
    bootLog: '[SUPPLY] 纳米装甲修复舱模块校验就绪',
    targetSize: 2.05,
    orientation: { yaw: 0 },
  },
  pickup_energy: {
    key: 'pickup_energy',
    url: './models/pickup_energy.glb',
    bootLog: '[SUPPLY] 量子超频核心补给单元校验就绪',
    targetSize: 2.15,
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
    badgeIcon: './ui/icons/badge_astra.webp',
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
    badgeIcon: './ui/icons/badge_opus.webp',
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
    badgeIcon: './ui/icons/badge_morph.webp',
    factionTag: '瓦尔基里特装',
    nameZh: '苍穹可变翼截击舰',
    codeName: 'A-103',
    roleTag: '可变掠翼 · 极速穿甲',
    loreDesc:
      '瓦尔基里特装局定制研发的新一代可变掠翼空优截击舰，采用 15 骨骼联动机构实现后掠三角翼变形、翼尖折翼稳定舵、开启式座舱与背脊蜂群导弹舱。双联磁轨炮具备原生穿甲贯穿效能，过载时可齐射蜂群追踪导弹清场。',
    specTelemetry: {
      wingspan: '14.8 m',
      propulsion: '双联矢量等离子加力引擎',
      output: '5,650 MW',
      armorClass: '钛银碳纤维复合装甲',
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
    badgeIcon: './ui/icons/badge_aero.webp',
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
    modelKey: 'boss_act1_skywing',
    nameZh: '云穹折翼指挥舰',
    codeName: 'SKYWARD VALKYRIE',
    subtitle: '第 1 幕关底 · 平流层空优突击指挥舰',
    threatTag: '威胁 III 级 · 苍穹指挥舰',
    tacticalIntel: '战术弱点：优先击毁左右折翼涡轮核，瓦解高速扇形电浆齐射',
    maxHp: 820,
    accentColor: '#38e8ff',
    accentHex: 0x38e8ff,
    destructibleParts: [
      {
        id: 'wing_pod_l',
        nodeName: 'BossWingPod_L',
        labelZh: '左折翼涡轮核',
        hp: 200,
        hitRadius: 2.35,
        weaponEffectKey: 'leftWingPod',
      },
      {
        id: 'wing_pod_r',
        nodeName: 'BossWingPod_R',
        labelZh: '右折翼涡轮核',
        hp: 200,
        hitRadius: 2.35,
        weaponEffectKey: 'rightWingPod',
      },
    ],
  },
  act2: {
    id: 'act2',
    act: 2,
    modelKey: 'boss_act1_mech',
    nameZh: '铁幕四足重炮机甲',
    codeName: 'IRONCLAD MK-IV',
    subtitle: '第 2 幕关底 · 轨道城重装防卫要塞',
    threatTag: '威胁 IV 级 · 重装要塞',
    tacticalIntel: '战术弱点：优先摧毁左右肩部重炮，瓦解交叉火力封锁',
    maxHp: 1120,
    accentColor: '#ff9f43',
    accentHex: 0xff9f43,
    destructibleParts: [
      {
        id: 'cannon_l',
        nodeName: 'Cannon_L',
        labelZh: '左肩重炮',
        hp: 250,
        hitRadius: 1.9,
        weaponEffectKey: 'leftCannon',
      },
      {
        id: 'cannon_r',
        nodeName: 'Cannon_R',
        labelZh: '右肩重炮',
        hp: 250,
        hitRadius: 1.9,
        weaponEffectKey: 'rightCannon',
      },
    ],
  },
  act3: {
    id: 'act3',
    act: 3,
    modelKey: 'boss_act2_crab',
    nameZh: '深渊巨钳螃蟹机甲',
    codeName: 'ABYSSAL MK-V',
    subtitle: '第 3 幕关底 · 碎星门廊电磁风暴守卫',
    threatTag: '威胁 V 级 · 裂隙机兵',
    tacticalIntel: '战术弱点：集中火力击碎双侧电弧巨钳，阻断高能等离子齐射',
    maxHp: 1650,
    accentColor: '#00f0ff',
    accentHex: 0x00f0ff,
    destructibleParts: [
      {
        id: 'claw_l',
        nodeName: 'Claw_L',
        labelZh: '左电弧巨钳',
        hp: 360,
        hitRadius: 2.3,
        weaponEffectKey: 'leftClaw',
      },
      {
        id: 'claw_r',
        nodeName: 'Claw_R',
        labelZh: '右电弧巨钳',
        hp: 360,
        hitRadius: 2.3,
        weaponEffectKey: 'rightClaw',
      },
    ],
  },
  act4: {
    id: 'act4',
    act: 4,
    modelKey: 'boss_act4_scarab',
    nameZh: '日冕圣甲虫悬浮堡垒',
    codeName: 'SOLAR SCARAB',
    subtitle: '第 4 幕关底 · 烈阳沙暴聚光峡谷守卫',
    threatTag: '威胁 VI 级 · 烈阳堡垒',
    tacticalIntel: '战术弱点：优先摧毁左右日冕聚光炮，瓦解双联高能电浆齐射',
    maxHp: 2150,
    accentColor: '#ffb326',
    accentHex: 0xffb326,
    destructibleParts: [
      {
        id: 'solar_cannon_l',
        nodeName: 'SolarCannon_L',
        labelZh: '左日冕聚光炮',
        hp: 430,
        hitRadius: 2.35,
        weaponEffectKey: 'leftSolarCannon',
      },
      {
        id: 'solar_cannon_r',
        nodeName: 'SolarCannon_R',
        labelZh: '右日冕聚光炮',
        hp: 430,
        hitRadius: 2.35,
        weaponEffectKey: 'rightSolarCannon',
      },
    ],
  },
  act5: {
    id: 'act5',
    act: 5,
    modelKey: 'boss_act3_carrier',
    nameZh: '龙骨桁架星际母舰',
    codeName: 'OVERLORD FLAGSHIP',
    subtitle: '第 5 幕终极决战 · 深空封锁舰队旗舰',
    threatTag: '终极威胁 · 封锁旗舰',
    tacticalIntel: '战术弱点：优先击破背脊防空主炮与舰首投射臂，瘫痪舰载机投送',
    maxHp: 2680,
    accentColor: '#ff4757',
    accentHex: 0xff4757,
    destructibleParts: [
      {
        id: 'dorsal_turret',
        nodeName: 'DorsalTurret',
        labelZh: '背脊防空主炮',
        hp: 490,
        hitRadius: 2.5,
        weaponEffectKey: 'dorsalTurret',
      },
      {
        id: 'bow_crane',
        nodeName: 'BowCraneArms',
        labelZh: '舰首投射臂',
        hp: 440,
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
    titleZh: 'ACT I · 平流层云海空域',
    subtitle: 'STRATOSPHERE CLOUDFRONT',
    fogColor: 0x0a1e3e,
    bgColor: 0x07152e,
    gridColor: 0x164e63,
    accentColor: 0x38e8ff,
  },
  {
    act: 2,
    titleZh: 'ACT II · 轨道城峡谷',
    subtitle: 'ORBITAL METROPOLIS CORRIDOR',
    fogColor: 0x0d2847,
    bgColor: 0x0a1e38,
    gridColor: 0x164e63,
    accentColor: 0x00f0ff,
  },
  {
    act: 3,
    titleZh: 'ACT III · 碎星跃迁门廊',
    subtitle: 'FRACTURED WARP GATEWAY',
    fogColor: 0x18133d,
    bgColor: 0x110d2e,
    gridColor: 0x581c87,
    accentColor: 0xc084fc,
  },
  {
    act: 4,
    titleZh: 'ACT IV · 烈阳沙暴峡谷',
    subtitle: 'SOLAR CANYON SANDSTORM',
    fogColor: 0x3a2314,
    bgColor: 0x1e130c,
    gridColor: 0xd97706,
    accentColor: 0xffb326,
  },
  {
    act: 5,
    titleZh: 'ACT V · 龙骨母舰空域',
    subtitle: 'CRIMSON DREADNOUGHT CITADEL',
    fogColor: 0x2d0f16,
    bgColor: 0x21090e,
    gridColor: 0x7f1d1d,
    accentColor: 0xff4757,
  },
];

export const ACT_ENEMY_POOLS: Record<1 | 2 | 3 | 4 | 5, BiomeEnemyKey[]> = {
  1: ['e1_wasp_dart', 'e1_gyro_rotor', 'e1_sky_jelly', 'e1_lance_bomber', 'e1_aegis_prism', 'e1_valkyrie_mech'],
  2: ['e2_road_strider', 'e2_siege_tank', 'e2_spider_turret', 'e2_neon_blade', 'e2_riot_enforcer', 'e2_swarmer_pod'],
  3: ['e3_void_mantis', 'e3_crystal_obelisk', 'e3_hull_crawler', 'e3_rift_frigate', 'e3_grav_ram', 'e3_wraith_frame'],
  4: ['e4_dune_scorpion', 'e4_sand_juggernaut', 'e4_canyon_walker', 'e4_scarab_drone', 'e4_mirage_wasp', 'e4_solar_obelisk'],
  5: ['e5_iron_goliath', 'e5_deck_bastion', 'e5_furnace_roller', 'e5_crimson_reaper', 'e5_eclipse_sentinel', 'e5_dread_gunship'],
};

export const ENEMY_ROSTER: Record<EnemyKind, EnemyRosterSpec> = {
  // ACT 1: Stratosphere Cloudfront (01-06)
  e1_wasp_dart: {
    key: 'e1_wasp_dart', act: 1, nameZh: '蜂刺高速截击机', archetype: 'interceptor', locomotion: 'air',
    baseHp: 46, hitRadius: 1.85, scoreValue: 125, targetZ: -25, isElite: false, weight: 3, cap: 4,
    firePattern: 'single', fireInterval: 2.25, bulletSpeed: 31, bulletDamage: 10, bulletColor: 0x38e8ff,
  },
  e1_gyro_rotor: {
    key: 'e1_gyro_rotor', act: 1, nameZh: '云穹双旋翼武装艇', archetype: 'gunship', locomotion: 'hover',
    baseHp: 72, hitRadius: 2.1, scoreValue: 175, targetZ: -27, isElite: false, weight: 3, cap: 4,
    firePattern: 'twin', fireInterval: 2.3, bulletSpeed: 28, bulletDamage: 11, bulletColor: 0x38e8ff,
  },
  e1_sky_jelly: {
    key: 'e1_sky_jelly', act: 1, nameZh: '高空电离浮空雷母', archetype: 'turret', locomotion: 'hover',
    baseHp: 68, hitRadius: 2.0, scoreValue: 170, targetZ: -30, isElite: false, weight: 2, cap: 3,
    firePattern: 'spread3', fireInterval: 2.6, bulletSpeed: 26, bulletDamage: 11, bulletColor: 0x67e8f9,
  },
  e1_lance_bomber: {
    key: 'e1_lance_bomber', act: 1, nameZh: '云层双体投弹艇', archetype: 'gunship', locomotion: 'hover',
    baseHp: 110, hitRadius: 2.45, scoreValue: 250, targetZ: -31, isElite: true, weight: 2, cap: 3,
    firePattern: 'heavy', fireInterval: 2.45, bulletSpeed: 27, bulletDamage: 14, bulletColor: 0xffb347,
  },
  e1_aegis_prism: {
    key: 'e1_aegis_prism', act: 1, nameZh: '平流层折光护盾蜂', archetype: 'turret', locomotion: 'hover',
    baseHp: 92, hitRadius: 2.15, scoreValue: 215, targetZ: -28, isElite: true, weight: 2, cap: 3,
    firePattern: 'twin', fireInterval: 2.2, bulletSpeed: 32, bulletDamage: 12, bulletColor: 0x38e8ff,
  },
  e1_valkyrie_mech: {
    key: 'e1_valkyrie_mech', act: 1, nameZh: '空降喷射突击机甲', archetype: 'mech', locomotion: 'air',
    baseHp: 98, hitRadius: 2.25, scoreValue: 265, targetZ: -26, isElite: true, weight: 2, cap: 3,
    firePattern: 'burst', fireInterval: 2.05, bulletSpeed: 34, bulletDamage: 12, bulletColor: 0xffa73b,
  },

  // ACT 2: Orbital Metropolis (07-12)
  e2_road_strider: {
    key: 'e2_road_strider', act: 2, nameZh: '霓虹双足巡逻机甲', archetype: 'walker', locomotion: 'ground',
    baseHp: 78, hitRadius: 2.15, scoreValue: 185, targetZ: -24, isElite: false, weight: 3, cap: 4,
    firePattern: 'burst', fireInterval: 2.15, bulletSpeed: 30, bulletDamage: 12, bulletColor: 0x00f0ff,
  },
  e2_siege_tank: {
    key: 'e2_siege_tank', act: 2, nameZh: '轨道磁轨履带战车', archetype: 'tank', locomotion: 'ground',
    baseHp: 132, hitRadius: 2.45, scoreValue: 295, targetZ: -26, isElite: true, weight: 2, cap: 3,
    firePattern: 'twin', fireInterval: 2.35, bulletSpeed: 36, bulletDamage: 15, bulletColor: 0x00f0ff,
  },
  e2_spider_turret: {
    key: 'e2_spider_turret', act: 2, nameZh: '四足防空自走炮台', archetype: 'walker', locomotion: 'ground',
    baseHp: 112, hitRadius: 2.35, scoreValue: 260, targetZ: -27, isElite: true, weight: 2, cap: 3,
    firePattern: 'spread3', fireInterval: 2.4, bulletSpeed: 30, bulletDamage: 13, bulletColor: 0xff2ea6,
  },
  e2_neon_blade: {
    key: 'e2_neon_blade', act: 2, nameZh: '都市前掠翼拦截机', archetype: 'interceptor', locomotion: 'air',
    baseHp: 64, hitRadius: 1.95, scoreValue: 165, targetZ: -27, isElite: false, weight: 3, cap: 4,
    firePattern: 'twin', fireInterval: 1.95, bulletSpeed: 36, bulletDamage: 11, bulletColor: 0xff2ea6,
  },
  e2_riot_enforcer: {
    key: 'e2_riot_enforcer', act: 2, nameZh: '重装盾牌悬浮执法机', archetype: 'mech', locomotion: 'hover',
    baseHp: 126, hitRadius: 2.35, scoreValue: 285, targetZ: -24, isElite: true, weight: 2, cap: 3,
    firePattern: 'spread3', fireInterval: 2.45, bulletSpeed: 28, bulletDamage: 14, bulletColor: 0x00f0ff,
  },
  e2_swarmer_pod: {
    key: 'e2_swarmer_pod', act: 2, nameZh: '蜂巢战术无人机母舱', archetype: 'gunship', locomotion: 'hover',
    baseHp: 96, hitRadius: 2.25, scoreValue: 225, targetZ: -31, isElite: false, weight: 2, cap: 3,
    firePattern: 'radial4', fireInterval: 2.65, bulletSpeed: 27, bulletDamage: 12, bulletColor: 0xff2ea6,
  },

  // ACT 3: Fractured Warp Gateway (13-18)
  e3_void_mantis: {
    key: 'e3_void_mantis', act: 3, nameZh: '虚空镰翼猎杀机', archetype: 'interceptor', locomotion: 'air',
    baseHp: 74, hitRadius: 2.05, scoreValue: 195, targetZ: -26, isElite: false, weight: 3, cap: 4,
    firePattern: 'twin', fireInterval: 1.95, bulletSpeed: 37, bulletDamage: 13, bulletColor: 0xc084fc,
  },
  e3_crystal_obelisk: {
    key: 'e3_crystal_obelisk', act: 3, nameZh: '棱镜跃迁炮塔阵列', archetype: 'turret', locomotion: 'hover',
    baseHp: 108, hitRadius: 2.25, scoreValue: 255, targetZ: -31, isElite: true, weight: 2, cap: 3,
    firePattern: 'radial4', fireInterval: 2.55, bulletSpeed: 29, bulletDamage: 13, bulletColor: 0xe879f9,
  },
  e3_hull_crawler: {
    key: 'e3_hull_crawler', act: 3, nameZh: '星骸六足攀附工兵蛛', archetype: 'walker', locomotion: 'ground',
    baseHp: 118, hitRadius: 2.4, scoreValue: 275, targetZ: -25, isElite: true, weight: 2, cap: 3,
    firePattern: 'heavy', fireInterval: 2.25, bulletSpeed: 32, bulletDamage: 16, bulletColor: 0xc084fc,
  },
  e3_rift_frigate: {
    key: 'e3_rift_frigate', act: 3, nameZh: '裂隙重型炮艇', archetype: 'gunship', locomotion: 'hover',
    baseHp: 142, hitRadius: 2.55, scoreValue: 325, targetZ: -32, isElite: true, weight: 2, cap: 3,
    firePattern: 'spread3', fireInterval: 2.35, bulletSpeed: 31, bulletDamage: 15, bulletColor: 0xa855f7,
  },
  e3_grav_ram: {
    key: 'e3_grav_ram', act: 3, nameZh: '引力冲撞球形机雷', archetype: 'turret', locomotion: 'hover',
    baseHp: 94, hitRadius: 2.15, scoreValue: 220, targetZ: -23, isElite: false, weight: 3, cap: 4,
    firePattern: 'radial4', fireInterval: 2.4, bulletSpeed: 28, bulletDamage: 14, bulletColor: 0xe879f9,
  },
  e3_wraith_frame: {
    key: 'e3_wraith_frame', act: 3, nameZh: '相位幽灵机动装甲', archetype: 'mech', locomotion: 'air',
    baseHp: 124, hitRadius: 2.3, scoreValue: 315, targetZ: -27, isElite: true, weight: 2, cap: 3,
    firePattern: 'burst', fireInterval: 1.9, bulletSpeed: 38, bulletDamage: 14, bulletColor: 0xc084fc,
  },

  // ACT 4: Solar Canyon Sandstorm (19-24)
  e4_dune_scorpion: {
    key: 'e4_dune_scorpion', act: 4, nameZh: '沙暴重装甲蝎战车', archetype: 'walker', locomotion: 'ground',
    baseHp: 126, hitRadius: 2.4, scoreValue: 300, targetZ: -25, isElite: true, weight: 2, cap: 3,
    firePattern: 'heavy', fireInterval: 2.2, bulletSpeed: 33, bulletDamage: 17, bulletColor: 0xffb326,
  },
  e4_sand_juggernaut: {
    key: 'e4_sand_juggernaut', act: 4, nameZh: '烈阳履带重炮突击车', archetype: 'tank', locomotion: 'ground',
    baseHp: 154, hitRadius: 2.6, scoreValue: 350, targetZ: -27, isElite: true, weight: 2, cap: 3,
    firePattern: 'twin', fireInterval: 2.3, bulletSpeed: 34, bulletDamage: 17, bulletColor: 0xff7b26,
  },
  e4_canyon_walker: {
    key: 'e4_canyon_walker', act: 4, nameZh: '峡谷双足沙暴机甲', archetype: 'walker', locomotion: 'ground',
    baseHp: 114, hitRadius: 2.3, scoreValue: 270, targetZ: -24, isElite: false, weight: 3, cap: 4,
    firePattern: 'burst', fireInterval: 2.05, bulletSpeed: 32, bulletDamage: 13, bulletColor: 0xffb326,
  },
  e4_scarab_drone: {
    key: 'e4_scarab_drone', act: 4, nameZh: '日冕聚光碟形侦察机', archetype: 'interceptor', locomotion: 'air',
    baseHp: 78, hitRadius: 2.0, scoreValue: 205, targetZ: -26, isElite: false, weight: 3, cap: 4,
    firePattern: 'spread3', fireInterval: 2.25, bulletSpeed: 33, bulletDamage: 13, bulletColor: 0xffd15c,
  },
  e4_mirage_wasp: {
    key: 'e4_mirage_wasp', act: 4, nameZh: '沙尘喷气低空攻击机', archetype: 'gunship', locomotion: 'hover',
    baseHp: 102, hitRadius: 2.2, scoreValue: 245, targetZ: -28, isElite: false, weight: 2, cap: 3,
    firePattern: 'twin', fireInterval: 2.0, bulletSpeed: 35, bulletDamage: 14, bulletColor: 0xff8c26,
  },
  e4_solar_obelisk: {
    key: 'e4_solar_obelisk', act: 4, nameZh: '烈阳浮空聚光炮台', archetype: 'turret', locomotion: 'hover',
    baseHp: 122, hitRadius: 2.3, scoreValue: 285, targetZ: -32, isElite: true, weight: 2, cap: 3,
    firePattern: 'radial4', fireInterval: 2.45, bulletSpeed: 31, bulletDamage: 15, bulletColor: 0xffb326,
  },

  // ACT 5: Crimson Dreadnought Citadel (25-30)
  e5_iron_goliath: {
    key: 'e5_iron_goliath', act: 5, nameZh: '猩红重装攻城泰坦', archetype: 'mech', locomotion: 'ground',
    baseHp: 162, hitRadius: 2.6, scoreValue: 375, targetZ: -24, isElite: true, weight: 2, cap: 3,
    firePattern: 'spread3', fireInterval: 2.15, bulletSpeed: 33, bulletDamage: 17, bulletColor: 0xff4757,
  },
  e5_deck_bastion: {
    key: 'e5_deck_bastion', act: 5, nameZh: '甲板四足重型移动堡垒', archetype: 'walker', locomotion: 'ground',
    baseHp: 158, hitRadius: 2.6, scoreValue: 365, targetZ: -27, isElite: true, weight: 2, cap: 3,
    firePattern: 'twin', fireInterval: 2.2, bulletSpeed: 36, bulletDamage: 18, bulletColor: 0xff3b3b,
  },
  e5_furnace_roller: {
    key: 'e5_furnace_roller', act: 5, nameZh: '熔炉履带破阵战车', archetype: 'tank', locomotion: 'ground',
    baseHp: 148, hitRadius: 2.5, scoreValue: 345, targetZ: -24, isElite: false, weight: 3, cap: 4,
    firePattern: 'heavy', fireInterval: 2.1, bulletSpeed: 35, bulletDamage: 18, bulletColor: 0xff7b26,
  },
  e5_crimson_reaper: {
    key: 'e5_crimson_reaper', act: 5, nameZh: '帝国猩红双翼死神机', archetype: 'interceptor', locomotion: 'air',
    baseHp: 92, hitRadius: 2.1, scoreValue: 245, targetZ: -27, isElite: false, weight: 3, cap: 4,
    firePattern: 'burst', fireInterval: 1.85, bulletSpeed: 39, bulletDamage: 14, bulletColor: 0xff3b3b,
  },
  e5_eclipse_sentinel: {
    key: 'e5_eclipse_sentinel', act: 5, nameZh: '黑洞奇点浮游卫士', archetype: 'turret', locomotion: 'hover',
    baseHp: 136, hitRadius: 2.35, scoreValue: 330, targetZ: -30, isElite: true, weight: 2, cap: 3,
    firePattern: 'radial4', fireInterval: 2.25, bulletSpeed: 32, bulletDamage: 16, bulletColor: 0xff5a26,
  },
  e5_dread_gunship: {
    key: 'e5_dread_gunship', act: 5, nameZh: '母舰重型炮击驱逐艇', archetype: 'gunship', locomotion: 'hover',
    baseHp: 168, hitRadius: 2.7, scoreValue: 390, targetZ: -33, isElite: true, weight: 2, cap: 3,
    firePattern: 'spread3', fireInterval: 2.25, bulletSpeed: 34, bulletDamage: 17, bulletColor: 0xff4757,
  },
};
