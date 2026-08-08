import React, { useState } from 'react';
import Led from './ui/Led';
import Engraved from './ui/Engraved';

interface ErrorCardProps {
  errorText: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  errorText,
  onRetry,
  onOpenSettings,
}) => {
  const [showRawError, setShowRawError] = useState(false);

  // Clean the error message: remove literal '\n' escaping, sanitize text
  const cleanErrorText = errorText
    .replace(/\\n/g, '\n')
    .replace(/\*\*Connection Error\*\*:\s*/i, '');

  const isApiKeyIssue =
    cleanErrorText.toLowerCase().includes('api key') ||
    cleanErrorText.toLowerCase().includes('quota') ||
    cleanErrorText.toLowerCase().includes('429') ||
    cleanErrorText.toLowerCase().includes('resource_exhausted') ||
    cleanErrorText.toLowerCase().includes('invalid api');

  return (
    <div className="w-full my-3 animate-in fade-in duration-200">
      <div className="panel border-l-4 border-l-[#E06A3F] border-audio-border bg-[#160E0B] p-4 md:p-5 rounded-xl shadow-panel">
        {/* Header with Red LED */}
        <div className="flex items-center justify-between mb-3 border-b border-audio-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Led color="red" pulse size="md" />
            <Engraved size="xs" className="text-[#E06A3F] font-bold tracking-wider">
              {isApiKeyIssue ? 'SIGNAL FAULT — GEMINI API KEY REQUIRED' : 'TRANSMISSION ERROR'}
            </Engraved>
          </div>
          <span className="font-mono text-[9px] text-[#E06A3F]/80 uppercase bg-[#E06A3F]/10 px-2 py-0.5 rounded border border-[#E06A3F]/30 font-bold">
            ERROR CODE 401 / 429
          </span>
        </div>

        {/* Body explanation */}
        <div className="text-xs md:text-sm text-audio-text/90 leading-relaxed space-y-2 mb-4 font-sans">
          {isApiKeyIssue ? (
            <>
              <p>
                The AudioSage neural engine could not connect to Gemini models. Your API key may be missing, expired, or quota-limited.
              </p>
              <p className="text-audio-muted text-xs">
                To fix this, open Settings below and paste a free Gemini API key from Google AI Studio, then test connection.
              </p>
            </>
          ) : (
            <p className="whitespace-pre-line text-audio-text/90">
              {cleanErrorText.slice(0, 300)}
            </p>
          )}
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-audio-border/50">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-1.5 rounded-lg bg-audio-accent hover:bg-audio-accent-bright active:scale-95 text-black font-semibold text-xs font-mono transition-all shadow-glow-brass"
            >
              ⟳ Retry Transmission
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3.5 py-1.5 rounded-lg bg-audio-surface hover:bg-audio-highlight border border-audio-accent/50 text-audio-accent hover:border-audio-accent text-xs font-mono transition-colors font-medium"
            >
              ⚙ Open API Settings
            </button>
          )}

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-audio-muted hover:text-audio-text text-xs font-mono transition-colors inline-flex items-center gap-1"
          >
            <span>Get Free Key</span>
            <span>↗</span>
          </a>

          <button
            type="button"
            onClick={() => setShowRawError(!showRawError)}
            className="ml-auto text-[10px] font-mono text-audio-muted hover:text-audio-text underline underline-offset-2"
          >
            {showRawError ? 'Hide Telemetry' : 'View Raw Error'}
          </button>
        </div>

        {/* Collapsible Raw Error Telemetry */}
        {showRawError && (
          <div className="mt-3 p-3 rounded-lg bg-black/60 border border-audio-border text-[10px] font-mono text-audio-muted/90 whitespace-pre-wrap break-all select-all">
            {cleanErrorText}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorCard;
