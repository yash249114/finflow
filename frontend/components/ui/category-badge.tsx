import React from "react";

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export default function CategoryBadge({ category, className = "" }: CategoryBadgeProps) {
  const normCategory = category.toLowerCase().trim();

  const colorMap: Record<string, { bg: string; text: string }> = {
    revenue: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
    payroll: { bg: "bg-blue-500/20", text: "text-blue-400" },
    infrastructure: { bg: "bg-violet-500/20", text: "text-violet-400" },
    office: { bg: "bg-slate-500/20", text: "text-slate-400" },
    meals: { bg: "bg-orange-500/20", text: "text-orange-400" },
    marketing: { bg: "bg-pink-500/20", text: "text-pink-400" },
    contractors: { bg: "bg-amber-500/20", text: "text-amber-400" },
    utilities: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
    travel: { bg: "bg-indigo-500/20", text: "text-indigo-400" },
    other: { bg: "bg-gray-500/20", text: "text-gray-400" },
  };

  const colors = colorMap[normCategory] || colorMap.other;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      {category}
    </span>
  );
}
