import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useEditorStore } from './store';
import { EditorToolbar } from './components/EditorToolbar';
import { EditorCanvas } from './components/EditorCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { PagesSidebar } from './components/PagesSidebar';

export const EditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const { initProject, project } = useEditorStore();

  useEffect(() => {
    if (id) {
      initProject(id);
    }
  }, [id, initProject]);

  if (!project) {
    return (
      <div className="h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0d0d] flex flex-col overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&display=swap');
      `}</style>
      
      <EditorToolbar />
      
      <div className="flex-1 flex overflow-hidden">
        <PagesSidebar />
        <EditorCanvas />
        <PropertiesPanel />
      </div>
    </div>
  );
};
