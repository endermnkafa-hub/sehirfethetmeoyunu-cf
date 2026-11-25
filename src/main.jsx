import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class MaintenanceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Uygulama yükleme/bakım durumu:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-950 text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl">
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black mb-3">
              BAKIM & GÜNCELLEME
            </div>
            <h1 className="text-lg font-black text-white mb-2">
              Şu Anda Güncelleniyor / Bakım Yapılıyor
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Yeni bir güncelleme etkinleştiriliyor. Devam etmek için sayfayı yenileyin.
            </p>
            <button
              onClick={() => window.location.replace(window.location.pathname + '?v=' + Date.now())}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
            >
              Şimdi Yeniden Bağlan
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

window.__SF_APP_MOUNTED__ = true;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MaintenanceErrorBoundary>
      <App />
    </MaintenanceErrorBoundary>
  </StrictMode>,
)
