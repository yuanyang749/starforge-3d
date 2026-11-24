import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, '.raw_models');
const OUT_DIR = path.join(ROOT, 'public', 'models');
const DRACO_SRC = path.join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf');
const DRACO_DST = path.join(ROOT, 'public', 'draco');

const MODELS = [
  {
    key: 'ship_astra',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/scenario_asset_WYmwKs64zmsn3wiwESyBDAEW/output.glb',
  },
  {
    key: 'ship_opus',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/scenario_asset_tRFAY31piDXddUGPKBe7zVyR/output.glb',
  },
  // Note: ship_morph.glb (A-103 Valkyrie) is custom sculpted & skeletally rigged via scripts/build-valkyrie-ship.py
  {
    key: 'ship_aero',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/ebf4cd5d64512d0f/24684a129421fdb1.glb',
  },
  {
    key: 'boss_act1_mech',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/scenario_asset_Mdga3DdwBSaJq3S4kxpocqVn/output.glb',
  },
  {
    key: 'boss_act2_crab',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/scenario_asset_hAsw5LdcFW3i4Qk7PaM3hzCa/output.glb',
  },
  {
    key: 'boss_act3_carrier',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/scenario_asset_3eRq7Nh2RpoeUEUr4q2smBxA/output.glb',
  },
  {
    key: 'enemy_drone',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/scenario_asset_BS4GzCyvKhEUwB2mBYvNNzBm/output.glb',
  },
  {
    key: 'enemy_turret',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/e0ea2975c187ec01/4d2b3575269ce6b3.glb',
  },
  {
    key: 'enemy_rover',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/580dedba0aa2f076/05afdc43dc7dcf3f.glb',
  },
  {
    key: 'enemy_foldwing',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/19c1b337b2f05c63/54bfd2aca43e65e2.glb',
  },
  {
    key: 'ally_biplane',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/5eaa67ddddd8f062/a048863bdf9fc58e.glb',
  },
  {
    key: 'prop_gate',
    url: 'https://huggingface.co/datasets/scenario-labs/3d-collection/resolve/main/assets/5cc3bec09b594db5/f8a3560dc69dec8c.glb',
  },
];

async function downloadFile(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
    return;
  }
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

function copyDracoDecoders() {
  if (!fs.existsSync(DRACO_SRC)) {
    console.warn('Warning: Three.js draco folder not found at', DRACO_SRC);
    return;
  }
  fs.mkdirSync(DRACO_DST, { recursive: true });
  for (const file of fs.readdirSync(DRACO_SRC)) {
    fs.copyFileSync(path.join(DRACO_SRC, file), path.join(DRACO_DST, file));
  }
  console.log(`Copied Draco decoders to ${DRACO_DST}`);
}

function countTriangles(doc) {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) {
        tris += Math.floor(indices.getCount() / 3);
      } else {
        const pos = prim.getAttribute('POSITION');
        if (pos) tris += Math.floor(pos.getCount() / 3);
      }
    }
  }
  return tris;
}

function readGlbStats(filePath) {
  const buf = fs.readFileSync(filePath);
  const jlen = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + jlen).toString('utf8'));
  return {
    nodes: (j.nodes || []).length,
    anims: (j.animations || []).length,
    skins: (j.skins || []).length,
  };
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function processModel(item) {
  const rawPath = path.join(RAW_DIR, `${item.key}.glb`);
  const outPath = path.join(OUT_DIR, `${item.key}.glb`);

  await downloadFile(item.url, rawPath);
  const rawSize = fs.statSync(rawPath).size;
  const rawStats = readGlbStats(rawPath);

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  let boundsStr = 'unknown';
  let triangles = 0;
  let optimized = false;

  try {
    const doc = await io.read(rawPath);
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    if (scene) {
      const b = getBounds(scene);
      const dx = (b.max[0] - b.min[0]).toFixed(3);
      const dy = (b.max[1] - b.min[1]).toFixed(3);
      const dz = (b.max[2] - b.min[2]).toFixed(3);
      boundsStr = `(${dx}, ${dy}, ${dz})`;
    }
    triangles = countTriangles(doc);

    const hasRigOrAnim =
      doc.getRoot().listSkins().length > 0 || doc.getRoot().listAnimations().length > 0;
    const textures = doc.getRoot().listTextures();

    if (hasRigOrAnim) {
      if (textures.length > 0) {
        // Preserve bone joints, skin inverseBindMatrices, and animation channels bit-exact:
        // NEVER run prune() or dedup() on rigged or keyframe-animated models.
        await doc.transform(
          textureCompress({
            encoder: sharp,
            targetFormat: 'webp',
            resize: [1024, 1024],
            quality: 82,
          })
        );
        await io.write(outPath, doc);
        const outCheck = readGlbStats(outPath);
        if (
          outCheck.anims !== rawStats.anims ||
          outCheck.skins !== rawStats.skins ||
          outCheck.nodes < rawStats.nodes
        ) {
          throw new Error(
            `Rig/Anim metadata mismatch after textureCompress (${JSON.stringify(outCheck)} vs ${JSON.stringify(rawStats)})`
          );
        }
        optimized = true;
      } else {
        fs.copyFileSync(rawPath, outPath);
      }
    } else {
      if (textures.length > 0) {
        await doc.transform(
          dedup(),
          prune({ keepLeaves: true }),
          textureCompress({
            encoder: sharp,
            targetFormat: 'webp',
            resize: [1024, 1024],
            quality: 82,
          })
        );
      } else {
        await doc.transform(dedup(), prune({ keepLeaves: true }));
      }
      await io.write(outPath, doc);
      optimized = true;
    }
  } catch (err) {
    console.warn(`[fallback raw copy] ${item.key}: ${err.message}`);
    fs.copyFileSync(rawPath, outPath);
  }

  const outSize = fs.statSync(outPath).size;
  const outStats = readGlbStats(outPath);
  return {
    key: item.key,
    rawMB: (rawSize / 1024 / 1024).toFixed(2),
    outMB: (outSize / 1024 / 1024).toFixed(2),
    outBytes: outSize,
    triangles,
    nodes: outStats.nodes,
    anims: outStats.anims,
    skins: outStats.skins,
    boundsStr,
    optimized,
  };
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  copyDracoDecoders();

  console.log(`Downloading & processing ${MODELS.length} animated/articulated GLB models...`);
  const results = await mapConcurrent(MODELS, 4, processModel);

  let totalBytes = 0;
  let totalAnims = 0;
  let totalSkins = 0;
  for (const r of results) {
    totalBytes += r.outBytes;
    totalAnims += r.anims;
    totalSkins += r.skins;
    console.log(
      `${r.key.padEnd(18)} | raw ${r.rawMB.padStart(6)}MB -> out ${r.outMB.padStart(6)}MB | tris=${String(r.triangles).padStart(7)} | nodes=${String(r.nodes).padStart(3)} | anims=${String(r.anims).padStart(3)} | skins=${r.skins} | opt=${String(r.optimized).padEnd(5)} | bbox=${r.boundsStr}`
    );
  }
  console.log(
    `Total public/models size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB | Total anims: ${totalAnims} | Skinned models: ${totalSkins}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
