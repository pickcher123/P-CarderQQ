'use client';

export function HeroStageFloor() {
  return (
    <div className="absolute inset-x-0 bottom-0 top-1/3 pointer-events-none select-none overflow-hidden z-[2]">
      {/* 1. 中心立體舞台垂直光束與向上投射漫射 (Central Stage Uplight) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[85vw] max-w-[1100px] h-[340px] bg-gradient-to-t from-amber-500/15 via-amber-500/5 to-transparent blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[55vw] max-w-[700px] h-[200px] bg-gradient-to-t from-cyan-500/10 via-cyan-500/3 to-transparent blur-[60px] rounded-full pointer-events-none" />

      {/* 2. 3D 透視數位矩陣地網 (3D Perspective Cyber-Grid Stage Floor) */}
      <div 
        className="absolute inset-x-0 bottom-0 h-[380px] sm:h-[440px] flex items-end justify-center"
        style={{
          perspective: '600px',
          perspectiveOrigin: '50% 20%',
        }}
      >
        <div 
          className="w-[140vw] max-w-[1800px] h-[520px] origin-bottom opacity-75 sm:opacity-90"
          style={{
            transform: 'rotateX(72deg) translateY(60px)',
            backgroundImage: `
              linear-gradient(to right, rgba(245, 158, 11, 0.16) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(245, 158, 11, 0.16) 1px, transparent 1px),
              radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.15), transparent 70%)
            `,
            backgroundSize: '48px 48px, 48px 48px, 100% 100%',
            maskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, black 20%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, black 20%, transparent 80%)',
          }}
        />
      </div>

      {/* 3. 底部微光過渡與雷射分界地平線 (Laser Horizon Sheen) */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-background via-background/60 to-transparent" />
      
      {/* 4. 鋒芒光條與核心光點飾標 (Razor Edge Light Line) */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-center">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent opacity-80" />
        <div className="absolute w-28 h-[2px] bg-gradient-to-r from-amber-300 via-white to-amber-300 shadow-[0_0_12px_#fbbf24]" />
        <div className="absolute w-2 h-2 rotate-45 bg-amber-300 shadow-[0_0_10px_#fbbf24] border border-slate-950" />
      </div>
    </div>
  );
}
