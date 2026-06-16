// src/app/dashboard/layout.tsx
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard";
import { AuthProvider } from "../context/AuthContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // 1. The Brain wraps everything
    <AuthProvider> 
      
      <AuthGuard> 
        
        <div className="flex h-screen bg-[#F8FAFC] font-sans text-[#1D1D1F] overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto relative">
            {children}
          </main>
        </div>
        
      </AuthGuard>
    </AuthProvider>
  );
}