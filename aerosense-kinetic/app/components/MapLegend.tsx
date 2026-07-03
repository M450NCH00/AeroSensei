import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function MapLegend() {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: 'bottomright' });

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      // Injecting glassmorphism styles directly into the Leaflet DOM element
      div.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
      div.style.backdropFilter = 'blur(16px)';
      div.style.border = '1px solid rgba(255, 255, 255, 0.6)';
      div.style.padding = '16px';
      div.style.borderRadius = '16px';
      div.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)';
      div.style.color = '#005A8C';
      div.style.fontFamily = 'inherit';

      const grades = [0, 20, 40, 60, 80];
      const colors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
      const labels = ['Clean', 'Good', 'Moderate', 'Unhealthy', 'Hazardous'];

      div.innerHTML = '<h4 style="margin:0 0 12px 0; font-weight:900; font-size:14px; letter-spacing:-0.5px;">Air Quality Index</h4>';

      for (let i = 0; i < grades.length; i++) {
        div.innerHTML += `
          <div style="display:flex; align-items:center; margin-bottom:6px;">
            <i style="background: ${colors[i]}; width: 14px; height: 14px; margin-right: 12px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></i> 
            <span style="font-size: 13px; font-weight: 600; color: #4B5563;">${labels[i]}</span>
          </div>
        `;
      }
      return div;
    };

    legend.addTo(map);
    return () => { legend.remove(); };
  }, [map]);

  return null;
}