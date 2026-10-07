const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  esbuild = require('esbuild'),
  Module = require('node:module');
(async () => {
  const bundle = await esbuild.build({
    entryPoints: ['server/apoBridge.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });
  const compiled = new Module('bridge');
  compiled.paths = Module._nodeModulePaths(process.cwd());
  compiled._compile(bundle.outputFiles[0].text, 'bridge.cjs');
  const bridge = compiled.exports;
  fs.mkdirSync('artifacts', { recursive: true });
  const directory = fs.mkdtempSync(path.resolve('artifacts/apo-')),
    config = path.join(directory, 'config.txt'),
    include = path.join(directory, 'audiosage-eq.txt');
  const original = '# User settings\r\nPreamp: -1 dB\r\n';
  fs.writeFileSync(config, original);
  fs.writeFileSync(include, '# Saved EQ\nPreamp: -4 dB');
  try {
    assert.equal(bridge.testWriteApo(config).success, true);
    assert.equal(fs.readFileSync(include, 'utf8'), '# Saved EQ\nPreamp: -4 dB');
    assert.ok(!fs.readdirSync(directory).some((f) => f.endsWith('.tmp')));
    const eq = 'Preamp: -3.2 dB\nFilter 1: ON PK Fc 1000 Hz Gain 3 dB Q 1.4';
    assert.equal(bridge.syncApoProfile(eq, config).success, true);
    assert.equal(fs.readFileSync(config + '.audiosage.bak', 'utf8'), original);
    assert.equal(bridge.syncApoProfile(eq, config).success, true);
    assert.equal(fs.readFileSync(config, 'utf8').split(bridge.MANAGED_INCLUDE_LINE).length - 1, 1);
    assert.equal(bridge.toggleApoManagedLine(false, config).success, true);
    assert.equal(fs.readFileSync(config, 'utf8'), original);
    fs.writeFileSync(config, original + 'Include: audiosage-eq.txt\r\n');
    bridge.toggleApoManagedLine(false, config);
    assert.ok(fs.readFileSync(config, 'utf8').includes('Include: audiosage-eq.txt'));
    assert.equal(bridge.syncApoProfile(eq, config).success, false);
    assert.equal(bridge.syncApoProfile('Include: secret.txt', config).success, false);
    assert.throws(() => bridge.resolveApoPaths(path.join(directory, '.env')), /config.txt/);
    let handler;
    bridge.apoBridgePlugin().configureServer({
      middlewares: {
        use(fn) {
          handler = fn;
        },
      },
    });
    const request = async (headers, socket = { remoteAddress: '127.0.0.1' }, payload = '{}') => {
      let result;
      const req = Object.assign(
        (async function* () {
          yield payload;
        })(),
        { url: '/api/apo/sync', method: 'POST', headers, socket },
      );
      const res = {
        statusCode: 0,
        setHeader() {},
        end(text) {
          result = { status: this.statusCode, body: JSON.parse(text) };
        },
      };
      await handler(req, res, () => {});
      return result;
    };
    assert.equal((await request({ host: 'localhost:3000', 'content-type': 'text/plain' })).status, 415);
    assert.equal(
      (
        await request({
          host: 'localhost:3000',
          'content-type': 'application/json',
          origin: 'http://evil.example',
        })
      ).status,
      403,
    );
    assert.equal((await request({ host: 'evil.example', 'content-type': 'application/json' })).status, 403);
    assert.equal(
      (
        await request(
          { host: 'localhost:3000', 'content-type': 'application/json' },
          { remoteAddress: '192.168.1.4' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          { host: 'localhost:3000', 'content-type': 'application/json' },
          { remoteAddress: '127.0.0.1' },
          '{broken',
        )
      ).status,
      400,
    );
    console.log(
      'PASS APO non-destructive probe, backup, idempotent sync, managed disable, path and command validation',
    );
  } finally {
    for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
    fs.rmdirSync(directory);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
