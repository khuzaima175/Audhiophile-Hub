import { PEQFilter, PEQFilterType, AutoPeqFitResult, AutoPeqFitOptions, MeasurementPoint } from '../types';
import { SYNTHESIS_FREQUENCIES, calculateFilterGainAtFreq } from './curveSynthesizer';
import { calculatePreampHeadroom } from './importExportParser';
import { getInterpolatedTargetGain } from '../constants/targetCurves';

/**
 * Generate 48-steps-per-decade logarithmic frequency grid from 20 Hz to 20,000 Hz
 */
export const generate48StepsPerDecadeGrid = (): number[] => {
  const freqs: number[] = [];
  const minFreq = 20;
  const maxFreq = 20000;
  const decades = Math.log10(maxFreq / minFreq); // 3 decades
  const totalSteps = Math.round(decades * 48); // ~144 steps

  for (let i = 0; i <= totalSteps; i++) {
    const f = minFreq * Math.pow(10, (i / totalSteps) * decades);
    freqs.push(Math.round(f * 10) / 10);
  }
  return freqs;
};

// Standard candidate Q pool for musical, stable PEQ fitting
export const CANDIDATE_Q_POOL = [0.5, 0.7, 1.0, 1.4, 2.0, 2.8, 4.0];

// Candidate low-shelf frequencies for bass correction
export const CANDIDATE_LOW_SHELF_FREQS = [60, 80, 105, 150, 200];

// Candidate high-shelf frequencies for treble air/tilt correction
export const CANDIDATE_HIGH_SHELF_FREQS = [6000, 8000, 10000, 12000, 14000];

/**
 * Calculate Root-Mean-Square (RMS) error across frequency points
 */
export const calculateRmsError = (residuals: number[]): number => {
  if (!residuals || residuals.length === 0) return 0;
  const sumSq = residuals.reduce((acc, val) => acc + val * val, 0);
  return Math.sqrt(sumSq / residuals.length);
};

/**
 * Greedy Residual PEQ Synthesizer
 * 
 * Fits corrective biquad filters to minimize the RMS deviation between a measured curve
 * and a chosen target curve (e.g. Crinacle IEF 2025).
 */
