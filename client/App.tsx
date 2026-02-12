import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Detection, AppState } from './types';
import { analyzeImageForPII } from './services/gemini';
import Logo from './Logo';
import { 
  ShieldCheck, 
  Trash2, 
  Download, 
  AlertCircle, 
  Palette, 
  Filter, 
  CheckSquare, 
  Square, 
  RefreshCcw,
  Eye,
  EyeOff,
  ScanSearch,
  Lock,
  ChevronDown,
  ChevronRight,
  Zap,
  Info
} from 'lucide-react';

const SCAN_MESSAGES = [
  "Identifying biometric signatures...",
  "Scanning for financial identifiers...",
  "Locating contact information...",
  "Parsing sensitive text blocks...",
  "Auditing document internal fields...",
  "Detecting QR and data barcodes...",
  "Analyzing spatial privacy risks...",
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    image: null,
    fileName: null,
    isAnalyzing: false,
    detections: [],
    error: null,
  });
  
  const [redactionColor, setRedactionColor] = useState('#000000');
  const [redactionOpacity, setRedactionOpacity] = useState(1.0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cycle messages during scan
  useEffect(() => {
    let interval: number;
    if (state.isAnalyzing) {
      interval = window.setInterval(() => {
        setScanMessageIndex((prev) => (prev + 1) % SCAN_MESSAGES.length);
      }, 1500);
    } else {
      setScanMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [state.isAnalyzing]);

  const optimizeImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = base64;
    });
  };

  const handleSetImage = (base64: string, name: string) => {
    setState({
      image: base64,
      fileName: name,
      isAnalyzing: false,
      detections: [],
      error: null,
    });
    setShowOriginal(false);
  };

  const handleStartScan = async () => {
    if (!state.image) return;
    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
    
    try {
      const optimizedImage = await optimizeImage(state.image);
      const results = await analyzeImageForPII(optimizedImage);
      
      setState(prev => ({ 
        ...prev, 
        detections: results, 
        isAnalyzing: false 
      }));
      
      const uniqueLabels = Array.from(new Set(results.map(r => r.label)));
      setExpandedCategories(uniqueLabels.reduce((acc, label) => ({ ...acc, [label]: true }), {}));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isAnalyzing: false, 
        error: "Privacy scan failed. Check network or API limits." 
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleSetImage(base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const toggleCategory = (label: string, shouldSelect: boolean) => {
    setState(prev => ({
      ...prev,
      detections: prev.detections.map(d => d.label === label ? { ...d, selected: shouldSelect } : d)
    }));
  };

  const toggleDetection = (id: string) => {
    setState(prev => ({
      ...prev,
      detections: prev.detections.map(d => d.id === id ? { ...d, selected: !d.selected } : d)
    }));
  };

  const removeImage = () => {
    setState({ image: null, fileName: null, isAnalyzing: false, detections: [], error: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setExpandedCategories({});
  };

  const downloadRedacted = useCallback(() => {
    if (!state.image) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      state.detections.filter(d => d.selected).forEach(d => {
        const [ymin, xmin, ymax, xmax] = d.box_2d;
        ctx.save();
        ctx.globalAlpha = redactionOpacity;
        ctx.fillStyle = redactionColor;
        ctx.fillRect(
          (xmin / 1000) * img.width, 
          (ymin / 1000) * img.height, 
          ((xmax - xmin) / 1000) * img.width, 
          ((ymax - ymin) / 1000) * img.height
        );
        ctx.restore();
      });
      const link = document.createElement('a');
      link.download = `redacted-${state.fileName}`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = state.image;
  }, [state, redactionColor, redactionOpacity]);

  const getRGBA = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16), 
          g = parseInt(hex.slice(3, 5), 16), 
          b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const groupedDetections = useMemo(() => {
    const groups: Record<string, Detection[]> = {};
    state.detections.forEach(d => {
      if (!groups[d.label]) groups[d.label] = [];
      groups[d.label].push(d);
    });
    return Object.keys(groups).sort().map(label => ({
      label,
      items: groups[label],
      selectedCount: groups[label].filter(i => i.selected).length,
      allSelected: groups[label].every(i => i.selected)
    }));
  }, [state.detections]);

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-200 bg-[#0f172a]">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-50 shadow-lg h-16 shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />
            <h1 className="text-lg font-black tracking-tighter uppercase text-white">GuardVision</h1>
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <Zap className="w-3 h-3 text-emerald-500" />
              <span className="text-[8px] font-black uppercase text-emerald-500">Fast Scan Mode</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {state.image && !state.isAnalyzing && state.detections.length > 0 && (
              <button 
                onClick={() => setShowOriginal(!showOriginal)} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${showOriginal ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
              >
                {showOriginal ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {showOriginal ? 'Apply Shields' : 'Reveal Sensitive Areas'}
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto lg:overflow-hidden">
        {/* Workspace Area */}
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
          {!state.image ? (
            <div 
              onClick={() => fileInputRef.current?.click()} 
              className="group border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/40 rounded-[2.5rem] flex-1 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 bg-slate-900/20 min-h-[400px]"
            >
              <div className="p-10 rounded-full bg-slate-800/50 mb-6 group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all duration-500">
                <Logo className="w-16 h-16" />
              </div>
              <p className="text-xl font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-white">Secure Workspace</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-600 mt-3 font-bold group-hover:text-indigo-400">Click to Upload Image for Protection</p>
            </div>
          ) : (
            <div className="relative bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden flex items-center justify-center p-6 flex-1 shadow-2xl min-h-[300px] lg:min-h-0">
              <div className="relative inline-block overflow-hidden rounded-2xl">
                <img 
                  src={state.image} 
                  alt="Workspace" 
                  className="max-w-full max-h-[70vh] block border border-slate-700 pointer-events-none" 
                />
                
                {/* Overlay Bounding Boxes */}
                {!showOriginal && state.detections.map(d => {
                  const [ymin, xmin, ymax, xmax] = d.box_2d;
                  if (!d.selected) return null;
                  return (
                    <div 
                      key={d.id} 
                      className="absolute z-10 border pointer-events-none" 
                      style={{ 
                        top: `${ymin / 10}%`, 
                        left: `${xmin / 10}%`, 
                        width: `${(xmax - xmin) / 10}%`, 
                        height: `${(ymax - ymin) / 10}%`, 
                        backgroundColor: getRGBA(redactionColor, redactionOpacity), 
                        borderColor: redactionColor 
                      }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white/10 uppercase tracking-tighter overflow-hidden select-none">CONFIDENTIAL</span>
                    </div>
                  );
                })}

                {/* Analysis State */}
                {state.isAnalyzing && (
                  <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md flex flex-col items-center justify-center z-50">
                    <Logo className="w-24 h-24 mb-8" isAnalyzing={true} />
                    <div className="flex flex-col items-center gap-4 text-center px-10">
                      <p className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-400 animate-pulse">
                        {SCAN_MESSAGES[scanMessageIndex]}
                      </p>
                      <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/50 animate-[loading_2s_infinite]" />
                      </div>
                      <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Privacy Audit in Progress</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {state.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" /> 
              <span>{state.error}</span>
            </div>
          )}
        </div>

        {/* Control Sidebar - Fixed height context on all devices for list scrollability */}
        <div className="lg:col-span-4 h-[600px] lg:h-[calc(100vh-12rem)] flex flex-col min-h-0">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col h-full shadow-2xl overflow-hidden">
            
            {/* Style Header */}
            <div className="p-6 pb-2 shrink-0">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-500" /> Masking Parameters
              </h2>
              <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {['#000000', '#FFFFFF', '#ef4444', '#10b981', '#6366f1'].map(c => (
                    <button 
                      key={c} 
                      onClick={() => setRedactionColor(c)} 
                      className={`w-8 h-8 rounded-lg border-2 transition-all transform ${redactionColor === c ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`} 
                      style={{ backgroundColor: c }} 
                    />
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                    <span>Density</span>
                    <span className="text-indigo-400">{Math.round(redactionOpacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="1" step="0.1" 
                    value={redactionOpacity} 
                    onChange={e => setRedactionOpacity(parseFloat(e.target.value))} 
                    className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer" 
                  />
                </div>
              </div>
            </div>

            {/* Scrollable Detection List */}
            <div className="flex-1 overflow-hidden flex flex-col px-6">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 py-4 border-b border-slate-800 shrink-0">
                <Filter className="w-4 h-4 text-indigo-500" /> Sensitive Objects Detected
              </h2>
              {/* This container will now scroll on all devices because its parent (sidebar) has a defined height */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-6 min-h-0">
                {state.detections.length > 0 ? (
                  groupedDetections.map(cat => (
                    <div key={cat.label} className="bg-slate-800/20 rounded-xl overflow-hidden border border-slate-800/50">
                      <button 
                        onClick={() => setExpandedCategories(prev => ({...prev, [cat.label]: !prev[cat.label]}))}
                        className="w-full flex items-center justify-between p-3 text-[10px] font-black uppercase tracking-wider hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expandedCategories[cat.label] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <span className={cat.selectedCount > 0 ? "text-indigo-400" : "text-slate-500"}>{cat.label}s</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-[8px] text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{cat.selectedCount}/{cat.items.length}</span>
                           <div 
                             onClick={(e) => { e.stopPropagation(); toggleCategory(cat.label, !cat.allSelected); }}
                             className={`p-1 rounded transition-colors ${cat.allSelected ? 'text-indigo-500' : 'text-slate-700 hover:text-slate-500'}`}
                           >
                             {cat.allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                           </div>
                        </div>
                      </button>
                      
                      {expandedCategories[cat.label] && (
                        <div className="px-3 pb-3 space-y-2 border-t border-slate-800/50 pt-2">
                          {cat.items.map((item, idx) => (
                            <button 
                              key={item.id}
                              onClick={() => toggleDetection(item.id)}
                              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-[9px] font-bold transition-all ${item.selected ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300' : 'bg-slate-900/40 border border-transparent text-slate-600 hover:border-slate-700'}`}
                            >
                              <span className="truncate max-w-[150px]">#{idx + 1} Identifed {cat.label}</span>
                              {item.selected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : state.isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-[10px] uppercase tracking-widest gap-4 py-12">
                    <RefreshCcw className="w-8 h-8 animate-spin text-indigo-500" />
                    Initializing Neuro-Audit...
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-[9px] font-black uppercase tracking-[0.3em] text-center border-2 border-dashed border-slate-800 rounded-3xl m-2 py-12">
                    <Info className="w-8 h-8 mb-4" />
                    Scan image to see findings
                  </div>
                )}
              </div>
            </div>

            {/* Action Command Center */}
            <div className="p-6 pt-2 border-t border-slate-800 bg-slate-900 shrink-0 space-y-3">
              {state.image && !state.isAnalyzing && (
                <button 
                  onClick={handleStartScan} 
                  className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${state.detections.length > 0 ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30'}`}
                >
                  <ScanSearch className="w-4 h-4" /> 
                  {state.detections.length > 0 ? 'Run New Privacy Scan' : 'Run Privacy Scan'}
                </button>
              )}

              {state.detections.length > 0 && (
                <button 
                  onClick={downloadRedacted} 
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95"
                >
                  <Download className="w-4 h-4" /> Download Protected Image
                </button>
              )}
              
              {state.image && (
                <button 
                  onClick={removeImage} 
                  className="w-full py-2.5 border border-slate-800 hover:border-red-500/30 hover:bg-red-500/5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-red-400 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Data
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
        
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default App;
