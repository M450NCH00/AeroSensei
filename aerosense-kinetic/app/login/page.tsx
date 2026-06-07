"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User, Lock, Eye, EyeOff, Home } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    // Changed to a solid off-white base color
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden font-sans text-[#1D1D1F]">
      
      {/* --- APPLE-STYLE SHIFTING MESH BACKGROUND --- */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {/* Deep Blue Spot */}
        <div className="absolute top-[-10%] left-[10%] w-[40vw] h-[40vw] bg-[#005A8C]/40 rounded-full mix-blend-multiply animate-blob-shift" />
        
        {/* Teal Spot */}
        <div className="absolute top-[20%] right-[-5%] w-[35vw] h-[35vw] bg-[#009B9E]/40 rounded-full mix-blend-multiply animate-blob-shift animation-delay-2000" />
        
        {/* Amber Accent Spot */}
        <div className="absolute bottom-[-20%] left-[30%] w-[45vw] h-[45vw] bg-[#F28C28]/30 rounded-full mix-blend-multiply animate-blob-shift animation-delay-4000" />
      </div>

      {/* --- BACK TO HOME BUTTON --- */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-base font-semibold text-gray-500 hover:text-[#005A8C] transition-colors z-20"
      >
        <Home size={22} />
        Back to Home
      </Link>

      {/* --- LOGIN CARD --- */}
      <div className="relative z-10 w-full max-w-[420px] p-8 md:p-10 bg-white/50 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-white/80">
        
        {/* Header with Logo */}
        <div className="text-center mb-10 flex flex-col items-center">
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

        {/* Form */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          
          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 pl-1">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User size={18} className="text-gray-400 group-focus-within:text-[#009B9E] transition-colors z-10" />
              </div>
              <input
                type="text"
                placeholder="Enter your email address"
                className="w-full pl-11 pr-4 py-3.5 bg-white/70 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9E]/20 focus:border-[#009B9E] transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex justify-between items-center pl-1 pr-1">
              <label className="text-sm font-bold text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-xs font-semibold text-[#F28C28] hover:text-[#d9771e] transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400 group-focus-within:text-[#009B9E] transition-colors z-10" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full pl-11 pr-12 py-3.5 bg-white/70 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9E]/20 focus:border-[#009B9E] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#005A8C] transition-colors z-10"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button 
            type="submit" 
            className="w-full py-4 mt-4 bg-[#005A8C] text-white text-base font-bold rounded-2xl hover:bg-[#00426b] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center"
          >
            Sign In
          </button>
        </form>

        {/* Register Link */}
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