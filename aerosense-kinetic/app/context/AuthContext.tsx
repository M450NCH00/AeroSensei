// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axiosInstance from "@/app/api/axiosInstance";

interface User {
  email: string;
  role: string | string[];
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // CHANGED: Instead of calling axiosInstance.get("/auth/me")
        // We use standard fetch to call our local Next.js middleman route
        const response = await fetch("/api/session");
        
        if (!response.ok) throw new Error("No session");
        
        const decodedData = await response.json();
        
        // This will now contain your full JWT payload, including permissions!
        console.log("Decoded Token Data:", decodedData);
        
        setUser(decodedData);
      } catch (error) {
        setUser(null); 
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const normalizeRoles = (): string[] => {
    if (!user?.role) return [];
    if (Array.isArray(user.role)) {
      return user.role.map((value) => value.toString().trim().toUpperCase());
    }
    return [user.role.toString().trim().toUpperCase()];
  };

  const hasPermission = (permission: string) => {
    const permissions = user?.permissions ?? [];
    return permissions.some((value) => value.toString().trim().toUpperCase() === permission.trim().toUpperCase());
  };

  const hasRole = (role: string) => normalizeRoles().includes(role.trim().toUpperCase());

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};