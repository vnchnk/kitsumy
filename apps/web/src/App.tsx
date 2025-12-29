import { useState } from 'react';
import { OmniInput } from './components/OmniInput';
import { ComicReader } from './components/ComicReader';
import { useSession } from './store/useSession';
import { AppMode, ComicStyle, COMIC_STYLE_NAMES } from '@kitsumy/types';
import { API_BASE_URL } from './config';

const STYLES: ComicStyle[] = [
  'american-classic',
  'noir',
  'manga',
  'euro-bd',
  'watercolor',
  'retro',
  'cyberpunk',
  'whimsical',
  'horror',
  'minimalist',
  'ukiyo-e',
  'pop-art',
  'sketch',
  'cel-shaded',
  'pulp',
  'woodcut',
  'art-nouveau',
  'graffiti',
  'chibi',
  'soviet-poster'
];

function App() {
  const { mode } = useSession();
  const [comicData, setComicData] = useState(null);
  const [style, setStyle] = useState<ComicStyle>('american-classic');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async (prompt: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/comic/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: { visual: style, setting: 'realistic' },
          maxPages: 1
        })
      });
      const json = await res.json();
      if (json.success) {
        // Fetch the full plan by planId
        const planRes = await fetch(`${API_BASE_URL}/api/comic/plan/${json.planId}`);
        const planJson = await planRes.json();
        if (planJson.success) {
          setComicData(planJson.plan);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
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

        {/* Style Selector */}
        <div className="w-full max-w-2xl mb-6">
          <label className="block text-sm font-medium mb-2 opacity-70">Art Style</label>
          <div className="grid grid-cols-5 gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                disabled={isLoading}
                className={`px-3 py-2 text-xs rounded-lg transition-all ${
                  style === s
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-white/10 hover:bg-white/20 text-current'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {COMIC_STYLE_NAMES[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-2xl mb-12">
          <OmniInput onGenerate={handleGenerate} disabled={isLoading} />
          {isLoading && (
            <div className="mt-4 text-center text-sm opacity-70">
              Generating your comic with {COMIC_STYLE_NAMES[style]} style...
            </div>
          )}
        </div>

        {comicData && <ComicReader comic={comicData} />}
      </div>
    </div>
  );
}

export default App;
