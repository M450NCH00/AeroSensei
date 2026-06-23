// src/app/dashboard/register-sensor/page.tsx
import RegisterSensorManager from "../../components/RegisterSensorManager";

export default function RegisterSensorPage() {
  return (
    <div className="p-8 h-full min-h-screen bg-[#F8FAFC] flex flex-col gap-6 relative select-none">
      
      {/* Top Banner Header */}
      <div className="bg-[#005A8C] rounded-[2rem] p-8 shadow-md relative overflow-hidden flex-shrink-0">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Register Sensor Nodes</h1>
            <p className="text-[#009B9E] font-bold text-sm tracking-widest uppercase mt-1">
              Hardware Provisioning
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Workspace */}
      <div className="flex-1 h-full min-h-[600px]">
        <RegisterSensorManager />
      </div>
      
    </div>
  );
}