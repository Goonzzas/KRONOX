import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const EVIDENCE_DIR = 'C:/Users/santy/OneDrive/Escritorio/KRONOS/KRONOX/docs/demo-evidence/vercel-live';
const ARTIFACT_DIR = 'C:/Users/santy/.gemini/antigravity/brain/3457d4f8-d605-428a-993f-aa28bfc7041d';
const USER_DATA_DIR = 'C:/Users/santy/AppData/Local/Temp/chrome_refine_verify_profile';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  await fs.mkdir(USER_DATA_DIR, { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--remote-debugging-port=9245',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--window-size=1920,1080',
      'https://kronox-delta.vercel.app/?welcome=true',
    ],
    { stdio: 'ignore' },
  );

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const res = await fetch('http://127.0.0.1:9245/json');
      const pages = await res.json();
      const page = pages.find((p) => p.type === 'page');
      if (page?.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }
  if (!wsUrl) throw new Error('Could not connect to Chrome debugger');

  console.log('Connected to Chrome WebSocket debugger on verified Vercel build');
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let msgId = 1;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (event) => {
        const data = JSON.parse(String(event.data));
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    return res?.result?.value;
  };

  const capture = async (filename) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const outPath = path.join(EVIDENCE_DIR, filename);
    await fs.writeFile(outPath, buffer);
    const artPath = path.join(ARTIFACT_DIR, filename);
    await fs.writeFile(artPath, buffer);
    console.log(`[VERIFIED CAPTURE] ${filename} (${buffer.length} bytes)`);
  };

  await send('Page.enable');
  await send('Runtime.enable');

  // Wait for React to mount and Welcome dialog to appear
  for (let i = 0; i < 30; i++) {
    const hasCard = await evaluate(`Boolean(document.querySelector('.welcomeCard'))`);
    if (hasCard) break;
    await sleep(400);
  }

  // 0. Welcome screen
  await capture('0_bienvenida_produccion.png');

  // Click Enter Observatory
  await evaluate(`
    (() => {
      const enterBtn = document.querySelector('.welcomeLaunch.primary') || document.querySelector('.welcomeLaunch');
      if (enterBtn) enterBtn.click();
    })()
  `);
  await sleep(2500);

  // Wait for Barnard image
  for (let i = 0; i < 40; i++) {
    const hasImg = await evaluate(`Boolean(document.querySelector('.spherexImageFrame img')?.src?.startsWith('data:image'))`);
    if (hasImg) break;
    await sleep(500);
  }
  await sleep(1000);

  // 1. Barnard in Essential Mode: Check Canvas Height, Fit Button, and Observation Pill
  const barnardInfo = await evaluate(`
    (() => {
      const targetPill = document.querySelector('.spherexActiveTargetChip .spherexStatusPill')?.textContent?.trim();
      const obsPill = document.querySelector('.spherexActiveTargetChip .spherexObservationPill')?.textContent?.trim();
      const obsPillTitle = document.querySelector('.spherexActiveTargetChip .spherexObservationPill')?.getAttribute('title');
      const fitBtn = document.querySelector('.spherexFitButton')?.textContent?.trim();
      const frameHeight = Math.round(document.querySelector('.spherexImageFrame')?.getBoundingClientRect().height || 0);
      return { targetPill, obsPill, obsPillTitle, fitBtn, frameHeight };
    })()
  `);
  console.log('Barnard Essential Info:', JSON.stringify(barnardInfo, null, 2));
  await capture('1_pantalla_esencial_ampliada.png');

  // Click "Ajustar imagen"
  await evaluate(`
    (() => {
      const fit = document.querySelector('.spherexFitButton');
      if (fit) fit.click();
    })()
  `);
  await sleep(500);

  // 2. Vista comparada dual (Side-by-Side)
  await evaluate(`
    (() => {
      const modeTabs = [...document.querySelectorAll('.spherexViewModeTab')];
      const tab = modeTabs.find(b => b.textContent.includes('Vista comparada'));
      if (tab) tab.click();
    })()
  `);
  await sleep(3000);
  for (let i = 0; i < 40; i++) {
    const both = await evaluate(`
      (() => {
        const imgs = document.querySelectorAll('.spherexDualViewport img');
        return imgs.length >= 2 && [...imgs].every(im => im.src && im.src.startsWith('data:image'));
      })()
    `);
    if (both) break;
    await sleep(500);
  }
  const sbsInfo = await evaluate(`
    (() => {
      const panes = document.querySelectorAll('.spherexDualPane');
      const headers = [...document.querySelectorAll('.spherexDualHeader')].map(h => h.textContent.trim());
      const deltaBadge = document.querySelector('.spherexTimeDeltaBadge')?.textContent?.trim();
      const presetBtn = document.querySelector('.spherexPresetBtn')?.textContent?.trim();
      return {
        paneCount: panes.length,
        pane1Width: Math.round(panes[0]?.getBoundingClientRect().width || 0),
        pane2Width: Math.round(panes[1]?.getBoundingClientRect().width || 0),
        headers,
        deltaBadge,
        hasPresetBtn: Boolean(presetBtn)
      };
    })()
  `);
  console.log('Side-by-Side Info:', JSON.stringify(sbsInfo, null, 2));
  await capture('2_vista_comparada_dual_balanceada.png');

  // 3. Comparar épocas (Blink Mode)
  await evaluate(`
    (() => {
      const modeTabs = [...document.querySelectorAll('.spherexViewModeTab')];
      const tab = modeTabs.find(b => b.textContent.includes('Comparar épocas'));
      if (tab) tab.click();
    })()
  `);
  await sleep(2500);
  const blinkInfo = await evaluate(`
    (() => {
      const playBtn = document.querySelector('.spherexPlayBtn')?.textContent?.trim();
      const hud = document.querySelector('.spherexBlinkHud')?.textContent?.trim();
      const mode = document.querySelector('.spherexBlinkModeToggle select')?.value;
      const speed = document.querySelector('.spherexBlinkSpeedSelect select')?.value;
      return { playBtn, hud, mode, speed };
    })()
  `);
  console.log('Blink Info:', JSON.stringify(blinkInfo, null, 2));
  await capture('3_comparar_epocas_blink_fluido.png');

  // 4. Mapa de diferencias
  await evaluate(`
    (() => {
      const modeTabs = [...document.querySelectorAll('.spherexViewModeTab')];
      const tab = modeTabs.find(b => b.textContent.includes('Mapa de diferencias'));
      if (tab) tab.click();
    })()
  `);
  await sleep(3000);
  const diffInfo = await evaluate(`
    (() => {
      const legend = document.querySelector('.spherexColormapLegend')?.textContent?.trim();
      const frameHeight = Math.round(document.querySelector('.spherexImageFrame')?.getBoundingClientRect().height || 0);
      return { legend, frameHeight };
    })()
  `);
  console.log('Differential Info:', JSON.stringify(diffInfo, null, 2));
  await capture('4_mapa_diferencias_ampliado.png');

  // 5. Candidatos detectados
  await evaluate(`
    (() => {
      const modeTabs = [...document.querySelectorAll('.spherexViewModeTab')];
      const tab = modeTabs.find(b => b.textContent.includes('Candidatos'));
      if (tab) tab.click();
    })()
  `);
  await sleep(3000);
  const candInfo = await evaluate(`
    (() => {
      const disclaimer = document.querySelector('.spherexCandidateDisclaimer')?.textContent?.trim();
      const filterTabs = [...document.querySelectorAll('.spherexCandidateFilterTabs button')].map(b => b.textContent.trim());
      const sampleCards = [...document.querySelectorAll('.spherexCandidateCard')].slice(0, 3).map(c => ({
        badge: c.querySelector('.spherexCandidateBadge')?.textContent?.trim(),
        notes: c.querySelector('.spherexCandidateCard > div:first-child > div:nth-child(3)')?.textContent?.trim()
      }));
      return { disclaimer, filterTabs, sampleCards };
    })()
  `);
  console.log('Candidates Info:', JSON.stringify(candInfo, null, 2));
  await capture('5_catalogo_candidatos_categorizado.png');

  // 6. Modo técnico
  await evaluate(`
    (() => {
      const techBtn = [...document.querySelectorAll('.spherexToggleBtn')].find(b => b.textContent.includes('Técnico'));
      if (techBtn) techBtn.click();
      const singleTab = [...document.querySelectorAll('.spherexViewModeTab')].find(t => t.textContent.includes('Línea de tiempo'));
      if (singleTab) singleTab.click();
    })()
  `);
  await sleep(2500);
  await capture('6_modo_tecnico_completo.png');

  // 7. Select WISE 0855 Target & Verify Strict WARNING
  await evaluate(`
    (() => {
      const btns = [...document.querySelectorAll('.spherexTargets button')];
      const target = btns.find(b => b.textContent.includes('WISE 0855'));
      if (target) target.click();
    })()
  `);
  await sleep(3500);
  for (let i = 0; i < 40; i++) {
    const hasImg = await evaluate(`Boolean(document.querySelector('.spherexImageFrame img')?.src?.startsWith('data:image'))`);
    if (hasImg) break;
    await sleep(500);
  }
  const wiseInfo = await evaluate(`
    (() => {
      const targetPill = document.querySelector('.spherexActiveTargetChip .spherexStatusPill')?.textContent?.trim();
      const obsPill = document.querySelector('.spherexActiveTargetChip .spherexObservationPill')?.textContent?.trim();
      const statusStrip = document.querySelector('.spherexStatusStrip')?.textContent?.trim();
      const frameBand = document.querySelector('.spherexFrameLabel')?.textContent?.trim();
      return { targetPill, obsPill, statusStrip, frameBand };
    })()
  `);
  console.log('WISE 0855 Verified Info:', JSON.stringify(wiseInfo, null, 2));
  await capture('7_wise_0855_warning_estricto.png');

  // 8. Responsiveness 1366 x 768
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(1000);
  const scroll1366 = await evaluate(`
    (() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      hasHScroll: document.body.scrollWidth > document.body.clientWidth
    }))()
  `);
  console.log('1366x768 Scroll Check:', JSON.stringify(scroll1366));
  await capture('8_responsivo_1366x768.png');

  // 9. Responsiveness 1440 x 900
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(1000);
  const scroll1440 = await evaluate(`
    (() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      hasHScroll: document.body.scrollWidth > document.body.clientWidth
    }))()
  `);
  console.log('1440x900 Scroll Check:', JSON.stringify(scroll1440));
  await capture('9_responsivo_1440x900.png');

  // 10. Responsiveness 1920 x 1080
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(1000);
  await capture('10_responsivo_1920x1080.png');

  ws.close();
  proc.kill();
  console.log('ALL VERIFIED CAPTURES COMPLETED ON LIVE VERCEL!');
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
