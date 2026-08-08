import React, { useState, useMemo } from 'react';
import { ChatSession, AudioProfile } from '../types';
import { PlusIcon, TrashIcon, HeadphonesIcon, StarIcon, SearchIcon, EditIcon, WaveformIcon, EqIcon, BrainIcon, SettingsIcon } from './Icon';
import Led from './ui/Led';
import Engraved from './ui/Engraved';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  profile: AudioProfile;
  activeModel?: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onStarSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onOpenKnowledgeBase?: (tab?: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge') => void;
  onOpenCommandPalette?: () => void;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  profile,
  activeModel = 'gemini-3.6-flash',
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onStarSession,
  onRenameSession,
  onOpenKnowledgeBase,
  onOpenCommandPalette,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.messages.some((m) => m.text.toLowerCase().includes(query))
      );
    }

    return [...filtered].sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [sessions, searchQuery]);

  // Group by Today, Yesterday, Older
  const groupedSessions = useMemo(() => {
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const older: ChatSession[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    filteredSessions.forEach((session) => {
      const time = session.updatedAt || session.createdAt;
      if (time >= startOfToday) {
        today.push(session);
      } else if (time >= startOfYesterday) {
        yesterday.push(session);
      } else {
        older.push(session);
      }
    });

    return { today, yesterday, older };
  }, [filteredSessions]);

  const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditTitle('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get User initials (e.g., "Phoenix User" -> "PU")
  const userInitials = useMemo(() => {
    const parts = (profile.name || 'Phoenix User').trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (profile.name || 'PU').slice(0, 2).toUpperCase();
  }, [profile.name]);

  const renderSessionItem = (session: ChatSession) => {
    const isActive = session.id === currentSessionId;
    return (
      <div
        key={session.id}
        onClick={() => onSelectSession(session.id)}
        className={`group relative flex items-center px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 border select-none ${
          isActive
            ? 'bg-audio-highlight border-audio-border text-audio-text shadow-sm'
            : 'text-audio-muted hover:bg-audio-highlight/60 hover:text-audio-text border-transparent'
        }`}
      >
        {/* Active brass indicator rail */}
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-audio-accent shadow-[0_0_8px_rgba(198,147,79,0.8)]" />
        )}

        {/* Star icon if pinned */}
        {session.isStarred && (
          <span className="text-audio-accent mr-2 flex-shrink-0">
            <StarIcon filled />
          </span>
        )}

        <div className="flex-1 min-w-0 pr-2">
          {editingId === session.id ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, session.id)}
              onBlur={() => handleSaveEdit(session.id)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="w-full bg-audio-surface border border-audio-accent rounded px-2 py-0.5 text-xs text-audio-text focus:outline-none"
            />
          ) : (
            <>
              <div className="truncate text-xs font-medium text-audio-text/90 group-hover:text-audio-text">
                {session.title}
              </div>
              <div className="text-[10px] text-audio-muted/70 mt-0.5 font-mono flex items-center gap-1.5">
                <span>{session.messages.length} msgs</span>
                <span>•</span>
                <span>{formatTime(session.updatedAt || session.createdAt)}</span>
              </div>
            </>
          )}
        </div>

        {/* Actions on hover */}
        <div
          className={`flex items-center gap-1 transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStarSession(session.id);
            }}
            className={`p-1 rounded hover:bg-audio-surface transition-colors ${
              session.isStarred ? 'text-audio-accent' : 'text-audio-muted hover:text-audio-accent'
            }`}
            title={session.isStarred ? 'Unpin' : 'Pin to top'}
          >
            <StarIcon filled={session.isStarred} />
          </button>
          <button
            onClick={(e) => handleStartEdit(session, e)}
            className="p-1 rounded text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-colors"
            title="Rename session"
          >
            <EditIcon />
          </button>
          <button
            onClick={(e) => onDeleteSession(session.id, e)}
            className="p-1 rounded text-audio-muted hover:text-audio-warn hover:bg-audio-surface transition-colors"
            title="Delete session"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );
  };

  const formattedModel = activeModel.toUpperCase().replace('GEMINI-', 'GEMINI-');

  return (
    <aside className="w-[288px] h-full bg-[#110D0A] flex flex-col border-r border-audio-border flex-shrink-0 select-none">
      {/* 1. BRAND ROW */}
      <div className="p-3.5 pb-2 border-b border-audio-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-audio-accent to-[#8A6A3E] flex items-center justify-center text-black font-bold shadow-glow-brass">
              <WaveformIcon />
            </div>
            <div>
              <span className="font-display font-bold text-sm tracking-tight text-audio-text block leading-none">
                AudioSage
              </span>
              <span className="text-[9px] font-mono text-audio-muted uppercase tracking-wider block mt-0.5">
                Chassis Console
              </span>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-audio-muted hover:text-audio-text rounded-lg bg-audio-surface border border-audio-border text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2. USER CARD */}
        <div
          onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase('profile')}
          className="mt-3 p-2.5 rounded-xl border border-audio-border bg-[#18130F] hover:border-audio-accent/60 cursor-pointer transition-all group relative overflow-hidden shadow-panel"
        >
          <div className="flex items-center gap-2.5">
            {/* Avatar with brass ring and green LED at 4 o'clock */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-audio-surface border-2 border-audio-accent/80 flex items-center justify-center text-audio-accent font-display text-xs font-bold shadow-glow-brass">
                {userInitials}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#7FD8B4] border-2 border-[#18130F] shadow-[0_0_6px_#7FD8B4]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-audio-text group-hover:text-audio-accent transition-colors truncate">
                {profile.name || 'Phoenix User'}
              </div>
              <div className="text-[9px] font-mono text-audio-muted/80 tracking-wider truncate uppercase mt-0.5">
                {profile.savedMemories?.length || 0} MEM • {profile.gearLibrary?.length || 0} GEAR • {profile.eqLibrary?.length || 0} EQ
              </div>
            </div>
          </div>
        </div>

        {/* 3. NEW RESEARCH BUTTON */}
        <button
          onClick={onNewChat}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-audio-accent hover:bg-audio-accent-bright active:scale-[0.98] text-black py-2.5 px-4 rounded-xl transition-all duration-150 font-semibold text-xs shadow-glow-brass"
        >
          <PlusIcon />
          <span>New Research</span>
        </button>

        {/* 4. SEARCH WITH KBD CHIP */}
        <div className="mt-2.5 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-audio-surface border border-audio-border rounded-lg pl-8 pr-12 py-1.5 text-xs text-audio-text placeholder-audio-muted/60 focus:outline-none focus:border-audio-accent/60 transition-colors font-sans"
          />
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-audio-muted pointer-events-none">
            <SearchIcon />
          </div>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-audio-muted hover:text-audio-text text-xs"
            >
              ✕
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-audio-base border border-audio-border text-[9px] font-mono text-audio-muted hover:text-audio-accent hover:border-audio-accent/40"
              title="Open Command Palette"
            >
              ⌘K
            </button>
          )}
        </div>
      </div>

      {/* 5. NAV RAIL (DEEP-LINKS INTO MODAL TABS) */}
      <div className="px-3 py-2 border-b border-audio-border/50 bg-[#140F0C] space-y-0.5">
        <button
          onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase('profile')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-colors"
        >
          <span className="flex items-center gap-2">
            <BrainIcon />
            <span>Knowledge Base</span>
          </span>
          <span className="text-[10px] font-mono bg-audio-surface px-1.5 py-0.5 rounded border border-audio-border/60 text-audio-muted">
            {profile.savedMemories?.length || 0}
          </span>
        </button>

        <button
          onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase('eq')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-colors"
        >
          <span className="flex items-center gap-2">
            <EqIcon />
            <span>EQ Library</span>
          </span>
          <span className="text-[10px] font-mono bg-audio-surface px-1.5 py-0.5 rounded border border-audio-border/60 text-audio-accent">
            {profile.eqLibrary?.length || 0}
          </span>
        </button>

        <button
          onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase('gear')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-colors"
        >
          <span className="flex items-center gap-2">
            <HeadphonesIcon />
            <span>Gear Rack</span>
          </span>
          <span className="text-[10px] font-mono bg-audio-surface px-1.5 py-0.5 rounded border border-audio-border/60 text-audio-signal">
            {profile.gearLibrary?.length || 0}
          </span>
        </button>

        <button
          onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase('memory')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-colors"
        >
          <span className="flex items-center gap-2">
            <SettingsIcon />
            <span>Settings / API Key</span>
          </span>
          <Led color="green" size="sm" />
        </button>
      </div>

      {/* 6. RECENT SESSIONS LIST */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2 custom-scrollbar">
        {groupedSessions.today.length > 0 && (
          <div>
            <div className="px-2 py-1">
              <Engraved size="xs">TODAY</Engraved>
            </div>
            <div className="space-y-1">
              {groupedSessions.today.map(renderSessionItem)}
            </div>
          </div>
        )}

        {groupedSessions.yesterday.length > 0 && (
          <div>
            <div className="px-2 py-1 mt-2">
              <Engraved size="xs">YESTERDAY</Engraved>
            </div>
            <div className="space-y-1">
              {groupedSessions.yesterday.map(renderSessionItem)}
            </div>
          </div>
        )}

        {groupedSessions.older.length > 0 && (
          <div>
            <div className="px-2 py-1 mt-2">
              <Engraved size="xs">PREVIOUS SESSIONS</Engraved>
            </div>
            <div className="space-y-1">
              {groupedSessions.older.map(renderSessionItem)}
            </div>
          </div>
        )}

        {/* 7. EMPTY LIST STATE — CASSETTE TAPE ILLUSTRATION */}
        {filteredSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            {/* Dashed Cassette SVG */}
            <svg
              className="w-16 h-12 text-audio-muted/40 mb-3"
              viewBox="0 0 64 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            >
              <rect x="2" y="4" width="60" height="40" rx="4" />
              <circle cx="20" cy="24" r="7" />
              <circle cx="44" cy="24" r="7" />
              <path d="M20 24h24" />
              <path d="M10 44l6-10h32l6 10" />
            </svg>
            <p className="text-xs font-medium text-audio-text/80 mb-1">
              {searchQuery ? 'No matching recordings' : 'No sessions on tape yet'}
            </p>
            <p className="text-[10px] text-audio-muted mb-3 max-w-[180px]">
              {searchQuery ? 'Try another keyword or clear search' : 'Start your first acoustic shootout or graph analysis.'}
            </p>
            <button
              onClick={onNewChat}
              className="text-xs font-semibold text-audio-accent hover:text-audio-accent-bright transition-colors font-mono uppercase tracking-wider"
            >
              Start first research →
            </button>
          </div>
        )}
      </div>

      {/* 8. FOOTER STATUS BAR */}
      <div className="p-3 border-t border-audio-border bg-[#0E0B09] flex items-center justify-between text-[10px] font-mono text-audio-muted">
        <div className="flex items-center gap-1.5 text-audio-signal">
          <Led color="green" pulse size="sm" />
          <span className="font-bold tracking-wider">ONLINE</span>
        </div>
        <span className="text-audio-accent truncate max-w-[110px] tracking-wide">
          {formattedModel}
        </span>
        <span className="text-audio-muted/60">v2.0</span>
      </div>
    </aside>
  );
};

export default Sidebar;
