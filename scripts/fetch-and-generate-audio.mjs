import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const RAW_DIR = path.join(ROOT, '.raw_audio');
const RAW_V6_DIR = path.join(RAW_DIR, 'v6_raw');
const RAW_BESPOKE_DIR = path.join(RAW_DIR, 'v6_bespoke');
const OUT_BGM_DIR = path.join(ROOT, 'public', 'audio', 'bgm');
const OUT_SFX_DIR = path.join(ROOT, 'public', 'audio', 'sfx');
const TRAILER_AUDIO_DIR = process.env.STARFORGE_TRAILER_AUDIO_DIR?.trim() ?? '';

const FORCE = process.argv.includes('--force');
const FORCE_ELEVEN = process.argv.includes('--force-elevenlabs');
const ELEVEN_CONCURRENCY = 2;

const TRAILER_REUSE_SPECS = [
  {
    kind: 'bgm',
    key: 'bgm_boot',
    srcFile: 'cue1_pulse_drive.mp3',
    duration: 15.5,
    loop: true,
    influence: 0.45,
    trimSilence: false,
    lufs: -14.5,
    prompt:
      'Seamless instrumental music bed: Modern AAA sci-fi video game launch trailer score, 132 BPM dark cinematic synthwave, deep pulsing analog sub-bass, punchy electronic trailer drums, sleek futuristic arpeggios, high-production instrumental',
  },
  {
    kind: 'sfx',
    key: 'door_bay',
    srcFile: 'sfx01_airlock_breach.mp3',
    duration: 1.8,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Colossal futuristic armored hangar blast doors unlatching with heavy pneumatic hiss, deep metallic mechanical slam, and glowing fusion reactor power-up hum, clean cinematic trailer sound',
  },
  {
    kind: 'sfx',
    key: 'ship_select',
    srcFile: 'sfx02_mech_morph.mp3',
    duration: 1.4,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'High-tech mecha starfighter variable-wing transformation, rapid precision servo actuation, holographic laser scan sweep and crisp metallic lock, sleek sci-fi trailer sound effect',
  },
  {
    kind: 'sfx',
    key: 'ult_aero_chrono',
    srcFile: 'sfx03_chrono_drop.mp3',
    duration: 2.1,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Cinematic sci-fi time-dilation sub-bass drop impact, crystalline prism resonance wave expanding outward with supersonic jet fighter flyby whoosh, modern trailer sound',
  },
  {
    kind: 'sfx',
    key: 'hud_deploy',
    srcFile: 'sfx04a_hud_deploy.mp3',
    duration: 1.1,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Futuristic tactical holographic interface panel deployment whoosh with crisp digital telemetry materialize chime, clean sci-fi HUD sound',
  },
  {
    kind: 'sfx',
    key: 'upgrade_lock',
    srcFile: 'sfx04b_chip_lock.mp3',
    duration: 0.9,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Punchy futuristic metallic power-core socket lock-in click followed by bright energetic amber charge confirmation chime, tight sci-fi UI sound',
  },
  {
    kind: 'sfx',
    key: 'boss_warning',
    srcFile: 'sfx05_crimson_klaxon.mp3',
    duration: 2.2,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Massive cinematic dreadnought boss warning klaxon siren, deep menacing sci-fi horn braam impact and urgent radar alert pulses, blockbuster trailer sound',
  },
  {
    kind: 'sfx',
    key: 'boss_crescendo',
    srcFile: 'cue2_boss_crescendo.mp3',
    duration: 5.5,
    loop: false,
    influence: 0.65,
    trimSilence: false,
    lufs: -14.0,
    prompt:
      'Epic cinematic sci-fi trailer climax music cue, massive Hans Zimmer brass braams, pounding taiko war drums, aggressive distorted synth bass and rising orchestral tension building to a dramatic peak, instrumental',
  },
  {
    kind: 'sfx',
    key: 'ult_astra_beam',
    srcFile: 'sfx06_ion_lance.mp3',
    duration: 2.5,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Futuristic orbital ion cannon charging briefly then firing a colossal sustained roaring plasma laser beam with crackling electromagnetic energy, heavy sci-fi trailer weapon',
  },
  {
    kind: 'sfx',
    key: 'exp_boss',
    srcFile: 'sfx07_supernova_riser.mp3',
    duration: 2.1,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Cataclysmic starship reactor core meltdown explosion, massive seismic sub-bass shockwave boom and white-hot energy flash riser',
  },
  {
    kind: 'sfx',
    key: 'stinger_victory',
    srcFile: 'sfx08_eclipse_stinger.mp3',
    duration: 3.8,
    loop: false,
    influence: 0.65,
    trimSilence: true,
    lufs: -14.0,
    prompt:
      'Monumental triumphant sci-fi game trailer title reveal stinger, deep resonant sub-bass impact, heroic brass and lush shimmering synthesizer chord resolving cleanly in space, instrumental',
  },
];

