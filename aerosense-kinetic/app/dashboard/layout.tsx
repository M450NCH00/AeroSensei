// src/app/dashboard/layout.tsx
import Sidebar from "../components/Sidebar";
import AuthGuard from "../components/AuthGuard"; // 1. Import the guard

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 2. Wrap everything inside the guard
    <AuthGuard>
      <div className="flex h-screen bg-[#F8FAFC] font-sans text-[#1D1D1F] overflow-hidden">
        
        {/* Your Sidebar Navigation */}
        <Sidebar />

        {/* The main content area where your pages load */}
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>

      </div>
    </AuthGuard>
  );
}