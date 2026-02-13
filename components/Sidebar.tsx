import React, { useState, useMemo } from 'react';
import { ChatSession } from '../types';
import { PlusIcon, TrashIcon, HeadphonesIcon, StarIcon, SearchIcon, EditIcon } from './Icon';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onStarSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onStarSession,
  onRenameSession
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = sessions.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.messages.some(m => m.text.toLowerCase().includes(query))
      );
    }

    // Sort: starred first, then by updatedAt
    return [...filtered].sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [sessions, searchQuery]);

  const starredSessions = filteredSessions.filter(s => s.isStarred);
  const recentSessions = filteredSessions.filter(s => !s.isStarred);

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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderSession = (session: ChatSession) => (
    <div
      key={session.id}
      onClick={() => onSelectSession(session.id)}
      className={`group relative flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${session.id === currentSessionId
        ? 'bg-audio-highlight border border-audio-border text-white'
        : 'text-gray-400 hover:bg-[#1A1A1A]/50 hover:text-gray-200 border border-transparent'
        }`}
    >
      {/* Star indicator */}
      {session.isStarred && (
        <span className="text-audio-accent mr-2 flex-shrink-0">
          <StarIcon filled />
        </span>
      )}

      {/* Title - editable or static */}
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
            className="w-full bg-audio-surface border border-audio-accent rounded px-2 py-0.5 text-xs text-white focus:outline-none"
          />
        ) : (
          <>
            <div className="truncate text-xs font-medium">{session.title}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              {formatDate(session.updatedAt)} • {session.messages.length} msgs
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className={`flex items-center gap-1 transition-opacity ${session.id === currentSessionId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onStarSession(session.id); }}
          className={`p-1 rounded transition-colors ${session.isStarred ? 'text-audio-accent' : 'text-gray-500 hover:text-audio-accent'}`}
          title={session.isStarred ? 'Unstar' : 'Star'}
        >
          <StarIcon filled={session.isStarred} />
        </button>
        <button
          onClick={(e) => handleStartEdit(session, e)}
          className="p-1 rounded text-gray-500 hover:text-white transition-colors"
          title="Rename"
        >
          <EditIcon />
        </button>
        <button
          onClick={(e) => onDeleteSession(session.id, e)}
          className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-80 h-full bg-audio-base flex flex-col border-r border-audio-border/50 flex-shrink-0">
      {/* Header */}
      <div className="p-4 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-5 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-audio-accent/20 to-audio-accent/5 flex items-center justify-center text-audio-accent border border-audio-accent/20">
            <HeadphonesIcon />
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide text-white block">AudioSage</span>
            <span className="text-[10px] text-gray-500">Research Assistant</span>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-audio-accent hover:bg-[#E5C150] text-black py-2.5 px-4 rounded-xl transition-all duration-200 font-semibold text-xs shadow-lg shadow-audio-accent/10"
        >
          <PlusIcon />
          <span>New Research</span>
        </button>

        {/* Search Box */}
        <div className="mt-4 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-audio-surface border border-audio-border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-audio-accent/50 transition-colors"
            style={{ paddingLeft: '2.25rem' }}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <SearchIcon />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
        {/* Starred Section */}
        {starredSessions.length > 0 && (
          <>
            <div className="text-[10px] font-bold text-audio-accent uppercase tracking-wider px-3 mb-2 mt-2 flex items-center gap-2">
              <StarIcon filled />
              Pinned
            </div>
            {starredSessions.map(renderSession)}
          </>
        )}

        {/* Recent Section */}
        {recentSessions.length > 0 && (
          <>
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider px-3 mb-2 mt-4">
              Recent
            </div>
            {recentSessions.map(renderSession)}
          </>
        )}

        {/* Empty State */}
        {filteredSessions.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            {searchQuery ? (
              <p className="text-xs">No results for "{searchQuery}"</p>
            ) : (
              <p className="text-xs">No chats yet. Start a new research!</p>
            )}
          </div>
        )}
      </div>

      {/* Stats/Info Area */}
      <div className="p-4 border-t border-audio-border bg-[#080808]">
        <div className="flex justify-between items-center text-[10px] text-gray-500 mb-2">
          <span>{sessions.length} conversations</span>
          <span className="text-audio-accent flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </span>
        </div>
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-audio-accent to-audio-accent/50 transition-all duration-500"
            style={{ width: `${Math.min(100, (sessions.length / 50) * 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;