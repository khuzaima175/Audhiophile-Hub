import React, { useState, useMemo } from 'react';
import { Message } from '../types';
import { LinkIcon, CheckIcon, CopyIcon, BookmarkIcon, WaveformIcon, ActivityIcon, MapIcon } from './Icon';
import { highlightGlossaryTerms } from './GlossaryTooltip';
import ErrorCard from './ErrorCard';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import FRGraph from './FRGraph';

interface MessageBubbleProps {
  message: Message;
  activeModel?: string;
  onVerify?: (content: string) => void;
  onSaveToNotes?: (note: string) => void;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  activeModel = 'GEMINI 3.6 FLASH',
  onVerify,
  onSaveToNotes,
  onRetry,
  onOpenSettings,
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const rawText = typeof message.text === 'string' ? message.text : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSaveToNotes = () => {
    if (onSaveToNotes && rawText) {
      const note = rawText.substring(0, 200).split('\n')[0];
      onSaveToNotes(note);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Extract embedded frequency response dataset if returned
  const parsedFrData = useMemo(() => {
    if (!rawText || isUser) return null;
    const match = rawText.match(/```json:fr_data\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed && Array.isArray(parsed.curves) && parsed.curves.length > 0) {
          return parsed as { title?: string; curves: { name: string; color: string; points: { freq: number; gain: number }[] }[] };
        }
      } catch (e) {
        console.warn('Failed to parse fr_data JSON block:', e);
      }
    }
    return null;
  }, [rawText, isUser]);

  // Clean raw fr_data JSON from displayed markdown so user only sees clean analysis & chart
  const cleanMessageText = useMemo(() => {
    if (!rawText) return '';
    return rawText.replace(/```json:fr_data[\s\S]*?```/g, '').trim();
  }, [rawText]);

  // Check if message has frequency response data or comparison shootout
  const hasFrequencyData =
    !isUser &&
    !message.isThinking &&
    (parsedFrData !== null ||
      rawText.includes('GraphicEQ:') ||
      rawText.includes('Auto-EQ'));

  // Check if message is an error response
  const isErrorMessage =
    !isUser &&
    rawText.length > 0 &&
    (rawText.includes('**Connection Error**') ||
      rawText.includes('Invalid API Key') ||
      rawText.includes('All Gemini models have exceeded their quota') ||
      rawText.startsWith('Connection Error:'));

  if (isErrorMessage) {
    return (
      <ErrorCard
        errorText={rawText}
        onRetry={onRetry}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  const formatBold = (text?: string): React.ReactNode => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={index} className="text-audio-text font-semibold">
                {highlightGlossaryTerms(part.slice(2, -2))}
              </strong>
            );
          }
          return <span key={index}>{highlightGlossaryTerms(part)}</span>;
        })}
      </>
    );
  };

  const formatInlineMarkdown = (text?: string): React.ReactNode => {
    if (!text) return null;
    const trimmed = text.trim();
    if (trimmed.startsWith('### ')) {
      return (
        <h3 className="font-display text-base md:text-lg font-semibold text-audio-accent mt-4 mb-2 tracking-tight">
          {trimmed.slice(4)}
        </h3>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 className="font-display text-lg md:text-xl font-semibold text-audio-text mt-5 mb-2 border-b border-audio-border pb-1">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.startsWith('- ')) {
      return (
        <li className="ml-4 list-disc marker:text-audio-accent pl-1 leading-relaxed">
          {formatBold(trimmed.slice(2))}
        </li>
      );
    }
    if (trimmed.match(/^\d+\.\s+/)) {
      return (
        <li className="ml-4 list-decimal marker:text-audio-accent pl-1 leading-relaxed">
          {formatBold(trimmed.replace(/^\d+\.\s+/, ''))}
        </li>
      );
    }
    return formatBold(text);
  };

  const renderTable = (rows: string[], key: string) => {
    const dataRows = rows
      .map((r) => r.trim())
      .filter((r) => r.startsWith('|') && !r.includes('---') && r.replace(/\|/g, '').trim().length > 0);

    if (dataRows.length === 0) return null;

    const allHeaders = dataRows[0]
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (allHeaders.length === 0) return null;

    const allBody = dataRows.slice(1).map((r) =>
      r
        .split('|')
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
    );

    const firstHeaderLower = (allHeaders[0] || '').toLowerCase();
    const isFeatureCol = [
      'feature',
      'attribute',
      'spec',
      'category',
      'parameter',
      'criteria',
      'specification',
      'metric',
      'dimension',
    ].some((kw) => firstHeaderLower.includes(kw));

    const headers = isFeatureCol ? allHeaders.slice(1) : allHeaders;
    const body = isFeatureCol ? allBody.map((r) => r.slice(1)) : allBody;
    const rowLabels = isFeatureCol ? allBody.map((r) => r[0] || '') : null;

    const colCount = Math.max(1, headers.length);
    const colWidth = Math.max(130, Math.min(220, Math.floor(380 / colCount)));

    return (
      <div key={key} className="my-4 w-full max-w-full">
        <div className="flex items-center gap-2 mb-1.5 text-audio-accent">
          <span className="text-[9px] font-mono uppercase tracking-widest font-bold">
            Spec Sheet Matrix
          </span>
          <span className="flex-1 h-px bg-audio-border" />
        </div>
        <div
          className="w-full overflow-x-auto rounded-xl border border-audio-border shadow-panel bg-[#140F0C] scrollbar-thin"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain auto' }}
        >
          <table
            style={{
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              width: `${colCount * colWidth}px`,
              minWidth: '100%',
            }}
          >
            <colgroup>
              {headers.map((_, i) => (
                <col key={i} style={{ width: `${colWidth}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="bg-[#1A1410] text-audio-accent font-semibold uppercase tracking-wider text-left border-b-2 border-audio-accent px-3.5 py-2.5 text-[11px] font-mono"
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {h || `Product ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rI) => (
                <React.Fragment key={rI}>
                  {rowLabels && rowLabels[rI] && (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="px-3.5 pt-2.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-widest text-audio-accent/90 border-t border-audio-border/60 font-mono bg-[#110D0A]"
                        style={{ letterSpacing: '0.12em' }}
                      >
                        {rowLabels[rI]}
                      </td>
                    </tr>
                  )}
                  <tr className="group/row">
                    {headers.map((_, cI) => {
                      const cell = row[cI] || '—';
                      return (
                        <td
                          key={cI}
                          className={[
                            'px-3.5 py-2.5 text-[13px] leading-snug border-b border-audio-border/40 font-sans',
                            rI % 2 === 1 ? 'bg-black/20' : 'bg-transparent',
                            'text-audio-text/90 group-hover/row:bg-audio-highlight group-hover/row:text-audio-text',
                          ].join(' ')}
                          style={{
                            verticalAlign: 'top',
                            wordBreak: 'break-word',
                            whiteSpace: 'normal',
                          }}
                        >
                          {formatInlineMarkdown(cell)}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {colCount > 2 && (
          <p className="md:hidden mt-1 text-center text-[9px] text-audio-muted tracking-wide font-mono">
            ← swipe horizontally to compare →
          </p>
        )}
      </div>
    );
  };

  const renderContent = (text: string) => {
    if (!text || text.trim().length === 0) return null;
    const cleanText = text.replace(/\\n/g, '\n');
    const blocks = cleanText.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, blockIdx) => {
      if (!block) return null;
      if (block.startsWith('```')) {
        return (
          <pre
            key={blockIdx}
            className="bg-[#0B0907] p-3.5 rounded-xl overflow-x-auto text-xs font-mono my-2.5 border border-audio-border text-audio-text/90 shadow-inner"
          >
            {block.replace(/```\w*\n?|```$/g, '')}
          </pre>
        );
      }

      const lines = block.split('\n');
      const nodes: React.ReactNode[] = [];
      let inTable = false;
      let tableRows: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';

        if (line.trim().startsWith('|')) {
          inTable = true;
          tableRows.push(line);
          continue;
        }

        if (inTable) {
          nodes.push(renderTable(tableRows, `${blockIdx}-table-${i}`));
          tableRows = [];
          inTable = false;
        }

        if (line.trim() === '') {
          nodes.push(<br key={`${blockIdx}-br-${i}`} />);
          continue;
        }

        nodes.push(
          <div key={`${blockIdx}-line-${i}`} className="min-h-[1.5rem] mb-1 break-words">
            {formatInlineMarkdown(line)}
          </div>
        );
      }

      if (inTable && tableRows.length > 0) {
        nodes.push(renderTable(tableRows, `${blockIdx}-table-end`));
      }

      return (
        <div key={blockIdx} className="w-full min-w-0">
          {nodes}
        </div>
      );
    });
  };

  // USER MESSAGE
  if (isUser) {
    return (
      <div className="flex w-full max-w-full mb-4 justify-end">
        <div className="w-full max-w-[90%] sm:max-w-[80%] ml-auto rounded-2xl rounded-br-sm p-4 bg-[#1F1813] border border-audio-border text-audio-text shadow-md">
          {message.image && (
            <div className="mb-3 rounded-xl overflow-hidden border border-audio-accent/50 shadow-lg max-w-sm bg-black">
              <img
                src={message.image}
                alt="User upload"
                className="w-full h-auto object-cover max-h-56"
              />
            </div>
          )}
          {message.audio && (
            <div className="mb-3 p-2 rounded-xl bg-black/40 border border-audio-border">
              <audio
                controls
                src={message.audio}
                className="w-full h-9 rounded-lg"
                style={{ filter: 'invert(1) hue-rotate(180deg)' }}
              />
              <p className="text-[9px] text-audio-muted mt-1 uppercase tracking-wider font-mono">
                VOICE TRANSMISSION
              </p>
            </div>
          )}
          <div className="leading-relaxed text-[14px] md:text-[15px] font-normal tracking-wide break-words w-full min-w-0 text-audio-text">
            {renderContent(
              rawText || (message.audio && !rawText ? '*Voice Query Transmitted*' : '')
            )}
          </div>
          <div className="text-right mt-2 text-[9px] font-mono text-audio-muted/70">
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
      </div>
    );
  }

  // ASSISTANT MESSAGE
  return (
    <div className="flex w-full max-w-full mb-6 justify-start">
      <div className="w-full max-w-7xl panel border-l-4 border-l-audio-accent bg-[#15100D] p-4 md:p-6 rounded-2xl shadow-panel">
        {/* HEADER ROW */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-audio-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-audio-surface border border-audio-accent/50 flex items-center justify-center text-audio-accent text-xs shadow-glow-brass">
              <WaveformIcon />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-audio-muted">
              <span className="text-audio-accent font-bold tracking-wider uppercase">
                {activeModel}
              </span>
              <span>•</span>
              <span>{formatTimestamp(message.timestamp)}</span>
              <span>•</span>
              <span className="text-audio-signal">
                {Math.max(1, Math.round((rawText.length || 0) / 3.8))} tok
              </span>
            </div>
          </div>

          {/* STREAMING SIGNAL-CHAIN TIMELINE CHIPS */}
          {message.isThinking ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-audio-surface border border-audio-signal/40 text-[9px] font-mono text-audio-signal">
                <Led color="teal" size="sm" />
                <span>SEARCH ✓</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-audio-surface border border-audio-accent/40 text-[9px] font-mono text-audio-accent">
                <Led color="brass" pulse size="sm" />
                <span>RAG …</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-audio-surface border border-audio-border text-[9px] font-mono text-audio-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-audio-muted/40" />
                <span>VERIFY</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[9px] font-mono text-audio-signal bg-[#111A15] px-2 py-0.5 rounded border border-audio-signal/30">
              <Led color="green" size="sm" />
              <span>SIGNAL VERIFIED</span>
            </div>
          )}
        </div>

        {/* BODY CONTENT */}
        <div className="leading-relaxed text-[14px] md:text-[15px] font-normal text-audio-text/95 tracking-wide break-words w-full min-w-0">
          {message.isThinking ? (
            <div className="flex items-center gap-3 py-3">
              <span className="meter-loader">
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
              <Engraved size="sm" glow>
                ANALYZING ACOUSTIC SIGNAL &amp; SYNTHESIZING RESPONSE…
              </Engraved>
            </div>
          ) : (
            <>
              {renderContent(cleanMessageText || '')}
              {hasFrequencyData && (
                <div className="my-4">
                  <FRGraph
                    title={parsedFrData?.title}
                    curves={parsedFrData?.curves}
                    sibilanceAlert={rawText.toLowerCase().includes('8khz') || rawText.toLowerCase().includes('sibilan')}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* ACTION BAR */}
        {!message.isThinking && rawText.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-5 pt-3.5 border-t border-audio-border/50">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all select-none border ${
                copied
                  ? 'bg-audio-accent text-black font-bold border-audio-accent shadow-glow-brass'
                  : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-text hover:border-audio-muted'
              }`}
              title="Copy to clipboard"
            >
              <CopyIcon />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {onSaveToNotes && (
              <button
                onClick={handleSaveToNotes}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all select-none border ${
                  saved
                    ? 'bg-audio-signal text-black font-bold border-audio-signal shadow-glow-teal'
                    : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-accent hover:border-audio-accent/60'
                }`}
                title="Save top finding to permanent memory"
              >
                <BookmarkIcon />
                <span>{saved ? 'Saved to Memory' : 'Save'}</span>
              </button>
            )}

            {onVerify && (
              <button
                onClick={() =>
                  onVerify(
                    'Verify the acoustic specifications, driver configurations, and pricing for the gear discussed above against trusted measurement sources (Crinacle, Rtings, AudioScienceReview).'
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-xs font-mono text-audio-muted hover:text-audio-signal hover:border-audio-signal/60 transition-colors select-none"
              >
                <CheckIcon />
                <span>Verify Specs</span>
              </button>
            )}

            {onVerify && (
              <button
                onClick={() =>
                  onVerify(
                    'Provide deeper technical measurements (Impulse Response, THD harmonic distortion, Group Delay, and Soundstage 3D imaging specifics) for this setup.'
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-xs font-mono text-audio-muted hover:text-audio-text hover:border-audio-muted transition-colors select-none"
              >
                <ActivityIcon />
                <span>More Details</span>
              </button>
            )}
          </div>
        )}

        {/* GROUNDING & CITATION SOURCES */}
        {message.groundingSources && message.groundingSources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-audio-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Led color="green" pulse size="sm" />
              <Engraved size="xs">SEARCH GROUNDED SOURCES</Engraved>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.groundingSources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                    source.type === 'map'
                      ? 'bg-audio-signal/10 text-audio-signal border-audio-signal/30 hover:border-audio-signal/60'
                      : 'bg-audio-surface text-audio-accent border-audio-border hover:border-audio-accent/60'
                  }`}
                >
                  {source.type === 'map' ? <MapIcon /> : <LinkIcon />}
                  <span className="truncate max-w-[180px] opacity-90">{source.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
