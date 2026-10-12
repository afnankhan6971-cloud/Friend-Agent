import { useState, useEffect } from 'react';
import { ArrowLeft, Moon, Sun, Monitor, Shield, Trash2, LogOut, Database, User, Globe, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Settings = ({ onBack, onOpenMemory }: { onBack: () => void, onOpenMemory: () => void }) => {
  const { user, signOut } = useAuth();
  
  // Local state for settings
  const [appearance, setAppearance] = useState(localStorage.getItem('theme') || 'system');
  const [personality, setPersonality] = useState(localStorage.getItem('personality') || 'listener');
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'auto');
  const [memoryEnabled, setMemoryEnabled] = useState(localStorage.getItem('memoryEnabled') !== 'false');
  
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Update local storage when settings change
  useEffect(() => { 
    localStorage.setItem('theme', appearance); 
    window.dispatchEvent(new Event('theme-changed'));
  }, [appearance]);
  useEffect(() => { localStorage.setItem('personality', personality); }, [personality]);
  useEffect(() => { localStorage.setItem('language', language); }, [language]);
  useEffect(() => { localStorage.setItem('memoryEnabled', String(memoryEnabled)); }, [memoryEnabled]);

  const handleClearConversations = async () => {
    // We would clear conversations here
    setShowClearConfirm(false);
  };

  const Section = ({ title, icon: Icon, children }: any) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-primary dark:text-foreground" />
        <h2 className="text-sm font-bold text-heading uppercase tracking-wider">{title}</h2>
      </div>
      <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <header className="h-16 border-b border-border flex items-center px-4 lg:px-8 bg-surface-1/90 backdrop-blur-md sticky top-0 shadow-sm gap-4 z-10">
        <button onClick={onBack} className="p-2 hover:bg-surface-2 rounded-lg text-muted-foreground transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-semibold text-lg text-heading tracking-tight">Settings</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-2 pb-12">
          
          <Section title="Account" icon={User}>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                Active
              </div>
            </div>
            <div className="p-2">
              <button 
                onClick={signOut}
                className="w-full flex items-center justify-between p-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition font-medium"
              >
                <span>Sign Out</span>
                <LogOut size={18} />
              </button>
            </div>
          </Section>

          <Section title="Appearance" icon={Sun}>
            <div className="p-4 flex gap-2">
              {[
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Monitor }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setAppearance(opt.id)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border ${appearance === opt.id ? 'border-primary bg-primary/5 text-primary dark:bg-primary dark:text-primary-foreground dark:border-primary' : 'border-border bg-surface-2 text-muted-foreground dark:text-foreground hover:bg-surface-1 transition'}`}
                >
                  <opt.icon size={20} />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Personality" icon={Sparkles}>
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">Choose how your Personal Agent responds to you.</p>
              <select 
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="w-full bg-surface-2 border border-border text-foreground text-sm rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary/20 appearance-none relative cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231A050A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '.65rem auto' }}
              >
                <option value="best_friend">Best Friend</option>
                <option value="calm_friend">Calm Friend</option>
                <option value="funny_friend">Funny Friend</option>
                <option value="study_buddy">Study Buddy</option>
                <option value="listener">Listener</option>
                <option value="tough_friend">Tough Friend</option>
              </select>
            </div>
          </Section>

          <Section title="Language" icon={Globe}>
            <div className="p-4">
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-surface-2 border border-border text-foreground text-sm rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary/20 appearance-none relative cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231A050A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '.65rem auto' }}
              >
                <option value="auto">Auto Detect</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
                <option value="kn">Kannada</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="mr">Marathi</option>
                <option value="bn">Bengali</option>
              </select>
            </div>
          </Section>

          <Section title="Memory" icon={Database}>
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">Memory enabled</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">Allow your Personal Agent to remember useful information from your conversations.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={memoryEnabled} onChange={(e) => setMemoryEnabled(e.target.checked)} />
                <div className="w-11 h-6 bg-surface-2 border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white"></div>
              </label>
            </div>
            <div className="p-2">
              <button 
                onClick={onOpenMemory}
                className="w-full flex items-center justify-between p-3 text-foreground hover:bg-surface-2 rounded-xl transition font-medium"
              >
                <span>Manage memories</span>
                <ArrowLeft size={18} className="rotate-180" />
              </button>
            </div>
          </Section>

          <Section title="Privacy" icon={Shield}>
            <div className="p-2">
              <button 
                onClick={onOpenMemory}
                className="w-full flex items-center justify-between p-3 text-foreground hover:bg-surface-2 rounded-xl transition font-medium"
              >
                <span>Manage Memories</span>
              </button>
            </div>
            <div className="p-2 border-t border-border">
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-between p-3 text-red-600 hover:bg-red-50 rounded-xl transition font-medium"
              >
                <span>Clear Conversations</span>
                <Trash2 size={18} />
              </button>
            </div>
          </Section>

        </div>
      </div>

      {/* Clear Conversations Confirm */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-[24px] shadow-xl border border-border w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 mb-2">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Clear Conversations?</h3>
              <p className="text-muted-foreground">This will permanently remove all your conversation history. This action cannot be undone.</p>
              <div className="flex gap-3 justify-center pt-4">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="px-6 py-2.5 font-medium text-muted-foreground hover:bg-surface-2 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearConversations}
                  className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition shadow-sm"
                >
                  Clear history
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
