import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_INDEX = path.join(PROJECT_ROOT, 'dist', 'index.html');
const VITE_BIN = path.join(PROJECT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const CHROME_PATH =
  process.env.CHROME_PATH ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((candidate) => fs.existsSync(candidate)) ||
  null;
const PREVIEW_PORT = 4179;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR || path.join(PROJECT_ROOT, 'test-results');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(url, child, getLogs, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`vite preview exited early (${child.exitCode}):\n${getLogs()}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}:\n${getLogs()}`);
}

function startPreviewServer() {
  if (!fs.existsSync(DIST_INDEX)) {
    throw new Error(`Missing build output at ${DIST_INDEX}. Run "npm run build" first.`);
  }
  if (!fs.existsSync(VITE_BIN)) {
    throw new Error(`Missing Vite CLI at ${VITE_BIN}.`);
  }

  let logs = '';
  const child = spawn(
    process.execPath,
    [VITE_BIN, 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  child.stdout?.on('data', (chunk) => {
    logs += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    logs += chunk.toString();
  });

  return {
    child,
    getLogs: () => logs,
  };
}

async function stopPreviewServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const deadline = Date.now() + 2000;
  while (child.exitCode === null && Date.now() < deadline) {
    await sleep(50);
  }
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

function computePixelMetrics(data, info) {
  const totalPixels = info.width * info.height;
  let litPixels = 0;
  let sumLuma = 0;
  let maxChannel = 0;

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    if (maxC > maxChannel) maxChannel = maxC;
    if (maxC > 22) litPixels += 1;
    sumLuma += 0.299 * r + 0.587 * g + 0.114 * b;
  }

  return {
    raw: data,
    width: info.width,
    height: info.height,
    channels: info.channels,
    litRatio: litPixels / totalPixels,
    meanLuma: sumLuma / totalPixels,
    maxChannel,
  };
}

async function analyzeCenterCanvasPixels(pngBuffer, clipRect) {
  const img = sharp(pngBuffer);
  const meta = await img.metadata();
  const extract = clipRect ?? {
    left: Math.floor((meta.width ?? 1440) * 0.28),
    top: Math.floor((meta.height ?? 900) * 0.14),
    width: Math.floor((meta.width ?? 1440) * 0.44),
    height: Math.floor((meta.height ?? 900) * 0.68),
  };
  const { data, info } = await img
    .extract(extract)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return computePixelMetrics(data, info);
}

async function analyzeFullCanvasPixels(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return computePixelMetrics(data, info);
}

function meanPixelDiff(sampleA, sampleB) {
  assert.equal(sampleA.raw.length, sampleB.raw.length, 'Canvas crop sizes must match for diff');
  let diffSum = 0;
  const totalChannels = sampleA.raw.length;
  for (let i = 0; i < totalChannels; i++) {
    diffSum += Math.abs(sampleA.raw[i] - sampleB.raw[i]);
  }
  return diffSum / totalChannels;
}

async function assertVisibleImagesLoaded(page, stageLabel) {
  await page
    .waitForFunction(
      () => {
        for (const img of document.querySelectorAll('img')) {
          if (img.closest('[hidden]')) continue;
          if (img.closest('dialog:not([open])')) continue;
          const style = window.getComputedStyle(img);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            continue;
          }
          const rect = img.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          if (!img.complete) return false;
        }
        return true;
      },
      null,
      { timeout: 3000 }
    )
    .catch(() => {});

  const badImages = await page.evaluate(() => {
    const issues = [];
    for (const img of document.querySelectorAll('img')) {
      if (img.closest('[hidden]')) continue;
      if (img.closest('dialog:not([open])')) continue;
      const style = window.getComputedStyle(img);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (!img.complete || img.naturalWidth === 0) {
        issues.push({
          id: img.id || '(no-id)',
          className: img.className,
          src: img.getAttribute('src') || img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
        });
      }
    }
    return issues;
  });
  assert.equal(
    badImages.length,
    0,
    `[${stageLabel}] Found broken visible <img> elements: ${JSON.stringify(badImages)}`
  );
}

async function assertRectFitsViewport(rect, vw, vh, label) {
  assert.ok(rect.width > 0 && rect.height > 0, `${label} must have non-zero size`);
  assert.ok(
    rect.left >= -1 && rect.top >= -1 && rect.right <= vw + 1 && rect.bottom <= vh + 1,
    `${label} clipped outside ${vw}x${vh}: ${JSON.stringify(rect)}`
  );
}