export const synthesizeAutoPeq = (
  measuredPoints: MeasurementPoint[],
  targetPoints: { freq: number; gain: number }[],
  options: AutoPeqFitOptions
): AutoPeqFitResult => {
  const { maxFilters = 10, minGain = -12, maxGain = 12 } = options;

  // 1. Evaluate measurement and target on the standard 180-point synthesis grid
  const evalFreqs = SYNTHESIS_FREQUENCIES;
  const measuredGainOnGrid = evalFreqs.map((f) => {
    return getInterpolatedTargetGain(f, measuredPoints);
  });

  const targetGainOnGrid = evalFreqs.map((f) => {
    return getInterpolatedTargetGain(f, targetPoints);
  });

  // Initial Residual = Target(f) - Measurement(f)
  let currentResidual = evalFreqs.map((_, i) => targetGainOnGrid[i] - measuredGainOnGrid[i]);
  const initialRms = parseFloat(calculateRmsError(currentResidual).toFixed(2));

  const candidateFreqs = generate48StepsPerDecadeGrid();
  const committedFilters: PEQFilter[] = [];

  // Track the cumulative filter response curve
  let cumulativeFilterGain = new Array(evalFreqs.length).fill(0);

  // 2. Greedy Search Loop
  for (let filterIdx = 0; filterIdx < maxFilters; filterIdx++) {
    const currentRms = calculateRmsError(currentResidual);
    if (currentRms <= 0.5) {
      // Reached excellent psychoacoustic convergence
      break;
    }

    let bestFilter: PEQFilter | null = null;
    let bestRmsReduction = 0;
    let bestResidualAfterFilter: number[] = [];

    // Candidate Generator:
    // A. Peaking candidates across 48-steps/dec grid x Q pool
    // B. Low shelf candidates
    // C. High shelf candidates

    const candidateTests: { type: PEQFilterType; freq: number; q: number }[] = [];

    // Add Peaking candidates
    candidateFreqs.forEach((fc) => {
      CANDIDATE_Q_POOL.forEach((q) => {
        candidateTests.push({ type: 'PK', freq: fc, q });
      });
    });

    // Add Shelf candidates (allow low shelf in first 3 filters, high shelf in first 4 filters)
    if (filterIdx < 3) {
      CANDIDATE_LOW_SHELF_FREQS.forEach((fc) => {
        candidateTests.push({ type: 'LS', freq: fc, q: 0.71 });
      });
    }
    if (filterIdx < 4) {
      CANDIDATE_HIGH_SHELF_FREQS.forEach((fc) => {
        candidateTests.push({ type: 'HS', freq: fc, q: 0.71 });
      });
    }

    // Evaluate each candidate
    for (const cand of candidateTests) {
      // Find residual at candidate center frequency
      const resAtFc = getInterpolatedTargetGain(cand.freq, evalFreqs.map((f, i) => ({ freq: f, gain: currentResidual[i] })));

      // Clamp gain to [-12, +12] and snap to 0.5 dB
      let rawGain = Math.max(minGain, Math.min(maxGain, resAtFc));
      let snappedGain = Math.round(rawGain * 2) / 2;

      // Skip candidates with trivial or zero gain
      if (Math.abs(snappedGain) < 0.5) continue;

      // Calculate transfer function response on eval grid
      const filterResponse = evalFreqs.map((f) =>
        calculateFilterGainAtFreq(f, cand.type, cand.freq, snappedGain, cand.q)
      );

      // New residual = currentResidual - filterResponse
      const newResidual = currentResidual.map((r, i) => r - filterResponse[i]);
      const newRms = calculateRmsError(newResidual);
      const rmsReduction = currentRms - newRms;

      // Select candidate with the largest reduction
      if (rmsReduction > bestRmsReduction && rmsReduction > 0.02) {
        bestRmsReduction = rmsReduction;
        bestResidualAfterFilter = newResidual;
        bestFilter = {
          id: `auto-peq-${committedFilters.length + 1}-${Date.now()}`,
          type: cand.type,
          freq: Math.round(cand.freq),
          gain: snappedGain,
          q: cand.q,
          enabled: true,
        };
      }
    }

    // If no candidate meaningfully improved RMS error, stop early
    if (!bestFilter || bestRmsReduction <= 0.02) {
      break;
    }

    // Commit best filter
    committedFilters.push(bestFilter);
    currentResidual = bestResidualAfterFilter;

    // Update cumulative filter gain curve
    evalFreqs.forEach((f, i) => {
      cumulativeFilterGain[i] += calculateFilterGainAtFreq(
        f,
        bestFilter!.type,
        bestFilter!.freq,
        bestFilter!.gain,
        bestFilter!.q
      );
    });
  }

  const finalRms = parseFloat(calculateRmsError(currentResidual).toFixed(2));
  const preamp = calculatePreampHeadroom(committedFilters.map((f) => f.gain));

  // Corrected response = Measured(f) + FilterCascade(f)
  const correctedPoints = evalFreqs.map((f, i) => ({
    freq: f,
    gain: parseFloat((measuredGainOnGrid[i] + cumulativeFilterGain[i]).toFixed(2)),
  }));

  const residualPoints = evalFreqs.map((f, i) => ({
    freq: f,
    gain: parseFloat(currentResidual[i].toFixed(2)),
  }));

  // Match percentage: normalized improvement metric
  const matchPct = initialRms > 0
    ? Math.max(0, Math.min(99.5, ((initialRms - finalRms) / initialRms) * 100 + 40))
    : 100;

  return {
    filters: committedFilters,
    preamp,
    initialRms,
    finalRms,
    matchPercentage: parseFloat(matchPct.toFixed(1)),
    correctedPoints,
    residualPoints,
  };
};
