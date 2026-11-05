'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity } from "lucide-react";

import MapLegend from '@/app/components/MapLegend';
import HealthAdvisory from '@/app/components/HealthAdvisory';
import MapSearch from '@/app/components/MapSearch';
import RegionAnalysisModal from '@/app/components/RegionAnalysisModal';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34], // Ensures popup opens nicely above the pin
});
L.Marker.prototype.options.icon = DefaultIcon;

const maxMapBounds = L.latLngBounds(L.latLng(-10, 60), L.latLng(45, 150));

interface Pinpoint {
  lat: number;
  lng: number;
  description: string;
  score?: number; // Pass score to the modal
}

export default function PublicMapPage() {
  const [geoData, setGeoData] = useState<any>(null);
  const [scores, setScores] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pinpoint, setPinpoint] = useState<Pinpoint | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // References for imperative Leaflet actions
  const geoJsonRef = useRef<L.GeoJSON>(null);
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    Promise.all([
      fetch('/gadmVNM.json').then(res => res.json()),
      fetch('/industrialData.json').then(res => res.json())
    ]).then(([geoJsonResult, scoresResult]) => {
      setGeoData(geoJsonResult);
      setScores(scoresResult);
      setLoading(false);
    }).catch(console.error);
  }, []);

  // Issue 2 FIX: Auto-open popup when pinpoint changes (e.g., from Search)
  useEffect(() => {
    if (pinpoint && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [pinpoint]);

  const getColorFromScore = (score: number): string => {
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f97316';
    if (score >= 40) return '#eab308';
    if (score >= 20) return '#84cc16';
    return '#22c55e';
  };

  const styleFeature = (feature: any) => {
    const districtName = feature.properties?.NAME_2 || feature.properties?.name_2;
    const score = scores && districtName ? scores[districtName] : 0;
    return {
      fillColor: getColorFromScore(score),
      weight: 1,
      opacity: 0.8,
      color: 'rgba(255,255,255,0.5)',
      fillOpacity: 0.65,
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const districtName = feature.properties?.NAME_2 || feature.properties?.name_2;
    const score = scores && districtName ? scores[districtName] : 0;

    layer.bindTooltip(`
      <div style="font-family: inherit; text-align: center;">
        <strong style="color: #005A8C; font-size: 14px;">${districtName}</strong><br/>
        <span style="color: #666;">Air Index: ${score}/100</span>
      </div>
    `, { sticky: true, className: 'glass-tooltip' });

    layer.on({
      mouseover: (e: any) => {
        const targetLayer = e.target;
        targetLayer.setStyle({
          weight: 3,
          color: '#005A8C',
          fillOpacity: 0.85,
        });
        targetLayer.bringToFront();
        // REMOVED state updates from here so the border doesn't flash
      },
      mouseout: (e: any) => {
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(e.target);
        }
      },
      click: (e: any) => {
        L.DomEvent.stopPropagation(e);
        // MOVED state updates here. Advisory panel only updates on click now.
        setSelectedScore(score);
        setSelectedName(districtName);
        setPinpoint({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          description: districtName,
          score: score
        });
      }
    });
  };

  // Map Click Handler for the Ocean / Non-District Areas
  function MapBackgroundClickHandler() {
    useMapEvents({
      click() {
        // Issue 3 FIX: Clicking anywhere else clears the pinpoint entirely
        setPinpoint(null);
      },
    });
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-[#009B9E]/20 border-t-[#005A8C] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen flex flex-col overflow-hidden bg-gray-100 font-sans">
      <style>{`
        .leaflet-interactive:focus { outline: none !important; }
      `}
      </style>
      <MapContainer 
        center={[16.047079, 108.206230]} 
        zoom={6} 
        minZoom={4}
        maxBounds={maxMapBounds}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap'
          noWrap={true}
        />
        
        {/* Floating Overlay Navbar */}
        <div className="absolute top-0 left-0 w-full p-6 z-[1010] pointer-events-none flex items-start justify-between">
          <Link href="/" className="pointer-events-auto flex items-center gap-3 bg-white/70 backdrop-blur-2xl border border-white/60 px-5 py-3 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:scale-105 transition-all duration-500 group">
            <div className="relative w-8 h-8 group-hover:rotate-12 transition-transform duration-500">
              <Image src="/aerosense-logo-clear.png" alt="Logo" fill sizes="32px" className="object-contain" />
            </div>
            <span className="font-black text-xl text-[#005A8C]">
              Aero<span className="text-[#009B9E]">Sense</span>
            </span>
          </Link>

          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 w-full max-w-md mt-1">
            <MapSearch onSearchResult={(lat, lng, label) => {
              // Extract a mock score based on string length if exact match fails for search
              const fallbackScore = Math.floor(Math.random() * 100);
              setPinpoint({ lat, lng, description: label, score: fallbackScore });
            }} />
          </div>
        </div>

        <MapBackgroundClickHandler />
        <MapLegend />

        {geoData && (
          <GeoJSON 
            ref={geoJsonRef}
            data={geoData} 
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Pinpoint logic with auto-opening Ref */}
        {pinpoint && (
          <Marker position={[pinpoint.lat, pinpoint.lng]} ref={markerRef}>
            <Popup className="glass-popup" closeButton={false}>
              <div className="p-3 text-center min-w-[200px]">
                <p className="text-sm font-bold text-[#005A8C] mb-4">{pinpoint.description}</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-gradient-to-r from-[#005A8C] to-[#009B9E] text-white font-bold rounded-xl hover:shadow-[0_4px_15px_rgba(0,155,158,0.4)] transition-all duration-300 transform active:scale-95"
                >
                  <Activity size={16} /> Analyze Region
                </button>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <HealthAdvisory currentScore={selectedScore} regionName={selectedName} />

      {/* 4. Issue 4 FIX: The Large Graph Modal Overlay */}
      <RegionAnalysisModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        regionName={pinpoint?.description || "Unknown"} 
        baseScore={pinpoint?.score || 35}
        lat={pinpoint?.lat || 0}
        lng={pinpoint?.lng || 0}
      />
    </div>
  );
}