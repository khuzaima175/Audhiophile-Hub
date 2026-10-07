import React from 'react';
import { MenuIcon, SearchIcon, SettingsIcon } from './Icon';
interface HeaderProps {
  activeModel: string;
  onSelectModel: (model: string) => void;
  onOpenKnowledgeBase: () => void;
  onOpenCommandPalette?: () => void;
  onOpenMobileSidebar: () => void;
  currentSessionTitle?: string;
  hasActiveSession?: boolean;
  latencyMs?: number;
  isStreaming?: boolean;
  pageTitle?: string;
  hasApiKey?: boolean;
}
export default function Header({
  activeModel,
  onSelectModel,
  onOpenKnowledgeBase,
  onOpenCommandPalette,
  onOpenMobileSidebar,
  currentSessionTitle,
  hasActiveSession,
  isStreaming,
  pageTitle = 'Overview',
  hasApiKey,
}: HeaderProps) {
  return (
    <header className="workspace-header">
      <div className="header-location">
        <button
          className="icon-button mobile-menu"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>
        <span className="header-breadcrumb">
          Workspace <span>/</span>
        </span>
        <span className="header-title">
          {hasActiveSession && pageTitle === 'Research' ? currentSessionTitle : pageTitle}
        </span>
      </div>
      <div className="header-actions">
        <span className={`connection-status ${hasApiKey ? 'connected' : ''}`}>
          <span />
          {isStreaming ? 'Researching…' : hasApiKey ? 'AI key configured' : 'AI setup needed'}
        </span>
        <button className="search-trigger" onClick={onOpenCommandPalette} aria-label="Search workspace">
          <SearchIcon />
          <span>Search anything</span>
          <kbd>Ctrl K</kbd>
        </button>
        <label className="model-select">
          <span className="sr-only">AI model</span>
          <select value={activeModel} onChange={(e) => onSelectModel(e.target.value)}>
            <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
          </select>
        </label>
        <button className="icon-button" onClick={onOpenKnowledgeBase} aria-label="Open settings">
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
