import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { EditorPage } from './editor/EditorPage';
import { PreviewPage } from './editor/PreviewPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/project/:id/edit" element={<EditorPage />} />
        <Route path="/project/:id/preview" element={<PreviewPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
