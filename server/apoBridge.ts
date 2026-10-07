import fs from 'fs';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * AudioSage V2 Equalizer APO System-Wide Bridge
 *
 * Non-Destructive Include-File Strategy:
 * 1. NEVER overwrites the user's master config.txt.
 * 2. Writes all AudioSage preamps and biquad filter lines to a sibling file: `audiosage-eq.txt`.
 * 3. Ensures config.txt contains exactly one managed line: `Include: audiosage-eq.txt # AudioSage managed`.
 * 4. Backs up config.txt to `config.txt.audiosage.bak` before making any modifications.
 * 5. Disabling removes only the managed line.
 */

export const DEFAULT_APO_CONFIG_PATH = 'C:\\Program Files\\Equalizer APO\\config\\config.txt';
export const MANAGED_INCLUDE_LINE = 'Include: audiosage-eq.txt # AudioSage managed';
export const SIBLING_FILENAME = 'audiosage-eq.txt';

export interface ApoBridgeRequestData {
  configPath?: string;
  eqContent?: string;
  enabled?: boolean;
}

/**
 * Resolves sibling audiosage-eq.txt and backup paths given a config.txt path
 */
export const resolveApoPaths = (customPath?: string) => {
  const configPath = customPath && customPath.trim() ? customPath.trim() : DEFAULT_APO_CONFIG_PATH;
  if (!path.isAbsolute(configPath) || path.basename(configPath).toLowerCase() !== 'config.txt')
    throw new Error('Choose an absolute path to an existing Equalizer APO config.txt file');
  const dir = path.dirname(configPath);
  const includePath = path.join(dir, SIBLING_FILENAME);
  const backupPath = `${configPath}.audiosage.bak`;
  return { configPath, dir, includePath, backupPath };
};

/**
 * Check status of Equalizer APO configuration
 */
export const checkApoStatus = (customPath?: string) => {
  const { configPath, includePath, backupPath } = resolveApoPaths(customPath);
  const configExists = fs.existsSync(configPath);
  const includeExists = fs.existsSync(includePath);
  const backupExists = fs.existsSync(backupPath);

  let hasManagedInclude = false;
  let lastModified: number | undefined;

  if (configExists) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      hasManagedInclude =
        content.includes(MANAGED_INCLUDE_LINE) || content.toLowerCase().includes('include: audiosage-eq.txt');
      const stats = fs.statSync(configPath);
      lastModified = stats.mtimeMs;
    } catch (e) {}
  }

  return {
    connected: configExists,
    path: configPath,
    exists: configExists,
    includePath,
    includeExists,
    hasManagedInclude,
    hasBackup: backupExists,
    lastModified,
  };
};

/**
 * Perform a test write and readback on audiosage-eq.txt to verify permissions
 */
export const testWriteApo = (customPath?: string) => {
  const { includePath, dir } = resolveApoPaths(customPath);
  const probePath = path.join(
    dir,
    `.audiosage-write-test-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
  );
  const timestamp = new Date().toISOString();
  const testMarker = `# AudioSage EQ Bridge Test Marker - ${timestamp}\n# Permission Verified: OK`;

  if (!fs.existsSync(dir))
    return { success: false, error: 'Equalizer APO configuration directory does not exist' };

  try {
    fs.writeFileSync(probePath, testMarker, { encoding: 'utf8', flag: 'wx' });
    const readBack = fs.readFileSync(probePath, 'utf8');
    if (readBack.includes(timestamp)) {
      return { success: true, path: includePath, timestamp };
    }
    return { success: false, error: 'Readback verification failed.' };
  } catch (e: any) {
    return { success: false, error: e.message };
  } finally {
    if (fs.existsSync(probePath)) fs.unlinkSync(probePath);
  }
};

/**
 * Sync EQ filters to audiosage-eq.txt and ensure config.txt includes it
 */
export const syncApoProfile = (eqContent: string, customPath?: string) => {
  const { configPath, dir, includePath, backupPath } = resolveApoPaths(customPath);
  if (!fs.existsSync(configPath)) return { success: false, error: 'Equalizer APO config.txt does not exist' };
  if (
    !eqContent
      .split(/\r?\n/)
      .every(
        (line) =>
          !line.trim() ||
          line.trim().startsWith('#') ||
          /^(Channel:\s*(L|R|ALL)|Preamp:\s*[+-]?[\d.]+\s*dB|Filter\s+\d+:\s*(ON|OFF)\s+(PK|LSC|HSC|HPQ|LPQ|NO)\s+Fc\s+[\d.]+\s+Hz(?:\s+Gain\s+[+-]?[\d.]+\s+dB)?\s+Q\s+[\d.]+)\s*$/i.test(
            line,
          ),
      )
  )
    return { success: false, error: 'Only generated channel, preamp and EQ filter commands are accepted' };
  const original = fs.readFileSync(configPath, 'utf8');
  if (original.split(/\r?\n/).some((l) => /^Include:\s*audiosage-eq\.txt\s*$/i.test(l.trim())))
    return {
      success: false,
      error:
        'This include is managed outside AudioSage. Remove it manually before enabling the managed bridge.',
    };
  if (!fs.existsSync(backupPath)) fs.copyFileSync(configPath, backupPath, fs.constants.COPYFILE_EXCL);

  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e: any) {
      return { success: false, error: `Directory not found or writable: ${e.message}` };
    }
  }

  // 1. Write the sibling audiosage-eq.txt
  const header = `# AudioSage System-Wide EQ Profile\n# Generated: ${new Date().toISOString()}\n# Equalizer APO Hot-Reload Target\n\n`;
  try {
    fs.writeFileSync(includePath, header + eqContent, 'utf8');
  } catch (e: any) {
    return { success: false, error: `Failed to write ${SIBLING_FILENAME}: ${e.message}` };
  }

  // 2. Ensure config.txt has the single managed include line
  let backupCreated = false;
  let managedLineAdded = false;

  try {
    let configContent = '';
    if (fs.existsSync(configPath)) {
      configContent = fs.readFileSync(configPath, 'utf8');

      // Create backup if not present
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, configContent, 'utf8');
        backupCreated = true;
      }
    }

    // Check if managed line already exists
    const hasLine =
      configContent.includes(MANAGED_INCLUDE_LINE) ||
      configContent.toLowerCase().includes('include: audiosage-eq.txt');
    if (!hasLine) {
      const eol = configContent.includes('\r\n') ? '\r\n' : '\n';
      const separator = configContent.length > 0 && !configContent.endsWith('\n') ? eol : '';
      const updatedConfig = `${configContent}${separator}${MANAGED_INCLUDE_LINE}${eol}`;
      fs.writeFileSync(configPath, updatedConfig, 'utf8');
      managedLineAdded = true;
    }

    return {
      success: true,
      path: configPath,
      includePath,
      backupCreated,
      managedLineAdded,
      timestamp: Date.now(),
    };
  } catch (e: any) {
    return { success: false, error: `Failed to update ${configPath}: ${e.message}` };
  }
};

