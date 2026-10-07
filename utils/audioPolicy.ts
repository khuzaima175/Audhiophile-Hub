import { PEQFilter } from '../types';
import { safePreamp, DSP_SAMPLE_RATE } from './biquad';
export function effectivePreamp(filters: PEQFilter[], mode: 'automatic' | 'manual', requested: number, rate = DSP_SAMPLE_RATE) {
  const protective = safePreamp(filters, rate);
  return mode === 'automatic' ? protective : Math.min(requested, protective);
}
// One active playback lease across editor and comparison. Switching owner stops the previous source.
let owner: object | null = null;
let release: (() => void) | null = null;
export function claimPlayback(next: object, stop: () => void) {
  if (owner !== next) { release?.(); owner = next; release = stop; }
}
export function releasePlayback(current: object) { if (owner === current) { owner = null; release = null; } }
