import React from 'react';
import { AudioProfile, ChatSession } from '../types';
import { WaveformIcon, EqIcon, HeadphonesIcon, SwordsIcon, SearchIcon, ActivityIcon, PlusIcon, StarIcon } from './Icon';
import Panel from './ui/Panel';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import VUMeter from './ui/VUMeter';
import StatDial from './ui/StatDial';
import CompositeSineCanvas from './CompositeSineCanvas';

interface HomeConsoleProps {
  profile: AudioProfile;
  sessions: ChatSession[];
  hasApiKey: boolean;
  onSelectPrompt: (prompt: string) => void;
  onAutoEQClick: () => void;
  onOpenKnowledgeBase: (tab?: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge') => void;
}

export const HomeConsole: React.FC<HomeConsoleProps> = ({
  profile,
  sessions,
  hasApiKey,
  onSelectPrompt,
  onAutoEQClick,
  onOpenKnowledgeBase,
}) => {
  const memoriesCount = profile.savedMemories?.length || 0;
  const gearCount = profile.gearLibrary?.length || 0;
  const eqCount = profile.eqLibrary?.length || 0;
  const sessionsCount = sessions.length;

  const isGearRegistered = gearCount > 0;
  const isEqCreated = eqCount > 0;
  const allCalibrated = hasApiKey && isGearRegistered && isEqCreated;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 py-4 pb-14 px-2 md:px-4 stagger">
      {/* =========================================================================
          ROW A — HERO RACK (2-col on lg)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 cols: Title, Welcome, Stat Dials */}
        <Panel className="lg:col-span-7 p-5 md:p-6 flex flex-col justify-between" brushed>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-audio-accent shadow-[0_0_8px_#C6934F]" />
              <Engraved size="xs">20HZ — 20KHZ • AUDIOPHILE RESEARCH CONSOLE</Engraved>
            </div>

            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-[#EDE6DA] via-[#E7B87A] to-[#C6934F] bg-clip-text text-transparent leading-[1.15]">
              Acoustic Intelligence Workbench
            </h1>

            <p className="text-audio-muted text-xs md:text-sm mt-2 leading-relaxed max-w-xl font-sans">
              Welcome to the chassis,{' '}
              <span className="text-audio-accent font-semibold underline decoration-audio-accent/40 underline-offset-4 cursor-pointer hover:text-audio-accent-bright transition-colors" onClick={() => onOpenKnowledgeBase('profile')}>
                {profile.name || 'Phoenix User'}
              </span>
              . Calibrated for Crinacle IEF 2025, PEQ filter synthesis, and multimodal audio telemetry.
            </p>
          </div>

          {/* 4 Stat Dials — Rule: numbers cream at zero, brass when non-zero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            <StatDial
              label="Memories"
              value={memoriesCount}
              subtext="Permanent facts"
              onClick={() => onOpenKnowledgeBase('memory')}
            />
            <StatDial
              label="Gear Rack"
              value={gearCount}
              subtext="Tracked items"
              onClick={() => onOpenKnowledgeBase('gear')}
            />
            <StatDial
              label="EQ Library"
              value={eqCount}
              subtext="Curves & PEQ"
              onClick={() => onOpenKnowledgeBase('eq')}
            />
            <StatDial
              label="Sessions"
              value={sessionsCount}
              subtext="Shootout logs"
            />
          </div>
        </Panel>

        {/* Right 5 cols: Hardware Monitor Bay */}
        <Panel className="lg:col-span-5 p-4 flex flex-col justify-between bg-[#140F0C]" brushed>
          <div className="flex justify-between items-center mb-2 px-1">
            <Engraved size="xs" glow>MONITOR BAY • ANALOG TELEMETRY</Engraved>
            <div className="flex items-center gap-1.5">
              <Led color="green" pulse size="sm" bootDelay={150} />
              <span className="font-mono text-[9px] text-audio-signal uppercase tracking-wider">CALIBRATED</span>
            </div>
          </div>

          {/* Dual VU Meters with initial load sweep */}
          <div className="grid grid-cols-2 gap-2.5 my-1">
            <VUMeter label="INPUT CH-A" sublabel="SIGNAL L" size="sm" />
            <VUMeter label="OUTPUT CH-B" sublabel="REFERENCE R" size="sm" />
          </div>

          {/* Composite Waveform Canvas */}
          <div className="mt-2">
            <CompositeSineCanvas />
          </div>
        </Panel>
      </div>

      {/* =========================================================================
          ROW B — SYSTEM SETUP CHECKLIST (Interactive & Clickable)
          ========================================================================= */}
      <Panel className="p-4 bg-[#16110D] border-audio-border/90">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Engraved size="xs" glow={!allCalibrated}>
              {allCalibrated ? 'SYSTEM STATUS: ALL CHANNELS OPERATIONAL' : 'SYSTEM SETUP & CALIBRATION'}
            </Engraved>
          </div>
          <span className="font-mono text-[10px] text-audio-muted/80 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${allCalibrated ? 'bg-audio-signal' : 'bg-audio-accent animate-pulse'}`} />
            {allCalibrated ? '3 / 3 VERIFIED' : 'ACTION REQUIRED'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Item 1: API Key */}
          <div
            onClick={() => onOpenKnowledgeBase('memory')}
            className={`panel-interactive p-3.5 rounded-xl border flex items-center justify-between cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 ${
              hasApiKey
                ? 'bg-[#121A15] border-audio-signal/30 text-audio-signal hover:border-audio-signal/70'
                : 'bg-[#21120D] border-audio-led-red/40 text-audio-led-red hover:border-audio-led-red'
            }`}
          >
            <div className="flex items-center gap-3">
              <Led color={hasApiKey ? 'green' : 'red'} pulse={!hasApiKey} size="md" bootDelay={250} />
              <div>
                <div className="text-xs font-semibold font-display">
                  {hasApiKey ? 'Gemini API Key Active' : 'Configure Gemini API Key'}
                </div>
                <div className="text-[10px] font-mono opacity-80 mt-0.5">
                  {hasApiKey ? 'Models reachable & verified' : 'Click to add & test key'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] group-hover:translate-x-1 transition-transform">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-70">
                {hasApiKey ? 'ACTIVE' : 'SETUP'}
              </span>
              <span>→</span>
            </div>
          </div>

          {/* Item 2: Gear Rack */}
          <div
            onClick={() => onOpenKnowledgeBase('gear')}
            className={`panel-interactive p-3.5 rounded-xl border flex items-center justify-between cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 ${
              isGearRegistered
                ? 'bg-[#181410] border-audio-accent/40 text-audio-accent hover:border-audio-accent'
                : 'bg-[#1D1713] border-audio-border text-audio-muted hover:border-audio-accent/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Led color={isGearRegistered ? 'green' : 'amber'} size="md" bootDelay={450} />
              <div>
                <div className="text-xs font-semibold font-display text-audio-text group-hover:text-audio-accent transition-colors">
                  {isGearRegistered ? `${gearCount} Gear Registered` : 'Register Audio Gear'}
                </div>
                <div className="text-[10px] font-mono text-audio-muted mt-0.5">
                  {isGearRegistered ? 'IEMs & DACs active' : 'Add your daily drivers'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-audio-muted group-hover:text-audio-accent group-hover:translate-x-1 transition-all">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80">
                {isGearRegistered ? 'MANAGE' : 'ADD'}
              </span>
              <span>→</span>
            </div>
          </div>

          {/* Item 3: EQ Profile */}
          <div
            onClick={() => onOpenKnowledgeBase('eq')}
            className={`panel-interactive p-3.5 rounded-xl border flex items-center justify-between cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 ${
              isEqCreated
                ? 'bg-[#181410] border-audio-accent/40 text-audio-accent hover:border-audio-accent'
                : 'bg-[#1D1713] border-audio-border text-audio-muted hover:border-audio-accent/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Led color={isEqCreated ? 'green' : 'amber'} size="md" bootDelay={650} />
              <div>
                <div className="text-xs font-semibold font-display text-audio-text group-hover:text-audio-accent transition-colors">
                  {isEqCreated ? `${eqCount} EQ Curves Ready` : 'Create First EQ Target'}
                </div>
                <div className="text-[10px] font-mono text-audio-muted mt-0.5">
                  {isEqCreated ? 'Wavelet & PEQ active' : 'Build or import PEQ'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-audio-muted group-hover:text-audio-accent group-hover:translate-x-1 transition-all">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80">
                {isEqCreated ? 'VIEW' : 'CREATE'}
              </span>
              <span>→</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* =========================================================================
          ROW C — PRESET MODULES (4 Upgraded Interactive Cards)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: FIND IEM */}
        <div
          onClick={() => onSelectPrompt("Find me the best IEM under $100 with wide holographic soundstage and clean imaging for gaming and vocal music")}
          className="panel-interactive p-4 rounded-xl border border-audio-border bg-gradient-to-b from-[#1C1713] to-[#14100D] group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="w-8 h-8 rounded-lg bg-audio-surface border border-audio-border flex items-center justify-center text-audio-signal group-hover:border-audio-signal transition-colors">
                <HeadphonesIcon />
              </div>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-audio-surface border border-audio-border text-audio-signal font-bold tracking-wider">
                &lt;$100 SPEC
              </span>
            </div>
            <h3 className="font-display font-semibold text-sm text-audio-text group-hover:text-audio-accent transition-colors">
              Find Best IEM
            </h3>
            <p className="text-xs text-audio-muted mt-1 leading-snug">
              Target wide soundstage, pinpoint imaging, and sub-bass under $100.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-audio-muted group-hover:text-audio-accent transition-colors">
            <span>RUN DISCOVERY</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* Card 2: COMPARE */}
        <div
          onClick={() => onSelectPrompt("Create a detailed comparison table between Simgot EW300 and Moondrop Aria 2 covering driver tech, soundstage, imaging, 200Hz tuck, and 8kHz sibilance risk")}
          className="panel-interactive p-4 rounded-xl border border-audio-border bg-gradient-to-b from-[#1C1713] to-[#14100D] group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="w-8 h-8 rounded-lg bg-audio-surface border border-audio-border flex items-center justify-center text-audio-accent group-hover:border-audio-accent transition-colors">
                <SwordsIcon />
              </div>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-audio-surface border border-audio-border text-audio-accent font-bold tracking-wider">
                SPEC TABLE
              </span>
            </div>
            <h3 className="font-display font-semibold text-sm text-audio-text group-hover:text-audio-accent transition-colors">
              Battle Mode Shootout
            </h3>
            <p className="text-xs text-audio-muted mt-1 leading-snug">
              Side-by-side shootout with driver specs, decay, and 8kHz sibilance analysis.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-audio-muted group-hover:text-audio-accent transition-colors">
            <span>START COMPARISON</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* Card 3: AUTO-EQ */}
        <div
          onClick={onAutoEQClick}
          className="panel-interactive p-4 rounded-xl border border-audio-border bg-gradient-to-b from-[#1C1713] to-[#14100D] group cursor-pointer flex flex-col justify-between relative overflow-hidden"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="w-8 h-8 rounded-lg bg-audio-surface border border-audio-border flex items-center justify-center text-audio-accent group-hover:border-audio-accent transition-colors">
                <EqIcon />
              </div>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-audio-surface border border-audio-border text-audio-accent font-bold tracking-wider">
                FR → PEQ
              </span>
            </div>
            <h3 className="font-display font-semibold text-sm text-audio-text group-hover:text-audio-accent transition-colors">
              Auto-EQ Targeter
            </h3>
            <p className="text-xs text-audio-muted mt-1 leading-snug">
              Upload any FR graph image to calculate Crinacle IEF 2025 gain offsets.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-audio-muted group-hover:text-audio-accent transition-colors">
            <span>UPLOAD GRAPH</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* Card 4: UPGRADE */}
        <div
          onClick={() => onSelectPrompt(`Suggest an upgrade path from my ${profile.currentGear?.split(',')[0] || 'current IEMs'} that offers wider soundstage, better decay, and zero sibilance`)}
          className="panel-interactive p-4 rounded-xl border border-audio-border bg-gradient-to-b from-[#1C1713] to-[#14100D] group cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="w-8 h-8 rounded-lg bg-audio-surface border border-audio-border flex items-center justify-center text-audio-warn group-hover:border-audio-warn transition-colors">
                <ActivityIcon />
              </div>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-audio-surface border border-audio-border text-audio-warn font-bold tracking-wider">
                FLAGSHIP
              </span>
            </div>
            <h3 className="font-display font-semibold text-sm text-audio-text group-hover:text-audio-accent transition-colors">
              Upgrade Pathway
            </h3>
            <p className="text-xs text-audio-muted mt-1 leading-snug">
              Suggest an upgrade path tailored to your permanent sensitivity profile.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-audio-muted group-hover:text-audio-accent transition-colors">
            <span>RECOMMEND</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW D — GEAR RACK RAIL (Collapsed slim one-liner if 0, full rail if >0)
          ========================================================================= */}
      {isGearRegistered ? (
        <Panel className="p-4 bg-[#140F0C]">
          <div className="flex justify-between items-center mb-3 px-1">
            <div className="flex items-center gap-2">
              <Engraved size="xs">ACTIVE GEAR RACK ({gearCount})</Engraved>
            </div>
            <button
              onClick={() => onOpenKnowledgeBase('gear')}
              className="text-[10px] font-mono text-audio-accent hover:underline flex items-center gap-1"
            >
              <span>MANAGE GEAR</span>
              <span>→</span>
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {profile.gearLibrary?.map((gear) => (
              <div
                key={gear.id}
                onClick={() => onOpenKnowledgeBase('gear')}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-audio-border bg-audio-surface hover:border-audio-accent/50 cursor-pointer transition-all flex-shrink-0 select-none group"
              >
                <Led color={gear.status === 'owned' ? 'green' : 'amber'} size="sm" />
                <div>
                  <div className="text-xs font-semibold text-audio-text group-hover:text-audio-accent transition-colors flex items-center gap-2">
                    <span>{gear.name}</span>
                    {gear.price && <span className="text-[10px] font-mono text-audio-muted font-normal">{gear.price}</span>}
                  </div>
                  <div className="text-[9px] font-mono text-audio-muted uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                    <span>{gear.type}</span>
                    <span>•</span>
                    <span className={gear.status === 'owned' ? 'text-audio-signal' : 'text-audio-accent'}>
                      {gear.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Ghost + Add Gear Chip */}
            <button
              onClick={() => onOpenKnowledgeBase('gear')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-audio-border hover:border-audio-accent/80 text-audio-muted hover:text-audio-accent text-xs font-mono uppercase tracking-wider transition-all flex-shrink-0 bg-[#17120E]"
            >
              <PlusIcon />
              <span>+ Add Gear</span>
            </button>
          </div>
        </Panel>
      ) : (
        /* Slim one-line row when rack is empty */
        <div
          onClick={() => onOpenKnowledgeBase('gear')}
          className="panel-interactive p-3.5 rounded-xl bg-[#140F0C] border border-audio-border/80 hover:border-audio-accent/60 cursor-pointer flex items-center justify-between group transition-all duration-200 hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3">
            <Led color="amber" pulse size="sm" bootDelay={500} />
            <span className="font-mono text-xs text-audio-muted group-hover:text-audio-text transition-colors">
              Rack empty — register your first driver
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs text-audio-accent group-hover:translate-x-1 transition-all">
            <span className="text-[10px] tracking-wider uppercase font-semibold">REGISTER DRIVER</span>
            <span>→</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          ROW E — MEMORY LANE (Permanent Knowledge Readout)
          ========================================================================= */}
      <Panel className="p-4 bg-[#140F0C]">
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="flex items-center gap-2">
            <Engraved size="xs">FROM PERMANENT MEMORY</Engraved>
            <span className="text-[10px] font-mono text-audio-muted/70">
              (RAG Injected into Gemini Prompts)
            </span>
          </div>
          <button
            onClick={() => onOpenKnowledgeBase('memory')}
            className="text-[10px] font-mono text-audio-accent hover:underline flex items-center gap-1"
          >
            <span>VIEW ALL ({memoriesCount})</span>
            <span>→</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {profile.savedMemories && profile.savedMemories.length > 0 ? (
            profile.savedMemories.slice(0, 3).map((memory, i) => (
              <div
                key={i}
                onClick={() => onOpenKnowledgeBase('memory')}
                className="p-3 rounded-xl border border-audio-border bg-audio-surface/60 hover:border-audio-accent/40 cursor-pointer transition-colors text-left flex flex-col justify-between"
              >
                <p className="text-xs text-audio-text/90 leading-snug line-clamp-2">
                  {memory}
                </p>
                <div className="mt-2 text-[9px] font-mono text-audio-muted flex justify-between items-center">
                  <span>RULE #{i + 1}</span>
                  <span className="text-audio-accent">PERMANENT</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-4 text-xs text-audio-muted">
              No permanent memories saved yet. Add acoustic sensitivities in Settings.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default HomeConsole;
