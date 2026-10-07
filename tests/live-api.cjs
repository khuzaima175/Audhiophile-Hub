// Explicit opt-in check; never logs credentials or sends the user's profile.
const fs = require('node:fs');
(async () => {
  const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  const match = env.match(/^\s*(?:GEMINI_API_KEY|VITE_GEMINI_API_KEY)\s*=\s*(.+?)\s*$/m);
  const key = process.env.GEMINI_API_KEY || match?.[1]?.replace(/^["']|["']$/g, '');
  if (!key) {
    console.log('LIVE AI: no environment key available; browser-configured keys were not accessed');
    return;
  }
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with OK only. This is a connection test.' }] }],
        generationConfig: { maxOutputTokens: 64 },
      }),
    },
  );
  const result = await response.json();
  console.log(
    'LIVE AI:',
    response.status,
    response.ok ? 'generation endpoint accepted the connection' : result.error?.status || 'request failed',
  );
  if (!response.ok) process.exitCode = 1;
})().catch(() => {
  console.log('LIVE AI: network connection failed');
  process.exitCode = 1;
});
