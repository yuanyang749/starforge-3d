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
const FORBIDDEN_META_RE =
  /GPT|Claude|Opus|Scenario-Labs|CC BY|PROMPT|提示词|千模|\.glb|\btris\b|AI ARMADA|AI 舰队|真实骨骼|跳字/i;

function assertImmersionPurity(text, stageLabel) {
  const match = text.match(FORBIDDEN_META_RE);
  assert.equal(
    match,
    null,
    `[${stageLabel}] Immersion purity violation matched "${match?.[0]}" in text: ${text.slice(0, 280)}`
  );
  assert.equal(
    text.includes('//'),
    false,
    `[${stageLabel}] UI still contains forbidden "//" separator in text: ${text.slice(0, 280)}`
  );
}

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

async function assertFpsHudVisible(page, stageLabel) {
  const info = await page.evaluate(() => {
    const hud = document.getElementById('fps-hud');
    const btn = document.getElementById('fps-hud-btn');
    const val = document.getElementById('fps-hud-val')?.textContent?.trim() || '';
    const mode = document.getElementById('fps-hud-mode')?.textContent?.trim() || '';
    if (!hud || !btn) return null;
    const style = getComputedStyle(hud);
    const r = btn.getBoundingClientRect();
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: Number.parseFloat(style.opacity || '1'),
      rect: {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      },
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      valNum: Number.parseInt(val, 10),
      mode,
      text: btn.innerText || '',
    };
  });
  assert.ok(info, `[${stageLabel}] Missing #fps-hud or #fps-hud-btn`);
  assert.notEqual(info.display, 'none', `[${stageLabel}] #fps-hud has display:none`);
  assert.equal(info.visibility, 'visible', `[${stageLabel}] #fps-hud visibility=${info.visibility}`);
  assert.ok(info.opacity > 0.5, `[${stageLabel}] #fps-hud opacity too low: ${info.opacity}`);
  assert.ok(
    info.rect.width >= 100 && info.rect.height >= 24,
    `[${stageLabel}] #fps-hud-btn rect collapsed: ${JSON.stringify(info.rect)}`
  );
  await assertRectFitsViewport(info.rect, info.innerW, info.innerH, `${stageLabel} #fps-hud-btn`);
  assert.ok(Number.isFinite(info.valNum) && info.valNum >= 1, `[${stageLabel}] Invalid FPS value: "${info.text}"`);
  assert.ok(info.text.includes('FPS'), `[${stageLabel}] Expected "FPS" label in #fps-hud: "${info.text}"`);
  assert.ok(
    info.mode.includes('[G]') && /自动|720P|1080P|2K|4K/.test(info.mode),
    `[${stageLabel}] Unexpected #fps-hud-mode text: "${info.mode}"`
  );
  assertImmersionPurity(info.text, `fps-${stageLabel}`);
  return info.rect;
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
      const bootText = document.getElementById('boot-screen')?.innerText || '';
      const canvas = document.getElementById('game-canvas');
      const gl =
        canvas instanceof HTMLCanvasElement
          ? canvas.getContext('webgl2') || canvas.getContext('webgl')
          : null;
      return {
        title: document.title,
        pct,
        disabled: btn instanceof HTMLButtonElement ? btn.disabled : true,
        logLines,
        bootText,
        hasWebGL: Boolean(gl && !gl.isContextLost()),
        hasHook: Boolean(window.__STARFORGE__),
        loadProgress: window.__STARFORGE__?.getSnapshot().loadProgress ?? -1,
      };
    });
    check(
      bootState.title.includes('星穹战翼：破晓远征') &&
        bootState.title.includes('STARFORGE: ECLIPSE VANGUARD'),
      `Expected title to include immersive v3 brand, got "${bootState.title}"`
    );
    check(bootState.pct === '100%', `Expected boot progress 100%, got ${bootState.pct}`);
    check(bootState.loadProgress === 100, `Expected snapshot loadProgress 100, got ${bootState.loadProgress}`);
    check(!bootState.disabled, 'Expected #boot-enter-btn enabled');
    check(bootState.logLines >= 14, `Expected >=14 boot log lines, got ${bootState.logLines}`);
    check(bootState.hasWebGL, 'Expected active WebGL context without context loss');
    check(bootState.hasHook, 'Expected window.__STARFORGE__ QA hook to be registered');
    assertImmersionPurity(bootState.bootText, 'bootloader');
    passedChecks += 1;

    await assertVisibleImagesLoaded(page, 'bootloader');
    passedChecks += 1;
    await assertFpsHudVisible(page, 'bootloader');
    passedChecks += 1;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_01_bootloader.png') });
    console.log('[e2e] Saved v4_01_bootloader.png');

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
      { id: 'astra', corpsTag: '赫利俄斯航宇' },
      { id: 'opus', corpsTag: '伏尔甘重工' },
      { id: 'morph', corpsTag: '瓦尔基里特装' },
      { id: 'aero', corpsTag: '暴风气动院' },
    ];

    const shipPixelSamples = [];
    for (let i = 0; i < expectedShips.length; i++) {
      await page.locator('#hangar-ship-list .hangar-ship-card').nth(i).click();
      await sleep(320);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

      const uiInfo = await page.evaluate(() => ({
        shipName: document.getElementById('hangar-ship-name')?.textContent?.trim() || '',
        corpsTag: document.getElementById('hangar-corps-tag')?.textContent?.trim() || '',
        loreText: document.getElementById('hangar-lore')?.textContent?.trim() || '',
        hasBlueprintSvg: Boolean(document.querySelector('#hangar-blueprint-svg svg')),
        specCellCount: document.querySelectorAll('#hangar-spec-grid .bp-spec-cell').length,
        statPipCount: document.querySelectorAll('#hangar-stats .stat-pip').length,
        hangarText: document.getElementById('hangar-ui')?.innerText || '',
        snap: window.__STARFORGE__.getSnapshot(),
      }));

      check(
        uiInfo.snap.selectedShipId === expectedShips[i].id,
        `Expected selectedShipId=${expectedShips[i].id}, got ${uiInfo.snap.selectedShipId}`
      );
      check(
        uiInfo.corpsTag === expectedShips[i].corpsTag,
        `Expected #hangar-corps-tag="${expectedShips[i].corpsTag}", got "${uiInfo.corpsTag}"`
      );
      check(
        uiInfo.hasBlueprintSvg,
        `Expected holographic SVG schematic inside #hangar-blueprint-svg for ${expectedShips[i].id}`
      );
      check(
        uiInfo.specCellCount === 4,
        `Expected 4 .bp-spec-cell telemetry items for ${expectedShips[i].id}, got ${uiInfo.specCellCount}`
      );
      check(
        uiInfo.statPipCount === 48,
        `Expected 48 segmented stat pips (4x12) for ${expectedShips[i].id}, got ${uiInfo.statPipCount}`
      );
      check(
        uiInfo.loreText.length > 20,
        `Expected non-empty #hangar-lore for ${expectedShips[i].id}, got "${uiInfo.loreText}"`
      );
      assertImmersionPurity(uiInfo.hangarText, `hangar-${expectedShips[i].id}`);
      passedChecks += 1;
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

    // Switch back to Astra (index 0) for illuminated Hangar brightness check & v4 screenshot
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

    const hangarAudioSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    console.log(
      `[e2e] Stage 2 audio: sfx=${hangarAudioSnap.audio.loadedSfxCount}/${hangarAudioSnap.audio.totalSfxCount}, bgm=${hangarAudioSnap.audio.loadedBgmCount}/${hangarAudioSnap.audio.totalBgmCount}, activeBgm=${hangarAudioSnap.audio.activeBgm}, unlocked=${hangarAudioSnap.audio.unlocked}`
    );
    check(
      hangarAudioSnap.audio.totalSfxCount >= 18 &&
        hangarAudioSnap.audio.loadedSfxCount === hangarAudioSnap.audio.totalSfxCount,
      `Expected all SFX loaded (${hangarAudioSnap.audio.loadedSfxCount}/${hangarAudioSnap.audio.totalSfxCount})`
    );
    check(
      hangarAudioSnap.audio.loadedBgmCount >= 2,
      `Expected >=2 core BGM tracks preloaded, got ${hangarAudioSnap.audio.loadedBgmCount}`
    );
    check(
      hangarAudioSnap.audio.activeBgm === 'hangar' && hangarAudioSnap.audio.muffled === false,
      `Expected activeBgm='hangar' and muffled=false in Hangar, got ${JSON.stringify(hangarAudioSnap.audio)}`
    );

    const hangarLayout1440 = await page.evaluate(() => {
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
        shipList: box('#hangar-ship-list'),
        blueprintPanel: box('#hangar-blueprint-panel'),
        loreBox: box('#hangar-lore'),
        controlTip: box('#hangar-control-tip'),
        controlTipText: document.getElementById('hangar-control-tip')?.innerText?.trim() || '',
        launchBtn: box('#hangar-launch-btn'),
        rightScrollOverflowY:
          (document.querySelector('.hangar-right-col .panel-scroll-inner')?.scrollHeight ?? 0) -
          (document.querySelector('.hangar-right-col .panel-scroll-inner')?.clientHeight ?? 0),
      };
    });
    check(
      hangarLayout1440.scrollW <= hangarLayout1440.innerW,
      `Horizontal overflow on Hangar at 1440x900: scrollWidth=${hangarLayout1440.scrollW} > innerWidth=${hangarLayout1440.innerW}`
    );
    await assertRectFitsViewport(hangarLayout1440.leftCol, 1440, 900, 'Hangar left col at 1440x900');
    await assertRectFitsViewport(hangarLayout1440.rightCol, 1440, 900, 'Hangar right col at 1440x900');
    await assertRectFitsViewport(hangarLayout1440.blueprintPanel, 1440, 900, 'Hangar blueprint at 1440x900');
    await assertRectFitsViewport(hangarLayout1440.loreBox, 1440, 900, 'Hangar lore at 1440x900');
    await assertRectFitsViewport(hangarLayout1440.controlTip, 1440, 900, 'Hangar mouse control tip at 1440x900');
    await assertRectFitsViewport(hangarLayout1440.launchBtn, 1440, 900, 'Hangar launch button at 1440x900');
    check(
      hangarLayout1440.controlTipText.includes('鼠标') &&
        hangarLayout1440.controlTip.bottom <= hangarLayout1440.launchBtn.top + 1,
      `Expected #hangar-control-tip directly above #hangar-launch-btn, got tip=${JSON.stringify(hangarLayout1440.controlTip)} btn=${JSON.stringify(hangarLayout1440.launchBtn)} text="${hangarLayout1440.controlTipText}"`
    );
    check(
      hangarLayout1440.rightScrollOverflowY <= 2,
      `Expected zero vertical scroll overflow in right Hangar col at 1440x900, got ${hangarLayout1440.rightScrollOverflowY}px`
    );
    check(
      !rectsOverlap(hangarLayout1440.leftCol, hangarLayout1440.rightCol),
      'Hangar left and right columns overlap at 1440x900'
    );
    check(
      !rectsOverlap(hangarLayout1440.shipList, hangarLayout1440.blueprintPanel),
      'Hangar ship list overlaps blueprint panel at 1440x900'
    );
    const hangarFpsRect1440 = await assertFpsHudVisible(page, 'hangar-1440');
    const hangarMuteRect1440 = await page.evaluate(() => {
      const r = document.getElementById('hangar-mute-btn')?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
    });
    check(
      Boolean(hangarMuteRect1440) && !rectsOverlap(hangarFpsRect1440, hangarMuteRect1440),
      'Hangar #fps-hud overlaps #hangar-mute-btn at 1440x900'
    );
    passedChecks += 9;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_02_hangar_astra.png') });
    console.log('[e2e] Saved v4_02_hangar_astra.png');

    // Open hardware & resolution picker popover, inspect purity & geometry, capture v4_07, then dismiss via Escape
    await page.click('#fps-hud-btn');
    await sleep(160);
    const gfxPanelOpenInfo = await page.evaluate(() => {
      const btn = document.getElementById('fps-hud-btn');
      const panel = document.getElementById('gfx-popover-panel');
      const r = panel ? panel.getBoundingClientRect() : null;
      return {
        expanded: btn?.getAttribute('aria-expanded') || '',
        hidden: panel?.hidden ?? true,
        rect: r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null,
        gpu: document.getElementById('gfx-hw-gpu')?.textContent?.trim() || '',
        sys: document.getElementById('gfx-hw-sys')?.textContent?.trim() || '',
        buf: document.getElementById('gfx-hw-buf')?.textContent?.trim() || '',
        text: panel?.innerText || '',
      };
    });
    check(gfxPanelOpenInfo.expanded === 'true' && !gfxPanelOpenInfo.hidden, 'Expected #gfx-popover-panel to open when clicking #fps-hud-btn');
    check(Boolean(gfxPanelOpenInfo.rect) && gfxPanelOpenInfo.rect.width >= 260 && gfxPanelOpenInfo.rect.height >= 240, `Invalid #gfx-popover-panel rect: ${JSON.stringify(gfxPanelOpenInfo.rect)}`);
    await assertRectFitsViewport(gfxPanelOpenInfo.rect, 1440, 900, 'Gfx popover panel at 1440x900');
    check(gfxPanelOpenInfo.gpu.length > 0 && gfxPanelOpenInfo.gpu !== '检测中', `Expected detected GPU label, got "${gfxPanelOpenInfo.gpu}"`);
    check(gfxPanelOpenInfo.sys.includes('核') && gfxPanelOpenInfo.buf.includes('像素'), `Expected hardware summary & buffer readout, got sys="${gfxPanelOpenInfo.sys}" buf="${gfxPanelOpenInfo.buf}"`);
    assertImmersionPurity(gfxPanelOpenInfo.text, 'gfx-popover-panel');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_07_gfx_hardware_picker.png') });
    console.log('[e2e] Saved v4_07_gfx_hardware_picker.png');
    await page.keyboard.press('Escape');
    await sleep(120);
    const gfxPanelClosedInfo = await page.evaluate(() => ({
      expanded: document.getElementById('fps-hud-btn')?.getAttribute('aria-expanded') || '',
      hidden: document.getElementById('gfx-popover-panel')?.hidden ?? false,
    }));
    check(gfxPanelClosedInfo.expanded === 'false' && gfxPanelClosedInfo.hidden === true, 'Expected Escape to dismiss #gfx-popover-panel cleanly');
    passedChecks += 6;

    // Capture Opus vs Morph in 3D Hangar for visual model comparison
    await page.locator('#hangar-ship-list .hangar-ship-card').nth(1).click();
    await sleep(240);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_02b_hangar_opus.png') });
    console.log('[e2e] Saved v4_02b_hangar_opus.png');

    // Verify pointer-tracking spotlight coordinates & hover state over Morph card
    const morphCardBox = await page.locator('#hangar-ship-list .hangar-ship-card').nth(2).boundingBox();
    check(Boolean(morphCardBox), 'Expected bounding box for Morph ship card');
    await page.mouse.move(morphCardBox.x + 20, morphCardBox.y + 18);
    await sleep(60);
    await page.mouse.move(
      morphCardBox.x + morphCardBox.width * 0.65,
      morphCardBox.y + morphCardBox.height * 0.5,
      { steps: 5 }
    );
    await sleep(160);
    const spotlightVars = await page.evaluate(() => {
      const cards = document.querySelectorAll('#hangar-ship-list .hangar-ship-card');
      const card = cards[2];
      return {
        mouseX: card ? card.style.getPropertyValue('--mouse-x').trim() : '',
        mouseY: card ? card.style.getPropertyValue('--mouse-y').trim() : '',
      };
    });
    check(
      spotlightVars.mouseX.endsWith('px') && spotlightVars.mouseY.endsWith('px'),
      `Expected --mouse-x / --mouse-y updated on hover, got ${JSON.stringify(spotlightVars)}`
    );
    await page.locator('#hangar-ship-list .hangar-ship-card').nth(2).click();
    await page.mouse.move(
      morphCardBox.x + morphCardBox.width * 0.65,
      morphCardBox.y + morphCardBox.height * 0.5,
      { steps: 3 }
    );
    await sleep(320);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_03_hangar_hover_morph.png') });
    console.log('[e2e] Saved v4_03_hangar_hover_morph.png');

    // ==================== STAGE 3: Active Combat, Passives, Roll & Ultimates ====================
    console.log('[e2e] Stage 3: Active Combat, Ship Passives, Roll & Ultimates...');

    // 3a. Morph sortie (verify 3 -> 2 -> 1 launch countdown transition before enemies engage)
    await page.locator('#hangar-ship-list .hangar-ship-card').nth(2).click();
    await page.click('#hangar-launch-btn');
    await page.waitForFunction(() => !document.getElementById('hud-ui')?.hidden, null, {
      timeout: 5000,
    });
    await sleep(180);
    const countdownInfo = await page.evaluate(() => {
      const el = document.getElementById('launch-countdown');
      return {
        snap: window.__STARFORGE__.getSnapshot(),
        hidden: el?.hidden ?? true,
        numText: document.getElementById('launch-countdown-num')?.textContent?.trim() || '',
        fullText: el?.innerText || '',
      };
    });
    check(
      countdownInfo.snap.countdownActive === true &&
        countdownInfo.hidden === false &&
        ['3', '2', '1'].includes(countdownInfo.numText),
      `Expected active 3-2-1 launch countdown overlay after sortie launch, got ${JSON.stringify(countdownInfo)}`
    );
    check(
      countdownInfo.snap.enemyCount === 0,
      `Expected 0 enemies spawned during launch countdown, got ${countdownInfo.snap.enemyCount}`
    );
    assertImmersionPurity(countdownInfo.fullText, 'launch-countdown');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_03b_launch_countdown.png') });
    console.log('[e2e] Saved v4_03b_launch_countdown.png');

    // Wait for 3-2-1 countdown to finish and wave enemies to engage
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.countdownActive === false && document.getElementById('launch-countdown')?.hidden === true;
      },
      null,
      { timeout: 6000 }
    );
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

    await page.evaluate(() => {
      window.__STARFORGE__.spawnPickupNow('repair', -4.2, 0.2, -13);
      window.__STARFORGE__.spawnPickupNow('energy', 4.2, 0.2, -13);
    });
    await sleep(120);

    const aeroSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(aeroSnap.selectedShipId === 'aero', `Expected aero sortie, got ${aeroSnap.selectedShipId}`);
    check(
      aeroSnap.pickupCount >= 2,
      `Expected >=2 active 3D pickups spawned for HUD/visual inspection, got ${aeroSnap.pickupCount}`
    );
    check(
      aeroSnap.critChance >= 0.25,
      `Expected ship_aero passive critChance >= 0.25, got ${aeroSnap.critChance}`
    );
    check(
      aeroSnap.ultActiveTimer > 0,
      `Expected Aero Chrono Prism ultActiveTimer > 0, got ${aeroSnap.ultActiveTimer}`
    );
    check(
      aeroSnap.audio?.activeBgm === 'act1' && aeroSnap.audio?.muffled === false,
      `Expected activeBgm='act1' and muffled=false in Act 1 combat, got ${JSON.stringify(aeroSnap.audio)}`
    );
    console.log(
      `[e2e] Stage 3 telemetry: morph.pierceCount=${morphSnap.pierceCount}, aero.critChance=${aeroSnap.critChance}, aeroBounceCount=${aeroSnap.aeroBounceCount}, kills=${aeroSnap.kills}`
    );
    const hudCheck = await page.evaluate(() => ({
      combatHudText: document.getElementById('hud-ui')?.innerText || '',
      hasVisorOverlay: Boolean(document.querySelector('.hud-visor-overlay')),
      hasSvgReticle: Boolean(document.querySelector('#hud-reticle svg')),
      hasHpGhost: Boolean(document.getElementById('hud-hp-ghost')),
    }));
    check(!hudCheck.hasVisorOverlay, 'Expected .hud-visor-overlay to be removed from #hud-ui');
    check(hudCheck.hasSvgReticle, 'Expected vector SVG flight reticle inside #hud-reticle');
    check(hudCheck.hasHpGhost, 'Expected #hud-hp-ghost trailing HP fill element');
    assertImmersionPurity(hudCheck.combatHudText, 'combat-hud');
    await assertVisibleImagesLoaded(page, 'combat-hud');
    await assertFpsHudVisible(page, 'combat-hud');
    passedChecks += 5;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_04_combat_hud.png') });
    console.log('[e2e] Saved v4_04_combat_hud.png');

    // ==================== STAGE 4: Modals (<dialog>) ====================
    console.log('[e2e] Stage 4: Native <dialog> Pause (ESC + Button) & Upgrade Modals...');

    // 4a. Keyboard Escape must open #pause-dialog AND keep it open after keyup (no CloseWatcher instant-dismiss)
    await page.keyboard.press('Escape');
    await sleep(360);
    const escPauseOpenInfo = await page.evaluate(() => ({
      openAttr: document.getElementById('pause-dialog')?.hasAttribute('open') ?? false,
      snap: window.__STARFORGE__.getSnapshot(),
      text: document.getElementById('pause-dialog')?.innerText || '',
    }));
    check(
      escPauseOpenInfo.openAttr === true && escPauseOpenInfo.snap.dialogs?.pauseOpen === true,
      `Expected pressing Escape during combat to open and hold #pause-dialog, got ${JSON.stringify(escPauseOpenInfo.snap.dialogs)} mode=${escPauseOpenInfo.snap.mode}`
    );
    check(
      escPauseOpenInfo.snap.mode === 'paused' && escPauseOpenInfo.snap.audio?.muffled === true,
      `Expected mode=paused and audio.muffled=true after Escape, got mode=${escPauseOpenInfo.snap.mode} audio=${JSON.stringify(escPauseOpenInfo.snap.audio)}`
    );
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_04b_pause_esc.png') });
    console.log('[e2e] Saved v4_04b_pause_esc.png');

    // Second Escape press must close #pause-dialog and resume gameplay cleanly
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () =>
        !document.getElementById('pause-dialog')?.hasAttribute('open') &&
        window.__STARFORGE__.getSnapshot().mode === 'playing',
      null,
      { timeout: 3000 }
    );
    const escPauseClosedSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(
      escPauseClosedSnap.dialogs?.pauseOpen === false && escPauseClosedSnap.audio?.muffled === false,
      `Expected second Escape to resume combat & unmuffle audio, got ${JSON.stringify(escPauseClosedSnap.audio)}`
    );

    // 4b. Also verify Pause button click + Resume button flow
    await page.click('#hud-pause-btn');
    await page.waitForFunction(() => document.getElementById('pause-dialog')?.hasAttribute('open'));
    const pauseOpenInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      text: document.getElementById('pause-dialog')?.innerText || '',
    }));
    check(pauseOpenInfo.snap.dialogs?.pauseOpen === true, 'Expected pauseOpen=true when pause dialog opens');
    check(pauseOpenInfo.snap.audio?.muffled === true, `Expected audio.muffled=true during pause dialog, got ${JSON.stringify(pauseOpenInfo.snap.audio)}`);
    assertImmersionPurity(pauseOpenInfo.text, 'pause-dialog');
    passedChecks += 1;
    await assertVisibleImagesLoaded(page, 'pause-dialog');
    await assertFpsHudVisible(page, 'pause-dialog');
    passedChecks += 2;

    await page.click('#pause-dialog button[value="resume"]');
    await page.waitForFunction(
      () =>
        !document.getElementById('pause-dialog')?.hasAttribute('open') &&
        window.__STARFORGE__.getSnapshot().mode === 'playing'
    );
    const pauseClosedSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(pauseClosedSnap.dialogs?.pauseOpen === false, 'Expected pauseOpen=false after resume');
    check(pauseClosedSnap.audio?.muffled === false, `Expected audio.muffled=false after resuming combat, got ${JSON.stringify(pauseClosedSnap.audio)}`);

    // Open Upgrade Modal
    await page.evaluate(() => window.__STARFORGE__.forceUpgradeModal());
    await page.waitForFunction(() => document.getElementById('upgrade-dialog')?.hasAttribute('open'));
    await sleep(320);
    const upgOpenInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      cards: document.querySelectorAll('#upgrade-cards-grid .chip-card').length,
      text: document.getElementById('upgrade-dialog')?.innerText || '',
    }));
    check(upgOpenInfo.snap.dialogs?.upgradeOpen === true, 'Expected upgradeOpen=true');
    check(upgOpenInfo.snap.audio?.muffled === true, `Expected audio.muffled=true during upgrade dialog, got ${JSON.stringify(upgOpenInfo.snap.audio)}`);
    check(upgOpenInfo.cards === 3, `Expected 3 upgrade cards, got ${upgOpenInfo.cards}`);
    assertImmersionPurity(upgOpenInfo.text, 'upgrade-dialog');
    passedChecks += 1;
    await assertVisibleImagesLoaded(page, 'upgrade-dialog');
    await assertFpsHudVisible(page, 'upgrade-dialog');
    passedChecks += 2;

    const firstChipBox = await page.locator('#upgrade-cards-grid .chip-card').first().boundingBox();
    if (firstChipBox) {
      await page.mouse.move(
        firstChipBox.x + firstChipBox.width * 0.5,
        firstChipBox.y + firstChipBox.height * 0.45,
        { steps: 4 }
      );
      await sleep(160);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_05_upgrade_dialog.png') });
    console.log('[e2e] Saved v4_05_upgrade_dialog.png');

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
    const upgClosedAudio = await page.evaluate(() => window.__STARFORGE__.getSnapshot().audio);
    check(upgClosedAudio?.muffled === false, `Expected audio.muffled=false after closing upgrade dialog, got ${JSON.stringify(upgClosedAudio)}`);
    const chipCount = await page.locator('#hud-chip-strip .hud-chip-mini').count();
    check(chipCount >= 1, `Expected >=1 mini chip icon in #hud-chip-strip, got ${chipCount}`);
    await assertVisibleImagesLoaded(page, 'hud-after-upgrade');
    passedChecks += 1;

    // ==================== STAGE 5: 4-Act Bosses, Slow-Mo Intro Cinema, Biomes & Part Destruction ====================
    console.log('[e2e] Stage 5: 4-Act Bosses, Slow-Mo Intro Cinema, Biome Differentiation & Destructible Parts...');

    // Wait for background BGM tracks (act2, act3, boss) to finish decoding cleanly
    await page
      .waitForFunction(
        () => {
          const a = window.__STARFORGE__.getSnapshot().audio;
          return a && a.loadedBgmCount === a.totalBgmCount;
        },
        null,
        { timeout: 8000 }
      )
      .catch(() => {});

    // Act 1 Boss (Skyward Valkyrie) with full 3-Beat Cinema Slow-Mo Entrance!
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(1, { playIntro: true }));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        const ov = document.getElementById('boss-cinema-overlay');
        return Boolean(
          s.bossIntroActive &&
            s.boss?.entering &&
            ov &&
            !ov.hidden &&
            ov.classList.contains('is-card-visible')
        );
      },
      null,
      { timeout: 4000 }
    );
    await sleep(320);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const introCinemaInfo = await page.evaluate(() => {
      const ov = document.getElementById('boss-cinema-overlay');
      const card = document.getElementById('boss-cinema-card');
      const r = card ? card.getBoundingClientRect() : null;
      return {
        snap: window.__STARFORGE__.getSnapshot(),
        overlayHidden: ov?.hidden ?? true,
        isActive: ov?.classList.contains('is-active') ?? false,
        isCardVisible: ov?.classList.contains('is-card-visible') ?? false,
        bossHudHidden: document.getElementById('boss-hud')?.hidden ?? false,
        cinemaName: document.getElementById('boss-cinema-name')?.textContent?.trim() || '',
        cinemaText: ov?.innerText || '',
        cardRect: r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null,
      };
    });
    console.log(
      `[e2e] Boss Slow-Mo Intro Beat 2: timeScale=${introCinemaInfo.snap.timeScale}, fov=${introCinemaInfo.snap.cameraFov}, progress=${introCinemaInfo.snap.boss?.introProgress}`
    );
    check(
      introCinemaInfo.snap.bossIntroActive === true && introCinemaInfo.snap.boss?.entering === true,
      `Expected active Boss slow-mo entrance state, got ${JSON.stringify(introCinemaInfo.snap.boss)}`
    );
    check(
      introCinemaInfo.snap.timeScale > 0 && introCinemaInfo.snap.timeScale < 0.45,
      `Expected bullet-time slow-mo timeScale < 0.45 during Boss intro, got ${introCinemaInfo.snap.timeScale}`
    );
    check(
      introCinemaInfo.snap.cameraFov < 56,
      `Expected telephoto cinema FOV < 56 during Boss close-up sweep, got ${introCinemaInfo.snap.cameraFov}`
    );
    check(
      !introCinemaInfo.overlayHidden && introCinemaInfo.isActive && introCinemaInfo.isCardVisible,
      `Expected visible widescreen letterbox & title slam card during Beat 2, got ${JSON.stringify(introCinemaInfo)}`
    );
    check(
      introCinemaInfo.bossHudHidden === true,
      'Expected top #boss-hud hidden during widescreen Boss entrance Beat 2'
    );
    check(
      introCinemaInfo.cinemaName.includes('云穹折翼指挥舰'),
      `Expected Act 1 Boss cinema name 云穹折翼指挥舰, got "${introCinemaInfo.cinemaName}"`
    );
    await assertRectFitsViewport(introCinemaInfo.cardRect, 1440, 900, 'Boss cinema title card at 1440x900');
    assertImmersionPurity(introCinemaInfo.cinemaText, 'boss-cinema-overlay');
    passedChecks += 2;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_05b_boss_intro_slowmo.png') });
    console.log('[e2e] Saved v4_05b_boss_intro_slowmo.png');

    // Wait for 3-beat Boss entrance (~2.65s) to snap back cleanly into active combat
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return (
          s.boss &&
          s.boss.act === 1 &&
          !s.bossIntroActive &&
          !s.boss.entering &&
          !document.getElementById('boss-hud')?.hidden
        );
      },
      null,
      { timeout: 6000 }
    );
    await sleep(320);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const act1BossInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      partPills: document.querySelectorAll('#boss-parts-row .boss-part-pill').length,
      threatBadge: document.getElementById('boss-hud-threat-badge')?.textContent?.trim() || '',
      intelLine: document.getElementById('boss-hud-intel')?.textContent?.trim() || '',
      hudText: document.getElementById('boss-hud')?.innerText || '',
      hasBossHpGhost: Boolean(document.getElementById('boss-hud-hp-ghost')),
    }));
    check(
      act1BossInfo.snap.audio?.loadedBgmCount === act1BossInfo.snap.audio?.totalBgmCount &&
        act1BossInfo.snap.audio?.activeBgm === 'boss' &&
        act1BossInfo.snap.audio?.muffled === false,
      `Expected all BGM tracks loaded, activeBgm='boss' and muffled=false after intro, got ${JSON.stringify(act1BossInfo.snap.audio)}`
    );
    check(
      act1BossInfo.snap.timeScale >= 0.95,
      `Expected timeScale restored to ~1.0 after Boss intro, got ${act1BossInfo.snap.timeScale}`
    );
    check(
      act1BossInfo.hasBossHpGhost,
      'Expected #boss-hud-hp-ghost trailing Boss HP element'
    );
    check(
      act1BossInfo.snap.boss?.act === 1 && act1BossInfo.partPills === 2,
      `Act 1 boss HUD mismatch: ${JSON.stringify(act1BossInfo)}`
    );
    check(
      act1BossInfo.threatBadge.includes('威胁 III 级'),
      `Expected Act 1 #boss-hud-threat-badge, got "${act1BossInfo.threatBadge}"`
    );
    check(
      act1BossInfo.intelLine.includes('战术弱点'),
      `Expected Act 1 #boss-hud-intel, got "${act1BossInfo.intelLine}"`
    );
    assertImmersionPurity(act1BossInfo.hudText, 'boss-hud-act1');
    passedChecks += 1;
    const act1BossBuf = await page.locator('#game-canvas').screenshot();
    const act1BossFull = await analyzeFullCanvasPixels(act1BossBuf);
    check(
      act1BossFull.meanLuma > 24,
      `Expected Act 1 Boss full-canvas meanLuma > 24, got ${act1BossFull.meanLuma.toFixed(2)}`
    );

    // Act 2 Boss (Restored Orbital Metropolis Corridor + Ironclad Mech)
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(2));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.boss && s.boss.act === 2 && !document.getElementById('boss-hud')?.hidden;
      },
      null,
      { timeout: 5000 }
    );
    await sleep(320);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const act2BossInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      partPills: document.querySelectorAll('#boss-parts-row .boss-part-pill').length,
      threatBadge: document.getElementById('boss-hud-threat-badge')?.textContent?.trim() || '',
      intelLine: document.getElementById('boss-hud-intel')?.textContent?.trim() || '',
      hudText: document.getElementById('boss-hud')?.innerText || '',
    }));
    check(
      act2BossInfo.snap.boss?.act === 2 && act2BossInfo.partPills === 2,
      `Act 2 boss HUD mismatch: ${JSON.stringify(act2BossInfo)}`
    );
    check(
      act2BossInfo.threatBadge.includes('威胁 IV 级'),
      `Expected Act 2 #boss-hud-threat-badge, got "${act2BossInfo.threatBadge}"`
    );
    check(
      act2BossInfo.intelLine.includes('战术弱点'),
      `Expected Act 2 #boss-hud-intel, got "${act2BossInfo.intelLine}"`
    );
    assertImmersionPurity(act2BossInfo.hudText, 'boss-hud-act2');
    passedChecks += 1;
    const act2CanvasBuf = await page.locator('#game-canvas').screenshot();
    const act2Full = await analyzeFullCanvasPixels(act2CanvasBuf);
    console.log(`[e2e] Act 2 (Orbital Metropolis) full-canvas meanLuma=${act2Full.meanLuma.toFixed(2)}`);
    check(
      act2Full.meanLuma > 24,
      `Expected Act 2 full-canvas meanLuma > 24, got ${act2Full.meanLuma.toFixed(2)}`
    );

    // Act 3 Boss, Nebula Biome & Opening Warp Gate (spawns at 2.0s dt, opens at z>=-195)
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(3));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.boss && s.boss.act === 3 && !document.getElementById('boss-hud')?.hidden;
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

    const act3BossInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      partPills: document.querySelectorAll('#boss-parts-row .boss-part-pill').length,
      threatBadge: document.getElementById('boss-hud-threat-badge')?.textContent?.trim() || '',
      intelLine: document.getElementById('boss-hud-intel')?.textContent?.trim() || '',
      hudText: document.getElementById('boss-hud')?.innerText || '',
    }));
    check(
      act3BossInfo.snap.boss?.act === 3 && act3BossInfo.partPills === 2,
      `Act 3 boss HUD mismatch: ${JSON.stringify(act3BossInfo)}`
    );
    check(
      act3BossInfo.threatBadge.includes('威胁 V 级'),
      `Expected Act 3 #boss-hud-threat-badge, got "${act3BossInfo.threatBadge}"`
    );
    check(
      act3BossInfo.intelLine.includes('战术弱点'),
      `Expected Act 3 #boss-hud-intel, got "${act3BossInfo.intelLine}"`
    );
    assertImmersionPurity(act3BossInfo.hudText, 'boss-hud-act3');
    passedChecks += 1;
    const act3CanvasBuf = await page.locator('#game-canvas').screenshot();
    const act3Full = await analyzeFullCanvasPixels(act3CanvasBuf);
    console.log(`[e2e] Act 3 (Warp Gateway) full-canvas meanLuma=${act3Full.meanLuma.toFixed(2)}`);
    check(
      act3Full.meanLuma > 24,
      `Expected Act 3 full-canvas meanLuma > 24, got ${act3Full.meanLuma.toFixed(2)}`
    );

    // Act 4 Boss, Dreadnought Trench Biome & Destructible Part Break
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(4));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.boss && s.boss.act === 4 && !document.getElementById('boss-hud')?.hidden;
      },
      null,
      { timeout: 5000 }
    );
    await sleep(320);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const act4BeforeInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      partPills: document.querySelectorAll('#boss-parts-row .boss-part-pill').length,
      threatBadge: document.getElementById('boss-hud-threat-badge')?.textContent?.trim() || '',
      intelLine: document.getElementById('boss-hud-intel')?.textContent?.trim() || '',
      hudText: document.getElementById('boss-hud')?.innerText || '',
    }));
    check(
      act4BeforeInfo.snap.boss?.act === 4 && act4BeforeInfo.partPills === 2,
      `Act 4 boss HUD mismatch: ${JSON.stringify(act4BeforeInfo)}`
    );
    check(
      act4BeforeInfo.threatBadge.includes('终极威胁'),
      `Expected Act 4 #boss-hud-threat-badge, got "${act4BeforeInfo.threatBadge}"`
    );
    check(
      act4BeforeInfo.intelLine.includes('战术弱点'),
      `Expected Act 4 #boss-hud-intel, got "${act4BeforeInfo.intelLine}"`
    );
    assertImmersionPurity(act4BeforeInfo.hudText, 'boss-hud-act4');
    passedChecks += 1;

    const act4CanvasBuf = await page.locator('#game-canvas').screenshot();
    const act4Full = await analyzeFullCanvasPixels(act4CanvasBuf);
    console.log(`[e2e] Act 4 (Dreadnought Citadel) full-canvas meanLuma=${act4Full.meanLuma.toFixed(2)}`);
    check(
      act4Full.meanLuma > 24,
      `Expected Act 4 full-canvas meanLuma > 24, got ${act4Full.meanLuma.toFixed(2)}`
    );

    const diff12 = meanPixelDiff(act1Full, act2Full);
    const diff23 = meanPixelDiff(act2Full, act3Full);
    const diff34 = meanPixelDiff(act3Full, act4Full);
    const diff14 = meanPixelDiff(act1Full, act4Full);
    console.log(
      `[e2e] 4-Act differentiation meanDiff: Act1-2=${diff12.toFixed(2)}, Act2-3=${diff23.toFixed(2)}, Act3-4=${diff34.toFixed(2)}, Act1-4=${diff14.toFixed(2)}`
    );
    check(diff12 > 6.0, `Expected Act 1 vs Act 2 meanDiff > 6.0, got ${diff12.toFixed(2)}`);
    check(diff23 > 6.0, `Expected Act 2 vs Act 3 meanDiff > 6.0, got ${diff23.toFixed(2)}`);
    check(diff34 > 6.0, `Expected Act 3 vs Act 4 meanDiff > 6.0, got ${diff34.toFixed(2)}`);
    check(diff14 > 6.0, `Expected Act 1 vs Act 4 meanDiff > 6.0, got ${diff14.toFixed(2)}`);

    const act4Before = act4BeforeInfo.snap;
    const targetPart = act4Before.boss.parts[0];
    const targetPartId = targetPart.id;
    const partKillDmg = targetPart.maxHp + 40;
    const hpBefore = act4Before.boss.hp;

    const partDamaged = await page.evaluate(
      ({ pid, dmg }) => window.__STARFORGE__.damageBossPart(pid, dmg),
      { pid: targetPartId, dmg: partKillDmg }
    );
    check(partDamaged === true, `Expected damageBossPart(${targetPartId}) to return true`);
    await sleep(160);

    const act4AfterPart = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      brokenPills: document.querySelectorAll('#boss-parts-row .boss-part-pill.is-broken').length,
    }));
    check(
      act4AfterPart.snap.boss.parts[0].destroyed === true,
      `Expected part ${targetPartId} destroyed, got ${JSON.stringify(act4AfterPart.snap.boss.parts[0])}`
    );
    check(
      act4AfterPart.brokenPills >= 1,
      `Expected >=1 .boss-part-pill.is-broken in HUD, got ${act4AfterPart.brokenPills}`
    );
    check(
      act4AfterPart.snap.boss.hp > 0 && act4AfterPart.snap.boss.hp < hpBefore,
      `Expected boss alive with reduced HP after part break (0 < ${act4AfterPart.snap.boss.hp} < ${hpBefore})`
    );
    check(
      act4AfterPart.snap.boss.dying === false,
      `Expected boss.dying === false after breaking single part, got ${act4AfterPart.snap.boss.dying}`
    );
    await assertVisibleImagesLoaded(page, 'boss-hud');
    passedChecks += 1;

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_06_boss_hud.png') });
    console.log('[e2e] Saved v4_06_boss_hud.png');

    // ==================== STAGE 6: Slow-Mo Boss Kill, Victory, Save & Endless ====================
    console.log('[e2e] Stage 6: Slow-Mo Boss Kill, Victory Dialog, Save & Endless Mode...');

    await page.evaluate(() => window.__STARFORGE__.setPlayerHp(35));
    const preClearSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(preClearSnap.hp === 35, `Expected pre-clear damaged hp === 35, got ${preClearSnap.hp}`);

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
      subtitle: document.getElementById('result-subtitle')?.textContent?.trim() || '',
      dialogText: document.getElementById('result-dialog')?.innerText || '',
      rawSave: localStorage.getItem('starforge_armada_save_v1'),
    }));
    check(resultInfo.snap.dialogs?.resultOpen === true, 'Expected resultOpen=true');
    check(
      resultInfo.snap.hp === resultInfo.snap.maxHp,
      `Expected full HP restored on stage clear (${resultInfo.snap.hp}/${resultInfo.snap.maxHp})`
    );
    check(
      resultInfo.snap.audio?.activeBgm === null,
      `Expected activeBgm=null during result stinger, got ${JSON.stringify(resultInfo.snap.audio)}`
    );
    check(!resultInfo.endlessBtnHidden, 'Expected #result-endless-btn visible on campaign victory');
    check(resultInfo.title.includes('CAMPAIGN CLEARED'), `Unexpected victory title: ${resultInfo.title}`);
    check(
      resultInfo.subtitle.includes('破晓航道已全面肃清'),
      `Expected immersive victory subtitle, got "${resultInfo.subtitle}"`
    );
    assertImmersionPurity(resultInfo.dialogText, 'result-dialog');
    passedChecks += 1;
    check(Boolean(resultInfo.rawSave), 'Expected localStorage save under starforge_armada_save_v1');

    const parsedSave = JSON.parse(resultInfo.rawSave);
    check(parsedSave.totalRuns >= 1, `Expected save totalRuns >= 1, got ${parsedSave.totalRuns}`);
    check(parsedSave.endlessUnlocked === true, `Expected save endlessUnlocked === true, got ${parsedSave.endlessUnlocked}`);
    check(
      (parsedSave.ships?.aero?.clears ?? 0) >= 1,
      `Expected aero clear count >= 1 in save, got ${JSON.stringify(parsedSave.ships)}`
    );

    await assertVisibleImagesLoaded(page, 'victory-dialog');
    await assertFpsHudVisible(page, 'victory-dialog');
    passedChecks += 2;

    // Enter Endless Mode (verify full HP restoration again)
    await page.evaluate(() => window.__STARFORGE__.setPlayerHp(40));
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
      endlessSnap.snap.hp === endlessSnap.snap.maxHp,
      `Expected full HP restored on entering Endless Mode (${endlessSnap.snap.hp}/${endlessSnap.snap.maxHp})`
    );
    check(
      endlessSnap.snap.endless === true,
      `Expected snapshot.endless === true after clicking Endless Mode, got ${JSON.stringify(endlessSnap)}`
    );
    check(
      endlessSnap.actLabel.includes('无尽深空'),
      `Expected endless HUD label, got "${endlessSnap.actLabel}"`
    );
    check(
      endlessSnap.snap.audio?.activeBgm === 'act3',
      `Expected activeBgm='act3' in Endless Mode, got ${JSON.stringify(endlessSnap.snap.audio)}`
    );

    // ==================== STAGE 6b: Warp Gate Safe Passage vs Solid Door Crash ====================
    console.log('[e2e] Stage 6b: Warp Gate Safe Passage vs Solid Door Crash Destruction...');
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(3));
    await page.mouse.move(720, 450);
    await sleep(320);

    // 6b-1. Centered flight through a wide-open 112-deg portal must stay completely safe (no clipping)
    await page.evaluate(() => window.__STARFORGE__.spawnGateNow(-50, 'open'));
    await sleep(1900);
    const gatePassSnap = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    check(
      gatePassSnap.hp > 0 && gatePassSnap.playerDying === false && gatePassSnap.mode === 'playing',
      `Expected centered flight through open gate to survive cleanly, got hp=${gatePassSnap.hp} dying=${gatePassSnap.playerDying} mode=${gatePassSnap.mode}`
    );

    // 6b-2. Steer to far right (+x into swung-open vault door slab) -> must explode & open defeat dialog
    await page.mouse.move(1400, 450, { steps: 6 });
    await sleep(500);
    await page.evaluate(() => window.__STARFORGE__.spawnGateNow(-30, 'open'));
    await page.waitForFunction(
      () => {
        const s = window.__STARFORGE__.getSnapshot();
        return s.hp === 0 && (s.playerDying || s.dialogs?.resultOpen);
      },
      null,
      { polling: 'raf', timeout: 5000 }
    );
    await sleep(140);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'v4_06b_gate_crash_explosion.png') });
    console.log('[e2e] Saved v4_06b_gate_crash_explosion.png');

    await page.waitForFunction(
      () => document.getElementById('result-dialog')?.hasAttribute('open'),
      null,
      { timeout: 5000 }
    );
    const crashResultInfo = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      subtitle: document.getElementById('result-subtitle')?.textContent?.trim() || '',
      dialogText: document.getElementById('result-dialog')?.innerText || '',
    }));
    check(
      crashResultInfo.snap.dialogs?.resultOpen === true && crashResultInfo.snap.hp === 0,
      `Expected defeat result dialog open after gate crash, got ${JSON.stringify(crashResultInfo.snap)}`
    );
    check(
      crashResultInfo.subtitle.includes('撞击星际跃迁闸门'),
      `Expected gate crash subtitle, got "${crashResultInfo.subtitle}"`
    );
    assertImmersionPurity(crashResultInfo.dialogText, 'gate-crash-result');
    await page.click('#result-retry-btn');
    await page.waitForFunction(
      () => !document.getElementById('result-dialog')?.hasAttribute('open'),
      null,
      { timeout: 5000 }
    );
    await page.mouse.move(720, 450);

    // ==================== STAGE 7: 1280x720 Responsive Bounds Check ====================
    console.log('[e2e] Stage 7: 1280x720 Responsive Bounds & Overlap Checks...');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => window.__STARFORGE__.spawnBossNow(4));
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
        bossIntel: box('#boss-hud-intel'),
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
    await assertRectFitsViewport(hudLayout720.bossIntel, 1280, 720, 'Boss HUD intel line');
    await assertRectFitsViewport(hudLayout720.legend, 1280, 720, 'HUD legend');
    await assertRectFitsViewport(hudLayout720.br, 1280, 720, 'HUD bottom-right');
    check(!rectsOverlap(hudLayout720.tl, hudLayout720.tc), 'HUD top-left overlaps top-center at 1280x720');
    check(!rectsOverlap(hudLayout720.legend, hudLayout720.br), 'HUD legend overlaps bottom-right skills at 1280x720');
    const hudFpsRect720 = await assertFpsHudVisible(page, 'hud-1280');
    check(!rectsOverlap(hudFpsRect720, hudLayout720.tc), 'HUD #fps-hud overlaps top-center at 1280x720');
    passedChecks += 10;

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
        shipList: box('#hangar-ship-list'),
        blueprintPanel: box('#hangar-blueprint-panel'),
        loreBox: box('#hangar-lore'),
        controlTip: box('#hangar-control-tip'),
        launchBtn: box('#hangar-launch-btn'),
        rightScrollOverflowY:
          (document.querySelector('.hangar-right-col .panel-scroll-inner')?.scrollHeight ?? 0) -
          (document.querySelector('.hangar-right-col .panel-scroll-inner')?.clientHeight ?? 0),
      };
    });
    check(
      hangarLayout720.scrollW <= hangarLayout720.innerW,
      `Horizontal overflow on Hangar at 1280x720: scrollWidth=${hangarLayout720.scrollW} > innerWidth=${hangarLayout720.innerW}`
    );
    await assertRectFitsViewport(hangarLayout720.leftCol, 1280, 720, 'Hangar left col at 1280x720');
    await assertRectFitsViewport(hangarLayout720.rightCol, 1280, 720, 'Hangar right col at 1280x720');
    await assertRectFitsViewport(hangarLayout720.blueprintPanel, 1280, 720, 'Hangar blueprint at 1280x720');
    await assertRectFitsViewport(hangarLayout720.loreBox, 1280, 720, 'Hangar lore at 1280x720');
    await assertRectFitsViewport(hangarLayout720.controlTip, 1280, 720, 'Hangar mouse control tip at 1280x720');
    await assertRectFitsViewport(hangarLayout720.launchBtn, 1280, 720, 'Hangar launch button at 1280x720');
    check(
      hangarLayout720.controlTip.bottom <= hangarLayout720.launchBtn.top + 1,
      `Expected #hangar-control-tip above #hangar-launch-btn at 1280x720, got tip=${JSON.stringify(hangarLayout720.controlTip)} btn=${JSON.stringify(hangarLayout720.launchBtn)}`
    );
    check(
      hangarLayout720.rightScrollOverflowY <= 2,
      `Expected zero vertical scroll overflow in right Hangar col at 1280x720, got ${hangarLayout720.rightScrollOverflowY}px`
    );
    check(
      !rectsOverlap(hangarLayout720.leftCol, hangarLayout720.rightCol),
      'Hangar left and right columns overlap at 1280x720'
    );
    check(
      !rectsOverlap(hangarLayout720.shipList, hangarLayout720.blueprintPanel),
      'Hangar ship list overlaps blueprint panel at 1280x720'
    );
    const hangarFpsRect720 = await assertFpsHudVisible(page, 'hangar-1280');
    const hangarMuteRect720 = await page.evaluate(() => {
      const r = document.getElementById('hangar-mute-btn')?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
    });
    check(
      Boolean(hangarMuteRect720) && !rectsOverlap(hangarFpsRect720, hangarMuteRect720),
      'Hangar #fps-hud overlaps #hangar-mute-btn at 1280x720'
    );
    passedChecks += 9;

    // 4K UHD (3840x2160) Hardware Detection & 5-Tier Manual Resolution Switching Checks
    console.log('[e2e] Stage 7b: 4K UHD (3840x2160) Hardware Detection & Manual Resolution Picker...');
    await page.setViewportSize({ width: 3840, height: 2160 });
    await sleep(240);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const snap4kAuto = await page.evaluate(() => window.__STARFORGE__.getSnapshot());
    const px4kAuto = snap4kAuto.internalWidth * snap4kAuto.internalHeight;
    console.log(
      `[e2e] 4K auto buffer=${snap4kAuto.internalWidth}x${snap4kAuto.internalHeight} (${px4kAuto} px, dpr=${snap4kAuto.renderPixelRatio}, tier=${snap4kAuto.hardware.tier}, gpu="${snap4kAuto.hardware.gpuName}", fps=${snap4kAuto.fps})`
    );
    check(snap4kAuto.graphicsPreset === 'auto', `Expected initial graphicsPreset=auto, got ${snap4kAuto.graphicsPreset}`);
    check(
      Boolean(snap4kAuto.hardware) &&
        typeof snap4kAuto.hardware.gpuName === 'string' &&
        snap4kAuto.hardware.gpuName.length > 0 &&
        snap4kAuto.hardware.cpuCores >= 1 &&
        snap4kAuto.hardware.isHighDpi4k === true &&
        ['low', 'mid', 'high'].includes(snap4kAuto.hardware.tier) &&
        ['720p', '1080p', '1440p'].includes(snap4kAuto.hardware.recommendedPreset),
      `Invalid 4K hardware profile: ${JSON.stringify(snap4kAuto.hardware)}`
    );
    check(
      px4kAuto > 0 && px4kAuto <= Math.round(snap4kAuto.hardware.autoPixelBudget * 1.1),
      `Expected 4K auto internal pixel budget <= ${Math.round(snap4kAuto.hardware.autoPixelBudget * 1.1)}, got ${snap4kAuto.internalWidth}x${snap4kAuto.internalHeight}=${px4kAuto}`
    );
    const fpsRect4k = await assertFpsHudVisible(page, 'hangar-4k-auto');
    const muteRect4k = await page.evaluate(() => {
      const r = document.getElementById('hangar-mute-btn')?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
    });
    check(Boolean(muteRect4k) && !rectsOverlap(fpsRect4k, muteRect4k), 'Hangar #fps-hud overlaps #hangar-mute-btn at 3840x2160');

    // Open picker panel at 4K & test manual 720p -> 1080p -> 1440p -> native buttons, then KeyG -> auto
    await page.click('#fps-hud-btn');
    await sleep(140);
    const openAt4k = await page.evaluate(() => !document.getElementById('gfx-popover-panel')?.hidden);
    check(openAt4k === true, 'Expected #gfx-popover-panel open at 3840x2160');

    const manualTargets = [
      { preset: '720p', w: 1280, h: 720, modeSub: '720P' },
      { preset: '1080p', w: 1920, h: 1080, modeSub: '1080P' },
      { preset: '1440p', w: 2560, h: 1440, modeSub: '2K' },
      { preset: 'native', w: 3840, h: 2160, modeSub: '4K原生' },
    ];
    for (const target of manualTargets) {
      await page.click(`[data-gfx-preset="${target.preset}"]`);
      await sleep(140);
      const resState = await page.evaluate((p) => ({
        snap: window.__STARFORGE__.getSnapshot(),
        mode: document.getElementById('fps-hud-mode')?.textContent?.trim() || '',
        pressed: document.querySelector(`[data-gfx-preset="${p}"]`)?.getAttribute('aria-pressed') || '',
      }), target.preset);
      check(resState.snap.graphicsPreset === target.preset, `Expected preset=${target.preset}, got ${resState.snap.graphicsPreset}`);
      check(
        resState.snap.internalWidth === target.w && resState.snap.internalHeight === target.h,
        `Expected 4K ${target.preset} buffer ${target.w}x${target.h}, got ${resState.snap.internalWidth}x${resState.snap.internalHeight}`
      );
      check(resState.mode.includes(target.modeSub), `Expected #fps-hud-mode to contain ${target.modeSub}, got "${resState.mode}"`);
      check(resState.pressed === 'true', `Expected [data-gfx-preset="${target.preset}"] aria-pressed="true", got "${resState.pressed}"`);
    }

    // KeyG cycles native -> auto
    await page.keyboard.press('KeyG');
    await sleep(160);
    const snap4kBackAuto = await page.evaluate(() => ({
      snap: window.__STARFORGE__.getSnapshot(),
      mode: document.getElementById('fps-hud-mode')?.textContent?.trim() || '',
    }));
    check(snap4kBackAuto.snap.graphicsPreset === 'auto', `Expected preset=auto after KeyG, got ${snap4kBackAuto.snap.graphicsPreset}`);
    check(snap4kBackAuto.mode.includes('自动'), `Expected #fps-hud-mode to show 自动, got "${snap4kBackAuto.mode}"`);
    await page.keyboard.press('Escape');
    await sleep(120);
    const closedAt4k = await page.evaluate(() => document.getElementById('gfx-popover-panel')?.hidden === true);
    check(closedAt4k === true, 'Expected #gfx-popover-panel closed after Escape at 4K');
    passedChecks += 24;

    await page.setViewportSize({ width: 1440, height: 900 });
    await sleep(120);

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