const BGM_SYNTH_SPECS = [
  {
    key: 'bgm_hangar',
    duration: 24,
    influence: 0.48,
    prompt:
      'Seamless instrumental music bed: Modern AAA sci-fi orbital starport hangar soundtrack, 114 BPM sleek dark cinematic synthwave, warm pulsing analog sub-bass, subtle precision electronic percussion, atmospheric holographic synth pads and futuristic arpeggios, high-production instrumental',
  },
  {
    key: 'bgm_act1',
    duration: 24,
    influence: 0.50,
    prompt:
      'Seamless instrumental music bed: Modern AAA sci-fi starfighter launch combat score, 132 BPM dark cinematic synthwave, deep driving 16th-note analog sub-bass, punchy electronic trailer drums, sleek heroic futuristic synthesizer arpeggios, high-production instrumental',
  },
  {
    key: 'bgm_act2',
    duration: 24,
    influence: 0.50,
    prompt:
      'Seamless instrumental music bed: Modern AAA sci-fi deep space nebula battle soundtrack, 136 BPM dark cinematic cyberpunk synthwave, propulsive pulsing analog bassline, crisp driving electronic war drums, shimmering cosmic lead synthesizer melody and low brass swells, high-production instrumental',
  },
  {
    key: 'bgm_act3',
    duration: 24,
    influence: 0.50,
    prompt:
      'Seamless instrumental music bed: Epic AAA sci-fi fleet assault endgame score, 140 BPM dark industrial synthwave and cinematic trailer hybrid, relentless analog sub-bass, pounding electronic and taiko war drums, urgent soaring synthesizer motif, high-production instrumental',
  },
  {
    key: 'bgm_boss',
    duration: 24,
    influence: 0.52,
    prompt:
      'Seamless instrumental music bed: Colossal AAA sci-fi dreadnought boss battle soundtrack, 138 BPM aggressive darksynth trailer score, menacing Hans Zimmer low brass braams, pounding taiko and electronic war drums, driving distorted analog synth bass ostinato, high-production instrumental',
  },
];

