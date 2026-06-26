// src/components/RollingNumber.tsx
"use client";

import { useEffect, useState, useRef } from "react";

interface RollingNumberProps {
  value: number | null;
  duration?: number; // Total animation length in milliseconds
  decimals?: number; // How many decimal places to display
}

export default function RollingNumber({ value, duration = 1200, decimals = 0 }: RollingNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const endValueRef = useRef<number>(0);

  useEffect(() => {
    if (value === null || isNaN(value)) {
      setDisplayValue(0);
      return;
    }

    // Capture the starting point and new target point
    const startValue = displayValue;
    const endValue = value;
    endValueRef.current = endValue;
    startTimeRef.current = null;

    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      
      // Progress ratio clamped between 0 and 1
      const progress = Math.min(elapsed / duration, 1);

      // Deceleration curve (Ease-Out Power 3)
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);

      // Calculate current frame value
      const current = startValue + (endValue - startValue) * easeOutProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  if (value === null) return <span>—</span>;

  return <span>{displayValue.toFixed(decimals)}</span>;
}