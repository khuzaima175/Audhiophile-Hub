import { audioWorkspace, freshDraft } from '../store/audioWorkspace';
import React from 'react';
import { AudioProfile, ChatSession } from '../types';
import { EqIcon, HeadphonesIcon, SearchIcon, WaveformIcon, PlusIcon } from './Icon';
import { labStore } from '../store/labStore';
interface HomeConsoleProps {
  profile: AudioProfile;
  sessions: ChatSession[];
  hasApiKey: boolean;
  onSelectPrompt: (prompt: string) => void;
  onAutoEQClick: () => void;
  onOpenKnowledgeBase: (tab?: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge') => void;
  onSelectSession?: (id: string) => void;
}
export default function HomeConsole({
  profile,
  sessions,
  hasApiKey,
  onSelectPrompt,
  onAutoEQClick,
  onOpenKnowledgeBase,
  onSelectSession,
}: HomeConsoleProps) {
  const recent = [...sessions]
    .filter((s) => s.messages.length)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  const gear = profile.gearLibrary || [];
  return (
    <div className="overview-page">
      <div className="page-intro">
        <div>
          <p className="eyebrow">A little clarity. A better listen.</p>
          <h1>
            Your sound, in focus<span>.</span>
          </h1>
          <p>Explore your gear, find your sound, and make every listen better.</p>
        </div>
        <button className="secondary-button" onClick={() => onOpenKnowledgeBase('profile')}>
          <HeadphonesIcon />
          Your listening profile
        </button>
      </div>
      <section className="welcome-feature">
        <div className="welcome-copy">
          <span className="feature-tag">
            <span />
            YOUR PERSONAL AUDIO WORKSPACE
          </span>
          <h2>
            Great sound starts
            <br />
            with the right questions.
          </h2>
          <p>
            Get thoughtful answers about headphones, compare your next upgrade, or fine-tune the gear you
            already love.
          </p>
          <button
            className="primary-button"
            onClick={() =>
              onSelectPrompt('Help me find the right headphones for my listening preferences and budget.')
            }
          >
            <SearchIcon />
            Start exploring <span>↗</span>
          </button>
        </div>
        <div className="sound-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="sound-center">
            <HeadphonesIcon />
          </div>
          <span className="visual-label label-top">FIND YOUR FREQUENCY</span>
          <svg viewBox="0 0 440 120" className="visual-wave">
            <path
              d="M0 60 Q20 60 30 60 T60 60 Q70 20 80 60 T100 60 Q110 100 120 60 T140 60 Q150 0 160 60 T180 60 Q190 120 200 60 T220 60 Q230 0 240 60 T260 60 Q270 100 280 60 T300 60 Q310 30 320 60 T340 60 L440 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span className="visual-label label-bottom">
            20 Hz <span>—</span> 20 kHz
          </span>
        </div>
      </section>
      {!hasApiKey && (
        <div className="setup-notice">
          <div className="notice-icon">✦</div>
          <div>
            <strong>Connect your research assistant</strong>
            <p>
              Add a Gemini API key to use AI research. Your gear, equalizer, and graph tools are ready to use.
            </p>
          </div>
          <button className="secondary-button" onClick={() => onOpenKnowledgeBase('memory')}>
            Set up AI <span>→</span>
          </button>
        </div>
      )}
      <div className="section-heading">
        <h2>What would you like to do?</h2>
        <span>Choose a starting point</span>
      </div>
      <div className="workflow-grid">
        {[
          {
            icon: <SearchIcon />,
            tag: 'DISCOVER',
            title: 'Find your next upgrade',
            desc: 'Ask questions and compare gear with your taste in mind.',
            action: 'Start research',
            click: () =>
              onSelectPrompt(
                'Compare headphones or IEMs for me. Ask about my budget and listening preferences first.',
              ),
          },
          {
            icon: <EqIcon />,
            tag: 'FINE-TUNE',
            title: 'Manual EQ',
            desc: 'Create, edit, and try an EQ preset for your headphones.',
            action: 'Start manual EQ',
            click: () => { if (audioWorkspace.getSnapshot().draft.dirty && !window.confirm('Replace unfinished Audio work?')) return; audioWorkspace.replace({ ...freshDraft(), workbenchState: 'ADDING' }); onOpenKnowledgeBase('eq'); },
          },
          {
            icon: <WaveformIcon />,
            tag: 'UNDERSTAND',
            title: 'Measurement-based EQ',
            desc: 'Upload measurements and compare frequency response curves.',
            action: 'Import a measurement',
            click: () => { audioWorkspace.update({ workbenchState: 'MEASUREMENT' }, false); onOpenKnowledgeBase('eq'); },
          },
        ].map((item) => (
          <button className="workflow-card" key={item.tag} onClick={item.click}>
            <div className="workflow-top">
              <span className="workflow-icon">{item.icon}</span>
              <span>{item.tag}</span>
              <span className="workflow-arrow">↗</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
            <span className="workflow-action">
              {item.action}
              <span>→</span>
            </span>
          </button>
        ))}
      </div>
      <div className="overview-bottom">
        <section className="library-section">
          <div className="section-heading">
            <h2>Your collection</h2>
            <button className="text-button" onClick={() => onOpenKnowledgeBase('gear')}>
              Manage gear →
            </button>
          </div>
          {gear.length ? (
            <div className="collection-list">
              {gear.slice(0, 3).map((g) => (
                <button key={g.id} onClick={() => onOpenKnowledgeBase('gear')}>
                  <span className="gear-symbol">
                    <HeadphonesIcon />
                  </span>
                  <span>
                    <strong>{g.name}</strong>
                    <small>
                      {g.type} · {g.status === 'tried' ? 'Tested' : g.status}
                    </small>
                  </span>
                  <span>↗</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="collection-empty">
              <HeadphonesIcon />
              <div>
                <strong>A home for your favorite gear</strong>
                <p>Keep your headphones, IEMs, and wishlist in one place.</p>
              </div>
              <button className="secondary-button" onClick={() => onOpenKnowledgeBase('gear')}>
                <PlusIcon />
                Add gear
              </button>
            </div>
          )}
          <div className="library-summary">
            <button onClick={() => onOpenKnowledgeBase('eq')}>
              <strong>{profile.eqLibrary?.length || 0}</strong> saved EQ presets<span>↗</span>
            </button>
            <button onClick={() => onOpenKnowledgeBase('knowledge')}>
              <strong>{profile.savedMemories?.length || 0}</strong> listening notes<span>↗</span>
            </button>
          </div>
        </section>
        <section className="recent-section">
          <div className="section-heading">
            <h2>Pick up where you left off</h2>
          </div>
          {recent.length ? (
            recent.map((s) => (
              <button className="recent-item" key={s.id} onClick={() => onSelectSession?.(s.id)}>
                <span className="recent-dot" />
                <span>
                  <strong>{s.title}</strong>
                  <small>
                    {new Date(s.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                    · {s.messages.length} messages
                  </small>
                </span>
                <span>→</span>
              </button>
            ))
          ) : (
            <div className="recent-empty">
              <span>✧</span>
              <strong>A fresh start sounds good.</strong>
              <p>Start a conversation and return to your research here.</p>
              <button className="text-button" onClick={onAutoEQClick}>
                Have a response graph? Analyze it →
              </button>
            </div>
          )}
        </section>
      </div>
      <div className="overview-footnote">
        <span className="mini-wave">▂ ▅ ▇ ▃ ▆</span>Made for curious listeners.
        <span>Research · Compare · Listen</span>
      </div>
    </div>
  );
}
