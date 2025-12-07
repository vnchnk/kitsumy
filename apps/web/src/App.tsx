import { useState } from 'react';
import { OmniInput } from './components/OmniInput';
import { ComicReader } from './components/ComicReader';
import { useSession } from './store/useSession';
import { AppMode } from '@kitsumy/types';

function App() {
  const { mode } = useSession();
  const [comicData, setComicData] = useState(null);

  const handleGenerate = async (prompt: string) => {
    try {
      const res = await fetch('http://localhost:3001/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt, userContext: {} })
      });
      const json = await res.json();
      if (json.success) {
        setComicData(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getContainerClass = () => {
    switch(mode) {
        case AppMode.THERAPY: return 'bg-slate-950 text-indigo-100';
        case AppMode.CREATIVE: return 'bg-purple-950 text-purple-100';
        default: return 'bg-gray-50 text-gray-900';
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-700 p-8 ${getContainerClass()}`}>
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <h1 className="text-5xl font-black mb-12 text-center tracking-tighter">
          KITSUMY
          <span className="block text-lg font-medium opacity-60 mt-2 font-sans">
            {mode === AppMode.LEARNING && "Education Mode"}
            {mode === AppMode.CREATIVE && "Creative Playground"}
            {mode === AppMode.THERAPY && "Night Journal"}
          </span>
        </h1>
        
        <div className="w-full max-w-2xl mb-12">
          <OmniInput onGenerate={handleGenerate} />
        </div>
        
        {comicData && <ComicReader comic={comicData} />}
      </div>
    </div>
  );
}

export default App;
