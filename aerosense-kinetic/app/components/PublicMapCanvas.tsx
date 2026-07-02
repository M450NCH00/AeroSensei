"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
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
  onSiteClick: (site: SiteSensor15MinDTO) => void;
  targetCoords: [number, number] | null;
}

function MapController({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 12, { duration: 2, easeLinearity: 0.25 });
    }
  }, [targetCoords, map]);
  return null;
}

// Adjusted colors slightly for better "Multiply" blending on a bright white map
const getNodeColor = (pm25: number) => {
  if (pm25 <= 12) return "#10B981"; // Emerald
  if (pm25 <= 35) return "#FBBF24"; // Amber
  if (pm25 <= 55) return "#F97316"; // Orange
  if (pm25 <= 150) return "#EF4444"; // Red
  return "#8B5CF6"; // Purple
};

export default function PublicMapCanvas({ sites, onSiteClick, targetCoords }: PublicMapCanvasProps) {
  return (
    <div className="w-full h-full relative bg-[#F8FAFC]">
      <MapContainer 
        center={[16.0470, 108.2062]} 
        zoom={6} 
        // 1. FANCY UPGRADE: Prevent zooming out into the void
        minZoom={3}
        // 2. FANCY UPGRADE: Lock the camera so they can't scroll past the edge of the earth
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%", background: "transparent" }}
        zoomControl={false}
      >
        {/* 3. FANCY UPGRADE: Bright Mode Minimalist Tiles with noWrap to prevent duplication */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          noWrap={true}
        />

        <MapController targetCoords={targetCoords} />

        {sites.map((site) => {
          if (!site.latitude || !site.longitude) return null;
          
          const nodeColor = getNodeColor(site.avgPm25 || 0);

          return (
            <CircleMarker
              key={site.siteId}
              center={[site.latitude, site.longitude]}
              // Make the radius massive so it spreads like a heatmap
              radius={35}
              stroke={false}
              pathOptions={{
                fillColor: nodeColor,
                fillOpacity: 0.5,
              }}
              eventHandlers={{
                click: () => onSiteClick(site),
              }}
              // 4. FANCY UPGRADE: The Heatmap Magic! 
              // Blur creates the fading radius, Multiply blends overlapping colors perfectly.
              className="heatmap-node hover:scale-110 transition-transform duration-500 cursor-pointer"
            >
              <Tooltip 
                direction="top" 
                offset={[0, -20]} 
                opacity={1}
                className="!bg-white/80 !backdrop-blur-md !border-white/60 !text-gray-800 !font-bold !rounded-xl !shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
              >
                <div className="text-center px-1">
                  <p className="text-sm font-black text-[#005A8C]">{site.siteName}</p>
                  <p className="text-[10px] tracking-widest uppercase text-gray-500 mt-1">PM2.5: <span style={{ color: nodeColor }} className="font-black text-xs">{site.avgPm25}</span></p>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Global Style injected for the SVG blur and blending */}
      <style dangerouslySetInnerHTML={{__html: `
        .heatmap-node {
          filter: blur(15px);
          mix-blend-mode: multiply;
        }
      `}} />
    </div>
  );
}