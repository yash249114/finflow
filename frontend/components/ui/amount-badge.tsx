import React from "react";

interface AmountBadgeProps {
  amount: number;
  className?: string;
}

export default function AmountBadge({ amount, className = "" }: AmountBadgeProps) {
  const isPositive = amount >= 0;
  const absVal = Math.abs(amount);
  
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(absVal);

  return (
    <span
      className={`font-mono font-semibold text-sm ${
        isPositive ? "text-success" : "text-danger"
      } ${className}`}
    >
      {isPositive ? `+${formatted}` : `-${formatted}`}
    </span>
  );
}
