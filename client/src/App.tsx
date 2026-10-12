import { useState, useRef, useEffect } from 'react';
import { DotmTriangle2 } from '@/components/ui/dotm-triangle-2';
import { Dotm3x3_1 } from '@/components/ui/dotm-3x3-1';
import { Send, Image as ImageIcon, PlusCircle, LogOut, Menu, X, Search, Settings, Brain, XCircle, Edit2, Check, RotateCcw, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { MemoryContext } from './components/MemoryContext';
import { Settings as SettingsComponent } from './components/Settings';
import { ImagePreview } from './components/ImagePreview';
import { VoiceInput } from './components/VoiceInput';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

export interface ChatMessageItem {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  message_type?: 'text' | 'image';
  imageUrl?: string;
  originalImageUrl?: string;
  isEdited?: boolean;
  userUploadPreview?: string;
  status?: 'generating' | 'completed' | 'failed';
  error?: string;
  canRetry?: boolean;
  retryPayload?: {
    prompt: string;
    mode: 'generate' | 'edit';
  };
}

export default function App() {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [conversations, setConversations] = useState<{id: string, title: string, updated_at: string}[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const [personality, setPersonality] = useState(localStorage.getItem('personality') || 'listener');
  const [currentView, setCurrentView] = useState<'chat' | 'memory' | 'settings'>('chat');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Voice speech-to-text recognition hook
  const {
    isSupported: isVoiceSupported,
    isListening: isVoiceListening,
    isInitializing: isVoiceInitializing,
    language: voiceLanguage,
    setLanguage: setVoiceLanguage,
    error: voiceError,
    clearError: clearVoiceError,
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
    cancelListening: cancelVoiceListening,
  } = useSpeechRecognition({
    getCurrentText: () => input,
    onTranscriptChange: (text) => setInput(text)
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getHeaders = (isFormData = false) => {
    const headers: any = {
      'Authorization': `Bearer ${session?.access_token}`
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const applyTheme = () => {
      const theme = localStorage.getItem('theme') || 'system';
      const root = window.document.documentElement;
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (theme === 'dark' || (theme === 'system' && systemPrefersDark)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };
    
    applyTheme();
    window.addEventListener('storage', applyTheme);
    window.addEventListener('theme-changed', applyTheme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    
    return () => {
      window.removeEventListener('storage', applyTheme);
      window.removeEventListener('theme-changed', applyTheme);
      mediaQuery.removeEventListener('change', applyTheme);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    fetch('http://localhost:3001/api/conversations', { headers: getHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setConversations(data);
        }
      })
      .catch(console.error);
  }, [user, session]);

  const loadConversation = async (id: string) => {
    if (isVoiceListening) {
      cancelVoiceListening();
    }
    setCurrentConversationId(id);
    setMessages([]);
    setSidebarOpen(false); // close sidebar on mobile
    setCurrentView('chat');
    setIsConversationLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/conversations/${id}`, { headers: getHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          message_type: m.message_type,
          imageUrl: m.imageUrl,
          originalImageUrl: m.originalImageUrl
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsConversationLoading(false);
    }
  };

  const handleNewChat = () => {
    if (isVoiceListening) {
      cancelVoiceListening();
    }
    setCurrentConversationId(null);
    setMessages([]);
    setInput('');
    setImage(null);
    setPreviewUrl(null);
    setSidebarOpen(false);
    setCurrentView('chat');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSend = async (e?: any, overrideText?: string) => {
    if (e && e.preventDefault) e.preventDefault();

    // If speech recognition is active when sending, stop it gracefully so the final transcript is captured
    if (isVoiceListening) {
      stopVoiceListening();
    }
    
    const textToSend = overrideText !== undefined ? overrideText : input;
    const trimmedInput = typeof textToSend === 'string' ? textToSend.trim() : '';
    if (!trimmedInput && !image) return;
    if (isLoading) return;

    const userMessage = trimmedInput;
    const currentUploadPreview = previewUrl || undefined;
    const currentImageFile = image;

    const newMessages: ChatMessageItem[] = [
      ...messages,
      {
        role: 'user',
        content: userMessage,
        userUploadPreview: currentUploadPreview
      }
    ];

    setMessages(newMessages);
    setInput('');
    setImage(null);
    setPreviewUrl(null);
    setIsLoading(true);
    setGenerationStatus(null);

    let convId = currentConversationId;
    if (!convId) {
      try {
        const res = await fetch('http://localhost:3001/api/conversations', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ title: trimmedInput.slice(0, 30) || 'New Chat' })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
            convId = data.id;
            setCurrentConversationId(convId);
            setConversations(prev => [data, ...prev]);
          }
        }
      } catch (err) {
        console.error("Conversation creation error:", err);
      }
    }

    try {
      const formData = new FormData();
      if (userMessage) formData.append('message', userMessage);
      formData.append('history', JSON.stringify(messages));
      if (convId) formData.append('conversationId', convId);
      if (currentImageFile) formData.append('image', currentImageFile);
      formData.append('personality', personality);

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
      });

      if (!response.ok) {
         let errMsg = `HTTP error! status: ${response.status}`;
         try {
           const errData = await response.json();
           if (errData && errData.error) errMsg = errData.error;
         } catch(e) {}
         throw new Error(errMsg);
      }
      
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'status') {
                setGenerationStatus(data.message || 'Processing...');
              } else if (data.type === 'image') {
                setGenerationStatus(null);
                setMessages(prev => {
                  const lastIndex = prev.length - 1;
                  if (lastIndex >= 0 && prev[lastIndex].role === 'assistant') {
                    const updated = [...prev];
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      imageUrl: data.imageUrl,
                      originalImageUrl: data.originalImageUrl,
                      isEdited: data.isEdited,
                      message_type: 'image',
                      status: 'completed'
                    };
                    return updated;
                  } else {
                    return [...prev, {
                      role: 'assistant',
                      content: data.content || '',
                      imageUrl: data.imageUrl,
                      originalImageUrl: data.originalImageUrl,
                      isEdited: data.isEdited,
                      message_type: 'image',
                      status: 'completed'
                    }];
                  }
                });
              } else if (data.type === 'error') {
                setGenerationStatus(null);
                setMessages(prev => {
                  const lastIndex = prev.length - 1;
                  if (lastIndex >= 0 && prev[lastIndex].role === 'assistant') {
                    const updated = [...prev];
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      error: data.error,
                      canRetry: data.canRetry,
                      retryPayload: data.retryPayload,
                      status: 'failed'
                    };
                    return updated;
                  } else {
                    return [...prev, {
                      role: 'assistant',
                      content: '',
                      error: data.error,
                      canRetry: data.canRetry,
                      retryPayload: data.retryPayload,
                      status: 'failed'
                    }];
                  }
                });
              } else if (data.chunk !== undefined) {
                setMessages(prev => {
                  const lastIndex = prev.length - 1;
                  if (lastIndex >= 0 && prev[lastIndex].role === 'user') {
                    return [...prev, { role: 'assistant', content: data.chunk }];
                  }
                  const updated = [...prev];
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: (updated[lastIndex].content || '') + data.chunk
                  };
                  return updated;
                });
              }
            } catch (err) {
              // ignore parse errors for chunks
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errMsg = error?.message || "Sorry, I'm having trouble connecting right now.";
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        error: errMsg,
        canRetry: true,
        retryPayload: { prompt: userMessage, mode: 'generate' }
      }]);
    } finally {
      setIsLoading(false);
      setGenerationStatus(null);
    }
  };

  const handleRetry = (payload?: { prompt: string; mode: 'generate' | 'edit' }) => {
    if (!payload) return;
    handleSend(undefined, payload.prompt);
  };

  const filteredConversations = conversations;

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const abortController = new AbortController();
      searchAbortControllerRef.current = abortController;

      try {
        const response = await fetch(`http://localhost:3001/api/conversations/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          },
          signal: abortController.signal
        });
        
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        
        if (!abortController.signal.aborted) {
          setSearchResults(data.conversations || []);
          setIsSearching(false);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          setSearchResults(null);
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (searchAbortControllerRef.current) searchAbortControllerRef.current.abort();
    };
  }, [searchQuery, session]);

  const handleRename = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    const originalTitle = conversations.find(c => c.id === id)?.title;
    if (newTitle === originalTitle) {
      setEditingConvId(null);
      return;
    }
    setConversations(conversations.map(c => c.id === id ? { ...c, title: newTitle } : c));
    setEditingConvId(null);
    try {
      const response = await fetch(`http://localhost:3001/api/conversations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ title: newTitle })
      });
      if (!response.ok) throw new Error('Rename failed');
    } catch (err) {
      console.error(err);
      setConversations(conversations.map(c => c.id === id ? { ...c, title: originalTitle || 'New Chat' } : c));
    }
  };

  const handleSearchResultClick = (id: string) => {
    loadConversation(id);
    setSearchQuery('');
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-background text-foreground">Loading...</div>;
  if (!user) return <Auth />;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 w-72 bg-surface-1 border-r border-border flex flex-col z-50 transition-transform duration-300 ease-in-out`}>
        <div className="p-4 border-b border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-xl text-heading tracking-tight">Personal Agent</h1>
            <button onClick={() => setSidebarOpen(false)} className="p-2 text-muted-foreground md:hidden hover:bg-surface-2 rounded-lg transition">
              <X size={20} />
            </button>
          </div>
          
          <button 
            onClick={handleNewChat}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:opacity-90 shadow-sm transition active:scale-[0.98]">
            <PlusCircle size={20} />
            New Chat
          </button>
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-2 text-sm rounded-lg pl-9 pr-4 py-2 outline-none border border-transparent focus:border-border transition-colors text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="px-3 pb-2 pt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {searchQuery.trim() ? 'Search Results' : 'Your Conversations'}
          </div>
          
          {searchQuery.trim() ? (
            isSearching ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">Searching...</div>
            ) : searchResults && searchResults.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No conversations found.</div>
            ) : searchResults ? (
              searchResults.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => handleSearchResultClick(c.id)}
                  className={`p-3 block rounded-xl cursor-pointer text-sm transition-all group hover:bg-surface-2 text-muted-foreground hover:text-foreground`}
                >
                  <div className="truncate w-full font-medium text-foreground">{c.title}</div>
                  {c.matchedMessageSnippet && (
                    <div className="mt-1 text-xs opacity-80 line-clamp-2 leading-relaxed">
                      {c.matchedMessageSnippet}
                    </div>
                  )}
                </div>
              ))
            ) : (
               <div className="px-3 py-4 text-sm text-muted-foreground text-center text-red-500">Couldn't search conversations</div>
            )
          ) : (
            filteredConversations.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No conversations found.</div>
            ) : (
              filteredConversations.map(c => (
                <div 
                  key={c.id} 
                  className={`p-3 rounded-xl text-sm transition-all group flex items-center justify-between
                    ${currentConversationId === c.id 
                      ? 'bg-surface-2 text-primary dark:text-foreground font-medium border border-border/50 shadow-sm' 
                      : 'hover:bg-surface-2 text-muted-foreground hover:text-foreground'}`}
                >
                  {editingConvId === c.id ? (
                    <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                      <input 
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(c.id, editingTitle);
                          if (e.key === 'Escape') setEditingConvId(null);
                        }}
                        className="flex-1 bg-background text-foreground border border-border rounded px-2 py-1 text-xs outline-none"
                      />
                      <button onClick={() => handleRename(c.id, editingTitle)} className="p-1 text-primary hover:opacity-80">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="truncate flex-1 cursor-pointer" onClick={() => loadConversation(c.id)}>{c.title}</div>
                      {currentConversationId === c.id && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingConvId(c.id);
                            setEditingTitle(c.title);
                          }} 
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))
            )
          )}
        </div>
        
        <div className="p-4 border-t border-border space-y-2">
          <div 
            onClick={() => { setCurrentView('memory'); setSidebarOpen(false); }}
            className={`flex items-center gap-2 p-2 text-sm rounded-lg cursor-pointer transition ${currentView === 'memory' ? 'bg-surface-2 text-primary dark:text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'}`}
          >
            <Brain size={18} />
            <span>Memory Context</span>
          </div>
          <div 
            onClick={() => { setCurrentView('settings'); setSidebarOpen(false); }}
            className={`flex items-center gap-2 p-2 text-sm rounded-lg cursor-pointer transition ${currentView === 'settings' ? 'bg-surface-2 text-primary dark:text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'}`}
          >
            <Settings size={18} />
            <span>Settings</span>
          </div>
          <button 
            onClick={signOut}
            className="flex items-center gap-2 w-full p-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {currentView === 'memory' ? (
        <MemoryContext session={session} onBack={() => setCurrentView('chat')} />
      ) : currentView === 'settings' ? (
        <SettingsComponent onBack={() => setCurrentView('chat')} onOpenMemory={() => setCurrentView('memory')} />
      ) : (
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-8 bg-surface-1/90 backdrop-blur-md z-10 sticky top-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-primary dark:text-foreground hover:bg-surface-2 rounded-lg md:hidden transition">
              <Menu size={24} />
            </button>
          </div>
          
          <div className="flex items-center">
            <select 
              value={personality}
              onChange={(e) => {
                setPersonality(e.target.value);
                localStorage.setItem('personality', e.target.value);
              }}
              className="bg-surface-2 border border-border text-sm rounded-lg px-3 py-1.5 outline-none text-foreground cursor-pointer hover:border-primary/30 transition-colors appearance-none pr-8 relative"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231A050A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="best_friend">Best Friend</option>
              <option value="calm_friend">Calm Friend</option>
              <option value="funny_friend">Funny Friend</option>
              <option value="study_buddy">Study Buddy</option>
              <option value="listener">Listener</option>
              <option value="tough_friend">Tough Friend</option>
            </select>
          </div>
        </header>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 scroll-smooth">
          {isConversationLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
              <DotmTriangle2
                size={90}
                dotSize={17.5}
                speed={1.5}
                pattern="full"
                colorPreset="solid-theme"
                animated
                opacityBase={0.12}
                opacityMid={0.42}
                opacityPeak={1}
                ariaLabel="Loading conversation"
              />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-heading tracking-tight">Hi there.</h2>
                <p className="text-muted-foreground text-lg">I'm your AI emotional companion. How are you feeling today?</p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-surface-1 border border-border rounded-tl-sm text-foreground'
                }`}>
                  {/* User Upload Preview */}
                  {msg.role === 'user' && msg.userUploadPreview && (
                    <div className="mb-2.5">
                      <img
                        src={msg.userUploadPreview}
                        alt="Uploaded preview"
                        className="h-28 rounded-xl object-cover border border-white/20 shadow-sm"
                      />
                    </div>
                  )}

                  {msg.role === 'assistant' ? (
                    <div>
                      {msg.content && (
                        <div className="prose prose-sm md:prose-base prose-p:leading-relaxed prose-headings:text-heading max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}

                      {/* Generated / Edited Image Preview */}
                      {msg.imageUrl && (
                        <ImagePreview
                          imageUrl={msg.imageUrl}
                          originalImageUrl={msg.originalImageUrl}
                          isEdited={msg.isEdited}
                          altText={msg.content || 'Generated asset'}
                        />
                      )}

                      {/* Error & Retry Component */}
                      {msg.error && (
                        <div className="mt-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm flex flex-col gap-2">
                          <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span className="leading-snug font-medium">{msg.error}</span>
                          </div>
                          {msg.canRetry && msg.retryPayload && (
                            <button
                              onClick={() => handleRetry(msg.retryPayload)}
                              className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition active:scale-95 shadow-sm mt-1 cursor-pointer"
                            >
                              <RotateCcw size={13} />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-surface-1 border border-border rounded-2xl rounded-tl-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
                <Dotm3x3_1
                  size={72}
                  dotSize={17}
                  speed={1.15}
                  pattern="full"
                  colorPreset="solid-theme"
                  animated
                  opacityBase={0.06}
                  opacityMid={0.38}
                  opacityPeak={1}
                  cellPadding={1}
                  ariaLabel="AI is thinking"
                />
                {generationStatus && (
                  <div className="flex items-center gap-2 text-sm text-primary dark:text-foreground font-medium animate-pulse border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-3">
                    <Sparkles size={16} />
                    <span>{generationStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="max-w-4xl mx-auto">
            {previewUrl && (
              <div className="mb-3 relative inline-block group">
                <img src={previewUrl} alt="Preview" className="h-24 rounded-xl border-2 border-border object-cover shadow-sm transition-opacity group-hover:opacity-80" />
                <button 
                  onClick={() => { setImage(null); setPreviewUrl(null); }}
                  className="absolute -top-3 -right-3 bg-background text-primary dark:text-foreground rounded-full hover:text-red-500 transition-colors shadow-sm"
                >
                  <XCircle size={24} className="fill-current bg-background rounded-full" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 bg-surface-1 border border-border p-2 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                accept="image/*"
                onChange={handleImageSelect}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-muted-foreground hover:text-primary dark:hover:text-foreground hover:bg-surface-2 transition rounded-xl"
                title="Upload Image"
              >
                <ImageIcon size={22} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message your companion..."
                className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-3 px-2 min-h-[44px] max-h-[200px] outline-none text-foreground placeholder:text-muted-foreground/70"
                rows={1}
              />
              <VoiceInput
                isSupported={isVoiceSupported}
                isListening={isVoiceListening}
                isInitializing={isVoiceInitializing}
                language={voiceLanguage}
                onLanguageChange={setVoiceLanguage}
                onStart={startVoiceListening}
                onStop={stopVoiceListening}
                onCancel={cancelVoiceListening}
                disabled={isLoading}
                error={voiceError}
                onClearError={clearVoiceError}
              />
              <button 
                onClick={handleSend}
                disabled={(!input.trim() && !image) || isLoading}
                className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-40 hover:opacity-90 transition active:scale-95 shadow-sm mb-0.5 mr-0.5"
              >
                <Send size={20} className={isLoading ? "animate-pulse" : ""} />
              </button>
            </div>
            <div className="text-center mt-3 text-xs text-muted-foreground/60">
              AI companion can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
