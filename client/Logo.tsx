
import React from 'react';

interface LogoProps {
  className?: string;
  isAnalyzing?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-8 h-8", isAnalyzing = false }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Background Glow */}
      <div className={`absolute inset-0 bg-indigo-500/20 blur-xl rounded-full transition-all duration-1000 ${isAnalyzing ? 'scale-150 opacity-60' : 'scale-100 opacity-20'}`} />
      
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 w-full h-full">
        <defs>
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Outer Shield Frame */}
        <path 
          d="M50 92C50 92 88 76 88 44V18L50 8L12 18V44C12 76 50 92 50 92Z" 
          stroke="url(#shieldGradient)" 
          strokeWidth="4" 
          strokeLinejoin="round"
          className="drop-shadow-lg"
        />

        {/* Inner Shield Body */}
        <path 
          d="M50 85C50 85 80 70 80 44V22L50 14L20 22V44C20 70 50 85 50 85Z" 
          fill="rgba(99, 102, 241, 0.05)"
        />

        {/* Central "Eye" / Lens */}
        <circle cx="50" cy="46" r="16" stroke="#818cf8" strokeWidth="2" strokeDasharray="4 2" />
        <circle cx="50" cy="46" r="8" fill="#6366f1" filter="url(#glow)" className={isAnalyzing ? 'animate-pulse' : ''} />
        <circle cx="47" cy="43" r="2" fill="white" fillOpacity="0.8" />

        {/* Scanning Line */}
        <rect 
          x="25" 
          y={isAnalyzing ? "0" : "44"} 
          width="50" 
          height="4" 
          rx="2" 
          fill="#818cf8" 
          className={isAnalyzing ? 'animate-bounce' : ''}
          style={{ 
            animation: isAnalyzing ? 'scan 2s ease-in-out infinite' : 'none',
            filter: 'drop-shadow(0 0 4px #6366f1)'
          }} 
        />
        
        <style>{`
          @keyframes scan {
            0%, 100% { transform: translateY(15px); opacity: 0.3; }
            50% { transform: translateY(60px); opacity: 1; }
          }
        `}</style>
      </svg>
    </div>
  );
};

export default Logo;
