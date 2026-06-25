// src/components/AeroMap.tsx
"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axiosInstance from "../api/axiosInstance";

// 1. UPDATED INTERFACE: Matches the new backend ClusterMaxDTO exactly
interface ClusterMaxDTO {
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

// 2. UPDATED ICON LOGIC: 3-Tier Color System
const createCustomIcon = (state: "SAFE" | "WARNING" | "BREACHED", count: number) => {
  let color = "#009B9E"; // Default Green for SAFE
  if (state === "WARNING") color = "#F28C28"; // Orange
  if (state === "BREACHED") color = "#E63946"; // Red
  
  const isCluster = count > 1;
  const size = isCluster ? 32 : 18; 
  const innerText = isCluster ? `<span style="color: white; font-size: 11px; font-weight: 900;">${count}</span>` : "";

  return L.divIcon({
    className: "custom-icon",
    html: `<div style="
      width: ${size}px; 
      height: ${size}px; 
      background-color: ${color}; 
      border-radius: 50%; 
      border: 3px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15), 0 0 15px ${color}60;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease-in-out;
    ">${innerText}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-lg border border-gray-200 z-0">
      <MapContainer
        center={[16.0, 106.0]} 
        zoom={6}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        maxBounds={[[2.0, 102.0], [36.5, 110.0]]}
        minZoom={5}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">carto.com</a>'
        />

        <MapViewportTracker onMapChange={setMapState} />

        {clusters.map((cluster, index) => {
          const isCluster = cluster.siteCount > 1;
          
          // Determine text color based on state
          let statusTextColor = "text-[#009B9E]";
          if (cluster.state === "WARNING") statusTextColor = "text-[#F28C28]";
          if (cluster.state === "BREACHED") statusTextColor = "text-[#E63946]";
          
          return (
            <Marker
              key={`cluster-${cluster.centerLat}-${cluster.centerLon}-${index}`} 
              position={[cluster.centerLat, cluster.centerLon]}
              icon={createCustomIcon(cluster.state, cluster.siteCount)}
            >
              <Popup autoPan={false} className="rounded-xl font-sans min-w-[250px]">
                <div className="p-1 flex flex-col h-full">
                  
                  {/* HEADER: Title and Dynamic Badge (Link Removed) */}
                  <div className="mb-3 border-b border-gray-100 pb-2">
                    <h3 className="font-bold text-[#005A8C] text-sm leading-tight">
                      {isCluster ? "Regional Area" : "Live Sensor Node"}
                    </h3>
                    {isCluster && (
                      <span className="inline-block mt-1 bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md font-semibold tracking-wide">
                        {cluster.siteCount} SITES AGGREGATED
                      </span>
                    )}
                  </div>
                  
                  {/* BODY: The Dual-Threshold Data Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="bg-gray-50 p-2 rounded-md border border-gray-100">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">15m Avg</p>
                      <p className="text-xs">PM2.5: <span className="font-bold text-gray-800">{cluster.maxAvgPm25}</span></p>
                      <p className="text-xs mt-0.5">PM10: <span className="font-bold text-gray-800">{cluster.maxAvgPm10}</span></p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-md border border-gray-100">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Max Peak</p>
                      <p className="text-xs">PM2.5: <span className="font-bold text-gray-800">{cluster.maxPeakPm25}</span></p>
                      <p className="text-xs mt-0.5">PM10: <span className="font-bold text-gray-800">{cluster.maxPeakPm10}</span></p>
                    </div>
                  </div>
                  
                  {/* FOOTER: Severity Status and Action Link */}
                  <div className="mt-1 pt-2 border-t border-gray-100 flex flex-col gap-2.5">
                    <div className={`text-xs font-bold ${statusTextColor}`}>
                      {cluster.state === "SAFE" && "● Within Safe Limits"}
                      {cluster.state === "WARNING" && `● Attention Required (${cluster.breachType.replace('_', '.')})`}
                      {cluster.state === "BREACHED" && `● Critical Breach (${cluster.breachType.replace('_', '.')})`}
                    </div>

                    {/* View Details Button (Only for single nodes, placed at bottom) */}
                    {!isCluster && (
                      <Link 
                        href={`/dashboard/sites?lat=${cluster.centerLat}&lon=${cluster.centerLon}`} 
                        className="text-[#005A8C] hover:text-[#004266] text-[11px] font-black uppercase tracking-wider transition-colors flex items-center justify-start gap-1 group w-full mt-1"
                      >
                        Go to site summary
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="12" 
                          height="12" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="3" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                        >
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