import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:scale-[1.01] transition-transform duration-200 shadow-lg">
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium text-text-muted">{title}</span>
        {icon && <div className="text-primary">{icon}</div>}
      </div>

      <div className="mt-4">
        <h3 className="text-3xl font-bold font-mono tracking-tight text-text-primary">
          {value}
        </h3>
      </div>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center space-x-2 text-xs">
          {trend && (
            <span
              className={`flex items-center font-medium ${
                trend === "up"
                  ? "text-success"
                  : trend === "down"
                  ? "text-danger"
                  : "text-text-muted"
              }`}
            >
              {trend === "up" && <ArrowUpRight className="h-4 w-4 mr-0.5" />}
              {trend === "down" && <ArrowDownRight className="h-4 w-4 mr-0.5" />}
              {trend === "neutral" && <Minus className="h-4 w-4 mr-0.5" />}
              {trendValue}
            </span>
          )}
          {subtitle && <span className="text-text-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
