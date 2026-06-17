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

// 1. UPDATED INTERFACE: Added 'zoom' to track the map's zoom level
interface MapViewState {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  zoom: number; 
}

const createCustomIcon = (status: "good" | "warning", count: number) => {
  const color = status === "good" ? "#009B9E" : "#F28C28";
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

// 2. UPDATED TRACKER: Captures map.getZoom() alongside the bounds
function MapViewportTracker({ onMapChange }: { onMapChange: (state: MapViewState) => void }) {
  const map = useMapEvents({
    moveend() {
      const bounds = map.getBounds().pad(0.1);
      onMapChange({
        minLat: bounds.getSouthWest().lat,
        maxLat: bounds.getNorthEast().lat,
        minLon: bounds.getSouthWest().lng,
        maxLon: bounds.getNorthEast().lng,
        zoom: map.getZoom(), // Captures current zoom level
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
      zoom: map.getZoom(), // Captures initial zoom level
    });
  }, [map, onMapChange]);

  return null;
}

export default function AeroMap() {
  const [clusters, setClusters] = useState<ClusterAverageDTO[]>([]);
  // Renamed from 'bounds' to 'mapState' since it now holds bounds + zoom
  const [mapState, setMapState] = useState<MapViewState | null>(null);

  useEffect(() => {
    if (!mapState) return;

    const fetchClusterData = async () => {
      try {
        // 3. UPDATED API CALL: Sends the zoom parameter instead of rows/cols
        const response = await axiosInstance.get<ClusterAverageDTO[]>("/sensors/area/cluster", {
          params: {
            minLat: mapState.minLat,
            maxLat: mapState.maxLat,
            minLon: mapState.minLon,
            maxLon: mapState.maxLon,
            zoom: mapState.zoom, // Sends the dynamic zoom level to backend
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
        maxBounds={[[8.0, 102.0], [24.0, 110.0]]}
        minZoom={5}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">carto.com</a>'
        />

        {/* Pass down the state setter */}
        <MapViewportTracker onMapChange={setMapState} />

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