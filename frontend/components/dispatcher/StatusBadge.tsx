import React from "react";


import { cn } from "cn";

export type StatusVariant = "success" | "warning" | "destructive" | "info" | "neutral" | "primary";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
  variant?: StatusVariant;
}

export function StatusBadge({ status, variant = "neutral", className, ...props }: StatusBadgeProps) {
  // Use inline styles to guarantee colors match Figma and avoid Tailwind JIT purging issues
  const getStyles = () => {
    switch (variant) {
      case "success": return { backgroundColor: "#ecfdf5", color: "#059669" };
      case "warning": return { backgroundColor: "#fffbeb", color: "#b48141" };
      case "destructive": return { backgroundColor: "#fef2f2", color: "#dc2626" };
      case "info": return { backgroundColor: "#eff6ff", color: "#1d4ed8" };
      case "neutral": return { backgroundColor: "#f1f5f9", color: "#475569" };
      case "primary": return { backgroundColor: "#f1f5f9", color: "#1c355e" };
      default: return { backgroundColor: "#f1f5f9", color: "#475569" };
    }
  };

  return (
    <div 
      className={cn("inline-flex items-center justify-center font-medium px-3 py-1 rounded-full text-sm", className)}
      style={getStyles()}
      {...props}
    >
      {status}
    </div>
  );
}
