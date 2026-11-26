import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  deinterleaveGeometry,
  mergeGeometries,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODEL_ASSETS, type ModelKey } from '../assets/manifest';

export interface ModelLoadProgress {
  loaded: number;
  total: number;
  percent: number;
  key?: ModelKey;
  triangles?: number;
  drawCallsBefore?: number;
  drawCallsAfter?: number;
  message: string;
}

export interface LoadedModelPrototype {
  key: ModelKey;
  prototype: THREE.Group;
  animations: THREE.AnimationClip[];
  triangles: number;
  drawCallsBefore: number;
  drawCallsAfter: number;
  boundingSize: THREE.Vector3;
}

export interface PooledModelInstance {
  key: ModelKey;
  root: THREE.Group;
  modelRoot: THREE.Object3D;
  animations: THREE.AnimationClip[];
  materials: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
  baseEmissiveIntensities: number[];
}

const BATCH_WHITELIST = new Set<ModelKey>([
  'pickup_repair',
  'pickup_energy',
  'enemy_foldwing',
  'boss_act1_skywing',
  'ship_astra',
]);

const DYNAMIC_NODE_KEYWORDS = [
  'rotor_',
  'turbine_',
  'landing_skid',
  'cockpit_canopy',
  'front wing',
  'rear wing',
  'propeller',
  'wingfold_pivot',
  'wings_outer',
  'bosswingpod',
  'antenna',
  'turret',
  'cannon_',
  'leg_',
  'claw_',
  'eye_',
  'dorsalturret',
  'bowcranearms',
  'fighter_',
  'suspension',
  'wheel',
  'canopy',
  'rearhatch',
  'nacelle_',
  'elevator',
  'aileron',
  'rudder',
  'gear-',
  'bay-',
  'door',
];

const UI_PRELOAD_URLS = [
  './ui/bootloader_bg.webp',
  './ui/logo_emblem.png',
  './ui/card_chip_frame.png',
  './ui/icons/badge_boss_alert.png',
  './ui/icons/badge_astra.png',
  './ui/icons/badge_opus.png',
  './ui/icons/badge_morph.png',
  './ui/icons/badge_aero.png',
  './ui/icons/medal_victory.png',
  './ui/icons/medal_defeat.png',
  './ui/icons/icon_pickup_repair.png',
  './ui/icons/icon_pickup_energy.png',
  './ui/icons/icon_barrel_roll.png',
  './ui/icons/icon_crit.png',
  './ui/icons/icon_deflect.png',
  './ui/icons/icon_missile.png',
  './ui/icons/icon_overcharge.png',
  './ui/icons/icon_pierce.png',
  './ui/icons/icon_prism.png',
  './ui/icons/icon_shield.png',
  './ui/icons/icon_tesla.png',
  './ui/icons/icon_thruster.png',
  './ui/icons/icon_ultimate.png',
  './ui/icons/icon_wingman.png',
  './ui/frames/panel_frame_tall.webp',
  './ui/frames/modal_frame_sci_fi.webp',
  './ui/frames/card_slot_cyan.webp',
  './ui/frames/card_slot_amber.webp',
  './ui/frames/launch_btn_amber.webp',
  './ui/frames/hud_status_frame.webp',
  './ui/frames/hud_boss_frame.webp',
  './ui/frames/hangar_header_crest.webp',
  './ui/frames/btn_tactical_frame.webp',
  './ui/icons/icon_settings.webp',
  './ui/icons/icon_guide.webp',
  './ui/icons/icon_audio.webp',
  './ui/frames/hud_telemetry_crest.webp',
  './ui/frames/hud_banner_wing.webp',
  './ui/frames/hud_banner_wing_alert.webp',
  './ui/icons/icon_autofire.webp',
  './ui/icons/icon_pause.webp',
];

interface EnvTextureSpec {
  key: string;
  url: string;
  fallbackHex: number;
  mipmaps?: boolean;
  linear?: boolean;
  transparentFallback?: boolean;
}

