import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HomeConsole from './components/HomeConsole';
import InputConsole from './components/InputConsole';
import MessageBubble from './components/MessageBubble';
import SettingsModal from './components/SettingsModal';
import CommandPalette from './components/CommandPalette';
import GraphLab from './components/GraphLab';
import { labStore } from './store/labStore';
import { decodeUrlToLabState } from './utils/shareCodec';
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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'eq' | 'gear' | 'memory' | 'knowledge'>('profile');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Analysis & Model State
  const [isAdvancedAnalysis, setIsAdvancedAnalysis] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('gemini-3.6-flash');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

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
      if (parsed.savedMemories?.length === 0 && parsed.name === 'Audiophile') {
        setProfile(DEFAULT_PROFILE);
      } else {
        setProfile({ ...DEFAULT_PROFILE, ...parsed });
      }
    } else {
      setProfile(DEFAULT_PROFILE);
    }

    if (storedKnowledge) {
      setKnowledgeBase(JSON.parse(storedKnowledge));
    }

    // Auto-hydrate shared Graph Lab URLs (e.g. #/lab?c=...)
    const checkHashForLab = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/lab')) {
        const decoded = decodeUrlToLabState(hash);
        if (decoded) {
          labStore.loadState(decoded);
        } else {
          labStore.setIsOpen(true);
        }
      }
    };

    checkHashForLab();
    window.addEventListener('hashchange', checkHashForLab);
    return () => window.removeEventListener('hashchange', checkHashForLab);
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

  // Scroll logic
  const scrollToBottom = (force = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;
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

  useEffect(() => {
    scrollToBottom(true);
  }, [currentSessionId]);

  // Knowledge Base Actions
  const handleSummarizeHistory = async () => {
    setIsSummarizing(true);
    const newEntries: KnowledgeEntry[] = [];
    const updatedSessions = [...sessions];

    for (let i = 0; i < updatedSessions.length; i++) {
      const session = updatedSessions[i];
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
      setKnowledgeBase((prev) => [...newEntries, ...prev]);
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
      isSummarized: false,
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const starSession = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isStarred: !s.isStarred } : s))
    );
  };

  const renameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    setIsMobileSidebarOpen(false);
  };

  const handleSaveToNotes = (note: string) => {
    if (note.trim()) {
      setProfile((prev) => ({
        ...prev,
        savedMemories: [...(prev.savedMemories || []), note.trim()],
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
    fileInputRef.current?.click();
    setInput('Generate Auto-EQ settings from this frequency response graph. Target Crinacle IEF 2025.');
  };

  const openKnowledgeBase = (tab: 'profile' | 'eq' | 'gear' | 'memory' | 'knowledge' = 'profile') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  // Recording Logic
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/aac',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support audio recording');
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
        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks.current, { type: finalMimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage(undefined, base64Audio);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      let message = 'Could not access microphone. Please check permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Microphone permission denied. Please allow access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No microphone found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Could not access microphone. It may be in use by another application.';
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

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newSession: ChatSession = {
        id: uuidv4(),
        title: textToSend.slice(0, 30) || (audioToSend ? 'Voice Query' : 'Image Analysis'),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSummarized: false,
      };
      setSessions((prev) => [newSession, ...prev]);
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

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, userMessage],
            title:
              s.messages.length === 0
                ? textToSend.slice(0, 30) || (audioToSend ? 'Voice Query' : 'Image Analysis')
                : s.title,
            updatedAt: Date.now(),
            isSummarized: false,
          };
        }
        return s;
      })
    );

    const imageToSend = attachedImage;
    const advancedMode = isAdvancedAnalysis;

    setInput('');
    setAttachedImage(undefined);
    setIsGenerating(true);

    const botMessageId = uuidv4();
    const placeholderBotMessage: Message = {
      id: botMessageId,
      role: 'model',
      text: '',
      timestamp: Date.now(),
      isThinking: true,
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, placeholderBotMessage] };
        }
        return s;
      })
    );

    try {
      const currentSession = sessions.find((s) => s.id === activeSessionId) || {
        messages: [],
        id: 'temp',
        title: '',
        createdAt: 0,
        updatedAt: 0,
      };
      const contextHistory = [...currentSession.messages, userMessage];

      const requestStartTime = Date.now();
      let firstChunkReceived = false;
      let streamText = '';
      const collectedSources: GroundingSource[] = [];

      await generateStreamResponse(
        contextHistory,
        textToSend,
        imageToSend,
        audioToSend,
        profile,
        sessions,
        knowledgeBase,
        advancedMode,
        null,
        (chunk) => {
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            setLatencyMs(Date.now() - requestStartTime);
          }
          streamText += chunk;
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === activeSessionId) {
                const updatedMessages = s.messages.map((m) =>
                  m.id === botMessageId ? { ...m, text: streamText, isThinking: false } : m
                );
                return { ...s, messages: updatedMessages };
              }
              return s;
            })
          );
        },
        (sources) => {
          collectedSources.push(...sources);
        },
        (model) => {
          setActiveModel(model);
        },
        activeModel
      );

      if (collectedSources.length > 0) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              const updatedMessages = s.messages.map((m) =>
                m.id === botMessageId ? { ...m, groundingSources: collectedSources } : m
              );
              return { ...s, messages: updatedMessages };
            }
            return s;
          })
        );
      }
    } catch (error: any) {
      console.error('Failed to generate', error);
      const errorMessage = error.message || 'Unknown error';

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const updatedMessages = s.messages.map((m) =>
              m.id === botMessageId
                ? {
                    ...m,
                    text: `**Connection Error**: ${errorMessage}\n\nPlease check your API Key and ensure it is valid for Gemini models.`,
                    isThinking: false,
                  }
                : m
            );
            return { ...s, messages: updatedMessages };
          }
          return s;
        })
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify = (instruction: string) => {
    handleSendMessage(instruction);
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const activeMessages = currentSession?.messages || [];
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY || (typeof window !== 'undefined' && localStorage.getItem('audiosage_api_key')));

  return (
    <div className="flex h-screen h-screen-mobile bg-audio-base text-audio-text font-sans overflow-hidden selection:bg-audio-accent selection:text-black">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          profile={profile}
          activeModel={activeModel}
          onSelectSession={handleSelectSession}
          onNewChat={createNewSession}
          onDeleteSession={deleteSession}
          onStarSession={starSession}
          onRenameSession={renameSession}
          onOpenKnowledgeBase={openKnowledgeBase}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full animate-in slide-in-from-left duration-300">
            <Sidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              profile={profile}
              activeModel={activeModel}
              onSelectSession={handleSelectSession}
              onNewChat={() => {
                createNewSession();
                setIsMobileSidebarOpen(false);
              }}
              onDeleteSession={deleteSession}
              onStarSession={starSession}
              onRenameSession={renameSession}
              onOpenKnowledgeBase={(tab) => {
                openKnowledgeBase(tab);
                setIsMobileSidebarOpen(false);
              }}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
        {/* Header — hardware readout strip */}
        <Header
          activeModel={activeModel}
          onSelectModel={setActiveModel}
          onOpenKnowledgeBase={() => openKnowledgeBase('profile')}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          currentSessionTitle={currentSession?.title}
          hasActiveSession={!!currentSessionId && activeMessages.length > 0}
          latencyMs={latencyMs || undefined}
          isStreaming={isGenerating}
        />

        {/* Main View Area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleMessagesScroll}
          className="messages-container flex-1 overflow-y-auto p-3 md:p-6 pb-16 md:pb-20 space-y-4 scroll-smooth bg-audio-base w-full min-w-0"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            contain: 'inline-size',
          }}
        >
          {activeMessages.length === 0 ? (
            /* Home Console Hardware Rack (replaces empty void) */
            <HomeConsole
              profile={profile}
              sessions={sessions}
              hasApiKey={hasApiKey}
              onSelectPrompt={(promptText) => {
                setInput(promptText);
                handleSendMessage(promptText);
              }}
              onAutoEQClick={handleAutoEQFromGraph}
              onOpenKnowledgeBase={openKnowledgeBase}
            />
          ) : (
            /* Message Stream */
            activeMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                activeModel={activeModel}
                onVerify={handleVerify}
                onSaveToNotes={handleSaveToNotes}
                onRetry={() => {
                  const lastUserMsg = [...activeMessages].reverse().find((m) => m.role === 'user');
                  if (lastUserMsg?.text) handleSendMessage(lastUserMsg.text);
                }}
                onOpenSettings={() => openKnowledgeBase('memory')}
              />
            ))
          )}
        </div>

        {/* Input Console */}
        <InputConsole
          input={input}
          isGenerating={isGenerating}
          isRecording={isRecording}
          isAdvancedAnalysis={isAdvancedAnalysis}
          attachedImage={attachedImage}
          onInputChange={setInput}
          onSend={handleSendMessage}
          onToggleAdvanced={() => setIsAdvancedAnalysis(!isAdvancedAnalysis)}
          onAutoEQClick={handleAutoEQFromGraph}
          onImageUpload={handleImageUpload}
          onRemoveImage={() => setAttachedImage(undefined)}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
        />
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
        accept="image/*"
      />

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        sessions={sessions}
        profile={profile}
        onSelectSession={handleSelectSession}
        onNewChat={() => {
          createNewSession();
          setIsCommandPaletteOpen(false);
        }}
        onOpenKnowledgeBase={(tab) => {
          openKnowledgeBase(tab);
          setIsCommandPaletteOpen(false);
        }}
        onToggleAdvanced={() => setIsAdvancedAnalysis((prev) => !prev)}
        onAutoEQClick={handleAutoEQFromGraph}
      />

      {/* Settings / Knowledge Base Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={profile}
        knowledgeBase={knowledgeBase}
        onSave={setProfile}
        onSummarizeHistory={handleSummarizeHistory}
        isSummarizing={isSummarizing}
        initialTab={settingsTab}
      />

      {/* Full-Screen Graph Lab Modal / Route */}
      <GraphLab
        onSavePreset={(newPreset) => {
          const updatedEqLib = [...(profile.eqLibrary || []), newPreset];
          setProfile((prev) => ({ ...prev, eqLibrary: updatedEqLib }));
        }}
      />
    </div>
  );
};

export default App;
