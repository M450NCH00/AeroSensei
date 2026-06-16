// src/components/MacroDigest.tsx
import { Layers } from "lucide-react";

export default function MacroDigest() {
  return (
    <div>
      <h2 className="font-black text-base text-gray-800 mb-3 flex items-center gap-2 tracking-tight">
        <Layers size={18} className="text-[#005A8C]" />
        Macro Station Digest
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Sites</p>
          <p className="text-xl font-black text-[#005A8C] mt-0.5">24</p>
        </div>
        <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-center">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Breaches</p>
          <p className="text-xl font-black text-red-600 mt-0.5">2</p>
        </div>
        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-center">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Warnings</p>
          <p className="text-xl font-black text-[#F28C28] mt-0.5">1</p>
        </div>
      </div>
    </div>
  );
}