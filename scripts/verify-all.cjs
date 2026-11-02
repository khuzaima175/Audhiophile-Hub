const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { ensureViteServer, ensurePreviewServer } = require('../tests/browserEnv.cjs');

(async () => {
  fs.mkdirSync('artifacts/step3', { recursive: true });
  const log = fs.createWriteStream('artifacts/step3/full-suite.log');
  const print = text => { process.stdout.write(text); log.write(text); };
  const run = script => new Promise(resolve => {
    print(`\n$ npm run ${script}\n`);
    const npmCli = process.env.npm_execpath;
    const child = spawn(process.execPath, [npmCli, 'run', script], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', chunk => print(chunk.toString()));
    child.stderr.on('data', chunk => print(chunk.toString()));
    child.on('close', code => { print(`EXIT ${code}: ${script}\n`); resolve(code); });
    child.on('error', error => { print(String(error)); resolve(1); });
  });
  let dev, preview;
  const failed = [];
  try {
    for (const script of ['typecheck', 'build', 'test:core', 'test:apo', 'test:retrieval']) if (await run(script)) failed.push(script);
    if (failed.includes('build')) throw new Error('Build failed; browser checks require current build');
    dev = await ensureViteServer(); preview = await ensurePreviewServer();
    for (const script of ['test:ui', 'test:dsp', 'test:mobile', 'test:workspace', 'test:lab', 'test:graph', 'test:mobile-eq', 'test:production', 'test:save-apply', 'test:lab-sample-rate', 'test:studio']) if (await run(script)) failed.push(script);
    print(`\n${failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL LOCAL SUITES PASSED'}\n`);
    print('Live provider/model checks are separate: npm run test:models (requires network/account).\n');
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    if (dev?.spawned) dev.kill(); if (preview?.spawned) preview.kill();
    log.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
