import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface ConflictZone {
  name: string;
  lat: number;
  lng: number;
  severity: "active_war" | "high_tension" | "monitoring";
  region: string;
  countries?: string[];
}

interface CyberThreat {
  cveId?: string;
  title?: string;
  severity?: string;
}

interface OsirisIntelMapProps {
  conflictZones?: ConflictZone[];
  cyberThreats?: CyberThreat[];
  className?: string;
  style?: React.CSSProperties;
}

// Static conflict zone data (when API is not available)
const DEFAULT_CONFLICTS: ConflictZone[] = [
  { name: "Ukraine-Russia", lat: 48.5, lng: 35.5, severity: "active_war", region: "Eastern Europe", countries: ["Ukraine", "Russia"] },
  { name: "Gaza-Israel", lat: 31.4, lng: 34.4, severity: "active_war", region: "Middle East", countries: ["Palestine", "Israel"] },
  { name: "Sudan Civil War", lat: 15.6, lng: 32.5, severity: "active_war", region: "East Africa", countries: ["Sudan"] },
  { name: "Myanmar Conflict", lat: 19.8, lng: 96.2, severity: "active_war", region: "Southeast Asia", countries: ["Myanmar"] },
  { name: "Yemen - Houthi", lat: 15.4, lng: 44.2, severity: "high_tension", region: "Arabian Peninsula", countries: ["Yemen"] },
  { name: "Somalia - Al-Shabaab", lat: 2.0, lng: 45.3, severity: "active_war", region: "East Africa", countries: ["Somalia"] },
  { name: "DRC Eastern Conflict", lat: -1.7, lng: 29.2, severity: "active_war", region: "Central Africa", countries: ["DR Congo"] },
  { name: "Syria", lat: 35.0, lng: 38.0, severity: "high_tension", region: "Middle East", countries: ["Syria"] },
  { name: "Haiti Gang Violence", lat: 18.5, lng: -72.3, severity: "high_tension", region: "Caribbean", countries: ["Haiti"] },
  { name: "Sahel Insurgency", lat: 14.5, lng: 1.0, severity: "high_tension", region: "West Africa", countries: ["Mali", "Burkina Faso", "Niger"] },
  { name: "Ethiopia - Amhara", lat: 11.5, lng: 38.0, severity: "monitoring", region: "East Africa", countries: ["Ethiopia"] },
  { name: "Pakistan - Balochistan", lat: 28.5, lng: 65.5, severity: "monitoring", region: "South Asia", countries: ["Pakistan"] },
  { name: "Taiwan Strait", lat: 24.5, lng: 119.5, severity: "monitoring", region: "East Asia", countries: ["Taiwan", "China"] },
];

// Major maritime chokepoints
const MARITIME_CHOKEPOINTS = [
  { name: "Strait of Hormuz", lat: 26.6, lng: 56.3 },
  { name: "Bab el-Mandeb", lat: 12.6, lng: 43.3 },
  { name: "Suez Canal", lat: 30.5, lng: 32.3 },
  { name: "Strait of Malacca", lat: 2.5, lng: 101.5 },
  { name: "Panama Canal", lat: 9.1, lng: -79.7 },
  { name: "Strait of Gibraltar", lat: 35.9, lng: -5.6 },
  { name: "Turkish Straits", lat: 41.0, lng: 29.0 },
  { name: "Cape of Good Hope", lat: -34.4, lng: 18.5 },
  { name: "English Channel", lat: 50.5, lng: 0.5 },
  { name: "Danish Straits", lat: 55.8, lng: 11.0 },
];

// Simulated aviation clusters
const AVIATION_HOTSPOTS = [
  { lat: 51.5, lng: -0.1, name: "London Hub", flights: 342 },
  { lat: 40.7, lng: -74.0, name: "NYC Hub", flights: 289 },
  { lat: 25.3, lng: 55.3, name: "Dubai Hub", flights: 256 },
  { lat: 1.4, lng: 103.8, name: "Singapore Hub", flights: 198 },
  { lat: 35.7, lng: 139.7, name: "Tokyo Hub", flights: 176 },
  { lat: 33.9, lng: -118.4, name: "LAX Hub", flights: 214 },
  { lat: 50.0, lng: 8.6, name: "Frankfurt Hub", flights: 167 },
  { lat: 6.5, lng: 3.4, name: "Lagos Hub", flights: 89 },
];

