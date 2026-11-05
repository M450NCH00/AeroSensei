// src/components/AuthGuard.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth(); // Tap into the global state!

  useEffect(() => {
    // If loading finishes and they aren't authenticated, bounce them
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show the spinner while the AuthContext is fetching data
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#F8FAFC] flex flex-col items-center justify-center z-50 select-none">
        <div className="w-10 h-10 border-4 border-[#005A8C]/20 border-t-[#005A8C] rounded-full animate-spin mb-4" />
        <p className="text-xs font-black text-gray-400 tracking-widest uppercase animate-pulse">
          Verifying Secure Session...
        </p>
      </div>
    );
  }

  // If they pass the check, render the dashboard pages.
  return isAuthenticated ? <>{children}</> : null;
}