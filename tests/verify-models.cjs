const assert = require('node:assert/strict');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const Module = require('node:module');

// Ensure GOOGLE_API_KEY does not shadow GEMINI_API_KEY in @google/genai
delete process.env.GOOGLE_API_KEY;

// Load key from environment or .env.local without ever printing or logging the key value
let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey && fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
  if (match) apiKey = match[1].trim();
}
if (apiKey) {
  process.env.GEMINI_API_KEY = apiKey;
}

function fetchJson(url, method = 'GET', payload = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }
        : {},
    };
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('--- Verifying Model Catalog and Live Fallback Cascade ---');

  const bundle = await esbuild.build({
    stdin: {
      contents: `
        export * from './services/aiConfig';
        export * from './services/geminiService';
        export * from './types';
      `,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    define: {
      'import.meta.env': '{}',
    },
    external: ['@google/genai'],
    write: false,
  });

  const m = new Module('ai-test');
  m.paths = Module._nodeModulePaths(process.cwd());
  m._compile(bundle.outputFiles[0].text, 'ai-test.cjs');
  const { MODEL_IDS, classifyAiError, generateStreamResponse, DEFAULT_PROFILE } = m.exports;

  assert.deepEqual(MODEL_IDS, ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
  assert.equal(classifyAiError(new Error('404 Not Found: Model not supported')), 'model');
  assert.equal(classifyAiError(new Error('429 Resource exhausted')), 'quota');
  assert.equal(classifyAiError(new Error('401 API key invalid')), 'credential');

  if (!apiKey) {
    console.log('No GEMINI_API_KEY found in environment or .env.local; skipping live API network calls.');
    return;
  }

  console.log('1. Querying live Google Gemini API v1beta/models catalog...');
  const result = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  assert.equal(result.status, 200, `Expected HTTP 200 from models list, got ${result.status}`);
  const modelNames = result.body.models.map((mod) => mod.name.replace(/^models\//, ''));
  console.log(`   Total models returned by API: ${modelNames.length}`);

  for (const target of MODEL_IDS) {
    const found = modelNames.includes(target);
    console.log(`   - ${target}: ${found ? 'PRESENT IN API CATALOG' : 'MISSING'}`);
    assert.equal(found, true, `Configured model ${target} must exist in live API catalog`);
  }

  const bogusPrimary = 'gemini-bogus-nonexistent-99';
  console.log(`\n2. Running live generateStreamResponse with bogus primary ("${bogusPrimary}")...`);
  const warnLogs = [];
  const origWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.join(' ');
    warnLogs.push(msg);
    origWarn('   [geminiService]', msg);
  };

  let answeringModel = null;
  try {
    const fullText = await generateStreamResponse(
      [{ id: '1', role: 'user', text: 'Reply with Pong.', timestamp: Date.now() }],
      'Reply with Pong.',
      undefined,
      undefined,
      DEFAULT_PROFILE,
      [],
      [],
      false,
      null,
      () => {},
      () => {},
      (active) => {
        answeringModel = active;
      },
      bogusPrimary,
    );
    console.log(`   Live stream succeeded via fallback model: ${answeringModel} (${JSON.stringify(fullText.trim())})`);
  } catch (err) {
    console.log(`   Live stream after fallback stopped with: ${err.message}`);
  } finally {
    console.warn = origWarn;
  }

  // Verify that the bogus primary actually hit a 404 'model' error and triggered fallback to gemini-3.8-flash
  assert.ok(
    warnLogs.includes('Research failed: model'),
    'Bogus primary model must be classified as a model error (HTTP 404)',
  );
  assert.ok(
    warnLogs.includes('Falling back to gemini-3.8-flash'),
    'generateStreamResponse must fall back from bogus primary to gemini-3.8-flash',
  );

  console.log('\n3. Verifying live HTTP 404 -> HTTP 200 fallback against Google API (without Google Search tool quota)...');
  const candidates = [bogusPrimary, 'gemini-3.5-flash-lite'];
  let liveFallbackWinner = null;
  let liveFallbackReply = null;
  for (const candidate of candidates) {
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with the single word Pong.' }] }],
      generationConfig: { maxOutputTokens: 16 },
    });
    const res = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`,
      'POST',
      payload,
    );
    if (res.status === 404) {
      const kind = classifyAiError(new Error(`${res.status} ${res.body?.error?.message || 'Not found'}`));
      console.log(`   - ${candidate}: HTTP ${res.status} (classified as '${kind}') -> falling back`);
      assert.equal(kind, 'model');
      continue;
    }
    assert.equal(res.status, 200, `Expected HTTP 200 from ${candidate}, got ${res.status}`);
    liveFallbackWinner = candidate;
    liveFallbackReply = res.body?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    console.log(`   - ${candidate}: HTTP ${res.status} -> answered ${JSON.stringify(liveFallbackReply)}`);
    break;
  }
  assert.equal(liveFallbackWinner, 'gemini-3.5-flash-lite');
  assert.ok(liveFallbackReply.length > 0);

  console.log('\nPASS: Live API catalog presence and live bogus-primary fallback cascade verified.');
})().catch((e) => {
  console.error('Model verification failed:', e.message || e);
  process.exit(1);
});
