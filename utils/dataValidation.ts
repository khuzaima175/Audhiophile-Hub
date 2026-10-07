const record = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const strings = (x: unknown) => Array.isArray(x) && x.every((v) => typeof v === 'string');
export function validateProfile(x: unknown): boolean {
  if (!record(x)) return false;
  if (
    ['name', 'soundSignature', 'preferredGenres', 'currentGear', 'notes', 'technicalPrefs'].some(
      (k) => x[k] !== undefined && typeof x[k] !== 'string',
    )
  )
    return false;
  if (x.savedMemories !== undefined && !strings(x.savedMemories)) return false;
  if (
    x.gearLibrary !== undefined &&
    (!Array.isArray(x.gearLibrary) ||
      !x.gearLibrary.every(
        (g: any) =>
          record(g) &&
          typeof g.id === 'string' &&
          typeof g.name === 'string' &&
          ['IEM', 'Headphone', 'DAC', 'AMP', 'Other'].includes(g.type) &&
          ['owned', 'wishlist', 'tried'].includes(g.status),
      ))
  )
    return false;
  if (
    x.eqLibrary !== undefined &&
    (!Array.isArray(x.eqLibrary) ||
      !x.eqLibrary.every(
        (p: any) =>
          record(p) &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          typeof p.hardware === 'string' &&
          typeof p.bands === 'string' &&
          (p.mode === undefined || ['10-band','15-band','31-band','peq'].includes(p.mode)) &&
          (p.preampMode === undefined || ['automatic','manual'].includes(p.preampMode)) &&
          (p.preamp === undefined || (Number.isFinite(p.preamp) && Math.abs(p.preamp) <= 36)) &&
          (p.requestedPreamp === undefined || (Number.isFinite(p.requestedPreamp) && Math.abs(p.requestedPreamp) <= 36)) &&
          (p.sampleRate === undefined || [44100,48000,96000].includes(p.sampleRate)) &&
          (p.gearId === undefined || typeof p.gearId === 'string') &&
          (p.measurementRef === undefined || typeof p.measurementRef === 'string') &&
          (p.analysis === undefined || (record(p.analysis) && ['RAW','1/6 OCT','1/3 OCT'].includes(p.analysis.smoothing) && typeof p.analysis.normalize === 'boolean')) &&
          (p.graphicGains === undefined ||
            (Array.isArray(p.graphicGains) &&
              [10, 15, 31].includes(p.graphicGains.length) &&
              p.graphicGains.every(Number.isFinite))) &&
          (p.peqFilters === undefined ||
            (Array.isArray(p.peqFilters) &&
              p.peqFilters.every(
                (f: any) =>
                  record(f) &&
                  typeof f.id === 'string' &&
                  (f.enabled === undefined || typeof f.enabled === 'boolean') &&
                  ['PK', 'LS', 'HS', 'HP', 'LP', 'NOTCH'].includes(f.type) &&
                  Number.isFinite(f.freq) &&
                  f.freq >= 20 &&
                  f.freq <= 20000 &&
                  Number.isFinite(f.gain) &&
                  Math.abs(f.gain) <= 36 &&
                  Number.isFinite(f.q) &&
                  f.q > 0 &&
                  f.q <= 20,
              ))),
      ))
  )
    return false;
  if (
    x.faderState !== undefined &&
    (!record(x.faderState) ||
      !['bassGain', 'sibilanceGain', 'airGain'].every((k) => Number.isFinite(x.faderState[k])))
  )
    return false;
  return true;
}
export function validateChats(x: unknown): boolean {
  return (
    Array.isArray(x) &&
    x.every(
      (s) =>
        record(s) &&
        typeof s.id === 'string' &&
        typeof s.title === 'string' &&
        Array.isArray(s.messages) &&
        s.messages.every(
          (m: any) =>
            record(m) &&
            typeof m.id === 'string' &&
            ['user', 'model'].includes(m.role) &&
            typeof m.text === 'string',
        ),
    )
  );
}
export function validateKnowledge(x: unknown): boolean {
  return (
    Array.isArray(x) &&
    x.every(
      (n) => record(n) && typeof n.id === 'string' && (n.enabled === undefined || typeof n.enabled === 'boolean') && (n.pinned === undefined || typeof n.pinned === 'boolean') && typeof n.topic === 'string' && typeof n.summary === 'string' && strings(n.keyFacts),
    )
  );
}
