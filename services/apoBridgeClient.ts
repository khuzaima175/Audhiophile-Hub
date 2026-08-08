import { ApoBridgeStatus, ApoBridgeSyncResult } from '../types';

export const APO_DEFAULT_CONFIG_PATH = 'C:\\Program Files\\Equalizer APO\\config\\config.txt';
export const APO_STORAGE_PATH_KEY = 'audiosage_apo_config_path';
export const APO_STORAGE_ENABLED_KEY = 'audiosage_apo_enabled';
export const APO_STORAGE_LAST_APPLIED_KEY = 'audiosage_apo_last_applied';

export const getStoredApoConfigPath = (): string => {
  if (typeof window === 'undefined') return APO_DEFAULT_CONFIG_PATH;
  return localStorage.getItem(APO_STORAGE_PATH_KEY) || APO_DEFAULT_CONFIG_PATH;
};

export const setStoredApoConfigPath = (path: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(APO_STORAGE_PATH_KEY, path.trim());
};

export const getStoredApoEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(APO_STORAGE_ENABLED_KEY) === 'true';
};

export const setStoredApoEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(APO_STORAGE_ENABLED_KEY, enabled ? 'true' : 'false');
};

export const getStoredApoLastApplied = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(APO_STORAGE_LAST_APPLIED_KEY);
};

export const setStoredApoLastApplied = (timeStr: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(APO_STORAGE_LAST_APPLIED_KEY, timeStr);
};

/**
 * Check connection status of Equalizer APO on host PC
 */
export const checkApoBridgeStatus = async (customPath?: string): Promise<ApoBridgeStatus> => {
  const path = customPath || getStoredApoConfigPath();
  try {
    const res = await fetch(`/api/apo/status?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        connected: true,
      };
    }
    const err = await res.json().catch(() => ({}));
    return {
      connected: false,
      path,
      exists: false,
      hasManagedInclude: false,
      hasBackup: false,
      error: err.error || `HTTP ${res.status}`,
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
