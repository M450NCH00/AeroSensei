// src/components/AeroMap.tsx
"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axiosInstance from "../api/axiosInstance";

interface ClusterMaxDTO {
  siteName: string;
  centerLat: number;
  centerLon: number;
  maxAvgPm25: number;
  maxAvgPm10: number;
  maxPeakPm25: number;
  maxPeakPm10: number;
  siteCount: number;
  state: "SAFE" | "WARNING" | "BREACHED";
  breachType: "NONE" | "PM2_5" | "PM10" | "MULTIPLE";
}

interface MapViewState {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  zoom: number; 
}

// --- THE FANCY UPGRADE: Animated Sonar Pings ---
const createCustomIcon = (state: "SAFE" | "WARNING" | "BREACHED", count: number) => {
  let innerColor = "#009B9E"; // Teal
  let outerAnimation = "animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] bg-[#009B9E]/50"; 
  let glowShadow = "rgba(0,155,158,0.4)";

  if (state === "WARNING") {
    innerColor = "#F28C28"; // Amber
    outerAnimation = "animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] bg-[#F28C28]/60";
    glowShadow = "rgba(242,140,40,0.6)";
  } else if (state === "BREACHED") {
    innerColor = "#E63946"; // Red
    outerAnimation = "animate-[ping_1s_cubic-bezier(0,0,0.2,1)_infinite] bg-[#E63946]/70";
    glowShadow = "rgba(230,57,70,0.8)";
  }

  const isCluster = count > 1;
  const innerText = isCluster ? `<span style="color: white; font-size: 10px; font-weight: 900; z-index: 10;">${count}</span>` : "";
  const sizeClass = isCluster ? "w-5 h-5" : "w-3.5 h-3.5"; // Slightly larger core for clusters

  // Injecting Tailwind animations directly into the Leaflet DOM!
  const html = `
    <div class="relative flex items-center justify-center w-10 h-10">
      <span class="absolute inline-flex w-full h-full rounded-full ${outerAnimation}"></span>
      <span class="relative flex items-center justify-center rounded-full ${sizeClass} border-2 border-white" 
            style="background-color: ${innerColor}; box-shadow: 0 0 15px ${glowShadow}, inset 0 0 4px rgba(0,0,0,0.3);">
        ${innerText}
      </span>
    </div>
  `;

  return L.divIcon({
    className: "custom-leaflet-icon", // Targets the CSS we will add below
    html,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

function MapViewportTracker({ onMapChange }: { onMapChange: (state: MapViewState) => void }) {
  const map = useMapEvents({
    moveend() {
      const bounds = map.getBounds().pad(0.1);
      onMapChange({
        minLat: bounds.getSouthWest().lat,
        maxLat: bounds.getNorthEast().lat,
        minLon: bounds.getSouthWest().lng,
        maxLon: bounds.getNorthEast().lng,
        zoom: map.getZoom(), 
      });
    },
  });

  useEffect(() => {
    const initialBounds = map.getBounds().pad(0.1);
    onMapChange({
      minLat: initialBounds.getSouthWest().lat,
      maxLat: initialBounds.getNorthEast().lat,
      minLon: initialBounds.getSouthWest().lng,
      maxLon: initialBounds.getNorthEast().lng,
      zoom: map.getZoom(), 
    });
  }, [map, onMapChange]);

  return null;
}

export default function AeroMap() {
  const [clusters, setClusters] = useState<ClusterMaxDTO[]>([]);
  const [mapState, setMapState] = useState<MapViewState | null>(null);

  useEffect(() => {
    if (!mapState) return;

    const fetchClusterData = async () => {
      try {
        const response = await axiosInstance.get<ClusterMaxDTO[]>("/sensors/area/cluster", {
          params: {
            minLat: mapState.minLat,
            maxLat: mapState.maxLat,
            minLon: mapState.minLon,
            maxLon: mapState.maxLon,
            zoom: mapState.zoom,
          },
        });
        setClusters(response.data);
      } catch (error) {
        console.error("Failed to fetch sensor clusters:", error);
      }
    };

    fetchClusterData();
  }, [mapState]);

  return (
    <div className="w-full h-full rounded-[1.5rem] overflow-hidden z-0 bg-[#F8FAFC]">
      <MapContainer
        center={[16.0, 106.0]} 
        zoom={6}
        style={{ height: "100%", width: "100%", zIndex: 0, background: "transparent" }}
        maxBounds={[[2.0, 102.0], [36.5, 110.0]]}
        minZoom={5}
        zoomControl={false} // Hide default zoom buttons for a cleaner look
      >
        {/* Sleek Light Gray Map Layer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        />

        <MapViewportTracker onMapChange={setMapState} />

        {clusters.map((cluster, index) => {
          const isCluster = cluster.siteCount > 1;
          
          let statusTextColor = "text-[#009B9E]";
          if (cluster.state === "WARNING") statusTextColor = "text-[#F28C28]";
          if (cluster.state === "BREACHED") statusTextColor = "text-[#E63946]";
          
          return (
            <Marker
              key={`cluster-${cluster.centerLat}-${cluster.centerLon}-${index}`} 
              position={[cluster.centerLat, cluster.centerLon]}
              icon={createCustomIcon(cluster.state, cluster.siteCount)}
            >
              <Popup autoPan={false} className="custom-popup min-w-[250px]">
                <div className="p-1 flex flex-col h-full font-sans">
                  
                  <div className="mb-3 border-b border-gray-100 pb-2">
                    <h3 className="font-bold text-[#005A8C] text-sm leading-tight">
                      {cluster.siteName}
                    </h3>
                    {isCluster && (
                      <span className="inline-block mt-1 bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md font-semibold tracking-wide">
                        {cluster.siteCount} SITES AGGREGATED
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="bg-gray-50/80 p-2 rounded-md border border-gray-100/50">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">15m Avg</p>
                      <p className="text-xs">PM2.5: <span className="font-bold text-gray-800">{cluster.maxAvgPm25}</span></p>
                      <p className="text-xs mt-0.5">PM10: <span className="font-bold text-gray-800">{cluster.maxAvgPm10}</span></p>
                    </div>
                    <div className="bg-gray-50/80 p-2 rounded-md border border-gray-100/50">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Max Peak</p>
                      <p className="text-xs">PM2.5: <span className="font-bold text-gray-800">{cluster.maxPeakPm25}</span></p>
                      <p className="text-xs mt-0.5">PM10: <span className="font-bold text-gray-800">{cluster.maxPeakPm10}</span></p>
                    </div>
                  </div>
                  
                  <div className="mt-1 pt-2 border-t border-gray-100 flex flex-col gap-2.5">
                    <div className={`text-xs font-bold ${statusTextColor}`}>
                      {cluster.state === "SAFE" && "● Within Safe Limits"}
                      {cluster.state === "WARNING" && `● Attention Required (${cluster.breachType.replace('_', '.')})`}
                      {cluster.state === "BREACHED" && `● Critical Breach (${cluster.breachType.replace('_', '.')})`}
                    </div>

                    {!isCluster && (
                      <Link 
                        href={`/dashboard/sites?lat=${cluster.centerLat}&lon=${cluster.centerLon}`} 
                        className="text-[#005A8C] hover:text-[#004266] text-[11px] font-black uppercase tracking-wider transition-colors flex items-center justify-start gap-1 group w-full mt-1"
                      >
                        Go to site summary
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                          <path d="M7 7h10v10" />
                          <path d="M7 17 17 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                  
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}