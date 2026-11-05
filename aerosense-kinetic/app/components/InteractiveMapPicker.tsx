// src/components/InteractiveMapPicker.tsx
"use client";

import { useEffect } from "react";
// 1. Import Tooltip from react-leaflet
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// The primary teal pin for the NEW site being registered
const newSiteIcon = L.divIcon({
  className: "custom-icon",
  html: `<div style="width: 24px; height: 24px; background-color: #009B9E; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// A secondary gray pin for EXISTING company sites
const existingSiteIcon = L.divIcon({
  className: "existing-icon",
  html: `<div style="width: 18px; height: 18px; background-color: #9CA3AF; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface Site {
  id: number;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
}

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
  existingSites?: Site[];
  showExistingSites?: boolean;
}

function ClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.flyTo([lat, lng], 14, { animate: true, duration: 1.5 });
    }
  }, [lat, lng, map]);
  return null;
}

export default function InteractiveMapPicker({ lat, lng, onLocationSelect, existingSites = [], showExistingSites = false }: MapPickerProps) {
  const defaultCenter: [number, number] = [16.0, 106.0];

  return (
    // Added 'isolate' and 'min-h-[350px]' to prevent Leaflet from bleeding out of the border-radius
    <div className="w-full min-h-[350px] flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-inner z-0 relative isolate">
      <MapContainer
        center={lat && lng ? [lat, lng] : defaultCenter}
        zoom={lat && lng ? 14 : 5}
        style={{ height: "100%", width: "100%", position: "absolute", inset: 0, zIndex: 0 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">carto.com</a>'
        />
        <ClickHandler onLocationSelect={onLocationSelect} />
        <MapRecenter lat={lat} lng={lng} />
        
        {/* Render Existing Sites if the checkbox is active */}
        {showExistingSites && existingSites.map(site => {
          if (site.latitude && site.longitude) {
            return (
              <Marker key={`site-${site.id}`} position={[site.latitude, site.longitude]} icon={existingSiteIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="font-bold text-gray-800">{site.siteName}</div>
                  <div className="text-[10px] font-semibold text-gray-500 mt-0.5">
                    {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                  </div>
                </Tooltip>
              </Marker>
            );
          }
          return null;
        })}

        {/* Render the NEW site being placed */}
        {lat && lng && <Marker position={[lat, lng]} icon={newSiteIcon} zIndexOffset={1000} />}
      </MapContainer>
    </div>
  );
}