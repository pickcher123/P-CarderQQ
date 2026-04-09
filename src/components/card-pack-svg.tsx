import { cn } from "@/lib/utils";

interface CardPackSvgProps {
  className?: string;
  isTorn?: boolean;
  tearProgress?: number; // 0 to 100
}

export function CardPackSvg({ className, isTorn = false, tearProgress = 0 }: CardPackSvgProps) {
  // 鋸齒路徑 (保持原樣作為撕裂邊緣)
  const sawtoothPath = "M 0 45 L 10 38 L 20 45 L 30 38 L 40 45 L 50 38 L 60 45 L 70 38 L 80 45 L 90 38 L 100 45 L 110 38 L 120 45 L 130 38 L 140 45 L 150 38 L 160 45 L 170 38 L 180 45 L 190 38 L 200 45 L 210 38 L 220 45 L 230 38 L 240 45 L 250 38 L 260 45 L 270 38 L 280 45";
  
  // 卡包主體路徑：垂直單位調整為 450
  const bodyPath = `${sawtoothPath} L 280 430 Q 280 450 260 450 L 20 450 Q 0 450 0 430 Z`;
  
  // 封條路徑 (頂部部分)
  const stripPath = `M 20 0 Q 0 0 0 20 L 0 45 ${sawtoothPath.substring(1)} L 280 20 Q 280 0 260 0 Z`;

  const stripRotation = tearProgress * 0.2;
  const stripTranslateY = tearProgress * -0.4;
  const stripTranslateX = tearProgress * 0.1;
  const stripOpacity = Math.max(0, 1 - tearProgress / 100);

  return (
    <svg
      viewBox="0 0 280 450"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("overflow-visible", className)}
    >
      <defs>
        {/* 背景能量脈衝漸層 */}
        <linearGradient id="pack-bg-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1931" />
          <stop offset="50%" stopColor="#185adb" />
          <stop offset="100%" stopColor="#0a1931" />
        </linearGradient>
        
        {/* 全息掃光特效 */}
        <linearGradient id="shine-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.15" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
          <animateTransform 
            attributeName="gradientTransform" 
            type="translate" 
            from="-1 -1" 
            to="1 1" 
            dur="2.5s" 
            repeatCount="indefinite" 
          />
        </linearGradient>

        {/* 恆亮星空模式 */}
        <pattern id="stars-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" fill="white" opacity="0.6" />
          <circle cx="50" cy="40" r="0.5" fill="white" opacity="0.4" />
          <circle cx="80" cy="20" r="1.5" fill="#00d4ff" opacity="0.8" />
          <circle cx="30" cy="70" r="0.8" fill="white" opacity="0.3" />
          <circle cx="70" cy="85" r="1.2" fill="#00d4ff" opacity="0.7" />
        </pattern>

        <filter id="pack-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="6" floodOpacity="0.3" />
        </filter>
      </defs>

      <g>
        {/* 卡包主體與特效 */}
        <path d={bodyPath} fill="url(#pack-bg-grad)" filter="url(#pack-shadow)" />
        <path d={bodyPath} fill="url(#stars-pattern)" />
        <path d={bodyPath} fill="url(#shine-grad)" />
        
        {/* 標誌區域：垂直位移調整 */}
        <g transform="translate(140, 225)">
            <text y="5" fontFamily="Orbitron, sans-serif" fontSize="28" fontWeight="900" fill="white" textAnchor="middle" letterSpacing="1" opacity="0.1" filter="blur(4px)">
                P+Carder
            </text>
            <text y="0" fontFamily="Orbitron, sans-serif" fontSize="26" fontWeight="900" fill="#00d4ff" textAnchor="middle" letterSpacing="1">
                P+Carder
            </text>
            <text y="25" fontFamily="Rajdhani, sans-serif" fontSize="10" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="4" opacity="0.8">
                AUTHENTIC ASSET
            </text>
        </g>
      </g>

      {!isTorn && (
        <g 
          transform={`translate(${stripTranslateX}, ${stripTranslateY}) rotate(${stripRotation}, 280, 45)`}
          style={{ opacity: stripOpacity, transition: 'opacity 0.1s' }}
        >
            <path d={stripPath} fill="#0a1931" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <path d={sawtoothPath} fill="none" stroke="rgba(0,212,255,0.4)" strokeWidth="2" strokeLinecap="round" />
            <path d={stripPath} fill="url(#shine-grad)" />
        </g>
      )}

      {!isTorn && tearProgress > 0 && tearProgress < 100 && (
          <g transform={`translate(${(tearProgress / 100) * 280}, 45)`}>
              <circle r="8" fill="#00d4ff" filter="blur(4px)" />
              <circle r="3" fill="white" />
          </g>
      )}
    </svg>
  );
}
