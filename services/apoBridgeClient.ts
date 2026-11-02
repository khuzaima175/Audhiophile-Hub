import { ApoBridgeStatus, ApoBridgeSyncResult } from '../types';

export const APO_DEFAULT_CONFIG_PATH = 'C:\\Program Files\\Equalizer APO\\config\\config.txt';
export const APO_STORAGE_PATH_KEY = 'audiosage_apo_config_path';
export const APO_STORAGE_ENABLED_KEY = 'audiosage_apo_enabled';
export const APO_STORAGE_LAST_APPLIED_KEY = 'audiosage_apo_last_applied';
export const APO_SPLIT_NOTICE_KEY = 'audiosage_apo_split_notice_v1';
const APO_APPLIED_STATE_KEY = 'audiosage_apo_applied_state_v1';
const APO_APPLY_CONSENT_KEY = 'audiosage_apo_apply_consent_v1';
export interface AppliedApoState { label: string; signature: string; }

export const hasStoredApoApplyConsent = (path: string): boolean => {
  try { return localStorage.getItem(APO_APPLY_CONSENT_KEY) === path; } catch { return false; }
};

export const setStoredApoApplyConsent = (path: string): void => {
  try { localStorage.setItem(APO_APPLY_CONSENT_KEY, path); } catch {}
};

export const getStoredAppliedApoState = (): AppliedApoState | null => {
  try {
    const value = JSON.parse(localStorage.getItem(APO_APPLIED_STATE_KEY) || 'null');
    return value && typeof value.label === 'string' && typeof value.signature === 'string'
      ? { label: value.label, signature: value.signature } : null;
  } catch { return null; }
};

export const setStoredAppliedApoState = (value: AppliedApoState): void => {
  try { localStorage.setItem(APO_APPLIED_STATE_KEY, JSON.stringify(value)); } catch {}
};

export const getStoredApoConfigPath = (): string => {
  if (typeof window === 'undefined') return APO_DEFAULT_CONFIG_PATH;
  try {
    return localStorage.getItem(APO_STORAGE_PATH_KEY) || APO_DEFAULT_CONFIG_PATH;
  } catch {
    return APO_DEFAULT_CONFIG_PATH;
  }
};

export const setStoredApoConfigPath = (path: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APO_STORAGE_PATH_KEY, path.trim());
  } catch {}
};

export const getStoredApoEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(APO_STORAGE_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setStoredApoEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APO_STORAGE_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {}
};

export const getStoredApoLastApplied = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(APO_STORAGE_LAST_APPLIED_KEY);
  } catch {
    return null;
  }
};

export const setStoredApoLastApplied = (timeStr: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APO_STORAGE_LAST_APPLIED_KEY, timeStr);
  } catch {}
};

export const shouldShowApoSplitNotice = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(APO_STORAGE_ENABLED_KEY) === 'true' && localStorage.getItem(APO_SPLIT_NOTICE_KEY) !== 'dismissed';
  } catch {
    return false;
  }
};

export const dismissApoSplitNotice = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(APO_SPLIT_NOTICE_KEY, 'dismissed');
  } catch {}
};

/**
 * Check connection status of Equalizer APO on host PC
 */
export const checkApoBridgeStatus = async (customPath?: string): Promise<ApoBridgeStatus> => {
  const path = customPath || getStoredApoConfigPath();
  try {
    const res = await fetch(`/api/apo/status?path=${encodeURIComponent(path)}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        connected: false,
        path,
        exists: false,
        hasManagedInclude: false,
        hasBackup: false,
        error: 'Needs a local run on Windows',
      };
    }
    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        connected: data.connected === true && data.exists === true,
        error: data.error || (data.exists === true ? undefined : 'Local bridge connected · Equalizer APO config.txt not found. Check the path in Settings.'),
      };
    }
    const err = await res.json().catch(() => ({}));
    return {
      connected: false,
      path,
      exists: false,
      hasManagedInclude: false,
      hasBackup: false,
      error: `Local bridge error: ${err.error || `HTTP ${res.status}`}`,
    };
  } catch (e: any) {
    return {
      connected: false,
      path,
      exists: false,
      hasManagedInclude: false,
      hasBackup: false,
      error: e.message || 'Bridge offline (Vite dev server API not responding)',
    };
  }
};

/**
 * Perform test write to verify permissions on audiosage-eq.txt
 */
export const testApoWrite = async (customPath?: string): Promise<{ success: boolean; path?: string; timestamp?: string; error?: string }> => {
  const path = customPath || getStoredApoConfigPath();
  try {
    const res = await fetch('/api/apo/test-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configPath: path }),
    });
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/**
 * Hot sync Equalizer APO profile directly to audiosage-eq.txt
 */
export const syncApoProfileToServer = async (
  eqContent: string,
  customPath?: string
): Promise<ApoBridgeSyncResult> => {
  const path = customPath || getStoredApoConfigPath();
  try {
    const res = await fetch('/api/apo/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configPath: path, eqContent }),
    });
    const data = await res.json();
    if (data.success) {
      const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setStoredApoLastApplied(formattedTime);
      // A successful sync also installs/enables the managed include on the bridge.
      setStoredApoEnabled(true);
    }
    return data;
  } catch (e: any) {
    return {
      success: false,
      path,
      includePath: '',
      backupCreated: false,
      managedLineAdded: false,
      timestamp: Date.now(),
      error: e.message,
    };
  }
};

/**
 * Toggle managed include line in config.txt
 */
export const toggleApoManagedBridge = async (
  enable: boolean,
  customPath?: string
): Promise<{ success: boolean; enabled?: boolean; error?: string }> => {
  const path = customPath || getStoredApoConfigPath();
  try {
    const res = await fetch('/api/apo/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configPath: path, enabled: enable }),
    });
    const data = await res.json();
    if (data.success) {
      setStoredApoEnabled(enable);
    }
    return data;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};
