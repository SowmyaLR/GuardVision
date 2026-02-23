import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Detection, AppState, ImageItem } from './types';
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
  Info,
  UploadCloud
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
    images: [],
    activeImageId: null,
  });
  
  const [redactionColor, setRedactionColor] = useState('#000000');
  const [redactionOpacity, setRedactionOpacity] = useState(1.0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Derive active image's analyzing state
  const activeImage = state.images.find(img => img.id === state.activeImageId);
  const isActiveImageAnalyzing = activeImage?.isAnalyzing ?? false;

  // Track and cleanup blob URLs
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  // Cleanup blob URLs when images are removed
  useEffect(() => {
    const currentUrls = new Set(state.images.map(img => img.src).filter(src => src.startsWith('blob:')));
    const urlsToRevoke = Array.from(blobUrlsRef.current).filter((url): url is string => !currentUrls.has(url));
    
    urlsToRevoke.forEach(url => {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    });
    
    currentUrls.forEach(url => blobUrlsRef.current.add(url));
  }, [state.images]);

  // Cycle messages during scan
  useEffect(() => {
    let interval: number;
    if (isActiveImageAnalyzing) {
      interval = window.setInterval(() => {
        setScanMessageIndex((prev) => (prev + 1) % SCAN_MESSAGES.length);
      }, 1500);
    } else {
      setScanMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isActiveImageAnalyzing]);

  const optimizeImage = (imageSource: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
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
          // Return the full data URL (gemini.ts will strip the prefix)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (err) {
          reject(new Error('Failed to optimize image'));
        }
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      img.src = imageSource;
    });
  };

  const handleStartScan = async () => {
    if (!state.activeImageId) return;
    const targetId = state.activeImageId;
    const targetImage = state.images.find(img => img.id === targetId);
    
    if (!targetImage) return;

    setState(prev => ({
      ...prev,
      images: prev.images.map(img =>
        img.id === targetId ? { ...img, isAnalyzing: true, error: null } : img
      ),
    }));
    
    try {
      // Create lightweight blob URL instead of converting to base64 string
      const blobUrl = URL.createObjectURL(targetImage.file);
      try {
        const optimizedImage = await optimizeImage(blobUrl);
        const results = await analyzeImageForPII(optimizedImage);
      
      setState(prev => {
        const images = prev.images.map(img =>
          img.id === targetId ? { ...img, isAnalyzing: false, detections: results } : img
        );
        const activeImage = images.find(img => img.id === prev.activeImageId);

        return {
          ...prev,
          detections: activeImage ? activeImage.detections : prev.detections,
          error: activeImage ? activeImage.error : prev.error,
          images,
        };
      });
      
        const uniqueLabels = Array.from(new Set(results.map(r => r.label)));
        setExpandedCategories(uniqueLabels.reduce((acc: Record<string, boolean>, label: string) => ({ ...acc, [label]: true }), {}));
      } finally {
        // Always clean up the blob URL to free memory
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err: any) {
      const errorMessage = err?.message ?? "Unknown error";
      console.error("Privacy scan failed:", errorMessage);
      const msg = String(err?.message ?? err?.error?.message ?? JSON.stringify(err ?? ""));
      let friendlyError = "Privacy scan failed. Check network or API limits.";
      if (msg.includes("Missing GEMINI_API_KEY")) {
        friendlyError = "GEMINI_API_KEY is missing. Check your .env file and restart `npm run dev`.";
      } else if (msg.includes("leaked") || msg.includes("Please use another API key")) {
        friendlyError = "Your API key was reported as leaked. Create a new key at aistudio.google.com/apikey and update GEMINI_API_KEY in .env";
      }

      setState(prev => ({
        ...prev,
        images: prev.images.map(img =>
          img.id === targetId ? { ...img, isAnalyzing: false, error: friendlyError } : img
        ),
        error: prev.activeImageId === targetId ? friendlyError : prev.error,
      }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if adding new files would exceed 10 total images
    const totalImages = state.images.length + files.length;
    if (totalImages > 10) {
      setState(prev => {
        const currentCount = prev.images.length;
        const remainingSlots = Math.max(10 - currentCount, 0);
        return {
          ...prev,
          error: `You can upload up to 10 images total. You have ${currentCount} images. Please select ${remainingSlots} or fewer images.`,
        };
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter((file): file is File => file instanceof File && file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setState(prev => ({
        ...prev,
        error: "Only image files are supported. Please select valid image formats.",
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (imageFiles.length !== allFiles.length) {
      setState(prev => ({
        ...prev,
        error: "Some files were skipped because they are not supported image formats.",
      }));
    }

    const filePromises = imageFiles.map(
      (file) =>
        new Promise<{ file: File; src: string }>((resolve, reject) => {
          try {
            const blobUrl = URL.createObjectURL(file);
            resolve({ file, src: blobUrl });
          } catch (err) {
            reject(err);
          }
        })
    );

    try {
      const results = await Promise.all(filePromises);
      const timestamp = Date.now();

      const newImages: ImageItem[] = results.map((result, index) => ({
        id: `img-${timestamp}-${index}`,
        fileName: result.file.name,
        src: result.src,
        file: result.file,
        detections: [],
        isAnalyzing: false,
        error: null,
      }));

      setState(prev => {
        // Append new images to existing ones
        const combinedImages = [...prev.images, ...newImages];

        // If no active image, set the first new image as active
        const activeImageId = prev.activeImageId || newImages[0].id;
        const activeImage = combinedImages.find(img => img.id === activeImageId);

        return {
          ...prev,
          images: combinedImages,
          activeImageId: activeImageId,
          image: activeImage?.src || prev.image,
          fileName: activeImage?.fileName || prev.fileName,
          detections: activeImage?.detections || prev.detections,
          error: null,
        };
      });
      setShowOriginal(false);
    } catch (err) {
      const safeMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to read one or more image files:", safeMsg);
      setState(prev => ({
        ...prev,
        error: "Failed to read one or more image files. Please try again.",
      }));
    }
  };

  const toggleCategory = (label: string, shouldSelect: boolean) => {
    setState(prev => {
      const updatedDetections = prev.detections.map(d =>
        d.label === label ? { ...d, selected: shouldSelect } : d
      );

      const images = prev.images.map(img =>
        img.id === prev.activeImageId
          ? {
              ...img,
              detections: img.detections.map(d =>
                d.label === label ? { ...d, selected: shouldSelect } : d
              ),
            }
          : img
      );

      return {
        ...prev,
        detections: updatedDetections,
        images,
      };
    });
  };

  const toggleDetection = (id: string) => {
    setState(prev => {
      const updatedDetections = prev.detections.map(d =>
        d.id === id ? { ...d, selected: !d.selected } : d
      );

      const images = prev.images.map(img =>
        img.id === prev.activeImageId
          ? {
              ...img,
              detections: img.detections.map(d =>
                d.id === id ? { ...d, selected: !d.selected } : d
              ),
            }
          : img
      );

      return {
        ...prev,
        detections: updatedDetections,
        images,
      };
    });
  };

  const removeImage = () => {
    // Revoke all blob URLs before clearing state
    state.images.forEach(img => {
      if (img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
        blobUrlsRef.current.delete(img.src);
      }
    });
    
    setState({
      image: null,
      fileName: null,
      detections: [],
      error: null,
      images: [],
      activeImageId: null,
      isAnalyzing: false,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setExpandedCategories({});
  };

  const removeIndividualImage = (id: string) => {
    setState(prev => {
      // Revoke blob URL for this image
      const imageToRemove = prev.images.find(img => img.id === id);
      if (imageToRemove && imageToRemove.src.startsWith('blob:')) {
        URL.revokeObjectURL(imageToRemove.src);
      }

      const remainingImages = prev.images.filter(img => img.id !== id);
      
      // If removing the active image, switch to the first remaining image
      if (prev.activeImageId === id) {
        const nextImage = remainingImages[0];
        if (nextImage) {
          return {
            ...prev,
            images: remainingImages,
            activeImageId: nextImage.id,
            image: nextImage.src,
            fileName: nextImage.fileName,
            detections: nextImage.detections,
            error: nextImage.error,
          };
        } else {
          // No images left
          return {
            ...prev,
            images: [],
            activeImageId: null,
            image: null,
            fileName: null,
            detections: [],
            error: null,
          };
        }
      }
      
      return {
        ...prev,
        images: remainingImages,
      };
    });
  };

  const downloadRedacted = useCallback(() => {
    const activeImage = state.images.find(img => img.id === state.activeImageId);
    if (!activeImage) return;
    
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
      link.download = `redacted-${activeImage.fileName}`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = activeImage.src;
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

  const handleSelectImage = (id: string) => {
    setState(prev => {
      const image = prev.images.find(img => img.id === id);
      if (!image) return prev;

      return {
        ...prev,
        activeImageId: id,
        image: image.src,
        fileName: image.fileName,
        detections: image.detections,
        error: image.error,
      };
    });
    
    // Update expanded categories after state update
    const image = state.images.find(img => img.id === id);
    if (image) {
      const uniqueLabels = Array.from(new Set(image.detections.map(r => r.label)));
      setExpandedCategories(uniqueLabels.reduce((acc: Record<string, boolean>, label: string) => ({ ...acc, [label]: true }), {}));
    }
    
    setShowOriginal(false);
  };

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
            <button
              onClick={() => {
                setState(prev => ({ ...prev, error: null }));
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-all"
            >
              <UploadCloud className="w-3 h-3" />
              Upload Images
            </button>
            {state.image && !isActiveImageAnalyzing && state.detections.length > 0 && (
              <button 
                onClick={() => setShowOriginal(!showOriginal)} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${showOriginal ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}
              >
                {showOriginal ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {showOriginal ? 'Original' : 'Redacted'}
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              multiple 
              onChange={handleFileUpload} 
            />
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
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
                <img 
                  src={state.image} 
                  alt="Workspace" 
                  className="w-full h-full object-contain block border border-slate-700 pointer-events-none" 
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
                {isActiveImageAnalyzing && (
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

          {/* Image list/grid preview */}
          {state.images.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Image Batch ({state.images.length}/10)
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {state.images.map(image => {
                  const isActive = image.id === state.activeImageId;
                  const hasDetections = image.detections.length > 0;

                  let statusLabel = 'Pending Scan';
                  let statusClass = 'text-slate-500 bg-slate-900 border-slate-800';
                  if (image.isAnalyzing) {
                    statusLabel = 'Scanning...';
                    statusClass = 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30';
                  } else if (image.error) {
                    statusLabel = 'Error';
                    statusClass = 'text-red-300 bg-red-500/10 border-red-500/30';
                  } else if (hasDetections) {
                    statusLabel = 'Redacted';
                    statusClass = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
                  }

                  return (
                    <div
                      key={image.id}
                      className={`group flex flex-col gap-2 p-2 rounded-2xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-500/60 bg-slate-800/80 shadow-lg shadow-indigo-500/20'
                          : 'border-slate-800 bg-slate-900/40 hover:border-indigo-500/40 hover:bg-slate-800/60'
                      }`}
                    >
                      <button
                        onClick={() => handleSelectImage(image.id)}
                        className="w-full flex flex-col gap-2 cursor-pointer bg-transparent border-0 p-0 text-left"
                        role="button"
                        tabIndex={0}
                        aria-pressed={isActive}
                        aria-label={`Select image: ${image.fileName}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectImage(image.id);
                          }
                        }}
                      >
                        <div className="relative rounded-xl overflow-hidden border border-slate-800/60 h-20 bg-slate-900/60">
                          <img
                            src={image.src}
                            alt={image.fileName}
                            className="w-full h-full object-cover"
                          />
                          {image.isAnalyzing && (
                            <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center text-[8px] font-black uppercase tracking-widest text-indigo-300">
                              Scanning...
                            </div>
                          )}
                          {/* Delete button overlay */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeIndividualImage(image.id);
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete image"
                            aria-label={`Delete image: ${image.fileName}`}
                          >
                            <Trash2 className="w-3 h-3 text-white" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-[9px] font-bold text-slate-300 truncate">
                            {image.fileName}
                          </p>
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                            {hasDetections && (
                              <span className="text-[8px] font-bold text-indigo-300">
                                {image.detections.length} masks
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
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
                <Palette className="w-4 h-4 text-indigo-500" /> Mask Configuration
              </h2>
              <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 space-y-4">
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500 mb-3">Redaction Color</p>
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
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                    <span>Mask Density</span>
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
              {!isActiveImageAnalyzing && (
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 py-4 border-b border-slate-800 shrink-0">
                  <Filter className="w-4 h-4 text-indigo-500" /> Sensitive Fields
                </h2>
              )}
              {/* This container will now scroll on all devices because its parent (sidebar) has a defined height */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-6 min-h-0">
                {state.detections.length > 0 ? (
                  groupedDetections.map(cat => (
                    <div key={cat.label} className="bg-slate-800/20 rounded-xl overflow-hidden border border-slate-800/50">
                      <button 
                        onClick={() => setExpandedCategories(prev => ({...prev, [cat.label]: !prev[cat.label]}))}
                        className="w-full flex items-center justify-between p-4 text-[11px] font-black uppercase tracking-wider hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <CheckSquare className="w-5 h-5 text-emerald-500" />
                          <span className="text-emerald-400">{cat.label}s</span>
                        </div>
                        <span className="text-[9px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">{cat.selectedCount}/{cat.items.length}</span>
                      </button>
                      
                      {expandedCategories[cat.label] && (
                        <div className="px-4 pb-3 space-y-2 border-t border-slate-800/50 pt-2">
                          {cat.items.map((item, idx) => (
                            <button 
                              key={item.id}
                              onClick={() => toggleDetection(item.id)}
                              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-[9px] font-bold transition-all ${item.selected ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-slate-900/40 border border-transparent text-slate-600 hover:border-slate-700'}`}
                            >
                              <span className="truncate max-w-[150px]">#{idx + 1} Identified {cat.label}</span>
                              {item.selected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : isActiveImageAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-60 text-[11px] uppercase tracking-widest gap-4 py-12">
                    <RefreshCcw className="w-8 h-8 animate-spin text-indigo-500" />
                    Engineering Privacy
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-[9px] font-black uppercase tracking-[0.3em] text-center border-2 border-dashed border-slate-800 rounded-3xl m-2 py-12">
                    <Info className="w-8 h-8 mb-4" />
                    Filtering Data...
                  </div>
                )}
              </div>
            </div>

            {/* Action Command Center */}
            <div className="p-6 pt-2 border-t border-slate-800 bg-slate-900 shrink-0 space-y-3">
              {state.image && !isActiveImageAnalyzing && state.detections.length === 0 && (
                <button 
                  onClick={handleStartScan} 
                  className="w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.3em] text-white transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/40 active:scale-95 bg-indigo-600 hover:bg-indigo-500"
                >
                  <ScanSearch className="w-5 h-5" /> 
                  Initialize Scan
                </button>
              )}

              {state.detections.length > 0 && (
                <button 
                  onClick={downloadRedacted} 
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-full font-black text-[11px] uppercase tracking-[0.3em] text-white transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/40 active:scale-95"
                >
                  <Download className="w-5 h-5" /> Export Protected
                </button>
              )}
              
              {state.image && (
                <button 
                  onClick={removeImage} 
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-black text-[11px] uppercase tracking-[0.3em] text-slate-400 hover:text-slate-300 transition-all flex items-center justify-center gap-3"
                >
                  <Trash2 className="w-5 h-5" /> Discard
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
