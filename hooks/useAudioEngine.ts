import { createStereoChain, stereoPreamp } from '../utils/stereoEq';
import { effectivePreamp, claimPlayback, releasePlayback } from '../utils/audioPolicy';
import { useState, useRef, useEffect, useCallback } from 'react';
import { PEQFilter, PEQFilterType, StereoFilters } from '../types';
import { createDSPNode, graphicFilters, safePreamp, DSP_SAMPLE_RATE, filterTypeMap } from '../utils/biquad';

export type AuditionSourceType = 'none' | 'tone' | 'pink-noise' | 'sweep' | 'file' | 'liveTab';

interface UseAudioEngineProps {
  stereoFilters?: StereoFilters|null;
  isoBands: number[];
  isoGains: number[];
  peqFilters: PEQFilter[];
  isBypassed: boolean;
  requestedPreamp?: number;
  preampMode?: 'automatic' | 'manual';
  intendedSampleRate?: number;
  levelMatched?: boolean;
}

export const useAudioEngine = ({ stereoFilters=null, isoBands, isoGains, peqFilters, isBypassed, requestedPreamp = 0, preampMode = 'automatic', intendedSampleRate = DSP_SAMPLE_RATE, levelMatched = false }: UseAudioEngineProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSource, setActiveSource] = useState<AuditionSourceType>('none');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const lease = useRef({});
  const stopRef = useRef<() => void>(() => {});
  const epoch = useRef(0);
  const [sampleRate, setSampleRate] = useState(intendedSampleRate);
  const [matchDb, setMatchDb] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);
  const sweepOscRef = useRef<OscillatorNode | null>(null);
  const filterNodesRef = useRef<AudioNode[]>([]);
  const chainInputRef = useRef<AudioNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const customAudioBufferRef = useRef<AudioBuffer | null>(null);
  const preampGainRef = useRef<GainNode | null>(null);
  const externalFiltersRef = useRef<PEQFilter[] | null>(null);
  const externalPreampRef = useRef(0);

  // Lazy initialize AudioContext with browser autoplay policy compliance
  const getAudioContext = useCallback(async (): Promise<AudioContext> => {
    claimPlayback(lease.current, () => { stopRef.current(); window.dispatchEvent(new CustomEvent('audiosage-playback-switch', { detail: audioCtxRef.current })); });
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass({ sampleRate: intendedSampleRate });
      audioCtxRef.current = ctx;
      setSampleRate(ctx.sampleRate);

      // Master output gain
      const master = ctx.createGain();
      master.gain.setValueAtTime(volume, ctx.currentTime);
      master.connect(ctx.destination);
      masterGainRef.current = master;

      // Wet & Dry crossfade gains for zero-pop A/B bypass
      const wet = ctx.createGain();
      const dry = ctx.createGain();
      wet.gain.setValueAtTime(isBypassed ? 0 : 1, ctx.currentTime);
      dry.gain.setValueAtTime(isBypassed ? 1 : 0, ctx.currentTime);

      wet.connect(master);
      dry.connect(master);
      wetGainRef.current = wet;
      dryGainRef.current = dry;
      const preamp = ctx.createGain();
      preamp.connect(wet);
      preampGainRef.current = preamp;

      setIsEngineReady(true);
    }

    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    return audioCtxRef.current;
  }, [volume, isBypassed, intendedSampleRate]);

  // Generate 5-second seamless Voss-McCartney pink noise buffer
  const createPinkNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    const bufferSize = ctx.sampleRate * 5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    return buffer;
  };

  // Build filter chain in AudioContext
  const rebuildFilterChain = useCallback(
    (ctx: AudioContext, inputNode: AudioNode) => {
      if(stereoFilters && !externalFiltersRef.current) {
        inputNode.disconnect();filterNodesRef.current.forEach(n=>n.disconnect());
        const chain=createStereoChain(ctx,inputNode,stereoFilters);
        chain.output.connect(preampGainRef.current!);inputNode.connect(dryGainRef.current!);
        preampGainRef.current!.gain.setTargetAtTime(10**(stereoPreamp(stereoFilters,preampMode,requestedPreamp,ctx.sampleRate)/20),ctx.currentTime,.015);
        filterNodesRef.current=chain.nodes;chainInputRef.current=inputNode;return;
      }
      const nextFilters = [
        ...graphicFilters(isoBands, isoGains),
        ...(externalFiltersRef.current ?? peqFilters),
      ].filter((f) => f.enabled !== false);
      const existing = filterNodesRef.current;
      if (
        existing.length === nextFilters.length &&
        existing.length > 0 &&
        existing.every(
          (node, i) => node instanceof BiquadFilterNode && node.type === filterTypeMap[nextFilters[i].type],
        )
      ) {
        existing.forEach((audioNode, i) => {
          const node = audioNode as BiquadFilterNode,
            f = nextFilters[i];
          node.frequency.setTargetAtTime(f.freq, ctx.currentTime, 0.015);
          node.gain.setTargetAtTime(f.gain, ctx.currentTime, 0.015);
          node.Q.setTargetAtTime(
            f.type === 'HP' || f.type === 'LP' ? 20 * Math.log10(f.q) : f.q,
            ctx.currentTime,
            0.015,
          );
        });
        preampGainRef.current?.gain.setTargetAtTime(
          10 **
            (effectivePreamp(nextFilters, externalFiltersRef.current ? 'manual' : preampMode, externalFiltersRef.current ? externalPreampRef.current : requestedPreamp, ctx.sampleRate) / 20),
          ctx.currentTime,
          0.015,
        );
        // Only reuse the chain when this is the same active source.
        if (chainInputRef.current === inputNode) return;
      }
      inputNode.disconnect();
      chainInputRef.current = inputNode;
      // Disconnect old filter chain
      filterNodesRef.current.forEach((n) => {
        try {
          n.disconnect();
        } catch (e) {}
      });
      filterNodesRef.current = [];

      const activeFilters = externalFiltersRef.current ?? peqFilters;
      const allFilters = [...graphicFilters(isoBands, isoGains), ...activeFilters].filter(
        (f) => f.enabled !== false,
      );
      const nodes = allFilters.map((f) => createDSPNode(ctx, f));

      // Connect cascade: inputNode -> Node1 -> Node2 ... -> wetGain
      if (nodes.length > 0) {
        inputNode.connect(nodes[0]);
        for (let i = 0; i < nodes.length - 1; i++) {
          nodes[i].connect(nodes[i + 1]);
        }
        if (preampGainRef.current) {
          nodes[nodes.length - 1].connect(preampGainRef.current);
        }
      } else {
        if (preampGainRef.current) {
          inputNode.connect(preampGainRef.current);
        }
      }

      // Direct connection to dry gain for zero-pop A/B bypass
      if (dryGainRef.current) {
        inputNode.connect(dryGainRef.current);
      }

      filterNodesRef.current = nodes;
      const headroom = effectivePreamp(allFilters, externalFiltersRef.current ? 'manual' : preampMode, externalFiltersRef.current ? externalPreampRef.current : requestedPreamp, ctx.sampleRate);
      preampGainRef.current?.gain.setTargetAtTime(Math.pow(10, headroom / 20), ctx.currentTime, 0.015);
    },
    [stereoFilters, isoBands, isoGains, peqFilters, requestedPreamp, preampMode],
  );

  // Rebuild when the number, enabled state, or type of filters changes too.
  const filterSignature = JSON.stringify({ stereoFilters, isoBands, isoGains, peqFilters, requestedPreamp, preampMode });
  useEffect(() => {
    if (audioCtxRef.current && sourceNodeRef.current)
      rebuildFilterChain(audioCtxRef.current, sourceNodeRef.current);
  }, [filterSignature]);

  useEffect(() => {
    if (audioCtxRef.current && masterGainRef.current)
      masterGainRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.015);
  }, [volume]);

  // Smooth A/B bypass crossfade
  useEffect(() => {
    if (!audioCtxRef.current || !wetGainRef.current || !dryGainRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const rampTime = 0.03; // 30ms anti-pop linear crossfade

    if (isBypassed) {
      wetGainRef.current.gain.linearRampToValueAtTime(0, now + rampTime);
      dryGainRef.current.gain.linearRampToValueAtTime(levelMatched && matchDb !== null ? 10 ** (matchDb / 20) : 1, now + rampTime);
    } else {
      wetGainRef.current.gain.linearRampToValueAtTime(1, now + rampTime);
      dryGainRef.current.gain.linearRampToValueAtTime(0, now + rampTime);
    }
  }, [isBypassed, levelMatched, matchDb]);

  // Stop playback cleanly
  const stopAudio = useCallback(() => {
    epoch.current++;
    setMatchDb(null);
    if (sourceNodeRef.current) {
      try {
        (sourceNodeRef.current as any).stop?.();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (sweepOscRef.current) {
      try {
        sweepOscRef.current.stop();
        sweepOscRef.current.disconnect();
      } catch (e) {}
      sweepOscRef.current = null;
    }
    setIsPlaying(false);
    setActiveSource('none');
  }, []);

  stopRef.current = stopAudio;

  // Play live tab audio stream
  const playLiveTab = useCallback(
    async (sourceNode: MediaStreamAudioSourceNode) => {
      stopAudio();
      const ctx = await getAudioContext();
      sourceNodeRef.current = sourceNode;
      rebuildFilterChain(ctx, sourceNode);
      setIsPlaying(true);
      setActiveSource('liveTab');
    },
    [getAudioContext, rebuildFilterChain, stopAudio],
  );

  // Play pink noise
  const playPinkNoise = useCallback(async () => {
    if (isPlaying && activeSource === 'pink-noise') {
      stopAudio();
      return;
    }
    stopAudio();

    const ctx = await getAudioContext();
    const buffer = createPinkNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    rebuildFilterChain(ctx, source);
    source.start();
    sourceNodeRef.current = source;
    setIsPlaying(true);
    setActiveSource('pink-noise');
  }, [isPlaying, activeSource, getAudioContext, rebuildFilterChain, stopAudio]);

  const setToneFrequency = useCallback((frequency: number) => {
    const ctx = audioCtxRef.current, oscillator = sweepOscRef.current;
    if (ctx && oscillator && Number.isFinite(frequency)) oscillator.frequency.setTargetAtTime(Math.max(20,Math.min(20000,ctx.sampleRate/2-1,frequency)),ctx.currentTime,.015);
  }, []);
  const playTone = useCallback(async (frequency: number) => {
    stopAudio(); const requestEpoch = epoch.current;
    const ctx = await getAudioContext();
    if (requestEpoch !== epoch.current) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = Math.max(20,Math.min(20000,ctx.sampleRate/2-1,frequency));
    gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.05,ctx.currentTime+.03);
    oscillator.connect(gain);rebuildFilterChain(ctx,gain);
    sourceNodeRef.current = gain; sweepOscRef.current = oscillator;
    oscillator.start(); setActiveSource('tone');setIsPlaying(true);
  }, [stopAudio,getAudioContext,rebuildFilterChain]);

  // Play logarithmic frequency sine sweep (20Hz to 20kHz over 6 seconds)
  const playSineSweep = useCallback(async () => {
    if (isPlaying && activeSource === 'sweep') {
      stopAudio();
      return;
    }
    stopAudio();

    const ctx = await getAudioContext();
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.18, ctx.currentTime);

    osc.type = 'sine';
    const now = ctx.currentTime;
    const duration = 6.0;

    osc.frequency.setValueAtTime(20, now);
    osc.frequency.exponentialRampToValueAtTime(Math.min(20000, ctx.sampleRate / 2 - 1), now + duration);

    osc.connect(oscGain);
    rebuildFilterChain(ctx, oscGain);

    osc.start(now);
    osc.stop(now + duration);
    osc.onended = () => {
      if (sweepOscRef.current !== osc) return;
      sweepOscRef.current = null;
      setIsPlaying(false);
      setActiveSource('none');
    };

    sweepOscRef.current = osc;
    sourceNodeRef.current = oscGain;
    setIsPlaying(true);
    setActiveSource('sweep');
  }, [isPlaying, activeSource, getAudioContext, rebuildFilterChain, stopAudio]);

  // Handle local track upload and playback
  const handleFileUpload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        stopAudio();
        const requestEpoch = epoch.current;
        const ctx = await getAudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (requestEpoch !== epoch.current) return;
        customAudioBufferRef.current = audioBuffer;
        setFileName(file.name);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;

        rebuildFilterChain(ctx, source);
        source.start();
        sourceNodeRef.current = source;
        setIsPlaying(true);
        setActiveSource('file');
      } catch {
        stopAudio();
        setError('This audio file could not be decoded. Try a supported WAV, MP3 or OGG file.');
      }
    },
    [getAudioContext, rebuildFilterChain, stopAudio],
  );

  const toggleFilePlayback = useCallback(async () => {
    if (!customAudioBufferRef.current) return;
    if (isPlaying && activeSource === 'file') {
      stopAudio();
      return;
    }
    stopAudio();
    const ctx = await getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = customAudioBufferRef.current;
    source.loop = true;

    rebuildFilterChain(ctx, source);
    source.start();
    sourceNodeRef.current = source;
    setIsPlaying(true);
    setActiveSource('file');
  }, [isPlaying, activeSource, getAudioContext, rebuildFilterChain, stopAudio]);

  // Load external PEQ filters dynamically (e.g. from Graph Lab Audition Delta)
  const loadExternalPeq = useCallback(
    async (filters: PEQFilter[], preamp?: number) => {
      const ctx = await getAudioContext();
      externalFiltersRef.current = filters;
      externalPreampRef.current = preamp ?? 0;
      if (sourceNodeRef.current) rebuildFilterChain(ctx, sourceNodeRef.current);
    },
    [getAudioContext, rebuildFilterChain],
  );

  const clearExternalPeq = useCallback(() => { externalFiltersRef.current=null;externalPreampRef.current=0; }, []);

  // File comparison: first ten seconds, RMS over all channels, attenuation-only dry matching.
  useEffect(() => {
    setMatchDb(null);
    if (!levelMatched || activeSource !== 'file' || !customAudioBufferRef.current) return;
    let canceled = false;
    const timer = setTimeout(async () => {
      const buffer = customAudioBufferRef.current!, rate = audioCtxRef.current?.sampleRate || sampleRate;
      const length = Math.min(buffer.length, Math.floor(rate * 10));
      try {
        const offline = new OfflineAudioContext(stereoFilters ? 2 : buffer.numberOfChannels, length, rate);
        const source = offline.createBufferSource(); source.buffer = buffer;
        const filters = [...graphicFilters(isoBands, isoGains), ...(externalFiltersRef.current ?? peqFilters)].filter(f => f.enabled !== false);
        let tail: AudioNode = source;
        if(stereoFilters && !externalFiltersRef.current)tail=createStereoChain(offline,source,stereoFilters).output;
        else filters.forEach(f => { const node = createDSPNode(offline as unknown as AudioContext, f); tail.connect(node); tail = node; });
        const preamp = offline.createGain(); preamp.gain.value = 10 ** ((stereoFilters && !externalFiltersRef.current ? stereoPreamp(stereoFilters,preampMode,requestedPreamp,rate) : effectivePreamp(filters, preampMode, requestedPreamp, rate)) / 20); tail.connect(preamp); preamp.connect(offline.destination); source.start();
        const rendered = await offline.startRendering();
        let dry = 0, wet = 0;
        for (let c = 0; c < rendered.numberOfChannels; c++) {
          const a = buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1)), b = rendered.getChannelData(c);
          for (let i = 0; i < length; i++) { dry += a[i] ** 2; wet += b[i] ** 2; }
        }
        const db = 10 * Math.log10(wet / dry);
        if (!canceled && Number.isFinite(db) && db <= 0) setMatchDb(Math.max(-24, db));
      } catch { if (!canceled) setMatchDb(null); }
    }, 250);
    return () => { canceled = true; clearTimeout(timer); };
  }, [levelMatched, activeSource, fileName, filterSignature, sampleRate]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudio();
      releasePlayback(lease.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopAudio]);

  return {
    error,
    sampleRate,
    matchDb,
    isPlaying,
    activeSource,
    fileName,
    isEngineReady,
    volume,
    setVolume,
    playPinkNoise,
    playSineSweep,
    playTone, setToneFrequency,
    playLiveTab,
    handleFileUpload,
    toggleFilePlayback,
    loadExternalPeq, clearExternalPeq,
    stopAudio,
    getAudioContext,
    audioContext: audioCtxRef.current,
  };
};
