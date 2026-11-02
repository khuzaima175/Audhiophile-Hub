const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ensureViteServer, launchBrowser } = require('./browserEnv.cjs');

(async () => {
  const legacy = process.argv.includes('--legacy');
  // Serve the exact pre-fix component through Vite, without replacing the working file.
  const temporary = path.resolve('components/GraphLab.regression.tsx');
  assert.equal(fs.existsSync(temporary), false, 'Refuse to overwrite a pre-existing regression file');
  let server, browser;
  try {
    if (legacy) fs.writeFileSync(temporary, execFileSync('git', ['show', 'aadaa91:components/GraphLab.tsx']));
    server = await ensureViteServer();
    browser = await launchBrowser(chromium);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    if (legacy) await page.route('**/components/GraphLab.tsx*', async route => {
      const response = await page.request.get('http://127.0.0.1:3000/components/GraphLab.regression.tsx');
      assert.equal(response.status(), 200);
      await route.fulfill({ response });
    });
    await page.goto('http://127.0.0.1:3000/#/lab');
    const lab = page.getByRole('dialog', { name: 'Graph lab', exact: true });
    await lab.waitFor();
    await page.evaluate(async () => {
      const { audioWorkspace } = await import('/store/audioWorkspace.ts');
      audioWorkspace.update({ sampleRate: 96000, dirty: false }, false);
    });
    await lab.getByLabel('Import measurement files', { exact: true }).setInputFiles({
      name: 'rate-check.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Frequency,SPL\n20,86\n100,83\n500,79\n1000,80\n2000,86\n4000,83\n8000,83\n16000,73\n20000,71'),
    });
    await lab.getByRole('button', { name: /Generate correction/ }).click();
    await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('audiosage_audio_draft_v2') || '{}').originalFit);
    const actual = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('audiosage_audio_draft_v2'));
      return { draftSampleRate: d.sampleRate, fitSampleRate: d.originalFit.settings.sampleRate };
    });
    console.log(`${legacy ? 'PRE-FIX GraphLab aadaa91' : 'CURRENT GraphLab'}: ${JSON.stringify(actual)}`);
    assert.equal(actual.draftSampleRate, 96000, 'Generate correction must preserve the 96000 Hz draft');
    assert.equal(actual.fitSampleRate, 96000, 'Generate correction must fit at the 96000 Hz draft rate');
    console.log('PASS GraphLab preserves and fits at 96000 Hz');
  } finally {
    if (browser) await browser.close();
    if (server?.spawned) server.kill();
    if (legacy && fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
})().catch(error => { console.error(error); process.exit(1); });
