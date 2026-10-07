// Run against a local Vite server. Set PLAYWRIGHT_MODULE if Playwright is bundled elsewhere.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER_PATH || '/usr/bin/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Exercise the real Web Audio graph through a silent output gain.
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.__audioContexts = [];
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        this.testFilters = [];
        this.testGains = [];
        window.__audioContexts.push(this);
      }
      createGain() {
        const node = super.createGain();
        this.testGains.push(node);
        const silentOutput = super.createGain();
        silentOutput.gain.value = 0;
        const connect = node.connect.bind(node);
        node.connect = (destination, ...args) => {
          if (destination === this.destination) {
            connect(silentOutput);
            silentOutput.connect(destination);
            return destination;
          }
          return connect(destination, ...args);
        };
        return node;
      }
      createBiquadFilter() {
        const node = super.createBiquadFilter();
        this.testFilters.push(node);
        return node;
      }
    };
  });
  // Never send real AI requests during UI verification.
  await page.route('https://generativelanguage.googleapis.com/**', (route) => route.abort());
  const nav = async (label) => {
    await page.locator('.workspace-sidebar').getByRole('button', { name: label, exact: false }).click();
    await page.waitForTimeout(250);
  };
  const screenshot = (name) =>
    page.screenshot({ path: path.join('artifacts', name + '.png'), fullPage: true });
  const overflow = async () =>
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Page must fit the viewport',
    );
  await page.goto(process.env.AUDIOSAGE_TEST_URL || 'http://127.0.0.1:3000');
  await page.getByRole('heading', { name: 'Your sound, in focus.' }).waitFor();
  assert.ok((await page.getByRole('heading', { name: 'Your sound, in focus.' }).boundingBox()).y > 72);
  await overflow();
  await screenshot('overview-desktop');
  console.log('PASS overview and scroll position');

  await nav('Research assistant');
  await page.getByRole('button', { name: 'How can I reduce harsh treble?' }).click();
  const composer = page.getByRole('textbox', { name: 'Message the research assistant' });
  assert.match(await composer.inputValue(), /harsh treble/);
  await composer.press('End');
  await composer.press('Shift+Enter');
  await composer.type('A second line');
  assert.match(await composer.inputValue(), /\nA second line/);
  await page.getByLabel('Analysis depth').selectOption('advanced');
  await screenshot('research-desktop');
  console.log('PASS multiline composer and analysis dropdown');

  await nav('Listening profile');
  await page.getByLabel('Your name', { exact: true }).fill('QA Listener');
  await page.getByLabel('Favorite genres', { exact: true }).fill('Jazz, acoustic');
  await nav('Overview');
  await nav('Listening profile');
  assert.equal(await page.getByLabel('Your name', { exact: true }).inputValue(), 'QA Listener');
  await screenshot('profile-desktop');
  console.log('PASS profile persistence');

  await nav('My gear');
  await page
    .getByRole('button', { name: /Add Gear/i })
    .first()
    .click();
  await page.getByPlaceholder('e.g. Simgot EW300, Moondrop Aria 2, JCally JM6 Pro...').fill('QA Headphones');
  await page.getByLabel('Gear category').selectOption('Headphone');
  await page.getByLabel('Collection status').selectOption('wishlist');
  await page.getByRole('button', { name: 'Add to collection', exact: true }).click();
  await page.getByLabel('Search gear').fill('QA Headphones');
  await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('wishlist');
  assert.equal(await page.getByRole('heading', { name: 'QA Headphones', exact: true }).count(), 1);
  await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('owned');
  assert.equal(await page.getByRole('heading', { name: 'QA Headphones', exact: true }).count(), 0);
  await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('all');
  await screenshot('gear-desktop');
  console.log('PASS gear creation, dropdowns, search and filtering');

  await nav('Research notes');
  await page
    .getByPlaceholder('Add a note, e.g. I prefer smooth treble and a wide soundstage…')
    .fill('QA preference: smooth treble');
  await page
    .getByPlaceholder('Add a note, e.g. I prefer smooth treble and a wide soundstage…')
    .press('Enter');
  assert.ok((await page.locator('body').innerText()).includes('QA preference: smooth treble'));
  console.log('PASS listening notes');

  await nav('Equalizer');
  await page.getByRole('button', { name: 'Import EQ text', exact: true }).click();
  await page
    .locator('.eq-workspace textarea')
    .fill(
      'Preamp: -6 dB\nFilter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1.4\nFilter 2: ON LSC Fc 100 Hz Gain 2 dB Q 0.7',
    );
  await page.getByRole('button', { name: /Parse into Bands/ }).click();
  await page.getByLabel('Preset name', { exact: false }).fill('QA Parametric');
  assert.equal(await page.getByLabel('Equalizer type').inputValue(), 'peq');
  await page.getByRole('button', { name: /Save EQ Profile/ }).click();
  await page.waitForTimeout(250);
  assert.ok((await page.locator('body').innerText()).includes('QA Parametric'));
  await page.getByRole('button', { name: 'New preset', exact: true }).click();
  await page.getByLabel('Equalizer type').selectOption('peq');
  assert.equal(
    await page
      .locator('.eq-workspace select')
      .filter({ has: page.locator('option[value="PK"]') })
      .count(),
    0,
    'New presets must not reuse previous filters',
  );
  await page
    .getByRole('button', { name: /Cancel/ })
    .first()
    .click();
  await screenshot('equalizer-desktop');
  console.log('PASS EQ import, save, and clean new preset');

  await nav('Graph lab');
  const lab = page.getByRole('dialog', { name: 'Graph lab', exact: true });
  await lab.waitFor();
  await lab.getByLabel('Reference target').selectOption('none');
  await lab.getByLabel('Frequency range').selectOption('bass');
  assert.equal(
    await lab.locator('svg').getByText('20k', { exact: true }).count(),
    0,
    'Bass zoom must change the graph axis',
  );
  await lab.getByLabel('Smoothing').selectOption('1/6 OCT');
  await lab.locator('input[type=file]').setInputFiles({
    name: 'qa-measurement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Frequency,SPL\n20,86\n30,85\n50,84\n100,83\n200,80\n500,79\n1000,80\n2000,86\n4000,83\n6000,86\n8000,83\n10000,78\n16000,73\n20000,71',
    ),
  });
  await lab.locator('main').getByText('qa measurement', { exact: true }).first().waitFor();
  await lab.getByLabel('Reference target').selectOption('crinacle-ief-2025');
  await lab.getByText('Listen to the difference', { exact: true }).click();
  const comparisonSelects = lab.locator('.lab-sidebar select');
  await comparisonSelects.nth(0).selectOption({ label: 'qa measurement' });
  await comparisonSelects.nth(1).selectOption({ label: 'IEF 2025' });
  await lab.getByRole('button', { name: 'Generate comparison EQ', exact: true }).click();
  await lab.getByText(/FILTERS ACTIVE/).waitFor();
  await lab.getByRole('button', { name: '▶ Pink Noise', exact: true }).click();
  await page.waitForTimeout(150);
  assert.ok(
    await page.evaluate(() => window.__audioContexts.some((c) => c.testFilters.length > 0)),
    'Audition must install actual biquad filters',
  );
  await lab.getByRole('button', { name: 'A/B ON', exact: true }).click();
  await page.waitForTimeout(100);
  const bypassState = await page.evaluate(() =>
    window.__audioContexts.map((c) => ({
      state: c.state,
      time: c.currentTime,
      gains: c.testGains.map((g) => g.gain.value),
    })),
  );
  assert.ok(
    bypassState.some((c) => c.gains[1] < 0.01 && c.gains[2] > 0.99),
    'Bypass must route audio through the dry path: ' + JSON.stringify(bypassState),
  );
  await lab.getByText('Listen to the difference', { exact: true }).click();
  const downloadWait = page.waitForEvent('download');
  await lab.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadWait;
  const csv = await (await download.createReadStream()).toArray();
  assert.match(Buffer.concat(csv).toString(), /frequency_hz,gain_db/);
  await screenshot('graph-desktop');
  await lab.getByRole('button', { name: 'Close ×' }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Graph lab', exact: true }).count(), 0);
  await page.waitForTimeout(100);
  assert.ok(
    await page.evaluate(() => window.__audioContexts.every((c) => c.state === 'closed')),
    'Closing Graph Lab must release the audio engine',
  );
  console.log('PASS graph import, controls, CSV export and close');
  const sharedRoundTrip = await page.evaluate(async () => {
    const { encodeLabStateToUrl, decodeUrlToLabState } = await import('/utils/shareCodec.ts');
    const { labStore } = await import('/store/labStore.ts');
    const state = {
      ...labStore.getSnapshot(),
      viewMode: 'rawFilter',
      smoothing: '1/6 OCT',
      curves: [
        {
          id: 'test',
          name: 'Correction',
          color: '#aabbcc',
          provenance: 'eq-compensated',
          points: [
            { freq: 20, gain: 2 },
            { freq: 20000, gain: -3 },
          ],
          offset: 0,
          visible: true,
          solo: false,
          isFilterCurve: true,
          sourceTargetId: 'crinacle-ief-2025',
          isInverted: true,
        },
      ],
    };
    const restored = decodeUrlToLabState(encodeLabStateToUrl(state));
    return {
      filter: restored.curves[0].isFilterCurve,
      inverted: restored.curves[0].isInverted,
      target: restored.curves[0].sourceTargetId,
      view: restored.viewMode,
      smoothing: restored.smoothing,
    };
  });
  assert.deepEqual(sharedRoundTrip, {
    filter: true,
    inverted: true,
    target: 'crinacle-ief-2025',
    view: 'rawFilter',
    smoothing: '1/6 OCT',
  });
  console.log('PASS Web Audio filtering, bypass, cleanup and graph share metadata');
  const exportChecks = await page.evaluate(async () => {
    const { exportToEqualizerAPO, exportToWavelet, parseImportedEQText } =
      await import('/utils/importExportParser.ts');
    const { ISO_31_BANDS } = await import('/constants/targetCurves.ts');
    const filters = [
      { id: 'off', type: 'PK', freq: 1000, gain: 18, q: 1.4, enabled: false },
      { id: 'on', type: 'PK', freq: 1000, gain: 3, q: 1.4, enabled: true },
    ];
    const apo = exportToEqualizerAPO(filters);
    const parsed = parseImportedEQText(apo);
    const wavelet = exportToWavelet(
      ISO_31_BANDS,
      ISO_31_BANDS.map(() => 0),
    );
    return {
      apo,
      enabled: parsed.peqFilters.map((f) => f.enabled),
      pairs: wavelet.split('\n')[0].split(';').length,
    };
  });
  assert.match(exportChecks.apo, /Filter 1: OFF PK/);
  assert.deepEqual(exportChecks.enabled, [false, true]);
  assert.match(exportChecks.apo, /Preamp: -3\.2 dB/);
  assert.equal(exportChecks.pairs, 127);
  console.log('PASS disabled filter round-trip, headroom and GraphicEQ export');

  await nav('Settings & data');
  const backup = {
    profile: { name: 'Restored Listener', savedMemories: ['Restored note'], gearLibrary: [], eqLibrary: [] },
    chats: [
      {
        id: 'restored-chat',
        title: 'Restored conversation',
        messages: [{ id: 'message', role: 'user', text: 'Saved research', timestamp: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    knowledgeBase: [],
  };
  await page.locator('input[accept=".json"]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.waitForTimeout(300);
  assert.ok((await page.locator('.workspace-sidebar').innerText()).includes('Restored conversation'));
  await nav('Listening profile');
  assert.equal(await page.getByLabel('Your name', { exact: true }).inputValue(), 'Restored Listener');
  await nav('Settings & data');
  await page.locator('input[accept=".json"]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"profile":{"name":42}}'),
  });
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('audiosage_profile_v1')).name),
    'Restored Listener',
  );
  console.log('PASS backup restore refreshes views and rejects invalid data');

  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Search workspace', exact: true }).waitFor();
  await page.getByLabel('Search workspace commands').fill('Open equalizer');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Equalizer', exact: true }).waitFor();
  console.log('PASS command palette keyboard navigation');

  await nav('Overview');
  await page.setViewportSize({ width: 390, height: 844 });
  await overflow();
  await screenshot('overview-mobile');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.locator('.workspace-sidebar').getByRole('button', { name: 'Equalizer', exact: true }).click();
  assert.equal(await page.locator('.workspace-sidebar').isVisible(), false);
  await overflow();
  await screenshot('equalizer-mobile');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.locator('.workspace-sidebar').getByRole('button', { name: 'Graph lab', exact: false }).click();
  await page.getByRole('dialog', { name: 'Graph lab', exact: true }).waitFor();
  await overflow();
  await screenshot('graph-mobile');
  await page.getByRole('button', { name: 'Close ×', exact: true }).click();
  console.log('PASS mobile navigation and responsive overflow checks');

  await page.evaluate(() => localStorage.setItem('audiosage_chats_v1', 'invalid JSON'));
  await page.reload();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('audiosage_chats_v1')), 'invalid JSON');
  console.log('PASS corrupt saved data is preserved and reported');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  await browser.close();
  console.log('ALL UI CHECKS PASSED');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
