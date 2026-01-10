
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Detection, AppState } from './types';
import { analyzeImageForPII } from './services/gemini';
import { ShieldCheck, Upload, Trash2, Download, AlertCircle, Eye, EyeOff, ScanLine, Palette, Info, Filter, CheckSquare, Square, RefreshCcw } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group detections by category for simplified UI
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    const selectedCounts: Record<string, number> = {};
    
    state.detections.forEach(d => {
      counts[d.label] = (counts[d.label] || 0) + 1;
      if (d.selected) {
        selectedCounts[d.label] = (selectedCounts[d.label] || 0) + 1;
      }
    });

    return Object.keys(counts).sort().map(label => ({
      label,
      count: counts[label],
      selectedCount: selectedCounts[label] || 0,
      allSelected: (selectedCounts[label] || 0) === counts[label]
    }));
  }, [state.detections]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setState({
        image: event.target?.result as string,
        fileName: file.name,
        isAnalyzing: false,
        detections: [],
        error: null,
      });
      setShowOriginal(false);
    };
    reader.onerror = () => {
      setState(prev => ({ ...prev, error: "Failed to read image file." }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!state.image) return;

    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
    try {
      const results = await analyzeImageForPII(state.image);
      setState(prev => ({ 
        ...prev, 
        detections: results, 
        isAnalyzing: false 
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isAnalyzing: false, 
        error: "Unable to process image. Please try a different file or check your internet connection." 
      }));
    }
  };

  const toggleCategory = (label: string, shouldSelect: boolean) => {
    setState(prev => ({
      ...prev,
      detections: prev.detections.map(d => d.label === label ? { ...d, selected: shouldSelect } : d)
    }));
  };

  const removeImage = () => {
    setState({
      image: null,
      fileName: null,
      isAnalyzing: false,
      detections: [],
      error: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        const left = (xmin / 1000) * img.width;
        const top = (ymin / 1000) * img.height;
        const width = ((xmax - xmin) / 1000) * img.width;
        const height = ((ymax - ymin) / 1000) * img.height;

        ctx.save();
        ctx.globalAlpha = redactionOpacity;
        ctx.fillStyle = redactionColor;
        ctx.fillRect(left, top, width, height);
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
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-500/30 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              GuardVision <span className="text-xs font-semibold text-slate-500 ml-1 px-1.5 py-0.5 bg-slate-800 rounded-md">V1.4</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {state.image && !state.isAnalyzing && (
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                  showOriginal 
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' 
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 shadow-lg'
                }`}
              >
                {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showOriginal ? "Original" : "Masked"}
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!state.image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/40 rounded-[2.5rem] aspect-[16/9] flex flex-col items-center justify-center cursor-pointer transition-all duration-500"
            >
              <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl mb-4 group-hover:scale-105 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all duration-500 shadow-2xl">
                <Upload className="w-10 h-10 text-indigo-400" />
              </div>
              <p className="text-xl font-semibold text-slate-300">Upload your image</p>
              <p className="text-sm text-slate-500 mt-2">Private. Secure. Real-time scanning.</p>
            </div>
          ) : (
            <div className="relative bg-slate-900/50 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-[0_0_100px_rgba(0,0,0,0.4)] flex items-center justify-center p-6 min-h-[500px]">
              <div className="relative inline-flex">
                <img 
                  src={state.image} 
                  alt="Workspace" 
                  className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl block border border-slate-700/50"
                />
                
                {!showOriginal && state.detections.map(d => {
                  const [ymin, xmin, ymax, xmax] = d.box_2d;
                  const style = {
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                  };
                  return (
                    <div
                      key={d.id}
                      style={style}
                      className={`absolute transition-all duration-300 ${
                        d.selected ? 'z-20 opacity-100' : 'z-10 opacity-0 pointer-events-none'
                      }`}
                    >
                      <div 
                        className="absolute inset-0 flex items-center justify-center overflow-hidden border"
                        style={{ 
                          backgroundColor: getRGBA(redactionColor, redactionOpacity), 
                          borderColor: redactionColor 
                        }}
                      >
                        <span className="text-[7px] font-black text-white/40 uppercase tracking-[0.2em] whitespace-nowrap drop-shadow-sm">
                          MASKED
                        </span>
                      </div>
                    </div>
                  );
                })}

                {state.isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-50 rounded-2xl">
                    <div className="relative w-20 h-20 mb-8">
                      <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                      <RefreshCcw className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-spin-slow" />
                    </div>
                    <p className="text-2xl font-bold text-white tracking-tight">Securing your image</p>
                    <p className="text-slate-400 mt-2 text-sm max-w-xs text-center px-6 leading-relaxed font-medium">
                      Scanning for sensitive information...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {state.error && (
            <div className="flex items-center gap-4 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold">Analysis Failed</p>
                <p className="text-xs opacity-80 mt-0.5">{state.error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-7 flex flex-col gap-8 shadow-2xl sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
            
            {/* Appearance Section */}
            <div className="flex flex-col gap-5">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                Appearance
              </h2>
              <div className="space-y-5 bg-slate-800/30 p-5 rounded-3xl border border-slate-700/30">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mask Color</label>
                  <div className="flex flex-wrap gap-2">
                    {['#000000', '#FFFFFF', '#1e293b', '#ef4444', '#10b981'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setRedactionColor(color)}
                        className={`w-9 h-9 rounded-xl border-2 transition-all ${redactionColor === color ? 'border-indigo-500 scale-110 shadow-lg shadow-indigo-500/20' : 'border-transparent opacity-60'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-slate-600">
                      <input 
                        type="color" 
                        value={redactionColor}
                        onChange={(e) => setRedactionColor(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer bg-transparent border-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Opacity</label>
                    <span className="text-xs font-black text-indigo-400">{Math.round(redactionOpacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={redactionOpacity}
                    onChange={(e) => setRedactionOpacity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Redaction Controls */}
            <div className="flex flex-col gap-5">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400" />
                Fields to Redact
              </h2>
              
              {!state.image ? (
                <div className="py-12 flex flex-col items-center text-center opacity-30 grayscale">
                  <ScanLine className="w-12 h-12 text-slate-700 mb-4" />
                  <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Upload image to begin</p>
                </div>
              ) : state.detections.length === 0 && !state.isAnalyzing ? (
                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleAnalyze}
                    className="group w-full py-5 bg-indigo-600 hover:bg-indigo-500 rounded-3xl font-bold text-white transition-all transform active:scale-95 shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3"
                  >
                    <ScanLine className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="uppercase tracking-widest text-xs">Run Secure Scan</span>
                  </button>
                  <button
                    onClick={removeImage}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-3xl font-bold text-slate-400 transition-colors flex items-center justify-center gap-2 border border-slate-700/50 text-xs uppercase tracking-widest"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 gap-3">
                    {categories.length > 0 ? categories.map(cat => (
                      <button
                        key={cat.label}
                        onClick={() => toggleCategory(cat.label, !cat.allSelected)}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          cat.selectedCount > 0 
                          ? 'bg-emerald-500/10 border-emerald-500/30' 
                          : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80 shadow-inner'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {cat.allSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Square className={`w-5 h-5 ${cat.selectedCount > 0 ? 'text-emerald-500/50' : 'text-slate-600'}`} />
                          )}
                          <span className={`text-[13px] font-bold capitalize tracking-tight ${cat.selectedCount > 0 ? 'text-emerald-200' : 'text-slate-400'}`}>
                            {cat.label}s
                          </span>
                        </div>
                        <span className="text-[10px] font-black bg-slate-950 px-2 py-1 rounded-lg text-slate-500 border border-slate-800">
                          {cat.selectedCount}/{cat.count}
                        </span>
                      </button>
                    )) : state.isAnalyzing ? (
                      <div className="py-10 flex flex-col items-center gap-5">
                        <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse">Analyzing Frames...</p>
                      </div>
                    ) : (
                      <div className="p-10 text-center bg-slate-800/20 rounded-[2rem] border-2 border-dashed border-slate-800/50">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No sensitive data found</p>
                      </div>
                    )}
                  </div>

                  {state.detections.length > 0 && (
                    <div className="pt-8 border-t border-slate-800 flex flex-col gap-4">
                      <button
                        onClick={downloadRedacted}
                        className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 rounded-3xl font-bold text-white transition-all transform active:scale-95 shadow-xl shadow-emerald-600/40 flex items-center justify-center gap-3"
                      >
                        <Download className="w-6 h-6" />
                        <span className="uppercase tracking-[0.1em] text-sm">Download Protected Image</span>
                      </button>
                      <button
                        onClick={removeImage}
                        className="w-full py-4 bg-slate-800/40 hover:bg-slate-800 rounded-3xl font-bold text-slate-500 transition-all border border-slate-800/50 text-xs uppercase tracking-widest"
                      >
                        Discard Analysis
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-indigo-500/5 rounded-3xl p-5 border border-indigo-500/10 flex gap-4">
              <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-wider opacity-70">
                Data privacy notice: Scanning is performed securely. Selected fields will be permanently obscured in the output file.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-10 border-t border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-600 text-[10px] uppercase tracking-[0.3em] font-black">
          <p>© 2024 GuardVision Security Lab</p>
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500" /> End-to-End Privacy</span>
            <span className="flex items-center gap-2 text-indigo-400"><RefreshCcw className="w-4 h-4 animate-spin-slow" /> Flash Engine Active</span>
          </div>
        </div>
      </footer>

      <style>{`
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
        input[type="range"]::-webkit-slider-thumb {
          width: 16px;
          height: 16px;
          background: #6366f1;
          border: 3px solid #0f172a;
          border-radius: 50%;
          cursor: pointer;
          appearance: none;
          box-shadow: 0 0 15px rgba(99,102,241,0.4);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
