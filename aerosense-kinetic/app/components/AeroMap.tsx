// src/components/AeroMap.tsx
"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axiosInstance from "../api/axiosInstance";

interface ClusterAverageDTO {
  centerLat: number;
  centerLon: number;
  avgPm25: number;
  avgPm10: number;
  sensorCount: number;
}

interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// Dynamically generate the icon based on status AND cluster size
const createCustomIcon = (status: "good" | "warning", count: number) => {
  const color = status === "good" ? "#009B9E" : "#F28C28";
  
  // Make the dot bigger if it represents multiple sensors
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
      box-shadow: 0 4px 10px rgba(0,0,0,0.15), 0 0 15px ${color}40;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease-in-out;
    ">${innerText}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const determineStatus = (pm25: number): "good" | "warning" => {
  return pm25 > 35.0 ? "warning" : "good";
};

// The invisible tracker that sends dynamic bounds to your friend's grid logic
function MapViewportTracker({ onBoundsChange }: { onBoundsChange: (bounds: ViewportBounds) => void }) {
  const map = useMapEvents({
    moveend() {
      const bounds = map.getBounds();
      onBoundsChange({
        minLat: bounds.getSouthWest().lat,
        maxLat: bounds.getNorthEast().lat,
        minLon: bounds.getSouthWest().lng,
        maxLon: bounds.getNorthEast().lng,
      });
    },
  });

  useEffect(() => {
    const initialBounds = map.getBounds();
    onBoundsChange({
      minLat: initialBounds.getSouthWest().lat,
      maxLat: initialBounds.getNorthEast().lat,
      minLon: initialBounds.getSouthWest().lng,
      maxLon: initialBounds.getNorthEast().lng,
    });
  }, [map, onBoundsChange]);

  return null;
}

export default function AeroMap() {
  const [clusters, setClusters] = useState<ClusterAverageDTO[]>([]);
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);

  useEffect(() => {
    if (!bounds) return;

    const fetchClusterData = async () => {
      try {
        // Hits: GET /api/sensors/area/cluster
        const response = await axiosInstance.get<ClusterAverageDTO[]>("/sensors/area/cluster", {
          params: {
            minLat: bounds.minLat,
            maxLat: bounds.maxLat,
            minLon: bounds.minLon,
            maxLon: bounds.maxLon,
            rows: 12, // Sends a 12x12 grid resolution to the backend
            cols: 12,
          },
        });
        setClusters(response.data);
      } catch (error) {
        console.error("Failed to fetch sensor clusters:", error);
      }
    };

    fetchClusterData();
  }, [bounds]);

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-lg border border-gray-200 z-0">
      <MapContainer
        center={[16.0, 106.0]} 
        zoom={6}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        maxBounds={[[8.0, 102.0], [24.0, 110.0]]}
        minZoom={5}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">carto.com</a>'
        />

        <MapViewportTracker onBoundsChange={setBounds} />

        {clusters.map((cluster, index) => {
          const status = determineStatus(cluster.avgPm25);
          const isCluster = cluster.sensorCount > 1;
          
          return (
            <Marker
              key={`cluster-${cluster.centerLat}-${cluster.centerLon}-${index}`} 
              position={[cluster.centerLat, cluster.centerLon]}
              icon={createCustomIcon(status, cluster.sensorCount)}
            >
              <Popup className="rounded-xl font-sans">
                <div>
                  <h3 className="font-bold text-[#005A8C]">
                    {isCluster ? "Regional Cluster" : "Live Sensor Node"}
                  </h3>
                  
                  {isCluster && (
                    <p className="text-xs text-gray-500 mb-2">
                      Sensors merged: {cluster.sensorCount}
                    </p>
                  )}
                  
                  <div className={`space-y-1 ${!isCluster ? "mt-2" : ""}`}>
                    <p className="text-sm">
                      {isCluster ? "Avg PM2.5:" : "PM2.5 Level:"} <span className="font-bold">{cluster.avgPm25} µg/m³</span>
                    </p>
                    <p className="text-sm">
                      {isCluster ? "Avg PM10:" : "PM10 Level:"} <span className="font-bold">{cluster.avgPm10} µg/m³</span>
                    </p>
                  </div>
                  
                  <p className={`text-xs mt-2 font-bold ${status === "good" ? "text-[#009B9E]" : "text-[#F28C28]"}`}>
                    {status === "good" ? "● Within Safe Limits" : "● Attention Required"}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}