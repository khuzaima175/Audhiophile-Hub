import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChatSession, AudioProfile } from '../types';
import { SearchIcon, WaveformIcon, EqIcon, HeadphonesIcon, BrainIcon, ActivityIcon, PlusIcon, StarIcon } from './Icon';
import Engraved from './ui/Engraved';
import Led from './ui/Led';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  profile: AudioProfile;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onOpenKnowledgeBase: (tab?: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge') => void;
  onToggleAdvanced: () => void;
  onAutoEQClick: () => void;
}

interface PaletteItem {
  id: string;
  category: 'ACTIONS' | 'SESSIONS' | 'GEAR' | 'MEMORIES';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  sessions,
  profile,
  onSelectSession,
  onNewChat,
  onOpenKnowledgeBase,
  onToggleAdvanced,
  onAutoEQClick,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      // Actions
      {
        id: 'act-new',
        category: 'ACTIONS',
        title: 'Start New Acoustic Research',
        subtitle: 'Create a clean session console',
        icon: <PlusIcon />,
        action: () => {
          onNewChat();
          onClose();
        },
      },
      {
        id: 'act-eq',
        category: 'ACTIONS',
        title: 'Open EQ Targeter & Wavelet Library',
        subtitle: 'Manage 10-band curves and PEQ filters',
        icon: <EqIcon />,
        action: () => {
          onOpenKnowledgeBase('eq');
          onClose();
        },
      },
      {
        id: 'act-autoeq',
        category: 'ACTIONS',
        title: 'Synthesize Auto-EQ from FR Graph',
        subtitle: 'Upload frequency response image',
        icon: <WaveformIcon />,
        action: () => {
          onAutoEQClick();
          onClose();
        },
      },
      {
        id: 'act-gear',
        category: 'ACTIONS',
        title: 'Open Gear Rack & Battle Mode',
        subtitle: 'Compare IEMs, DACs, and headphones',
        icon: <HeadphonesIcon />,
        action: () => {
          onOpenKnowledgeBase('gear');
          onClose();
        },
      },
      {
        id: 'act-tech',
        category: 'ACTIONS',
        title: 'Toggle Senior Tech Analysis Mode',
        subtitle: 'Enable THD, Group Delay, and SINAD telemetry',
        icon: <ActivityIcon />,
        action: () => {
          onToggleAdvanced();
          onClose();
        },
      },
      {
        id: 'act-profile',
        category: 'ACTIONS',
        title: 'Open Listener Profile & Faders',
        subtitle: 'Calibrate Crinacle IEF 2025 and sibilance notch',
        icon: <BrainIcon />,
        action: () => {
          onOpenKnowledgeBase('profile');
          onClose();
        },
      },
    ];

    // Sessions
    sessions.forEach((s) => {
      list.push({
        id: `sess-${s.id}`,
        category: 'SESSIONS',
        title: s.title,
        subtitle: `${s.messages.length} messages • ${new Date(s.updatedAt || s.createdAt).toLocaleDateString()}`,
        icon: s.isStarred ? <StarIcon filled /> : <SearchIcon />,
        action: () => {
          onSelectSession(s.id);
          onClose();
        },
      });
    });

    // Gear
    (profile.gearLibrary || []).forEach((g) => {
      list.push({
        id: `gear-${g.id}`,
        category: 'GEAR',
        title: `${g.name} (${g.type})`,
        subtitle: `${g.status.toUpperCase()} • ${g.price || 'In collection'} ${g.notes ? `• ${g.notes}` : ''}`,
        icon: <HeadphonesIcon />,
        action: () => {
          onOpenKnowledgeBase('gear');
          onClose();
        },
      });
    });

    // Memories
    (profile.savedMemories || []).forEach((m, idx) => {
      list.push({
        id: `mem-${idx}`,
        category: 'MEMORIES',
        title: m,
        subtitle: `Permanent Acoustic Rule #${idx + 1}`,
        icon: <BrainIcon />,
        action: () => {
          onOpenKnowledgeBase('memory');
          onClose();
        },
      });
    });

    return list;
  }, [sessions, profile, onNewChat, onOpenKnowledgeBase, onAutoEQClick, onToggleAdvanced, onSelectSession, onClose]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 bg-black/85 backdrop-blur-md p-3 animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="panel bg-[#140F0C] w-full max-w-2xl rounded-2xl border border-audio-border shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-audio-border/70 flex items-center gap-3 bg-[#110D0A]">
          <div className="text-audio-accent">
            <SearchIcon />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, session, gear, or acoustic rule..."
            className="flex-1 bg-transparent text-sm md:text-base text-audio-text placeholder-audio-muted/60 focus:outline-none font-sans"
          />
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-audio-muted bg-audio-surface px-2 py-1 rounded border border-audio-border">
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-100 select-none ${
                    isSelected
                      ? 'bg-audio-accent text-black font-semibold shadow-glow-brass'
                      : 'text-audio-text hover:bg-audio-surface'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${
                        isSelected ? 'bg-black/20 text-black' : 'bg-audio-surface text-audio-accent border border-audio-border'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs truncate font-display">{item.title}</div>
                      {item.subtitle && (
                        <div
                          className={`text-[10px] font-mono truncate mt-0.5 ${
                            isSelected ? 'text-black/80' : 'text-audio-muted'
                          }`}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[8.5px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ml-2 flex-shrink-0 ${
                      isSelected
                        ? 'bg-black/20 text-black border-black/30'
                        : 'bg-black/40 text-audio-muted border-audio-border/60'
                    }`}
                  >
                    {item.category}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-audio-muted text-xs font-mono">
              No matching commands or acoustic records found for &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 px-4 bg-[#0E0B08] border-t border-audio-border flex items-center justify-between text-[9px] font-mono text-audio-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <div className="flex items-center gap-1 text-audio-accent">
            <Led color="brass" size="sm" />
            <span>AudioSage 2.0 Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
