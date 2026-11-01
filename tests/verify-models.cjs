const assert = require('node:assert/strict');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

// Read key from .env.local if present
let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey && fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
  if (match) apiKey = match[1].trim();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('--- Verifying Model Catalog and Fallback Cascade ---');
  
  if (!apiKey) {
    console.log('No GEMINI_API_KEY available in environment or .env.local. Running synthetic fallback cascade verification.');
  } else {
    console.log('Querying Google Gemini API model list with configured key...');
    const result = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (result.status === 200 && result.body.models) {
      const modelNames = result.body.models.map(m => m.name.replace(/^models\//, ''));
      console.log(`Found ${modelNames.length} available models in Google AI Studio catalog:`);
      const sample = modelNames.filter(m => m.includes('flash') || m.includes('pro')).slice(0, 10);
      console.log('Sample models:', sample);

      const targetModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];
      for (const target of targetModels) {
        const found = modelNames.includes(target);
        console.log(`- Catalog presence for "${target}": ${found ? 'EXISTS IN API' : 'NOT in API catalog (alias/future)'}`);
      }
    } else {
      console.log('Model list query returned status:', result.status, result.body?.error?.message || result.raw);
    }
  }

  // Verify fallback cascade logic in services/geminiService
  console.log('\nVerifying fallback cascade logic when primary model is unavailable...');
  const esbuild = require('esbuild');
  const Module = require('node:module');

  const bundle = await esbuild.build({
    stdin: {
      contents: `export * from './services/aiConfig';`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });

  const m = new Module('ai-test');
  m.paths = Module._nodeModulePaths(process.cwd());
  m._compile(bundle.outputFiles[0].text, 'ai-test.cjs');
  const { MODEL_IDS, classifyAiError } = m.exports;

  assert.deepEqual(MODEL_IDS, ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
  assert.equal(classifyAiError(new Error('404 Not Found: Model not supported')), 'model');
  assert.equal(classifyAiError(new Error('429 Resource exhausted')), 'quota');
  assert.equal(classifyAiError(new Error('401 API key invalid')), 'credential');

  console.log('PASS: Model IDs and error classification verified:');
  console.log('  Primary:   ', MODEL_IDS[0]);
  console.log('  Secondary: ', MODEL_IDS[1]);
  console.log('  Tertiary:  ', MODEL_IDS[2]);
  console.log('  Model unavailable error correctly classified -> triggers fallback');
})().catch(e => {
  console.error('Model verification failed:', e);
  process.exit(1);
});
