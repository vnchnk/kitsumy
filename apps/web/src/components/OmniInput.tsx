import { useState } from 'react';
import { useSession } from '../store/useSession';
import { AppMode } from '@kitsumy/types';
import { Mic, BookOpen, Moon, Dna } from 'lucide-react';

interface Props {
    onGenerate: (prompt: string) => void;
}

export const OmniInput = ({ onGenerate }: Props) => {
  const { mode, setMode } = useSession();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input) return;
    setLoading(true);
    await onGenerate(input);
    setLoading(false);
  };

  const getBgColor = () => {
      switch(mode) {
          case AppMode.THERAPY: return 'bg-slate-900 border-indigo-900';
          case AppMode.CREATIVE: return 'bg-purple-900 border-purple-800';
          default: return 'bg-white border-white';
      }
  }

  return (
    <div className={`p-6 transition-colors duration-500 rounded-3xl shadow-2xl border-4 ${getBgColor()}`}>
      
      {/* Mode Switcher */}
      <div className="flex gap-4 mb-6 justify-center">
        <button onClick={() => setMode(AppMode.LEARNING)} className={`p-3 rounded-xl transition-all ${mode === AppMode.LEARNING ? 'bg-blue-100 text-blue-600 scale-110 shadow-lg' : 'text-gray-400 hover:bg-white/10'}`}>
          <BookOpen size={24} />
        </button>
        <button onClick={() => setMode(AppMode.CREATIVE)} className={`p-3 rounded-xl transition-all ${mode === AppMode.CREATIVE ? 'bg-purple-100 text-purple-600 scale-110 shadow-lg' : 'text-gray-400 hover:bg-white/10'}`}>
            <Dna size={24} />
        </button>
        <button onClick={() => setMode(AppMode.THERAPY)} className={`p-3 rounded-xl transition-all ${mode === AppMode.THERAPY ? 'bg-indigo-100 text-indigo-400 scale-110 shadow-lg' : 'text-gray-400 hover:bg-white/10'}`}>
          <Moon size={24} />
        </button>
      </div>

      {/* Input Area */}
      <div className="relative">
        {mode === AppMode.THERAPY ? (
          <button 
            onClick={handleSubmit}
            className="w-full h-20 rounded-2xl bg-indigo-900/40 border-2 border-dashed border-indigo-500/30 text-indigo-300 flex items-center justify-center hover:bg-indigo-900/60 transition-all group"
          >
            <Mic className="mr-3 group-hover:scale-110 transition-transform" /> 
            {loading ? "Listening..." : "Tell me what's on your mind..."}
          </button>
        ) : (
            <div className="flex gap-3">
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={mode === AppMode.CREATIVE ? "Harry Potter with lasers..." : "Topic: WWII, Math, etc."}
                    className="flex-1 p-4 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none text-black bg-gray-50 font-medium text-lg shadow-inner"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-8 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 font-bold"
                >
                    {loading ? '...' : 'Go'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