function rectsOverlap(a, b, tolerance = 2) {
  return !(
    a.right <= b.left + tolerance ||
    a.left >= b.right - tolerance ||
    a.bottom <= b.top + tolerance ||
    a.top >= b.bottom - tolerance
  );
}

async function runTests() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const { child: serverProc, getLogs } = startPreviewServer();
  let browser;
  const httpErrors = [];
  const pageErrors = [];
  const consoleErrors = [];
  let passedChecks = 0;

  const check = (cond, msg) => {
    assert.ok(cond, msg);
    passedChecks += 1;
  };

  try {
    await waitForServerReady(PREVIEW_URL, serverProc, getLogs);
    console.log(`[e2e] Preview server listening at ${PREVIEW_URL}`);

    const launchOptions = {
      headless: true,
      args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
    };
    if (CHROME_PATH && fs.existsSync(CHROME_PATH)) {
      launchOptions.executablePath = CHROME_PATH;
    } else {
      launchOptions.channel = 'chrome';
    }
    browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    page.on('response', (res) => {
      if (res.status() >= 400) {
        httpErrors.push({ status: res.status(), url: res.url() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err?.stack || err?.message || String(err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ==================== STAGE 1: Bootloader ====================
    console.log('[e2e] Stage 1: Bootloader & Asset Preload...');
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const pct = document.getElementById('boot-progress-pct')?.textContent?.trim();
        const btn = document.getElementById('boot-enter-btn');
        return pct === '100%' && btn instanceof HTMLButtonElement && !btn.disabled;
      },
      null,
      { timeout: 45000, polling: 25 }
    );

    const bootState = await page.evaluate(() => {
      const pct = document.getElementById('boot-progress-pct')?.textContent?.trim();
      const btn = document.getElementById('boot-enter-btn');
      const logLines = document.querySelectorAll('#boot-log .boot-log-line').length;
      const canvas = document.getElementById('game-canvas');
      const gl =
        canvas instanceof HTMLCanvasElement
          ? canvas.getContext('webgl2') || canvas.getContext('webgl')
          : null;
      return {
        pct,
        disabled: btn instanceof HTMLButtonElement ? btn.disabled : true,
        logLines,
        hasWebGL: Boolean(gl && !gl.isContextLost()),
        hasHook: Boolean(window.__STARFORGE__),
        loadProgress: window.__STARFORGE__?.getSnapshot().loadProgress ?? -1,
      };
    });
    check(bootState.pct === '100%', `Expected boot progress 100%, got ${bootState.pct}`);
    check(bootState.loadProgress === 100, `Expected snapshot loadProgress 100, got ${bootState.loadProgress}`);
    check(!bootState.disabled, 'Expected #boot-enter-btn enabled');
    check(bootState.logLines >= 14, `Expected >=14 boot log lines, got ${bootState.logLines}`);
    check(bootState.hasWebGL, 'Expected active WebGL context without context loss');
    check(bootState.hasHook, 'Expected window.__STARFORGE__ QA hook to be registered');

    await assertVisibleImagesLoaded(page, 'bootloader');
    passedChecks += 1;

    await page.click('#boot-enter-btn');

    // ==================== STAGE 2: Hangar & 4 Ships ====================
    console.log('[e2e] Stage 2: 3D Hangar & 4-Ship Verification...');
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-screen');
        const hangar = document.getElementById('hangar-ui');
        return Boolean(boot?.hidden && hangar && !hangar.hidden);
      },
      null,
      { timeout: 10000 }
    );

    const shipCardsCount = await page.locator('#hangar-ship-list .hangar-ship-card').count();
    check(shipCardsCount === 4, `Expected 4 ship cards in hangar, got ${shipCardsCount}`);

    const expectedShips = [
      { id: 'astra', aiTag: 'GPT-6 Astra 3D' },
      { id: 'opus', aiTag: 'Claude Opus 5.5 3D' },
      { id: 'morph', aiTag: 'GPT-6 Astra · 3D-to-3D' },
      { id: 'aero', aiTag: 'GPT-6 Astra · 3D-to-3D' },
    ];

    const shipPixelSamples = [];
    for (let i = 0; i < expectedShips.length; i++) {
      await page.locator('#hangar-ship-list .hangar-ship-card').nth(i).click();
      await sleep(320);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

      const uiInfo = await page.evaluate(() => ({
        shipName: document.getElementById('hangar-ship-name')?.textContent?.trim() || '',
        aiTag: document.getElementById('hangar-ai-tag')?.textContent?.trim() || '',
        snap: window.__STARFORGE__.getSnapshot(),
      }));

      check(
        uiInfo.snap.selectedShipId === expectedShips[i].id,
        `Expected selectedShipId=${expectedShips[i].id}, got ${uiInfo.snap.selectedShipId}`
      );
      check(
        uiInfo.aiTag.includes(expectedShips[i].aiTag),
        `Expected AI tag to include "${expectedShips[i].aiTag}", got "${uiInfo.aiTag}"`
      );
      await assertVisibleImagesLoaded(page, `hangar-${expectedShips[i].id}`);
      passedChecks += 1;

      const canvasBuf = await page.locator('#game-canvas').screenshot();
      const sample = await analyzeCenterCanvasPixels(canvasBuf);
      check(
        sample.litRatio > 0.08 && sample.maxChannel > 70,
        `Hangar ship ${expectedShips[i].id} rendered too dark/black: litRatio=${sample.litRatio.toFixed(3)}, max=${sample.maxChannel}`
      );
      shipPixelSamples.push({ id: expectedShips[i].id, sample });
    }

    // Confirm distinct 3D models render across ships
    for (let i = 1; i < shipPixelSamples.length; i++) {
      const diff = meanPixelDiff(shipPixelSamples[0].sample, shipPixelSamples[i].sample);
      check(
        diff > 1.2,
        `Expected distinct 3D canvas render between ${shipPixelSamples[0].id} and ${shipPixelSamples[i].id}, got meanDiff=${diff.toFixed(2)}`
      );
    }

    // Switch back to Astra (index 0) for illuminated Hangar brightness check & v2 screenshot
    await page.locator('#hangar-ship-list .hangar-ship-card').nth(0).click();
    await sleep(320);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const hangarCanvasBuf = await page.locator('#game-canvas').screenshot();
    const hangarFull = await analyzeFullCanvasPixels(hangarCanvasBuf);
    console.log(`[e2e] Hangar full-canvas meanLuma=${hangarFull.meanLuma.toFixed(2)}`);
    check(
      hangarFull.meanLuma > 26,
      `Expected bright Hangar full-canvas meanLuma > 26, got ${hangarFull.meanLuma.toFixed(2)}`
    );
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2_01_hangar_bright.png') });
    console.log('[e2e] Saved v2_01_hangar_bright.png');

    // ==================== STAGE 3: Active Combat, Passives, Roll & Ultimates ====================
    console.log('[e2e] Stage 3: Active Combat, Ship Passives, Roll & Ultimates...');

    // 3a. Morph sortie (+1 base pierce + 18x homing missile trail & enemy plasma orbs)
    await page.locator('#hangar-ship-list .hangar-ship-card').nth(2).click();
    await page.click('#hangar-launch-btn');
    await page.waitForFunction(() => !document.getElementById('hud-ui')?.hidden, null, {
      timeout: 5000,
    });
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.enemyCount >= 2 && s.enemyBulletCount >= 1;
      },
      null,
      { timeout: 6000 }
    ).catch(() => {});
    await sleep(350);

    const morphSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(morphSnap.selectedShipId === 'morph', `Expected morph sortie, got ${morphSnap.selectedShipId}`);
    check(morphSnap.mode === 'playing', `Expected playing state after launch, got ${morphSnap.mode}`);
    check(morphSnap.pierceCount >= 1, `Expected ship_morph passive pierceCount >= 1, got ${morphSnap.pierceCount}`);

    // Fill/Trigger Ultimate on Morph (18x Missile Salvo) and capture rich homing trail + enemy plasma orbs
    await page.evaluate(() => {
      window.__STARFORGE__.fillUltimate();
    });
    const filledSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(filledSnap.ultCharge >= 100, `Expected ultCharge >= 100 after fillUltimate(), got ${filledSnap.ultCharge}`);

    const morphUltTriggered = await page.evaluate(() => window.__STARFORGE__.triggerUltimate());
    check(morphUltTriggered === true, 'Expected Morph triggerUltimate() to return true');
    await sleep(220);
    const afterUltSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(afterUltSnap.ultCharge === 0, `Expected ultCharge reset to 0 after triggerUltimate(), got ${afterUltSnap.ultCharge}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2_05_homing_ult_vfx.png') });
    console.log('[e2e] Saved v2_05_homing_ult_vfx.png');

    // Trigger Barrel Roll and verify cooldown/invulnerability
    const rollTriggered = await page.evaluate(() => window.__STARFORGE__.triggerBarrelRoll());
    check(rollTriggered === true, 'Expected triggerBarrelRoll() to return true');
    await sleep(120);
    const rollSnap = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      rollStatus: document.getElementById('hud-roll-status')?.textContent?.trim(),
    }));
    check(rollSnap.snap.rollCooldown > 0, `Expected rollCooldown > 0 after triggerBarrelRoll, got ${rollSnap.snap.rollCooldown}`);
    check(rollSnap.snap.rollActive === true, `Expected rollActive === true during roll, got ${rollSnap.snap.rollActive}`);
    check(rollSnap.snap.invulnTimer > 0, `Expected invulnTimer > 0 during barrel roll, got ${rollSnap.snap.invulnTimer}`);
    check(rollSnap.rollStatus !== 'READY', `Expected #hud-roll-status cooldown text, got ${rollSnap.rollStatus}`);

    // 3b. Aero sortie (+15% crit & refractive purple bounce + Act 1 metropolis HDR combat + Fresnel hex roll shield)
    await page.evaluate(() => {
      window.__STARFORGE__.selectShip(3);
      window.__STARFORGE__.startSortie();
    });
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.enemyCount >= 2 && s.enemyBulletCount >= 1;
      },
      null,
      { timeout: 8000 }
    ).catch(() => {});
    for (const [x, y] of [
      [520, 340],
      [720, 380],
      [920, 340],
      [720, 450],
      [560, 480],
      [880, 480],
    ]) {
      await page.mouse.move(x, y);
      await sleep(220);
    }

    // Measure Act 1 full-canvas luminance before triggering roll/ult overlay effects
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const act1CombatBuf = await page.locator('#game-canvas').screenshot();
    const act1Full = await analyzeFullCanvasPixels(act1CombatBuf);
    console.log(`[e2e] Act 1 full-canvas meanLuma=${act1Full.meanLuma.toFixed(2)}`);
    check(
      act1Full.meanLuma > 24,
      `Expected Act 1 full-canvas meanLuma > 24, got ${act1Full.meanLuma.toFixed(2)}`
    );

    // Wait for continuous player bolts + incoming enemy plasma orbs before triggering roll shield
    await page.mouse.move(720, 440);
    await page
      .waitForFunction(
        () => {
          const s = window.__STARFORGE__.getSnapshot();
          return s.playerBulletCount >= 3 && s.enemyBulletCount >= 1;
        },
        null,
        { timeout: 3000 }
      )
      .catch(() => {});

    await page.evaluate(() => {
      window.__STARFORGE__.fillUltimate();
    });
    const aeroUltTriggered = await page.evaluate(() => window.__STARFORGE__.triggerUltimate());
    check(aeroUltTriggered === true, 'Expected Aero triggerUltimate() to return true');
    await page.evaluate(() => {
      window.__STARFORGE__.triggerBarrelRoll();
    });
    await sleep(170);

    const aeroSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(aeroSnap.selectedShipId === 'aero', `Expected aero sortie, got ${aeroSnap.selectedShipId}`);
    check(
      aeroSnap.critChance >= 0.25,
      `Expected ship_aero passive critChance >= 0.25, got ${aeroSnap.critChance}`
    );
    check(
      aeroSnap.ultActiveTimer > 0,
      `Expected Aero Chrono Prism ultActiveTimer > 0, got ${aeroSnap.ultActiveTimer}`
    );
    console.log(
      `[e2e] Stage 3 telemetry: morph.pierceCount=${morphSnap.pierceCount}, aero.critChance=${aeroSnap.critChance}, aeroBounceCount=${aeroSnap.aeroBounceCount}, kills=${aeroSnap.kills}`
    );
    await assertVisibleImagesLoaded(page, 'combat-hud');
    passedChecks += 1;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2_02_act1_metropolis_bullets.png') });
    console.log('[e2e] Saved v2_02_act1_metropolis_bullets.png');

    // ==================== STAGE 4: Modals (<dialog>) ====================
    console.log('[e2e] Stage 4: Native <dialog> Pause & Upgrade Modals...');

    await page.click('#hud-pause-btn');
    await page.waitForFunction(() => document.getElementById('pause-dialog')?.hasAttribute('open'));
    const pauseOpenSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(pauseOpenSnap.dialogs?.pauseOpen === true, 'Expected pauseOpen=true when pause dialog opens');
    await assertVisibleImagesLoaded(page, 'pause-dialog');
    passedChecks += 1;

    await page.click('#pause-dialog button[value="resume"]');
    await page.waitForFunction(() => !document.getElementById('pause-dialog')?.hasAttribute('open'));
    const pauseClosedSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(pauseClosedSnap.dialogs?.pauseOpen === false, 'Expected pauseOpen=false after resume');

    // Open Upgrade Modal
    await page.evaluate(() => window.__STARFORGE__.forceUpgradeModal());
    await page.waitForFunction(() => document.getElementById('upgrade-dialog')?.hasAttribute('open'));
    const upgOpenInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      cards: document.querySelectorAll('#upgrade-cards-grid .chip-card').length,
    }));
    check(upgOpenInfo.snap.dialogs?.upgradeOpen === true, 'Expected upgradeOpen=true');
    check(upgOpenInfo.cards === 3, `Expected 3 upgrade cards, got ${upgOpenInfo.cards}`);
    await assertVisibleImagesLoaded(page, 'upgrade-dialog');
    passedChecks += 1;

    // Confirm Escape does NOT close mandatory upgrade modal
    await page.keyboard.press('Escape');
    await sleep(120);
    const stillOpen = await page.evaluate(
      () => document.getElementById('upgrade-dialog')?.hasAttribute('open') ?? false
    );
    check(stillOpen, 'Expected #upgrade-dialog (closedby="none") to resist Escape');

    // Select first upgrade card
    await page.locator('#upgrade-cards-grid .chip-card').first().click();
    await page.waitForFunction(() => !document.getElementById('upgrade-dialog')?.hasAttribute('open'));
    const chipCount = await page.locator('#hud-chip-strip .hud-chip-mini').count();
    check(chipCount >= 1, `Expected >=1 mini chip icon in #hud-chip-strip, got ${chipCount}`);
    await assertVisibleImagesLoaded(page, 'hud-after-upgrade');
    passedChecks += 1;

    // ==================== STAGE 5: Act 1/2/3 Bosses, Biomes & Part Destruction ====================
    console.log('[e2e] Stage 5: Act 1/2/3 Bosses, Biome Differentiation & Destructible Parts...');

    // Act 1 Boss & Biome sampling
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(1));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.boss && s.boss.act === 1 && !document.getElementById('boss-hud')?.hidden;
      },
      null,
      { timeout: 5000 }
    );
    await sleep(320);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const act1BossInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      partPills: document.querySelectorAll('#boss-parts-row .boss-part-pill').length,
    }));
    check(
      act1BossInfo.snap.boss?.act === 1 && act1BossInfo.partPills === 2,
      `Act 1 boss HUD mismatch: ${JSON.stringify(act1BossInfo)}`
    );
    const act1BossBuf = await page.locator('#game-canvas').screenshot();
    const act1BossFull = await analyzeFullCanvasPixels(act1BossBuf);
    check(
      act1BossFull.meanLuma > 24,
      `Expected Act 1 Boss full-canvas meanLuma > 24, got ${act1BossFull.meanLuma.toFixed(2)}`
    );

    // Act 2 Boss, Nebula Biome & Opening Warp Gate (spawns at 2.0s dt, opens at z>=-165)
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(2));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.boss && s.boss.act === 2 && !document.getElementById('boss-hud')?.hidden;
      },
      null,
      { timeout: 5000 }
    );
    await page.mouse.move(320, 380);
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let simTime = 0;
          let last = performance.now();
          let rolled = false;
          function step(now) {
            const rawDt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
            last = now;
            simTime += rawDt;
            if (simTime >= 2.6 && !rolled) {
              rolled = true;
              window.__STARFORGE__.triggerBarrelRoll();
            }
            if (simTime >= 5.9) {
              resolve();
            } else {
              requestAnimationFrame(step);
            }
          }
          requestAnimationFrame(step);
        })
    );
    await page.mouse.move(720, 450);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const act2BossInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      partPills: document.querySelectorAll('#boss-parts-row .boss-part-pill').length,
    }));
    check(
      act2BossInfo.snap.boss?.act === 2 && act2BossInfo.partPills === 2,
      `Act 2 boss HUD mismatch: ${JSON.stringify(act2BossInfo)}`
    );
    const act2CanvasBuf = await page.locator('#game-canvas').screenshot();
    const act2Full = await analyzeFullCanvasPixels(act2CanvasBuf);
    console.log(`[e2e] Act 2 full-canvas meanLuma=${act2Full.meanLuma.toFixed(2)}`);
    check(
      act2Full.meanLuma > 24,
      `Expected Act 2 full-canvas meanLuma > 24, got ${act2Full.meanLuma.toFixed(2)}`
    );
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2_03_act2_nebula_warpgate.png') });
    console.log('[e2e] Saved v2_03_act2_nebula_warpgate.png');

    // Act 3 Boss, Dreadnought Trench Biome & Destructible Part Break
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(3));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.boss && s.boss.act === 3 && !document.getElementById('boss-hud')?.hidden;
      },
      null,
      { timeout: 5000 }
    );
    await sleep(320);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const act3BeforeInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      partPills: document.querySelectorAll('#boss-parts-row .boss-part-pill').length,
    }));
    check(
      act3BeforeInfo.snap.boss?.act === 3 && act3BeforeInfo.partPills === 2,
      `Act 3 boss HUD mismatch: ${JSON.stringify(act3BeforeInfo)}`
    );

    const act3CanvasBuf = await page.locator('#game-canvas').screenshot();
    const act3Full = await analyzeFullCanvasPixels(act3CanvasBuf);
    console.log(`[e2e] Act 3 full-canvas meanLuma=${act3Full.meanLuma.toFixed(2)}`);
    check(
      act3Full.meanLuma > 24,
      `Expected Act 3 full-canvas meanLuma > 24, got ${act3Full.meanLuma.toFixed(2)}`
    );

    const diff12 = meanPixelDiff(act1Full, act2Full);
    const diff23 = meanPixelDiff(act2Full, act3Full);
    const diff13 = meanPixelDiff(act1Full, act3Full);
    console.log(
      `[e2e] Multi-Act differentiation meanDiff: Act1-2=${diff12.toFixed(2)}, Act2-3=${diff23.toFixed(2)}, Act1-3=${diff13.toFixed(2)}`
    );
    check(diff12 > 6.0, `Expected Act 1 vs Act 2 meanDiff > 6.0, got ${diff12.toFixed(2)}`);
    check(diff23 > 6.0, `Expected Act 2 vs Act 3 meanDiff > 6.0, got ${diff23.toFixed(2)}`);
    check(diff13 > 6.0, `Expected Act 1 vs Act 3 meanDiff > 6.0, got ${diff13.toFixed(2)}`);

    const act3Before = act3BeforeInfo.snap;
    const targetPart = act3Before.boss.parts[0];
    const targetPartId = targetPart.id;
    const partKillDmg = targetPart.maxHp + 40;
    const hpBefore = act3Before.boss.hp;

    const partDamaged = await page.evaluate(
      ({ pid, dmg }) => window.__STARFORGE__.damageBossPart(pid, dmg),
      { pid: targetPartId, dmg: partKillDmg }
    );
    check(partDamaged === true, `Expected damageBossPart(${targetPartId}) to return true`);
    await sleep(160);

    const act3AfterPart = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      brokenPills: document.querySelectorAll('#boss-parts-row .boss-part-pill.is-broken').length,
    }));
    check(
      act3AfterPart.snap.boss.parts[0].destroyed === true,
      `Expected part ${targetPartId} destroyed, got ${JSON.stringify(act3AfterPart.snap.boss.parts[0])}`
    );
    check(
      act3AfterPart.brokenPills >= 1,
      `Expected >=1 .boss-part-pill.is-broken in HUD, got ${act3AfterPart.brokenPills}`
    );
    check(
      act3AfterPart.snap.boss.hp > 0 && act3AfterPart.snap.boss.hp < hpBefore,
      `Expected boss alive with reduced HP after part break (0 < ${act3AfterPart.snap.boss.hp} < ${hpBefore})`
    );
    check(
      act3AfterPart.snap.boss.dying === false,
      `Expected boss.dying === false after breaking single part, got ${act3AfterPart.snap.boss.dying}`
    );
    await assertVisibleImagesLoaded(page, 'boss-hud');
    passedChecks += 1;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2_04_act3_citadel_boss.png') });
    console.log('[e2e] Saved v2_04_act3_citadel_boss.png');

    // ==================== STAGE 6: Slow-Mo Boss Kill, Victory, Save & Endless ====================
    console.log('[e2e] Stage 6: Slow-Mo Boss Kill, Victory Dialog, Save & Endless Mode...');

    const bossKilled = await page.evaluate(() => window.__STARFORGE__.damageBossCore(999999));
    check(bossKilled === true, 'Expected damageBossCore() to return true');
    await sleep(120);

    const midDeathSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(midDeathSnap.boss?.dying === true, `Expected boss.dying === true during slow-mo kill, got ${JSON.stringify(midDeathSnap.boss)}`);
    check(
      midDeathSnap.invulnTimer >= 2.0,
      `Expected player invulnerability >= 2.0s during boss slow-mo death, got invulnTimer=${midDeathSnap.invulnTimer}`
    );
    check(
      midDeathSnap.enemyBulletCount === 0,
      `Expected enemy bullets cleared on boss fatal hit, got ${midDeathSnap.enemyBulletCount}`
    );
    check(
      !midDeathSnap.dialogs?.resultOpen,
      'Expected slow-mo death sequence (~1.8s) before result dialog opens'
    );

    // Wait for slow-mo sequence (~1.8s) to complete and open #result-dialog
    await page.waitForFunction(
      () => document.getElementById('result-dialog')?.hasAttribute('open'),
      null,
      { timeout: 6000 }
    );
    await sleep(320);

    const resultInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      endlessBtnHidden: document.getElementById('result-endless-btn')?.hidden ?? true,
      title: document.getElementById('result-dialog-title')?.textContent?.trim() || '',
      rawSave: localStorage.getItem('starforge_armada_save_v1'),
    }));
    check(resultInfo.snap.dialogs?.resultOpen === true, 'Expected resultOpen=true');
    check(!resultInfo.endlessBtnHidden, 'Expected #result-endless-btn visible on campaign victory');
    check(resultInfo.title.includes('CAMPAIGN CLEARED'), `Unexpected victory title: ${resultInfo.title}`);
    check(Boolean(resultInfo.rawSave), 'Expected localStorage save under starforge_armada_save_v1');

    const parsedSave = JSON.parse(resultInfo.rawSave);
    check(parsedSave.totalRuns >= 1, `Expected save totalRuns >= 1, got ${parsedSave.totalRuns}`);
    check(parsedSave.endlessUnlocked === true, `Expected save endlessUnlocked === true, got ${parsedSave.endlessUnlocked}`);
    check(
      (parsedSave.ships?.aero?.clears ?? 0) >= 1,
      `Expected aero clear count >= 1 in save, got ${JSON.stringify(parsedSave.ships)}`
    );

    await assertVisibleImagesLoaded(page, 'victory-dialog');
    passedChecks += 1;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v2_06_victory_dialog.png') });
    console.log('[e2e] Saved v2_06_victory_dialog.png');

    // Enter Endless Mode
    await page.click('#result-endless-btn');
    await page.waitForFunction(
      () =>
        !document.getElementById('result-dialog')?.hasAttribute('open') &&
        window.__STARFORGE__.getSnapshot().mode !== 'result',
      null,
      { timeout: 5000 }
    );
    const endlessSnap = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      actLabel: document.getElementById('hud-act-label')?.textContent?.trim() || '',
    }));
    check(
      endlessSnap.snap.endless === true,
      `Expected snapshot.endless === true after clicking Endless Mode, got ${JSON.stringify(endlessSnap)}`
    );
    check(
      endlessSnap.actLabel.includes('无尽深空'),
      `Expected endless HUD label, got "${endlessSnap.actLabel}"`
    );

    // ==================== STAGE 7: 1280x720 Responsive Bounds Check ====================
    console.log('[e2e] Stage 7: 1280x720 Responsive Bounds & Overlap Checks...');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(3));
    await sleep(350);

    const hudLayout720 = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        tl: box('.hud-cluster-tl'),
        tc: box('.hud-cluster-tc'),
        boss: box('#boss-hud'),
        legend: box('.hud-controls-legend'),
        br: box('.hud-cluster-br'),
      };
    });
    check(
      hudLayout720.scrollW <= hudLayout720.innerW,
      `Horizontal overflow on HUD at 1280x720: scrollWidth=${hudLayout720.scrollW} > innerWidth=${hudLayout720.innerW}`
    );
    await assertRectFitsViewport(hudLayout720.tl, 1280, 720, 'HUD top-left');
    await assertRectFitsViewport(hudLayout720.tc, 1280, 720, 'HUD top-center');
    await assertRectFitsViewport(hudLayout720.boss, 1280, 720, 'Boss HUD');
    await assertRectFitsViewport(hudLayout720.legend, 1280, 720, 'HUD legend');
    await assertRectFitsViewport(hudLayout720.br, 1280, 720, 'HUD bottom-right');
    check(!rectsOverlap(hudLayout720.tl, hudLayout720.tc), 'HUD top-left overlaps top-center at 1280x720');
    check(!rectsOverlap(hudLayout720.legend, hudLayout720.br), 'HUD legend overlaps bottom-right skills at 1280x720');
    passedChecks += 7;

    // Upgrade dialog responsive check at 1280x720
    await page.evaluate(() => window.__STARFORGE__.forceUpgradeModal());
    await page.waitForFunction(() => document.getElementById('upgrade-dialog')?.hasAttribute('open'));
    const upgRect720 = await page.evaluate(() => {
      const r = document.querySelector('#upgrade-dialog .dialog-shell').getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    });
    await assertRectFitsViewport(upgRect720, 1280, 720, 'Upgrade dialog at 1280x720');
    passedChecks += 1;
    await page.locator('#upgrade-cards-grid .chip-card').first().click();
    await page.waitForFunction(() => !document.getElementById('upgrade-dialog')?.hasAttribute('open'));

    // Hangar responsive check at 1280x720
    await page.click('#hud-pause-btn');
    await page.waitForFunction(() => document.getElementById('pause-dialog')?.hasAttribute('open'));
    await page.click('#pause-dialog button[value="hangar"]');
    await page.waitForFunction(() => !document.getElementById('hangar-ui')?.hidden);
    await sleep(250);

    const hangarLayout720 = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        leftCol: box('.hangar-left-col'),
        rightCol: box('.hangar-right-col'),
        launchBtn: box('#hangar-launch-btn'),
      };
    });
    check(
      hangarLayout720.scrollW <= hangarLayout720.innerW,
      `Horizontal overflow on Hangar at 1280x720: scrollWidth=${hangarLayout720.scrollW} > innerWidth=${hangarLayout720.innerW}`
    );
    await assertRectFitsViewport(hangarLayout720.leftCol, 1280, 720, 'Hangar left col at 1280x720');
    await assertRectFitsViewport(hangarLayout720.rightCol, 1280, 720, 'Hangar right col at 1280x720');
    await assertRectFitsViewport(hangarLayout720.launchBtn, 1280, 720, 'Hangar launch button at 1280x720');
    check(
      !rectsOverlap(hangarLayout720.leftCol, hangarLayout720.rightCol),
      'Hangar left and right columns overlap at 1280x720'
    );
    passedChecks += 5;

    // ==================== STAGE 8: Zero Error Invariant ====================
    console.log('[e2e] Stage 8: Zero HTTP/Page/Console Error Verification...');
    check(httpErrors.length === 0, `HTTP >=400 failures detected: ${JSON.stringify(httpErrors)}`);
    check(pageErrors.length === 0, `Uncaught pageerror(s): ${JSON.stringify(pageErrors)}`);
    check(consoleErrors.length === 0, `Console error(s): ${JSON.stringify(consoleErrors)}`);

    console.log(`[e2e] ALL 8 STAGES PASSED (${passedChecks} assertions).`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await stopPreviewServer(serverProc);
  }
}

runTests().catch((err) => {
  console.error('[e2e] FAILED:', err);
  process.exitCode = 1;
});
