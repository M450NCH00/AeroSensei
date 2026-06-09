// src/app/dashboard/layout.tsx
import Sidebar from "../components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-[#1D1D1F] overflow-hidden">
      
      {/* Our newly imported dynamic Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        {children}
      </main>

    </div>
  );
}