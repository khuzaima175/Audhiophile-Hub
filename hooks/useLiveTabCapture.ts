import { useState, useRef, useCallback, useEffect } from 'react';
import { LiveTabTelemetry } from '../types';

export interface UseLiveTabCaptureProps {
  onStreamAvailable: (streamNode: MediaStreamAudioSourceNode, stream: MediaStream) => void;
  onStreamEnded: () => void;
  audioContext: AudioContext | null;
}

export const isChromiumBrowser = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg') && !userAgent.includes('opr');
  const isEdge = userAgent.includes('edg');
  const isBrave = (navigator as any).brave !== undefined;
  const isOpera = userAgent.includes('opr') || userAgent.includes('opera');
  return isChrome || isEdge || isBrave || isOpera;
};

export const isTabAudioSupported = (): boolean => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return false;
  return isChromiumBrowser();
};

export const useLiveTabCapture = ({
  onStreamAvailable,
  onStreamEnded,
  audioContext,
}: UseLiveTabCaptureProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFeedbackGuard, setShowFeedbackGuard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<LiveTabTelemetry>({
    isActive: false,
    latencyMs: 23,
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const streamNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Clean disconnect teardown
  const stopTabCapture = useCallback(() => {
    if (streamNodeRef.current) {
      try {
        streamNodeRef.current.disconnect();
      } catch (e) {}
      streamNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      mediaStreamRef.current = null;
    }

    setIsCapturing(false);
    setTelemetry((prev) => ({ ...prev, isActive: false }));
    onStreamEnded();
  }, [onStreamEnded]);

  // Actual getDisplayMedia capture execution
  const executeCapture = useCallback(async (ctx: AudioContext) => {
    setError(null);
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Request raw, un-enhanced audio stream from browser tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required by browser API to show tab picker
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
      });

      // 1. Immediately kill video track to prevent GPU rendering overhead
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach((vt) => vt.stop());

      // 2. Validate audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track selected. Make sure "Also share tab audio" checkbox is checked in the browser dialog.');
      }

      const audioTrack = audioTracks[0];
      const trackLabel = audioTrack.label || 'Tab Audio Stream';

      // 3. Listen for browser bar "Stop sharing" event
      audioTrack.onended = () => {
        stopTabCapture();
      };

      // 4. Create Web Audio source node
      const sourceNode = ctx.createMediaStreamSource(stream);
      streamNodeRef.current = sourceNode;
      mediaStreamRef.current = stream;

      // Calculate latency: baseLatency + outputLatency (typically 18-25ms)
      const baseLat = (ctx as any).baseLatency || 0.01;
      const outLat = (ctx as any).outputLatency || 0.013;
      const totalLatencyMs = Math.round((baseLat + outLat) * 1000);

      setIsCapturing(true);
      setTelemetry({
        isActive: true,
        latencyMs: totalLatencyMs,
        streamTitle: trackLabel,
        sampleRate: ctx.sampleRate,
        audioTracks: audioTracks.length,
      });

      onStreamAvailable(sourceNode, stream);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        // User cancelled picker dialog
        setError(null);
      } else {
        setError(err.message || 'Failed to capture tab audio');
      }
      stopTabCapture();
    } finally {
      setShowFeedbackGuard(false);
    }
  }, [onStreamAvailable, stopTabCapture]);

  // Trigger modal feedback guard before capturing
  const startTabCapture = useCallback(() => {
    if (!isTabAudioSupported()) {
      setError('Live Tab audio capture is supported in Chromium browsers (Chrome, Edge, Brave, Opera).');
      return;
    }
    setShowFeedbackGuard(true);
  }, []);

  const confirmFeedbackGuard = useCallback(async () => {
    setShowFeedbackGuard(false);
    if (audioContext) {
      await executeCapture(audioContext);
    }
  }, [audioContext, executeCapture]);

  const dismissFeedbackGuard = useCallback(() => {
    setShowFeedbackGuard(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTabCapture();
    };
  }, [stopTabCapture]);

  return {
    isCapturing,
    showFeedbackGuard,
    error,
    telemetry,
    startTabCapture,
    stopTabCapture,
    confirmFeedbackGuard,
    dismissFeedbackGuard,
    isSupported: isTabAudioSupported(),
  };
};
