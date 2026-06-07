// src/components/AeroMap.tsx
"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Create a custom glowing dot for your sensors using your brand colors
const createCustomIcon = (status: "good" | "warning") => {
  const color = status === "good" ? "#009B9E" : "#F28C28";
  return L.divIcon({
    className: "custom-icon",
    html: `<div style="
      width: 20px; 
      height: 20px; 
      background-color: ${color}; 
      border-radius: 50%; 
      border: 3px solid white;
      box-shadow: 0 0 15px ${color};
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Mock data: We will replace this with your AWS DB data later!
const mockSensors = [
  { id: 1, name: "Hanoi Central Station", lat: 21.0285, lng: 105.8542, aqi: 42, status: "good" as const },
  { id: 2, name: "Da Nang Industrial Zone", lat: 16.0471, lng: 108.2068, aqi: 115, status: "warning" as const },
  { id: 3, name: "Ho Chi Minh District 1", lat: 10.8231, lng: 106.6297, aqi: 38, status: "good" as const },
];

export default function AeroMap() {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-lg border border-gray-200">
      <MapContainer 
        center={[16.0, 106.0]} // Dead center of Vietnam
        zoom={6} 
        style={{ height: "100%", width: "100%" }}
        // These bounds lock the user from scrolling too far away from Vietnam!
        maxBounds={[[8.0, 102.0], [24.0, 110.0]]}
        minZoom={5}
      >
        {/* This TileLayer gives the map a premium, minimal light-mode look */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">carto.com</a>'
        />

        {/* Map through your sensors and plot them */}
        {mockSensors.map((sensor) => (
          <Marker 
            key={sensor.id} 
            position={[sensor.lat, sensor.lng]} 
            icon={createCustomIcon(sensor.status)}
          >
            <Popup className="rounded-xl">
              <div className="font-sans">
                <h3 className="font-bold text-[#005A8C]">{sensor.name}</h3>
                <p className="text-sm mt-1">
                  Current AQI: <span className="font-bold">{sensor.aqi}</span>
                </p>
                <p className={`text-xs mt-1 font-bold ${sensor.status === "good" ? "text-[#009B9E]" : "text-[#F28C28]"}`}>
                  {sensor.status === "good" ? "● Normal" : "● Attention Required"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}