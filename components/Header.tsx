import React, { useState, useEffect } from 'react';
import { MenuIcon, SettingsIcon, SearchIcon, WaveformIcon, ActivityIcon } from './Icon';
import Led from './ui/Led';
import Engraved from './ui/Engraved';

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
}

const AVAILABLE_MODELS = [
  { id: 'gemini-3.6-flash', label: 'GEMINI-3.6 FLASH', tag: 'RECOMMENDED' },
  { id: 'gemini-2.5-flash', label: 'GEMINI-2.5 FLASH', tag: 'STABLE' },
  { id: 'gemini-2.0-flash', label: 'GEMINI-2.0 FLASH', tag: 'LITE' },
];

export const Header: React.FC<HeaderProps> = ({
  activeModel,
  onSelectModel,
  onOpenKnowledgeBase,
  onOpenCommandPalette,
  onOpenMobileSidebar,
  currentSessionTitle,
  hasActiveSession = false,
  latencyMs,
  isStreaming = false,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [idleTtft, setIdleTtft] = useState(114);

  // Subtle analog idle-drift when not measuring live request
  useEffect(() => {
    if (latencyMs || isStreaming) return;
    const interval = setInterval(() => {
      setIdleTtft((prev) => {
        const jitter = Math.floor(Math.random() * 5) - 2;
        return Math.max(102, Math.min(128, prev + jitter));
      });
    }, 4200);
    return () => clearInterval(interval);
  }, [latencyMs, isStreaming]);

  const currentModelObj =
    AVAILABLE_MODELS.find((m) => m.id === activeModel) || AVAILABLE_MODELS[0];
  const displayedLatency = latencyMs !== undefined ? latencyMs : idleTtft;

  return (
    <header className="h-14 border-b border-audio-border bg-[#130E0B]/95 backdrop-blur-md flex items-center justify-between px-3 md:px-6 z-20 select-none brushed flex-shrink-0">
      {/* LEFT CLUSTER */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-1.5 -ml-1 text-audio-muted hover:text-audio-text rounded-lg hover:bg-audio-surface transition-colors"
          title="Toggle Navigation"
        >
          <MenuIcon />
        </button>

        {/* LED + ONLINE Status */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#18130F] border border-audio-border/80">
          <Led color="green" pulse size="sm" />
          <span className="font-mono text-[10px] text-audio-signal font-bold tracking-widest hidden sm:inline">
            ONLINE
          </span>
        </div>

        <span className="text-audio-border/80 hidden sm:inline">|</span>

        {/* Model Selector styled like a rotary hardware switch */}
        <div className="relative">
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-1.5 bg-[#18130F] hover:bg-audio-surface border border-audio-border hover:border-audio-accent/50 px-2.5 py-1 rounded-lg transition-all text-[10px] font-mono font-semibold text-audio-text"
          >
            <span className="text-audio-muted uppercase tracking-wider text-[9px]">ENGINE:</span>
            <span className="text-audio-accent tracking-wide">{currentModelObj.label}</span>
            <span className="text-[8px] text-audio-muted ml-0.5">▼</span>
          </button>

          {isModelDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsModelDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-60 panel rounded-xl p-1.5 z-40 shadow-2xl border border-audio-border bg-[#1A1410] animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 mb-1">
                  <Engraved size="xs">ROTARY ENGINE SELECTOR</Engraved>
                </div>
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = model.id === activeModel;
                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        onSelectModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs font-mono transition-colors ${
                        isSelected
                          ? 'bg-audio-accent text-black font-bold shadow-glow-brass'
                          : 'text-audio-text hover:bg-audio-highlight hover:text-audio-accent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-black' : 'bg-audio-muted'
                          }`}
                        />
                        <span>{model.label}</span>
                      </div>
                      <span
                        className={`text-[9px] px-1 py-0.5 rounded uppercase ${
                          isSelected
                            ? 'bg-black/20 text-black'
                            : 'bg-audio-surface text-audio-muted border border-audio-border'
                        }`}
                      >
                        {model.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* TTFT Readout with living telemetry */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-mono text-audio-muted/80 bg-[#16110D] px-2.5 py-1 rounded-lg border border-audio-border/60 select-none">
          <span className="text-audio-muted/60 tracking-wider">TTFT:</span>
          {isStreaming ? (
            <span className="text-audio-accent font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-audio-accent animate-pulse" />
              <span>STREAMING…</span>
            </span>
          ) : (
            <span className="text-audio-signal font-semibold tracking-wide flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${latencyMs ? 'bg-audio-signal' : 'bg-audio-signal/70 animate-pulse'}`} />
              <span>{displayedLatency}ms</span>
              {latencyMs && <span className="text-[8px] text-audio-muted/60 font-normal">REAL</span>}
            </span>
          )}
        </div>
      </div>

      {/* CENTER (IN-CHAT BREADCRUMB) */}
      <div className="hidden md:flex items-center gap-1.5 max-w-sm lg:max-w-md truncate px-2 text-center">
        {hasActiveSession && currentSessionTitle ? (
          <div className="flex items-center gap-1.5 truncate">
            <Engraved size="xs" className="flex-shrink-0 text-audio-accent/80">
              SESSION /
            </Engraved>
            <span className="text-xs font-medium text-audio-text/90 truncate">
              {currentSessionTitle}
            </span>
          </div>
        ) : (
          <Engraved size="xs" className="text-audio-muted/60">
            AUDIOPHILE RESEARCH WORKBENCH
          </Engraved>
        )}
      </div>

      {/* RIGHT CLUSTER */}
      <div className="flex items-center gap-2">
        {/* Command Palette Button */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1.5 text-xs text-audio-muted hover:text-audio-accent bg-audio-surface hover:bg-audio-highlight border border-audio-border hover:border-audio-accent/50 px-2.5 py-1.5 rounded-lg transition-all font-mono"
            title="Command Palette (⌘K)"
          >
            <SearchIcon />
            <span className="hidden sm:inline text-[10px]">⌘K</span>
          </button>
        )}

        {/* Graph Lab Full-Screen Explorer Button */}
        <button
          onClick={() => labStore.setIsOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-audio-signal hover:text-audio-text bg-[#111C16] hover:bg-audio-surface border border-audio-signal/60 hover:border-audio-signal px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider font-mono shadow-glow-teal"
          title="Open Graph Lab: Full-Screen Measurement-Grade Explorer"
        >
          <WaveformIcon />
          <span className="hidden sm:inline">Graph Lab</span>
          <span className="sm:hidden">Lab</span>
        </button>

        {/* Knowledge Base Hardware Toggle Button */}
        <button
          onClick={onOpenKnowledgeBase}
          className="flex items-center gap-2 text-xs font-semibold text-audio-accent hover:text-audio-accent-bright bg-audio-accent/10 hover:bg-audio-accent/20 border border-audio-accent/50 hover:border-audio-accent px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider font-mono shadow-glow-brass"
        >
          <SettingsIcon />
          <span className="hidden sm:inline">Knowledge Base</span>
          <span className="sm:hidden">KB</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