export function OsirisIntelMap({ conflictZones, className, style }: OsirisIntelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const zones = conflictZones?.length ? conflictZones : DEFAULT_CONFLICTS;

  // Create dot image for map markers
  const createDot = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    // Add glow
    ctx.shadowBlur = 4;
    ctx.shadowColor = color;
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  // Create plane icon
  const createPlane = useCallback((map: maplibregl.Map, id: string, color: string) => {
    if (map.hasImage(id)) return;
    const size = 20;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    const cx = size / 2, cy = size / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.4);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
    ctx.closePath();
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [20, 20],
      zoom: 2.2,
      minZoom: 1.5,
      maxZoom: 18,
      attributionControl: false,
      maxPitch: 60,
    });

    map.on("load", () => {
      mapRef.current = map;

      // Create marker images
      createDot(map, "dot-red", "#EF4444", 12);
      createDot(map, "dot-orange", "#F97316", 10);
      createDot(map, "dot-yellow", "#EAB308", 8);
      createDot(map, "dot-blue", "#3B82F6", 8);
      createDot(map, "dot-cyan", "#06B6D4", 6);
      createPlane(map, "plane-cyan", "#00E5FF");

      // Add conflict zones source
      const conflictFeatures = zones.map((z) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [z.lng, z.lat] },
        properties: { name: z.name, severity: z.severity, region: z.region },
      }));

      map.addSource("conflicts", {
        type: "geojson",
        data: { type: "FeatureCollection", features: conflictFeatures },
      });

      // Conflict zone pulse circles
      map.addLayer({
        id: "conflicts-pulse",
        type: "circle",
        source: "conflicts",
        paint: {
          "circle-radius": ["case", ["==", ["get", "severity"], "active_war"], 20, 14],
          "circle-color": ["case", ["==", ["get", "severity"], "active_war"], "#EF4444", ["==", ["get", "severity"], "high_tension"], "#F97316", "#EAB308"],
          "circle-opacity": 0.15,
          "circle-stroke-width": 1,
          "circle-stroke-color": ["case", ["==", ["get", "severity"], "active_war"], "#EF4444", "#F97316"],
          "circle-stroke-opacity": 0.4,
        },
      });

      // Conflict zone core dots
      map.addLayer({
        id: "conflicts-core",
        type: "circle",
        source: "conflicts",
        paint: {
          "circle-radius": ["case", ["==", ["get", "severity"], "active_war"], 6, 4],
          "circle-color": ["case", ["==", ["get", "severity"], "active_war"], "#EF4444", ["==", ["get", "severity"], "high_tension"], "#F97316", "#EAB308"],
          "circle-opacity": 0.9,
        },
      });

      // Maritime chokepoints
      const maritimeFeatures = MARITIME_CHOKEPOINTS.map((m) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [m.lng, m.lat] },
        properties: { name: m.name },
      }));

      map.addSource("maritime", {
        type: "geojson",
        data: { type: "FeatureCollection", features: maritimeFeatures },
      });

      map.addLayer({
        id: "maritime-dots",
        type: "circle",
        source: "maritime",
        paint: {
          "circle-radius": 4,
          "circle-color": "#06B6D4",
          "circle-opacity": 0.8,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#06B6D4",
          "circle-stroke-opacity": 0.4,
        },
      });

      // Aviation hotspots
      const aviationFeatures = AVIATION_HOTSPOTS.map((a) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] },
        properties: { name: a.name, flights: a.flights },
      }));

      map.addSource("aviation", {
        type: "geojson",
        data: { type: "FeatureCollection", features: aviationFeatures },
      });

      map.addLayer({
        id: "aviation-heatzone",
        type: "circle",
        source: "aviation",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "flights"], 80, 12, 350, 28],
          "circle-color": "#00E5FF",
          "circle-opacity": 0.08,
        },
      });

      map.addLayer({
        id: "aviation-dots",
        type: "circle",
        source: "aviation",
        paint: {
          "circle-radius": 3,
          "circle-color": "#00E5FF",
          "circle-opacity": 0.9,
        },
      });

      // Popups on click
      map.on("click", "conflicts-core", (e) => {
        const props = e.features?.[0]?.properties;
        if (props) {
          new maplibregl.Popup({ closeButton: false, className: "osiris-popup" })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="color:#fff;font-size:12px;padding:4px"><strong>${props.name}</strong><br/><span style="opacity:0.7">${props.region} — ${props.severity.replace("_", " ").toUpperCase()}</span></div>`)
            .addTo(map);
        }
      });

      map.on("click", "maritime-dots", (e) => {
        const props = e.features?.[0]?.properties;
        if (props) {
          new maplibregl.Popup({ closeButton: false, className: "osiris-popup" })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="color:#fff;font-size:12px;padding:4px"><strong>${props.name}</strong><br/><span style="opacity:0.7">Maritime Chokepoint</span></div>`)
            .addTo(map);
        }
      });

      // Cursor changes
      map.on("mouseenter", "conflicts-core", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "conflicts-core", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "maritime-dots", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "maritime-dots", () => { map.getCanvas().style.cursor = ""; });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [zones, createDot, createPlane]);

  return (
    <div className={className} style={style}>
      <div ref={containerRef} className="w-full h-full rounded-lg" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="animate-pulse text-muted-foreground text-sm">Loading intelligence map...</div>
        </div>
      )}
      <style>{`
        .osiris-popup .maplibregl-popup-content {
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(100, 116, 139, 0.3);
          border-radius: 6px;
          padding: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .osiris-popup .maplibregl-popup-tip {
          border-top-color: rgba(15, 23, 42, 0.95);
        }
      `}</style>
    </div>
  );
}
