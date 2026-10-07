import { resolveApiKey, testAiConnection } from '../services/aiConfig';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AudioProfile, KnowledgeEntry, EQPreset, GearItem, DEFAULT_PROFILE } from '../types';
import {
  PlusIcon,
  TrashIcon,
  BrainIcon,
  EqIcon,
  SaveIcon,
  LinkIcon,
  HeadphonesIcon,
  StarIcon,
  SwordsIcon,
  XIcon,
  CheckIcon,
  WaveformIcon,
  ActivityIcon,
} from './Icon';
import { generateBattleComparison } from '../services/geminiService';
import { validateProfile, validateChats, validateKnowledge } from '../utils/dataValidation';
import { EQWorkbench } from './EQWorkbench';
import {
  getStoredApoConfigPath,
  setStoredApoConfigPath,
  getStoredApoEnabled,
  setStoredApoEnabled,
  getStoredApoLastApplied,
  testApoWrite,
  toggleApoManagedBridge,
} from '../services/apoBridgeClient';
import { v4 as uuidv4 } from 'uuid';
import Led from './ui/Led';
import Engraved from './ui/Engraved';
import Fader from './ui/Fader';
import Panel from './ui/Panel';

interface SettingsModalProps {
  embedded?: boolean;
  isOpen: boolean;
  onClose: () => void;
  profile: AudioProfile;
  knowledgeBase: KnowledgeEntry[];
  onSave: (profile: AudioProfile) => void;
  onRestore?: (data: {
    profile?: AudioProfile;
    chats?: import('../types').ChatSession[];
    knowledgeBase?: KnowledgeEntry[];
  }) => void;
  onSummarizeHistory: () => void;
  isSummarizing: boolean;
  initialTab?: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge';
}

