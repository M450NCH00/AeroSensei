import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { Search } from 'lucide-react';

interface SearchProps {
  onSearchResult: (lat: number, lng: number, label: string) => void;
}

export default function MapSearch({ onSearchResult }: SearchProps) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        
        map.flyTo([latitude, longitude], 12, { duration: 1.5 });
        onSearchResult(latitude, longitude, display_name);
      } else {
        alert("Location not found.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSearch} 
      className="flex items-center gap-2 bg-white/70 backdrop-blur-3xl border border-white/80 p-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,90,140,0.1)] transition-shadow duration-300"
    >
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search district or address..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/50 text-[#005A8C] font-semibold text-sm border-none rounded-xl focus:ring-4 focus:ring-[#009B9E]/20 focus:bg-white placeholder-gray-400 outline-none transition-all duration-300"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 bg-[#005A8C] text-white text-sm font-bold rounded-xl hover:bg-[#009B9E] hover:shadow-[0_4px_20px_rgba(0,155,158,0.4)] transition-all duration-300 active:scale-95 disabled:opacity-70 shrink-0"
      >
        {loading ? '...' : 'Locate'}
      </button>
    </form>
  );
}