import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  glow?: boolean;
}

export default function Logo({ size = 24, glow = true, className, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${glow ? "drop-shadow-[0_0_10px_rgba(99,102,241,0.55)]" : ""}`}
      {...props}
    >
      <defs>
        <linearGradient id="cyan-indigo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" /> {/* cyan */}
          <stop offset="100%" stopColor="#6366F1" /> {/* electric indigo */}
        </linearGradient>
        <linearGradient id="indigo-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" /> {/* electric indigo */}
          <stop offset="100%" stopColor="#8B5CF6" /> {/* violet */}
        </linearGradient>
      </defs>
      {/* Back segment */}
      <path
        d="M18 2L6 16H14L11 30L20 18H13L18 2Z"
        fill="url(#cyan-indigo-grad)"
      />
      {/* Front overlapping segment */}
      <path
        d="M21 8L9 22H17L14 30L23 18H16L21 8Z"
        fill="url(#indigo-violet-grad)"
        opacity="0.85"
        style={{ mixBlendMode: "screen" }}
      />
    </svg>
  );
}
