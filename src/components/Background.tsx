import { memo } from 'react';

// Memoized to prevent re-renders on every route change
export default memo(function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-fest-dark">
      {/* Animated Mesh Gradients — GPU-accelerated via CSS animations instead of JS */}
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-fest-primary/10 blur-[80px] animate-mesh-1" />
      <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-fest-accent/5 blur-[80px] animate-mesh-2" />
      <div className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-fest-primary-dark/10 blur-[80px] animate-mesh-3" />

      {/* Grain Texture Overlay — inline SVG data URI instead of external fetch */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />
      
      {/* CSS-only particles — zero JS cost */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-particle"
            style={{
              left: `${12 + i * 11}%`,
              top: `${10 + (i * 17) % 80}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + (i % 3)}s`,
              opacity: 0.15 + (i % 3) * 0.1,
            }}
          />
        ))}
      </div>
    </div>
  );
});
