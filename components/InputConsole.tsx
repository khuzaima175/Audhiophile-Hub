import React, { useRef } from 'react';
import { SendIcon, PaperclipIcon, MicIcon, StopIcon, EqIcon, ActivityIcon, XIcon } from './Icon';
import Led from './ui/Led';

interface InputConsoleProps {
  input: string;
  isGenerating: boolean;
  isRecording: boolean;
  isAdvancedAnalysis: boolean;
  attachedImage: string | undefined;
  onInputChange: (val: string) => void;
  onSend: (textOverride?: string) => void;
  onToggleAdvanced: () => void;
  onAutoEQClick: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const InputConsole: React.FC<InputConsoleProps> = ({
  input,
  isGenerating,
  isRecording,
  isAdvancedAnalysis,
  attachedImage,
  onInputChange,
  onSend,
  onToggleAdvanced,
  onAutoEQClick,
  onImageUpload,
  onRemoveImage,
  onStartRecording,
  onStopRecording,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const isSendDisabled = (!input.trim() && !attachedImage) || isGenerating || isRecording;

  return (
    <div className="p-3 md:p-5 bg-[#120D0A] border-t border-audio-border safe-area-bottom w-full min-w-0 flex-shrink-0">
      <div className="max-w-4xl mx-auto relative group w-full">
        {/* HARDWARE SEGMENTED SWITCHES & TOOLBAR */}
        <div className="mb-2.5 flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach Frequency Response graph or measurement image"
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 select-none ${
                attachedImage
                  ? 'bg-audio-accent/20 border-audio-accent text-audio-accent shadow-glow-brass'
                  : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-text hover:border-audio-muted'
              }`}
            >
              <PaperclipIcon />
              <span>{attachedImage ? 'Graph Attached' : 'Attach FR'}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImageUpload}
              className="hidden"
              accept="image/*"
            />

            {/* Segmented Switch: Technical Analysis */}
            <button
              type="button"
              onClick={onToggleAdvanced}
              title="Enable Senior Audio Engineer mode (THD, SINAD, Impulse Response, Group Delay)"
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 select-none ${
                isAdvancedAnalysis
                  ? 'bg-audio-signal/15 border-audio-signal text-audio-signal shadow-glow-teal font-semibold'
                  : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-text hover:border-audio-muted'
              }`}
            >
              <ActivityIcon />
              <span>Tech Analysis</span>
              <Led
                color={isAdvancedAnalysis ? 'teal' : 'muted'}
                pulse={isAdvancedAnalysis}
                size="sm"
              />
            </button>

            {/* Segmented Switch: Auto-EQ */}
            <button
              type="button"
              onClick={onAutoEQClick}
              title="Target Crinacle IEF 2025 Preference curve"
              className="px-3 py-1.5 rounded-lg border border-audio-accent/40 bg-audio-surface text-audio-accent hover:bg-audio-accent hover:text-black transition-all flex items-center gap-1.5 text-xs font-mono font-medium select-none"
            >
              <EqIcon />
              <span>Auto-EQ Target</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono text-audio-muted/70 tracking-widest uppercase">
            <span>20HZ—20KHZ REFERENCE</span>
          </div>
        </div>

        {/* ATTACHMENT PREVIEW */}
        {attachedImage && (
          <div className="mb-3 flex items-center gap-2 p-2 rounded-xl bg-audio-surface border border-audio-accent/60 max-w-xs shadow-lg animate-in slide-in-from-bottom-2">
            <img
              src={attachedImage}
              alt="FR Graph preview"
              className="h-12 w-16 object-cover rounded-lg border border-audio-border bg-black"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-audio-accent font-mono truncate">
                Graph Ready
              </div>
              <div className="text-[10px] text-audio-muted truncate">
                Will parse against Crinacle IEF 2025
              </div>
            </div>
            <button
              type="button"
              onClick={onRemoveImage}
              className="p-1 text-audio-muted hover:text-audio-warn rounded-lg"
              title="Remove attachment"
            >
              <XIcon />
            </button>
          </div>
        )}

        {/* INPUT WRAPPER */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? 'Recording acoustic query... (click Stop to transmit)'
                : isAdvancedAnalysis
                ? 'Query technical parameters (e.g. SINAD, Group Delay, 8kHz Sibilance notch)...'
                : 'Ask about IEM shootouts, soundstage, Crinacle IEF 2025 EQ...'
            }
            disabled={isGenerating || isRecording}
            className={`w-full bg-[#1A1410] text-audio-text placeholder-audio-muted/60 border rounded-xl py-3.5 pl-4 pr-24 focus:outline-none transition-all shadow-panel font-sans text-sm ${
              isAdvancedAnalysis
                ? 'border-audio-signal/50 focus:border-audio-signal focus:ring-1 focus:ring-audio-signal/40'
                : isRecording
                ? 'border-audio-warn/60 ring-1 ring-audio-warn/40'
                : 'border-audio-border focus:border-audio-accent focus:ring-1 focus:ring-audio-accent/40'
            }`}
          />

          {/* Action buttons inside right of input */}
          <div className="absolute right-2 flex items-center gap-1.5">
            {/* Voice Input Button */}
            <button
              type="button"
              onClick={isRecording ? onStopRecording : onStartRecording}
              className={`p-2 rounded-lg transition-all duration-150 ${
                isRecording
                  ? 'bg-audio-warn text-black animate-pulse shadow-lg'
                  : 'text-audio-muted hover:text-audio-text hover:bg-audio-surface'
              }`}
              title={isRecording ? 'Stop Recording' : 'Voice Query'}
            >
              {isRecording ? <StopIcon /> : <MicIcon />}
            </button>

            {/* Circular Send Button with Brass Glow */}
            <button
              type="button"
              onClick={() => onSend()}
              disabled={isSendDisabled}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                !isSendDisabled
                  ? 'bg-audio-accent text-black hover:bg-audio-accent-bright shadow-glow-brass cursor-pointer active:scale-95'
                  : 'bg-[#2A221B] text-audio-muted/30 cursor-not-allowed'
              }`}
              title="Transmit Query"
            >
              <SendIcon />
            </button>
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="text-center mt-2 flex justify-center items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-audio-accent/50" />
          <p className="text-[9px] text-audio-muted/70 font-mono tracking-widest uppercase">
            B&amp;K 5128 TARGET · GOOGLE GROUNDING · LOCAL RAG
          </p>
          <span className="w-1 h-1 rounded-full bg-audio-accent/50" />
        </div>
      </div>
    </div>
  );
};

export default InputConsole;
