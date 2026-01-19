import React, { useState, useRef } from 'react';
import { AudioProfile, KnowledgeEntry, EQPreset, GearItem } from '../types';
import { PlusIcon, TrashIcon, BrainIcon, EqIcon, SaveIcon, LinkIcon, HeadphonesIcon, StarIcon, SwordsIcon, XIcon } from './Icon';
import { generateBattleComparison } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: AudioProfile;
  knowledgeBase: KnowledgeEntry[];
  onSave: (profile: AudioProfile) => void;
  onSummarizeHistory: () => void;
  isSummarizing: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  knowledgeBase,
  onSave,
  onSummarizeHistory,
  isSummarizing
}) => {
  const [formData, setFormData] = useState<AudioProfile>(profile);
  const [activeTab, setActiveTab] = useState<'profile' | 'memory' | 'knowledge' | 'eq' | 'gear'>('profile');
  const [newMemory, setNewMemory] = useState('');
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // EQ Form State
  const [isAddingEQ, setIsAddingEQ] = useState(false);
  const [newEQ, setNewEQ] = useState<{ name: string, hardware: string, type: 'Wavelet' | 'Parametric', bands: string }>({
    name: '',
    hardware: '',
    type: 'Wavelet',
    bands: ''
  });

  // Gear Form State
  const [isAddingGear, setIsAddingGear] = useState(false);
  const [newGear, setNewGear] = useState<Omit<GearItem, 'id' | 'addedAt'>>({
    name: '',
    type: 'IEM',
    status: 'owned',
    rating: undefined,
    notes: '',
    price: ''
  });

  // Battle Mode State
  const [battleMode, setBattleMode] = useState(false);
  const [selectedForBattle, setSelectedForBattle] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [battleAnalysis, setBattleAnalysis] = useState('');
  const [isBattleLoading, setIsBattleLoading] = useState(false);

  // Trigger AI Battle Comparison
  const handleStartBattle = async () => {
    if (selectedForBattle.length < 2) return;

    const selectedGearData = selectedForBattle
      .map(id => (formData.gearLibrary || []).find(g => g.id === id))
      .filter(Boolean) as GearItem[];

    setShowComparison(true);
    setIsBattleLoading(true);
    setBattleAnalysis('');

    try {
      await generateBattleComparison(
        selectedGearData.map(g => ({
          name: g.name,
          type: g.type,
          status: g.status,
          rating: g.rating,
          notes: g.notes,
          price: g.price
        })),
        profile,
        (chunk) => {
          setBattleAnalysis(prev => prev + chunk);
        }
      );
    } catch (error: any) {
      setBattleAnalysis(`**Error:** ${error.message}`);
    } finally {
      setIsBattleLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddMemory = () => {
    if (newMemory.trim()) {
      setFormData(prev => ({
        ...prev,
        savedMemories: [...(prev.savedMemories || []), newMemory.trim()]
      }));
      setNewMemory('');
    }
  };

  const handleRemoveMemory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      savedMemories: prev.savedMemories.filter((_, i) => i !== index)
    }));
  };

  const handleSaveEQ = () => {
    if (newEQ.name && newEQ.bands) {
      const preset: EQPreset = {
        id: uuidv4(),
        name: newEQ.name,
        hardware: newEQ.hardware,
        type: newEQ.type,
        bands: newEQ.bands,
        timestamp: Date.now()
      };
      setFormData(prev => ({
        ...prev,
        eqLibrary: [...(prev.eqLibrary || []), preset]
      }));
      setIsAddingEQ(false);
      setNewEQ({ name: '', hardware: '', type: 'Wavelet', bands: '' });
    }
  };

  const handleDeleteEQ = (id: string) => {
    setFormData(prev => ({
      ...prev,
      eqLibrary: prev.eqLibrary.filter(eq => eq.id !== id)
    }));
  };

  const handleCopyWavelet = (eq: EQPreset) => {
    const text = eq.bands; // Assume user saved the raw GraphicEQ string or similar
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccessId(eq.id);
      setTimeout(() => setCopySuccessId(null), 2000);
    });
  }

  // Gear CRUD handlers
  const handleSaveGear = () => {
    if (newGear.name.trim()) {
      const item: GearItem = {
        id: uuidv4(),
        name: newGear.name,
        type: newGear.type,
        status: newGear.status,
        rating: newGear.rating,
        notes: newGear.notes,
        price: newGear.price,
        addedAt: Date.now()
      };
      setFormData(prev => ({
        ...prev,
        gearLibrary: [...(prev.gearLibrary || []), item]
      }));
      setIsAddingGear(false);
      setNewGear({ name: '', type: 'IEM', status: 'owned', rating: undefined, notes: '', price: '' });
    }
  };

  const handleDeleteGear = (id: string) => {
    setFormData(prev => ({
      ...prev,
      gearLibrary: (prev.gearLibrary || []).filter(g => g.id !== id)
    }));
  };

  const handleUpdateGearRating = (id: string, rating: number) => {
    setFormData(prev => ({
      ...prev,
      gearLibrary: (prev.gearLibrary || []).map(g =>
        g.id === id ? { ...g, rating } : g
      )
    }));
  };

  const handleExportData = () => {
    const chats = localStorage.getItem('audiosage_chats_v1');
    const profile = localStorage.getItem('audiosage_profile_v1');
    const kb = localStorage.getItem('audiosage_knowledge_v1');
    const data = {
      timestamp: new Date().toISOString(),
      profile: profile ? JSON.parse(profile) : null,
      chats: chats ? JSON.parse(chats) : [],
      knowledgeBase: kb ? JSON.parse(kb) : []
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

        // Validate structure
        if (!data.profile && !data.chats && !data.knowledgeBase) {
          throw new Error('Invalid backup file format');
        }

        // Restore data
        if (data.profile) {
          localStorage.setItem('audiosage_profile_v1', JSON.stringify(data.profile));
        }
        if (data.chats) {
          localStorage.setItem('audiosage_chats_v1', JSON.stringify(data.chats));
        }
        if (data.knowledgeBase) {
          localStorage.setItem('audiosage_knowledge_v1', JSON.stringify(data.knowledgeBase));
        }

        setImportMessage({ type: 'success', text: `Backup restored! ${data.chats?.length || 0} chats imported. Refresh to apply.` });
        setTimeout(() => setImportMessage(null), 5000);
      } catch (err) {
        setImportMessage({ type: 'error', text: 'Failed to parse backup file. Make sure it\'s a valid AudioSage backup.' });
        setTimeout(() => setImportMessage(null), 5000);
      }
    };
    reader.readAsText(file);

    // Reset file input
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 md:p-4 animate-in fade-in duration-200 safe-area-top safe-area-bottom">
      <div
        className="bg-[#0A0A0A] w-full max-w-4xl rounded-2xl border border-audio-border shadow-2xl shadow-audio-accent/5 flex flex-col max-h-[85vh] max-h-modal-mobile animate-in zoom-in-95 duration-200"
        role="dialog"
      >

        {/* Header */}
        <div className="flex justify-between items-center px-4 md:px-8 py-4 md:py-6 border-b border-audio-border bg-[#050505] flex-shrink-0">
          <div className="flex-1 overflow-x-auto scrollbar-hide mr-2">
            <div className="flex gap-4 md:gap-8 min-w-max">
              <button
                onClick={() => setActiveTab('profile')}
                className={`text-xs md:text-sm font-bold tracking-wide transition-all uppercase pb-1 whitespace-nowrap ${activeTab === 'profile' ? 'text-audio-accent border-b-2 border-audio-accent' : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'}`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('eq')}
                className={`text-xs md:text-sm font-bold tracking-wide transition-all uppercase flex items-center gap-1 md:gap-2 pb-1 whitespace-nowrap ${activeTab === 'eq' ? 'text-audio-accent border-b-2 border-audio-accent' : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'}`}
              >
                <EqIcon /> <span className="hidden sm:inline">EQ</span> Library
              </button>
              <button
                onClick={() => setActiveTab('gear')}
                className={`text-xs md:text-sm font-bold tracking-wide transition-all uppercase flex items-center gap-1 md:gap-2 pb-1 whitespace-nowrap ${activeTab === 'gear' ? 'text-audio-accent border-b-2 border-audio-accent' : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'}`}
              >
                <HeadphonesIcon /> Gear
              </button>
              <button
                onClick={() => setActiveTab('memory')}
                className={`text-xs md:text-sm font-bold tracking-wide transition-all uppercase pb-1 whitespace-nowrap ${activeTab === 'memory' ? 'text-audio-accent border-b-2 border-audio-accent' : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'}`}
              >
                <span className="sm:hidden">Facts</span><span className="hidden sm:inline">Manual Facts</span>
              </button>
              <button
                onClick={() => setActiveTab('knowledge')}
                className={`text-xs md:text-sm font-bold tracking-wide transition-all uppercase pb-1 whitespace-nowrap ${activeTab === 'knowledge' ? 'text-audio-accent border-b-2 border-audio-accent' : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'}`}
              >
                <span className="sm:hidden">AI</span><span className="hidden sm:inline">AI Knowledge</span>
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-audio-highlight text-gray-500 hover:text-white transition-colors flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-touch">
          {activeTab === 'profile' && (
            <div className="space-y-8 max-w-2xl mx-auto">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-audio-accent uppercase tracking-widest pl-1">Display Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-audio-surface border border-audio-border rounded-xl px-5 py-4 text-white focus:outline-none focus:border-audio-accent/50 focus:ring-1 focus:ring-audio-accent/50 transition-all placeholder-gray-700"
                    placeholder="How should I call you?"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-audio-accent uppercase tracking-widest pl-1">Sound Signature</label>
                  <textarea
                    name="soundSignature"
                    value={formData.soundSignature}
                    onChange={handleChange}
                    className="w-full bg-audio-surface border border-audio-border rounded-xl px-5 py-4 text-white focus:outline-none focus:border-audio-accent/50 focus:ring-1 focus:ring-audio-accent/50 transition-all min-h-[100px] placeholder-gray-700 leading-relaxed"
                    placeholder="Describe your preferred sound profile..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-audio-accent uppercase tracking-widest pl-1">Current Gear (Inventory)</label>
                  <textarea
                    name="currentGear"
                    value={formData.currentGear}
                    onChange={handleChange}
                    className="w-full bg-audio-surface border border-audio-border rounded-xl px-5 py-4 text-white focus:outline-none focus:border-audio-accent/50 focus:ring-1 focus:ring-audio-accent/50 transition-all min-h-[80px] placeholder-gray-700 leading-relaxed"
                    placeholder="List your headphones, IEMs, DACs, and Amps..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-audio-accent uppercase tracking-widest pl-1">Technical Preferences</label>
                  <textarea
                    name="technicalPrefs"
                    value={formData.technicalPrefs}
                    onChange={handleChange}
                    className="w-full bg-audio-surface border border-audio-border rounded-xl px-5 py-4 text-white focus:outline-none focus:border-audio-accent/50 focus:ring-1 focus:ring-audio-accent/50 transition-all min-h-[120px] placeholder-gray-700 leading-relaxed"
                    placeholder="Details about soundstage, imaging, separation, etc..."
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                  placeholder="Add a permanent fact, past finding, or specific rule..."
                  className="flex-1 bg-audio-surface border border-audio-border rounded-xl px-5 py-3 text-white focus:outline-none focus:border-audio-accent/50 focus:ring-1 focus:ring-audio-accent/50 transition-all placeholder-gray-600"
                />
                <button
                  onClick={handleAddMemory}
                  className="bg-audio-highlight hover:bg-audio-border text-white p-3 rounded-xl border border-audio-border transition-colors"
                >
                  <PlusIcon />
                </button>
              </div>

              <div className="space-y-2">
                {formData.savedMemories?.map((memory, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-audio-surface border border-audio-border rounded-xl group hover:border-audio-accent/30 transition-colors">
                    <p className="text-sm text-gray-300">{memory}</p>
                    <button
                      onClick={() => handleRemoveMemory(index)}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
                {(!formData.savedMemories || formData.savedMemories.length === 0) && (
                  <div className="text-center py-12 text-gray-600 border border-dashed border-audio-border rounded-xl bg-audio-surface/50">
                    <BrainIcon />
                    <p className="mt-2 text-sm">No manual memories added yet.</p>
                  </div>
                )}
              </div>
              <div className="pt-6 border-t border-audio-border mt-8">
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-500 mb-3">Data Management</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-4 py-3 bg-[#1A1A1A] border border-audio-border rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors justify-center"
                  >
                    <SaveIcon />
                    Export Backup
                  </button>
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-3 bg-[#1A1A1A] border border-audio-border rounded-lg text-xs text-gray-400 hover:text-audio-accent hover:border-audio-accent/50 transition-colors justify-center"
                  >
                    <LinkIcon />
                    Import Backup
                  </button>
                  <input
                    type="file"
                    ref={importFileRef}
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                  />
                </div>
                {importMessage && (
                  <div className={`mt-3 text-xs p-2 rounded ${importMessage.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {importMessage.text}
                  </div>
                )}
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-900/50 rounded-lg text-xs text-red-400 hover:bg-red-900/30 hover:border-red-500/50 transition-colors w-full justify-center"
                >
                  <TrashIcon />
                  Clear All Data
                </button>
                {showClearConfirm && (
                  <div className="mt-3 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-300 mb-3">Are you sure? This will delete ALL chats, profile, and knowledge data permanently.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearAllData}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-500"
                      >
                        Yes, Clear Everything
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 px-3 py-2 bg-audio-surface border border-audio-border text-gray-400 rounded-lg text-xs hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'eq' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <p className="text-sm text-gray-400">Manage your personalized EQ profiles for different gear or use cases.</p>
                <button
                  onClick={() => setIsAddingEQ(true)}
                  className="flex items-center gap-2 bg-audio-accent/10 border border-audio-accent/50 text-audio-accent hover:bg-audio-accent hover:text-black px-4 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-wider"
                >
                  <PlusIcon /> Add Profile
                </button>
              </div>

              {isAddingEQ && (
                <div className="bg-audio-base border border-audio-border rounded-xl p-6 mb-8 animate-in slide-in-from-top-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Profile Name</label>
                      <input
                        type="text"
                        placeholder='e.g., "Aria 2 Gaming"'
                        value={newEQ.name}
                        onChange={(e) => setNewEQ({ ...newEQ, name: e.target.value })}
                        className="w-full bg-audio-surface border border-audio-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-audio-accent text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Hardware / Use Case</label>
                      <input
                        type="text"
                        placeholder='e.g., "Moondrop Aria 2"'
                        value={newEQ.hardware}
                        onChange={(e) => setNewEQ({ ...newEQ, hardware: e.target.value })}
                        className="w-full bg-audio-surface border border-audio-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-audio-accent text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">EQ Data (AutoEQ / Wavelet / Parametric)</label>
                      <select
                        value={newEQ.type}
                        onChange={(e) => setNewEQ({ ...newEQ, type: e.target.value as any })}
                        className="bg-transparent text-[10px] font-bold text-audio-accent uppercase focus:outline-none"
                      >
                        <option value="Wavelet">Wavelet / AutoEQ</option>
                        <option value="Parametric">Parametric</option>
                      </select>
                    </div>
                    <textarea
                      placeholder="Paste strict text data here..."
                      value={newEQ.bands}
                      onChange={(e) => setNewEQ({ ...newEQ, bands: e.target.value })}
                      className="w-full bg-audio-surface border border-audio-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-audio-accent text-xs font-mono min-h-[100px]"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setIsAddingEQ(false)} className="text-gray-500 hover:text-white text-xs">Cancel</button>
                    <button onClick={handleSaveEQ} className="bg-audio-accent text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#E5C150]">Save Profile</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.eqLibrary?.map((preset) => (
                  <div key={preset.id} className="bg-audio-surface border border-audio-border rounded-xl p-5 hover:border-audio-accent/50 transition-colors group relative">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white tracking-wide">{preset.name}</h3>
                        <p className="text-xs text-audio-muted">{preset.hardware}</p>
                      </div>
                      <span className="text-[10px] font-bold border border-audio-border px-2 py-0.5 rounded text-gray-500 uppercase">{preset.type}</span>
                    </div>
                    <div className="bg-black/50 rounded-lg p-2 mb-3 max-h-20 overflow-hidden relative">
                      <pre className="text-[10px] text-gray-500 font-mono">{preset.bands}</pre>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <button
                        onClick={() => handleCopyWavelet(preset)}
                        className={`text-xs font-medium flex items-center gap-1.5 transition-colors ${copySuccessId === preset.id ? 'text-green-500' : 'text-audio-accent hover:text-white'}`}
                      >
                        {copySuccessId === preset.id ? 'Copied!' : 'Copy Data'}
                      </button>
                      <button
                        onClick={() => handleDeleteEQ(preset.id)}
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gear' && (
            <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
                <p className="text-xs sm:text-sm text-gray-400">Track your audio gear collection - IEMs, headphones, DACs, and more.</p>
                <div className="flex flex-wrap gap-2">
                  {/* Battle Mode Toggle */}
                  <button
                    onClick={() => {
                      setBattleMode(!battleMode);
                      if (battleMode) setSelectedForBattle([]);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider ${battleMode
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                      : 'bg-audio-surface border border-audio-border text-gray-400 hover:text-white hover:border-gray-500'
                      }`}
                  >
                    <SwordsIcon /> {battleMode ? 'Cancel' : 'Battle'}
                  </button>
                  {/* Compare Button - shows when 2+ selected */}
                  {battleMode && selectedForBattle.length >= 2 && (
                    <button
                      onClick={handleStartBattle}
                      className="flex items-center gap-1.5 bg-audio-accent border border-audio-accent text-black px-3 py-1.5 rounded-lg transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider animate-in zoom-in-95"
                    >
                      ⚔️ Battle! ({selectedForBattle.length})
                    </button>
                  )}
                  <button
                    onClick={() => setIsAddingGear(true)}
                    className="flex items-center gap-1.5 bg-audio-accent/10 border border-audio-accent/50 text-audio-accent hover:bg-audio-accent hover:text-black px-3 py-1.5 rounded-lg transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider"
                  >
                    <PlusIcon /> Add Gear
                  </button>
                </div>
              </div>

              {/* Battle Mode Instructions */}
              {battleMode && (
                <div className="bg-red-900/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-center gap-2 animate-in slide-in-from-top-2">
                  <SwordsIcon />
                  <span>Select 2-3 items to compare. Click cards to toggle selection.</span>
                  <span className="ml-auto text-red-400 font-bold">{selectedForBattle.length} selected</span>
                </div>
              )}

              {isAddingGear && (
                <div className="bg-audio-base border border-audio-border rounded-xl p-6 mb-8 animate-in slide-in-from-top-4">
                  {/* Name - Primary field */}
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-audio-accent uppercase tracking-wider">Product Name *</label>
                    <input
                      type="text"
                      placeholder='e.g., "Moondrop Aria 2" or "Simgot EW300"'
                      value={newGear.name}
                      onChange={(e) => setNewGear({ ...newGear, name: e.target.value })}
                      className="w-full bg-audio-surface border border-audio-accent/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-audio-accent text-base mt-1"
                      autoFocus
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Just enter the name — AI will research the specs</p>
                  </div>

                  {/* Optional fields - collapsed into grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-600 uppercase">Type</label>
                      <select
                        value={newGear.type}
                        onChange={(e) => setNewGear({ ...newGear, type: e.target.value as any })}
                        className="w-full bg-audio-surface border border-audio-border rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-audio-accent"
                      >
                        <option value="IEM">IEM</option>
                        <option value="Headphone">Headphone</option>
                        <option value="DAC">DAC</option>
                        <option value="AMP">AMP</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-600 uppercase">Status</label>
                      <select
                        value={newGear.status}
                        onChange={(e) => setNewGear({ ...newGear, status: e.target.value as any })}
                        className="w-full bg-audio-surface border border-audio-border rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-audio-accent"
                      >
                        <option value="owned">Owned</option>
                        <option value="wishlist">Wishlist</option>
                        <option value="tried">Tried</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-600 uppercase">Price (opt)</label>
                      <input
                        type="text"
                        placeholder='$79'
                        value={newGear.price || ''}
                        onChange={(e) => setNewGear({ ...newGear, price: e.target.value })}
                        className="w-full bg-audio-surface border border-audio-border rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-audio-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-600 uppercase">Rating</label>
                      <div className="flex gap-0.5 pt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewGear({ ...newGear, rating: star })}
                            className={`transition-colors ${(newGear.rating || 0) >= star ? 'text-audio-accent' : 'text-gray-600 hover:text-gray-400'}`}
                          >
                            <StarIcon filled={(newGear.rating || 0) >= star} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Notes - optional */}
                  <div className="mb-4">
                    <label className="text-[9px] font-bold text-gray-600 uppercase">Notes (optional)</label>
                    <input
                      type="text"
                      placeholder="Quick impressions, e.g., 'great soundstage, bit sibilant'"
                      value={newGear.notes || ''}
                      onChange={(e) => setNewGear({ ...newGear, notes: e.target.value })}
                      className="w-full bg-audio-surface border border-audio-border rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-audio-accent mt-1"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={() => setIsAddingGear(false)} className="text-gray-500 hover:text-white text-xs">Cancel</button>
                    <button
                      onClick={handleSaveGear}
                      disabled={!newGear.name.trim()}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${newGear.name.trim() ? 'bg-audio-accent text-black hover:bg-[#E5C150]' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                      + Add Gear
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(formData.gearLibrary || []).map((gear) => {
                  const isSelected = selectedForBattle.includes(gear.id);
                  return (
                    <div
                      key={gear.id}
                      onClick={() => {
                        if (battleMode) {
                          setSelectedForBattle(prev =>
                            prev.includes(gear.id)
                              ? prev.filter(id => id !== gear.id)
                              : prev.length < 3 ? [...prev, gear.id] : prev
                          );
                        }
                      }}
                      className={`bg-audio-surface border rounded-xl p-5 transition-all group relative ${battleMode ? 'cursor-pointer' : ''} ${isSelected
                        ? 'border-audio-accent bg-audio-accent/10 ring-2 ring-audio-accent/30'
                        : 'border-audio-border hover:border-audio-accent/50'
                        }`}
                    >
                      {/* Selection indicator */}
                      {battleMode && (
                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                          ? 'bg-audio-accent border-audio-accent text-black'
                          : 'border-gray-600'
                          }`}>
                          {isSelected && <span className="text-xs font-bold">{selectedForBattle.indexOf(gear.id) + 1}</span>}
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white tracking-wide truncate">{gear.name}</h3>
                          {gear.price && <p className="text-xs text-audio-accent">{gear.price}</p>}
                        </div>
                        <span className={`text-[10px] font-bold border px-2 py-0.5 rounded uppercase ml-2 flex-shrink-0 ${gear.status === 'owned' ? 'border-green-700 text-green-500 bg-green-900/20' :
                          gear.status === 'wishlist' ? 'border-purple-700 text-purple-400 bg-purple-900/20' :
                            'border-audio-border text-gray-500'
                          }`}>{gear.status}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold border border-audio-border px-2 py-0.5 rounded text-gray-500 uppercase">{gear.type}</span>
                        {gear.rating && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => handleUpdateGearRating(gear.id, star)}
                                className={`transition-colors ${gear.rating >= star ? 'text-audio-accent' : 'text-gray-700 hover:text-gray-500'}`}
                              >
                                <StarIcon filled={gear.rating >= star} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {gear.notes && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{gear.notes}</p>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[9px] text-gray-600">{new Date(gear.addedAt).toLocaleDateString()}</span>
                        <button
                          onClick={() => handleDeleteGear(gear.id)}
                          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {(!formData.gearLibrary || formData.gearLibrary.length === 0) && !isAddingGear && (
                  <div className="col-span-full text-center py-12 text-gray-600 border border-dashed border-audio-border rounded-xl bg-audio-surface/50">
                    <HeadphonesIcon />
                    <p className="mt-2 text-sm">No gear added yet. Start building your collection!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1A1A1A] p-4 rounded-xl border border-audio-border">
                <p className="text-sm text-gray-400">
                  <strong className="text-white block mb-1">RAG Knowledge Engine</strong>
                  This system summarizes your old chats into a structured knowledge file. The AI reads this file to remember your past comparisons and conclusions.
                </p>
                <button
                  onClick={onSummarizeHistory}
                  disabled={isSummarizing}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isSummarizing
                    ? 'bg-audio-border text-gray-500 cursor-wait'
                    : 'bg-audio-accent text-black hover:bg-[#E5C150]'
                    }`}
                >
                  {isSummarizing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <BrainIcon />
                      Consolidate Knowledge
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {knowledgeBase.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-audio-border bg-audio-surface/50 hover:bg-audio-surface transition-colors cursor-default">
                    <div className="mt-1 text-gray-500"><LinkIcon /></div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-medium text-gray-200 truncate">{entry.topic || entry.title}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{entry.summary}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[9px] bg-black/50 px-1.5 py-0.5 rounded text-gray-400">{entry.category || 'General'}</span>
                        <span className="text-[9px] bg-black/50 px-1.5 py-0.5 rounded text-gray-400">{new Date(entry.timestamp || entry.crawledAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-audio-border bg-[#050505] flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors hover:bg-audio-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-2.5 rounded-xl text-sm font-bold bg-audio-accent text-black hover:bg-[#E5C150] transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Battle Mode Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-lg p-4 animate-in fade-in duration-200">
          <div className="bg-[#0A0A0A] w-full max-w-4xl rounded-2xl border border-audio-accent/30 shadow-2xl shadow-audio-accent/10 overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-audio-border bg-gradient-to-r from-red-900/20 to-transparent">
              <div className="flex items-center gap-3">
                <SwordsIcon />
                <h2 className="text-lg font-bold text-white">Battle Mode Comparison</h2>
              </div>
              <button
                onClick={() => setShowComparison(false)}
                className="p-2 rounded-full hover:bg-audio-highlight text-gray-500 hover:text-white transition-colors"
              >
                <XIcon />
              </button>
            </div>

            {/* AI Analysis Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Fighter Cards Header */}
              <div className="flex gap-4 mb-6">
                {selectedForBattle.map((id, idx) => {
                  const gear = (formData.gearLibrary || []).find(g => g.id === id);
                  return gear ? (
                    <div key={id} className={`flex-1 p-4 rounded-xl border ${idx === 0 ? 'bg-red-500/10 border-red-500/30' :
                      idx === 1 ? 'bg-blue-500/10 border-blue-500/30' :
                        'bg-green-500/10 border-green-500/30'
                      }`}>
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block mb-2 ${idx === 0 ? 'bg-red-500/20 text-red-400' :
                        idx === 1 ? 'bg-blue-500/20 text-blue-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>FIGHTER {idx + 1}</div>
                      <h3 className="text-white font-bold">{gear.name}</h3>
                      <p className="text-xs text-gray-500">{gear.type} • {gear.price || 'No price'}</p>
                    </div>
                  ) : null;
                })}
              </div>

              {/* Loading State */}
              {isBattleLoading && !battleAnalysis && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-audio-accent/30 border-t-audio-accent rounded-full animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Analyzing based on your preferences...</p>
                  <p className="text-gray-600 text-xs mt-1">Consulting sound signature, sensitivities, gear history</p>
                </div>
              )}

              {/* AI Analysis Output */}
              {battleAnalysis && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {battleAnalysis.split('\n').map((line, i) => {
                      // Headers
                      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-white mt-6 mb-3 border-b border-audio-border pb-2">{line.slice(3)}</h2>;
                      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-audio-accent mt-5 mb-2">{line.slice(4)}</h3>;

                      // Blockquotes (winner verdict)
                      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-audio-accent bg-audio-accent/10 pl-4 py-2 my-3 text-white font-medium italic">{line.slice(2)}</blockquote>;

                      // Horizontal rules
                      if (line.trim() === '---') return <hr key={i} className="border-audio-border my-4" />;

                      // Table rows - render as styled table
                      if (line.startsWith('|') && line.endsWith('|')) {
                        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
                        const isHeader = line.includes('---');
                        if (isHeader) return null; // Skip separator rows
                        const isHeaderRow = i > 0 && !battleAnalysis.split('\n')[i - 1]?.includes('|'); // First row after non-table
                        return (
                          <div key={i} className={`grid gap-2 py-2 px-2 text-xs border-b border-audio-border/30 ${isHeaderRow ? 'bg-audio-surface font-bold text-white' : 'text-gray-300'}`} style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
                            {cells.map((cell, ci) => (
                              <div key={ci} className={`${ci === 0 ? 'text-left' : 'text-center'} ${cell.includes('🏅') ? 'text-audio-accent font-bold' : ''}`}>
                                {cell.replace(/\*\*/g, '')}
                              </div>
                            ))}
                          </div>
                        );
                      }

                      // Bold text standalone
                      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-white mt-3">{line.slice(2, -2)}</p>;

                      // Lists
                      if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc marker:text-audio-accent text-gray-300">{line.slice(2)}</li>;

                      // Empty lines
                      if (line.trim() === '') return <div key={i} className="h-2" />;

                      // Regular paragraphs with inline bold
                      const formatted = line.split(/(\*\*.*?\*\*)/g).map((part, pi) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={pi} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
                        }
                        return part;
                      });
                      return <p key={i} className="mb-2 text-gray-300">{formatted}</p>;
                    })}
                  </div>
                  {isBattleLoading && (
                    <span className="inline-block w-2 h-4 bg-audio-accent animate-pulse ml-1" />
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-audio-border bg-[#050505] flex justify-end">
              <button
                onClick={() => setShowComparison(false)}
                className="px-6 py-2 rounded-lg text-sm font-bold bg-audio-accent text-black hover:bg-[#E5C150] transition-colors"
              >
                Close Battle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;