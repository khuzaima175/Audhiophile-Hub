const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  for (const [name, launcher, options] of [
    ['edge', chromium, { channel: 'msedge' }],
    ['webkit', webkit, {}],
  ]) {
    const browser = await launcher.launch({ headless: true, ...options });
    const errors = [];
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:3000');
    const navigate = async (label) => {
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await page
        .locator('.workspace-sidebar')
        .filter({ visible: true })
        .getByRole('button', { name: label, exact: false })
        .click();
    };
    for (const size of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 568, height: 320 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(150);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        name + ' body overflow ' + JSON.stringify(size),
      );
      if (size.width < 768) await navigate('Equalizer');
      else
        await page
          .locator('.workspace-sidebar')
          .getByRole('button', { name: 'Equalizer', exact: true })
          .click();
      await page.getByRole('button', { name: 'New preset', exact: true }).click();
      await page.getByLabel('Preset name', { exact: false }).fill(name + ' mobile preset');
      await page.getByLabel('Equalizer type').selectOption('peq');
      await page.getByRole('button', { name: /Add Filter Row/ }).click();
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        name + ' EQ overflow',
      );
      await page.getByRole('button', { name: /Save EQ Profile/ }).click();
      if (size.width < 768) await navigate('Graph lab');
      else
        await page
          .locator('.workspace-sidebar')
          .getByRole('button', { name: 'Graph lab', exact: false })
          .click();
      const lab = page.getByRole('dialog', { name: 'Graph lab', exact: true });
      await lab.waitFor();
      await lab.getByLabel('Frequency range').selectOption('treble');
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        name + ' graph overflow',
      );
      assert.equal(await lab.locator('svg').getByText('100', { exact: true }).count(), 0);
      const svg = lab.locator('svg');
      await svg.scrollIntoViewIfNeeded();
      const box = await svg.boundingBox();
      await page.touchscreen.tap(
        Math.min(size.width - 16, box.x + box.width * 0.55),
        Math.min(size.height - 16, box.y + box.height * 0.5),
      );
      await lab.getByTestId('graph-crosshair').waitFor();
      console.log('PASS touch ' + name + ' ' + size.width + 'x' + size.height);
      await page.getByRole('button', { name: 'Close ×', exact: true }).click();
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS ' + name + ' mobile: 320 px, phone portrait, landscape, tablet, PEQ creation and graph zoom',
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
