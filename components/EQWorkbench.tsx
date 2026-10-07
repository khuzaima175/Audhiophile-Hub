import { useDismissSurface } from '../hooks/useDismissSurface';
import { useElementSize } from '../hooks/useElementSize';
import { auditWavelet, compareResponses } from '../utils/conversionAudit';
import { FilterHandles, gainApplies } from './FilterHandles';
import { GearItem } from '../types';
import { effectivePreamp } from '../utils/audioPolicy';
import { audioWorkspace, useAudioWorkspace, useDraftField, draftFromPreset, getMeasurementRecords, storeMeasurement, freshDraft } from '../store/audioWorkspace';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { EQPreset, LabCurve, PEQFilter, PEQFilterType, MeasurementData, SmoothingType } from '../types';
import { labStore } from '../store/labStore';
import {
  ISO_10_BANDS,
  ISO_15_BANDS,
  ISO_31_BANDS,
  TARGET_CURVES,
  CRINACLE_IEF_2025_POINTS,
  CRINGRAPH_FREQ_TICKS,
  getInterpolatedTargetGain,
  TargetCurveDefinition,
} from '../constants/targetCurves';
import {
  DEFAULT_VIEWPORT,
  SYNTHESIS_FREQUENCIES,
  freqToX,
  dbToY,
  xToFreq,
  yToDb,
  calculateAutoRangedYBounds,
  evaluateCompositeCurve,
  generateSvgPathFromPoints,
  ViewportDimensions,
} from '../utils/curveSynthesizer';
import {
  exportToEqualizerAPO,
  exportToWavelet,
  exportToParametricText,
  downloadPresetFile,
  parseImportedEQText,
  calculatePreampHeadroom,
} from '../utils/importExportParser';
import {
  parseMeasurementFile,
  smoothLogCurve,
  resampleToSynthesisFrequencies,
} from '../utils/measurementParser';
import { synthesizeAutoPeq } from '../utils/autoPeqGenerator';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { graphicFilters, safePreamp } from '../utils/biquad';
import { useLiveTabCapture, isTabAudioSupported } from '../hooks/useLiveTabCapture';
import { syncApoProfileToServer, getStoredApoEnabled } from '../services/apoBridgeClient';
import { PlusIcon, TrashIcon, CopyIcon, CheckIcon, EqIcon, WaveformIcon, ActivityIcon } from './Icon';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import { v4 as uuidv4 } from 'uuid';

interface EQWorkbenchProps {
  presets: EQPreset[];
  gear?: GearItem[];
  onSavePresets: (presets: EQPreset[]) => void;
  className?: string;
  embeddedInLab?: boolean;
  onCompare?: () => void;
}

