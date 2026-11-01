const http = require('node:http');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');

function isServerRunning(url = 'http://127.0.0.1:3000') {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureViteServer(port = 3000, subcommand = []) {
  const url = `http://127.0.0.1:${port}`;
  if (await isServerRunning(url)) {
    return { spawned: false, kill: () => {} };
  }

  const viteBin = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  const args = [viteBin, ...subcommand, '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  const child = spawn(process.execPath, args, {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
    windowsHide: true,
  });

  const startTime = Date.now();
  let online = false;
  while (Date.now() - startTime < 12000) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isServerRunning(url)) {
      online = true;
      break;
    }
  }

  if (!online) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {}
    throw new Error(`Failed to start Vite dev server on port ${port} within 12 seconds.`);
  }

  const kill = () => {
    if (!child || !child.pid) return;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch (e) {}
  };

  return { spawned: true, kill, pid: child.pid };
}

async function launchBrowser(chromium, options = {}) {
  if (process.env.PLAYWRIGHT_BROWSER_PATH) {
    return chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSER_PATH, headless: true, ...options });
  }
  try {
    return await chromium.launch({ headless: true, ...options });
  } catch (err) {
    if (process.platform === 'win32') {
      try {
        return await chromium.launch({ channel: 'msedge', headless: true, ...options });
      } catch (edgeErr) {
        return await chromium.launch({ channel: 'chrome', headless: true, ...options });
      }
    }
    return await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, ...options });
  }
}

async function ensurePreviewServer(port = 3001) {
  return ensureViteServer(port, ['preview']);
}

module.exports = {
  isServerRunning,
  ensureViteServer,
  ensurePreviewServer,
  launchBrowser,
};
