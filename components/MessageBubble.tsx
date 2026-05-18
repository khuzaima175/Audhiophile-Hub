import React, { useState } from 'react';
import { Message } from '../types';
import { LinkIcon, CheckIcon, BrainIcon, MapIcon, CopyIcon, BookmarkIcon } from './Icon';
import { highlightGlossaryTerms } from './GlossaryTooltip';

interface MessageBubbleProps {
  message: Message;
  onVerify?: (content: string) => void;
  onSaveToNotes?: (note: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onVerify, onSaveToNotes }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSaveToNotes = () => {
    if (onSaveToNotes && message.text) {
      const note = message.text.substring(0, 200).split('\n')[0];
      onSaveToNotes(note);
    }
  };

  const renderContent = (text: string) => {
    const blocks = text.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, blockIdx) => {
      if (block.startsWith('```')) {
        return (
          <pre key={blockIdx} className="bg-black p-3 rounded-lg overflow-x-auto text-xs font-mono my-2 border border-audio-border text-gray-300">
            {block.replace(/```\w*\n?|```$/g, '')}
          </pre>
        );
      }

      const lines = block.split('\n');
      const nodes: React.ReactNode[] = [];
      let inTable = false;
      let tableRows: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

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
          <div key={`${blockIdx}-line-${i}`} className="min-h-[1.5rem] mb-1 break-words overflow-hidden">
            {formatInlineMarkdown(line)}
          </div>
        );
      }

      if (inTable && tableRows.length > 0) {
        nodes.push(renderTable(tableRows, `${blockIdx}-table-end`));
      }

      return <div key={blockIdx} className="w-full min-w-0">{nodes}</div>;
    });
  };

  const renderTable = (rows: string[], key: string) => {
    const dataRows = rows.filter(r => !r.includes('---'));
    if (dataRows.length === 0) return null;

    const header = dataRows[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const body = dataRows.slice(1).map(r => r.split('|').filter(c => c.trim()).map(c => c.trim()));

    // Column widths: first col (feature labels) is narrow/fixed; data cols get a comfortable max-width
    const colCount = header.length;
    const dataColStyle: React.CSSProperties = {
      minWidth: '160px',
      maxWidth: '280px',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      verticalAlign: 'top',
    };
    const featureColStyle: React.CSSProperties = {
      minWidth: '120px',
      maxWidth: '160px',
      whiteSpace: 'nowrap',
      verticalAlign: 'top',
    };

    return (
      <div key={key} className="my-4 w-full max-w-full">
        <div
          className="w-full overflow-x-auto rounded-lg border border-audio-border shadow-md bg-[#080808] scrollbar-thin"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain auto' }}
        >
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: `${colCount * 220}px`, minWidth: '100%' }}>
            <colgroup>
              {header.map((_, i) => (
                <col key={i} style={{ width: i === 0 ? '150px' : `${Math.floor((100 - 15) / (colCount - 1))}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th
                    key={i}
                    style={i === 0 ? { ...featureColStyle, position: 'sticky', left: 0, zIndex: 3 } : { whiteSpace: 'nowrap' }}
                    className="bg-[#111111] text-audio-accent font-bold uppercase tracking-wider text-left border-b-2 border-audio-accent px-3 py-2.5 text-[10px] md:px-4 md:text-[11px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rI) => (
                <tr key={rI} className="group/row">
                  {row.map((cell, cI) => (
                    <td
                      key={cI}
                      style={
                        cI === 0
                          ? { ...featureColStyle, position: 'sticky', left: 0, zIndex: 2 }
                          : dataColStyle
                      }
                      className={[
                        'border-b border-[#1e1e1e] px-3 py-2.5 text-[11.5px] leading-relaxed md:px-4 md:text-[13px]',
                        rI % 2 === 1 ? 'bg-[#0d0d0d]' : '',
                        cI === 0
                          ? 'bg-[#0A0A0A] text-[#aaaaaa] font-semibold text-[10.5px] md:text-[12px] border-r border-[#2A2A2A] group-hover/row:bg-[#1a1a1a] group-hover/row:text-[#cccccc]'
                          : 'text-[#CCCCCC] group-hover/row:bg-[#1a1a1a] group-hover/row:text-[#e0e0e0]',
                      ].join(' ')}
                    >
                      {formatInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Swipe hint — mobile only */}
        <p className="md:hidden mt-1 text-center text-[9px] text-gray-600 tracking-wide">← swipe to see more →</p>
      </div>
    );
  };

  const formatInlineMarkdown = (text: string) => {
    if (text.startsWith('### ')) return <h3 className="text-lg font-bold text-audio-accent mt-4 mb-2 tracking-tight">{text.slice(4)}</h3>;
    if (text.startsWith('## ')) return <h2 className="text-xl font-bold text-white mt-5 mb-2 border-b border-audio-border pb-1">{text.slice(3)}</h2>;
    if (text.trim().startsWith('- ')) return <li className="ml-4 list-disc marker:text-audio-accent pl-1">{formatBold(text.trim().slice(2))}</li>;
    if (text.trim().match(/^\d+\. /)) return <li className="ml-4 list-decimal marker:text-audio-accent pl-1">{formatBold(text.trim().replace(/^\d+\. /, ''))}</li>;
    return formatBold(text);
  };

  const formatBold = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-white font-semibold">{highlightGlossaryTerms(part.slice(2, -2))}</strong>;
          }
          return <span key={index}>{highlightGlossaryTerms(part)}</span>;
        })}
      </>
    );
  };

  return (
    <div className={`flex w-full max-w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`w-full max-w-7xl rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-lg backdrop-blur-sm flex flex-col min-w-0 ${isUser
          ? 'bg-audio-highlight border border-audio-border text-white rounded-br-sm ml-auto max-w-[90%] sm:max-w-[80%] overflow-hidden'
          : 'bg-[#101010] border border-audio-border/50 text-audio-text rounded-bl-sm max-w-full overflow-visible'
          }`}
      >
        {/* Attachments */}
        {message.image && (
          <div className="mb-4 rounded-xl overflow-hidden border border-audio-border/50 shadow-md max-w-sm">
            <img src={message.image} alt="User upload" className="w-full h-auto object-cover" />
          </div>
        )}
        {message.audio && (
          <div className="mb-4">
            <audio controls src={message.audio} className="w-full h-10 rounded-lg" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
            <p className="text-[10px] text-audio-muted mt-1 uppercase tracking-wider">Voice Message</p>
          </div>
        )}

        <div className="leading-relaxed text-[15px] font-light tracking-wide break-words w-full min-w-0">
          {message.isThinking ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-xs text-gray-500 mr-1">Thinking</span>
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-audio-accent inline-block"></span>
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-audio-accent inline-block"></span>
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-audio-accent inline-block"></span>
            </div>
          ) : (
            renderContent(message.text || (message.audio && !message.text ? "*Voice Message Sent*" : ""))
          )}
        </div>

        {/* Action Bar */}
        {!isUser && !message.isThinking && message.text && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-audio-border/50">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-[10px] transition-colors ${copied ? 'text-green-400 border-green-500/50' : 'text-audio-muted hover:text-white hover:border-white'}`}
              title="Copy response"
            >
              <CopyIcon />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {onSaveToNotes && (
              <button
                onClick={handleSaveToNotes}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-[10px] text-audio-muted hover:text-audio-accent hover:border-audio-accent transition-colors"
                title="Save key fact to notes"
              >
                <BookmarkIcon />
                <span>Save</span>
              </button>
            )}

            {onVerify && (
              <button
                onClick={() => onVerify("Verify the facts in the last response using Google Search.")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-[10px] text-audio-muted hover:text-audio-accent hover:border-audio-accent transition-colors"
              >
                <CheckIcon />
                <span>Verify</span>
              </button>
            )}

            {onVerify && (
              <button
                onClick={() => onVerify("Expand on this with more technical details.")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-[10px] text-audio-muted hover:text-white hover:border-white transition-colors"
              >
                <BrainIcon />
                <span>More</span>
              </button>
            )}
          </div>
        )}

        {/* Grounding Sources */}
        {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
          <div className="mt-5 pt-3 border-t border-audio-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-[10px] text-audio-muted uppercase tracking-widest font-bold">Verified Sources</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.groundingSources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-all ${source.type === 'map'
                    ? 'bg-[#1A2615] hover:bg-[#25361E] text-green-400 border-green-900 hover:border-green-700'
                    : 'bg-audio-base hover:bg-audio-highlight text-audio-accent border-audio-border hover:border-audio-accent/50'
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