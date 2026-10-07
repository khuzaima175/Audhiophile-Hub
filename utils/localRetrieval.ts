import { AudioProfile, ChatSession, KnowledgeEntry } from '../types';
export interface RetrievalRecord {
  id: string; title: string; text: string; kind: 'passage' | 'generated-summary' | 'preference' | 'user-note';
  timestamp: number; provenance: string; enabled: boolean; revision: string; pinned: boolean;
}
export interface RetrievalSettings { version: 1; olderConversations: boolean; budgetCharacters: number; minScore: number; }
export const DEFAULT_RETRIEVAL_SETTINGS: RetrievalSettings = { version: 1, olderConversations: false, budgetCharacters: 6000, minScore: .5 };
const STOP = new Set('a an the and or to of in on for is are was be with me my it this that how can do does i you your please'.split(' '));
export function tokenize(text: string): string[] { return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:[.+-][\p{L}\p{N}]+)*/gu) || []).filter(t => !STOP.has(t)); }
export function sourceRevision(session: ChatSession): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(session.messages.map(m => [m.id,m.role,m.text,m.timestamp]))) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
  return `${session.messages.length}:${(hash >>> 0).toString(16)}`;
}
function textRevision(text: string): string { let hash = 0; for (const c of text) hash = Math.imul(hash,31)+c.charCodeAt(0)|0; return (hash >>> 0).toString(16); }
export function indexLocalSources(sessions: ChatSession[], notes: KnowledgeEntry[], profile: AudioProfile, currentSessionId?: string): RetrievalRecord[] {
  const records: RetrievalRecord[] = [];
  for (const s of sessions) {
    if (s.id === currentSessionId || s.retrievalEnabled === false) continue;
    for (const m of s.messages) {
      const passages = (m.text || '').split(/\n\s*\n/).flatMap(p => p.match(/[\s\S]{1,700}/g) || []);
      passages.forEach((text,i) => records.push({ id: `chat:${s.id}:${m.id}:${i}`, title: s.title, text, kind: 'passage', timestamp: m.timestamp, provenance: `Conversation ${s.id}, message ${m.id}`, enabled: true, revision: textRevision(text), pinned: !!s.isStarred }));
    }
  }
  for (const n of notes) {
    const source = sessions.find(s => s.id === n.sourceSessionId);
    const fresh = n.provenance === 'user-note' || (!!source && n.sourceRevision === sourceRevision(source));
    if (!fresh || source?.retrievalEnabled === false || n.enabled === false) continue;
    const text = `${n.summary}\n${n.keyFacts.join('; ')}`;
    records.push({ id: `note:${n.id}`, title: n.topic, text, kind: n.provenance === 'user-note' ? 'user-note' : 'generated-summary', timestamp: n.timestamp, provenance: n.sourceSessionId || 'User note', enabled: true, revision: textRevision(text), pinned: !!n.pinned });
  }
  const fields = { preferredSound: profile.soundSignature, gear: profile.currentGear, genres: profile.preferredGenres, notes: profile.notes, technicalPreferences: profile.technicalPrefs };
  Object.entries(fields).forEach(([id,text]) => { if (text) records.push({ id: `profile:${id}`, title: `User preference: ${id}`, text, kind: 'preference', timestamp: 0, provenance: 'User profile', enabled: true, revision: textRevision(text), pinned: false }); });
  profile.savedMemories.forEach((text,i) => records.push({ id: `preference:${textRevision(text)}`, title: `User preference ${i+1}`, text, kind: 'preference', timestamp: 0, provenance: 'User-authored preference', enabled: true, revision: textRevision(text), pinned: false }));
  return records;
}
export function retrieveLocal(records: RetrievalRecord[], query: string, settings: RetrievalSettings = DEFAULT_RETRIEVAL_SETTINGS) {
  const terms = [...new Set(tokenize(query))];
  const docs = records.filter(r => r.enabled && (settings.olderConversations || r.kind !== 'passage'));
  const tokens = docs.map(d => tokenize(d.text));
  const avgLength = tokens.reduce((s,d) => s+d.length,0)/Math.max(1,docs.length);
  const df = new Map(terms.map(t => [t,tokens.filter(d => d.includes(t)).length]));
  const scored = docs.map((record,i) => {
    let score = 0, matches = 0;
    terms.forEach(term => {
      const tf = tokens[i].filter(t => t === term).length;
      if (!tf) return; matches++;
      const idf = Math.log(1 + (docs.length - (df.get(term) || 0) + .5) / ((df.get(term) || 0) + .5));
      score += idf * (tf * 2.2) / (tf + 1.2 * (.25 + .75 * tokens[i].length / Math.max(1,avgLength)));
    });
    return { record, score: score * (record.pinned ? 1.1 : 1), matches };
  }).filter(r => r.matches > 0 && r.score >= settings.minScore).sort((a,b) => b.score-a.score || b.record.timestamp-a.record.timestamp || a.record.id.localeCompare(b.record.id));
  const seen = new Set<string>();
  const selected: RetrievalRecord[] = [];
  const quoted: string[] = [];
  let characters = 0;
  const budget = Math.max(0, Math.min(20000,settings.budgetCharacters));
  for (const { record } of scored) {
    const normalized = tokenize(record.text).join(' ');
    if (seen.has(normalized)) continue;
    const quote = JSON.stringify({ id: record.id, kind: record.kind, provenance: record.provenance, title: record.title, text: record.text });
    if (characters + quote.length + (quoted.length ? 1 : 0) > budget) continue;
    selected.push(record); quoted.push(quote); seen.add(normalized); characters += quote.length + (quoted.length > 1 ? 1 : 0);
  }
  return { records: selected, context: quoted.join('\n'), characters, metadata: selected.map((r,i) => ({ id: r.id, title: r.title, kind: r.kind, revision: r.revision, characters: quoted[i].length })) };
}
export function validateRetrievalSettings(s: any): s is RetrievalSettings { return s?.version === 1 && typeof s.olderConversations === 'boolean' && Number.isFinite(s.budgetCharacters) && s.budgetCharacters >= 0 && s.budgetCharacters <= 20000 && Number.isFinite(s.minScore) && s.minScore >= 0; }
export function getRetrievalSettings(): RetrievalSettings {
  try { const s = JSON.parse(localStorage.getItem('audiosage_retrieval_v1') || 'null'); return validateRetrievalSettings(s) ? s : DEFAULT_RETRIEVAL_SETTINGS; } catch { return DEFAULT_RETRIEVAL_SETTINGS; }
}
