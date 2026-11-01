import React, { useRef } from 'react';
import { SendIcon, PaperclipIcon, MicIcon, StopIcon, XIcon, WaveformIcon } from './Icon';
interface InputConsoleProps {
  input: string;
  isGenerating: boolean;
  isRecording: boolean;
  isAdvancedAnalysis: boolean;
  attachedImage: string | undefined;
  showNoKeyNotice?: boolean;
  onDismissNoKeyNotice?: () => void;
  onOpenKeySettings?: () => void;
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
  onToggleAdvanced: () => void;
  onAutoEQClick: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}
export default function InputConsole(props: InputConsoleProps) {
  const file = useRef<HTMLInputElement>(null);
  const disabled = props.isGenerating || props.isRecording;
  return (
    <div className="composer-dock safe-area-bottom">
      {props.showNoKeyNotice && (
        <div className="mb-2 p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-sm flex items-center justify-between gap-3 text-xs text-amber-200/90 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 w-4 h-4 flex items-center justify-center"><WaveformIcon /></span>
            <span>
              An API key is needed for research chat. Equalizer, Graph Lab, and Gear work offline.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={props.onOpenKeySettings}
              className="px-2.5 py-1 rounded-md bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-mono text-[11px] transition-colors"
            >
              Connect Key →
            </button>
            <button
              type="button"
              onClick={props.onDismissNoKeyNotice}
              className="p-1 text-amber-400/70 hover:text-amber-300"
              aria-label="Dismiss notice"
            >
              <XIcon />
            </button>
          </div>
        </div>
      )}
      <div className="composer">
        {props.attachedImage && (
          <div className="attachment-preview">
            <img src={props.attachedImage} alt="Attached frequency response graph" />
            <span>
              Graph attached<small>Included with your next message</small>
            </span>
            <button className="icon-button" aria-label="Remove attachment" onClick={props.onRemoveImage}>
              <XIcon />
            </button>
          </div>
        )}
        <textarea
          aria-label="Message the research assistant"
          value={props.input}
          onChange={(e) => props.onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !disabled) {
              e.preventDefault();
              props.onSend();
            }
          }}
          placeholder={
            props.isRecording
              ? 'Recording… Stop to send your voice question.'
              : 'Ask about gear, compare an upgrade, or describe your ideal sound…'
          }
          disabled={disabled}
          rows={2}
        />
        <div className="composer-toolbar">
          <div className="composer-tools">
            <button
              className="icon-button"
              onClick={() => file.current?.click()}
              disabled={disabled}
              aria-label="Attach a graph image"
              title="Attach a graph image"
            >
              <PaperclipIcon />
            </button>
            <input
              className="hidden"
              ref={file}
              type="file"
              accept="image/*"
              onChange={(e) => {
                props.onImageUpload(e);
                e.target.value = '';
              }}
            />
            <label className="analysis-select">
              <span className="sr-only">Analysis depth</span>
              <select
                value={props.isAdvancedAnalysis ? 'advanced' : 'standard'}
                onChange={() => props.onToggleAdvanced()}
                disabled={disabled}
              >
                <option value="standard">Everyday advice</option>
                <option value="advanced">Technical analysis</option>
              </select>
            </label>
            <details className="composer-more">
              <summary aria-label="More research tools">More tools ⌄</summary>
              <div className="dropdown-menu">
                <button
                  onClick={(e) => {
                    props.onAutoEQClick();
                    e.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                >
                  Analyze graph & suggest EQ
                </button>
              </div>
            </details>
          </div>
          <div className="composer-send">
            <button
              className={`icon-button ${props.isRecording ? 'recording' : ''}`}
              onClick={props.isRecording ? props.onStopRecording : props.onStartRecording}
              disabled={props.isGenerating}
              aria-label={props.isRecording ? 'Stop recording and send' : 'Record a voice question'}
              title={props.isRecording ? 'Stop recording and send' : 'Record a voice question'}
            >
              {props.isRecording ? <StopIcon /> : <MicIcon />}
            </button>
            <button
              className="send-button"
              onClick={() => props.onSend()}
              disabled={(!props.input.trim() && !props.attachedImage) || disabled}
              aria-label="Send message"
            >
              {props.isGenerating ? (
                <span className="meter-loader">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      </div>
      <p className="composer-hint">
        {props.isRecording
          ? 'Recording your voice. Click stop when you are finished.'
          : props.isGenerating
            ? 'Your assistant is researching. You can explore other tools while you wait.'
            : 'Enter to send · Shift + Enter for a new line · AI answers can contain mistakes.'}
      </p>
    </div>
  );
}
