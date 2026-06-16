// src/app/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { User, Lock, Home, AlertCircle } from "lucide-react";
import AuthInput from "../components/AuthInput";
import axiosInstance from "../api/axiosInstance"; // Linked to your exact file location

export default function LoginPage() {
  const router = useRouter();
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Hits http://localhost:8080/api/auth/login seamlessly
      await axiosInstance.post("/auth/login", { email, password });

      // Send authenticated users straight into the workspace dashboard
      router.push("/dashboard");
    } catch (err: any) {
      const backendErrorMessage = err.response?.data || "Unable to establish connection with security servers.";
      setError(backendErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden font-sans text-[#1D1D1F]">
      
      {/* --- BACKGROUND BLOB VISUALS --- */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[40vw] h-[40vw] bg-[#005A8C]/40 rounded-full mix-blend-multiply animate-blob-shift" />
        <div className="absolute top-[20%] right-[-5%] w-[35vw] h-[35vw] bg-[#009B9E]/40 rounded-full mix-blend-multiply animate-blob-shift animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[30%] w-[45vw] h-[45vw] bg-[#F28C28]/30 rounded-full mix-blend-multiply animate-blob-shift animation-delay-4000" />
      </div>

      <Link 
        href="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-base font-semibold text-gray-500 hover:text-[#005A8C] transition-colors z-20"
      >
        <Home size={22} />
        Back to Home
      </Link>

      <div className="relative z-10 w-full max-w-[420px] p-8 md:p-10 bg-white/50 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-white/80">
        
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative mb-4 flex-shrink-0" style={{ width: '80px', height: '80px' }}>
            <Image 
              src="/aerosense-logo-clear.png" 
              alt="AeroSense Logo" 
              fill
              sizes="80px"
              className="object-contain"
              priority
            />
          </div>
          
          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-[#005A8C]">Aero</span>
            <span className="text-[#009B9E]">Sense</span>
          </h1>
          <p className="text-sm font-semibold tracking-widest text-gray-500 mt-2 uppercase">
            Air Quality Monitoring
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50/80 border border-red-100 rounded-2xl flex items-start gap-2.5 text-xs font-bold text-red-800 animate-in fade-in zoom-in-95 duration-200">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-5">
          <AuthInput
            label="Email Address"
            id="email"
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={setEmail}
            icon={<User size={18} />}
          />

          <div className="relative">
            <Link 
              href="/forgot-password" 
              className="absolute top-0 right-1 text-xs font-semibold text-[#F28C28] hover:text-[#d9771e] transition-colors z-20"
            >
              Forgot password?
            </Link>
            <AuthInput
              label="Password"
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={setPassword}
              icon={<Lock size={18} />}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-4 mt-4 bg-[#005A8C] text-white text-base font-bold rounded-2xl hover:bg-[#00426b] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none cursor-pointer"
          >
            {isLoading ? "Verifying Credentials..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm font-medium text-gray-500">
            Don't have an account?{" "}
            <Link href="/signup" className="font-bold text-[#009B9E] hover:text-[#005A8C] hover:underline transition-all">
              Register here
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}