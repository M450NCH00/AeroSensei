// src/app/dashboard/register-site/page.tsx
import RegisterSiteManager from "../../components/RegisterSiteManager";

export default function RegisterSitePage() {
  return (
    <div className="p-4 md:p-8 h-screen bg-[#F1F5F9] relative flex flex-col select-none overflow-hidden">
      
      {/* THE AMBIENT AURA BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#009B9E]/20 rounded-full mix-blend-multiply opacity-60 animate-blob-shift" />
        <div className="absolute top-[30%] right-[-10%] w-[35rem] h-[35rem] bg-[#005A8C]/15 rounded-full mix-blend-multiply opacity-60 animate-blob-shift animation-delay-2000" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40rem] h-[40rem] bg-[#009B9E]/10 rounded-full mix-blend-multiply opacity-50 animate-blob-shift animation-delay-4000" />
      </div>

      {/* Holographic Canvas - Stretches to fill the entire workspace */}
      <div className="relative z-10 flex-1 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white/60 bg-white/70 backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,90,140,0.06)] hover:bg-white/80">
        <RegisterSiteManager />
      </div>
      
    </div>
  );
}