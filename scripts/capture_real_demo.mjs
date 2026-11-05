import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\santy\\.gemini\\antigravity\\brain\\3457d4f8-d605-428a-993f-aa28bfc7041d';
const PORT = 9222;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('1. Launching headless Chrome on port', PORT);
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,960',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  // Wait for Chrome remote debugging endpoint
  let webSocketDebuggerUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const tabs = await res.json();
      if (tabs.length > 0 && tabs[0].webSocketDebuggerUrl) {
        webSocketDebuggerUrl = tabs[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      // Chrome still starting up
    }
  }

  if (!webSocketDebuggerUrl) {
    chromeProcess.kill();
    throw new Error('Could not connect to Chrome debugging endpoint');
  }

  console.log('2. Connected to Chrome CDP:', webSocketDebuggerUrl);
  const ws = new WebSocket(webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = idCounter++;
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const evalJs = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  };

  const capture = async (filename, description) => {
    console.log(` -> Capturing: ${filename} (${description})`);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`    Saved: ${filePath}`);
  };

  console.log('3. Navigating to http://localhost:5173/KRONOX/');
  await send('Page.navigate', { url: 'http://localhost:5173/KRONOX/' });
  await sleep(2500);

  // 1. Welcome Screen
  await capture('1_pantalla_inicial.png', 'Pantalla inicial de KRONOX con acceso directo');

  // 2. Open SPHEREx Observatory directly
  console.log('4. Clicking direct access to SPHEREx Observatory...');
  await evalJs(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Observatorio SPHEREx'));
    if (btn) btn.click();
    else console.warn('Observatory button not found');
  `);
  await sleep(3500);
  await capture('2_observatorio_spherex.png', 'Observatorio SPHEREx con controles de misión');

  // 3. Selection of the 5 targets
  await capture('3_seleccion_cinco_objetivos.png', 'Panel de objetivos con insignias diferenciadas');

  // 4. Select WISE 0855
  console.log('5. Selecting WISE 0855 target...');
  await evalJs(`
    const targetBtns = Array.from(document.querySelectorAll('.spherexTargets button'));
    const wiseBtn = targetBtns.find(b => b.innerText.includes('WISE 0855'));
    if (wiseBtn) wiseBtn.click();
  `);
  await sleep(4000);
  await capture('4_wise_0855_advertencia.png', 'WISE 0855 con banner de advertencia científica estricta');

  // 5. Blink Comparator mode
  console.log('6. Switching to Blink Comparator...');
  await evalJs(`
    const blinkTab = Array.from(document.querySelectorAll('.spherexViewModeTab')).find(b => b.innerText.includes('Blink'));
    if (blinkTab) blinkTab.click();
  `);
  await sleep(2000);
  await capture('5_blink_comparator.png', 'Blink Comparator con retícula fija y parpadeo temporal');

  // 6. Side-by-Side dual view
  console.log('7. Switching to Side-by-Side view...');
  await evalJs(`
    const sideTab = Array.from(document.querySelectorAll('.spherexViewModeTab')).find(b => b.innerText.includes('Lado a lado'));
    if (sideTab) sideTab.click();
  `);
  await sleep(2500);
  await capture('6_lado_a_lado.png', 'Comparación lado a lado con zoom y paneo sincronizados');

  // 7. Differential Subtraction mode
  console.log('8. Switching to Differential Subtraction...');
  await evalJs(`
    const diffTab = Array.from(document.querySelectorAll('.spherexViewModeTab')).find(b => b.innerText.includes('diferencial'));
    if (diffTab) diffTab.click();
  `);
  await sleep(3000);
  await capture('7_resta_diferencial.png', 'Resta diferencial D = I2 - alpha*I1 - B y normalización');

  // 8. Candidates exploration panel
  console.log('9. Switching to Candidates exploration...');
  await evalJs(`
    const candTab = Array.from(document.querySelectorAll('.spherexViewModeTab')).find(b => b.innerText.includes('Candidatos'));
    if (candTab) candTab.click();
  `);
  await sleep(2500);
  await capture('8_panel_candidatos.png', 'Exploración de candidatos y taxonomía astronómica');

  console.log('10. Demo capture complete! Closing browser.');
  ws.close();
  chromeProcess.kill();
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});

