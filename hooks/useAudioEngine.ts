import { useState, useRef, useEffect, useCallback } from 'react';
import { PEQFilter, PEQFilterType } from '../types';

export type AuditionSourceType = 'none' | 'pink-noise' | 'sweep' | 'file' | 'liveTab';

interface UseAudioEngineProps {
  isoBands: number[];
  isoGains: number[];
  peqFilters: PEQFilter[];
  isBypassed: boolean;
}

export const useAudioEngine = ({
  isoBands,
  isoGains,
  peqFilters,
  isBypassed,
}: UseAudioEngineProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSource, setActiveSource] = useState<AuditionSourceType>('none');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [volume, setVolume] = useState(0.7);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);
  const sweepOscRef = useRef<OscillatorNode | null>(null);
  const filterNodesRef = useRef<BiquadFilterNode[]>([]);
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const customAudioBufferRef = useRef<AudioBuffer | null>(null);

  // Lazy initialize AudioContext with browser autoplay policy compliance
  const getAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
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

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    return buffer;
  };

  // Build filter chain in AudioContext
  const rebuildFilterChain = useCallback((ctx: AudioContext, inputNode: AudioNode) => {
    // Disconnect old filter chain
    filterNodesRef.current.forEach((n) => {
      try {
        n.disconnect();
      } catch (e) {}
    });
    filterNodesRef.current = [];

    const nodes: BiquadFilterNode[] = [];

    // 1. Add ISO Graphic EQ Filters
    const isoQ = isoBands.length === 31 ? 4.3 : isoBands.length === 15 ? 2.0 : 1.41;
    isoBands.forEach((freq, idx) => {
      const gain = isoGains[idx] || 0;
      const bq = ctx.createBiquadFilter();
      bq.type = 'peaking';
      bq.frequency.setValueAtTime(freq, ctx.currentTime);
      bq.Q.setValueAtTime(isoQ, ctx.currentTime);
      bq.gain.setValueAtTime(gain, ctx.currentTime);
      nodes.push(bq);
    });

    // 2. Add Parametric EQ Filters
    peqFilters.forEach((f) => {
      if (f.enabled !== false) {
        const bq = ctx.createBiquadFilter();
        const typeMap: Record<PEQFilterType, BiquadFilterType> = {
          PK: 'peaking',
          LS: 'lowshelf',
          HS: 'highshelf',
          HP: 'highpass',
          LP: 'lowpass',
          NOTCH: 'notch',
        };
        bq.type = typeMap[f.type] || 'peaking';
        bq.frequency.setValueAtTime(f.freq, ctx.currentTime);
        bq.gain.setValueAtTime(f.gain || 0, ctx.currentTime);
        bq.Q.setValueAtTime(f.q || 1.41, ctx.currentTime);
        nodes.push(bq);
      }
    });

    // Connect cascade: inputNode -> Node1 -> Node2 ... -> wetGain
    if (nodes.length > 0) {
      inputNode.connect(nodes[0]);
      for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].connect(nodes[i + 1]);
      }
      if (wetGainRef.current) {
        nodes[nodes.length - 1].connect(wetGainRef.current);
      }
    } else {
      if (wetGainRef.current) {
        inputNode.connect(wetGainRef.current);
      }
    }

    // Direct connection to dry gain for zero-pop A/B bypass
    if (dryGainRef.current) {
      inputNode.connect(dryGainRef.current);
    }

    filterNodesRef.current = nodes;
  }, [isoBands, isoGains, peqFilters]);

  // Real-time parameter sync without audio glitching
  useEffect(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    // Update ISO bands
    const isoQ = isoBands.length === 31 ? 4.3 : isoBands.length === 15 ? 2.0 : 1.41;
    isoBands.forEach((_, idx) => {
      if (filterNodesRef.current[idx]) {
        const targetGain = isoGains[idx] || 0;
        filterNodesRef.current[idx].gain.setTargetAtTime(targetGain, ctx.currentTime, 0.015);
        filterNodesRef.current[idx].Q.setTargetAtTime(isoQ, ctx.currentTime, 0.015);
      }
    });
  }, [isoGains, isoBands]);

  // Real-time update for PEQ filter nodes
  useEffect(() => {
    if (!audioCtxRef.current || filterNodesRef.current.length === 0) return;
    const ctx = audioCtxRef.current;
    const offset = isoBands.length;

    peqFilters.forEach((filter, idx) => {
      const node = filterNodesRef.current[offset + idx];
      if (node && filter.enabled !== false) {
        node.frequency.setTargetAtTime(filter.freq, ctx.currentTime, 0.015);
        node.gain.setTargetAtTime(filter.gain || 0, ctx.currentTime, 0.015);
        node.Q.setTargetAtTime(filter.q || 1.41, ctx.currentTime, 0.015);
      }
    });
  }, [peqFilters, isoBands]);

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
  const playLiveTab = useCallback(async (sourceNode: MediaStreamAudioSourceNode) => {
    stopAudio();
    const ctx = await getAudioContext();
    sourceNodeRef.current = sourceNode;
    rebuildFilterChain(ctx, sourceNode);
    setIsPlaying(true);
    setActiveSource('liveTab');
  }, [getAudioContext, rebuildFilterChain, stopAudio]);

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
      setIsPlaying(false);
      setActiveSource('none');
    };

    sweepOscRef.current = osc;
    sourceNodeRef.current = oscGain;
    setIsPlaying(true);
    setActiveSource('sweep');
  }, [isPlaying, activeSource, getAudioContext, rebuildFilterChain, stopAudio]);

  // Handle local track upload and playback
  const handleFileUpload = useCallback(async (file: File) => {
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
  }, [getAudioContext, rebuildFilterChain, stopAudio]);

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
    stopAudio,
    getAudioContext,
    audioContext: audioCtxRef.current,
  };
};

