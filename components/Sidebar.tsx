import React, { useMemo, useState } from 'react';
import { AudioProfile, ChatSession } from '../types';
import { labStore } from '../store/labStore';
import {
  PlusIcon,
  HeadphonesIcon,
  SearchIcon,
  EqIcon,
  WaveformIcon,
  BrainIcon,
  SettingsIcon,
  StarIcon,
  XIcon,
} from './Icon';
export type WorkspacePage = 'home' | 'research' | 'eq' | 'gear' | 'profile' | 'memory' | 'knowledge';
interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  profile: AudioProfile;
  activeModel?: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onStarSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onOpenKnowledgeBase?: (tab?: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge') => void;
  onCloseMobile?: () => void;
  onOpenCommandPalette?: () => void;
  activePage?: WorkspacePage;
  onNavigate?: (page: WorkspacePage) => void;
}
export default function Sidebar({
  sessions,
  currentSessionId,
  profile,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onStarSession,
  onRenameSession,
  onCloseMobile,
  activePage = 'home',
  onNavigate,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const filtered = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            s.title.toLowerCase().includes(query.toLowerCase()) ||
            s.messages.some((m) => m.text?.toLowerCase().includes(query.toLowerCase())),
        )
        .sort((a, b) => Number(!!b.isStarred) - Number(!!a.isStarred) || b.updatedAt - a.updatedAt),
    [sessions, query],
  );
  const navigate = (page: WorkspacePage) => {
    onNavigate?.(page);
    onCloseMobile?.();
  };
  const nav = (page: WorkspacePage, label: string, icon: React.ReactNode, count?: number) => (
    <button
      key={page}
      className={`nav-item ${activePage === page ? 'active' : ''}`}
      aria-current={activePage === page ? 'page' : undefined}
      onClick={() => navigate(page)}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );
  const saveTitle = (id: string) => {
    if (title.trim()) onRenameSession(id, title.trim());
    setEditingId(null);
  };
  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <WaveformIcon />
        </span>
        <span>
          audio<span className="brand-light">sage</span>
          <small>Your listening workspace</small>
        </span>
        {onCloseMobile && (
          <button className="icon-button" onClick={onCloseMobile} aria-label="Close navigation">
            <XIcon />
          </button>
        )}
      </div>
      <button
        className="primary-button new-research"
        onClick={() => {
          onNewChat();
          onCloseMobile?.();
        }}
      >
        <PlusIcon />
        New research
      </button>
      <nav aria-label="Main navigation">
        <p className="sidebar-section-label">Workspace</p>
        {nav('home', 'Overview', <span className="grid-icon">▦</span>)}
        {nav('research', 'Research assistant', <SearchIcon />)}
        {nav('gear', 'My gear', <HeadphonesIcon />, profile.gearLibrary?.length || 0)}
        {nav('eq', 'Equalizer', <EqIcon />)}
        <button
          className="nav-item"
          onClick={() => {
            labStore.openLab();
            onCloseMobile?.();
          }}
        >
          <WaveformIcon />
          <span>Graph lab</span>
          <span className="nav-extra">↗</span>
        </button>
        <p className="sidebar-section-label">Personal library</p>
        {nav('profile', 'Listening profile', <HeadphonesIcon />)}
        {nav('knowledge', 'Research notes', <BrainIcon />, profile.savedMemories?.length || 0)}
      </nav>
      <div className="sidebar-history">
        <div className="history-heading">
          <p className="sidebar-section-label">Recent research</p>
          <span>{sessions.length}</span>
        </div>
        <label className="history-search">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a conversation"
            aria-label="Search conversations"
          />
        </label>
        <div className="history-list">
          {filtered.length === 0 && (
            <p className="history-empty">
              {query ? 'No matching conversations.' : 'Your research will appear here.'}
            </p>
          )}
          {filtered.map((s) => (
            <div
              key={s.id}
              className={`session-row ${currentSessionId === s.id && activePage === 'research' ? 'selected' : ''}`}
            >
              {editingId === s.id ? (
                <input
                  autoFocus
                  aria-label="Conversation name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => saveTitle(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle(s.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button className="session-link" onClick={() => onSelectSession(s.id)}>
                  {s.isStarred && <StarIcon filled />}
                  <span>{s.title || 'Untitled research'}</span>
                </button>
              )}
              <details className="session-menu">
                <summary aria-label={`Actions for ${s.title}`}>···</summary>
                <div className="dropdown-menu">
                  <button
                    onClick={(e) => {
                      onStarSession(s.id);
                      e.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                  >
                    {s.isStarred ? 'Unpin' : 'Pin conversation'}
                  </button>
                  <button
                    onClick={(e) => {
                      setEditingId(s.id);
                      setTitle(s.title);
                      e.currentTarget.closest('details')?.removeAttribute('open');
                    }}
                  >
                    Rename
                  </button>
                  <button className="danger-text" onClick={(e) => onDeleteSession(s.id, e)}>
                    Delete conversation
                  </button>
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
      <div className="sidebar-bottom">
        {nav('memory', 'Settings & data', <SettingsIcon />)}
        <button className="profile-shortcut" onClick={() => navigate('profile')}>
          <span className="avatar">{(profile.name || 'Listener').slice(0, 2).toUpperCase()}</span>
          <span>
            {profile.name || 'Listener'}
            <small>Personal workspace</small>
          </span>
          <span>⌄</span>
        </button>
      </div>
    </aside>
  );
}
