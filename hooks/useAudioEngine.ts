import { useState, useRef, useEffect, useCallback } from 'react';
import { PEQFilter, PEQFilterType } from '../types';
import { createDSPNode, graphicFilters, safePreamp, DSP_SAMPLE_RATE, filterTypeMap } from '../utils/biquad';

export type AuditionSourceType = 'none' | 'pink-noise' | 'sweep' | 'file' | 'liveTab';

interface UseAudioEngineProps {
  isoBands: number[];
  isoGains: number[];
  peqFilters: PEQFilter[];
  isBypassed: boolean;
}

export const useAudioEngine = ({ isoBands, isoGains, peqFilters, isBypassed }: UseAudioEngineProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSource, setActiveSource] = useState<AuditionSourceType>('none');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [volume, setVolume] = useState(0.7);
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
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass({ sampleRate: DSP_SAMPLE_RATE });
      audioCtxRef.current = ctx;

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
  }, [volume, isBypassed]);

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
            (Math.min(
              safePreamp(nextFilters, ctx.sampleRate),
              externalFiltersRef.current ? externalPreampRef.current : 0,
            ) /
              20),
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
      const headroom = Math.min(
        safePreamp(allFilters, ctx.sampleRate),
        externalFiltersRef.current ? externalPreampRef.current : 0,
      );
      preampGainRef.current?.gain.setTargetAtTime(Math.pow(10, headroom / 20), ctx.currentTime, 0.015);
    },
    [isoBands, isoGains, peqFilters],
  );

  // Rebuild when the number, enabled state, or type of filters changes too.
  const filterSignature = JSON.stringify({ isoBands, isoGains, peqFilters });
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
      dryGainRef.current.gain.linearRampToValueAtTime(1, now + rampTime);
    } else {
      wetGainRef.current.gain.linearRampToValueAtTime(1, now + rampTime);
      dryGainRef.current.gain.linearRampToValueAtTime(0, now + rampTime);
    }
  }, [isBypassed]);

  // Stop playback cleanly
  const stopAudio = useCallback(() => {
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
    osc.frequency.exponentialRampToValueAtTime(20000, now + duration);

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
        const ctx = await getAudioContext();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopAudio]);

  return {
    error,
    isPlaying,
    activeSource,
    fileName,
    isEngineReady,
    volume,
    setVolume,
    playPinkNoise,
    playSineSweep,
    playLiveTab,
    handleFileUpload,
    toggleFilePlayback,
    loadExternalPeq,
    stopAudio,
    getAudioContext,
    audioContext: audioCtxRef.current,
  };
};
