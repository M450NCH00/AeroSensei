// src/app/forgot-password/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";

export default function ForgotPasswordPage() {
  // State Management
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  
  // OTP State and Refs
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 60-Second Countdown Timer
  useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timerId);
    }
  }, [step, timeLeft]);

  // --- OTP INPUT LOGIC ---
  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    // Take only the last character if they somehow type multiple
    newCode[index] = value.slice(-1); 
    setCode(newCode);

    // Auto-advance to the next box if a number was typed
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to automatically focus the previous box
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).replace(/\D/g, "");
    
    if (pastedData) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);
      // Focus the next empty box, or the last box if full
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  // --- SUBMISSION HANDLERS ---
  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStep(2);
    setTimeLeft(60);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code.join("");
    if (finalCode.length < 6) return; // Prevent submission if incomplete
    console.log("Verifying code:", finalCode);
  };

  const handleResendCode = () => {
    if (timeLeft > 0) return;
    // Trigger backend resend here
    setTimeLeft(60);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] relative overflow-hidden font-sans text-[#1D1D1F]">
      
      {/* APPLE-STYLE BACKGROUND */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[40vw] h-[40vw] bg-[#005A8C]/40 rounded-full mix-blend-multiply animate-blob-shift" />
        <div className="absolute top-[20%] right-[-5%] w-[35vw] h-[35vw] bg-[#009B9E]/40 rounded-full mix-blend-multiply animate-blob-shift animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[30%] w-[45vw] h-[45vw] bg-[#F28C28]/30 rounded-full mix-blend-multiply animate-blob-shift animation-delay-4000" />
      </div>

      <Link 
        href="/login" 
        className="absolute top-8 left-8 flex items-center gap-2 text-base font-semibold text-gray-500 hover:text-[#005A8C] transition-colors z-20"
      >
        <ArrowLeft size={22} />
        Back to Login
      </Link>

      <div className="relative z-10 w-full max-w-[420px] p-8 md:p-10 bg-white/50 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-white/80 transition-all duration-500">
        
        {/* Header */}
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
          
          <h1 className="text-3xl font-black tracking-tight text-[#005A8C]">
            {step === 1 ? "Reset Password" : "Check Your Email"}
          </h1>
          <p className="text-sm font-semibold tracking-wide text-gray-500 mt-2 px-4">
            {step === 1 
              ? "Enter your email and we will send you a 6-digit recovery code." 
              : `We sent a temporary code to ${email}`}
          </p>
        </div>

        {/* STEP 1: EMAIL */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 pl-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400 group-focus-within:text-[#009B9E] transition-colors z-10" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/70 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9E]/20 focus:border-[#009B9E] transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-4 mt-2 bg-[#005A8C] text-white text-base font-bold rounded-2xl hover:bg-[#00426b] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center"
            >
              Send Reset Code
            </button>
          </form>
        )}

        {/* STEP 2: 6-BOX OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 block text-center">6-Digit Code</label>
              
              {/* THE 6 BOXES */}
              <div className="flex justify-center gap-2">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    aria-label={`Code digit ${index + 1} of 6`}
                    title={`Code digit ${index + 1}`}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="w-12 h-14 text-center text-2xl font-bold bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#009B9E]/50 focus:border-[#009B9E] shadow-sm transition-all"
                  />
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={code.join("").length < 6}
              className="w-full py-4 bg-[#009B9E] text-white text-base font-bold rounded-2xl hover:bg-[#008285] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              Verify Code
              <CheckCircle2 size={20} />
            </button>

            {/* RESEND CONTROLS */}
            <div className="flex flex-col items-center justify-center mt-6 pt-4 border-t border-gray-200/50">
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={handleResendCode}
                  disabled={timeLeft > 0}
                  className={`flex items-center gap-1.5 font-bold transition-all ${
                    timeLeft > 0 
                      ? "text-gray-400 cursor-not-allowed" 
                      : "text-[#005A8C] hover:text-[#00426b] hover:underline"
                  }`}
                >
                  <RefreshCw size={16} className={timeLeft > 0 ? "" : "animate-spin-once"} />
                  Resend Code
                </button>
                
                {timeLeft > 0 && (
                  <span className="text-sm font-medium text-gray-500">
                    (Expires in <span className="font-bold text-[#F28C28]">0:{timeLeft.toString().padStart(2, '0')}</span>)
                  </span>
                )}
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}