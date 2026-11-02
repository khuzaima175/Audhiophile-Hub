const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { ensureViteServer, launchBrowser } = require('./browserEnv.cjs');

// Studio dock: edit an EQ in place under the comparison graph; curves stay visible.
(async () => {
  let server, browser;
  try {
    server = await ensureViteServer();
    browser = await launchBrowser(chromium);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    await page.goto('http://127.0.0.1:3000/#/lab');
    const lab = page.getByRole('dialog', { name: 'Graph lab', exact: true });
    await lab.waitFor();
    const draft = () => page.evaluate(() => JSON.parse(localStorage.getItem('audiosage_audio_draft_v2') || '{}'));
    await page.evaluate(async () => { const { audioWorkspace, freshDraft } = await import('/store/audioWorkspace.ts'); audioWorkspace.replace(freshDraft()); });

    const dock = lab.getByRole('region', { name: 'Your EQ', exact: true });
    await dock.waitFor();
    assert.equal(await lab.getByTestId('studio-draft-curve').count(), 0, 'No draft curve before an EQ is started');

    // Start in place: still on the comparison graph, no panel switch.
    await dock.getByRole('button', { name: 'Start an EQ here', exact: true }).click();
    await dock.getByRole('button', { name: 'Add band', exact: true }).click();
    assert.equal(await lab.getByRole('img', { name: 'Comparison frequency response' }).count(), 1, 'Comparison graph must stay on screen while editing');
    assert.equal((await draft()).peqFilters.length, 1);

    // Numeric edit updates the draft and the drawn curve.
    await dock.getByLabel('Band 1 gain', { exact: true }).fill('5');
    await dock.getByLabel('Band 1 frequency', { exact: true }).fill('3000');
    let saved = (await draft()).peqFilters[0];
    assert.equal(saved.gain, 5); assert.equal(saved.freq, 3000);
    await lab.getByTestId('studio-draft-curve').waitFor({ state: 'attached' });
    assert.equal(await lab.getByTestId('studio-band-marker').count(), 1);

    // Double-click on the graph adds a second band at the pointer.
    const svg = lab.getByRole('img', { name: 'Comparison frequency response' });
    const box = await svg.boundingBox();
    await page.mouse.dblclick(box.x + box.width * 0.5, box.y + box.height * 0.45);
    const filters = (await draft()).peqFilters;
    assert.equal(filters.length, 2, 'Double-click adds a band');
    assert.ok(filters[1].freq >= 20 && filters[1].freq <= 20000);

    // Undo removes the double-click band; remove deletes a band.
    await dock.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal((await draft()).peqFilters.length, 1);
    await dock.getByRole('button', { name: 'Remove band 1', exact: true }).click();
    assert.equal((await draft()).peqFilters.length, 0);

    // Full editor still opens with the same draft.
    await dock.getByRole('button', { name: 'Add band', exact: true }).click();
    await dock.getByRole('button', { name: /Full editor/ }).click();
    await lab.getByRole('button', { name: /^Save preset/ }).waitFor();

    // Phone width keeps controls inside the viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    await lab.getByRole('button', { name: 'Compare curves', exact: true }).click();
    await dock.waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `No horizontal page overflow at 390px (got ${overflow})`);
    console.log('PASS Studio dock: start in place, numeric edit, draft curve and marker, double-click add, undo/remove, full editor handoff, 390px');
  } finally {
    if (browser) await browser.close();
    if (server?.spawned) server.kill();
  }
})().catch(error => { console.error(error); process.exit(1); });
