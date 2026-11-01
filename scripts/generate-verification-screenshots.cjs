const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const { launchBrowser } = require('../tests/browserEnv.cjs');

(async () => {
  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const browser = await launchBrowser(chromium);

  try {
    // 1. Incognito First Run Screenshot
    console.log('Capturing incognito-first-run.png...');
    const context1 = await browser.newContext({
      viewport: { width: 1440, height: 950 },
    });
    const page1 = await context1.newPage();
    await page1.addInitScript(() => {
      window.localStorage.clear();
      window.__AUDIOSAGE_FORCE_NO_KEY__ = true;
    });
    await page1.goto('http://127.0.0.1:3000');
    await page1.getByText('Chat: add key').waitFor();
    await page1.getByText('What would you like to do?').waitFor();
    await page1.waitForTimeout(600);
    await page1.screenshot({
      path: path.join(artifactsDir, 'incognito-first-run.png'),
      fullPage: false,
    });
    console.log('Saved artifacts/incognito-first-run.png');
    await context1.close();

    // 2. No-Key Composer Notice Screenshot
    console.log('Capturing no-key-composer.png...');
    const context2 = await browser.newContext({
      viewport: { width: 1440, height: 950 },
    });
    const page2 = await context2.newPage();
    await page2.addInitScript(() => {
      window.localStorage.clear();
      window.__AUDIOSAGE_FORCE_NO_KEY__ = true;
    });
    await page2.goto('http://127.0.0.1:3000');
    await page2.getByText('Chat: add key').waitFor();
    // Navigate to research
    await page2.locator('.workspace-sidebar').getByRole('button', { name: 'Research assistant', exact: false }).click();
    const composer = page2.getByLabel('Message the research assistant');
    await composer.waitFor();
    await composer.fill('Recommend an open-back headphone under $500 with warm mids');
    await page2.getByRole('button', { name: 'Send message' }).click();
    // Wait for calm inline warning card
    await page2.getByText(/API key is needed for research chat/i).waitFor();
    await page2.waitForTimeout(600);
    await page2.screenshot({
      path: path.join(artifactsDir, 'no-key-composer.png'),
      fullPage: false,
    });
    console.log('Saved artifacts/no-key-composer.png');
    await context2.close();

    // 3. Empty Gear & Presets Screenshot
    console.log('Capturing empty-gear-presets.png...');
    const context3 = await browser.newContext({
      viewport: { width: 1440, height: 950 },
    });
    const page3 = await context3.newPage();
    await page3.addInitScript(() => {
      window.localStorage.clear();
      window.__AUDIOSAGE_FORCE_NO_KEY__ = true;
    });
    await page3.goto('http://127.0.0.1:3000');
    await page3.getByText('Chat: add key').waitFor();
    // Open Collection / Gear tab
    await page3.locator('.workspace-sidebar').getByRole('button', { name: 'My gear', exact: false }).click();
    await page3.getByText('Your collection starts here').waitFor();
    await page3.waitForTimeout(600);
    await page3.screenshot({
      path: path.join(artifactsDir, 'empty-gear-presets.png'),
      fullPage: false,
    });
    console.log('Saved artifacts/empty-gear-presets.png');
    await context3.close();

    console.log('ALL 3 VERIFICATION SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error('Screenshot generation failed:', e);
  process.exit(1);
});
