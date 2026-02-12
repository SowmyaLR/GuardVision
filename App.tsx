import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Detection, AppState } from './types';
import { analyzeImageForPII } from './services/gemini';
import Logo from './Logo';
import {
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
  const [redactionOpacity, setRedactionOpacity] = useState(1);
  const [showOriginal, setShowOriginal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [scanMessageIndex, setScanMessageIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* scanning text animation */
  useEffect(() => {
    let interval: number;

    if (state.isAnalyzing) {
      interval = window.setInterval(() => {
        setScanMessageIndex(prev => (prev + 1) % SCAN_MESSAGES.length);
      }, 1500);
    }

    return () => clearInterval(interval);
  }, [state.isAnalyzing]);

  /* ---------- image optimization ---------- */

  const optimizeImage = (base64: string): Promise<string> => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {

        const MAX = 1024;
        let { width, height } = img;

        if (width > height && width > MAX) {
          height *= MAX / width;
          width = MAX;
        } else if (height > MAX) {
          width *= MAX / height;
          height = MAX;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.9));
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

    setState(prev => ({ ...prev, isAnalyzing: true }));

    try {
      const optimized = await optimizeImage(state.image);
      const results = await analyzeImageForPII(optimized);

      setState(prev => ({
        ...prev,
        detections: results,
        isAnalyzing: false
      }));

      const unique = Array.from(new Set(results.map(r => r.label)));

      setExpandedCategories(
        unique.reduce((acc, label) => ({ ...acc, [label]: true }), {})
      );

    } catch {
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: "Privacy scan failed. Check API limits."
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => handleSetImage(ev.target?.result as string, file.name);
    reader.readAsDataURL(file);
  };

  const toggleCategory = (label: string, shouldSelect: boolean) => {
    setState(prev => ({
      ...prev,
      detections: prev.detections.map(d =>
        d.label === label ? { ...d, selected: shouldSelect } : d
      )
    }));
  };

  const toggleDetection = (id: string) => {
    setState(prev => ({
      ...prev,
      detections: prev.detections.map(d =>
        d.id === id ? { ...d, selected: !d.selected } : d
      )
    }));
  };

  const removeImage = () => {
    setState({
      image: null,
      fileName: null,
      isAnalyzing: false,
      detections: [],
      error: null
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    setExpandedCategories({});
  };

  /* ---------- download ---------- */

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

        ctx.fillStyle = redactionColor;
        ctx.globalAlpha = redactionOpacity;

        ctx.fillRect(
          (xmin / 1000) * img.width,
          (ymin / 1000) * img.height,
          ((xmax - xmin) / 1000) * img.width,
          ((ymax - ymin) / 1000) * img.height
        );
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

    <div className="
      min-h-screen
      text-slate-200
      bg-gradient-to-br
      from-[#020617]
      via-[#020617]
      to-[#0f172a]
      bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,.04)_1px,transparent_0)]
      bg-[size:40px_40px]
    ">

      {/* HEADER */}

      <header className="
        sticky top-0 z-50
        border-b border-white/10
        bg-white/5
        backdrop-blur-2xl
      ">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-6">

          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />

            <span className="font-semibold tracking-tight text-white">
              GuardVision
            </span>

            <div className="
              hidden sm:flex
              items-center gap-1
              px-2 py-1
              rounded-full
              bg-emerald-400/10
              text-emerald-400
              text-xs
            ">
              <Zap className="w-3 h-3"/>
              Fast Scan
            </div>
          </div>

          {state.image && state.detections.length > 0 && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="
                flex items-center gap-2
                px-4 py-2
                rounded-xl
                bg-white/5
                hover:bg-white/10
                transition
              "
            >
              {showOriginal ? <Eye/> : <EyeOff/>}
              {showOriginal ? "Apply Shields" : "Reveal"}
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

        </div>
      </header>

      {/* MAIN */}

      <main className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8 p-8">

        {/* IMAGE AREA */}

        <div className="lg:col-span-8">

          {!state.image ? (

            <div
              onClick={() => fileInputRef.current?.click()}
              className="
                group
                h-[520px]
                rounded-[32px]
                border border-white/30
                flex flex-col items-center justify-center
                cursor-pointer
                bg-gradient-to-b from-white/5 to-transparent
                hover:shadow-[0_0_80px_rgba(99,102,241,.25)]
                transition
              "
            >
              <Logo className="w-16 h-16 mb-4 group-hover:scale-110 transition"/>

              <p className="text-lg font-bold">
                Secure Workspace
              </p>

              <span className="text-sm text-slate-400">
                Click to upload image
              </span>

            </div>

          ) : (

            <div className="
              relative
              rounded-[32px]
              border border-white/10
              p-6
              bg-gradient-to-b from-slate-900/60 to-slate-900/20
              shadow-[0_20px_80px_rgba(0,0,0,.6)]
            ">

              <div className="relative inline-block">

                <img
                  src={state.image}
                  className="rounded-xl border border-white/10"
                />

                {/* REDACTION */}

                {!showOriginal && state.detections.map(d => {

                  if (!d.selected) return null;

                  const [ymin, xmin, ymax, xmax] = d.box_2d;

                  return (
                    <div
                      key={d.id}
                      className="absolute"
                      style={{
                        top: `${ymin / 10}%`,
                        left: `${xmin / 10}%`,
                        width: `${(xmax - xmin) / 10}%`,
                        height: `${(ymax - ymin) / 10}%`,
                        background:
                          `repeating-linear-gradient(
                            45deg,
                            ${getRGBA(redactionColor, redactionOpacity)},
                            ${getRGBA(redactionColor, redactionOpacity)} 10px,
                            rgba(0,0,0,.9) 10px,
                            rgba(0,0,0,.9) 20px
                          )`,
                        backdropFilter: "blur(6px)"
                      }}
                    />
                  );
                })}

                {/* SCAN OVERLAY */}

                {state.isAnalyzing && (
                  <div className="
                    absolute inset-0
                    flex flex-col items-center justify-center
                    bg-black/80
                    backdrop-blur-xl
                    rounded-xl
                  ">
                    <RefreshCcw className="animate-spin mb-4"/>

                    <p className="text-indigo-400 font-medium">
                      {SCAN_MESSAGES[scanMessageIndex]}
                    </p>
                  </div>
                )}

              </div>

            </div>

          )}

          {state.error && (
            <div className="mt-4 flex items-center gap-2 text-red-400">
              <AlertCircle/>
              {state.error}
            </div>
          )}

        </div>

        {/* SIDEBAR */}

        <div className="lg:col-span-4">

          <div className="
            h-full
            rounded-[32px]
            border border-white/10
            p-6
            bg-gradient-to-b from-slate-900 to-black
            shadow-[0_10px_60px_rgba(0,0,0,.7)]
          ">

            {/* controls */}

            <p className="text-sm mb-3 text-slate-400">
              Mask Settings
            </p>

            <div className="flex gap-2 mb-4">
              {['#000000','#ef4444','#6366f1','#10b981','#ffffff'].map(c => (
                <button
                  key={c}
                  onClick={() => setRedactionColor(c)}
                  style={{ background:c }}
                  className={`
                    w-8 h-8 rounded-lg
                    transition
                    ${redactionColor === c ? 'scale-110 ring-2 ring-indigo-500' : ''}
                  `}
                />
              ))}
            </div>

            <input
              type="range"
              min="0.2"
              max="1"
              step="0.1"
              value={redactionOpacity}
              onChange={e => setRedactionOpacity(parseFloat(e.target.value))}
              className="w-full mb-6"
            />

            {/* SCAN */}

            {state.image && !state.isAnalyzing && (
              <button
                onClick={handleStartScan}
                className="
                  w-full py-3 rounded-xl
                  bg-indigo-600
                  hover:bg-indigo-500
                  shadow-[0_10px_40px_rgba(99,102,241,.5)]
                  transition
                  mb-4
                "
              >
                <ScanSearch className="inline mr-2"/>
                Run Privacy Scan
              </button>
            )}

            {state.detections.length > 0 && (
              <button
                onClick={downloadRedacted}
                className="
                  w-full py-3 rounded-xl
                  bg-emerald-600
                  hover:bg-emerald-500
                  shadow-[0_10px_40px_rgba(16,185,129,.4)]
                  mb-4
                "
              >
                <Download className="inline mr-2"/>
                Download Image
              </button>
            )}

            {state.image && (
              <button
                onClick={removeImage}
                className="w-full py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"
              >
                <Trash2 className="inline mr-2"/>
                Clear
              </button>
            )}

          </div>
        </div>

      </main>
    </div>
  );
};

export default App;