const TABS: { key: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge'; label: string; shortLabel: string }[] =
  [
    { key: 'profile', label: 'Listener Profile', shortLabel: 'Profile' },
    { key: 'eq', label: 'EQ Library', shortLabel: 'EQ' },
    { key: 'gear', label: 'Collection', shortLabel: 'Gear' },
    { key: 'memory', label: 'Manual Facts', shortLabel: 'Facts' },
    { key: 'knowledge', label: 'AI Knowledge', shortLabel: 'RAG' },
  ];

const TARGET_PRESETS = [
  { name: 'Crinacle IEF 2025 (B&K 5128)', desc: 'Natural tilt with clean 200Hz tuck & smooth treble' },
  { name: 'Harman IE 2019 Target', desc: 'Punchy sub-bass shelf with forward upper midrange' },
  { name: 'Diffuse Field Reference', desc: 'Airy, analytical reference with maximum soundstage' },
  { name: 'Sennheiser HD600 Warm-Neutral', desc: 'Organic vocal timbre and intimate natural decay' },
];

const TEN_BANDS = [
  { freq: '31Hz', label: '31.25' },
  { freq: '62Hz', label: '62.5' },
  { freq: '125Hz', label: '125' },
  { freq: '250Hz', label: '250' },
  { freq: '500Hz', label: '500' },
  { freq: '1kHz', label: '1000' },
  { freq: '2kHz', label: '2000' },
  { freq: '4kHz', label: '4000' },
  { freq: '8kHz', label: '8000' },
  { freq: '16kHz', label: '16000' },
];

const GEAR_TYPES: ('IEM' | 'Headphone' | 'DAC' | 'AMP' | 'Other')[] = [
  'IEM',
  'Headphone',
  'DAC',
  'AMP',
  'Other',
];
const GEAR_STATUSES: {
  key: 'owned' | 'wishlist' | 'tried';
  label: string;
  color: 'green' | 'amber' | 'teal';
}[] = [
  { key: 'owned', label: 'Owned', color: 'green' },
  { key: 'wishlist', label: 'Wishlist', color: 'amber' },
  { key: 'tried', label: 'Tested', color: 'teal' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  knowledgeBase = [],
  onSave,
  onRestore,
  onSummarizeHistory,
  isSummarizing,
  initialTab = 'profile',
  embedded = false,
}) => {
  const [formData, setFormData] = useState<AudioProfile>(profile || DEFAULT_PROFILE);
  const [activeTab, setActiveTab] = useState<'profile' | 'memory' | 'knowledge' | 'eq' | 'gear'>(initialTab);
  const [isSavedFlash, setIsSavedFlash] = useState(false);
  const [justAddedToast, setJustAddedToast] = useState<string | null>(null);

  // Equalizer APO System Bridge State
  const [apoConfigPath, setApoConfigPath] = useState(getStoredApoConfigPath());
  const [apoBridgeEnabled, setApoBridgeEnabled] = useState(getStoredApoEnabled());
  const [apoLastApplied, setApoLastApplied] = useState(getStoredApoLastApplied());
  const [apoTestStatus, setApoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Fader state for sound signature synthesis
  const [bassGain, setBassGain] = useState(profile?.faderState?.bassGain ?? 0);
  const [sibilanceGain, setSibilanceGain] = useState(profile?.faderState?.sibilanceGain ?? -2);
  const [airGain, setAirGain] = useState(profile?.faderState?.airGain ?? 1);

  // Memory & Form State
  const [newMemory, setNewMemory] = useState('');
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const importFileRef = useRef<HTMLInputElement>(null);

  // Gear Form State (State machine: EMPTY | IDLE | ADDING | BATTLING)
  const [isAddingGear, setIsAddingGear] = useState(false);
  const [newGear, setNewGear] = useState<Omit<GearItem, 'id' | 'addedAt'>>({
    name: '',
    type: 'IEM',
    status: 'owned',
    rating: 5,
    notes: '',
    price: '',
  });

  // Compare gear State
  const [battleMode, setBattleMode] = useState(false);
  const [selectedForBattle, setSelectedForBattle] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [battleAnalysis, setBattleAnalysis] = useState('');
  const [isBattleLoading, setIsBattleLoading] = useState(false);

  // AI Knowledge Search
  const [kbSearch, setKbSearch] = useState('');
  const [gearSearch, setGearSearch] = useState('');
  const [gearStatus, setGearStatus] = useState('all');

  // Track open state transitions
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      // Modal just opened: initialize tab to initialTab, sync faders, and reset sub-modes
      setFormData(profile || DEFAULT_PROFILE);
      if (initialTab) setActiveTab(initialTab);
      if (profile?.faderState) {
        setBassGain(profile.faderState.bassGain);
        setSibilanceGain(profile.faderState.sibilanceGain);
        setAirGain(profile.faderState.airGain);
      }
      setIsAddingGear(false);
      setBattleMode(false);
      setSelectedForBattle([]);
    } else if (isOpen && profile) {
      // Modal is already open: keep formData in sync with saved profile without resetting activeTab
      setFormData(profile);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialTab, profile]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setIsAddingGear(false);
    }
  }, [initialTab, isOpen]);

  const gearCount = formData.gearLibrary?.length || 0;

  // Check for unsaved changes (profile tab primarily)
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(profile || DEFAULT_PROFILE);
  }, [formData, profile]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value };
    setFormData(next);
    if (embedded) onSave(next);
  };

  const handleApplyFadersToPrefs = () => {
    const faderText = `Bass Tuning: ${bassGain > 0 ? `+${bassGain}dB` : `${bassGain}dB`} sub-bass shelf. Sibilance Protection: ${sibilanceGain}dB at 8kHz notch. Treble Air: ${airGain > 0 ? `+${airGain}dB` : `${airGain}dB`} above 10kHz.`;
    const cleanPrefs = (formData.technicalPrefs || '')
      .replace(/Bass Tuning:[^.]*\.\s*Sibilance Protection:[^.]*\.\s*Treble Air:[^.]*\.?/gi, '')
      .trim();
    const updated = cleanPrefs ? `${faderText}\n\n${cleanPrefs}` : faderText;
    const nextProfile = {
      ...formData,
      technicalPrefs: updated,
      faderState: { bassGain, sibilanceGain, airGain },
    };
    setFormData(nextProfile);
    onSave(nextProfile);
    setJustAddedToast('Applied faders to acoustic preferences');
    setTimeout(() => setJustAddedToast(null), 2500);
  };

  const handleAddMemory = () => {
    if (newMemory.trim()) {
      const updated = [...(formData.savedMemories || []), newMemory.trim()];
      const nextProfile = { ...formData, savedMemories: updated };
      setFormData(nextProfile);
      onSave(nextProfile); // Instant persist
      setNewMemory('');
    }
  };

  const handleRemoveMemory = (index: number) => {
    const updated = (formData.savedMemories || []).filter((_, i) => i !== index);
    const nextProfile = { ...formData, savedMemories: updated };
    setFormData(nextProfile);
    onSave(nextProfile); // Instant persist
  };

  // Instant Persist for Gear Registration
  const handleSaveGear = () => {
    if (newGear.name.trim()) {
      const item: GearItem = {
        id: uuidv4(),
        name: newGear.name.trim(),
        type: newGear.type,
        status: newGear.status,
        rating: newGear.rating,
        notes: newGear.notes?.trim(),
        price: newGear.price?.trim(),
        addedAt: Date.now(),
      };
      const updated = [...(formData.gearLibrary || []), item];
      const nextProfile = { ...formData, gearLibrary: updated };
      setFormData(nextProfile);
      onSave(nextProfile); // Instant persist! No double-commit needed.
      setIsAddingGear(false);
      setNewGear({ name: '', type: 'IEM', status: 'owned', rating: 5, notes: '', price: '' });
      setJustAddedToast(`Registered ${item.name} to Collection`);
      setTimeout(() => setJustAddedToast(null), 3000);
    }
  };

  const handleDeleteGear = (id: string) => {
    const updated = (formData.gearLibrary || []).filter((g) => g.id !== id);
    const nextProfile = { ...formData, gearLibrary: updated };
    setFormData(nextProfile);
    onSave(nextProfile); // Instant persist
    setSelectedForBattle((prev) => prev.filter((item) => item !== id));
  };

  const handleStartBattle = async () => {
    if (selectedForBattle.length < 2) return;

    const selectedGearData = selectedForBattle
      .map((id) => (formData.gearLibrary || []).find((g) => g.id === id))
      .filter(Boolean) as GearItem[];

    setShowComparison(true);
    setIsBattleLoading(true);
    setBattleAnalysis('');

    try {
      await generateBattleComparison(
        selectedGearData.map((g) => ({
          name: g.name,
          type: g.type,
          status: g.status,
          rating: g.rating,
          notes: g.notes,
          price: g.price,
        })),
        formData,
        (chunk) => {
          setBattleAnalysis((prev) => prev + chunk);
        },
      );
    } catch (error: any) {
      setBattleAnalysis(`**Error:** ${error.message}`);
    } finally {
      setIsBattleLoading(false);
    }
  };

  const renderShootoutMarkdown = (text: string) => {
    if (!text) return null;
    const cleanText = text.replace(/\\n/g, '\n');
    const lines = cleanText.split('\n');
    const nodes: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    const flushTable = (key: string) => {
      if (tableRows.length === 0) return;
      const dataRows = tableRows.filter((r) => !r.includes('---'));
      if (dataRows.length > 0) {
        const headers = dataRows[0]
          .split('|')
          .filter((c) => c.trim())
          .map((c) => c.trim());
        const body = dataRows.slice(1).map((r) =>
          r
            .split('|')
            .filter((c) => c.trim())
            .map((c) => c.trim()),
        );
        nodes.push(
          <div key={key} className="my-3 overflow-x-auto rounded-xl border border-audio-border bg-[#0E0B09]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-audio-border bg-[#222b25]">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-audio-accent font-mono text-[10px] uppercase tracking-wider font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rI) => (
                  <tr
                    key={rI}
                    className={`border-b border-audio-border/40 ${rI % 2 === 1 ? 'bg-black/20' : ''}`}
                  >
                    {row.map((cell, cI) => (
                      <td key={cI} className="px-3 py-2 text-[11px] text-audio-text/90">
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      tableRows = [];
      inTable = false;
    };

    const renderInlineFormatting = (str: string) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="text-audio-accent font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('|')) {
        inTable = true;
        tableRows.push(line);
        continue;
      }
      if (inTable) {
        flushTable(`table-${i}`);
      }
      if (line.startsWith('## ')) {
        nodes.push(
          <h3
            key={`h2-${i}`}
            className="font-display font-bold text-sm text-audio-accent mt-3 mb-1 border-b border-audio-border/60 pb-1"
          >
            {line.slice(3)}
          </h3>,
        );
      } else if (line.startsWith('### ')) {
        nodes.push(
          <h4 key={`h3-${i}`} className="font-display font-semibold text-xs text-audio-text mt-2 mb-1">
            {line.slice(4)}
          </h4>,
        );
      } else if (line.startsWith('> ')) {
        nodes.push(
          <div
            key={`quote-${i}`}
            className="p-2.5 my-2 rounded-lg bg-audio-accent/15 border-l-2 border-audio-accent text-xs font-medium text-audio-text"
          >
            {renderInlineFormatting(line.slice(2))}
          </div>,
        );
      } else if (line.startsWith('---')) {
        nodes.push(<hr key={`hr-${i}`} className="my-2 border-audio-border/50" />);
      } else if (line.trim().startsWith('- ')) {
        nodes.push(
          <li key={`li-${i}`} className="ml-4 list-disc text-xs text-audio-text/90 my-0.5">
            {renderInlineFormatting(line.trim().slice(2))}
          </li>,
        );
      } else if (line.trim() !== '') {
        nodes.push(
          <p key={`p-${i}`} className="text-xs text-audio-text/90 my-1 leading-relaxed">
            {renderInlineFormatting(line)}
          </p>,
        );
      }
    }
    if (inTable) {
      flushTable('table-end');
    }
    return nodes;
  };

  const handleExportData = () => {
    const chats = localStorage.getItem('audiosage_chats_v1');
    const profileData = localStorage.getItem('audiosage_profile_v1');
    const kb = localStorage.getItem('audiosage_knowledge_v1');
    const unreadableOriginals: Record<string, string> = {};
    const safeParse = (raw: string | null, fallback: unknown, key: string) => {
      try {
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        unreadableOriginals[key] = raw || '';
        return fallback;
      }
    };
    const data = {
      timestamp: new Date().toISOString(),
      profile: safeParse(profileData, formData, 'profile'),
      chats: safeParse(chats, [], 'chats'),
      knowledgeBase: safeParse(kb, [], 'knowledgeBase'),
      unreadableOriginals,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audiosage_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (
          (data.profile && !validateProfile(data.profile)) ||
          (data.chats && !validateChats(data.chats)) ||
          (data.knowledgeBase && !validateKnowledge(data.knowledgeBase))
        )
          throw new Error('Invalid backup data structure');
        if (!data || typeof data !== 'object' || (!data.profile && !data.chats && !data.knowledgeBase))
          throw new Error('Not an AudioSage backup');
        if (
          data.profile &&
          (typeof data.profile !== 'object' ||
            typeof data.profile.name !== 'string' ||
            ['gearLibrary', 'eqLibrary', 'savedMemories'].some(
              (key) => data.profile[key] !== undefined && !Array.isArray(data.profile[key]),
            ))
        )
          throw new Error('Invalid profile');
        if (
          data.chats &&
          (!Array.isArray(data.chats) ||
            !data.chats.every(
              (chat: any) =>
                typeof chat.id === 'string' && typeof chat.title === 'string' && Array.isArray(chat.messages),
            ))
        )
          throw new Error('Invalid conversations');
        if (data.knowledgeBase && !Array.isArray(data.knowledgeBase))
          throw new Error('Invalid research notes');
        if (data.profile) data.profile = { ...DEFAULT_PROFILE, ...data.profile };
        if (onRestore) {
          onRestore(data);
          setImportMessage({ type: 'success', text: 'Backup restored. Your workspace is up to date.' });
          return;
        }
        if (data.profile) {
          localStorage.setItem('audiosage_profile_v1', JSON.stringify(data.profile));
          setFormData(data.profile);
          onSave(data.profile);
        }
        if (data.chats) localStorage.setItem('audiosage_chats_v1', JSON.stringify(data.chats));
        if (data.knowledgeBase)
          localStorage.setItem('audiosage_knowledge_v1', JSON.stringify(data.knowledgeBase));

        setImportMessage({ type: 'success', text: `Backup restored! Refresh to update all views.` });
        setTimeout(() => setImportMessage(null), 5000);
      } catch (err) {
        setImportMessage({ type: 'error', text: 'Failed to parse backup file.' });
        setTimeout(() => setImportMessage(null), 5000);
      }
    };
    reader.readAsText(file);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleClearAllData = () => {
    localStorage.removeItem('audiosage_chats_v1');
    localStorage.removeItem('audiosage_profile_v1');
    localStorage.removeItem('audiosage_knowledge_v1');
    setShowClearConfirm(false);
    onClose();
    window.location.reload();
  };

  const handleSave = () => {
    onSave(formData);
    setIsSavedFlash(true);
    setTimeout(() => {
      setIsSavedFlash(false);
      if (!embedded) onClose();
    }, 350);
  };

  const inputClass =
    'w-full bg-[#191f1b] border border-audio-border rounded-xl px-4 py-3 text-audio-text focus:outline-none focus:border-audio-accent/70 focus:ring-1 focus:ring-audio-accent/30 transition-all placeholder-audio-muted/60 text-xs md:text-sm font-sans';
  const labelClass = 'text-[10px] font-bold text-audio-accent uppercase tracking-widest font-mono pl-1';

  return (
    <div
      className={
        embedded
          ? 'workspace-page'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 md:p-4'
      }
    >
      {/* Background click to dismiss */}
      {!embedded && <div className="fixed inset-0" onClick={onClose} />}

      <div
        className={
          embedded
            ? 'w-full'
            : 'panel w-full max-w-4xl p-6 flex flex-col max-h-[90vh] relative z-10 overflow-auto'
        }
        role={embedded ? undefined : 'dialog'}
        aria-modal={embedded ? undefined : true}
        aria-label="Listening workspace"
      >
        <div className="workspace-page-header">
          <div>
            <p className="eyebrow">Your listening workspace</p>
            <h1>
              {
                {
                  profile: 'Listening profile',
                  eq: 'Equalizer',
                  gear: 'My gear',
                  memory: 'Settings & data',
                  knowledge: 'Research notes',
                }[activeTab]
              }
            </h1>
            <p>
              {
                {
                  profile:
                    'Tell your assistant what you enjoy. Your preferences make every recommendation more personal.',
                  eq: 'Shape your sound. Create a preset, import an existing EQ, or match a measurement to a target.',
                  gear: 'Keep your collection and wishlist together. Select two or three items to compare.',
                  memory: 'Connect your AI assistant, manage integrations, and back up your workspace.',
                  knowledge:
                    'Keep the discoveries and listening preferences you want your assistant to remember.',
                }[activeTab]
              }
            </p>
          </div>
          {!embedded && (
            <button className="icon-button" onClick={onClose} aria-label="Close settings">
              <XIcon />
            </button>
          )}
        </div>
        {/* MODAL BODY */}
        <div className="workspace-page-body space-y-6">
          {/* =========================================================================
              TAB 1: LISTENER PROFILE & FADERS
              ========================================================================= */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Column: Profile Inputs & Target Chips */}
                <div className="md:col-span-7 space-y-4">
                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="profile-name">
                      Your name
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="profile-name"
                      value={formData.name || ''}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Your audiophile moniker..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="profile-soundSignature">
                      Your preferred sound
                    </label>
                    <textarea
                      name="soundSignature"
                      id="profile-soundSignature"
                      value={formData.soundSignature || ''}
                      onChange={handleChange}
                      className={`${inputClass} min-h-[75px] leading-relaxed`}
                      placeholder="Describe target preference curve..."
                    />
                    <label className="control-field">
                      Start from a sound preference
                      <select
                        aria-label="Sound preference template"
                        defaultValue=""
                        onChange={(e) => {
                          const preset = TARGET_PRESETS[Number(e.target.value)];
                          if (preset) {
                            const next = { ...formData, soundSignature: preset.name + ' — ' + preset.desc };
                            setFormData(next);
                            if (embedded) onSave(next);
                          }
                        }}
                      >
                        <option value="" disabled>
                          Choose a reference…
                        </option>
                        {TARGET_PRESETS.map((p, i) => (
                          <option key={p.name} value={i}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass} htmlFor="profile-currentGear">
                      Your everyday gear
                    </label>
                    <input
                      type="text"
                      name="currentGear"
                      id="profile-currentGear"
                      value={formData.currentGear || ''}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g. CCA Phoenix (Main), JCally JM6 Pro (DAC)..."
                    />
                  </div>
                </div>

                {/* Right Column: Live Fader Controls & System Prompt Greeting */}
                <div className="md:col-span-5 space-y-4">
                  <div className="p-3.5 bg-[#171d19] rounded-xl border border-audio-border">
                    <div className="flex items-center justify-between mb-2">
                      <Engraved size="xs" glow>
                        Fine-tune your preferences
                      </Engraved>
                      <button
                        type="button"
                        onClick={handleApplyFadersToPrefs}
                        className="text-[9px] font-mono text-audio-accent hover:underline"
                      >
                        Apply to Rules
                      </button>
                    </div>

                    <div className="space-y-3">
                      <Fader
                        label="Sub-Bass Shelf (100Hz)"
                        value={bassGain}
                        min={-6}
                        max={6}
                        step={0.5}
                        onChange={setBassGain}
                        ticks={['-6dB', '0dB', '+6dB']}
                      />
                      <Fader
                        label="8kHz Sibilance Notch"
                        value={sibilanceGain}
                        min={-6}
                        max={3}
                        step={0.5}
                        onChange={setSibilanceGain}
                        ticks={['-6dB', '-2dB', '+3dB']}
                      />
                      <Fader
                        label="10kHz+ Treble Air"
                        value={airGain}
                        min={-4}
                        max={6}
                        step={0.5}
                        onChange={setAirGain}
                        ticks={['-4dB', '0dB', '+6dB']}
                      />
                    </div>
                  </div>

                  {/* System Prompt Preview Card */}
                  <div className="p-3.5 bg-[#171d19] rounded-xl border border-audio-border text-left">
                    <Engraved size="xs" className="mb-1.5 block">
                      Your preference preview
                    </Engraved>
                    <div className="text-[10px] font-mono text-audio-muted/90 bg-black/40 p-2.5 rounded-lg border border-audio-border/50 leading-relaxed">
                      &quot;Welcome back,{' '}
                      <span className="text-audio-accent">{formData.name || 'Phoenix User'}</span>. Tuning
                      against{' '}
                      <span className="text-audio-signal">
                        {(formData.soundSignature || 'Crinacle IEF 2025').slice(0, 28)}…
                      </span>{' '}
                      with {bassGain !== 0 && `bass offset ${bassGain}dB, `}
                      {sibilanceGain < 0 && `8kHz sibilance guard active.`}&quot;
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="control-field">
                  Favorite genres
                  <input
                    name="preferredGenres"
                    value={formData.preferredGenres || ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Jazz, electronic, acoustic…"
                  />
                </label>
                <label className="control-field">
                  Other listening notes
                  <textarea
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="How and where you listen…"
                  />
                </label>
              </div>
              {/* Technical Preferences Section */}
              <div className="space-y-1.5 pt-2">
                <label className={labelClass} htmlFor="profile-technicalPrefs">
                  Listening preferences & sensitivities
                </label>
                <textarea
                  name="technicalPrefs"
                  id="profile-technicalPrefs"
                  value={formData.technicalPrefs || ''}
                  onChange={handleChange}
                  className={`${inputClass} min-h-[90px] leading-relaxed`}
                  placeholder="Soundstage, holographic imaging, transient decay, tip preference, sibilance sensitivities..."
                />
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: EQ WORKBENCH & DSP AUDITION ENGINE
              ========================================================================= */}
          {activeTab === 'eq' && (
            <EQWorkbench
              presets={formData.eqLibrary || []}
              gear={formData.gearLibrary || []}
              onSavePresets={(updated) => {
                const next = { ...formData, eqLibrary: updated };
                setFormData(next);
                onSave(next);
              }}
            />
          )}

          {/* =========================================================================
              TAB 3: GEAR RACK (Refined Single-Action State Machine)
              ========================================================================= */}
          {activeTab === 'gear' && (
            <div className="space-y-5 max-w-4xl mx-auto">
              {/* STATE A: EMPTY STATE (gearCount === 0 && !isAddingGear) */}
              {gearCount === 0 && !isAddingGear && (
                <div className="text-center py-16 px-4 border border-dashed border-audio-border rounded-2xl bg-[#171d19] flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-audio-surface border border-audio-border flex items-center justify-center text-audio-accent mb-3 shadow-panel">
                    <HeadphonesIcon />
                  </div>
                  <h3 className="font-display font-bold text-base text-audio-text">
                    Your collection starts here
                  </h3>
                  <p className="text-xs text-audio-muted mt-1 max-w-sm">
                    Add your headphones, IEMs, and audio equipment. Keep a wishlist and compare your options
                    side by side.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddingGear(true)}
                    className="mt-5 px-5 py-2.5 rounded-xl bg-audio-accent hover:bg-audio-accent-bright text-black font-mono font-bold text-xs shadow-glow-brass active:scale-95 transition-all flex items-center gap-2"
                  >
                    <PlusIcon />
                    <span>Add gear</span>
                  </button>
                </div>
              )}

              {/* STATE B: IDLE / HEADER (gearCount > 0 && !isAddingGear) */}
              {gearCount > 0 && !isAddingGear && (
                <div className="flex flex-wrap justify-between items-center gap-3 pb-1 border-b border-audio-border/50">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-audio-text">
                      Your collection ({gearCount})
                    </h3>
                    <p className="text-xs text-audio-muted mt-0.5">
                      Add your gear or choose two or three items to compare.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Compare gear Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        if (gearCount >= 2) {
                          setBattleMode(!battleMode);
                          if (battleMode) setSelectedForBattle([]);
                        }
                      }}
                      disabled={gearCount < 2}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all flex items-center gap-1.5 ${
                        battleMode
                          ? 'bg-audio-warn text-black border-audio-warn font-bold shadow-panel'
                          : gearCount < 2
                            ? 'opacity-40 cursor-not-allowed bg-audio-surface border-audio-border text-audio-muted'
                            : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-text hover:border-audio-accent/50'
                      }`}
                      title={
                        gearCount < 2
                          ? 'Register at least 2 gear items to run Compare gear'
                          : 'Toggle Compare gear'
                      }
                    >
                      <SwordsIcon />
                      <span>{battleMode ? 'Exit Battle' : 'Compare gear'}</span>
                    </button>

                    {/* Add Gear Button (Only primary brass button on IDLE) */}
                    {!battleMode && (
                      <button
                        type="button"
                        onClick={() => setIsAddingGear(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <PlusIcon />
                        <span>+ Add Gear</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* BATTLING STATE COACH BANNER */}
              {battleMode && (
                <div className="p-3 rounded-xl bg-[#21150F] border border-audio-warn/50 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-audio-warn animate-pulse" />
                    <span className="text-xs font-mono text-audio-warn font-semibold">
                      Compare gear Active: Tap 2–3 gear cards to compare
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded text-audio-muted border border-audio-border">
                      {selectedForBattle.length} / 3 Selected
                    </span>
                    {selectedForBattle.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleStartBattle}
                        className="px-3.5 py-1 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass animate-in zoom-in-95"
                      >
                        Compare selected gear →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STATE C: ADDING FORM DRAWER (Replaces native dropdowns with interactive chips & has single form-level commit) */}
              {isAddingGear && (
                <div className="p-4 md:p-5 bg-[#171d19] rounded-2xl border border-audio-accent/60 shadow-panel animate-in slide-in-from-top-3">
                  <div className="flex items-center justify-between mb-4">
                    <Engraved size="xs" glow>
                      Add gear to your collection
                    </Engraved>
                    <span className="text-[10px] font-mono text-audio-muted">Press Enter to Add</span>
                  </div>

                  <div className="space-y-4">
                    {/* Gear Name */}
                    <div>
                      <label className={labelClass}>Gear / IEM Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Simgot EW300, Moondrop Aria 2, JCally JM6 Pro..."
                        value={newGear.name}
                        onChange={(e) => setNewGear({ ...newGear, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newGear.name.trim()) handleSaveGear();
                          if (e.key === 'Escape') setIsAddingGear(false);
                        }}
                        className={inputClass}
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="control-field">
                        Gear category
                        <select
                          value={newGear.type}
                          onChange={(e) =>
                            setNewGear({ ...newGear, type: e.target.value as GearItem['type'] })
                          }
                        >
                          {GEAR_TYPES.map((t) => (
                            <option value={t} key={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="control-field">
                        Collection status
                        <select
                          value={newGear.status}
                          onChange={(e) =>
                            setNewGear({ ...newGear, status: e.target.value as GearItem['status'] })
                          }
                        >
                          {GEAR_STATUSES.map((t) => (
                            <option value={t.key} key={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {/* Gear Rating Selector */}
                    <div>
                      <label className={labelClass}>Gear Rating (1–5 Stars)</label>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewGear({ ...newGear, rating: star })}
                            className={`p-1 rounded transition-colors ${
                              (newGear.rating || 5) >= star
                                ? 'text-audio-accent'
                                : 'text-audio-muted/40 hover:text-audio-accent/70'
                            }`}
                            title={`${star} Star${star > 1 ? 's' : ''}`}
                          >
                            <StarIcon filled={(newGear.rating || 5) >= star} />
                          </button>
                        ))}
                        <span className="text-[10px] font-mono text-audio-muted ml-2">
                          {newGear.rating || 5} / 5 Stars
                        </span>
                      </div>
                    </div>

                    {/* Optional Price & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className={labelClass}>Approx Price (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. $79 USD"
                          value={newGear.price || ''}
                          onChange={(e) => setNewGear({ ...newGear, price: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Soundstage Impressions (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Wide stage, tribrid EST, natural decay..."
                          value={newGear.notes || ''}
                          onChange={(e) => setNewGear({ ...newGear, notes: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Single Form-Level Commit Action */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-audio-border/50">
                      <button
                        type="button"
                        onClick={() => setIsAddingGear(false)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-audio-muted hover:text-audio-text transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveGear}
                        disabled={!newGear.name.trim()}
                        className="px-4 py-1.5 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass disabled:opacity-40 transition-all active:scale-95"
                      >
                        Add to collection
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <input
                  className={inputClass + ' sm:max-w-xs'}
                  aria-label="Search gear"
                  placeholder="Search your collection…"
                  value={gearSearch}
                  onChange={(e) => setGearSearch(e.target.value)}
                />
                <label className="control-field">
                  Show
                  <select value={gearStatus} onChange={(e) => setGearStatus(e.target.value)}>
                    <option value="all">All gear</option>
                    <option value="owned">Owned</option>
                    <option value="wishlist">Wishlist</option>
                    <option value="tried">Tested</option>
                  </select>
                </label>
              </div>
              {/* Gear Grid Cards */}
              {gearCount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {formData.gearLibrary
                    ?.filter(
                      (gear) =>
                        (gearStatus === 'all' || gear.status === gearStatus) &&
                        gear.name.toLowerCase().includes(gearSearch.toLowerCase()),
                    )
                    .map((gear) => {
                      const isSelected = selectedForBattle.includes(gear.id);
                      const battleIndex = selectedForBattle.indexOf(gear.id);

                      return (
                        <div
                          key={gear.id}
                          onClick={() => {
                            if (battleMode) {
                              setSelectedForBattle((prev) =>
                                prev.includes(gear.id)
                                  ? prev.filter((id) => id !== gear.id)
                                  : [...prev, gear.id].slice(0, 3),
                              );
                            }
                          }}
                          className={`p-4 rounded-xl border transition-all select-none relative group ${
                            battleMode ? 'cursor-pointer' : ''
                          } ${
                            isSelected
                              ? 'border-audio-accent bg-[#1E1712] shadow-glow-brass'
                              : 'border-audio-border bg-[#1a211c] hover:border-audio-accent/50'
                          }`}
                        >
                          {/* Battle mode contender ring */}
                          {battleMode && (
                            <div
                              className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                                isSelected
                                  ? 'bg-audio-accent text-black border-audio-accent shadow-glow-brass scale-110'
                                  : 'border-audio-border bg-black/40 text-audio-muted'
                              }`}
                            >
                              {isSelected ? battleIndex + 1 : ''}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mb-2">
                            <Led
                              color={
                                gear.status === 'owned' ? 'green' : gear.status === 'tried' ? 'teal' : 'amber'
                              }
                              size="sm"
                            />
                            <span className="text-[9px] font-mono uppercase tracking-wider text-audio-muted">
                              {gear.type} • {gear.status}
                            </span>
                          </div>

                          <h3 className="font-display font-bold text-sm text-audio-text truncate">
                            {gear.name}
                          </h3>
                          {gear.price && (
                            <p className="text-xs font-mono text-audio-accent mt-0.5">{gear.price}</p>
                          )}
                          {gear.notes && (
                            <p className="text-[11px] text-audio-muted mt-2 line-clamp-2 leading-relaxed">
                              {gear.notes}
                            </p>
                          )}

                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-audio-border/50">
                            <span className="text-[9px] font-mono text-audio-muted/60">
                              {new Date(gear.addedAt).toLocaleDateString()}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGear(gear.id);
                              }}
                              className="text-audio-muted hover:text-audio-warn p-1 transition-colors"
                              title="Delete gear"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Just Added Feedback Toast */}
              {justAddedToast && (
                <div className="p-2.5 px-3 rounded-xl bg-audio-signal/15 border border-audio-signal/40 text-audio-signal text-xs font-mono flex items-center gap-2 animate-in fade-in">
                  <CheckIcon />
                  <span>{justAddedToast}</span>
                </div>
              )}

              {/* Battle Shootout Modal Result */}
              {showComparison && (
                <div className="mt-4 p-4 rounded-xl border border-audio-accent/50 bg-[#171d19] animate-in fade-in">
                  <div className="flex justify-between items-center mb-3">
                    <Engraved size="xs" glow>
                      AI BATTLE SHOOTOUT TELEMETRY
                    </Engraved>
                    <button
                      type="button"
                      onClick={() => setShowComparison(false)}
                      className="text-xs text-audio-muted hover:text-audio-text"
                    >
                      ✕ Close
                    </button>
                  </div>
                  {isBattleLoading ? (
                    <div className="py-6 text-center text-xs font-mono text-audio-accent flex items-center justify-center gap-2">
                      <span className="meter-loader">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span>Google Search Spec Shootout in progress…</span>
                    </div>
                  ) : (
                    <div className="text-xs text-audio-text leading-relaxed font-sans max-h-96 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {renderShootoutMarkdown(battleAnalysis)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 4: MANUAL FACTS & DATA BACKUP
              ========================================================================= */}
          {activeTab === 'memory' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* API Key Configuration & Test Connection Suite */}
              <div className="pt-5 border-t border-audio-border/60">
                <div className="flex items-center justify-between mb-2">
                  <Engraved size="xs" glow>
                    AI connection
                  </Engraved>
                  <span className="text-[10px] font-mono text-audio-signal">GEMINI API</span>
                </div>

                <div className="p-3.5 rounded-xl border border-audio-border bg-[#171d19] space-y-3">
                  <div>
                    <label className={labelClass} htmlFor="gemini-key">
                      Gemini API key
                    </label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="password"
                        id="gemini-key"
                        placeholder="AIzaSy..."
                        defaultValue={
                          typeof window !== 'undefined' ? localStorage.getItem('audiosage_api_key') || '' : ''
                        }
                        onChange={(e) => {
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('audiosage_api_key', e.target.value.trim());
                          }
                        }}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setImportMessage({ type: 'success', text: `${resolveApiKey().source}: testing streaming and grounding…` });
                          const result = await testAiConnection();
                          setImportMessage({ type: result.ok ? 'success' : 'error', text: result.message });
                        }}
                        className="px-3.5 py-2 rounded-xl bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass flex-shrink-0"
                      >
                        Test Connection
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-audio-muted">
                    <span>Personal key stays in this browser. Environment keys are local development only.</span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-audio-accent hover:underline"
                    >
                      Get Key from Google AI Studio ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* SYSTEM EQ BRIDGE (EQUALIZER APO HOT-RELOAD) */}
              <details className="section-disclosure">
                <summary>System equalizer integration · Equalizer APO</summary>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Engraved size="xs" glow>
                      System equalizer integration
                    </Engraved>
                    <Led color={apoBridgeEnabled ? 'green' : 'amber'} pulse={apoBridgeEnabled} size="sm" />
                  </div>
                  {apoLastApplied && (
                    <span className="text-[10px] font-mono text-audio-signal">
                      LAST APPLIED {apoLastApplied}
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-audio-border bg-[#171d19] space-y-3">
                  <div>
                    <label className={labelClass}>Equalizer APO config.txt Path (Windows)</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={apoConfigPath}
                        onChange={(e) => {
                          const val = e.target.value;
                          setApoConfigPath(val);
                          setStoredApoConfigPath(val);
                        }}
                        placeholder="C:\Program Files\Equalizer APO\config\config.txt"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setApoTestStatus('testing');
                          try {
                            const res = await testApoWrite(apoConfigPath);
                            if (res.success) {
                              setApoTestStatus('success');
                              setImportMessage({
                                type: 'success',
                                text: `✓ Equalizer APO permissions verified! Sibling audiosage-eq.txt writable.`,
                              });
                            } else {
                              setApoTestStatus('error');
                              setImportMessage({
                                type: 'error',
                                text: `APO Bridge Test Failed: ${res.error || 'Check path permissions'}`,
                              });
                            }
                          } catch (e: any) {
                            setApoTestStatus('error');
                            setImportMessage({ type: 'error', text: `Bridge error: ${e.message}` });
                          }
                          setTimeout(() => setImportMessage(null), 6000);
                        }}
                        className="px-3.5 py-2 rounded-xl border border-audio-border bg-audio-surface text-xs font-mono font-bold text-audio-accent hover:border-audio-accent flex-shrink-0"
                      >
                        {apoTestStatus === 'testing' ? 'Testing…' : 'Test Write'}
                      </button>
                    </div>
                  </div>

                  {/* Bridge Toggle & Safety Guardrails */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-audio-border/40">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const nextState = !apoBridgeEnabled;
                          const res = await toggleApoManagedBridge(nextState, apoConfigPath);
                          if (res.success) {
                            setApoBridgeEnabled(nextState);
                            setStoredApoEnabled(nextState);
                            setImportMessage({
                              type: 'success',
                              text: nextState
                                ? '✓ Equalizer APO hot-sync active. Every profile save will tune your PC in real-time!'
                                : 'Equalizer APO managed include line removed from config.txt.',
                            });
                          } else {
                            setImportMessage({
                              type: 'error',
                              text: `Failed to toggle bridge: ${res.error}`,
                            });
                          }
                          setTimeout(() => setImportMessage(null), 5000);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
                          apoBridgeEnabled
                            ? 'bg-[#203c2b] border-audio-signal text-audio-signal shadow-glow-teal'
                            : 'bg-audio-surface border-audio-border text-audio-muted hover:text-audio-text'
                        }`}
                      >
                        <Led color={apoBridgeEnabled ? 'green' : 'amber'} size="sm" />
                        <span>
                          {apoBridgeEnabled ? 'BRIDGE ACTIVE (HOT RELOAD)' : 'ENABLE APO HOT BRIDGE'}
                        </span>
                      </button>
                    </div>

                    <p className="text-[10px] font-mono text-audio-muted/70">
                      Non-destructive: writes sibling{' '}
                      <code className="text-audio-accent">audiosage-eq.txt</code> &amp; creates{' '}
                      <code className="text-audio-muted">.bak</code>
                    </p>
                  </div>
                </div>
              </details>

              {/* Data Management Section */}
              <div className="pt-5 border-t border-audio-border/60">
                <Engraved size="xs" className="mb-3 block">
                  Backups & browser storage
                </Engraved>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="p-2.5 rounded-xl border border-audio-border bg-[#191f1b] text-xs font-mono text-audio-muted hover:text-audio-text hover:border-audio-accent/50 flex items-center justify-center gap-2"
                  >
                    <SaveIcon />
                    <span>Export JSON Backup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    className="p-2.5 rounded-xl border border-audio-border bg-[#191f1b] text-xs font-mono text-audio-muted hover:text-audio-accent hover:border-audio-accent/50 flex items-center justify-center gap-2"
                  >
                    <LinkIcon />
                    <span>Import JSON Backup</span>
                  </button>
                  <input
                    type="file"
                    ref={importFileRef}
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="p-2.5 rounded-xl border border-audio-warn/30 bg-[#21120D] text-xs font-mono text-audio-warn hover:bg-audio-warn/20 flex items-center justify-center gap-2"
                  >
                    <TrashIcon />
                    <span>Clear All Data</span>
                  </button>
                </div>

                {importMessage && (
                  <div
                    className={`mt-2.5 p-2.5 rounded-lg text-xs font-mono ${
                      importMessage.type === 'success'
                        ? 'bg-audio-signal/15 text-audio-signal'
                        : 'bg-audio-warn/15 text-audio-warn'
                    }`}
                  >
                    {importMessage.text}
                  </div>
                )}

                {showClearConfirm && (
                  <div className="mt-3 p-3.5 rounded-xl bg-[#25120D] border border-audio-warn/50">
                    <p className="text-xs text-audio-warn mb-2.5">
                      Are you sure? This will delete all chats, gear, and profiles permanently.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleClearAllData}
                        className="px-3 py-1.5 rounded-lg bg-audio-warn text-black font-mono font-bold text-xs"
                      >
                        Yes, Delete Everything
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1.5 rounded-lg border border-audio-border text-xs text-audio-muted hover:text-audio-text"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 5: AI KNOWLEDGE (RAG ENGINE)
              ========================================================================= */}
          {activeTab === 'knowledge' && (
            <div className="space-y-5 max-w-4xl mx-auto">
              <section className="space-y-4">
                <h2 className="text-lg font-display">Listening notes</h2>
                <p className="text-xs text-audio-muted">
                  Personal preferences and saved discoveries used in your research.
                </p>{' '}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                    placeholder="Add a note, e.g. I prefer smooth treble and a wide soundstage…"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddMemory}
                    className="px-4 rounded-xl bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass flex-shrink-0"
                  >
                    <PlusIcon />
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.savedMemories?.map((memory, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-xl border border-audio-border bg-[#191f1b] group hover:border-audio-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[9px] font-mono text-audio-accent font-bold">#{index + 1}</span>
                        <p className="text-xs text-audio-text/90">{memory}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMemory(index)}
                        className="text-audio-muted hover:text-audio-warn opacity-100 transition-opacity p-1"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3.5 rounded-xl border border-audio-border bg-[#171d19]">
                <div>
                  <h4 className="font-display font-semibold text-xs text-audio-text">Research summaries</h4>
                  <p className="text-[11px] text-audio-muted mt-0.5">
                    Summarize past conversations into searchable notes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSummarizeHistory}
                  disabled={isSummarizing}
                  className="px-3.5 py-2 rounded-lg bg-audio-accent text-black font-mono font-bold text-xs hover:bg-audio-accent-bright shadow-glow-brass flex items-center gap-1.5 flex-shrink-0"
                >
                  {isSummarizing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Consolidating…</span>
                    </>
                  ) : (
                    <>
                      <BrainIcon />
                      <span>Consolidate Memory</span>
                    </>
                  )}
                </button>
              </div>

              {/* Search Filter */}
              <input
                type="text"
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                placeholder="Search verified knowledge base entries..."
                className={inputClass}
              />

              {/* Knowledge Entry List */}
              <div className="space-y-3">
                {knowledgeBase && knowledgeBase.length > 0 ? (
                  knowledgeBase
                    .filter(
                      (entry) =>
                        !kbSearch ||
                        entry.topic.toLowerCase().includes(kbSearch.toLowerCase()) ||
                        entry.summary.toLowerCase().includes(kbSearch.toLowerCase()),
                    )
                    .map((entry) => (
                      <div key={entry.id} className="p-4 bg-[#1a211c] rounded-xl border border-audio-border">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Led color="teal" size="sm" />
                            <h4 className="font-display font-semibold text-xs text-audio-text">
                              {entry.topic}
                            </h4>
                          </div>
                          <span className="text-[9px] font-mono text-audio-muted">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-audio-muted leading-relaxed mb-2">{entry.summary}</p>
                        {entry.keyFacts && entry.keyFacts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-audio-border/50">
                            {entry.keyFacts.map((fact, fIdx) => (
                              <span
                                key={fIdx}
                                className="text-[9px] font-mono px-2 py-0.5 rounded bg-audio-surface border border-audio-border text-audio-signal"
                              >
                                ✓ {fact}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-10 border border-dashed border-audio-border rounded-xl bg-[#171d19]">
                    <div className="flex justify-center mb-2">
                      <BrainIcon />
                    </div>
                    <p className="text-xs text-audio-muted">
                      No consolidated memory entries yet. Run research chats or click Consolidate above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STICKY CHASSIS FOOTER */}
        <div className="workspace-page-footer flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Led color={hasUnsavedChanges ? 'amber' : 'green'} pulse={hasUnsavedChanges} size="sm" />
            <span className="text-[10px] font-mono text-audio-muted hidden sm:inline">
              {hasUnsavedChanges ? 'Unsaved profile changes' : 'Changes saved in this browser'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setFormData(profile || DEFAULT_PROFILE);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg border border-audio-border text-xs font-mono text-audio-muted hover:text-audio-text hover:bg-audio-surface transition-colors"
            >
              Close
            </button>
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleSave}
                className={`px-4 py-1.5 rounded-lg font-mono font-bold text-xs transition-all flex items-center gap-1.5 ${
                  isSavedFlash
                    ? 'bg-audio-signal text-black shadow-glow-teal'
                    : 'bg-audio-accent text-black hover:bg-audio-accent-bright shadow-glow-brass active:scale-95'
                }`}
              >
                {isSavedFlash ? <CheckIcon /> : null}
                <span>{isSavedFlash ? 'Saved!' : 'Save Changes'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
