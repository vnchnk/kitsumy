import { motion } from 'framer-motion';

export const ComicReader = ({ comic }: { comic: any }) => {
  if (!comic) return null;

  const getRandomClip = () => {
    const v = [
        `0% ${Math.random() * 2}%`,
        `${98 + Math.random() * 2}% ${Math.random() * 1}%`,
        `${98 + Math.random() * 2}% ${98 + Math.random() * 2}%`,
        `${Math.random() * 2}% ${98 + Math.random() * 2}%`
    ];
    return `polygon(${v[0]}, ${v[1]}, ${v[2]}, ${v[3]})`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-12 pb-48 px-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&display=swap');
      `}</style>
      
      <div className="relative py-12 mb-24 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="inline-block relative"
        >
            <div className="absolute inset-0 bg-[#FF3333] transform skew-x-[-6deg] rotate-[-2deg] scale-[1.05] border-[4px] border-black shadow-[8px_8px_0_rgba(0,0,0,1)] z-0"></div>
            
            <h1 
              className="relative z-10 font-['Bangers'] text-5xl md:text-8xl text-[#FFD700] uppercase tracking-widest px-6 py-2"
              style={{
                 textShadow: '4px 4px 0px #000000',
                 WebkitTextStroke: '2px black',
                 lineHeight: 1.1
              }}
            >
              {comic.title}
            </h1>
        </motion.div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-6 gap-8 bg-transparent">
        {comic.panels.map((panel: any, idx: number) => {
          let colSpan = 'md:col-span-2';
          // Increased height for more breathing room
          let heightClass = 'h-[550px]'; 
          
          if (idx === 0) { colSpan = 'md:col-span-6'; heightClass = 'h-[650px]'; } 
          else if (idx % 5 === 1 || idx % 5 === 2) { colSpan = 'md:col-span-3'; heightClass = 'h-[550px]'; } 
          else if (idx % 5 === 3) { colSpan = 'md:col-span-4'; heightClass = 'h-[600px]'; } 
          else if (idx % 5 === 4) { colSpan = 'md:col-span-2'; heightClass = 'h-[600px]'; } 
          else { colSpan = 'md:col-span-3'; }

          const sepiaLevel = 0.1 + Math.random() * 0.2; // Less sepia for clarity
          const noiseOpacity = 0.2 + Math.random() * 0.2; 

          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95, rotate: (Math.random() - 0.5) * 2 }}
              animate={{ opacity: 1, scale: 1, rotate: (idx % 2 === 0 ? -0.5 : 0.5) }} // Subtle rotation
              transition={{ delay: idx * 0.1 }}
              className={`relative bg-white border-[4px] border-black overflow-hidden group shadow-xl ${colSpan} ${heightClass}`}
              style={{ clipPath: getRandomClip() }}
            >
              {/* Image Layer */}
              <div className="absolute inset-0 bg-gray-800">
                <img 
                  src={panel.imageUrl} 
                  alt="Panel" 
                  className="w-full h-full object-cover transition-all duration-1000 ease-out group-hover:scale-105"
                  style={{ 
                    filter: `sepia(${sepiaLevel}) contrast(1.15) brightness(0.95) saturate(0.85)` 
                  }}
                />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/comic-dots.png')] opacity-15 pointer-events-none mix-blend-multiply"></div>
                <div 
                    className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dust.png')] pointer-events-none mix-blend-screen"
                    style={{ opacity: noiseOpacity }}
                ></div>
                <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.5)] pointer-events-none mix-blend-multiply"></div>
              </div>

              {/* Narrative Caption - Smaller, tighter */}
              {panel.narrative && (
                <div className="absolute top-4 left-4 max-w-[80%] bg-[#fff133] px-3 py-2 border-[3px] border-black font-['Comic_Neue'] font-bold text-sm md:text-base leading-tight shadow-[3px_3px_0_rgba(0,0,0,1)] transform -rotate-1 z-10">
                  {panel.narrative}
                </div>
              )}

              {/* Bubbles - Smaller font, constrained width */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end pointer-events-none">
                 {panel.dialogue.map((d: any, i: number) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', delay: 0.5 + (i * 0.2) }}
                      className={`
                        pointer-events-auto relative p-2 px-4 mb-2 border-[3px] border-black font-['Comic_Neue'] text-sm md:text-base font-bold text-black w-fit max-w-[60%] shadow-[3px_3px_0_0_rgba(0,0,0,1)]
                        ${i % 2 === 0 
                           ? 'self-start bg-white rounded-[15px_15px_15px_0] mr-auto rotate-[-1deg]' 
                           : 'self-end bg-[#E0F7FA] rounded-[15px_15px_0_15px] ml-auto rotate-[1deg]'
                        }
                      `}
                    >
                      <span className="block text-[9px] text-gray-500 font-sans font-black uppercase mb-0.5">{d.speaker}</span>
                      {d.text}
                    </motion.div>
                 ))}
              </div>

              {panel.chapterTitle && idx % 3 === 0 && (
                  <div className="absolute top-0 right-0 bg-black text-white px-3 py-1 font-sans text-[10px] uppercase font-bold tracking-widest z-20 border-l-2 border-b-2 border-white">
                      {panel.chapterTitle}
                  </div>
              )}

              <div className="absolute bottom-2 right-2 w-7 h-7 bg-white border-[3px] border-black rounded-full flex items-center justify-center font-['Bangers'] text-sm z-20">
                {idx + 1}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