/**
 * Toggle managed include line in config.txt on or off
 */
export const toggleApoManagedLine = (enable: boolean, customPath?: string) => {
  const { configPath, backupPath } = resolveApoPaths(customPath);

  if (!fs.existsSync(configPath)) {
    return { success: false, error: `Config file not found at ${configPath}` };
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Create backup if needed
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, configContent, 'utf8');
    }

    const lines = configContent.split(/\r?\n/);
    let updatedLines: string[];

    if (enable) {
      const exists = lines.some(
        (l) => l.trim() === MANAGED_INCLUDE_LINE || l.toLowerCase().includes('include: audiosage-eq.txt'),
      );
      if (!exists) {
        updatedLines = [...lines, MANAGED_INCLUDE_LINE];
      } else {
        updatedLines = lines;
      }
    } else {
      // Remove only the managed include line
      updatedLines = lines.filter((l) => l.trim() !== MANAGED_INCLUDE_LINE);
    }

    fs.writeFileSync(configPath, updatedLines.join(configContent.includes('\r\n') ? '\r\n' : '\n'), 'utf8');
    return { success: true, enabled: enable, path: configPath };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/**
 * Vite Dev Server Plugin to serve Equalizer APO Bridge API routes
 */
export const apoBridgePlugin = (): Plugin => {
  return {
    name: 'vite-plugin-audiosage-apo-bridge',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        if (!url.startsWith('/api/apo')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');

        const sendJson = (status: number, data: any) => {
          res.statusCode = status;
          res.end(JSON.stringify(data));
        };
        const remote = req.socket.remoteAddress || '';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote))
          return sendJson(403, { error: 'The APO bridge is local-only' });
        const hostname = new URL(`http://${req.headers.host}`).hostname;
        if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname))
          return sendJson(403, { error: 'Untrusted bridge host' });
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
          return sendJson(403, { error: 'Cross-origin bridge requests are not allowed' });

        try {
          if (req.method === 'GET' && url.startsWith('/api/apo/status')) {
            const parsedUrl = new URL(url, 'http://localhost');
            const customPath = parsedUrl.searchParams.get('path') || undefined;
            const status = checkApoStatus(customPath);
            return sendJson(200, status);
          }

          if (req.method === 'POST') {
            if (!req.headers['content-type']?.startsWith('application/json'))
              return sendJson(415, { error: 'JSON content type required' });
            // Read body stream
            let bodyStr = '';
            for await (const chunk of req) {
              bodyStr += chunk;
              if (bodyStr.length > 65536) return sendJson(413, { error: 'Request too large' });
            }
            let body: ApoBridgeRequestData;
            try {
              body = bodyStr ? JSON.parse(bodyStr) : {};
            } catch {
              return sendJson(400, { error: 'Invalid JSON' });
            }
            if (
              !body ||
              typeof body !== 'object' ||
              (body.configPath !== undefined && typeof body.configPath !== 'string')
            )
              return sendJson(400, { error: 'Invalid request' });

            if (url.startsWith('/api/apo/test-write')) {
              const result = testWriteApo(body.configPath);
              return sendJson(result.success ? 200 : 400, result);
            }

            if (url.startsWith('/api/apo/sync')) {
              if (!body.eqContent) {
                return sendJson(400, { success: false, error: 'eqContent is required' });
              }
              const result = syncApoProfile(body.eqContent, body.configPath);
              return sendJson(result.success ? 200 : 400, result);
            }

            if (url.startsWith('/api/apo/toggle')) {
              const enable = body.enabled !== false;
              const result = toggleApoManagedLine(enable, body.configPath);
              return sendJson(result.success ? 200 : 400, result);
            }
          }

          sendJson(404, { error: 'Unknown APO bridge endpoint' });
        } catch (err: any) {
          sendJson(500, { success: false, error: err.message });
        }
      });
    },
  };
};

export default apoBridgePlugin;
