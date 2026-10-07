import { TARGET_CURVES } from '../constants/targetCurves';
import { AudioProfile, ChatSession, KnowledgeEntry, LabState, DEFAULT_PROFILE } from '../types';
import { audioWorkspace, AudioDraft, freshDraft, getMeasurementRecords, MeasurementRecord, validateDraft, validateMeasurementRecord, writeMeasurementRecords } from '../store/audioWorkspace';
import { labStore, validateLabState, persistComparison, readComparisonRaw, readRestoreRecovery, writeRestoreRecovery } from '../store/labStore';
import { validateProfile, validateChats, validateKnowledge } from './dataValidation';
import { getRetrievalSettings, RetrievalSettings, validateRetrievalSettings } from './localRetrieval';
const APPLICATION = 'AudioSage';
export interface WorkspaceBackup {
  application: 'AudioSage'; version: 3; timestamp: string;
  profile: AudioProfile; chats: ChatSession[]; knowledgeBase: KnowledgeEntry[];
  audio: { version: 2; draft: AudioDraft; measurements: MeasurementRecord[]; comparison: LabState; retrievalSettings: RetrievalSettings; };
  preservedRestoreRecovery?: unknown;
  unreadableOriginals?: Record<string,string>;
}
const KEYS = ['audiosage_profile_v1','audiosage_chats_v1','audiosage_knowledge_v1','audiosage_audio_draft_v2','audiosage_retrieval_v1'];
const stripCredentials = (value: any): any => Array.isArray(value) ? value.map(stripCredentials) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([k]) => !/api.?key|credential|secret|token/i.test(k)).map(([k,v]) => [k,stripCredentials(v)])) : value;
export async function createWorkspaceBackup(profile: AudioProfile, chats: ChatSession[], notes: KnowledgeEntry[]): Promise<WorkspaceBackup> {
  const unreadableOriginals: Record<string,string> = {};
  KEYS.forEach(key => { try { const raw = localStorage.getItem(key); if (raw) JSON.parse(raw); } catch { const raw = localStorage.getItem(key); if (raw) unreadableOriginals[key] = raw; } });
  const storedDraft = audioWorkspace.original();
  if (storedDraft) { try { if (!validateDraft(JSON.parse(storedDraft))) unreadableOriginals.audiosage_audio_draft_v2 = storedDraft; } catch {} }
  const rawComparison = await readComparisonRaw();
  if (rawComparison && !validateLabState(rawComparison)) unreadableOriginals.comparison = JSON.stringify(rawComparison);
  return stripCredentials({ preservedRestoreRecovery: await readRestoreRecovery(), application: APPLICATION, version: 3, timestamp: new Date().toISOString(), profile, chats, knowledgeBase: notes,
    audio: { version: 2, draft: audioWorkspace.getSnapshot().draft, measurements: await getMeasurementRecords(), comparison: labStore.getSnapshot(), retrievalSettings: getRetrievalSettings() }, unreadableOriginals });
}
function uniqueIds(items: any[], label: string) { if (new Set(items.map(x=>x.id)).size !== items.length || items.some(x=>typeof x.id !== 'string')) throw new Error(`Duplicate or missing IDs in ${label}`); }
export function validateBackup(input: any): WorkspaceBackup {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Not an AudioSage backup');
  if (input.version !== undefined && ![1,2,3].includes(input.version)) throw new Error('Unsupported backup version. Original file has not been changed.');
  if (input.application && input.application !== APPLICATION) throw new Error('Not an AudioSage backup');
  if (!input.profile && !input.chats && !input.knowledgeBase) throw new Error('Backup contains no profile, chats, or notes');
  const profile = { ...DEFAULT_PROFILE, ...(input.profile || {}) };
  const chats = input.chats || [], knowledgeBase = input.knowledgeBase || [];
  if (!validateProfile(profile) || !validateChats(chats) || !validateKnowledge(knowledgeBase)) throw new Error('Invalid profile, conversations, or notes');
  uniqueIds(profile.eqLibrary,'presets'); uniqueIds(profile.gearLibrary,'gear'); uniqueIds(chats,'conversations'); uniqueIds(knowledgeBase,'notes');
  chats.forEach((s: ChatSession)=>uniqueIds(s.messages,'messages'));
  const audio = input.version === 3 ? input.audio : { version: 2, draft: freshDraft(), measurements: [], comparison: { ...labStore.getSnapshot(), curves: labStore.getSnapshot().curves.filter(c=>c.isTarget) }, retrievalSettings: getRetrievalSettings() };
  if (audio?.draft?.version === 2) audio.draft = { ...freshDraft(), ...audio.draft };
  if (!audio || audio.version !== 2 || !validateDraft(audio.draft) || !Array.isArray(audio.measurements) || !audio.measurements.every(validateMeasurementRecord) || !validateLabState(audio.comparison) || !validateRetrievalSettings(audio.retrievalSettings)) throw new Error('Invalid Audio workspace data');
  uniqueIds(audio.measurements,'measurements');
  return stripCredentials({ application: APPLICATION, version: 3, timestamp: input.timestamp || new Date().toISOString(), profile, chats, knowledgeBase, audio, unreadableOriginals: input.unreadableOriginals });
}
export function missingBackupReferences(backup: WorkspaceBackup) {
  const ids = new Set(backup.audio.measurements.map(r=>r.id)), gear = new Set(backup.profile.gearLibrary.map(g=>g.id));
  const targets = new Set([...TARGET_CURVES.map(t=>t.id),'none',...backup.audio.comparison.curves.filter(c=>c.isTarget).map(c=>c.id),...[backup.audio.draft,...backup.profile.eqLibrary].filter(p=>p.targetMeasurementRef&&ids.has(p.targetMeasurementRef)).map(p=>'selectedTargetId' in p?p.selectedTargetId:p.targetCurveId || 'none')]);
  return [backup.audio.draft,...backup.profile.eqLibrary].flatMap(p=>[...(('selectedTargetId' in p ? p.selectedTargetId : p.targetCurveId) && !targets.has('selectedTargetId' in p ? p.selectedTargetId : p.targetCurveId!) ? ['Missing reference target'] : []),...(p.targetMeasurementRef && !ids.has(p.targetMeasurementRef) ? [`Target measurement ${p.targetMeasurementRef}`] : []),...(p.measurementRef && !ids.has(p.measurementRef) ? [`Measurement ${p.measurementRef}`] : []), ...(p.gearId && !gear.has(p.gearId) ? [`Gear ${p.gearId}`] : [])]);
}
export function recoverMissingReferences(backup: WorkspaceBackup) {
  const ids = new Set(backup.audio.measurements.map(r=>r.id)), gear = new Set(backup.profile.gearLibrary.map(g=>g.id));
  const targets = new Set([...TARGET_CURVES.map(t=>t.id),'none',...backup.audio.comparison.curves.filter(c=>c.isTarget).map(c=>c.id),...[backup.audio.draft,...backup.profile.eqLibrary].filter(p=>p.targetMeasurementRef&&ids.has(p.targetMeasurementRef)).map(p=>'selectedTargetId' in p?p.selectedTargetId:p.targetCurveId || 'none')]);
  if (!targets.has(backup.audio.draft.selectedTargetId)) backup.audio.draft.selectedTargetId = 'none';
  if (backup.audio.draft.targetMeasurementRef && !ids.has(backup.audio.draft.targetMeasurementRef)) backup.audio.draft.targetMeasurementRef = null;
  if (backup.audio.draft.measurementRef && !ids.has(backup.audio.draft.measurementRef)) backup.audio.draft.measurementRef = null;
  if (backup.audio.draft.gearId && !gear.has(backup.audio.draft.gearId)) backup.audio.draft.gearId = null;
  backup.profile.eqLibrary = backup.profile.eqLibrary.map(p=>({ ...p, targetMeasurementRef: p.targetMeasurementRef && ids.has(p.targetMeasurementRef) ? p.targetMeasurementRef : undefined, targetCurveId: p.targetCurveId && targets.has(p.targetCurveId) ? p.targetCurveId : 'none', measurementRef: p.measurementRef && ids.has(p.measurementRef) ? p.measurementRef : undefined, gearId: p.gearId && gear.has(p.gearId) ? p.gearId : undefined }));
}
// Stage full pre-restore recovery data before replacing any live state. Legacy originals stay recoverable.
export async function restoreWorkspaceBackup(backup: WorkspaceBackup) {
  if (missingBackupReferences(backup).length) throw new Error('Resolve missing source references before restoring');
  const old = KEYS.map(key => [key,localStorage.getItem(key)] as const);
  const previousMeasurements = await getMeasurementRecords();
  const previousComparison = await readComparisonRaw();
  const recovery = stripCredentials({ originals: Object.fromEntries(old), measurements: previousMeasurements, comparison: previousComparison });
  await writeRestoreRecovery(recovery);
  localStorage.setItem('audiosage_restore_recovery_v3', JSON.stringify({ version: 3, state: 'pending', location: 'IndexedDB comparison/restore-recovery' }));
  try {
    // IndexedDB writes are additive and transactional; old records are never deleted during restoration.
    await writeMeasurementRecords(backup.audio.measurements);
    await persistComparison(backup.audio.comparison);
    const values = [backup.profile,backup.chats,backup.knowledgeBase,backup.audio.draft,backup.audio.retrievalSettings];
    KEYS.forEach((key,i)=>localStorage.setItem(key,JSON.stringify(values[i])));
    localStorage.setItem('audiosage_restore_recovery_v3', JSON.stringify({ version: 3, state: 'completed', location: 'IndexedDB comparison/restore-recovery' }));
  } catch (e) {
    try { old.forEach(([key,value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key,value)); if (previousComparison && validateLabState(previousComparison)) await persistComparison(previousComparison); } catch {}
    throw new Error('Restore write failed. Previous workspace is preserved in recovery data; export it before refreshing.');
  }
  audioWorkspace.restoreValidatedDraft(backup.audio.draft);
  labStore.loadState({ ...backup.audio.comparison, isOpen: false });
  labStore.setIsOpen(false);
  labStore.enablePersistence();
}

export async function previousWorkspaceBackup(): Promise<WorkspaceBackup> {
  const recovery = await readRestoreRecovery() as { originals?: Record<string,string | null>; measurements?: MeasurementRecord[]; comparison?: LabState } | null;
  if (!recovery?.originals) throw new Error('No previous workspace recovery is available');
  const read = (key: string, fallback: unknown) => recovery.originals![key] ? JSON.parse(recovery.originals![key]!) : fallback;
  return validateBackup({ application: APPLICATION, version: 3, profile: read(KEYS[0],DEFAULT_PROFILE), chats: read(KEYS[1],[]), knowledgeBase: read(KEYS[2],[]), audio: { version: 2, draft: read(KEYS[3],freshDraft()), measurements: recovery.measurements || [], comparison: recovery.comparison || labStore.getSnapshot(), retrievalSettings: read(KEYS[4],getRetrievalSettings()) } });
}
