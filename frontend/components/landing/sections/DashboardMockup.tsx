"use client";

export function DashboardMockup() {
  return (
    <section id="demo" className="py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16 select-none">
          <h2 className="text-xs font-bold tracking-widest text-indigo-500 uppercase font-mono">
            Dashboard Mockup
          </h2>
          <p className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-2">
            Autonomous forecast visualization
          </p>
        </div>

        <div className="relative mx-auto max-w-5xl rounded-2xl border border-[#1D1E22] bg-[#0F1012]/20 p-4 shadow-2xl shadow-indigo-500/5 backdrop-blur-md overflow-visible select-none">
          {/* Sweep highlights across the outer frame */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

          <div className="relative h-[480px] w-full rounded-xl border border-[#1D1E22]/60 bg-gray-950 flex overflow-hidden shadow-2xl transition-[background-color,border-color,box-shadow,color,opacity] duration-300">
            {/* Cinematic shine reflection layer */}
            <div
              className="absolute inset-0 pointer-events-none z-10 opacity-20 mix-blend-overlay"
              style={{
                background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.15) 48%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 52%, transparent 65%)",
                backgroundSize: "200% 100%",
                animation: "glow-sweep 3s ease-in-out infinite",
              }}
            />

            {/* Faux Sidebar */}
            <div className="w-14 shrink-0 border-r border-gray-900 bg-gray-950/80 flex flex-col items-center py-5 justify-between">
              <div className="flex flex-col space-y-5 items-center">
                <div className="h-6 w-6 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">F</span>
                </div>
                <div className="flex flex-col space-y-4 items-center">
                  {[
                    { icon: "chart", active: true },
                    { icon: "zap", active: false },
                    { icon: "trending", active: false },
                    { icon: "lock", active: false },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center text-gray-600 transition-colors ${
                        item.active
                          ? "bg-indigo-600/10 text-indigo-500 border border-indigo-500/15"
                          : "hover:text-gray-400"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase">
                        {item.icon[0].toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-7 w-7 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 font-mono">
                U
              </div>
            </div>

            {/* Faux Main content */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#08090a]/40 overflow-hidden relative">
              {/* Top spotlight gradients */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.03),transparent_60%)] pointer-events-none" />

              {/* Top bar header */}
              <div className="h-12 border-b border-gray-900 px-6 flex items-center justify-between bg-gray-950/40">
                <div className="flex items-center space-x-2.5">
                  <span className="text-xs font-semibold text-gray-300">Overview</span>
                  <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    Live Feed
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Runway Outlook</span>
              </div>

              {/* Faux body */}
              <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                {/* Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { t: "Net Flow", v: "$42,391.22", diff: "+12.4%", p: true },
                    { t: "Income", v: "$68,102.80", diff: "+8.1%", p: true },
                    { t: "Expenses", v: "$25,711.58", diff: "+4.2%", p: false },
                    { t: "Horizon Score", v: "Optimal", diff: "90 Days", p: true },
                  ].map((st, idx) => (
                    <div key={idx} className="bg-gray-900/40 border border-gray-800/80 p-4 rounded-xl space-y-1.5 hover:border-indigo-500/10 transition-colors">
                      <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">{st.t}</div>
                      <div className="text-sm font-bold text-white font-mono">{st.v}</div>
                      <div className={`text-[9px] font-bold ${st.p ? "text-emerald-400" : "text-red-400"}`}>
                        {st.diff}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Line chart widget */}
                <div className="bg-gray-900/20 border border-gray-800/80 rounded-xl p-5 relative overflow-hidden">
                  {/* Realtime Scanning Prediction Beam */}
                  <div
                    className="absolute top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent pointer-events-none"
                    style={{ animation: "glow-sweep 7s ease-in-out infinite" }}
                  />

                  <div className="flex items-center justify-between mb-5">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Liquidity Index</span>
                      <div className="text-xs font-bold text-white">Estimated Cash Flow Trend</div>
                    </div>
                    <div className="flex items-center space-x-3 text-[9px] text-gray-400 font-mono">
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Actual</span>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 border border-dashed border-violet-400 rounded-full" /> Forecast</span>
                    </div>
                  </div>

                  {/* Glowing SVG Charts */}
                  <div className="h-36 w-full relative overflow-visible">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <defs>
                        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="0.8" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <linearGradient id="glow-actual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="glow-forecast" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Historical path */}
                      <path id="actual-path" d="M 0 25 Q 12 23 24 24 T 48 15 T 65 17" fill="none" stroke="#6366f1" strokeWidth="1.2" filter="url(#neon-glow)" />
                      <path d="M 0 25 Q 12 23 24 24 T 48 15 T 65 17 L 65 30 L 0 30 Z" fill="url(#glow-actual)" />

                      {/* Predicted path */}
                      <path id="forecast-path" d="M 65 17 Q 78 11 88 13 T 100 5" fill="none" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="1.5 1" filter="url(#neon-glow)" />
                      <path d="M 65 17 Q 78 11 88 13 T 100 5 L 100 30 L 65 30 Z" fill="url(#glow-forecast)" />

                      {/* Confidence bounds */}
                      <path d="M 65 17 Q 78 7 88 8 T 100 1 L 100 10 Q 88 17 78 15 T 65 17 Z" fill="#8b5cf6" fillOpacity="0.03" />
                      
                      {/* Animating flow pulse along forecast path */}
                      <circle r="1" fill="#a78bfa">
                        <animateMotion dur="5s" repeatCount="indefinite" path="M 65 17 Q 78 11 88 13 T 100 5" />
                      </circle>
                    </svg>

                    {/* Vertical Divider for Today */}
                    <div className="absolute top-0 bottom-0 left-[65%] border-l border-dashed border-gray-700/80 flex flex-col justify-start">
                      <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono -translate-x-1/2 -mt-2.5 backdrop-blur-md">
                        Today
                      </span>
                    </div>

                    {/* Pulsing indicator */}
                    <div
                      className="absolute right-6 top-[15%] flex h-2.5 w-2.5"
                      style={{ animation: "float 2s ease-in-out infinite" }}
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Panel 1 (Left) */}
              <div className="absolute -left-6 top-24 glass-card border-[#1D1E22] p-4 rounded-xl shadow-2xl flex items-center space-x-3.5 backdrop-blur-xl pointer-events-none select-none hidden md:flex border-l-4 border-l-indigo-500">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                  <span className="text-lg">★</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Net Flow</div>
                  <div className="text-xs font-bold text-white font-mono">+$42,391.22</div>
                </div>
              </div>

              {/* Floating Panel 2 (Bottom Right) */}
              <div className="absolute -right-6 bottom-16 glass-card border-[#1D1E22] p-4 rounded-xl shadow-2xl flex items-center space-x-3.5 backdrop-blur-xl pointer-events-none select-none hidden md:flex">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                  <span className="text-lg">✓</span>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">CFO Verification</div>
                  <div className="text-xs font-semibold text-gray-300">Runways synced live</div>
                </div>
              </div>

              {/* Floating Panel 3 (Top Right) */}
              <div className="absolute -right-8 top-28 bg-gradient-to-br from-indigo-950/40 to-violet-950/40 border border-indigo-500/30 p-4 rounded-xl shadow-2xl flex flex-col space-y-1.5 backdrop-blur-xl pointer-events-none select-none hidden lg:flex">
                <div className="flex items-center space-x-2">
                  <span className="h-3.5 w-3.5 text-indigo-400 animate-pulse">✦</span>
                  <span className="text-[9px] text-white font-black uppercase tracking-widest font-mono">MAX Score</span>
                </div>
                <div className="text-base font-black text-white font-mono">98.2<span className="text-[10px] text-gray-500">/100</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}