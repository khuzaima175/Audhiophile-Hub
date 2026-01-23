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
      // Extract a key fact from the message (first 200 chars)
      const note = message.text.substring(0, 200).split('\n')[0];
      onSaveToNotes(note);
    }
  };

  // Helper to detect and render a simple table structure from markdown
  const renderContent = (text: string) => {
    // Split by code blocks first to avoid formatting inside code
    const blocks = text.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, blockIdx) => {
      if (block.startsWith('```')) {
        return (
          <pre key={blockIdx} className="bg-black p-3 rounded-lg overflow-x-auto text-xs font-mono my-2 border border-audio-border text-gray-300">
            {block.replace(/```\w*\n?|```$/g, '')}
          </pre>
        );
      }

      // Process tables and other markdown
      // We look for table patterns: lines starting with |
      const lines = block.split('\n');
      const nodes: React.ReactNode[] = [];
      let inTable = false;
      let tableRows: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Simple table detection
        if (line.trim().startsWith('|')) {
          inTable = true;
          tableRows.push(line);
          continue;
        }

        // If we were in a table and hit a non-table line, render the table
        if (inTable) {
          nodes.push(renderTable(tableRows, `${blockIdx}-table-${i}`));
          tableRows = [];
          inTable = false;
        }

        // Standard line processing
        if (line.trim() === '') {
          nodes.push(<br key={`${blockIdx}-br-${i}`} />);
          continue;
        }

        nodes.push(
          <div key={`${blockIdx}-line-${i}`} className="min-h-[1.5rem] mb-1">
            {formatInlineMarkdown(line)}
          </div>
        );
      }

      // Catch end of block table
      if (inTable && tableRows.length > 0) {
        nodes.push(renderTable(tableRows, `${blockIdx}-table-end`));
      }

      return <div key={blockIdx}>{nodes}</div>;
    });
  };

  const renderTable = (rows: string[], key: string) => {
    // Remove divider row (e.g., |---|---|)
    const dataRows = rows.filter(r => !r.includes('---'));
    if (dataRows.length === 0) return null;

    const header = dataRows[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const body = dataRows.slice(1).map(r => r.split('|').filter(c => c.trim()).map(c => c.trim()));

    return (
      <div key={key} className="w-full max-w-full overflow-x-auto my-4 rounded-lg border border-audio-border shadow-md bg-[#080808] -mx-2 px-2 scroll-x-touch" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
        <table className="prose-table w-full min-w-[700px]">
          <thead>
            <tr>
              {header.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rI) => (
              <tr key={rI}>
                {row.map((cell, cI) => <td key={cI}>{formatInlineMarkdown(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const formatInlineMarkdown = (text: string) => {
    // Headers
    if (text.startsWith('### ')) return <h3 className="text-lg font-bold text-audio-accent mt-4 mb-2 tracking-tight">{text.slice(4)}</h3>;
    if (text.startsWith('## ')) return <h2 className="text-xl font-bold text-white mt-5 mb-2 border-b border-audio-border pb-1">{text.slice(3)}</h2>;

    // Lists
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
            // Apply glossary to bold text content
            return <strong key={index} className="text-white font-semibold">{highlightGlossaryTerms(part.slice(2, -2))}</strong>
          }
          // Apply glossary highlighting to regular text
          return <span key={index}>{highlightGlossaryTerms(part)}</span>
        })}
      </>
    );
  }

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`w-full max-w-7xl rounded-2xl px-4 py-4 md:px-6 md:py-5 shadow-lg backdrop-blur-sm flex flex-col min-w-0 ${isUser
          ? 'bg-audio-highlight border border-audio-border text-white rounded-br-sm ml-auto max-w-[90%] sm:max-w-[80%]'
          : 'bg-[#101010] border border-audio-border/50 text-audio-text rounded-bl-sm'
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

        <div className="leading-relaxed text-[15px] font-light tracking-wide">
          {renderContent(message.text || (message.audio && !message.text ? "*Voice Message Sent*" : ""))}
        </div>

        {/* Action Bar for AI Messages */}
        {!isUser && !message.isThinking && message.text && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-audio-border/50">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-[10px] transition-colors ${copied ? 'text-green-400 border-green-500/50' : 'text-audio-muted hover:text-white hover:border-white'}`}
              title="Copy response"
            >
              <CopyIcon />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Save to Notes Button */}
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

            {/* Verify Button */}
            {onVerify && (
              <button
                onClick={() => onVerify("Verify the facts in the last response using Google Search.")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-audio-surface border border-audio-border rounded-lg text-[10px] text-audio-muted hover:text-audio-accent hover:border-audio-accent transition-colors"
              >
                <CheckIcon />
                <span>Verify</span>
              </button>
            )}

            {/* Deep Dive Button */}
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