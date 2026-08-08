import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { EQPreset, PEQFilter, PEQFilterType } from '../types';
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
import { useAudioEngine } from '../hooks/useAudioEngine';
import {
  PlusIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  EqIcon,
  WaveformIcon,
  ActivityIcon,
} from './Icon';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import { v4 as uuidv4 } from 'uuid';

interface EQWorkbenchProps {
  presets: EQPreset[];
  onSavePresets: (presets: EQPreset[]) => void;
  className?: string;
}

export const EQWorkbench: React.FC<EQWorkbenchProps> = ({
  presets = [],
  onSavePresets,
  className = '',
}) => {
  // State Machine: 'IDLE' | 'ADDING' | 'IMPORTING'
  const [workbenchState, setWorkbenchState] = useState<'IDLE' | 'ADDING' | 'IMPORTING'>('IDLE');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  // Active Mode: '10-band' | '15-band' | '31-band' | 'peq'
  const [eqMode, setEqMode] = useState<'10-band' | '15-band' | '31-band' | 'peq'>('10-band');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('crinacle-ief-2025');

  // Form Fields
  const [presetName, setPresetName] = useState('');
  const [hardwareAssigned, setHardwareAssigned] = useState('');

  // Slider Gains for 10, 15, and 31 bands
  const [gains10, setGains10] = useState<number[]>(new Array(10).fill(0));
  const [gains15, setGains15] = useState<number[]>(new Array(15).fill(0));
  const [gains31, setGains31] = useState<number[]>(new Array(31).fill(0));

  // Parametric Filter Rows
  const [peqFilters, setPeqFilters] = useState<PEQFilter[]>([
    { id: 'f-1', type: 'PK', freq: 1000, gain: 0, q: 1.41, enabled: true },
    { id: 'f-2', type: 'LS', freq: 105, gain: 0, q: 0.71, enabled: true },
    { id: 'f-3', type: 'HS', freq: 10000, gain: 0, q: 0.71, enabled: true },
  ]);

  // Import State
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // UI Toast & Copy Status
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Hover Crosshair on Curve
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; freq: number; db: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

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

  // Web Audio Preview Engine
  const {
    isPlaying,
    activeSource,
    fileName,
    volume,
    setVolume,
    playPinkNoise,
    playSineSweep,
    handleFileUpload,
    toggleFilePlayback,
    stopAudio,
  } = useAudioEngine({
    isoBands: eqMode === 'peq' ? [] : currentIsoBands,
    isoGains: eqMode === 'peq' ? [] : currentIsoGains,
    peqFilters: eqMode === 'peq' ? peqFilters : [],
    isBypassed,
  });

  // Selected Target Curve
  const currentTarget = useMemo(() => {
    return TARGET_CURVES.find((t) => t.id === selectedTargetId) || TARGET_CURVES[0];
  }, [selectedTargetId]);

  // Calculate live composite curve points
  const compositeCurvePoints = useMemo(() => {
    return evaluateCompositeCurve(
      SYNTHESIS_FREQUENCIES,
      eqMode === 'peq' ? [] : currentIsoBands,
      eqMode === 'peq' ? [] : currentIsoGains,
      eqMode === 'peq' ? peqFilters : []
    );
  }, [currentIsoBands, currentIsoGains, peqFilters, eqMode]);

  // AUTO-RANGE Y-AXIS (Un-clips Harman's -20.1dB treble cliff and accommodates parametric peaks)
  const { minY, maxY, yTicks } = useMemo(() => {
    const targetPoints = selectedTargetId !== 'none' && currentTarget ? currentTarget.points : [];
    return calculateAutoRangedYBounds([compositeCurvePoints, targetPoints], selectedTargetId !== 'none');
  }, [compositeCurvePoints, currentTarget, selectedTargetId]);

  const workbenchViewport: ViewportDimensions = useMemo(() => ({
    ...DEFAULT_VIEWPORT,
    height: 290,
    padding: { top: 25, right: 25, bottom: 35, left: 52 },
    minY,
    maxY,
  }), [minY, maxY]);

  // Generate SVG path for live curve
  const compositeSvgPath = useMemo(() => {
    return generateSvgPathFromPoints(compositeCurvePoints, workbenchViewport, minY, maxY);
  }, [compositeCurvePoints, workbenchViewport, minY, maxY]);

  // Target Curve SVG Path
  const targetSvgPath = useMemo(() => {
    if (!currentTarget || selectedTargetId === 'none') return '';
    return generateSvgPathFromPoints(currentTarget.points, workbenchViewport, minY, maxY);
  }, [currentTarget, selectedTargetId, workbenchViewport, minY, maxY]);

  // Preamp headroom calculation
  const currentPreamp = useMemo(() => {
    const allGains = eqMode === 'peq' ? peqFilters.map((f) => f.gain || 0) : currentIsoGains;
    return calculatePreampHeadroom(allGains);
  }, [eqMode, peqFilters, currentIsoGains]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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
    setPeqFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  // Save current EQ preset
  const handleSaveProfile = () => {
    if (!presetName.trim()) return;

    let bandsString = '';
    if (eqMode === 'peq') {
      bandsString = exportToEqualizerAPO(peqFilters, [], [], currentPreamp);
    } else {
      bandsString = exportToWavelet(currentIsoBands, currentIsoGains, currentPreamp);
    }

    const preset: EQPreset = {
      id: editingPresetId || uuidv4(),
      name: presetName.trim(),
      hardware: hardwareAssigned.trim() || 'All Hardware',
      type: eqMode === 'peq' ? 'Parametric' : 'Wavelet',
      mode: eqMode,
      bands: bandsString,
      graphicGains: eqMode !== 'peq' ? [...currentIsoGains] : undefined,
      peqFilters: eqMode === 'peq' ? [...peqFilters] : undefined,
      targetCurveId: selectedTargetId,
      preamp: currentPreamp,
      timestamp: Date.now(),
    };

    let updatedPresets: EQPreset[];
    if (editingPresetId) {
      updatedPresets = presets.map((p) => (p.id === editingPresetId ? preset : p));
    } else {
      updatedPresets = [preset, ...presets];
    }

    onSavePresets(updatedPresets);
    setWorkbenchState('IDLE');
    setEditingPresetId(null);
    setPresetName('');
    setHardwareAssigned('');
    showToast(`Saved "${preset.name}" to EQ Library`);
  };

  // Load preset into workbench for editing / audition
  const handleLoadPreset = (preset: EQPreset) => {
    setEditingPresetId(preset.id);
    setPresetName(preset.name);
    setHardwareAssigned(preset.hardware);

    if (preset.mode) {
      setEqMode(preset.mode);
    } else if (preset.type === 'Parametric') {
      setEqMode('peq');
    } else {
      setEqMode('10-band');
    }

    if (preset.targetCurveId) {
      setSelectedTargetId(preset.targetCurveId);
    }

    if (preset.graphicGains && preset.graphicGains.length > 0) {
      if (preset.graphicGains.length === 31) setGains31(preset.graphicGains);
      else if (preset.graphicGains.length === 15) setGains15(preset.graphicGains);
      else setGains10(preset.graphicGains);
    } else if (preset.bands) {
      const parsed = parseImportedEQText(preset.bands);
      if (parsed?.graphicGains) {
        if (parsed.mode === '31-band') setGains31(parsed.graphicGains);
        else if (parsed.mode === '15-band') setGains15(parsed.graphicGains);
        else setGains10(parsed.graphicGains);
      }
    }

    if (preset.peqFilters && preset.peqFilters.length > 0) {
      setPeqFilters(preset.peqFilters);
    }

    setWorkbenchState('ADDING');
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
    if (!importText.trim()) return;
    const result = parseImportedEQText(importText);
    if (!result) {
      setImportError('Could not recognize format. Paste AutoEQ, Equalizer APO, or GraphicEQ string.');
      return;
    }

    setImportError(null);
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
    const bands = p?.graphicGains ? (p.graphicGains.length === 31 ? ISO_31_BANDS : p.graphicGains.length === 15 ? ISO_15_BANDS : ISO_10_BANDS) : currentIsoBands;
    const gains = p?.graphicGains || currentIsoGains;
    const str = exportToEqualizerAPO(filters, bands, gains, p?.preamp ?? currentPreamp);

    navigator.clipboard.writeText(str).then(() => {
      setCopiedKey(p?.id ? `apo-${p.id}` : 'apo-curr');
      setTimeout(() => setCopiedKey(null), 2000);
      showToast('Copied Equalizer APO string (Preamp protected)');
    });
  };

  const handleCopyWavelet = (p?: EQPreset) => {
    const bands = p?.graphicGains ? (p.graphicGains.length === 31 ? ISO_31_BANDS : p.graphicGains.length === 15 ? ISO_15_BANDS : ISO_10_BANDS) : currentIsoBands;
    const gains = p?.graphicGains || currentIsoGains;
    const str = exportToWavelet(bands, gains, p?.preamp ?? currentPreamp);

    navigator.clipboard.writeText(str).then(() => {
      setCopiedKey(p?.id ? `wav-${p.id}` : 'wav-curr');
      setTimeout(() => setCopiedKey(null), 2000);
      showToast('Copied Wavelet GraphicEQ string');
    });
  };

  const handleDownloadTxt = (p?: EQPreset) => {
    const name = (p?.name || presetName || 'AudioSage_EQ').replace(/\s+/g, '_');
    const str = exportToEqualizerAPO(
      p?.peqFilters || (eqMode === 'peq' ? peqFilters : []),
      currentIsoBands,
      p?.graphicGains || currentIsoGains,
      p?.preamp ?? currentPreamp
    );
    downloadPresetFile(`${name}_EqualizerAPO.txt`, str);
    showToast(`Downloaded ${name}_EqualizerAPO.txt`);
  };

  // Crosshair move over SVG with dual-curve readout
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
      const measuredDb = getInterpolatedTargetGain(freq, compositeCurvePoints);
      const targetDb = currentTarget && selectedTargetId !== 'none' ? getInterpolatedTargetGain(freq, currentTarget.points) : 0;
      const curveY = dbToY(measuredDb, workbenchViewport, minY, maxY);
      setHoveredPoint({
        x: clientX,
        y: curveY,
        freq,
        db: parseFloat(measuredDb.toFixed(1)),
      });
    } else {
      setHoveredPoint(null);
    }
  };

  const inputClass =
    'w-full bg-[#130E0B] border border-audio-border rounded-xl px-4 py-2.5 text-audio-text focus:outline-none focus:border-audio-accent/70 text-xs font-sans';
  const labelClass = 'text-[10px] font-bold text-audio-accent uppercase tracking-widest font-mono pl-1';

  return (
    <div className={`space-y-5 max-w-5xl mx-auto select-none ${className}`}>
      {/* 1. TOP HEADER & STATE MACHINE BUTTONS */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-2 border-b border-audio-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-audio-accent shadow-glow-brass" />
            <Engraved size="sm" glow>
              ACOUSTIC EQ WORKBENCH &amp; AUDITION ENGINE
            </Engraved>
          </div>
          <p className="text-xs text-audio-muted mt-0.5 font-sans">
            Real-time Web Audio audition, target curve overlays, and ISO standard / PEQ shaping.
          </p>
        </div>

        {/* Action controls in header — Always [+ New Profile], NEVER says Cancel */}
        <div className="flex items-center gap-2">
          {workbenchState === 'IDLE' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setImportText('');
                  setWorkbenchState('IMPORTING');
                }}
                className="px-3 py-1.5 rounded-lg border border-audio-border text-xs font-mono text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-all flex items-center gap-1.5"
              >
                <span>Paste AutoEQ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingPresetId(null);
                  setPresetName('');
                  setHardwareAssigned('');
                  setWorkbenchState('ADDING');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <PlusIcon />
                <span>+ New EQ Profile</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. IMPORT AUTOEQ DRAWER */}
      {workbenchState === 'IMPORTING' && (
        <div className="p-4 md:p-5 bg-[#120D0A] rounded-2xl border border-audio-accent/60 shadow-panel animate-in slide-in-from-top-3 space-y-3">
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
          {importError && (
            <p className="text-xs font-mono text-audio-warn">{importError}</p>
          )}
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

      {/* 3. LIVE SVG CURVE VISUALIZER OVERLAY */}
      <div className="p-4 md:p-5 rounded-2xl bg-[#120D0A] border border-audio-border shadow-panel space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Engraved size="xs" glow>
              LIVE TRANSFER FUNCTION &amp; REFERENCE TARGET
            </Engraved>
            {currentPreamp < 0 && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-audio-surface border border-audio-signal/30 text-audio-signal">
                HEADROOM: {currentPreamp} dB
              </span>
            )}
          </div>

          {/* Target Reference Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-mono text-audio-muted mr-1">TARGET:</span>
            {TARGET_CURVES.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => setSelectedTargetId(target.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all ${
                  selectedTargetId === target.id
                    ? 'bg-[#1D1713] border-2 border-audio-accent text-audio-text shadow-glow-brass'
                    : 'bg-audio-surface border border-audio-border text-audio-muted hover:text-audio-text'
                }`}
              >
                {target.shortName}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedTargetId('none')}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all ${
                selectedTargetId === 'none'
                  ? 'bg-[#1D1713] border-2 border-audio-accent text-audio-text'
                  : 'bg-audio-surface border border-audio-border text-audio-muted hover:text-audio-text'
              }`}
            >
              None
            </button>
          </div>
        </div>

        {/* SVG Curve Canvas with CrinGraph Axis Craft & Auto-Ranging */}
        <div className="relative w-full overflow-hidden bg-[#0A0806] rounded-xl border border-audio-border/80">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${workbenchViewport.width} ${workbenchViewport.height}`}
            className="w-full h-auto block cursor-crosshair"
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="eq-brass-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C6934F" />
                <stop offset="50%" stopColor="#E7B87A" />
                <stop offset="100%" stopColor="#C6934F" />
              </linearGradient>
              <filter id="eq-curve-glow" x1="-10%" y1="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#C6934F" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Sibilance corridor 6kHz - 9kHz */}
            <rect
              x={freqToX(6000, workbenchViewport)}
              y={workbenchViewport.padding.top}
              width={freqToX(9000, workbenchViewport) - freqToX(6000, workbenchViewport)}
              height={workbenchViewport.height - workbenchViewport.padding.top - workbenchViewport.padding.bottom}
              fill="#E06A3F"
              fillOpacity="0.07"
            />
            <text
              x={(freqToX(6000, workbenchViewport) + freqToX(9000, workbenchViewport)) / 2}
              y={workbenchViewport.padding.top + 13}
              fill="#E06A3F"
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
                    stroke={major ? '#382D24' : '#1A1410'}
                    strokeWidth={major ? '1.0' : '0.6'}
                    strokeDasharray={major ? undefined : '2 2'}
                  />
                  <text
                    x={x}
                    y={workbenchViewport.height - 12}
                    fill={major ? '#EDE6DA' : '#8A7E6E'}
                    fontSize={major ? '8.5' : '7.5'}
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
                    fill={isZero ? '#C6934F' : '#8A7E6E'}
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="end"
                    fontWeight={isZero ? 'bold' : 'normal'}
                  >
                    {db > 0 ? `+${db}` : db}
                  </text>
                </g>
              );
            })}

            {/* Selected Reference Target Curve (Dashed Phosphor) */}
            {targetSvgPath && (
              <path
                d={targetSvgPath}
                fill="none"
                stroke={currentTarget?.color || '#6FC9A6'}
                strokeWidth="1.8"
                strokeDasharray="4 3"
                strokeLinecap="round"
                opacity="0.85"
              />
            )}

            {/* Active Live Composite EQ Curve (Solid Brushed Brass) */}
            <path
              d={compositeSvgPath}
              fill="none"
              stroke="url(#eq-brass-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#eq-curve-glow)"
            />

            {/* Dual-Curve Crosshair & Dynamic Readout */}
            {hoveredPoint && (
              <g>
                <line
                  x1={hoveredPoint.x}
                  y1={workbenchViewport.padding.top}
                  x2={hoveredPoint.x}
                  y2={workbenchViewport.height - workbenchViewport.padding.bottom}
                  stroke="#EDE6DA"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.5"
                />
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="4.5"
                  fill="#C6934F"
                  stroke="#EDE6DA"
                  strokeWidth="1.5"
                />
                <rect
                  x={Math.min(hoveredPoint.x + 8, workbenchViewport.width - workbenchViewport.padding.right - 100)}
                  y={Math.max(hoveredPoint.y - 24, workbenchViewport.padding.top + 4)}
                  width="96"
                  height="20"
                  rx="4"
                  fill="#1A1410"
                  stroke="#C6934F"
                  strokeWidth="1"
                  filter="drop-shadow(0 4px 10px rgba(0,0,0,0.6))"
                />
                <text
                  x={Math.min(hoveredPoint.x + 56, workbenchViewport.width - workbenchViewport.padding.right - 52)}
                  y={Math.max(hoveredPoint.y - 10, workbenchViewport.padding.top + 18)}
                  fill="#EDE6DA"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {hoveredPoint.freq >= 1000 ? `${(hoveredPoint.freq / 1000).toFixed(1)}k` : `${hoveredPoint.freq}`}Hz • {hoveredPoint.db > 0 ? `+${hoveredPoint.db}` : hoveredPoint.db}dB
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Provenance Trust Caption */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[9px] font-mono text-audio-muted/70">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-audio-signal/80" />
            <span>{currentTarget?.provenance || 'SRC: squig.link • norm 1 kHz'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-audio-signal">
              {currentTarget?.shortName}: {currentTarget?.pointsCount || 301} pts
            </span>
            <span>•</span>
            <span className="text-audio-accent">EQ: Biquad Synthesis (exact)</span>
          </div>
        </div>

        {/* 4. WEB AUDIO PREVIEW AUDITION TOOLBAR (Tier 2 Engine) */}
        <div className="p-3 bg-[#16110D] rounded-xl border border-audio-border flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Engraved size="xs" glow className="mr-1">
              WEB AUDIO AUDITION:
            </Engraved>

            {/* Pink Noise Generator */}
            <button
              type="button"
              onClick={playPinkNoise}
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
              onClick={playSineSweep}
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
                if (file) handleFileUpload(file);
              }}
            />

            {fileName && (
              <button
                type="button"
                onClick={toggleFilePlayback}
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
                  ? 'bg-[#2E1812] border-audio-warn text-audio-warn'
                  : 'bg-[#14231B] border-audio-signal text-audio-signal shadow-glow-teal'
              }`}
              title="A/B Bypass Switch: Instantly compare EQ curve against raw bypass audio"
            >
              <Led color={isBypassed ? 'amber' : 'green'} pulse={!isBypassed && isPlaying} size="sm" />
              <span>{isBypassed ? 'BYPASS (FLAT)' : 'EQ ACTIVE (A/B)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. ADDING / EDITING DRAWER (With Form-Level Save & Cancel) */}
      {workbenchState === 'ADDING' && (
        <div className="p-4 md:p-5 bg-[#120D0A] rounded-2xl border border-audio-accent/70 shadow-panel animate-in slide-in-from-top-3 space-y-4">
          <div className="flex items-center justify-between">
            <Engraved size="xs" glow>
              {editingPresetId ? 'EDIT ACOUSTIC PROFILE' : 'SYNTHESIZE NEW EQ PROFILE'}
            </Engraved>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-audio-signal">PREAMP: {currentPreamp} dB</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Preset Name *</label>
              <input
                type="text"
                placeholder="e.g. Simgot EW300 Holographic Chill"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Assigned Hardware (IEM / Headphone)</label>
              <input
                type="text"
                placeholder="e.g. Simgot EW300, CCA Phoenix..."
                value={hardwareAssigned}
                onChange={(e) => setHardwareAssigned(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Mode Selector Tabs: 10-Band / 15-Band / 31-Band / PEQ */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {(['10-band', '15-band', '31-band', 'peq'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEqMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  eqMode === mode
                    ? 'bg-audio-accent text-black font-bold shadow-glow-brass'
                    : 'bg-[#18130F] border border-audio-border text-audio-muted hover:text-audio-text'
                }`}
              >
                {mode === 'peq' ? 'Parametric (PEQ)' : `${mode.split('-')[0]}-Band ISO`}
              </button>
            ))}
          </div>

          {/* A. GRAPHIC ISO SLIDERS (Zero blue pixels, knurled brass thumbs, double-click reset) */}
          {eqMode !== 'peq' && (
            <div className="p-3.5 bg-[#16110D] rounded-xl border border-audio-border overflow-x-auto scrollbar-thin">
              <div
                className="grid gap-2 text-center"
                style={{
                  gridTemplateColumns: `repeat(${currentIsoBands.length}, minmax(36px, 1fr))`,
                  minWidth: currentIsoBands.length === 31 ? '1100px' : currentIsoBands.length === 15 ? '600px' : '100%',
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
                      {/* Gain Numeric Readout */}
                      <span
                        className={`text-[9px] font-mono font-bold mb-1 transition-colors ${
                          isGainActive ? 'text-audio-accent' : 'text-audio-muted/60'
                        }`}
                      >
                        {gain > 0 ? `+${gain}` : gain}
                      </span>

                      {/* Custom Tactile Chassis Vertical Track & Thumb */}
                      <div className="relative h-28 w-6 flex items-center justify-center bg-[#0B0908] rounded-full border border-[#332B23] shadow-inner py-1">
                        {/* Center Zero Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-audio-accent/40" />

                        {/* Input Range Slider with custom CSS */}
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={0.5}
                          value={gain}
                          onChange={(e) => handleSliderChange(i, parseFloat(e.target.value))}
                          className="h-24 w-4 cursor-ns-resize appearance-none bg-transparent"
                          style={{
                            writingMode: 'vertical-lr' as any,
                            WebkitAppearance: 'slider-vertical' as any,
                            accentColor: '#C6934F',
                          }}
                        />
                      </div>

                      {/* Frequency Label */}
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
            <div className="space-y-2.5 p-3.5 bg-[#16110D] rounded-xl border border-audio-border">
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
                  className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-[#110D0A] border border-audio-border"
                >
                  <span className="text-[10px] font-mono text-audio-accent font-bold w-6">
                    #{fIdx + 1}
                  </span>

                  {/* Filter Type */}
                  <select
                    value={filter.type}
                    onChange={(e) => handleUpdatePeqFilter(filter.id, { type: e.target.value as PEQFilterType })}
                    className="bg-[#18130F] border border-audio-border text-audio-text rounded px-2 py-1 text-xs font-mono focus:outline-none"
                  >
                    <option value="PK">PK (Peak)</option>
                    <option value="LS">LS (Low Shelf)</option>
                    <option value="HS">HS (High Shelf)</option>
                    <option value="HP">HP (High Pass)</option>
                    <option value="LP">LP (Low Pass)</option>
                    <option value="NOTCH">NOTCH (Band Stop)</option>
                  </select>

                  {/* Frequency Input */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-audio-muted">Fc:</span>
                    <input
                      type="number"
                      min={20}
                      max={20000}
                      step={10}
                      value={filter.freq}
                      onChange={(e) => handleUpdatePeqFilter(filter.id, { freq: parseFloat(e.target.value) || 1000 })}
                      className="w-16 bg-[#18130F] border border-audio-border rounded px-1.5 py-1 text-xs font-mono text-audio-text"
                    />
                    <span className="text-[9px] font-mono text-audio-muted">Hz</span>
                  </div>

                  {/* Gain Input */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-audio-muted">Gain:</span>
                    <input
                      type="number"
                      min={-18}
                      max={18}
                      step={0.5}
                      value={filter.gain}
                      onChange={(e) => handleUpdatePeqFilter(filter.id, { gain: parseFloat(e.target.value) || 0 })}
                      className="w-14 bg-[#18130F] border border-audio-border rounded px-1.5 py-1 text-xs font-mono text-audio-text"
                    />
                    <span className="text-[9px] font-mono text-audio-muted">dB</span>
                  </div>

                  {/* Q Factor */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-audio-muted">Q:</span>
                    <input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={filter.q}
                      onChange={(e) => handleUpdatePeqFilter(filter.id, { q: parseFloat(e.target.value) || 1.41 })}
                      className="w-14 bg-[#18130F] border border-audio-border rounded px-1.5 py-1 text-xs font-mono text-audio-text"
                    />
                  </div>

                  {/* Delete Button */}
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

          {/* Form-Level Save & Cancel Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-audio-border/60">
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
              <button
                type="button"
                onClick={() => {
                  setWorkbenchState('IDLE');
                  setEditingPresetId(null);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-audio-muted hover:text-audio-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!presetName.trim()}
                className="px-4 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass disabled:opacity-40"
              >
                {editingPresetId ? 'Update Preset' : 'Save EQ Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SAVED PRESETS RACK */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center px-1">
          <Engraved size="xs">
            SAVED HARDWARE EQ LIBRARY ({presets.length})
          </Engraved>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {presets && presets.length > 0 ? (
            presets.map((preset) => (
              <div
                key={preset.id}
                className="p-4 bg-[#140F0C] rounded-xl border border-audio-border hover:border-audio-accent/50 transition-all flex flex-col justify-between group shadow-panel"
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
                  <div className="h-8 bg-[#0C0907] rounded-lg border border-audio-border/60 p-1 flex items-end gap-1 mb-3">
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
            /* EMPTY STATE: Illustrated dashed curve + [+ Create first profile] */
            <div className="col-span-2 text-center py-12 border border-dashed border-audio-border rounded-2xl bg-[#120D0A] flex flex-col items-center justify-center p-6">
              <div className="w-12 h-12 rounded-2xl bg-audio-surface border border-audio-border flex items-center justify-center text-audio-accent mb-3 shadow-panel">
                <EqIcon />
              </div>
              <h3 className="font-display font-bold text-base text-audio-text">Your EQ Library is Ready</h3>
              <p className="text-xs text-audio-muted mt-1 max-w-sm">
                Synthesize custom curves against Crinacle IEF 2025 or paste AutoEQ presets to audition them live.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingPresetId(null);
                  setPresetName('');
                  setHardwareAssigned('');
                  setWorkbenchState('ADDING');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-audio-accent hover:bg-audio-accent-bright text-black font-mono font-bold text-xs shadow-glow-brass flex items-center gap-2 active:scale-95 transition-all"
              >
                <PlusIcon />
                <span>+ Create First EQ Profile</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-3 rounded-xl bg-audio-surface border border-audio-signal/40 text-audio-signal text-xs font-mono shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckIcon />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default EQWorkbench;
