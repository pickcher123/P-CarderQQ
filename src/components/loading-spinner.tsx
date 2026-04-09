export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-primary">
      <svg
        width="80"
        height="80"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#glow)">
          <circle cx="50" cy="50" r="45" stroke="hsl(var(--primary) / 0.2)" strokeWidth="4" />
          <circle cx="50" cy="50" r="35" stroke="hsl(var(--primary) / 0.4)" strokeWidth="3" />
          <circle cx="50" cy="50" r="25" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" />
          
          <path d="M50 5 A 45 45 0 0 1 95 50" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur="1s"
              repeatCount="indefinite"
            />
          </path>
           <path d="M50 15 A 35 35 0 0 1 85 50" stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="360 50 50"
              to="0 50 50"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      </svg>
      <p className="font-code text-lg tracking-widest animate-pulse">正在讀取區塊鏈數據...</p>
    </div>
  );
}