const SFX_SYNTH_SPECS = [
  {
    key: 'shot_astra_1',
    duration: 0.5,
    maxDur: 0.34,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Tight futuristic twin-linked pulse laser cannon shot, crisp electromagnetic snap and short clean plasma bolt transient, modern AAA sci-fi game weapon',
  },
  {
    key: 'shot_astra_2',
    duration: 0.5,
    maxDur: 0.34,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Crisp sci-fi starfighter rapid energy blaster bolt, punchy high-tech laser transient snap, clean dry studio game sound',
  },
  {
    key: 'shot_opus_1',
    duration: 0.55,
    maxDur: 0.4,
    fadeOut: 0.12,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Heavy sci-fi gunship twin autocannon plasma slug shot, deep punchy mechanical thump with metallic electromagnetic rail snap, tight game weapon',
  },
  {
    key: 'shot_opus_2',
    duration: 0.55,
    maxDur: 0.4,
    fadeOut: 0.12,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Armored futuristic assault cannon heavy kinetic-plasma blast, punchy low-mid thud and crisp muzzle crack, modern sci-fi game sound',
  },
  {
    key: 'shot_morph_1',
    duration: 0.5,
    maxDur: 0.36,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Supersonic sci-fi interceptor railgun needle lance shot, sharp high-velocity electromagnetic crack and sleek piercing energy zip, tight game weapon',
  },
  {
    key: 'shot_morph_2',
    duration: 0.5,
    maxDur: 0.36,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Precision futuristic hyper-velocity sniper laser discharge, crisp metallic coilgun snap and clean supersonic plasma whip, tight game sound',
  },
  {
    key: 'shot_aero_1',
    duration: 0.5,
    maxDur: 0.35,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Sleek futuristic photon prism blaster shot, crisp harmonic glass-plasma snap and agile energy pulse, clean AAA sci-fi game weapon',
  },
  {
    key: 'shot_aero_2',
    duration: 0.5,
    maxDur: 0.35,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Crystalline sci-fi ricochet laser bolt, bright focused energy transient ping with tight sub-punch, clean game weapon sound',
  },
  {
    key: 'hit_hull_1',
    duration: 0.5,
    maxDur: 0.32,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Tight futuristic plasma bolt impacting metallic starfighter hull armor, crisp spark crunch and short punchy thud, modern sci-fi hit feedback',
  },
  {
    key: 'hit_hull_2',
    duration: 0.5,
    maxDur: 0.32,
    fadeOut: 0.1,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Punchy sci-fi armor plate impact, sharp metallic ricochet spark and compact energy scorch thump, clean game hit sound',
  },
  {
    key: 'hit_crit',
    duration: 0.6,
    maxDur: 0.46,
    fadeOut: 0.12,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'High-impact sci-fi critical weakpoint armor penetration, heavy metallic shatter crunch with bright high-voltage electric arc snap, punchy game hit',
  },
  {
    key: 'exp_small_1',
    duration: 0.9,
    maxDur: 0.85,
    fadeOut: 0.18,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Compact punchy sci-fi drone fighter mid-air plasma explosion, tight sub-bass boom with crisp metallic debris scatter, modern AAA game sound',
  },
  {
    key: 'exp_small_2',
    duration: 0.9,
    maxDur: 0.85,
    fadeOut: 0.18,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Sharp futuristic interceptor fireball detonation, deep kinetic thump and crackling energy shrapnel burst, clean sci-fi explosion',
  },
  {
    key: 'exp_medium',
    duration: 1.4,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Heavy sci-fi gunship mid-air reactor detonation, powerful sub-bass shockwave boom, metallic hull rupture and plasma crackle, AAA trailer impact',
  },
  {
    key: 'part_break',
    duration: 1.3,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Massive dreadnought armored turret shearing off and exploding, high-voltage electrical arc rupture, heavy steel rending crunch and concussive blast',
  },
  {
    key: 'deflect_parry',
    duration: 0.7,
    maxDur: 0.58,
    fadeOut: 0.14,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Futuristic hexagonal energy shield perfect bullet parry, razor-sharp plasma katana ricochet ping with resonant electromagnetic forcefield pulse',
  },
  {
    key: 'roll_whoosh',
    duration: 0.8,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Supersonic futuristic starfighter aerodynamic barrel-roll dodge, tight vector thruster plasma burst and sleek high-speed air whoosh',
  },
  {
    key: 'launch_sortie',
    duration: 1.6,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Cinematic sci-fi starfighter hangar catapult launch ignition, twin fusion afterburners roaring to life with electromagnetic rail acceleration whoosh, AAA trailer sound',
  },
  {
    key: 'shield_hit',
    duration: 0.85,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Heavy sci-fi cockpit energy shield impact crunch followed by urgent crisp holographic warning chirp, punchy player damage feedback',
  },
  {
    key: 'pickup_item',
    duration: 0.65,
    maxDur: 0.55,
    fadeOut: 0.12,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Sleek futuristic nanite energy cell pickup, magnetic lock snap with warm ascending crystalline synth power-up chime, clean AAA sci-fi UI sound',
  },
  {
    key: 'ui_click',
    duration: 0.5,
    maxDur: 0.18,
    fadeOut: 0.07,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Precision futuristic cockpit tactile button press, ultra-clean metallic micro-click with subtle high-tech glass resonance, dry studio UI sound',
  },
  {
    key: 'ui_hover',
    duration: 0.5,
    maxDur: 0.09,
    fadeOut: 0.04,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Subtle futuristic holographic HUD cursor hover tick, delicate soft high-tech digital micro-pulse, ultra-clean minimal UI sound',
  },
  {
    key: 'ult_opus_nova',
    duration: 1.8,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'Colossal sci-fi electromagnetic pulse nova shockwave detonation, deep seismic sub-bass drop followed by shimmering Aegis energy surge, AAA trailer ultimate',
  },
  {
    key: 'ult_morph_salvo',
    duration: 1.8,
    trimSilence: true,
    influence: 0.65,
    prompt:
      'High-tech mecha micro-missile pod swarm salvo launch, rapid cascading supersonic rocket ignitions and sleek thruster whooshes, AAA sci-fi trailer weapon',
  },
  {
    key: 'stinger_defeat',
    duration: 2.8,
    trimSilence: false,
    influence: 0.65,
    prompt:
      'Cinematic dark sci-fi starfighter reactor power-down failure stinger, deep ominous sub-bass impact, fading turbine whine and cockpit signal lost resonance, instrumental',
  },
];

