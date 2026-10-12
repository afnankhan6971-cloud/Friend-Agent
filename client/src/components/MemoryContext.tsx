import { useState, useEffect } from 'react';
import { Search, Trash2, Edit2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const MemoryContext = ({ session, onBack }: { session: any, onBack: () => void }) => {
  const [memories, setMemories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingMemory, setEditingMemory] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showForgetConfirm, setShowForgetConfirm] = useState<string | null>(null);

  const fetchMemories = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/memories', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      setMemories(data);
    } catch (e) {
      console.error('Failed to fetch memories', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleEdit = async () => {
    if (!editingMemory || !editContent.trim()) return;
    try {
      const res = await fetch(`http://localhost:3001/api/memories/${editingMemory.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memory: editContent })
      });
      if (res.ok) {
        setMemories(memories.map(m => m.id === editingMemory.id ? { ...m, memory: editContent, updated_at: new Date().toISOString() } : m));
        setEditingMemory(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleForget = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/memories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        setMemories(memories.filter(m => m.id !== id));
        setShowForgetConfirm(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/memories', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        setMemories([]);
        setShowClearConfirm(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredMemories = memories.filter(m => 
    m.memory.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <header className="h-16 border-b border-border flex items-center px-4 lg:px-8 bg-surface-1/90 backdrop-blur-md sticky top-0 shadow-sm gap-4">
        <button onClick={onBack} className="p-2 hover:bg-surface-2 rounded-lg text-muted-foreground transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-semibold text-lg text-heading tracking-tight">Memory Context</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2 mb-8">
            <h2 className="text-2xl font-bold text-heading">Your Memories</h2>
            <p className="text-muted-foreground">Things your Personal Agent remembers to make conversations more useful.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search memories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
            
            {memories.length > 0 && (
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="text-red-700/80 hover:text-red-800 text-sm font-medium w-full sm:w-auto text-right px-2 py-1"
              >
                Clear all memories
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading memories...</div>
          ) : filteredMemories.length === 0 ? (
            <div className="py-16 text-center space-y-4 bg-surface-1 border border-border rounded-2xl">
              <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                <Search size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No memories yet</h3>
                <p className="text-muted-foreground mt-1 max-w-md mx-auto">Important things you share can appear here when your Personal Agent remembers them.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredMemories.map(m => (
                <div key={m.id} className="bg-surface-1 border border-border p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <p className="text-foreground leading-relaxed">{m.memory}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.updated_at || m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <button 
                      onClick={() => { setEditingMemory(m); setEditContent(m.memory); }}
                      className="p-2 text-muted-foreground hover:text-primary dark:hover:text-foreground hover:bg-surface-2 rounded-lg transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setShowForgetConfirm(m.id)}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingMemory && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-[24px] shadow-xl border border-border w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-heading">Edit memory</h3>
              <textarea 
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full h-32 bg-surface-2 border border-border rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-3 justify-end pt-2">
                <button 
                  onClick={() => setEditingMemory(null)}
                  className="px-4 py-2 font-medium text-muted-foreground hover:bg-surface-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEdit}
                  className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition shadow-sm"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forget Confirm */}
      {showForgetConfirm && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-[24px] shadow-xl border border-border w-full max-w-sm overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-foreground">Forget memory?</h3>
              </div>
              <p className="text-muted-foreground">This will permanently remove this memory from your personal agent.</p>
              <div className="flex gap-3 justify-end pt-2">
                <button 
                  onClick={() => setShowForgetConfirm(null)}
                  className="px-4 py-2 font-medium text-muted-foreground hover:bg-surface-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleForget(showForgetConfirm)}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm"
                >
                  Forget
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirm */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-[24px] shadow-xl border border-border w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 mb-2">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Clear all memories?</h3>
              <p className="text-muted-foreground">This will permanently remove all saved memories associated with your account. This action cannot be undone.</p>
              <div className="flex gap-3 justify-center pt-4">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="px-6 py-2.5 font-medium text-muted-foreground hover:bg-surface-2 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearAll}
                  className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition shadow-sm"
                >
                  Clear memories
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