const ENV_TEXTURE_SPECS: ReadonlyArray<EnvTextureSpec> = [
  { key: 'hangar', url: './env/sky_hangar_dock.webp', fallbackHex: 0x164e63 },
  {
    key: 'hangar_ceiling',
    url: './env/hangar_ceiling_gantry.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'hangar_bulkhead',
    url: './env/hangar_side_bulkhead.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'hangar_deck_albedo',
    url: './env/hangar_deck_albedo.webp',
    fallbackHex: 0x1d2d44,
    mipmaps: true,
  },
  {
    key: 'hangar_deck_normal',
    url: './env/hangar_deck_normal.webp',
    fallbackHex: 0x8080ff,
    mipmaps: true,
    linear: true,
  },
  {
    key: 'hangar_deck_roughness',
    url: './env/hangar_deck_roughness.webp',
    fallbackHex: 0x666666,
    mipmaps: true,
    linear: true,
  },
  {
    key: 'hangar_deck_emissive',
    url: './env/hangar_deck_emissive.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
  },
  {
    key: 'hangar_side_deck_albedo',
    url: './env/hangar_side_deck_albedo.webp',
    fallbackHex: 0x1a2638,
    mipmaps: true,
  },
  {
    key: 'hangar_side_deck_normal',
    url: './env/hangar_side_deck_normal.webp',
    fallbackHex: 0x8080ff,
    mipmaps: true,
    linear: true,
  },
  { key: 'act1', url: './env/sky_stratosphere.webp', fallbackHex: 0x07152e },
  { key: 'act2', url: './env/sky_act1_metropolis.webp', fallbackHex: 0x0d2847 },
  {
    key: 'act2_highway_albedo',
    url: './env/act1_highway_albedo.webp',
    fallbackHex: 0x1d2d44,
    mipmaps: true,
  },
  {
    key: 'act2_highway_normal',
    url: './env/act1_highway_normal.webp',
    fallbackHex: 0x8080ff,
    mipmaps: true,
    linear: true,
  },
  {
    key: 'act2_highway_roughness',
    url: './env/act1_highway_roughness.webp',
    fallbackHex: 0x666666,
    mipmaps: true,
    linear: true,
  },
  {
    key: 'act2_highway_emissive',
    url: './env/act1_highway_emissive.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
  },
  {
    key: 'act2_sky_arch',
    url: './env/act1_sky_arch.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act2_tower_a',
    url: './env/act1_tower_cluster_a.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act2_tower_b',
    url: './env/act1_tower_cluster_b.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act2_holo_pylon',
    url: './env/act1_holo_pylon.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  { key: 'act3', url: './env/sky_act2_nebula.webp', fallbackHex: 0x2e1f6b },
  {
    key: 'act3_warp_ring',
    url: './env/act2_warp_ring.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act3_crystal_a',
    url: './env/act2_crystal_a.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act3_crystal_b',
    url: './env/act2_crystal_b.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act3_derelict',
    url: './env/act2_derelict_hulk.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  { key: 'act4', url: './env/sky_act3_citadel.webp', fallbackHex: 0x5c1922 },
  {
    key: 'act4_hull_albedo',
    url: './env/act3_hull_albedo.webp',
    fallbackHex: 0x241315,
    mipmaps: true,
  },
  {
    key: 'act4_hull_normal',
    url: './env/act3_hull_normal.webp',
    fallbackHex: 0x8080ff,
    mipmaps: true,
    linear: true,
  },
  {
    key: 'act4_hull_roughness',
    url: './env/act3_hull_roughness.webp',
    fallbackHex: 0x666666,
    mipmaps: true,
    linear: true,
  },
  {
    key: 'act4_hull_emissive',
    url: './env/act3_hull_emissive.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
  },
  {
    key: 'act4_keel_arch',
    url: './env/act3_keel_arch.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act4_bastion_a',
    url: './env/act3_bastion_a.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act4_bastion_b',
    url: './env/act3_bastion_b.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
  {
    key: 'act4_flak_pylon',
    url: './env/act3_flak_pylon.webp',
    fallbackHex: 0x000000,
    mipmaps: true,
    transparentFallback: true,
  },
];

const MAX_POOL_PER_KEY = 24;

interface NodeRestState {
  obj: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  visible: boolean;
  morphs: number[] | null;
}

interface MaterialBaseState {
  mat: THREE.Material;
  color: THREE.Color | null;
  opacity: number;
  transparent: boolean;
}

interface InstanceSnapshot {
  materialsCloned: boolean;
  nodes: NodeRestState[];
  materialStates: MaterialBaseState[];
}

function countSceneStats(root: THREE.Object3D): { triangles: number; drawCalls: number } {
  let triangles = 0;
  let drawCalls = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    drawCalls += 1;
    const geo = mesh.geometry;
    if (geo.index) {
      triangles += Math.floor(geo.index.count / 3);
    } else if (geo.attributes.position) {
      triangles += Math.floor(geo.attributes.position.count / 3);
    }
  });
  return { triangles, drawCalls };
}

function isDynamicSubtree(node: THREE.Object3D, animatedNodeNames: Set<string>): boolean {
  let cur: THREE.Object3D | null = node;
  while (cur) {
    const lower = (cur.name || '').toLowerCase();
    if (animatedNodeNames.has(cur.name) || animatedNodeNames.has(lower)) {
      return true;
    }
    for (const kw of DYNAMIC_NODE_KEYWORDS) {
      if (lower.includes(kw)) return true;
    }
    cur = cur.parent;
  }
  return false;
}

function extractAnimatedNodeNames(animations: THREE.AnimationClip[]): Set<string> {
  const names = new Set<string>();
  for (const clip of animations) {
    for (const track of clip.tracks) {
      // Track format: "nodeName.property" or "a/b/nodeName.property"
      const targetPart = track.name.split('.')[0] ?? '';
      for (const seg of targetPart.split('/')) {
        if (seg) {
          names.add(seg);
          names.add(seg.toLowerCase());
        }
      }
    }
  }
  return names;
}

function batchStaticMeshes(
  modelRoot: THREE.Object3D,
  animations: THREE.AnimationClip[]
): void {
  const animatedNames = extractAnimatedNodeNames(animations);
  modelRoot.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(modelRoot.matrixWorld).invert();

  interface GroupEntry {
    material: THREE.Material;
    meshes: THREE.Mesh[];
  }

  const buckets = new Map<string, GroupEntry>();
  const mat4 = new THREE.Matrix4();

  modelRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Array.isArray(mesh.material) || !mesh.material) return;
    const geo = mesh.geometry;
    if (!geo || !geo.attributes.position) return;
    if (Object.keys(geo.morphAttributes).length > 0) return;
    if (isDynamicSubtree(mesh, animatedNames)) return;

    // Skip negative-scale mirrored meshes so applyMatrix4 never flips winding order.
    mat4.multiplyMatrices(rootInverse, mesh.matrixWorld);
    if (mat4.determinant() < 0) return;

    const attrNames = Object.keys(geo.attributes).sort();
    const attrParts: string[] = [];
    for (const attrName of attrNames) {
      const attr = geo.attributes[attrName];
      if (!attr || !('array' in attr) || !attr.array) return;
      if (
        ('isInstancedBufferAttribute' in attr && attr.isInstancedBufferAttribute) ||
        ('isInstancedInterleavedBufferAttribute' in attr &&
          attr.isInstancedInterleavedBufferAttribute)
      ) {
        return;
      }
      const isInterleaved =
        'isInterleavedBufferAttribute' in attr &&
        Boolean((attr as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute);
      // Cloned geometries are deinterleaved into FloatType BufferAttributes before merging.
      const gpuType = isInterleaved
        ? THREE.FloatType
        : (attr as THREE.BufferAttribute).gpuType;
      const ctorName = attr.array.constructor.name;
      attrParts.push(
        `${attrName}:${attr.itemSize}:${attr.normalized ? 1 : 0}:${ctorName}:${gpuType}`
      );
    }
    const attrSig = attrParts.join(',');
    const key = `${mesh.material.uuid}|${geo.index ? 'I' : 'N'}|${attrSig}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: mesh.material, meshes: [] };
      buckets.set(key, bucket);
    }
    bucket.meshes.push(mesh);
  });

  const mergedGroup = new THREE.Group();
  mergedGroup.name = 'StaticBatchedGroup';
  const removedGeometries = new Set<THREE.BufferGeometry>();

  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 2) continue;
    const transformed: THREE.BufferGeometry[] = [];
    let merged: THREE.BufferGeometry | null = null;
    try {
      for (const m of bucket.meshes) {
        const cloned = m.geometry.clone();
        transformed.push(cloned);
        deinterleaveGeometry(cloned);
        mat4.multiplyMatrices(rootInverse, m.matrixWorld);
        cloned.applyMatrix4(mat4);
      }
      merged = mergeGeometries(transformed, false);
    } catch {
      // Keep original unbatched meshes cleanly if any attribute mismatch occurs.
      merged = null;
    } finally {
      for (const g of transformed) g.dispose();
    }

    if (!merged) continue;

    const batchedMesh = new THREE.Mesh(merged, bucket.material);
    batchedMesh.name = 'StaticBatchedMesh';
    batchedMesh.castShadow = false;
    batchedMesh.receiveShadow = false;
    mergedGroup.add(batchedMesh);

    for (const m of bucket.meshes) {
      removedGeometries.add(m.geometry);
      m.removeFromParent();
    }
  }

  if (mergedGroup.children.length > 0) {
    modelRoot.add(mergedGroup);
  }

  if (removedGeometries.size > 0) {
    const stillUsedGeometries = new Set<THREE.BufferGeometry>();
    modelRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        stillUsedGeometries.add(mesh.geometry);
      }
    });
    for (const geo of removedGeometries) {
      if (!stillUsedGeometries.has(geo)) {
        geo.dispose();
      }
    }
  }
}

function stripNamedNodes(root: THREE.Object3D, stripList?: string[]): void {
  if (!stripList || stripList.length === 0) return;
  const targets: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (!obj.name) return;
    if (stripList.includes(obj.name)) {
      targets.push(obj);
    }
  });
  for (const t of targets) {
    t.removeFromParent();
  }
}

function tintEnemyFoldwing(root: THREE.Object3D): void {
  const seen = new Map<THREE.Material, THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const tintOne = (m: THREE.Material): THREE.Material => {
      const existing = seen.get(m);
      if (existing) return existing;
      const c = m.clone();
      if (c instanceof THREE.MeshStandardMaterial) {
        c.color.lerp(new THREE.Color(0xff4d6d), 0.32);
        c.emissive.setHex(0x660b1d);
        c.emissiveIntensity = Math.max(c.emissiveIntensity, 0.35);
      }
      seen.set(m, c);
      return c;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(tintOne);
    } else {
      mesh.material = tintOne(mesh.material);
    }
  });
}

function enhanceBossSkywing(root: THREE.Object3D): void {
  // 1. Imperial Stratosphere Commander livery: deep sapphire titanium + solar gold trim + glowing cyan cockpit
  const replaced = new Map<THREE.Material, THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const upgradeOne = (src: THREE.Material): THREE.Material => {
      const existing = replaced.get(src);
      if (existing) return existing;
      if (!(src instanceof THREE.MeshStandardMaterial)) {
        replaced.set(src, src);
        return src;
      }

      let out: THREE.Material = src;
      const name = src.name || '';
      if (name === 'Paint_Red' || name === 'Paint_Fin' || name === 'Propeller_YellowTip') {
        out = replaceWithPhysicalClearcoat(src, {
          color: 0xf4b63c,
          metalness: 0.9,
          roughness: 0.14,
          clearcoat: 0.95,
          clearcoatRoughness: 0.04,
          emissive: 0x7c3e08,
          emissiveIntensity: 0.48,
          envMapIntensity: 1.75,
        });
      } else if (name === 'Canopy_Glass' || name === 'Window_DarkGlass') {
        out = replaceWithPhysicalClearcoat(src, {
          color: 0x073452,
          metalness: 0.2,
          roughness: 0.05,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          emissive: 0x16e0ff,
          emissiveIntensity: 1.05,
          envMapIntensity: 1.85,
        });
      } else if (name === 'Paint_Fuselage' || name === 'Paint_Wings' || name === 'Paint_Tailplane') {
        out = replaceWithPhysicalClearcoat(src, {
          color: 0x1c3152,
          metalness: 0.72,
          roughness: 0.18,
          clearcoat: 0.92,
          clearcoatRoughness: 0.05,
          emissive: 0x08223d,
          emissiveIntensity: 0.35,
          envMapIntensity: 1.65,
        });
      } else if (name === 'Chrome' || name === 'Exhaust_Silver' || name === 'Canopy_Frame_Bronze') {
        out = replaceWithPhysicalClearcoat(src, {
          color: 0xb9d6f2,
          metalness: 0.94,
          roughness: 0.12,
          clearcoat: 0.65,
          clearcoatRoughness: 0.06,
          envMapIntensity: 1.75,
        });
      } else {
        out = replaceWithPhysicalClearcoat(src, {
          color: src.color.clone().lerp(new THREE.Color(0x16243b), 0.45).getHex(),
          metalness: Math.max(src.metalness, 0.68),
          roughness: Math.min(src.roughness, 0.24),
          clearcoat: 0.6,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.45,
        });
      }
      if (out !== src) src.dispose();
      replaced.set(src, out);
      return out;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(upgradeOne);
    } else {
      mesh.material = upgradeOne(mesh.material);
    }
  });

  // 2. Mount glowing destructible Wingtip Plasma Turbine Pods directly inside WingFold_Pivot_L/R
  root.updateMatrixWorld(true);
  const podChassisMat = new THREE.MeshPhysicalMaterial({
    color: 0x14243b,
    metalness: 0.88,
    roughness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
    emissive: 0x062038,
    emissiveIntensity: 0.4,
    envMapIntensity: 1.6,
  });
  const podGoldRingMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7bd42,
    metalness: 0.94,
    roughness: 0.14,
    clearcoat: 0.9,
    emissive: 0x804208,
    emissiveIntensity: 0.45,
    envMapIntensity: 1.8,
  });
  const podCoreMat = new THREE.MeshStandardMaterial({
    color: 0x56f5ff,
    emissive: 0x1ae8ff,
    emissiveIntensity: 2.4,
    metalness: 0.1,
    roughness: 0.15,
  });

  const buildWingPod = (podName: string, sideSign: 1 | -1): THREE.Group => {
    const pod = new THREE.Group();
    pod.name = podName;

    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.022, 0.115, 16), podChassisMat);
    nacelle.rotation.x = Math.PI * 0.5;

    const collarFront = new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.0042, 10, 24), podGoldRingMat);
    collarFront.position.z = 0.036;

    const collarRear = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0036, 10, 24), podGoldRingMat);
    collarRear.position.z = -0.032;

    const plasmaCore = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 16, 12), podCoreMat);
    plasmaCore.scale.set(1.0, 1.0, 1.65);
    plasmaCore.position.z = 0.052;

    const plasmaHalo = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.0028, 8, 28), podCoreMat);
    plasmaHalo.position.z = 0.024;

    const pylonStrut = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.026, 0.058), podChassisMat);
    pylonStrut.position.set(0, 0.018, 0.004);

    const sideFin = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.005, 0.064), podGoldRingMat);
    sideFin.position.set(sideSign * 0.018, 0, -0.008);

    pod.add(nacelle, collarFront, collarRear, plasmaCore, plasmaHalo, pylonStrut, sideFin);
    return pod;
  };

  for (const [pivotName, outerName, podName, sideSign] of [
    ['WingFold_Pivot_L', 'Wings_Outer_L', 'BossWingPod_L', 1],
    ['WingFold_Pivot_R', 'Wings_Outer_R', 'BossWingPod_R', -1],
  ] as const) {
    let pivotNode: THREE.Object3D | null = null;
    let outerNode: THREE.Object3D | null = null;
    root.traverse((obj) => {
      if (obj.name === pivotName) pivotNode = obj;
      if (obj.name === outerName) outerNode = obj;
    });
    if (!pivotNode) continue;
    const pivotObj = pivotNode as THREE.Object3D;
    const pod = buildWingPod(podName, sideSign);

    if (outerNode) {
      const box = new THREE.Box3().setFromObject(outerNode);
      if (!box.isEmpty()) {
        const worldCenter = new THREE.Vector3();
        box.getCenter(worldCenter);
        worldCenter.y = box.min.y - 0.012;
        worldCenter.z += 0.018;
        const localPos = pivotObj.worldToLocal(worldCenter.clone());
        pod.position.copy(localPos);
      } else {
        pod.position.set(sideSign * 0.11, -0.022, 0.042);
      }
    } else {
      pod.position.set(sideSign * 0.11, -0.022, 0.042);
    }
    pivotObj.add(pod);
  }
}

function replaceWithPhysicalClearcoat(
  oldMat: THREE.MeshStandardMaterial,
  opts: {
    color?: number;
    metalness?: number;
    roughness?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    reflectivity?: number;
    envMapIntensity?: number;
    emissive?: number;
    emissiveIntensity?: number;
  }
): THREE.MeshPhysicalMaterial {
  const phys = new THREE.MeshPhysicalMaterial({
    name: oldMat.name,
    color: opts.color !== undefined ? new THREE.Color(opts.color) : oldMat.color.clone(),
    metalness: opts.metalness ?? oldMat.metalness,
    roughness: opts.roughness ?? oldMat.roughness,
    clearcoat: opts.clearcoat ?? 0.85,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.06,
    reflectivity: opts.reflectivity ?? 0.9,
    envMapIntensity: opts.envMapIntensity ?? oldMat.envMapIntensity,
    emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : oldMat.emissive.clone(),
    emissiveIntensity: opts.emissiveIntensity ?? oldMat.emissiveIntensity,
    transparent: oldMat.transparent,
    opacity: oldMat.opacity,
    side: oldMat.side,
    vertexColors: oldMat.vertexColors,
  });
  return phys;
}

function optimizeShipAstraCanopy(root: THREE.Object3D): void {
  const seen = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0) {
        mat.transmission = 0;
        mat.thickness = 0;
        mat.transparent = true;
        mat.opacity = 0.62;
        mat.roughness = 0.08;
        mat.metalness = 0.15;
        mat.clearcoat = 1.0;
        mat.clearcoatRoughness = 0.05;
        mat.envMapIntensity = 1.65;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
    }
  });
}

function enhanceShipMorph(root: THREE.Object3D): void {
  const replaced = new Map<THREE.Material, THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const upgradeOne = (src: THREE.Material): THREE.Material => {
      const existing = replaced.get(src);
      if (existing) return existing;
      if (!(src instanceof THREE.MeshStandardMaterial)) {
        replaced.set(src, src);
        return src;
      }

      let out: THREE.Material = src;
      switch (src.name) {
        case 'Mat_ValkyriePearl':
          out = replaceWithPhysicalClearcoat(src, {
            color: 0x9aaec4,
            metalness: 0.62,
            roughness: 0.16,
            clearcoat: 0.95,
            clearcoatRoughness: 0.05,
            reflectivity: 0.95,
            envMapIntensity: 1.45,
          });
          break;
        case 'Mat_StealthCarbon':
          out = replaceWithPhysicalClearcoat(src, {
            color: 0x1a2230,
            metalness: 0.84,
            roughness: 0.2,
            clearcoat: 0.65,
            clearcoatRoughness: 0.08,
            envMapIntensity: 1.35,
          });
          break;
        case 'Mat_ValkyrieCrimson':
          out = replaceWithPhysicalClearcoat(src, {
            color: 0xd91c32,
            metalness: 0.58,
            roughness: 0.15,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
            emissiveIntensity: 0.22,
            envMapIntensity: 1.45,
          });
          break;
        case 'Mat_BrushedAlloy':
          out = replaceWithPhysicalClearcoat(src, {
            color: 0x8fa0b5,
            metalness: 0.92,
            roughness: 0.14,
            clearcoat: 0.45,
            clearcoatRoughness: 0.08,
            envMapIntensity: 1.65,
          });
          break;
        case 'Mat_CanopyGlass':
          out = replaceWithPhysicalClearcoat(src, {
            color: 0x072038,
            metalness: 0.15,
            roughness: 0.04,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            emissiveIntensity: 0.48,
            envMapIntensity: 1.75,
          });
          break;
        case 'Mat_ThrusterPlasma':
          src.emissiveIntensity = 2.2;
          src.needsUpdate = true;
          break;
        case 'Mat_HoloCyan':
          src.emissiveIntensity = 2.0;
          src.needsUpdate = true;
          break;
        default:
          break;
      }
      if (out !== src) src.dispose();
      replaced.set(src, out);
      return out;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(upgradeOne);
    } else {
      mesh.material = upgradeOne(mesh.material);
    }
  });
}

function enhancePickupModel(root: THREE.Object3D): void {
  const replaced = new Map<THREE.Material, THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const upgradeOne = (src: THREE.Material): THREE.Material => {
      const existing = replaced.get(src);
      if (existing) return existing;
      if (!(src instanceof THREE.MeshStandardMaterial)) {
        replaced.set(src, src);
        return src;
      }

      let out: THREE.Material = src;
      const hasOwnEmissive = src.emissive.r + src.emissive.g + src.emissive.b > 0.05;
      if (hasOwnEmissive) {
        src.envMapIntensity = Math.max(src.envMapIntensity, 1.35);
        src.emissiveIntensity = 2.1;
        src.needsUpdate = true;
      } else {
        switch (src.name) {
          case 'Mat_TitaniumWhite':
            out = replaceWithPhysicalClearcoat(src, {
              color: 0xc2d2e3,
              metalness: 0.64,
              roughness: 0.15,
              clearcoat: 0.95,
              clearcoatRoughness: 0.05,
              envMapIntensity: 1.55,
            });
            break;
          case 'Mat_GunmetalDark':
          case 'Mat_ObsidianChassis':
            out = replaceWithPhysicalClearcoat(src, {
              metalness: 0.88,
              roughness: 0.18,
              clearcoat: 0.72,
              clearcoatRoughness: 0.07,
              envMapIntensity: 1.55,
            });
            break;
          case 'Mat_GoldTrim':
            out = replaceWithPhysicalClearcoat(src, {
              color: 0xf4c048,
              metalness: 0.95,
              roughness: 0.12,
              clearcoat: 0.85,
              clearcoatRoughness: 0.05,
              envMapIntensity: 1.85,
            });
            break;
          default:
            out = replaceWithPhysicalClearcoat(src, {
              metalness: Math.max(src.metalness, 0.7),
              roughness: Math.min(src.roughness, 0.18),
              clearcoat: 0.75,
              clearcoatRoughness: 0.07,
              envMapIntensity: 1.5,
            });
            break;
        }
      }
      if (out !== src) src.dispose();
      replaced.set(src, out);
      return out;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(upgradeOne);
    } else {
      mesh.material = upgradeOne(mesh.material);
    }
  });
}

function applyTextureSharpness(root: THREE.Object3D, maxAnisotropy: number): void {
  const seenTex = new Set<THREE.Texture>();
  const touch = (tex: THREE.Texture | null | undefined) => {
    if (!tex || seenTex.has(tex)) return;
    seenTex.add(tex);
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
  };
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat instanceof THREE.MeshStandardMaterial) {
        touch(mat.map);
        touch(mat.normalMap);
        touch(mat.roughnessMap);
        touch(mat.metalnessMap);
        touch(mat.emissiveMap);
        touch(mat.aoMap);
      }
    }
  });
}

function configureEnvTexture(
  tex: THREE.Texture,
  opts?: Pick<EnvTextureSpec, 'mipmaps' | 'linear'>
): THREE.Texture {
  const isData = tex instanceof THREE.DataTexture;
  const useMipmaps = Boolean(opts?.mipmaps) && !isData;
  tex.colorSpace = opts?.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = useMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = useMipmaps;
  tex.needsUpdate = true;
  return tex;
}

function createFallbackEnvTexture(
  hex: number,
  opts?: Pick<EnvTextureSpec, 'linear' | 'transparentFallback'>
): THREE.DataTexture {
  const c = opts?.linear ? new THREE.Color(hex) : new THREE.Color(hex).convertLinearToSRGB();
  const data = new Uint8Array([
    Math.round(THREE.MathUtils.clamp(c.r, 0, 1) * 255),
    Math.round(THREE.MathUtils.clamp(c.g, 0, 1) * 255),
    Math.round(THREE.MathUtils.clamp(c.b, 0, 1) * 255),
    opts?.transparentFallback ? 0 : 255,
  ]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  return configureEnvTexture(tex, opts) as THREE.DataTexture;
}

function loadEnvTexture(spec: EnvTextureSpec): Promise<THREE.Texture> {
  if (typeof Image === 'undefined') {
    return Promise.resolve(createFallbackEnvTexture(spec.fallbackHex, spec));
  }
  return new Promise<THREE.Texture>((resolve) => {
    const img = new Image();
    let settled = false;
    const finishFallback = () => {
      if (settled) return;
      settled = true;
      resolve(createFallbackEnvTexture(spec.fallbackHex, spec));
    };
    img.onload = () => {
      if (settled) return;
      settled = true;
      if (!img.naturalWidth || !img.naturalHeight) {
        resolve(createFallbackEnvTexture(spec.fallbackHex, spec));
        return;
      }
      resolve(configureEnvTexture(new THREE.Texture(img), spec));
    };
    img.onerror = finishFallback;
    try {
      img.src = spec.url;
    } catch {
      finishFallback();
    }
  });
}

function cloneMaterialsOnRoot(root: THREE.Object3D): {
  materials: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
  baseEmissiveIntensities: number[];
  materialStates: MaterialBaseState[];
} {
  const seen = new Map<THREE.Material, THREE.Material>();
  const materials: THREE.MeshStandardMaterial[] = [];
  const baseEmissives: THREE.Color[] = [];
  const baseEmissiveIntensities: number[] = [];
  const materialStates: MaterialBaseState[] = [];

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const replaceMat = (mat: THREE.Material): THREE.Material => {
      const existing = seen.get(mat);
      if (existing) return existing;
      const cloned = mat.clone();
      seen.set(mat, cloned);
      let baseColor: THREE.Color | null = null;
      if (cloned instanceof THREE.MeshStandardMaterial) {
        materials.push(cloned);
        baseEmissives.push(cloned.emissive.clone());
        baseEmissiveIntensities.push(cloned.emissiveIntensity);
        baseColor = cloned.color.clone();
      } else if ('color' in cloned && (cloned as { color?: unknown }).color instanceof THREE.Color) {
        baseColor = ((cloned as unknown) as { color: THREE.Color }).color.clone();
      }
      materialStates.push({
        mat: cloned,
        color: baseColor,
        opacity: cloned.opacity,
        transparent: cloned.transparent,
      });
      return cloned;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(replaceMat);
    } else {
      mesh.material = replaceMat(mesh.material);
    }
  });

  return { materials, baseEmissives, baseEmissiveIntensities, materialStates };
}

function captureNodeRestStates(root: THREE.Object3D): NodeRestState[] {
  const nodes: NodeRestState[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const morphs =
      mesh.isMesh && Array.isArray(mesh.morphTargetInfluences)
        ? mesh.morphTargetInfluences.slice()
        : null;
    nodes.push({
      obj,
      position: obj.position.clone(),
      quaternion: obj.quaternion.clone(),
      scale: obj.scale.clone(),
      visible: obj.visible,
      morphs,
    });
  });
  return nodes;
}

export class AssetLoader {
  private loader = new GLTFLoader();
  private prototypes = new Map<ModelKey, LoadedModelPrototype>();
  private pools = new Map<ModelKey, PooledModelInstance[]>();
  private snapshots = new WeakMap<PooledModelInstance, InstanceSnapshot>();
  private envTextures = new Map<string, THREE.Texture>();

  async preloadAll(onProgress: (info: ModelLoadProgress) => void): Promise<void> {
    const keys = Object.keys(MODEL_ASSETS) as ModelKey[];
    const total = keys.length + 2; // +1 UI & env preload, +1 pool & shader warmup

    for (const tex of this.envTextures.values()) {
      tex.dispose();
    }
    this.envTextures.clear();

    // Preload UI images and panoramic sky/horizon textures softly in parallel
    const uiPromise = Promise.all(
      UI_PRELOAD_URLS.map(
        (url) =>
          new Promise<void>((resolve) => {
            if (typeof Image === 'undefined') {
              resolve();
              return;
            }
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
          })
      )
    );

    const envPromise = Promise.all(
      ENV_TEXTURE_SPECS.map(async (spec) => {
        const tex = await loadEnvTexture(spec);
        this.envTextures.set(spec.key, tex);
      })
    );

    let done = 0;
    for (const key of keys) {
      const spec = MODEL_ASSETS[key];
      const gltf = await this.loader.loadAsync(spec.url);
      const rawScene = gltf.scene;
      stripNamedNodes(rawScene, spec.stripNodes);

      const beforeStats = countSceneStats(rawScene);
      if (BATCH_WHITELIST.has(key)) {
        batchStaticMeshes(rawScene, gltf.animations);
      }
      if (key === 'enemy_foldwing') {
        tintEnemyFoldwing(rawScene);
      } else if (key === 'boss_act1_skywing') {
        enhanceBossSkywing(rawScene);
      } else if (key === 'ship_astra') {
        optimizeShipAstraCanopy(rawScene);
      } else if (key === 'ship_morph') {
        enhanceShipMorph(rawScene);
      } else if (key === 'pickup_repair' || key === 'pickup_energy') {
        enhancePickupModel(rawScene);
      }

      // Prevent skeletal-animated meshes from culling prematurely when bones leave bind-pose bounds
      rawScene.traverse((obj) => {
        if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
          obj.frustumCulled = false;
        }
      });

      rawScene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rawScene);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      let scaleFactor = 1;
      if (!box.isEmpty()) {
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        scaleFactor = spec.targetSize / maxDim;
      }

      const fitGroup = new THREE.Group();
      fitGroup.name = `fit_${key}`;
      fitGroup.position.set(
        -center.x * scaleFactor,
        -center.y * scaleFactor,
        -center.z * scaleFactor
      );
      fitGroup.scale.setScalar(scaleFactor);
      fitGroup.add(rawScene);

      const normGroup = new THREE.Group();
      normGroup.name = `norm_${key}`;
      normGroup.add(fitGroup);

      const orientationPivot = new THREE.Group();
      orientationPivot.name = `pivot_${key}`;
      orientationPivot.rotation.set(
        spec.orientation.pitch ?? 0,
        spec.orientation.yaw,
        spec.orientation.roll ?? 0
      );
      orientationPivot.add(normGroup);

      orientationPivot.updateMatrixWorld(true);
      const finalBox = new THREE.Box3().setFromObject(orientationPivot);
      const finalSize = new THREE.Vector3();
      if (!finalBox.isEmpty()) {
        finalBox.getSize(finalSize);
      }

      const afterStats = countSceneStats(orientationPivot);

      this.prototypes.set(key, {
        key,
        prototype: orientationPivot,
        animations: gltf.animations,
        triangles: afterStats.triangles,
        drawCallsBefore: beforeStats.drawCalls,
        drawCallsAfter: afterStats.drawCalls,
        boundingSize: finalSize,
      });

      done += 1;
      onProgress({
        loaded: done,
        total,
        percent: Math.round((done / total) * 100),
        key,
        triangles: afterStats.triangles,
        drawCallsBefore: beforeStats.drawCalls,
        drawCallsAfter: afterStats.drawCalls,
        message: spec.bootLog,
      });
    }

    await Promise.all([uiPromise, envPromise]);
    done += 1;
    onProgress({
      loaded: done,
      total,
      percent: Math.round((done / total) * 100),
      message: '[OK] 战术座舱全息视界、星际天幕与火控罗盘同步完成',
    });
  }

  async warmPools(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    onProgress: (info: ModelLoadProgress) => void,
    extraWarmupObjects?: THREE.Object3D[]
  ): Promise<void> {
    const poolPlan: Record<ModelKey, number> = {
      ship_astra: 1,
      ship_opus: 1,
      ship_morph: 1,
      ship_aero: 1,
      boss_act1_skywing: 1,
      boss_act1_mech: 1,
      boss_act2_crab: 1,
      boss_act3_carrier: 1,
      enemy_drone: 10,
      enemy_turret: 5,
      enemy_rover: 3,
      enemy_foldwing: 5,
      ally_biplane: 2,
      pickup_repair: 12,
      pickup_energy: 12,
      prop_gate: 2,
    };

    const maxAniso = Math.min(4, renderer.capabilities?.getMaxAnisotropy?.() || 4);
    for (const proto of this.prototypes.values()) {
      applyTextureSharpness(proto.prototype, maxAniso);
    }
    for (const envTex of this.envTextures.values()) {
      envTex.anisotropy = maxAniso;
      envTex.needsUpdate = true;
    }

    const warmupGroup = new THREE.Group();
    const allKeys = Object.keys(poolPlan) as ModelKey[];

    for (const key of allKeys) {
      const targetCount = poolPlan[key];
      let bucket = this.pools.get(key);
      if (!bucket) {
        bucket = [];
        this.pools.set(key, bucket);
      }
      while (bucket.length < targetCount) {
        const inst = this.createInstance(key, key.startsWith('enemy_') || key.startsWith('boss_'));
        bucket.push(inst);
      }
      if (bucket.length > 0) {
        warmupGroup.add(bucket[0].root);
      }
    }

    warmupGroup.position.set(0, 0, -40);

    const uniqueExtras: THREE.Object3D[] = [];
    if (extraWarmupObjects && extraWarmupObjects.length > 0) {
      const seenExtra = new Set<THREE.Object3D>();
      for (const obj of extraWarmupObjects) {
        if (obj && !seenExtra.has(obj)) {
          seenExtra.add(obj);
          uniqueExtras.push(obj);
        }
      }
    }

    const unparentedExtras = uniqueExtras.filter((obj) => obj.parent === null);
    const parentedExtras = uniqueExtras.filter((obj) => obj.parent !== null);

    const savedVisibility = new Map<THREE.Object3D, boolean>();
    const savedFrustumCulled = new Map<THREE.Object3D, boolean>();
    const savedInstanced = new Map<
      THREE.InstancedMesh,
      { count: number; matrix0: Float32Array; color0: Float32Array | null }
    >();
    const tmpMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, -40),
      new THREE.Quaternion(),
      new THREE.Vector3(0.001, 0.001, 0.001)
    );
    const tmpColor = new THREE.Color(0xffffff);

    const enableWarmupState = () => {
      for (const obj of uniqueExtras) {
        let cur: THREE.Object3D | null = obj.parent;
        while (cur && cur !== scene) {
          if (!savedVisibility.has(cur)) savedVisibility.set(cur, cur.visible);
          cur.visible = true;
          cur = cur.parent;
        }
        obj.traverse((node) => {
          if (!savedVisibility.has(node)) savedVisibility.set(node, node.visible);
          node.visible = true;
          if (!savedFrustumCulled.has(node)) savedFrustumCulled.set(node, node.frustumCulled);
          node.frustumCulled = false;
          const instMesh = node as THREE.InstancedMesh;
          if (instMesh.isInstancedMesh && instMesh.count === 0 && instMesh.instanceMatrix.count > 0) {
            if (!savedInstanced.has(instMesh)) {
              const matrix0 = Float32Array.from(instMesh.instanceMatrix.array.subarray(0, 16));
              const color0 = instMesh.instanceColor
                ? Float32Array.from(instMesh.instanceColor.array.subarray(0, 3))
                : null;
              savedInstanced.set(instMesh, { count: instMesh.count, matrix0, color0 });
            }
            instMesh.setMatrixAt(0, tmpMatrix);
            instMesh.instanceMatrix.needsUpdate = true;
            if (instMesh.instanceColor) {
              instMesh.setColorAt(0, tmpColor);
              instMesh.instanceColor.needsUpdate = true;
            }
            instMesh.count = 1;
          }
        });
      }
    };

    const restoreWarmupState = () => {
      for (const [instMesh, backup] of savedInstanced.entries()) {
        instMesh.count = backup.count;
        instMesh.instanceMatrix.array.set(backup.matrix0, 0);
        instMesh.instanceMatrix.needsUpdate = true;
        if (backup.color0 && instMesh.instanceColor) {
          instMesh.instanceColor.array.set(backup.color0, 0);
          instMesh.instanceColor.needsUpdate = true;
        }
      }
      savedInstanced.clear();
      for (const [node, wasCulled] of savedFrustumCulled.entries()) {
        node.frustumCulled = wasCulled;
      }
      savedFrustumCulled.clear();
      for (const [node, wasVisible] of savedVisibility.entries()) {
        node.visible = wasVisible;
      }
      savedVisibility.clear();
    };

    const attachUnparented = () => {
      for (const obj of unparentedExtras) {
        warmupGroup.add(obj);
      }
      scene.add(warmupGroup);
    };

    const detachUnparented = () => {
      for (const obj of unparentedExtras) {
        warmupGroup.remove(obj);
      }
      scene.remove(warmupGroup);
    };

    const compileTargets: THREE.Object3D[] = [warmupGroup, ...parentedExtras];
    const compilePromises: Promise<unknown>[] = [];

    attachUnparented();
    enableWarmupState();
    for (const target of compileTargets) {
      try {
        const res = renderer.compileAsync(target, camera, scene);
        if (res && typeof res.then === 'function') {
          compilePromises.push(res);
        }
      } catch {
        renderer.compile(target, camera, scene);
      }
    }
    // Restore immediately before awaiting so rAF loop never renders hidden VFX/warmup objects
    restoreWarmupState();
    detachUnparented();

    if (compilePromises.length > 0) {
      await Promise.all(compilePromises).catch(() => {
        for (const target of compileTargets) {
          renderer.compile(target, camera, scene);
        }
      });
    }

    // Perform one synchronous render pass to force GPU program linking, VAO, & texture upload
    attachUnparented();
    enableWarmupState();
    try {
      renderer.render(scene, camera);
    } catch {
      // Safe no-op if renderer is mocked or WebGL context is unavailable
    } finally {
      restoreWarmupState();
      detachUnparented();
      for (const bucket of this.pools.values()) {
        for (const inst of bucket) {
          inst.root.removeFromParent();
        }
      }
    }

    const total = allKeys.length + 2;
    onProgress({
      loaded: total,
      total,
      percent: 100,
      message: '[READY] 聚变反应堆点火就绪 · 全舰队武装与跃迁引擎待命',
    });
  }

  getPrototype(key: ModelKey): LoadedModelPrototype {
    const proto = this.prototypes.get(key);
    if (!proto) throw new Error(`Model prototype missing: ${key}`);
    return proto;
  }

  getEnvTextures(): ReadonlyMap<string, THREE.Texture> {
    return this.envTextures;
  }

  acquire(key: ModelKey, cloneMaterials = true): PooledModelInstance {
    const pool = this.pools.get(key);
    if (pool && pool.length > 0) {
      const inst = pool.pop()!;
      this.resetInstanceVisuals(inst);
      if (cloneMaterials) {
        const snap = this.snapshots.get(inst);
        if (snap && !snap.materialsCloned) {
          const matInfo = cloneMaterialsOnRoot(inst.modelRoot);
          inst.materials = matInfo.materials;
          inst.baseEmissives = matInfo.baseEmissives;
          inst.baseEmissiveIntensities = matInfo.baseEmissiveIntensities;
          snap.materialsCloned = true;
          snap.materialStates = matInfo.materialStates;
        }
      }
      return inst;
    }
    return this.createInstance(key, cloneMaterials);
  }

  release(inst: PooledModelInstance): void {
    inst.root.removeFromParent();
    this.resetInstanceVisuals(inst);
    let pool = this.pools.get(inst.key);
    if (!pool) {
      pool = [];
      this.pools.set(inst.key, pool);
    }
    if (pool.includes(inst)) return;
    if (pool.length >= MAX_POOL_PER_KEY) {
      // Dispose only cloned materials owned by this excess instance; never dispose shared geometries/textures
      const snap = this.snapshots.get(inst);
      if (snap?.materialsCloned) {
        for (const m of snap.materialStates) {
          m.mat.dispose();
        }
      }
      return;
    }
    pool.push(inst);
  }

  instantiateFresh(key: ModelKey, cloneMaterials = true): PooledModelInstance {
    return this.createInstance(key, cloneMaterials);
  }

  private resetInstanceVisuals(inst: PooledModelInstance): void {
    inst.root.position.set(0, 0, 0);
    inst.root.rotation.set(0, 0, 0);
    inst.root.scale.setScalar(1);
    inst.root.visible = true;

    for (const child of inst.root.children.slice()) {
      if (child !== inst.modelRoot) {
        child.removeFromParent();
      }
    }

    const snap = this.snapshots.get(inst);
    if (snap) {
      for (const n of snap.nodes) {
        n.obj.position.copy(n.position);
        n.obj.quaternion.copy(n.quaternion);
        n.obj.scale.copy(n.scale);
        n.obj.visible = n.visible;
        if (n.morphs) {
          const mesh = n.obj as THREE.Mesh;
          if (Array.isArray(mesh.morphTargetInfluences)) {
            for (let i = 0; i < n.morphs.length; i++) {
              mesh.morphTargetInfluences[i] = n.morphs[i];
            }
          }
        }
      }
      for (const ms of snap.materialStates) {
        ms.mat.opacity = ms.opacity;
        ms.mat.transparent = ms.transparent;
        if (ms.color && 'color' in ms.mat && (ms.mat as { color?: unknown }).color instanceof THREE.Color) {
          ((ms.mat as unknown) as { color: THREE.Color }).color.copy(ms.color);
        }
      }
    } else {
      inst.root.traverse((obj) => {
        obj.visible = true;
      });
    }

    for (let i = 0; i < inst.materials.length; i++) {
      inst.materials[i].emissive.copy(inst.baseEmissives[i]);
      inst.materials[i].emissiveIntensity = inst.baseEmissiveIntensities[i];
    }
  }

  private createInstance(key: ModelKey, cloneMaterials: boolean): PooledModelInstance {
    const proto = this.getPrototype(key);
    const clonedPivot = SkeletonUtils.clone(proto.prototype) as THREE.Group;
    const matInfo = cloneMaterials
      ? cloneMaterialsOnRoot(clonedPivot)
      : { materials: [], baseEmissives: [], baseEmissiveIntensities: [], materialStates: [] };

    const wrapper = new THREE.Group();
    wrapper.name = `inst_${key}`;
    wrapper.add(clonedPivot);

    const inst: PooledModelInstance = {
      key,
      root: wrapper,
      modelRoot: clonedPivot,
      animations: proto.animations,
      materials: matInfo.materials,
      baseEmissives: matInfo.baseEmissives,
      baseEmissiveIntensities: matInfo.baseEmissiveIntensities,
    };

    this.snapshots.set(inst, {
      materialsCloned: cloneMaterials,
      nodes: captureNodeRestStates(clonedPivot),
      materialStates: matInfo.materialStates,
    });

    return inst;
  }
}
