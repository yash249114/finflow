import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
            <defs>
              <linearGradient id="cyan-indigo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#06B6D4" />
                <stop offset="100%" stop-color="#6366F1" />
              </linearGradient>
              <linearGradient id="indigo-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#6366F1" />
                <stop offset="100%" stop-color="#8B5CF6" />
              </linearGradient>
            </defs>
            <path d="M18 2L6 16H14L11 30L20 18H13L18 2Z" fill="url(#cyan-indigo-grad)" />
            <path d="M21 8L9 22H17L14 30L23 18H16L21 8Z" fill="url(#indigo-violet-grad)" opacity="0.85" style={{ mixBlendMode: "screen" }} />
          </svg>
        </div>
        <h1 className="text-6xl font-black text-white mb-4 font-mono">404</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          This page doesn&apos;t exist. The link may be broken or the page may have been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-[#1D1E22] bg-transparent px-6 py-3 text-xs font-semibold text-white transition-all hover:border-indigo-500/30 font-mono uppercase tracking-wider"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