function loadElevenLabsKey() {
  for (const envName of ['ELEVENLABS_API_KEY', 'XI_API_KEY', 'ElevenLabs']) {
    const val = process.env[envName]?.trim();
    if (val) return val;
  }

  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed
          .slice(idx + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        if (k === 'ElevenLabs' || k === 'ELEVENLABS_API_KEY' || k.toLowerCase().includes('eleven')) {
          if (v) return v;
        }
      } else if (trimmed.startsWith('sk_')) {
        return trimmed;
      }
    }
  }

  for (const rcName of ['.zshrc', '.zshenv', '.zprofile']) {
    const rcPath = path.join(os.homedir(), rcName);
    if (!fs.existsSync(rcPath)) continue;
    const text = fs.readFileSync(rcPath, 'utf8');
    const matches = [
      ...text.matchAll(
        /^\s*(?:export\s+)?(ELEVENLABS_API_KEY|XI_API_KEY|ElevenLabs)\s*=\s*(['"]?)([^\s'"#]+)\2/gm
      ),
    ];
    for (let i = matches.length - 1; i >= 0; i--) {
      const val = matches[i][3]?.trim();
      if (val && !val.startsWith('$')) return val;
    }
  }

  throw new Error('Could not find ElevenLabs API key in env, .env, or ~/.zshrc');
}

async function getSubscriptionCredits(apiKey) {
  const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Subscription check failed (${res.status})`);
  }
  const data = await res.json();
  return {
    tier: data.tier ?? 'unknown',
    used: Number(data.character_count ?? 0),
    limit: Number(data.character_limit ?? 0),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateElevenLabsSound(apiKey, spec, rawDest) {
  if (!FORCE_ELEVEN && fs.existsSync(rawDest) && fs.statSync(rawDest).size > 1000) {
    return 'cached';
  }
  fs.mkdirSync(path.dirname(rawDest), { recursive: true });
  const endpoint = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
  let modelId = 'eleven_text_to_sound_v3';
  const backoffs = [1500, 3000, 6000, 10000];
  let lastErr;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      const payload = {
        text: spec.prompt,
        model_id: modelId,
        duration_seconds: spec.duration,
        prompt_influence: spec.influence ?? 0.65,
      };
      if (spec.loop) {
        payload.loop = true;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        if (
          modelId === 'eleven_text_to_sound_v3' &&
          (res.status === 400 || res.status === 404 || res.status === 422) &&
          /model|v3/i.test(errBody)
        ) {
          console.warn(
            `[audio] Falling back from eleven_text_to_sound_v3 to eleven_text_to_sound_v2 for ${spec.key}`
          );
          modelId = 'eleven_text_to_sound_v2';
          continue;
        }
        const retryable = res.status === 429 || res.status >= 500;
        const err = new Error(`ElevenLabs HTTP ${res.status} (${spec.key}): ${errBody.slice(0, 220)}`);
        if (!retryable || attempt >= backoffs.length) {
          throw err;
        }
        lastErr = err;
        await sleep(backoffs[attempt]);
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length <= 1000) {
        throw new Error(`ElevenLabs output too small (${buf.length} bytes) for ${spec.key}`);
      }
      fs.writeFileSync(rawDest, buf);
      return modelId;
    } catch (err) {
      lastErr = err;
      if (attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
      }
    }
  }
  throw lastErr;
}

function probeAudio(filePath) {
  const out = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,bit_rate,size:stream=sample_rate,channels',
      '-of',
      'json',
      filePath,
    ],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(out);
  const fmt = parsed.format ?? {};
  const stream = (parsed.streams ?? [])[0] ?? {};
  return {
    duration: Number.parseFloat(fmt.duration ?? '0') || 0,
    sizeKb: ((Number.parseInt(fmt.size ?? '0', 10) || fs.statSync(filePath).size) / 1024).toFixed(1),
    sampleRate: Number.parseInt(stream.sample_rate ?? '0', 10) || 0,
    channels: Number.parseInt(stream.channels ?? '0', 10) || 0,
  };
}

function isOutputUpToDate(srcPath, outPath) {
  if (FORCE || !fs.existsSync(outPath)) return false;
  const outStat = fs.statSync(outPath);
  if (outStat.size <= 500) return false;
  const srcStat = fs.statSync(srcPath);
  return outStat.mtimeMs >= srcStat.mtimeMs;
}

function masterTo48kStereo(rawPath, outPath, opts) {
  if (isOutputUpToDate(rawPath, outPath)) {
    return false;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const filters = [];
  if (opts.trimSilence) {
    filters.push('silenceremove=start_periods=1:start_threshold=-48dB:detection=peak');
  }
  if (opts.maxDur && opts.fadeOut) {
    const fadeStart = Math.max(0.04, opts.maxDur - opts.fadeOut).toFixed(3);
    filters.push(`atrim=0:${opts.maxDur}`);
    filters.push(`afade=t=out:st=${fadeStart}:d=${opts.fadeOut}`);
  }
  filters.push(`loudnorm=I=${opts.lufs}:TP=-1.0:LRA=${opts.lra}`);
  if (!opts.loopSeamless) {
    filters.push('afade=t=in:st=0:d=0.003');
  }
  filters.push('alimiter=limit=0.96');

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-i',
      rawPath,
      '-af',
      filters.join(','),
      '-ar',
      '48000',
      '-ac',
      '2',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '192k',
      outPath,
    ],
    { stdio: 'inherit' }
  );
  return true;
}

async function runPool(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) {
        await worker(item);
      }
    }
  });
  await Promise.all(workers);
}

async function processTrailerReuse(apiKey) {
  console.log(`[audio] Syncing ${TRAILER_REUSE_SPECS.length} bespoke trailer stems (48kHz stereo)...`);
  for (const spec of TRAILER_REUSE_SPECS) {
    const extSrc = TRAILER_AUDIO_DIR ? path.join(TRAILER_AUDIO_DIR, spec.srcFile) : '';
    const cacheDest = path.join(RAW_BESPOKE_DIR, `${spec.key}.mp3`);
    const outDir = spec.kind === 'bgm' ? OUT_BGM_DIR : OUT_SFX_DIR;
    const outPath = path.join(outDir, `${spec.key}.mp3`);

    let mode = 'cached-stem';
    if (extSrc && fs.existsSync(extSrc) && fs.statSync(extSrc).size > 1000) {
      fs.mkdirSync(RAW_BESPOKE_DIR, { recursive: true });
      const needCacheCopy =
        FORCE ||
        !fs.existsSync(cacheDest) ||
        fs.statSync(cacheDest).mtimeMs < fs.statSync(extSrc).mtimeMs ||
        fs.statSync(cacheDest).size !== fs.statSync(extSrc).size;
      if (needCacheCopy) {
        fs.copyFileSync(extSrc, cacheDest);
      }
      mode = 'trailer-stem';
    } else if (!fs.existsSync(cacheDest) || fs.statSync(cacheDest).size <= 1000) {
      const rawFallback = path.join(RAW_V6_DIR, `${spec.key}.mp3`);
      const modelUsed = await generateElevenLabsSound(apiKey, spec, rawFallback);
      masterTo48kStereo(rawFallback, cacheDest, {
        trimSilence: spec.trimSilence,
        lufs: spec.lufs,
        lra: spec.loop ? 10 : 9,
        loopSeamless: spec.loop,
      });
      mode = `cold-${modelUsed}`;
    }

    if (!isOutputUpToDate(cacheDest, outPath)) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(cacheDest, outPath);
    }

    const meta = probeAudio(outPath);
    console.log(
      `  [TRAILER:${mode}] ${spec.kind}/${spec.key}.mp3 (${meta.duration.toFixed(2)}s, ${meta.sampleRate}Hz, ${meta.channels}ch, ${meta.sizeKb} KB)`
    );
  }
}

async function processSynthesizedBgm(apiKey) {
  console.log(`[audio] Synthesizing/mastering ${BGM_SYNTH_SPECS.length} seamless 24s BGM tracks...`);
  await runPool(BGM_SYNTH_SPECS, ELEVEN_CONCURRENCY, async (spec) => {
    const rawPath = path.join(RAW_V6_DIR, `${spec.key}.mp3`);
    const outPath = path.join(OUT_BGM_DIR, `${spec.key}.mp3`);
    const status = await generateElevenLabsSound(
      apiKey,
      { ...spec, loop: true },
      rawPath
    );
    masterTo48kStereo(rawPath, outPath, {
      trimSilence: false,
      lufs: -14.5,
      lra: 10,
      loopSeamless: true,
    });
    const meta = probeAudio(outPath);
    console.log(
      `  [BGM:${status}] bgm/${spec.key}.mp3 (${meta.duration.toFixed(2)}s, ${meta.sampleRate}Hz, ${meta.channels}ch, ${meta.sizeKb} KB)`
    );
  });
}

async function processSynthesizedSfx(apiKey) {
  console.log(`[audio] Synthesizing/mastering ${SFX_SYNTH_SPECS.length} bespoke SFX stems...`);
  await runPool(SFX_SYNTH_SPECS, ELEVEN_CONCURRENCY, async (spec) => {
    const rawPath = path.join(RAW_V6_DIR, `${spec.key}.mp3`);
    const outPath = path.join(OUT_SFX_DIR, `${spec.key}.mp3`);
    const status = await generateElevenLabsSound(
      apiKey,
      { ...spec, loop: false },
      rawPath
    );
    masterTo48kStereo(rawPath, outPath, {
      trimSilence: spec.trimSilence,
      maxDur: spec.maxDur,
      fadeOut: spec.fadeOut,
      lufs: -14.0,
      lra: 9,
      loopSeamless: false,
    });
    const meta = probeAudio(outPath);
    console.log(
      `  [SFX:${status}] sfx/${spec.key}.mp3 (${meta.duration.toFixed(2)}s, ${meta.sampleRate}Hz, ${meta.channels}ch, ${meta.sizeKb} KB)`
    );
  });
}

async function main() {
  fs.mkdirSync(RAW_V6_DIR, { recursive: true });
  fs.mkdirSync(RAW_BESPOKE_DIR, { recursive: true });
  fs.mkdirSync(OUT_BGM_DIR, { recursive: true });
  fs.mkdirSync(OUT_SFX_DIR, { recursive: true });

  const candidatesDir = path.join(OUT_BGM_DIR, 'candidates');
  if (fs.existsSync(candidatesDir)) {
    fs.rmSync(candidatesDir, { recursive: true, force: true });
    console.log('[audio] Removed stale public/audio/bgm/candidates directory.');
  }

  const apiKey = loadElevenLabsKey();
  const subBefore = await getSubscriptionCredits(apiKey);
  console.log(
    `[audio] ElevenLabs tier=${subBefore.tier}, credits=${subBefore.used}/${subBefore.limit} (remaining=${subBefore.limit - subBefore.used})`
  );

  await processTrailerReuse(apiKey);
  await processSynthesizedBgm(apiKey);
  await processSynthesizedSfx(apiKey);

  const subAfter = await getSubscriptionCredits(apiKey);
  const delta = subAfter.used - subBefore.used;
  console.log(
    `[audio] DONE v6.0. ElevenLabs used_delta=${delta}, total_used=${subAfter.used}/${subAfter.limit}, remaining=${subAfter.limit - subAfter.used}`
  );
}

main().catch((err) => {
  console.error('[audio] FAILED:', err);
  process.exitCode = 1;
});
