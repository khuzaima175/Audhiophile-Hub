import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import SettingsModal from './components/SettingsModal';
import { SendIcon, SettingsIcon, PaperclipIcon, XIcon, MicIcon, StopIcon, EqIcon, ActivityIcon, MenuIcon } from './components/Icon';
import { ChatSession, Message, AudioProfile, DEFAULT_PROFILE, GroundingSource, KnowledgeEntry } from './types';
import { generateStreamResponse, generateSessionSummary } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY_CHATS = 'audiosage_chats_v1';
const STORAGE_KEY_PROFILE = 'audiosage_profile_v1';
const STORAGE_KEY_KNOWLEDGE = 'audiosage_knowledge_v1';

const App: React.FC = () => {
  // State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [profile, setProfile] = useState<AudioProfile>(DEFAULT_PROFILE);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // New State for Features
  const [isAdvancedAnalysis, setIsAdvancedAnalysis] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('gemini-3-flash-preview');

  const formatModelName = (modelName: string): string => {
    if (modelName.includes('gemini-3-flash-preview')) return 'GEMINI-3 FLASH';
    if (modelName.includes('gemini-3-flash')) return 'GEMINI-3 FLASH';
    if (modelName.includes('gemini-2.5-flash')) return 'GEMINI-2.5 FLASH';
    if (modelName.includes('gemini-2.0-flash-lite')) return 'GEMINI-2.0 FLASH LITE';
    if (modelName.includes('gemini-2.0-flash')) return 'GEMINI-2.0 FLASH';
    return modelName.toUpperCase();
  };

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  // Load data on mount
  useEffect(() => {
    const storedChats = localStorage.getItem(STORAGE_KEY_CHATS);
    const storedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    const storedKnowledge = localStorage.getItem(STORAGE_KEY_KNOWLEDGE);

    if (storedChats) {
      setSessions(JSON.parse(storedChats));
    }
    if (storedProfile) {
      const parsed = JSON.parse(storedProfile);
      // Migration: If the user has the old default profile (empty memories) and hasn't heavily customized it, 
      // upgrade them to the new verified knowledge base automatically.
      if (parsed.savedMemories.length === 0 && parsed.name === "Audiophile") {
        setProfile(DEFAULT_PROFILE);
      } else {
        // Merge with DEFAULT_PROFILE to backfill any missing fields (e.g. technicalPrefs added in newer versions)
        setProfile({ ...DEFAULT_PROFILE, ...parsed });
      }
    } else {
      setProfile(DEFAULT_PROFILE);
    }

    if (storedKnowledge) {
      setKnowledgeBase(JSON.parse(storedKnowledge));
    }

    // Note: Geolocation removed from auto-load. Maps feature not currently used.
    // Can be requested when needed in the future.
  }, []);

  // Persist data
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_KNOWLEDGE, JSON.stringify(knowledgeBase));
  }, [knowledgeBase]);

  // Scroll to bottom
  const scrollToBottom = (force = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // Only auto-scroll if user is within 150px of bottom, or if forced (new session)
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (force || distanceFromBottom < 150) {
      container.scrollTop = container.scrollHeight;
    }
  };

  const handleMessagesScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 150;
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessions, currentSessionId]);

  // Force scroll to bottom only when a new session is selected
  useEffect(() => {
    scrollToBottom(true);
  }, [currentSessionId]);

  // Knowledge Base Actions
  const handleSummarizeHistory = async () => {
    setIsSummarizing(true);
    let newEntries: KnowledgeEntry[] = [];
    let updatedSessions = [...sessions];

    for (let i = 0; i < updatedSessions.length; i++) {
      const session = updatedSessions[i];
      // Only summarize if it has messages, hasn't been summarized, and is effectively "finished" (e.g. > 2 messages)
      if (session.messages.length >= 2 && !session.isSummarized) {
        try {
          const entry = await generateSessionSummary(session);
          newEntries.push(entry);
          updatedSessions[i] = { ...session, isSummarized: true };
        } catch (err) {
          console.error(`Failed to summarize session ${session.id}`, err);
        }
      }
    }

    if (newEntries.length > 0) {
      setKnowledgeBase(prev => [...newEntries, ...prev]);
      setSessions(updatedSessions);
    }
    setIsSummarizing(false);
  };

  // Actions
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Research',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSummarized: false
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const starSession = (id: string) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, isStarred: !s.isStarred } : s
    ));
  };

  const renameSession = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title: newTitle } : s
    ));
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    setIsMobileSidebarOpen(false); // Close mobile sidebar on selection
  };

  const handleSaveToNotes = (note: string) => {
    if (note.trim()) {
      setProfile(prev => ({
        ...prev,
        savedMemories: [...(prev.savedMemories || []), note.trim()]
      }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAutoEQFromGraph = () => {
    // Open file selector
    fileInputRef.current?.click();
    // Hint to the user
    setInput("Generate Auto-EQ settings from this frequency response graph. Target the dashed line.");
  }

  // Recording Logic
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/aac'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return ''; // Let browser use default
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support audio recording");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      audioChunks.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Use the actual mimeType the recorder settled on, or fallback
        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks.current, { type: finalMimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          // Send message automatically after stop
          handleSendMessage(undefined, base64Audio);
        };
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      let message = "Could not access microphone. Please check permissions.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = "Microphone permission denied. Please allow access in browser settings.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = "No microphone found on this device.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = "Could not access microphone. It may be in use by another application.";
      }
      alert(message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleSendMessage = async (textOverride?: string, audioOverride?: string) => {
    const textToSend = textOverride !== undefined ? textOverride : input;
    const audioToSend = audioOverride;

    if ((!textToSend.trim() && !attachedImage && !audioToSend) || isGenerating) return;

    // Create session if none exists
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newSession: ChatSession = {
        id: uuidv4(),
        title: textToSend.slice(0, 30) || (audioToSend ? 'Voice Query' : 'Image Analysis'),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSummarized: false
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      activeSessionId = newSession.id;
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      text: textToSend,
      image: attachedImage,
      audio: audioToSend,
      timestamp: Date.now(),
    };

    // Optimistic Update
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: [...s.messages, userMessage],
          title: s.messages.length === 0 ? (textToSend.slice(0, 30) || (audioToSend ? 'Voice Query' : 'Image Analysis')) : s.title,
          updatedAt: Date.now(),
          isSummarized: false // Mark as active/dirty so it can be re-summarized if needed
        };
      }
      return s;
    }));

    // Reset Input State
    const imageToSend = attachedImage;
    const advancedMode = isAdvancedAnalysis;

    setInput('');
    setAttachedImage(undefined);
    setIsGenerating(true);

    // Prepare placeholder for bot message
    const botMessageId = uuidv4();
    const placeholderBotMessage: Message = {
      id: botMessageId,
      role: 'model',
      text: '',
      timestamp: Date.now(),
      isThinking: true
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [...s.messages, placeholderBotMessage] };
      }
      return s;
    }));

    try {
      const currentSession = sessions.find(s => s.id === activeSessionId) || { messages: [], id: 'temp', title: '', createdAt: 0, updatedAt: 0 };
      const contextHistory = [...currentSession.messages, userMessage];

      let streamText = '';
      const collectedSources: GroundingSource[] = [];

      await generateStreamResponse(
        contextHistory,
        textToSend,
        imageToSend,
        audioToSend,
        profile,
        sessions,
        knowledgeBase, // Pass Knowledge Base
        advancedMode,
        userLocation,
        (chunk) => {
          streamText += chunk;
          setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
              const updatedMessages = s.messages.map(m =>
                m.id === botMessageId ? { ...m, text: streamText, isThinking: false } : m
              );
              return { ...s, messages: updatedMessages };
            }
            return s;
          }));
        },
        (sources) => {
          collectedSources.push(...sources);
        },
        (model) => {
          setActiveModel(model);
        }
      );

      // Final update
      if (collectedSources.length > 0) {
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            const updatedMessages = s.messages.map(m =>
              m.id === botMessageId ? { ...m, groundingSources: collectedSources } : m
            );
            return { ...s, messages: updatedMessages };
          }
          return s;
        }));
      }

    } catch (error: any) {
      console.error("Failed to generate", error);
      const errorMessage = error.message || "Unknown error";

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedMessages = s.messages.map(m =>
            m.id === botMessageId ? {
              ...m,
              text: `**Connection Error**: ${errorMessage}\n\nPlease check your API Key and ensure it is valid for Gemini models.`,
              isThinking: false
            } : m
          );
          return { ...s, messages: updatedMessages };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify = (instruction: string) => {
    handleSendMessage(instruction);
  }

  const handleQuickEQ = () => {
    setInput("Generate a detailed Parametric EQ profile for [HEADPHONE NAME] to match the Harman Target 2018. Include Preamp.");
  }

  const activeMessages = sessions.find(s => s.id === currentSessionId)?.messages || [];

  return (
    <div className="flex h-screen h-screen-mobile bg-audio-base text-audio-text font-sans overflow-hidden selection:bg-audio-accent selection:text-black">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={createNewSession}
          onDeleteSession={deleteSession}
          onStarSession={starSession}
          onRenameSession={renameSession}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full animate-in slide-in-from-left duration-300">
            <Sidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={() => { createNewSession(); setIsMobileSidebarOpen(false); }}
              onDeleteSession={deleteSession}
              onStarSession={starSession}
              onRenameSession={renameSession}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <header className="h-16 border-b border-audio-border flex items-center justify-between px-4 md:px-8 bg-audio-base/90 backdrop-blur z-10">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            >
              <MenuIcon />
            </button>
            <span className="font-bold text-white tracking-tight">AudioSage</span>
          </div>
          <div className="hidden md:block text-xs text-audio-muted font-mono tracking-wide">
            MODEL: <span className="text-audio-accent">{formatModelName(activeModel)}</span> // STATUS: <span className="text-green-500">ONLINE</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-audio-accent transition-all uppercase tracking-wider border border-transparent hover:border-audio-border px-3 py-1.5 rounded-full"
            >
              <SettingsIcon />
              <span>Knowledge Base</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto overflow-x-clip p-4 md:p-8 space-y-2 scroll-smooth bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#101010] to-[#050505]"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          {activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-gradient-to-br from-audio-surface to-black rounded-2xl border border-audio-border flex items-center justify-center text-audio-accent shadow-2xl mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">AudioSage Research</h2>
                <p className="text-gray-400">
                  Welcome back, <span className="text-audio-accent">{profile.name}</span>. I have access to your previous findings and {profile.savedMemories?.length || 0} permanent memories.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mt-8">
                <button
                  onClick={() => setInput("Find me the best IEM under $100 with wide soundstage and good imaging for gaming and music")}
                  className="p-4 bg-audio-surface hover:bg-audio-highlight rounded-xl text-sm transition-all text-left border border-audio-border hover:border-audio-accent group"
                >
                  <span className="text-green-400 font-mono text-[10px] block mb-1">FIND IEM</span>
                  <span className="text-xs text-gray-300">"Under $100, gaming focus"</span>
                </button>
                <button
                  onClick={() => setInput("Create a detailed comparison table between [IEM 1] and [IEM 2] covering sound signature, imaging, build, and value")}
                  className="p-4 bg-audio-surface hover:bg-audio-highlight rounded-xl text-sm transition-all text-left border border-audio-border hover:border-audio-accent group"
                >
                  <span className="text-blue-400 font-mono text-[10px] block mb-1">COMPARE</span>
                  <span className="text-xs text-gray-300">"IEM vs IEM table"</span>
                </button>
                <button
                  onClick={handleAutoEQFromGraph}
                  className="p-4 bg-audio-surface hover:bg-audio-highlight rounded-xl text-sm transition-all text-left border border-audio-border hover:border-audio-accent group relative overflow-hidden"
                >
                  <div className="absolute top-2 right-2 opacity-30"><EqIcon /></div>
                  <span className="text-audio-accent font-mono text-[10px] block mb-1">AUTO-EQ</span>
                  <span className="text-xs text-gray-300">"EQ from FR graph"</span>
                </button>
                <button
                  onClick={() => setInput(`Suggest an upgrade from my ${profile.currentGear?.split(',')[0] || 'current IEMs'} with better soundstage and imaging, under $200`)}
                  className="p-4 bg-audio-surface hover:bg-audio-highlight rounded-xl text-sm transition-all text-left border border-audio-border hover:border-purple-400 group"
                >
                  <span className="text-purple-400 font-mono text-[10px] block mb-1">UPGRADE</span>
                  <span className="text-xs text-gray-300">"From my current gear"</span>
                </button>
              </div>

              {/* Current Gear Summary */}
              {profile.currentGear && (
                <div className="mt-6 p-4 bg-audio-surface/50 rounded-xl border border-audio-border/50">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Your Current Gear</div>
                  <div className="text-sm text-gray-300">{profile.currentGear}</div>
                </div>
              )}
            </div>
          ) : (
            activeMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onVerify={handleVerify}
                onSaveToNotes={handleSaveToNotes}
              />
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-audio-base border-t border-audio-border safe-area-bottom">
          <div className="max-w-7xl mx-auto relative group">

            {/* Toolbar */}
            <div className="mb-3 pl-1 -mx-1 px-1 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-x-touch mobile-scroll-fix" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
              <div className="flex items-center gap-2 min-w-max pb-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach an image for analysis (e.g., frequency response graph)"
                  className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0 ${attachedImage ? 'bg-audio-accent/20 border-audio-accent text-audio-accent' : 'bg-audio-surface border-audio-border text-gray-400 hover:text-white'
                    }`}
                >
                  <PaperclipIcon />
                  <span className="hidden sm:inline">{attachedImage ? 'Image Attached' : 'Attach'}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                  accept="image/*"
                />

                <button
                  onClick={() => setIsAdvancedAnalysis(!isAdvancedAnalysis)}
                  title="Use technical terminology and measurement data (THD, Impulse Response, SINAD)"
                  className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0 ${isAdvancedAnalysis
                    ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                    : 'bg-audio-surface border-audio-border text-gray-400 hover:text-white'
                    }`}
                >
                  <ActivityIcon />
                  <span className="hidden sm:inline">Tech Analysis</span>
                  {isAdvancedAnalysis && <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse ml-1" />}
                </button>

                <button
                  onClick={handleAutoEQFromGraph}
                  title="Upload a frequency response graph to generate EQ settings targeting the Crinacle IEF curve"
                  className="p-2 rounded-lg border border-audio-accent/30 bg-audio-surface text-audio-accent hover:bg-audio-accent hover:text-black transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0"
                >
                  <EqIcon />
                  <span className="hidden sm:inline">Auto-EQ</span>
                </button>
              </div>
            </div>

            {/* Attachment Preview */}
            {attachedImage && (
              <div className="absolute bottom-full mb-4 left-0 z-20">
                <div className="relative group/preview">
                  <img src={attachedImage} alt="Preview" className="h-20 w-auto rounded-lg border border-audio-accent shadow-lg bg-black object-cover" />
                  <button
                    onClick={() => setAttachedImage(undefined)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md"
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-audio-accent/5 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            {/* Input Wrapper */}
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isRecording ? "Listening..." : (isAdvancedAnalysis ? "Ask about THD, Impulse Response, or measurements..." : "Ask about soundstage, imaging...")}
                disabled={isGenerating || isRecording}
                className={`w-full bg-[#0A0A0A] text-white placeholder-gray-600 border rounded-xl py-4 pl-6 pr-24 focus:outline-none transition-all shadow-lg relative z-10 ${isAdvancedAnalysis
                  ? 'border-cyan-500/50 focus:border-cyan-500 focus:ring-cyan-500/20'
                  : isRecording
                    ? 'border-red-500/50 ring-1 ring-red-500/20'
                    : 'border-audio-border focus:border-audio-accent focus:ring-audio-accent/50 focus:ring-1'
                }`}
              />

              <div className="absolute right-2 top-2 flex items-center gap-1 z-20">
                {/* Recording Button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-lg transition-all duration-200 ${isRecording
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse'
                    : 'text-gray-500 hover:text-white hover:bg-white/10'
                    }`}
                  title={isRecording ? "Stop Recording" : "Voice Input"}
                >
                  {isRecording ? <StopIcon /> : <MicIcon />}
                </button>

                {/* Send Button */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={(!input.trim() && !attachedImage) || isGenerating || isRecording}
                  className={`p-2 rounded-lg transition-all ${(input.trim() || attachedImage) && !isGenerating && !isRecording
                    ? 'bg-audio-accent text-black hover:bg-[#E5C150] shadow-lg shadow-yellow-900/20'
                    : 'bg-transparent text-gray-700 cursor-not-allowed'
                    }`}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
          <div className="text-center mt-3 flex justify-center items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-audio-accent opacity-50"></div>
            <p className="text-[10px] text-gray-600 font-mono">
              GROUNDED WITH GOOGLE SEARCH • MULTIMODAL • RAG
            </p>
            <div className="w-1.5 h-1.5 rounded-full bg-audio-accent opacity-50"></div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={profile}
        knowledgeBase={knowledgeBase}
        onSave={setProfile}
        onSummarizeHistory={handleSummarizeHistory}
        isSummarizing={isSummarizing}
      />
    </div>
  );
};

export default App;