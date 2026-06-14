// src/components/AuthGuard.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "../api/axiosInstance";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSessionAuthentication = async () => {
      try {
        // Hit the /me endpoint. If it works, the user is perfectly authenticated.
        const response = await axiosInstance.get("/auth/me");
        
        // Optional: You can store response.data (email, role) in React Context or Zustand here later!
        console.log("Authenticated as:", response.data.email);
        
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkSessionAuthentication();
  }, [router]);

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

  return isAuthenticated ? <>{children}</> : null;
}