export const EQWorkbench: React.FC<EQWorkbenchProps> = ({ presets = [], gear = [], onSavePresets, className = '', embeddedInLab = false, onCompare }) => {
  const { draft, error: draftError, undoCount, redoCount } = useAudioWorkspace();
  const [workbenchState, setWorkbenchState] = useDraftField('workbenchState');
  const [editingPresetId, setEditingPresetId] = useDraftField('editingPresetId');
  const [eqMode, setEqMode] = useDraftField('eqMode');
  const [selectedTargetId, setSelectedTargetId] = useDraftField('selectedTargetId');
  const [smoothing, setSmoothing] = useDraftField('smoothing');
  const [maxAutoFilters, setMaxAutoFilters] = useDraftField('maxAutoFilters');
  const [presetName, setPresetName] = useDraftField('presetName');
  const [hardwareAssigned, setHardwareAssigned] = useDraftField('hardwareAssigned');
  const [gains10, setGains10] = useDraftField('gains10');
  const [gains15, setGains15] = useDraftField('gains15');
  const [gains31, setGains31] = useDraftField('gains31');
  const [peqFilters, setPeqFilters] = useDraftField('peqFilters');
  const [measurement, setMeasurement] = useState<MeasurementData | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  useEffect(() => {
    let active = true;
    setMeasurement(null);
    if (draft.measurementRef) getMeasurementRecords().then(records => {
      const record = records.find(r => r.id === draft.measurementRef);
      if (active) { if (record) setMeasurement(record.value); else setImportError('Linked measurement is missing. Restore a complete backup or clear the source to continue with manual EQ.'); }
    }).catch(() => { if (active) setImportError('Measurement storage unavailable. Restore a backup or try again.'); });
    return () => { active = false; };
  }, [draft.measurementRef]);
  const replaceAllowed = () => !audioWorkspace.getSnapshot().draft.dirty || window.confirm('Replace unfinished Audio work? Cancel keeps your draft.');
  // Import State
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // UI Toast & Copy Status
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [conversionReport, setConversionReport] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Hover Crosshair on Curve
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    freq: number;
    measuredDb?: number;
    targetDb?: number;
    correctedDb?: number;
    db: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const plot = useElementSize();
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const measurementFileInputRef = useRef<HTMLInputElement>(null);

  // A/B Bypass Latch
  const [isBypassed, setIsBypassed] = useState(false);

  // Active Bands & Gains based on current mode
  const currentIsoBands = useMemo(() => {
    if (eqMode === '31-band') return ISO_31_BANDS;
    if (eqMode === '15-band') return ISO_15_BANDS;
    return ISO_10_BANDS;
  }, [eqMode]);

  const currentIsoGains = useMemo(() => {
    if (eqMode === '31-band') return gains31;
    if (eqMode === '15-band') return gains15;
    return gains10;
  }, [eqMode, gains10, gains15, gains31]);

  const [levelMatched, setLevelMatched] = useState(false);
  // Web Audio Preview Engine
  const {
    error: audioError,
    sampleRate: playbackRate,
    matchDb,
    isPlaying,
    activeSource,
    fileName,
    volume,
    setVolume,
    playPinkNoise,
    playSineSweep,
    playLiveTab,
    handleFileUpload,
    toggleFilePlayback,
    stopAudio,
    getAudioContext,
    audioContext,
  } = useAudioEngine({
    isoBands: eqMode === 'peq' ? [] : currentIsoBands,
    isoGains: eqMode === 'peq' ? [] : currentIsoGains,
    peqFilters: eqMode === 'peq' ? peqFilters : [],
    isBypassed,
    requestedPreamp: draft.requestedPreamp,
    preampMode: draft.preampMode,
    intendedSampleRate: draft.sampleRate,
    levelMatched,
  });
  useEffect(() => { if (audioContext && draft.sampleRate !== playbackRate) audioWorkspace.update({ sampleRate: playbackRate }, false); }, [audioContext, playbackRate]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Live Tab Capture Hook
  const {
    isCapturing,
    showFeedbackGuard,
    error: tabError,
    telemetry: tabTelemetry,
    startTabCapture,
    stopTabCapture,
    confirmFeedbackGuard,
    dismissFeedbackGuard,
    isSupported: tabSupported,
  } = useLiveTabCapture({
    audioContext,
    getAudioContext,
    onStreamAvailable: (streamNode) => {
      playLiveTab(streamNode);
      showToast('Browser audio connected');
    },
    onStreamEnded: () => {
      stopAudio();
      showToast('Capture ended. Clean disconnect.');
    },
  });

  useDismissSurface(showFeedbackGuard, dismissFeedbackGuard, 50);

  // Selected Target Curve
  const currentTarget = useMemo(() => {
    const target = TARGET_CURVES.find((t) => t.id === selectedTargetId) || TARGET_CURVES[0];
    const datum = getInterpolatedTargetGain(1000, target.points);
    return { ...target, points: draft.normalize ? target.points.map((p) => ({ ...p, gain: p.gain - datum })) : target.points };
  }, [selectedTargetId, draft.normalize]);

  // Update measurement smoothing reactively
  const activeSmoothedPoints = useMemo(() => {
    if (!measurement) return [];
    if (draft.normalize && (measurement.rawPoints[0].freq > 1000 || measurement.rawPoints.at(-1)!.freq < 1000)) return [];
    return smoothLogCurve(measurement.rawPoints.map(p => ({ ...p, gain: draft.normalize ? p.gain : p.rawSpl })), smoothing);
  }, [measurement, smoothing, draft.normalize]);

  // Resampled measured points on 180-frequency grid
  const resampledMeasuredPoints = useMemo(() => {
    if (!activeSmoothedPoints || activeSmoothedPoints.length === 0) return [];
    return resampleToSynthesisFrequencies(activeSmoothedPoints);
  }, [activeSmoothedPoints]);

  const fitEvaluation = useMemo(() => {
    if (measurement && draft.normalize && (measurement.rawPoints[0].freq > 1000 || measurement.rawPoints.at(-1)!.freq < 1000)) return { result: null, error: 'Normalization at 1 kHz requires source support at 1 kHz. Import wider data or disable normalization.' };
    if (!activeSmoothedPoints.length || selectedTargetId === 'none') return { result: null, error: '' };
    try { return { result: synthesizeAutoPeq(activeSmoothedPoints, currentTarget.points, { maxFilters: maxAutoFilters, targetCurveId: selectedTargetId, smoothing, normalize: draft.normalize, sampleRate: draft.sampleRate }), error: '' }; }
    catch (e) { return { result: null, error: (e as Error).message }; }
  }, [measurement, activeSmoothedPoints, currentTarget, selectedTargetId, maxAutoFilters, smoothing, draft.normalize, draft.sampleRate]);
  const autoPeqResult = fitEvaluation.result;
  // View Mode: 'iem' (Compare IEM vs Target) | 'filter' (Raw EQ Cuts/Boosts) | 'compensated' (Post-EQ Net)
  const [eqViewMode, setEqViewMode] = useDraftField('graphView');

  // Calculate live composite curve points for pure EQ filter preview
  const compositeCurvePoints = useMemo(() => {
    return evaluateCompositeCurve(
      SYNTHESIS_FREQUENCIES.filter(f => f < draft.sampleRate / 2),
      eqMode === 'peq' ? [] : currentIsoBands,
      eqMode === 'peq' ? [] : currentIsoGains,
      eqMode === 'peq' ? peqFilters : [],
      draft.sampleRate,
    );
  }, [currentIsoBands, currentIsoGains, peqFilters, eqMode, draft.sampleRate]);

  // Reconstructed Estimated IEM Acoustic Curve: IEM = Target - EQ_Filter (since AutoEQ Filter = Target - IEM)
  // This allows direct positive visual comparison between the IEM's natural frequency response and the Target curve!
  const estimatedIemPoints = useMemo(() => {
    return compositeCurvePoints.map((p) => {
      const targetDb =
        currentTarget && selectedTargetId !== 'none'
          ? getInterpolatedTargetGain(p.freq, currentTarget.points)
          : 0;
      // If EQ cut is -4.9dB against a +6.5dB target, IEM has +11.4dB natural bass!
      const iemDb = targetDb - p.gain;
      return { freq: p.freq, gain: parseFloat(iemDb.toFixed(2)) };
    });
  }, [compositeCurvePoints, currentTarget, selectedTargetId]);

  // Post-EQ Compensated Response = Target + Filter
  const compensatedResponsePoints = useMemo(() => {
    return compositeCurvePoints.filter(p => resampledMeasuredPoints.length && p.freq >= resampledMeasuredPoints[0].freq && p.freq <= resampledMeasuredPoints.at(-1)!.freq).map((p) => {
      const measured = resampledMeasuredPoints.length
        ? getInterpolatedTargetGain(p.freq, resampledMeasuredPoints)
        : 0;
      return { freq: p.freq, gain: measured + p.gain + (draft.responseLevel === 'absolute' ? effectivePreamp(eqMode === 'peq' ? peqFilters : graphicFilters(currentIsoBands, currentIsoGains), draft.preampMode, draft.requestedPreamp, draft.sampleRate) : 0) };
    });
  }, [compositeCurvePoints, resampledMeasuredPoints, draft.preampMode, draft.requestedPreamp, draft.sampleRate, draft.responseLevel, peqFilters, currentIsoBands, currentIsoGains, eqMode]);

  // Active displayed EQ curve based on selected view mode
  const activeEqPoints = useMemo(() => {
    if (eqViewMode === 'iem') return estimatedIemPoints;
    if (eqViewMode === 'compensated') return compensatedResponsePoints;
    return compositeCurvePoints;
  }, [eqViewMode, estimatedIemPoints, compensatedResponsePoints, compositeCurvePoints]);

  const [frozenRange, setFrozenRange] = useState<{ minY: number; maxY: number; yTicks: number[] } | null>(null);
  // AUTO-RANGE Y-AXIS (Accommodates Harman, measured deep bass, and corrected curves)
  const { minY, maxY, yTicks } = useMemo(() => {
    if (frozenRange) return frozenRange;
    const targetPoints = selectedTargetId !== 'none' && currentTarget ? currentTarget.points : [];
    const curveList = [activeEqPoints, targetPoints];
    if (resampledMeasuredPoints.length > 0) {
      curveList.push(resampledMeasuredPoints.map((p) => ({ freq: p.freq, gain: p.gain })));
    }
    if (compensatedResponsePoints.length) curveList.push(compensatedResponsePoints);
    return calculateAutoRangedYBounds(curveList, selectedTargetId !== 'none');
  }, [activeEqPoints, currentTarget, selectedTargetId, resampledMeasuredPoints, compensatedResponsePoints, frozenRange]);

  const workbenchViewport: ViewportDimensions = useMemo(
    () => ({
      ...DEFAULT_VIEWPORT,
      width: embeddedInLab ? Math.max(260, plot.size.width || 960) : DEFAULT_VIEWPORT.width,
      height: embeddedInLab ? Math.max(280, plot.size.height || 440) : 290,
      padding: { top: 25, right: 25, bottom: 35, left: 52 },
      minY,
      maxY,
    }),
    [minY, maxY, embeddedInLab, plot.size.width, plot.size.height],
  );

  // Generate SVG path for active curve
  const compositeSvgPath = useMemo(() => {
    return generateSvgPathFromPoints(activeEqPoints, workbenchViewport, minY, maxY);
  }, [activeEqPoints, workbenchViewport, minY, maxY]);

  // Target Curve SVG Path
  const targetSvgPath = useMemo(() => {
    if (!currentTarget || selectedTargetId === 'none') return '';
    return generateSvgPathFromPoints(currentTarget.points, workbenchViewport, minY, maxY);
  }, [currentTarget, selectedTargetId, workbenchViewport, minY, maxY]);

  // Measured Response SVG Path (Solid Cream)
  const measuredSvgPath = useMemo(() => {
    if (!resampledMeasuredPoints || resampledMeasuredPoints.length === 0) return '';
    const pts = resampledMeasuredPoints.map((p) => ({ freq: p.freq, gain: p.gain }));
    return generateSvgPathFromPoints(pts, workbenchViewport, minY, maxY);
  }, [resampledMeasuredPoints, workbenchViewport, minY, maxY]);

  // Corrected Response SVG Path (Phosphor Teal)
  const correctedSvgPath = useMemo(() => {
    if (!measurement) return '';
    return generateSvgPathFromPoints(compensatedResponsePoints, workbenchViewport, minY, maxY);
  }, [measurement, compensatedResponsePoints, workbenchViewport, minY, maxY]);

  // One response-based attenuation policy for graph, playback, preset and export.
  const currentPreamp = useMemo(() => effectivePreamp(eqMode === 'peq' ? peqFilters : graphicFilters(currentIsoBands, currentIsoGains), draft.preampMode, draft.requestedPreamp, draft.sampleRate), [eqMode, peqFilters, currentIsoBands, currentIsoGains, draft.preampMode, draft.requestedPreamp, draft.sampleRate]);
  // Measurement File Drop & Parse Handler
  const handleProcessMeasurementText = useCallback(
    async (text: string, name: string) => {
      if (!replaceAllowed()) return;
      const parsed = parseMeasurementFile(text, name, smoothing, 1000);
      if (!parsed) {
        showToast('Error: Could not parse measurement file. Check CSV/TSV format.');
        return;
      }
      if (parsed.isGraphicEQ) {
        try {
        const fit = synthesizeAutoPeq(
          parsed.rawPoints.map((p) => ({ freq: p.freq, gain: 0 })),
          parsed.rawPoints,
          { maxFilters: 20, targetCurveId: 'imported-correction', normalize: false, sampleRate: draft.sampleRate },
        );
        audioWorkspace.update({ measurementRef: null, originalFit: null });
        setMeasurement(null);
        setEqMode('peq');
        audioWorkspace.update({ requestedPreamp: fit.preamp, preampMode: 'manual' });
        setPeqFilters(fit.filters);
        setPresetName(parsed.name + ' imported EQ');
        setWorkbenchState('ADDING');
        const error = compareResponses(parsed.rawPoints, evaluateCompositeCurve(SYNTHESIS_FREQUENCIES, [], [], fit.filters, draft.sampleRate).map(p => ({ ...p, gain: p.gain + fit.preamp })));
        setConversionReport(`GraphicEQ to PEQ: ${error.rms.toFixed(2)} dB RMS / ${error.max.toFixed(2)} dB max including preamp. ${error.withinTolerance ? 'Within approximation tolerance.' : 'Exceeds approximation tolerance; retain the original GraphicEQ for fidelity.'}`);
        showToast(`Imported correction as PEQ. Approximation residual: ${fit.finalRms} dB RMS.`);
        } catch (e) { setImportError((e as Error).message); }
        return;
      }
      try { const ref = await storeMeasurement(parsed); audioWorkspace.update({ measurementRef: ref }); }
      catch { setImportError('Measurement could not be saved. Existing draft preserved. Retry or export a backup.'); return; }
      setMeasurement(parsed);
      setPresetName(parsed.name ? `${parsed.name} Auto-EQ` : 'Auto-PEQ Target');
      setHardwareAssigned(parsed.name || 'Custom IEM');
      setWorkbenchState('MEASUREMENT');
      showToast(`Loaded ${parsed.sampleCount} measurement points (Norm 1kHz)`);
    },
    [smoothing, showToast],
  );

  const handleMeasurementFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        handleProcessMeasurementText(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  // Load Auto-PEQ Filters into the editable PEQ Editor
  const handleLoadAutoPeqIntoEditor = () => {
    if (!autoPeqResult) return;
    audioWorkspace.update({ originalFit: structuredClone(autoPeqResult), requestedPreamp: autoPeqResult.preamp });
    setPeqFilters(autoPeqResult.filters);
    setEqMode('peq');
    setWorkbenchState('ADDING');
    showToast(`Loaded ${autoPeqResult.filters.length} Auto-PEQ filters into editor`);
  };

  // Reset band to 0dB on double click
  const handleResetBand = (index: number) => {
    if (eqMode === '31-band') {
      const next = [...gains31];
      next[index] = 0;
      setGains31(next);
    } else if (eqMode === '15-band') {
      const next = [...gains15];
      next[index] = 0;
      setGains15(next);
    } else {
      const next = [...gains10];
      next[index] = 0;
      setGains10(next);
    }
  };

  // Update slider gain
  const handleSliderChange = (index: number, val: number) => {
    if (eqMode === '31-band') {
      const next = [...gains31];
      next[index] = val;
      setGains31(next);
    } else if (eqMode === '15-band') {
      const next = [...gains15];
      next[index] = val;
      setGains15(next);
    } else {
      const next = [...gains10];
      next[index] = val;
      setGains10(next);
    }
  };

  // Add a new Parametric filter row
  const handleAddPeqFilter = () => {
    const newFilter: PEQFilter = {
      id: `f-${Date.now()}`,
      type: 'PK',
      freq: 2400,
      gain: 0,
      q: 1.41,
      enabled: true,
    };
    setPeqFilters((prev) => [...prev, newFilter]);
  };

  // Delete a Parametric filter row
  const handleDeletePeqFilter = (id: string) => {
    setPeqFilters((prev) => prev.filter((f) => f.id !== id));
  };

  // Update a Parametric filter row
  const handleUpdatePeqFilter = (id: string, updates: Partial<PEQFilter>) => {
    setPeqFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // Save current EQ preset (with silent Equalizer APO bridge hot push if enabled)
  const handleSaveProfile = async (copy = false) => {
    if (!presetName.trim()) return;

    let bandsString = '';
    if (eqMode === 'peq') {
      bandsString = exportToEqualizerAPO(peqFilters, [], [], currentPreamp, draft.sampleRate);
    } else {
      bandsString = exportToEqualizerAPO([], currentIsoBands, currentIsoGains, currentPreamp, draft.sampleRate);
    }

    const preset: EQPreset = {
      id: (!copy && editingPresetId) || uuidv4(),
      name: presetName.trim(),
      hardware: hardwareAssigned.trim() || 'All Hardware',
      type: eqMode === 'peq' ? 'Parametric' : 'Wavelet',
      mode: eqMode,
      bands: bandsString,
      graphicGains: eqMode !== 'peq' ? [...currentIsoGains] : undefined,
      peqFilters: eqMode === 'peq' ? [...peqFilters] : undefined,
      targetCurveId: selectedTargetId,
      preamp: currentPreamp,
      gearId: draft.gearId || undefined,
      measurementRef: draft.measurementRef || undefined,
      requestedPreamp: draft.requestedPreamp,
      preampMode: draft.preampMode,
      sampleRate: draft.sampleRate,
      analysis: { smoothing, normalize: draft.normalize },
      timestamp: Date.now(),
    };

    let updatedPresets: EQPreset[];
    if (editingPresetId && !copy) {
      updatedPresets = presets.map((p) => (p.id === editingPresetId ? preset : p));
    } else {
      updatedPresets = [preset, ...presets];
    }

    try { onSavePresets(updatedPresets); } catch { setImportError('Preset save failed. Your editable draft is preserved. Retry or export a backup.'); return; }

    // Silent hot-push to Equalizer APO if bridge is enabled
    if (getStoredApoEnabled()) {
      const apoExport = exportToEqualizerAPO(
        preset.peqFilters || (eqMode === 'peq' ? peqFilters : []),
        eqMode === 'peq' ? [] : currentIsoBands,
        eqMode === 'peq' ? [] : preset.graphicGains || currentIsoGains,
        preset.preamp ?? currentPreamp,
        draft.sampleRate,
      );
      try {
        const syncRes = await syncApoProfileToServer(apoExport);
        if (syncRes.success) {
          showToast(`Saved & Hot-Synced to Equalizer APO`);
        } else {
          showToast(`Saved preset. (APO Bridge: ${syncRes.error || 'skipped'})`);
        }
      } catch (e) {
        showToast(`Saved "${preset.name}" to EQ Library`);
      }
    } else {
      showToast(`Saved "${preset.name}" to EQ Library`);
    }

    audioWorkspace.update({ editingPresetId: preset.id, dirty: false }, false);
  };

  // Load preset into workbench for editing / audition
  const handleLoadPreset = (preset: EQPreset) => {
    if (!replaceAllowed()) return;
    try { audioWorkspace.replace(draftFromPreset(preset)); }
    catch (e) { setImportError((e as Error).message); }
  };

  // Delete preset
  const handleDeletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    onSavePresets(updated);
    if (editingPresetId === id) {
      setEditingPresetId(null);
      setWorkbenchState('IDLE');
    }
    showToast('Deleted preset');
  };

  // Import text parser
  const handleExecuteImport = () => {
    if (!importText.trim() || !replaceAllowed()) return;
    const result = parseImportedEQText(importText);
    if (!result) {
      setImportError('Could not recognize format. Import EQ text, Equalizer APO, or GraphicEQ string.');
      return;
    }

    setImportError(null);
    if (result.graphicPoints) {
      try {
      const fit = synthesizeAutoPeq(
        result.graphicPoints.map((p) => ({ freq: p.freq, gain: 0 })),
        result.graphicPoints,
        { maxFilters: 20, targetCurveId: 'imported-correction', normalize: false, sampleRate: draft.sampleRate },
      );
      audioWorkspace.update({ measurementRef: null, originalFit: null, requestedPreamp: Math.min(result.preamp, fit.preamp), preampMode: 'manual' });
      setEqMode('peq');
      setPeqFilters(fit.filters);
      setMeasurement(null);
      setPresetName('Imported GraphicEQ');
      setWorkbenchState('ADDING');
      const error = compareResponses(result.graphicPoints.map(p => ({ ...p, gain: p.gain + result.preamp })), evaluateCompositeCurve(SYNTHESIS_FREQUENCIES, [], [], fit.filters, draft.sampleRate).map(p => ({ ...p, gain: p.gain + Math.min(result.preamp, fit.preamp) })));
      setConversionReport(`GraphicEQ to PEQ: ${error.rms.toFixed(2)} dB RMS / ${error.max.toFixed(2)} dB max including preamp. ${error.withinTolerance ? 'Within approximation tolerance.' : 'Exceeds approximation tolerance; keep the original data.'}`);
      showToast(`GraphicEQ converted to PEQ. Approximation residual: ${fit.finalRms} dB RMS.`);
      } catch (e) { setImportError((e as Error).message); }
      return;
    }
    audioWorkspace.update({ requestedPreamp: result.preamp ?? 0, preampMode: 'manual', measurementRef: null });
    setEqMode(result.mode);

    if (result.mode === 'peq' && result.peqFilters) {
      setPeqFilters(result.peqFilters);
    } else if (result.graphicGains) {
      if (result.mode === '31-band') setGains31(result.graphicGains);
      else if (result.mode === '15-band') setGains15(result.graphicGains);
      else setGains10(result.graphicGains);
    }

    if (!presetName) {
      setPresetName('Imported AutoEQ Preset');
    }

    setWorkbenchState('ADDING');
    showToast(`Successfully parsed ${result.mode.toUpperCase()} preset`);
  };

  // Copy handlers
  const handleCopyAPO = (p?: EQPreset) => {
    const filters = p?.peqFilters || (eqMode === 'peq' ? peqFilters : []);
    const bands = p?.graphicGains
      ? p.graphicGains.length === 31
        ? ISO_31_BANDS
        : p.graphicGains.length === 15
          ? ISO_15_BANDS
          : ISO_10_BANDS
      : currentIsoBands;
    const gains = p?.graphicGains || currentIsoGains;
    const parametric = p ? p.mode === 'peq' || p.type === 'Parametric' : eqMode === 'peq';
    const str = exportToEqualizerAPO(filters, parametric ? [] : bands, parametric ? [] : gains, p?.preamp ?? currentPreamp, p?.sampleRate || draft.sampleRate);

    navigator.clipboard.writeText(str).then(() => {
      setCopiedKey(p?.id ? `apo-${p.id}` : 'apo-curr');
      setTimeout(() => setCopiedKey(null), 2000);
      showToast('Copied Equalizer APO string (Preamp protected)');
    });
  };

  const handleCopyWavelet = (p?: EQPreset) => {
    const filters = p ? p.peqFilters || [] : eqMode === 'peq' ? peqFilters : [];
    const bands = p?.graphicGains?.length === 31 ? ISO_31_BANDS : p?.graphicGains?.length === 15 ? ISO_15_BANDS : currentIsoBands;
    const parametric = p ? p.mode === 'peq' || p.type === 'Parametric' : eqMode === 'peq';
    const { text: str, error } = auditWavelet(filters, parametric ? [] : bands, parametric ? [] : p?.graphicGains || currentIsoGains, p?.preamp ?? currentPreamp, p?.sampleRate || draft.sampleRate);
    setConversionReport(`Wavelet conversion: ${error.rms.toFixed(3)} dB RMS, ${error.max.toFixed(3)} dB maximum across ${error.points} points including preamp. ${error.withinTolerance ? 'Within sampling tolerance (1 dB RMS / 3 dB maximum).' : 'Approximation exceeds tolerance or contains a deep notch; review in the destination player.'}`);

    navigator.clipboard
      .writeText(str)
      .then(() => {
        setCopiedKey(p?.id ? `wav-${p.id}` : 'wav-curr');
        setTimeout(() => setCopiedKey(null), 2000);
        showToast('Copied Wavelet GraphicEQ string');
      })
      .catch(() => showToast('Could not copy. Use Download .txt instead.'));
  };

  const handleDownloadTxt = (p?: EQPreset) => {
    const name = (p?.name || presetName || 'AudioSage_EQ').replace(/\s+/g, '_');
    const parametric = p ? p.mode === 'peq' || p.type === 'Parametric' : eqMode === 'peq';
    const str = exportToEqualizerAPO(
      p?.peqFilters || (eqMode === 'peq' ? peqFilters : []),
      parametric ? [] : p?.graphicGains
        ? p.graphicGains.length === 31
          ? ISO_31_BANDS
          : p.graphicGains.length === 15
            ? ISO_15_BANDS
            : ISO_10_BANDS
        : currentIsoBands,
      parametric ? [] : p?.graphicGains || currentIsoGains,
      p?.preamp ?? currentPreamp,
      p?.sampleRate || draft.sampleRate,
    );
    downloadPresetFile(`${name}_EqualizerAPO.txt`, str);
    showToast(`Downloaded ${name}_EqualizerAPO.txt`);
  };

  // Crosshair move over SVG with multi-curve readout
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = workbenchViewport.width / rect.width;
    const scaleY = workbenchViewport.height / rect.height;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * scaleY;

    if (
      clientX >= workbenchViewport.padding.left &&
      clientX <= workbenchViewport.width - workbenchViewport.padding.right &&
      clientY >= workbenchViewport.padding.top &&
      clientY <= workbenchViewport.height - workbenchViewport.padding.bottom
    ) {
      const freq = xToFreq(clientX, workbenchViewport);
      const measuredDb =
        resampledMeasuredPoints.length > 0
          ? getInterpolatedTargetGain(
              freq,
              resampledMeasuredPoints.map((p) => ({ freq: p.freq, gain: p.gain })),
            )
          : undefined;
      const targetDb =
        currentTarget && selectedTargetId !== 'none'
          ? getInterpolatedTargetGain(freq, currentTarget.points)
          : undefined;
      const correctedDb = compensatedResponsePoints.length && measurement
        ? getInterpolatedTargetGain(freq, compensatedResponsePoints)
        : undefined;
      const eqDb = getInterpolatedTargetGain(freq, compositeCurvePoints);

      const displayDb =
        getInterpolatedTargetGain(freq, activeEqPoints);
      const curveY = dbToY(displayDb, workbenchViewport, minY, maxY);

      setHoveredPoint({
        x: clientX,
        y: curveY,
        freq,
        measuredDb: measuredDb !== undefined ? parseFloat(measuredDb.toFixed(1)) : undefined,
        targetDb: targetDb !== undefined ? parseFloat(targetDb.toFixed(1)) : undefined,
        correctedDb: correctedDb !== undefined ? parseFloat(correctedDb.toFixed(1)) : undefined,
        db: parseFloat(displayDb.toFixed(1)),
      });
    } else {
      setHoveredPoint(null);
    }
  };

  const openCompare = () => {
    const curves: LabCurve[] = [];
    if (measurement) curves.push({ id: draft.measurementRef!, name: measurement.name, color: '#f0b47c', points: measurement.rawPoints, provenance: 'measured', provenanceDetails: `Imported source; ${measurement.rawPoints.length} points; raw SPL available in linked measurement`, offset: 0, visible: true, solo: false });
    curves.push({ id: 'audio-draft-correction', name: `${presetName || 'Audio draft'} correction`, color: '#79aaff', points: compositeCurvePoints, provenance: 'eq-compensated', provenanceDetails: `Current editable correction shape; ${draft.sampleRate} Hz; effective preamp ${currentPreamp} dB`, isFilterCurve: true, sourceTargetId: selectedTargetId === 'none' ? undefined : selectedTargetId, offset: 0, visible: true, solo: false });
    if (measurement && compensatedResponsePoints.length >= 2) curves.push({ id: 'audio-draft-posteq', name: `${presetName || 'Audio draft'} current post-EQ`, color: '#d28ef0', points: compensatedResponsePoints, provenance: 'eq-compensated', provenanceDetails: `Measured source plus current correction; ${draft.responseLevel === 'absolute' ? 'includes effective attenuation' : 'shape excludes preamp'}; ${draft.sampleRate} Hz`, preserveAbsolute: true, offset: 0, visible: true, solo: false });
    labStore.setTargetCurveId(selectedTargetId);
    labStore.setViewMode('rawFilter');
    labStore.openLab(curves, selectedTargetId);
    onCompare?.();
  };

  const inputClass =
    'w-full bg-audio-surface border border-audio-border rounded-xl px-4 py-2.5 text-audio-text focus:outline-none focus:border-audio-accent/70 text-xs font-sans';
  const labelClass = 'text-[10px] font-bold text-audio-accent uppercase tracking-widest font-mono pl-1';

  const presetIdentity = (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="preset-name">
                Preset name *
              </label>
              <input
                type="text"
                placeholder="e.g. Simgot EW300 Holographic Chill"
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className={inputClass}
                autoFocus={!embeddedInLab}
              />
            </div>
            <div>
              <label className={labelClass}>Assigned gear</label>
              <select aria-label="Assigned gear" value={draft.gearId || ''} onChange={e => { const g = gear.find(g => g.id === e.target.value); audioWorkspace.update({ gearId: g?.id || null, hardwareAssigned: g?.name || hardwareAssigned }); }} className={inputClass}><option value="">Unlinked / custom hardware</option>{gear.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <label className={labelClass}>Hardware name</label>
              <input
                type="text"
                placeholder="e.g. Simgot EW300, CCA Phoenix..."
                value={hardwareAssigned}
                onChange={(e) => setHardwareAssigned(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
  );
  const presetActions = (
          <div className="eq-save-actions flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-audio-border/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyAPO()}
                className="px-2.5 py-1.5 rounded-lg border border-audio-border text-[11px] font-mono text-audio-muted hover:text-audio-text hover:bg-audio-surface"
              >
                {copiedKey === 'apo-curr' ? '✓ Copied APO' : 'Copy APO'}
              </button>
              <button
                type="button"
                onClick={() => handleCopyWavelet()}
                className="px-2.5 py-1.5 rounded-lg border border-audio-border text-[11px] font-mono text-audio-muted hover:text-audio-text hover:bg-audio-surface"
              >
                {copiedKey === 'wav-curr' ? '✓ Copied Wavelet' : 'Copy Wavelet'}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTxt()}
                className="px-2.5 py-1.5 rounded-lg border border-audio-border text-[11px] font-mono text-audio-muted hover:text-audio-text hover:bg-audio-surface"
              >
                Download .txt
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button className="secondary-button" disabled={!presetName.trim()} onClick={() => void handleSaveProfile(true)}>Save as copy</button>
              <button
                type="button"
                onClick={() => {
                  setWorkbenchState('IDLE');
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-audio-muted hover:text-audio-text"
              >
                Keep draft
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={!presetName.trim()}
                className="px-4 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
  );
  const policyControls = (
      <div className="audio-policy-controls">
        <label><input type="checkbox" checked={draft.normalize} onChange={e => audioWorkspace.update({ normalize: e.target.checked })} />Normalize source and target at 1 kHz for fitting / shape display</label>
        <label>Post-EQ response level<select value={draft.responseLevel} onChange={e => audioWorkspace.update({ responseLevel: e.target.value as 'absolute' | 'shape' })}><option value="absolute">Includes effective attenuation</option><option value="shape">Response shape (excludes preamp)</option></select></label>
        <label>Preamp mode<select value={draft.preampMode} onChange={e => audioWorkspace.update({ preampMode: e.target.value as 'automatic' | 'manual' })}><option value="automatic">Automatic headroom</option><option value="manual">Manual preamp</option></select></label>
        <label>Requested preamp (dB)<input aria-label="Requested preamp" type="number" min="-36" max="36" step="0.1" value={draft.requestedPreamp} onChange={e => audioWorkspace.update({ requestedPreamp: Math.max(-36, Math.min(36, Number(e.target.value) || 0)) })} /></label>
        <label>Intended rate<select disabled={!!audioContext} value={draft.sampleRate} onChange={e => audioWorkspace.update({ sampleRate: Number(e.target.value) })}>{[44100,48000,96000].map(rate => <option key={rate} value={rate}>{rate / 1000} kHz</option>)}</select></label>
        <p>Effective attenuation: {currentPreamp.toFixed(2)} dB. {draft.preampMode === 'manual' && currentPreamp < draft.requestedPreamp ? 'Adjusted to leave response-based headroom.' : ''} This is response-based attenuation, not a true-peak limiter.</p>
        <label><input type="checkbox" checked={levelMatched} onChange={e => setLevelMatched(e.target.checked)} />Level-matched file comparison (first 10 seconds, all-channel RMS, dry attenuation capped at 24 dB)</label>
        {levelMatched && <p>{matchDb === null ? 'Matching unavailable or recalculating. Bypass currently uses raw audio.' : `Bypass matching attenuation: ${matchDb.toFixed(2)} dB. ${matchDb === -24 ? 'Attenuation limit reached; the bypass may remain louder.' : ''}`}</p>}
        <p>APO parameter exports preserve supported filters and effective preamp. Wavelet response sampling and Wavelet-to-PEQ fitting are approximations; deep notches and narrow filters may lose detail.</p>
      </div>
  );
  const graphEditor = (<>
      <div className="audio-view-tabs">
        <button className="secondary-button" onClick={() => { if (eqMode !== 'peq' && draft.dirty && !window.confirm('Add a parametric band and switch from graphic mode? Graphic settings will be kept.')) return; setEqMode('peq'); handleAddPeqFilter(); }}>Add band</button>
        <button className="secondary-button" onClick={() => { audioWorkspace.update({ gains10: Array(10).fill(0), gains15: Array(15).fill(0), gains31: Array(31).fill(0), peqFilters: peqFilters.map(f => ({ ...f, gain: 0 })) }); }}>Reset gains</button>
        <button className="secondary-button" onClick={() => setIsBypassed(!isBypassed)}>{isBypassed ? 'Enable EQ' : 'Raw bypass'}</button>
      </div>
      <div className="eq-graph-layout">
      <details className="selected-band-sheet" open={!!draft.selectedBand}>
        <summary>Selected band</summary>
        {eqMode === 'peq' ? (() => { const f = peqFilters.find(f => f.id === draft.selectedBand); return f ? <div className="audio-policy-controls">
          <label>Frequency (Hz)<input aria-label="Selected frequency" type="number" min="20" max="20000" value={f.freq} onChange={e => handleUpdatePeqFilter(f.id, { freq: Math.max(20,Math.min(20000,Number(e.target.value) || 20)) })} /></label>
          {gainApplies(f.type) && <label>Gain (dB)<input aria-label="Selected gain" type="number" min="-18" max="18" step="0.5" value={f.gain} onChange={e => handleUpdatePeqFilter(f.id, { gain: Math.max(-18,Math.min(18,Number(e.target.value) || 0)) })} /></label>}
          <label>Q<input aria-label="Selected Q" type="number" min="0.1" max="20" step="0.1" value={f.q} onChange={e => handleUpdatePeqFilter(f.id, { q: Math.max(.1,Math.min(20,Number(e.target.value) || 1)) })} /></label>
          <label><input type="checkbox" checked={f.enabled !== false} onChange={e => handleUpdatePeqFilter(f.id, { enabled: e.target.checked })} />Enabled</label>
        </div> : <p>Select a numbered graph handle.</p>; })() : <p>Graphic bands have fixed frequencies. Drag vertically or use Up/Down keys.</p>}
      </details>
      {/* 4. LIVE SVG CURVE VISUALIZER (Measured Cream, Target Dashed, Corrected Phosphor Teal) */}
      <details className="section-disclosure space-y-3" open={workbenchState !== 'IDLE' || !!measurement}>
        <summary>Frequency response preview</summary>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Engraved size="xs" glow>
              Frequency response preview
            </Engraved>
            {currentPreamp < 0 && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-audio-surface border border-audio-signal/30 text-audio-signal">
                HEADROOM: {currentPreamp} dB
              </span>
            )}
          </div>

          {/* View Mode Toggle & Target Reference Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="eq-controls">
              <label className="control-field">
                Graph view
                <select
                  value={eqViewMode}
                  onChange={(e) => setEqViewMode(e.target.value as 'iem' | 'filter' | 'compensated')}
                >
                  <option value="iem" disabled={selectedTargetId === 'none'}>Inferred from target & EQ</option>
                  <option value="filter">EQ correction</option>
                  <option value="compensated" disabled={!measurement}>
                    Measured response + EQ
                  </option>
                </select>
              </label>
              <label className="control-field">
                Reference target
                <select value={selectedTargetId} onChange={(e) => setSelectedTargetId(e.target.value)}>
                  {TARGET_CURVES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName}
                    </option>
                  ))}
                  <option value="none">No target</option>
                </select>
              </label>
            </div>
            {/* Open in Lab Button */}
            <button
              type="button"
              onClick={openCompare}
              className="px-2.5 py-1 rounded-lg bg-audio-accent text-black font-mono font-bold text-[10px] hover:bg-audio-accent-bright shadow-glow-brass transition-all flex items-center gap-1"
              title="Compare the current EQ and reference curves"
            >
              <span>{embeddedInLab ? 'Compare these curves' : '⤢ Open in Lab'}</span>
            </button>
          </div>
        </div>

        {/* SVG Curve Canvas with CrinGraph Axis Craft & Auto-Ranging */}
        <div ref={plot.ref} className={`relative w-full overflow-hidden bg-audio-surface rounded-xl border border-audio-border/80 ${embeddedInLab ? 'lab-editor-plot' : ''}`}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${workbenchViewport.width} ${workbenchViewport.height}`}
            className={`w-full block cursor-crosshair eq-edit-graph ${embeddedInLab ? 'h-full' : 'h-auto'}`}
            onPointerMove={handleSvgMouseMove}
            onPointerDown={handleSvgMouseMove}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setHoveredPoint(null);
            }}
          >
            <defs>
              <linearGradient id="eq-brass-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#b4e4bd" />
                <stop offset="50%" stopColor="#c9f3d0" />
                <stop offset="100%" stopColor="#b4e4bd" />
              </linearGradient>
              <linearGradient id="eq-teal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4FB38B" />
                <stop offset="50%" stopColor="#83bfa5" />
                <stop offset="100%" stopColor="#4FB38B" />
              </linearGradient>
              <filter id="eq-curve-glow" x1="-10%" y1="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#b4e4bd" floodOpacity="0.45" />
              </filter>
              <filter id="teal-curve-glow" x1="-10%" y1="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#83bfa5" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* Sibilance corridor 6kHz - 9kHz */}
            <rect
              x={freqToX(6000, workbenchViewport)}
              y={workbenchViewport.padding.top}
              width={freqToX(9000, workbenchViewport) - freqToX(6000, workbenchViewport)}
              height={
                workbenchViewport.height - workbenchViewport.padding.top - workbenchViewport.padding.bottom
              }
              fill="#eb9689"
              fillOpacity="0.07"
            />
            <text
              x={(freqToX(6000, workbenchViewport) + freqToX(9000, workbenchViewport)) / 2}
              y={workbenchViewport.padding.top + 13}
              fill="#eb9689"
              fontSize="7.5"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
              opacity="0.85"
            >
              SIBILANCE RISK (6-9kHz)
            </text>

            {/* CrinGraph Decade Grid Lines & Axis Ticks (1/1.5/2/3/4/6/8 per decade) */}
            {CRINGRAPH_FREQ_TICKS.map(({ freq, label, major }) => {
              const x = freqToX(freq, workbenchViewport);
              return (
                <g key={freq}>
                  <line
                    x1={x}
                    y1={workbenchViewport.padding.top}
                    x2={x}
                    y2={workbenchViewport.height - workbenchViewport.padding.bottom}
                    stroke={major ? '#382D24' : '#222b25'}
                    strokeWidth={major ? '1.0' : '0.6'}
                    strokeDasharray={major ? undefined : '2 2'}
                  />
                  <text
                    x={x}
                    y={workbenchViewport.height - 12}
                    fill={major ? '#edf0ec' : '#8A7E6E'}
                    fontSize={embeddedInLab ? (major ? '12' : '11') : (major ? '8.5' : '7.5')}
                    fontWeight={major ? 'bold' : 'normal'}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Horizontal dB Ticks (every 6 dB, auto-ranged) */}
            {yTicks.map((db) => {
              const y = dbToY(db, workbenchViewport, minY, maxY);
              const isZero = db === 0;
              return (
                <g key={db}>
                  <line
                    x1={workbenchViewport.padding.left}
                    y1={y}
                    x2={workbenchViewport.width - workbenchViewport.padding.right}
                    y2={y}
                    stroke={isZero ? '#4A3E33' : '#1E1813'}
                    strokeWidth={isZero ? '1.2' : '0.7'}
                    strokeDasharray={isZero ? undefined : '2 2'}
                  />
                  <text
                    x={workbenchViewport.padding.left - 6}
                    y={y + 3}
                    fill={isZero ? '#b4e4bd' : '#8A7E6E'}
                    fontSize={embeddedInLab ? '12' : '8'}
                    fontFamily="monospace"
                    textAnchor="end"
                    fontWeight={isZero ? 'bold' : 'normal'}
                  >
                    {db > 0 ? `+${db}` : db}
                  </text>
                </g>
              );
            })}

            {/* Selected Reference Target Curve (Dashed) */}
            {eqViewMode !== 'filter' && targetSvgPath && (
              <path
                d={targetSvgPath}
                fill="none"
                stroke={currentTarget?.color || '#83bfa5'}
                strokeWidth="1.8"
                strokeDasharray="4 3"
                strokeLinecap="round"
                opacity="0.85"
              />
            )}

            {/* Ingested Measurement Curve (Solid Cream) */}
            {eqViewMode === 'compensated' && measuredSvgPath && (
              <path
                d={measuredSvgPath}
                fill="none"
                stroke="#edf0ec"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            )}

            {/* Corrected Response Curve (Phosphor Teal) */}
            {eqViewMode === 'compensated' && correctedSvgPath && (
              <path
                d={correctedSvgPath}
                fill="none"
                stroke="url(#eq-teal-grad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#teal-curve-glow)"
              />
            )}

            {/* Active Live Manual EQ Curve (Brushed Brass) - when no measurement active */}
            {eqViewMode !== 'compensated' && compositeSvgPath && (
              <path
                d={compositeSvgPath}
                fill="none"
                stroke="url(#eq-brass-grad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#eq-curve-glow)"
              />
            )}

            {eqViewMode === 'filter' && <FilterHandles viewport={workbenchViewport} bands={currentIsoBands} gains={currentIsoGains} onGain={handleSliderChange} onFilter={handleUpdatePeqFilter} onDragging={active => setFrozenRange(active ? { minY, maxY, yTicks } : null)} />}
            {/* Dual-Curve Crosshair & Dynamic Readout */}
            {hoveredPoint && (
              <g pointerEvents="none">
                <line
                  x1={hoveredPoint.x}
                  y1={workbenchViewport.padding.top}
                  x2={hoveredPoint.x}
                  y2={workbenchViewport.height - workbenchViewport.padding.bottom}
                  stroke="#edf0ec"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="4.5"
                  fill="#b4e4bd"
                  stroke="#edf0ec"
                  strokeWidth="1.5"
                />
                <rect
                  x={Math.min(
                    hoveredPoint.x + 8,
                    workbenchViewport.width - workbenchViewport.padding.right - 120,
                  )}
                  y={Math.max(hoveredPoint.y - 28, workbenchViewport.padding.top + 4)}
                  width="115"
                  height="24"
                  rx="4"
                  fill="#222b25"
                  stroke="#b4e4bd"
                  strokeWidth="1"
                  filter="drop-shadow(0 4px 10px rgba(0,0,0,0.6))"
                />
                <text
                  x={Math.min(
                    hoveredPoint.x + 65,
                    workbenchViewport.width - workbenchViewport.padding.right - 62,
                  )}
                  y={Math.max(hoveredPoint.y - 12, workbenchViewport.padding.top + 20)}
                  fill="#edf0ec"
                  fontSize={embeddedInLab ? '12' : '8'}
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {hoveredPoint.freq >= 1000
                    ? `${(hoveredPoint.freq / 1000).toFixed(1)}k`
                    : `${hoveredPoint.freq}`}
                  Hz • {hoveredPoint.db > 0 ? `+${hoveredPoint.db}` : hoveredPoint.db}dB
                  {hoveredPoint.correctedDb !== undefined &&
                    ` (Corr: ${hoveredPoint.correctedDb > 0 ? `+${hoveredPoint.correctedDb}` : hoveredPoint.correctedDb})`}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend & Provenance Trust Caption */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[9px] font-mono text-audio-muted/70">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-audio-accent font-semibold">
              <span className="w-2.5 h-[2px] bg-audio-accent" />
              {eqViewMode === 'iem'
                ? 'Estimated response'
                : eqViewMode === 'compensated'
                  ? 'Post-EQ Net Response (Solid Brass)'
                  : 'EQ correction shape'}
            </span>
            {selectedTargetId !== 'none' && (
              <span className="flex items-center gap-1.5 text-audio-signal font-semibold">
                <span className="w-2.5 h-[2px] border-b border-dashed border-audio-signal" /> Reference target
              </span>
            )}
            {measurement && (
              <span className="flex items-center gap-1.5 text-[#edf0ec]">
                <span className="w-2.5 h-[2px] bg-audio-surface" /> Measured Raw IEM (Solid Cream)
              </span>
            )}
            {autoPeqResult && (
              <span className="flex items-center gap-1.5 text-audio-signal">
                <span className="w-2.5 h-[2px] bg-audio-signal shadow-glow-teal" /> Current post-EQ response
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-audio-signal">
              {currentTarget?.shortName}: {currentTarget?.points.length || 0} pts
            </span>
            <span>•</span>
            <span className="text-audio-accent">EQ: Biquad Synthesis (exact)</span>
          </div>
        </div>

        <details className="section-disclosure">
          <summary>Listen & compare your EQ</summary>
          <p className="text-xs text-audio-muted mb-3">
            Play a local track or test sound, then switch EQ on and off to hear the difference.
          </p>
          <label className="control-field mb-3">
            Playback volume · {Math.round(volume * 100)}%
            <input
              aria-label="EQ playback volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
          {/* 5. WEB AUDIO PREVIEW AUDITION & Capture browser audio TOOLBAR */}
          <div className="p-3 bg-audio-surface rounded-xl border border-audio-border flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Engraved size="xs" glow className="mr-1">
                Audio source
              </Engraved>

              {/* LIVE TAB CAPTURE LATCH BUTTON */}
              <button
                type="button"
                onClick={() => (isCapturing ? stopTabCapture() : startTabCapture())}
                disabled={!tabSupported}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
                  isCapturing
                    ? 'bg-audio-surface border-audio-warn text-audio-warn shadow-panel animate-pulse'
                    : !tabSupported
                      ? 'bg-audio-surface border-audio-border text-audio-muted/40 cursor-not-allowed'
                      : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-text hover:border-audio-accent/60'
                }`}
                title={
                  !tabSupported
                    ? 'Chrome / Edge tab capture only'
                    : isCapturing
                      ? 'Click to stop live browser tab capture'
                      : 'Capture and EQ a live YouTube or Spotify Web tab in real-time'
                }
              >
                <Led color={isCapturing ? 'red' : 'amber'} pulse={isCapturing} size="sm" />
                <span>{isCapturing ? 'LIVE TAB ACTIVE' : 'LIVE TAB CAPTURE'}</span>
              </button>

              {/* Telemetry Readout for Live Tab */}
              {isCapturing && (
                <span className="px-2 py-1 rounded bg-audio-surface border border-audio-warn/40 text-[9px] font-mono text-audio-warn font-bold">
                  LIVE • LATENCY {tabTelemetry.latencyMs}ms
                </span>
              )}

              {/* Pink Noise Generator */}
              <button
                type="button"
                onClick={() => {
                  if (isCapturing) stopTabCapture();
                  void playPinkNoise();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  isPlaying && activeSource === 'pink-noise'
                    ? 'bg-audio-signal text-black font-bold shadow-glow-teal'
                    : 'bg-audio-surface border border-audio-border text-audio-muted hover:text-audio-text'
                }`}
              >
                <WaveformIcon />
                <span>{isPlaying && activeSource === 'pink-noise' ? '⏹ Stop Noise' : '▶ Pink Noise'}</span>
              </button>

              {/* Sine Sweep Generator */}
              <button
                type="button"
                onClick={() => {
                  if (isCapturing) stopTabCapture();
                  void playSineSweep();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  isPlaying && activeSource === 'sweep'
                    ? 'bg-audio-warn text-black font-bold shadow-panel'
                    : 'bg-audio-surface border border-audio-border text-audio-muted hover:text-audio-text'
                }`}
              >
                <span>{isPlaying && activeSource === 'sweep' ? '⏹ Stop Sweep' : '▶ 20Hz—20kHz Sweep'}</span>
              </button>

              {/* Upload Music File for Audition */}
              <button
                type="button"
                onClick={() => audioFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-audio-border bg-audio-surface text-xs font-mono text-audio-muted hover:text-audio-text hover:border-audio-accent/50 transition-all flex items-center gap-1.5"
              >
                <span>{fileName ? `🎵 ${fileName.slice(0, 14)}…` : '📁 Audition Track'}</span>
              </button>
              <input
                type="file"
                ref={audioFileInputRef}
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (isCapturing) stopTabCapture();
                    void handleFileUpload(file);
                  }
                }}
              />

              {fileName && (
                <button
                  type="button"
                  onClick={() => {
                    if (isCapturing) stopTabCapture();
                    void toggleFilePlayback();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs"
                >
                  {isPlaying && activeSource === 'file' ? 'Pause' : 'Play Track'}
                </button>
              )}
            </div>

            {/* Latching A/B Bypass Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsBypassed(!isBypassed)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
                  isBypassed
                    ? 'bg-audio-surface border-audio-warn text-audio-warn'
                    : 'bg-audio-surface border-audio-signal text-audio-signal shadow-glow-teal'
                }`}
                title="A/B Bypass Switch: Instantly compare EQ curve against raw bypass audio"
              >
                <Led
                  color={isBypassed ? 'amber' : 'green'}
                  pulse={!isBypassed && isPlaying && activeSource !== 'liveTab' && activeSource !== 'none'}
                  size="sm"
                />
                <span>{isBypassed ? (levelMatched && matchDb !== null ? (matchDb === -24 ? 'Limited match bypass' : 'Level-matched bypass') : 'Raw bypass') : 'EQ on'}</span>
              </button>
            </div>
          </div>
        </details>
      </details>
      </div>
  </>);

  return (
    <div className={`eq-workspace space-y-5 max-w-5xl mx-auto select-none ${embeddedInLab ? 'lab-eq-workbench' : ''} ${className}`}>
      {draftError && <div role="alert" className="panel p-3">{draftError}<button onClick={() => audioWorkspace.retry()}>Retry write</button><button onClick={() => { if (window.confirm('Preserve damaged draft as recovery data and start fresh?')) { try { audioWorkspace.recoverFresh(); } catch { setImportError('Recovery write failed. Original draft is preserved. Export a backup before refreshing.'); } } }}>Start fresh</button></div>}
      {importError && <div role="alert" className="panel p-3">{importError}<button onClick={() => { audioWorkspace.update({ measurementRef: null }); setImportError(null); }}>Continue manual EQ</button></div>}
      {!embeddedInLab && policyControls}
      <nav className="audio-view-tabs" aria-label="Audio workspace views">
        {!embeddedInLab && <><button className="secondary-button" onClick={() => setWorkbenchState('ADDING')}>Editor {draft.dirty ? '• Unsaved' : ''}</button>
        <button className="secondary-button" onClick={openCompare}>Compare</button>
        <button className="secondary-button" onClick={() => setWorkbenchState('IDLE')}>Presets</button></>}
        <button className="secondary-button" disabled={!undoCount} onClick={() => audioWorkspace.undo()}>Undo</button>
        <button className="secondary-button" disabled={!redoCount} onClick={() => audioWorkspace.redo()}>Redo</button>
      </nav>
      {embeddedInLab && workbenchState === 'ADDING' && <section className="lab-draft-bar panel p-4">
        <div className="flex justify-between items-center gap-3 mb-3"><h2>{editingPresetId ? 'Edit EQ preset' : 'Create an EQ preset'}</h2><span className="text-xs text-audio-muted">{draft.dirty ? 'Unsaved changes' : 'Draft saved'}</span></div>
        {presetIdentity}{presetActions}
      </section>}
      {embeddedInLab && workbenchState !== 'IDLE' && graphEditor}
      {/* 1. TOP HEADER & WORKBENCH ACTIONS */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-2 border-b border-audio-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-audio-accent shadow-glow-brass" />
            <Engraved size="sm" glow>
              Your EQ workspace
            </Engraved>
          </div>
          <p className="text-xs text-audio-muted mt-0.5 font-sans">
            Start with a new preset, import an EQ, or upload a frequency response measurement.
          </p>
          <p className="text-xs text-audio-muted mt-2">
            DSP preview: {draft.sampleRate / 1000} kHz. Playback uses the active AudioContext rate. Use a reference target calibrated for your measurement rig; bundled acoustic
            targets are approximations.
          </p>
        </div>

        {/* Action controls in header */}
        <div className="flex items-center gap-2">
          {workbenchState === 'IDLE' && (
            <>
              <button
                type="button"
                onClick={() => measurementFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-audio-signal/40 bg-audio-surface text-xs font-mono text-audio-signal hover:bg-audio-surface/80 transition-all flex items-center gap-1.5 shadow-panel"
                title="Upload CSV, TSV, or TXT REW measurement file"
              >
                <span>Import measurement</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setImportText('');
                  setWorkbenchState('IMPORTING');
                }}
                className="px-3 py-1.5 rounded-lg border border-audio-border text-xs font-mono text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-all flex items-center gap-1.5"
              >
                <span>Import EQ text</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!replaceAllowed()) return;
                  audioWorkspace.replace({ ...freshDraft(), workbenchState: 'ADDING' });
                  setEditingPresetId(null);
                  setPresetName('');
                  setGains10(new Array(10).fill(0));
                  setGains15(new Array(15).fill(0));
                  setGains31(new Array(31).fill(0));
                  setPeqFilters([]);
                  setMeasurement(null);
                  setHardwareAssigned('');
                  setWorkbenchState('ADDING');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <PlusIcon />
                <span>New preset</span>
              </button>
            </>
          )}

          {workbenchState === 'MEASUREMENT' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadAutoPeqIntoEditor}
                className="px-3.5 py-1.5 rounded-lg bg-audio-signal text-black font-mono font-bold text-xs hover:bg-audio-signal/90 shadow-glow-teal flex items-center gap-1.5 transition-all active:scale-95"
              >
                <span>Edit generated EQ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeasurement(null);
                  setWorkbenchState('IDLE');
                }}
                className="px-3 py-1.5 rounded-lg border border-audio-border text-xs font-mono text-audio-muted hover:text-audio-text"
              >
                ✕ Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {conversionReport && <p role="status" className="text-xs text-audio-muted">{conversionReport}</p>}
      {fitEvaluation.error && <p role="alert">Fitting failed: {fitEvaluation.error}</p>}
      {draft.originalFit && <p className="text-xs text-audio-muted">Original automatic fit: {draft.originalFit.finalRms} dB RMS · {draft.originalFit.evaluatedPoints} evaluated points. Current response follows your editable filters.</p>}
      {embeddedInLab && workbenchState !== 'IDLE' && <details className="section-disclosure"><summary>Level, sample rate & playback settings</summary>{policyControls}</details>}
      {/* Hidden Measurement File Input */}
      <input
        type="file"
        ref={measurementFileInputRef}
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMeasurementFileSelect(file);
          if (measurementFileInputRef.current) measurementFileInputRef.current.value = '';
        }}
      />

      <details className="section-disclosure" open={workbenchState === 'MEASUREMENT' || !!measurement}>
        <ol className="measurement-guide"><li>Import numeric measurement data from your measurement rig.</li><li>Choose a compatible target and analysis smoothing.</li><li>Generate correction, edit filters, then preview and save.</li></ol>
        <summary>Auto EQ from a measurement</summary> {/* 2. MEASUREMENT UPLOAD DROPZONE DRAWER */}
        {(!measurement || workbenchState === 'MEASUREMENT') && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleMeasurementFileSelect(file);
            }}
            className={`p-3.5 rounded-2xl border transition-all ${
              isDraggingFile
                ? 'border-audio-signal bg-audio-surface shadow-glow-teal'
                : measurement
                  ? 'border-audio-signal/40 bg-audio-surface'
                  : 'border-dashed border-audio-border bg-audio-surface'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-audio-surface border border-audio-border flex items-center justify-center text-audio-accent">
                  📊
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-audio-text">
                      {measurement ? `MEASUREMENT: ${measurement.name}` : 'Import a measurement'}
                    </span>
                    {measurement && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-audio-surface border border-audio-signal/30 text-audio-signal">
                        {measurement.sampleCount} PTS • NORM 1kHz:{' '}
                        {measurement.normOffset > 0 ? `+${measurement.normOffset}` : measurement.normOffset}{' '}
                        dB
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-audio-muted mt-0.5">
                    {measurement
                      ? 'Synthesized corrective PEQ residual against selected reference target curve.'
                      : 'Drop a CSV, TSV, or TXT measurement to generate an EQ automatically.'}
                  </p>
                </div>
              </div>

              {/* Smoothing Chips & Filter Slider */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-audio-surface p-1 rounded-xl border border-audio-border">
                  <span className="text-[9px] font-mono text-audio-muted px-1.5">SMOOTH:</span>
                  {(['RAW', '1/6 OCT', '1/3 OCT'] as SmoothingType[]).map((sm) => (
                    <button
                      key={sm}
                      type="button"
                      onClick={() => setSmoothing(sm)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all ${
                        smoothing === sm
                          ? 'bg-audio-accent text-black font-bold shadow-glow-brass'
                          : 'text-audio-muted hover:text-audio-text'
                      }`}
                    >
                      {sm}
                    </button>
                  ))}
                </div>

                {measurement && (
                  <div className="flex items-center gap-1.5 bg-audio-surface px-3 py-1.5 rounded-xl border border-audio-border">
                    <span className="text-[9px] font-mono text-audio-muted">FILTERS:</span>
                    <input
                      type="range"
                      min={5}
                      max={20}
                      step={1}
                      value={maxAutoFilters}
                      onChange={(e) => setMaxAutoFilters(parseInt(e.target.value, 10))}
                      className="w-16 accent-audio-accent cursor-pointer"
                    />
                    <span className="text-xs font-mono font-bold text-audio-accent">{maxAutoFilters}</span>
                  </div>
                )}

                {!measurement && (
                  <button
                    type="button"
                    onClick={() => measurementFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass"
                  >
                    Select File
                  </button>
                )}
              </div>
            </div>

            {/* Mono Stats Readout for Auto-PEQ Synthesis */}
            {autoPeqResult && (
              <div className="mt-3 pt-2.5 border-t border-audio-signal/20 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-audio-text">
                <div className="flex items-center gap-2">
                  <Led color="teal" size="sm" pulse />
                  <span className="text-audio-signal font-bold">
                    RESIDUAL RMS {autoPeqResult.finalRms} dB
                  </span>
                  <span className="text-audio-muted">•</span>
                  <span>RMS IMPROVEMENT {autoPeqResult.matchPercentage}%</span>
                  <span className="text-audio-muted">•</span>
                  <span>{autoPeqResult.filters.length} FILTERS</span>
                  <span className="text-audio-muted">•</span>
                  <span className="text-audio-warn">PREAMP {autoPeqResult.preamp} dB</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-audio-muted">INITIAL RMS: {autoPeqResult.initialRms} dB</span>
                  <button
                    type="button"
                    onClick={handleLoadAutoPeqIntoEditor}
                    className="text-audio-signal hover:underline font-bold"
                  >
                    Load into Parametric EQ Editor →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </details>
      {/* 3. IMPORT AUTOEQ DRAWER */}
      {workbenchState === 'IMPORTING' && (
        <div className="p-4 md:p-5 bg-audio-surface rounded-2xl border border-audio-accent/60 shadow-panel animate-in slide-in-from-top-3 space-y-3">
          <div className="flex items-center justify-between">
            <Engraved size="xs" glow>
              PASTE AUTOEQ / EQUALIZER APO / WAVELET TEXT
            </Engraved>
            <button
              type="button"
              onClick={() => setWorkbenchState('IDLE')}
              className="text-xs text-audio-muted hover:text-audio-text"
            >
              ✕ Close
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`Paste text in any of these formats:\n\n1. Equalizer APO:\nFilter 1: ON PK Fc 1000 Hz Gain 2.5 dB Q 1.41\nFilter 2: ON LSC Fc 105 Hz Gain 4.0 dB Q 0.71\n\n2. Wavelet:\nGraphicEQ: 20 0.0; 62.5 -1.2; 125 0.5; 250 -0.8; ...`}
            className={`${inputClass} min-h-[110px] font-mono text-xs leading-relaxed`}
            autoFocus
          />
          {importError && <p className="text-xs font-mono text-audio-warn">{importError}</p>}
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setWorkbenchState('IDLE')}
              className="px-3 py-1.5 text-xs font-mono text-audio-muted hover:text-audio-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!importText.trim()}
              className="px-4 py-1.5 bg-audio-accent text-black font-mono font-bold text-xs rounded-lg hover:bg-audio-accent-bright shadow-glow-brass disabled:opacity-40"
            >
              Parse into Bands →
            </button>
          </div>
        </div>
      )}

      {/* 6. ADDING / EDITING DRAWER (With Form-Level Save & Cancel) */}
      {workbenchState === 'ADDING' && (
        <div className="p-4 md:p-5 bg-audio-surface rounded-2xl border border-audio-accent/70 shadow-panel animate-in slide-in-from-top-3 space-y-4">
          <div className="flex items-center justify-between">
            <Engraved size="xs" glow>
              {editingPresetId ? 'Edit EQ preset' : 'Create a new EQ preset'}
            </Engraved>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-audio-signal">PREAMP: {currentPreamp} dB</span>
            </div>
          </div>

          {!embeddedInLab && presetIdentity}

          <label className="control-field w-fit">
            Equalizer type
            <select
              value={eqMode}
              onChange={(e) => { if (draft.dirty && !window.confirm('Switch EQ mode? Existing mode settings are kept, but only the selected mode plays.')) return; setEqMode(e.target.value as '10-band' | '15-band' | '31-band' | 'peq'); }}
            >
              <option value="10-band">10-band · Simple tuning</option>
              <option value="15-band">15-band · More detail</option>
              <option value="31-band">31-band · Fine control</option>
              <option value="peq">Parametric · Individual filters</option>
            </select>
          </label>
          {/* A. GRAPHIC ISO SLIDERS */}
          {eqMode !== 'peq' && (
            <div className="p-3.5 bg-audio-surface rounded-xl border border-audio-border overflow-x-auto scrollbar-thin">
              <div
                className="grid gap-2 text-center"
                style={{
                  gridTemplateColumns: `repeat(${currentIsoBands.length}, minmax(36px, 1fr))`,
                  minWidth:
                    currentIsoBands.length === 31
                      ? '1100px'
                      : currentIsoBands.length === 15
                        ? '600px'
                        : '100%',
                }}
              >
                {currentIsoBands.map((freq, i) => {
                  const gain = currentIsoGains[i] || 0;
                  const freqLabel = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
                  const isGainActive = gain !== 0;

                  return (
                    <div
                      key={freq}
                      className="flex flex-col items-center group/fader select-none"
                      onDoubleClick={() => handleResetBand(i)}
                      title={`Band: ${freq}Hz | Gain: ${gain > 0 ? `+${gain}` : gain}dB (Double-click to reset)`}
                    >
                      <span
                        className={`text-[9px] font-mono font-bold mb-1 transition-colors ${
                          isGainActive ? 'text-audio-accent' : 'text-audio-muted/60'
                        }`}
                      >
                        {gain > 0 ? `+${gain}` : gain}
                      </span>

                      <div className="relative h-28 w-6 flex items-center justify-center bg-audio-surface rounded-full border border-audio-border shadow-inner py-1">
                        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-audio-accent/40" />
                        <input
                          aria-label={`Gain at ${freq} Hz`}
                          type="range"
                          min={-12}
                          max={12}
                          step={0.5}
                          value={gain}
                          onPointerDown={() => audioWorkspace.beginGesture()}
                          onPointerUp={() => audioWorkspace.endGesture()}
                          onPointerCancel={() => audioWorkspace.endGesture(true)}
                          onChange={(e) => handleSliderChange(i, parseFloat(e.target.value))}
                          className="h-24 w-4 cursor-ns-resize appearance-none bg-transparent"
                          style={{
                            writingMode: 'vertical-lr' as any,
                            WebkitAppearance: 'slider-vertical' as any,
                            accentColor: '#b4e4bd',
                          }}
                        />
                      </div>

                      <span className="text-[8px] font-mono text-audio-muted mt-1 group-hover/fader:text-audio-text">
                        {freqLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] font-mono text-audio-muted/70 text-center mt-2">
                ±12 dB range • 0.5 dB step • Double-click any band to zero out
              </p>
            </div>
          )}

          {/* B. PARAMETRIC PEQ FILTER ROWS */}
          {eqMode === 'peq' && (
            <div className="space-y-2.5 p-3.5 bg-audio-surface rounded-xl border border-audio-border">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-audio-muted">
                  PARAMETRIC BIQUAD CASCADE ({peqFilters.length} FILTERS)
                </span>
                <button
                  type="button"
                  onClick={handleAddPeqFilter}
                  className="px-2.5 py-1 rounded bg-audio-accent/20 border border-audio-accent/50 text-audio-accent hover:bg-audio-accent hover:text-black text-xs font-mono font-bold transition-all"
                >
                  + Add Filter Row
                </button>
              </div>

              {peqFilters.map((filter, fIdx) => (
                <div
                  key={filter.id}
                  className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-audio-surface border border-audio-border"
                >
                  <span className="text-[10px] font-mono text-audio-accent font-bold w-6">#{fIdx + 1}</span>
                  <label className="flex items-center gap-1 text-xs !mb-0">
                    <input
                      type="checkbox"
                      aria-label={`Enable filter ${fIdx + 1}`}
                      checked={filter.enabled !== false}
                      onChange={(e) => handleUpdatePeqFilter(filter.id, { enabled: e.target.checked })}
                    />
                    On
                  </label>

                  <select
                    value={filter.type}
                    onChange={(e) =>
                      handleUpdatePeqFilter(filter.id, { type: e.target.value as PEQFilterType })
                    }
                    className="bg-audio-surface border border-audio-border text-audio-text rounded px-2 py-1 text-xs font-mono focus:outline-none"
                  >
                    <option value="PK">PK (Peak)</option>
                    <option value="LS">LS (Low Shelf)</option>
                    <option value="HS">HS (High Shelf)</option>
                    <option value="HP">HP (High Pass)</option>
                    <option value="LP">LP (Low Pass)</option>
                    <option value="NOTCH">NOTCH (Band Stop)</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-audio-muted">Fc:</span>
                    <input
                      type="number"
                      min={20}
                      max={20000}
                      step={10}
                      aria-label={`Frequency for filter ${fIdx+1}`}
                      value={filter.freq}
                      onChange={(e) =>
                        handleUpdatePeqFilter(filter.id, {
                          freq: Math.max(20, Math.min(20000, parseFloat(e.target.value) || 1000)),
                        })
                      }
                      className="w-16 bg-audio-surface border border-audio-border rounded px-1.5 py-1 text-xs font-mono text-audio-text"
                    />
                    <span className="text-[9px] font-mono text-audio-muted">Hz</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-audio-muted">Gain:</span>
                    <input
                      type="number"
                      min={-18}
                      max={18}
                      step={0.5}
                      aria-label={`Gain for filter ${fIdx+1}`}
                      disabled={!gainApplies(filter.type)}
                      value={filter.gain}
                      onChange={(e) =>
                        handleUpdatePeqFilter(filter.id, {
                          gain: Math.max(-18, Math.min(18, parseFloat(e.target.value) || 0)),
                        })
                      }
                      className="w-14 bg-audio-surface border border-audio-border rounded px-1.5 py-1 text-xs font-mono text-audio-text"
                    />
                    <span className="text-[9px] font-mono text-audio-muted">dB</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-audio-muted">Q:</span>
                    <input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.1}
                      aria-label={`Q for filter ${fIdx+1}`}
                      value={filter.q}
                      onChange={(e) =>
                        handleUpdatePeqFilter(filter.id, {
                          q: Math.max(0.1, Math.min(20, parseFloat(e.target.value) || 1.41)),
                        })
                      }
                      className="w-14 bg-audio-surface border border-audio-border rounded px-1.5 py-1 text-xs font-mono text-audio-text"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeletePeqFilter(filter.id)}
                    className="ml-auto text-audio-muted hover:text-audio-warn p-1"
                    title="Delete filter"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Explicit draft save actions */}
          {!embeddedInLab && presetActions}
        </div>
      )}

      {!embeddedInLab && graphEditor}

      {audioError && (
        <p className="text-sm text-audio-warn" role="alert">
          {audioError}
        </p>
      )}
      {/* FEEDBACK SAFETY GUARD OVERLAY MODAL */}
      {showFeedbackGuard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="panel p-5 md:p-6 bg-audio-surface max-w-md w-full rounded-2xl border border-audio-warn shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <Led color="amber" size="md" pulse />
              <Engraved size="xs" glow className="text-audio-warn">
                AUDIO FEEDBACK GUARD PROTOCOL
              </Engraved>
            </div>
            <p className="text-xs text-audio-text leading-relaxed">
              Select the specific browser tab making sound (e.g., <strong>YouTube, Spotify Web</strong>).
            </p>
            <div className="p-3 bg-audio-surface rounded-xl border border-audio-warn/40 text-[11px] font-mono text-audio-warn">
              ⚠️ <strong>Never select this AudioSage tab</strong> or your Entire Screen — doing so creates an
              acoustic feedback loop.
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={dismissFeedbackGuard}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-audio-muted hover:text-audio-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmFeedbackGuard}
                className="px-4 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass"
              >
                Select Audio Tab →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SAVED PRESETS RACK */}
      {(!embeddedInLab || workbenchState === 'IDLE') && <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center px-1">
          <Engraved size="xs">Your saved presets ({presets.length})</Engraved>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {presets && presets.length > 0 ? (
            presets.map((preset) => (
              <div
                key={preset.id}
                className="p-4 bg-audio-surface rounded-xl border border-audio-border hover:border-audio-accent/50 transition-all flex flex-col justify-between group shadow-panel"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-display font-bold text-sm text-audio-text group-hover:text-audio-accent transition-colors">
                        {preset.name}
                      </h4>
                      <p className="text-[10px] font-mono text-audio-muted">{preset.hardware}</p>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-audio-surface border border-audio-border text-audio-accent font-bold uppercase">
                      {preset.mode || preset.type}
                    </span>
                  </div>

                  {/* Sparkline Visualizer Bar */}
                  <div className="h-8 bg-audio-surface rounded-lg border border-audio-border/60 p-1 flex items-end gap-1 mb-3">
                    {(preset.graphicGains && preset.graphicGains.length > 0
                      ? preset.graphicGains
                      : [0, 1.2, 0.5, 0, -0.5, 1.0, 2.5, 1.8, -2.0, 0.5]
                    ).map((g, idx) => {
                      const heightPct = Math.max(15, Math.min(100, 50 + g * 3.5));
                      return (
                        <div
                          key={idx}
                          className={`flex-1 rounded-t transition-all ${
                            g > 0 ? 'bg-audio-accent/80' : g < 0 ? 'bg-audio-signal/80' : 'bg-audio-border'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap justify-between items-center gap-1.5 pt-2 border-t border-audio-border/50 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      className="text-audio-accent hover:underline font-semibold"
                    >
                      Load &amp; Edit
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleCopyWavelet(preset)}
                      className="text-audio-muted hover:text-audio-text"
                    >
                      {copiedKey === `wav-${preset.id}` ? '✓ Copied' : 'Wavelet'}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleCopyAPO(preset)}
                      className="text-audio-muted hover:text-audio-text"
                    >
                      {copiedKey === `apo-${preset.id}` ? '✓ Copied' : 'APO'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="text-audio-muted hover:text-audio-warn p-1 transition-colors"
                    title="Delete preset"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-12 border border-dashed border-audio-border rounded-2xl bg-audio-surface flex flex-col items-center justify-center p-6">
              <div className="w-12 h-12 rounded-2xl bg-audio-surface border border-audio-border flex items-center justify-center text-audio-accent mb-3 shadow-panel">
                <EqIcon />
              </div>
              <h3 className="font-display font-bold text-base text-audio-text">Your EQ Library is Ready</h3>
              <p className="text-xs text-audio-muted mt-1 max-w-sm">
                Synthesize custom curves against Crinacle IEF 2025 or ingest real frequency response CSVs to
                auto-generate corrective PEQ.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => measurementFileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-audio-signal text-black font-mono font-bold text-xs shadow-glow-teal flex items-center gap-2 active:scale-95 transition-all"
                >
                  <span>📊 Ingest Measurement CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPresetId(null);
                    setPresetName('');
                    setHardwareAssigned('');
                    setWorkbenchState('ADDING');
                  }}
                  className="px-4 py-2 rounded-xl bg-audio-accent hover:bg-audio-accent-bright text-black font-mono font-bold text-xs shadow-glow-brass flex items-center gap-2 active:scale-95 transition-all"
                >
                  <PlusIcon />
                  <span>+ Create Profile</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="notification-area" role="status" aria-live="polite">
          <CheckIcon />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default EQWorkbench;
