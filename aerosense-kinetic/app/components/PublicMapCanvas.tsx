"use client";

import { useEffect, useState } from "react";
import { 
  MapContainer, 
  TileLayer, 
  CircleMarker, 
  useMap,
  useMapEvents,
  Polygon, 
  Pane,
  Popup,
  Rectangle
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface SiteSensor15MinDTO {
  companyName: string;
  siteName: string;
  siteId: number;
  latitude: number;
  longitude: number;
  avgPm25: number;
  avgPm10: number;
  maxPm25: number;
  maxPm10: number;
  breachType: "NONE" | "PM2_5" | "PM10" | "MULTIPLE";
  state: "SAFE" | "WARNING" | "BREACHED";
  lastCalculated: string;
}

interface PublicMapCanvasProps {
  sites: SiteSensor15MinDTO[];
  targetCoords: [number, number] | null;
}

// 1. New Component to handle Map Clicks
function MapClickEvents({ onPinDrop }: { onPinDrop: (coords: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onPinDrop([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// 2. Controller to handle flying to coordinates (Target or Search)
function MapController({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 12, { duration: 1.5, easeLinearity: 0.25 });
    }
  }, [targetCoords, map]);
  return null;
}

const getNodeColor = (pm25: number) => {
  // If it's safe, we return transparent because the whole country is already green!
  if (pm25 <= 12) return "transparent"; 
  if (pm25 <= 35) return "#FBBF24"; // Amber/Warning
  if (pm25 <= 55) return "#F97316"; // Orange
  if (pm25 <= 150) return "#EF4444"; // Red/Breached
  return "#8B5CF6"; // Purple
};

export default function PublicMapCanvas({ sites, targetCoords }: PublicMapCanvasProps) {
  const [maskCoords, setMaskCoords] = useState<any[]>([]);
  const [pinnedLocation, setPinnedLocation] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Fetch Vietnam borders for the mask
  useEffect(() => {
    const fetchVietnamBorders = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/vietnam.geojson"
        );
        const geojsonData = await response.json();

        const worldBounds: [number, number][] = [
          [90, -180], [90, 180], [-90, 180], [-90, -180],
        ];

        const geometry = geojsonData.geometry || (geojsonData.features && geojsonData.features[0].geometry);
        const holes: [number, number][][] = [];

        if (geometry.type === "Polygon") {
          const ring = geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]);
          holes.push(ring as [number, number][]);
        } else if (geometry.type === "MultiPolygon") {
          geometry.coordinates.forEach((polygon: any) => {
            const ring = polygon[0].map((coord: number[]) => [coord[1], coord[0]]);
            holes.push(ring as [number, number][]);
          });
        }

        setMaskCoords([worldBounds, ...holes]);
      } catch (error) {
        console.error("Failed to load Vietnam borders", error);
      }
    };
    fetchVietnamBorders();
  }, []);

  // Handle Address Search using OpenStreetMap's free Geocoding API
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // Restrict search to Vietnam (countrycodes=vn) for better accuracy
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=vn`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setPinnedLocation([lat, lon]);
      } else {
        alert("Address not found in Vietnam. Try being more specific.");
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  // The Mock API Call function for your Forecast
  const handleForecastApiCall = () => {
    if (!pinnedLocation) return;
    alert(`Calling Forecast API for coordinates: \nLat: ${pinnedLocation[0].toFixed(4)}\nLng: ${pinnedLocation[1].toFixed(4)}`);
    // TODO: Implement your actual API fetch here!
  };

  return (
    <div className="w-full h-full relative bg-[#F8FAFC]">
      
      {/* --- FLOATING SEARCH BAR --- */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4">
        <form onSubmit={handleSearch} className="flex shadow-lg rounded-full overflow-hidden border border-gray-200 bg-white">
          <input 
            type="text" 
            placeholder="Search an address in Vietnam..." 
            className="flex-grow px-6 py-3 outline-none text-gray-700 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={isSearching}
            className="bg-[#005A8C] text-white px-6 py-3 font-bold text-sm hover:bg-[#004266] transition-colors disabled:opacity-50"
          >
            {isSearching ? "..." : "Search"}
          </button>
        </form>
      </div>
      {/* --------------------------- */}

      <MapContainer 
        center={[16.0470, 108.2062]} 
        zoom={6} 
        minZoom={3}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%", background: "transparent" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          noWrap={true}
        />

        <MapClickEvents onPinDrop={setPinnedLocation} />
        {/* We pass pinnedLocation as the targetCoords so the map flies to the newly dropped pin */}
        <MapController targetCoords={pinnedLocation || targetCoords} />

        {/* THE HEATMAP PANE */}
        <Pane name="blendedHeatmapPane" style={{ zIndex: 500 }} className="blended-heatmap-wrapper">
          
          {/* 1. THE DEFAULT GREEN BACKGROUND 
              A giant rectangle covering the world. The mask will hide it everywhere outside Vietnam.
          */}
          <Rectangle 
            bounds={[[-90, -180], [90, 180]]} 
            pathOptions={{ fillColor: '#A7F3D0', fillOpacity: 0.8, stroke: false }} // Soft Emerald Green
          />

          {/* 2. THE SENSOR BLOBS (Only rendering Warning/Breached) */}
          {sites.map((site) => {
            if (!site.latitude || !site.longitude) return null;
            const nodeColor = getNodeColor(site.avgPm25 || 0);
            if (nodeColor === "transparent") return null;

            return (
              <CircleMarker
                key={site.siteId}
                center={[site.latitude, site.longitude]}
                radius={45} // Slightly larger to create a nice fade over the green base
                stroke={false}
                interactive={false} // Disabled clicking on sensors directly
                pathOptions={{
                  fillColor: nodeColor,
                  fillOpacity: 0.6, // Tweak this to make the colors punchier
                }}
                className="heatmap-node"
              />
            );
          })}

          {/* 3. THE WHITE MASK (Erases the green rectangle and bleeds outside Vietnam) */}
          {maskCoords.length > 0 && (
            <Polygon 
              positions={maskCoords} 
              interactive={false} 
              pathOptions={{ 
                fillColor: '#FFFFFF', 
                fillOpacity: 1,       
                stroke: false         
              }} 
            />
          )}
        </Pane>

        {/* --- THE DROPPED PIN LAYER --- 
            Rendered in a separate default pane so it isn't blurred or multiplied!
        */}
        {pinnedLocation && (
          <CircleMarker 
            center={pinnedLocation}
            radius={8}
            pathOptions={{ fillColor: '#2563EB', color: '#FFFFFF', weight: 2, fillOpacity: 1 }}
          >
            <Popup className="forecast-popup rounded-xl shadow-lg">
              <div className="p-1 text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Location Selected</p>
                <button 
                  onClick={handleForecastApiCall}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:shadow-md transition-all active:scale-95 text-sm w-full"
                >
                  Get Air Quality Forecast
                </button>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      <style dangerouslySetInnerHTML={{__html: `
        .blended-heatmap-wrapper {
          mix-blend-mode: multiply;
          isolation: isolate;
        }

        .heatmap-node {
          filter: blur(20px); /* Increased blur slightly for a softer fade over the green */
          mix-blend-mode: multiply; 
        }

        /* Clean up standard Leaflet popup styling */
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 4px;
        }
        .leaflet-popup-content {
          margin: 10px;
        }
      `}} />
    </div>
  );
}