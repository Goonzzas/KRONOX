const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\santy\\.gemini\\antigravity\\brain\\3457d4f8-d605-428a-993f-aa28bfc7041d';

const targets = [
  { file: '2_observatorio_spherex.png', url: 'http://localhost:5173/KRONOX/?observatory=true', budget: 6000 },
  { file: '3_seleccion_cinco_objetivos.png', url: 'http://localhost:5173/KRONOX/?target=barnard', budget: 7000 },
  { file: '4_wise_0855_advertencia.png', url: 'http://localhost:5173/KRONOX/?target=wise-0855', budget: 8000 },
  { file: '5_blink_comparator.png', url: 'http://localhost:5173/KRONOX/?target=wise-0855&view=blink', budget: 8000 },
  { file: '6_lado_a_lado.png', url: 'http://localhost:5173/KRONOX/?target=wise-0855&view=sideBySide', budget: 9000 },
  { file: '7_resta_diferencial.png', url: 'http://localhost:5173/KRONOX/?target=wise-0855&view=differential', budget: 9000 },
  { file: '8_panel_candidatos.png', url: 'http://localhost:5173/KRONOX/?target=wise-0855&view=candidates', budget: 9000 },
];

for (const t of targets) {
  const outPath = path.join(ARTIFACT_DIR, t.file);
  console.log(`Capturing ${t.file} from ${t.url} (budget: ${t.budget}ms)...`);
  const res = spawnSync(CHROME, [
    '--headless=new',
    '--window-size=1440,960',
    `--virtual-time-budget=${t.budget}`,
    `--screenshot=${outPath}`,
    t.url,
  ], { encoding: 'utf8' });

  if (fs.existsSync(outPath)) {
    const stats = fs.statSync(outPath);
    console.log(` -> SUCCESS: ${t.file} (${stats.size} bytes)`);
  } else {
    console.error(` -> FAILED: ${t.file}, exit status: ${res.status}`);
  }
}

console.log('Batch capture finished.');

