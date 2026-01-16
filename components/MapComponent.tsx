
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { P2PQuakeData, JMASeismicIntensity, EEWState } from '../types';
import { STATION_COORDINATES } from '../constants/stationCoordinates';

interface Props {
  latestQuake: P2PQuakeData | null;
  eew: EEWState;
  isDebugMode?: boolean;
  isAutoZoomEnabled?: boolean;
}

const JAPAN_GEOJSON_URL = 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson';
const WORLD_GEOJSON_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';

// Approximate wave velocities in km/s
const V_P_WAVE = 6.5; 
const V_S_WAVE = 3.5;
// Earth radius approximation for degree conversion (1 deg approx 111km)
const KM_PER_DEG = 111.32;

export const MapComponent: React.FC<Props> = ({ latestQuake, eew, isDebugMode = false, isAutoZoomEnabled = true }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Data State
  const [japanGeoData, setJapanGeoData] = useState<any>(null);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);
  
  // Refs to persist D3 objects across renders
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const isAutoZoomRef = useRef(isAutoZoomEnabled);
  
  // Animation Ref
  const animationFrameRef = useRef<number | null>(null);

  // Keep ref updated
  useEffect(() => {
    isAutoZoomRef.current = isAutoZoomEnabled;
  }, [isAutoZoomEnabled]);

  // Load Map Data
  useEffect(() => {
    // Load Japan Map
    fetch(JAPAN_GEOJSON_URL)
      .then(res => res.json())
      .then(data => setJapanGeoData(data))
      .catch(err => console.error("Failed to load Japan map data", err));

    // Load World Map
    fetch(WORLD_GEOJSON_URL)
        .then(res => res.json())
        .then(data => setWorldGeoData(data))
        .catch(err => console.error("Failed to load World map data", err));
  }, []);

  // Initialize Map Structure & Zoom (Re-run when data changes)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    // Require both datasets for optimal rendering, but render what we have if one is slow
    if (!japanGeoData && !worldGeoData) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();

    // Only recreate group if it doesn't exist to avoid flickering, 
    // but in this effect we usually want to redraw paths if data arrived.
    svg.selectAll("*").remove();

    const g = svg.append("g");
    gRef.current = g;

    // Unified Projection: Mercator Centered on Japan
    // We use Mercator because it's standard for web maps and preserves shape for Japan reasonably well.
    const projection = d3.geoMercator()
        .center([137, 38]) 
        .scale(width * 2) 
        .translate([width / 2, height / 2]);
    
    projectionRef.current = projection;

    const pathGenerator = d3.geoPath().projection(projection);

    // 1. Draw World Map (Filtered)
    // Exclude Japan from world map to prevent overlap with detailed Japan map
    if (worldGeoData) {
        // "JPN" is the standard ISO code for Japan.
        // Some datasets use "Japan" in properties.name.
        const filteredWorldFeatures = worldGeoData.features.filter((f: any) => {
             return f.id !== 'JPN' && f.properties?.name !== 'Japan';
        });

        g.selectAll("path.world")
            .data(filteredWorldFeatures)
            .enter()
            .append("path")
            .attr("class", "world-path")
            .attr("d", pathGenerator as any)
            .attr("stroke", "#334155") // Slightly lighter/thinner for world context
            .attr("stroke-width", 0.5) 
            .attr("fill", "#1e293b"); // Slate 800 for world (darker/receded)
    }

    // 2. Draw Detailed Japan Map
    if (japanGeoData) {
        g.selectAll("path.japan")
            .data(japanGeoData.features)
            .enter()
            .append("path")
            .attr("class", "pref-path")
            .attr("d", pathGenerator as any)
            .attr("stroke", "#475569") 
            .attr("stroke-width", 0.8) 
            .attr("fill", "#0f172a"); // Slate 900 for Japan (focus)
    }

    // EEW Circles Container
    g.append("g").attr("class", "eew-waves");

    // Zoom Behavior with Semantic Zooming
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 150]) // Allow zooming out further for world view
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        const k = event.transform.k;
        
        // Counter-scale markers
        g.selectAll<SVGGElement, {x: number, y: number}>(".dynamic-marker, .debug-marker")
          .attr("transform", d => `translate(${d.x}, ${d.y}) scale(${1 / k})`);
          
        g.selectAll(".wave-circle")
           .attr("stroke-width", 2 / k);
        
        // Semantic stroke width
        g.selectAll(".pref-path").attr("stroke-width", 0.8 / k);
        g.selectAll(".world-path").attr("stroke-width", 0.5 / k);
      });
    
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

  }, [japanGeoData, worldGeoData]);

  // Helper: Find Coordinate by name
  const findCoordinate = (name: string): [number, number] | null => {
    const keys = Object.keys(STATION_COORDINATES);
    let match = keys.find(k => k === name);
    if (!match) match = keys.find(k => name.startsWith(k));
    if (!match) match = keys.find(k => name.includes(k));
    
    if (match) {
        const [lat, lon] = STATION_COORDINATES[match];
        return [lon, lat];
    }
    return null;
  };

  // Helper: Fit Bounds
  // Increase default padding and limit max zoom to show surrounding areas
  const fitBounds = (coordinates: [number, number][], paddingPercent = 0.35) => {
    if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current || coordinates.length === 0 || !projectionRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = containerRef.current.getBoundingClientRect();
    const projection = projectionRef.current;

    // Convert Geo Coords to Projected Coords (Pixels)
    const projectedCoords = coordinates.map(c => projection(c) as [number, number]);

    // Calculate Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    projectedCoords.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });

    if (minX === Infinity) return;

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;

    // Handle single point (Epicenter only)
    if (boundsWidth === 0 && boundsHeight === 0) {
        // Default zoom for a single point - REDUCED max zoom to show context
        const k = 8; 
        const tx = width / 2 - k * minX;
        const ty = height / 2 - k * minY;
        svg.transition().duration(1200).call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
        return;
    }

    const scaleX = (width * (1 - paddingPercent * 2)) / boundsWidth;
    const scaleY = (height * (1 - paddingPercent * 2)) / boundsHeight;
    let k = Math.min(scaleX, scaleY);
    
    // Clamp zoom
    if (k > 8) k = 8; // Limit max zoom significantly so we see surrounding prefectures
    if (k < 0.2) k = 0.2; 

    const tx = width / 2 - k * (minX + maxX) / 2;
    const ty = height / 2 - k * (minY + maxY) / 2;

    svg.transition().duration(1200).ease(d3.easeCubicOut).call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  };

  // Helper: Get Color from Intensity
  const getIntensityColor = (intensity: string | undefined): string => {
      if (!intensity) return '#ca8a04'; // Default Yellow-ish for forecast unknown
      const i = intensity.replace('弱', '-').replace('強', '+');
      switch(i) {
          case '1': return '#64748b'; // Slate 500
          case '2': return '#3b82f6'; // Blue 500
          case '3': return '#1d4ed8'; // Blue 700
          case '4': return '#facc15'; // Yellow 400
          case '5-': return '#f97316'; // Orange 500
          case '5+': return '#ea580c'; // Orange 600
          case '6-': return '#dc2626'; // Red 600
          case '6+': return '#b91c1c'; // Red 700
          case '7': return '#7e22ce'; // Purple 700
          default: return '#facc15'; // Yellow 400
      }
  };

  // Auto Zoom for Earthquake Reports (Points + Epicenter)
  // Depend on latestQuake.time to force update even if user moved map
  useEffect(() => {
    // We only skip if autoZoom is disabled globally. 
    // If it is enabled, we force move on new data.
    if (!isAutoZoomEnabled || !latestQuake || eew.isActive) return;

    const coords: [number, number][] = [];
    
    // 1. Epicenter
    if (latestQuake.earthquake.hypocenter) {
        const { longitude, latitude, name } = latestQuake.earthquake.hypocenter;
        if (longitude !== -1 && latitude !== -1) {
            coords.push([longitude, latitude]);
        } else if (name) {
            const c = findCoordinate(name);
            if (c) coords.push(c);
        }
    }

    // 2. Points (Only relevant for Japan map usually)
    if (latestQuake.points) {
        latestQuake.points.forEach(p => {
             const c = findCoordinate(p.addr) || findCoordinate(p.pref);
             if (c) coords.push(c);
        });
    }

    if (coords.length > 0) {
        const isFarAway = coords.length === 1 && (coords[0][0] < 120 || coords[0][0] > 155 || coords[0][1] < 20 || coords[0][1] > 50);
        
        if (isFarAway) {
             if (!svgRef.current || !zoomBehaviorRef.current || !projectionRef.current || !containerRef.current) return;
             const svg = d3.select(svgRef.current);
             const projection = projectionRef.current;
             const { width, height } = containerRef.current.getBoundingClientRect();
             const px = projection(coords[0])!;
             const k = 2; // Zoom level 2 for world context
             const tx = width / 2 - k * px[0];
             const ty = height / 2 - k * px[1];
             svg.transition().duration(1200).call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
        } else {
             fitBounds(coords, 0.35); // Use more padding
        }
    }
  }, [latestQuake?.time, latestQuake?._id, isAutoZoomEnabled]); // Force trigger on new timestamp/ID

  // EEW Logic: Warning Areas & Wave Animation
  useEffect(() => {
    if (!eew.isActive || !eew.occurredTime || !eew.hypocenterName || !gRef.current || !projectionRef.current) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        gRef.current?.select(".eew-waves").selectAll("*").remove();
        return;
    }
    
    const origin = findCoordinate(eew.hypocenterName);
    if (!origin) return;

    // --- 1. Initial/Area Zoom Logic ---
    // Only trigger fitBounds if this specific EEW update is new (or first render of it)
    // We rely on eew.occurredTime or eew.updatedTime changing
    if (isAutoZoomEnabled) {
        if (eew.areas.length > 0 && japanGeoData) {
            const areaCoords: [number, number][] = [];
            areaCoords.push(origin);
            eew.areas.forEach(areaName => {
                const c = findCoordinate(areaName);
                if (c) areaCoords.push(c);
            });
            fitBounds(areaCoords, 0.35);
        } else {
             fitBounds([origin], 0.35); 
        }
    }

    // --- 2. Wave Animation Loop ---
    const startTime = new Date(eew.occurredTime).getTime();
    const gWaves = gRef.current.select(".eew-waves");
    const projection = projectionRef.current;
    const svg = d3.select(svgRef.current);
    const zoom = zoomBehaviorRef.current;

    const animate = () => {
        const now = Date.now();
        const elapsedSec = (now - startTime) / 1000;
        
        if (elapsedSec < 0) {
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
        }

        const pRadiusKm = elapsedSec * V_P_WAVE;
        const sRadiusKm = elapsedSec * V_S_WAVE;
        const pRadiusDeg = pRadiusKm / KM_PER_DEG;
        const sRadiusDeg = sRadiusKm / KM_PER_DEG;

        const geoCircle = d3.geoCircle().center(origin);
        const waves = [
            { type: 'P', radius: pRadiusDeg, color: '#3b82f6', opacity: 0.3 }, 
            { type: 'S', radius: sRadiusDeg, color: '#ef4444', opacity: 0.4 }  
        ];

        const pathGenerator = d3.geoPath().projection(projection);
        
        // Draw Waves
        const paths = gWaves.selectAll<SVGPathElement, any>("path")
            .data(waves, d => d.type);

        paths.enter()
            .append("path")
            .attr("class", "wave-circle")
            .attr("fill", "none")
            .attr("stroke", d => d.color)
            .attr("stroke-width", 2)
            .merge(paths)
            .attr("d", d => {
                return pathGenerator(geoCircle.radius(d.radius)());
            });
            
        paths.exit().remove();

        if (svgRef.current) {
             const k = d3.zoomTransform(svgRef.current).k;
             gWaves.selectAll("path").attr("stroke-width", 2 / k);
        }

        // --- Continuous Zoom Logic (Follow Waves) ---
        // Note: Disabling continuous zoom for now based on user request to "not zoom too much"
        // and to keep it stable around prefectures.
        // We only fitBounds initially.
        /* 
        if (isAutoZoomRef.current && zoom && containerRef.current) {
             ... removed continuous follow logic to keep view stable on context ...
        }
        */

        animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [eew.occurredTime, eew.updatedTime, eew.isActive]); // Trigger on updates

  // Update Map Content (Colors, Markers)
  useEffect(() => {
    const g = gRef.current;
    const projection = projectionRef.current;
    
    if (!g || !projection || !svgRef.current) return;

    const currentTransform = d3.zoomTransform(svgRef.current);
    const k = currentTransform.k;

    // 1. Update Colors (Japan only usually)
    g.selectAll<SVGPathElement, any>(".pref-path")
      .attr("fill", (feature) => {
        if (eew.isActive && eew.areas.length > 0) {
           const prefName = feature.properties.nam_ja || feature.properties.name_ja;
           const isTargeted = eew.areas.some(area => prefName && (prefName.includes(area) || area.includes(prefName)));
           if (isTargeted) {
               if (eew.isWarning) {
                   return '#7f1d1d';
               } else {
                   return getIntensityColor(eew.maxIntensity);
               }
           }
        }
        return "#0f172a"; // Slate-900
      });

    // --- Prepare Data for Markers ---
    interface MarkerData {
      id: string;
      x: number;
      y: number;
      type: 'intensity' | 'epicenter';
      scale?: number;
    }

    const markers: MarkerData[] = [];

    // Points (Japan Stations)
    if (latestQuake && latestQuake.points && !eew.isActive) {
        const plotData = new Map<string, JMASeismicIntensity>();
        latestQuake.points.forEach(p => {
            let matchedKey = "";
            let coords: [number, number] | undefined;
            const keys = Object.keys(STATION_COORDINATES);
            const cityMatch = keys.find(k => p.addr.startsWith(k));
            if (cityMatch) {
                matchedKey = cityMatch;
                coords = STATION_COORDINATES[cityMatch];
            } else {
                const prefMatch = keys.find(k => p.pref === k);
                if (prefMatch) {
                     matchedKey = prefMatch;
                     coords = STATION_COORDINATES[prefMatch];
                }
            }

            if (coords && matchedKey) {
                const currentMax = plotData.get(matchedKey) || -1;
                if (p.scale > currentMax) plotData.set(matchedKey, p.scale);
            }
        });

        plotData.forEach((scale, key) => {
            const coordsVal = STATION_COORDINATES[key];
            if (!coordsVal) return;
            const [lat, lon] = coordsVal;
            const screenCoords = projection([lon, lat]);
            if (screenCoords && scale >= 10) {
                 markers.push({
                   id: `point-${key}`,
                   x: screenCoords[0],
                   y: screenCoords[1],
                   type: 'intensity',
                   scale: scale
                 });
            }
        });
    }

    // Epicenter Logic (Both EEW and Regular)
    if (eew.isActive && eew.hypocenterName) {
        let match = Object.keys(STATION_COORDINATES).find(k => eew.hypocenterName?.includes(k));
        if (match) {
            const [lat, lon] = STATION_COORDINATES[match];
            const coords = projection([lon, lat]);
            if (coords) {
                markers.push({ id: 'epicenter', x: coords[0], y: coords[1], type: 'epicenter' });
            }
        }
    } else if (latestQuake && latestQuake.earthquake && latestQuake.earthquake.hypocenter) {
        const { latitude, longitude } = latestQuake.earthquake.hypocenter;
        if (latitude !== -1 && longitude !== -1) {
            const coords = projection([longitude, latitude]);
            if (coords) {
                markers.push({ id: 'epicenter', x: coords[0], y: coords[1], type: 'epicenter' });
            }
        }
    }

    const updateSelection = g.selectAll<SVGGElement, MarkerData>(".dynamic-marker")
      .data(markers, d => d.id);

    updateSelection.exit().remove();

    const enterGroup = updateSelection.enter()
      .append("g")
      .attr("class", "dynamic-marker");

    // Intensity Marker
    const intensityGroups = enterGroup.filter(d => d.type === 'intensity');
    intensityGroups.append("rect")
      .attr("x", -10).attr("y", -10).attr("width", 20).attr("height", 20)
      .attr("rx", 4).attr("ry", 4)
      .attr("stroke", "#0f172a").attr("stroke-width", 2);
    intensityGroups.append("text")
      .attr("dy", "0.35em").attr("text-anchor", "middle")
      .attr("font-size", "12px").attr("font-weight", "bold").attr("font-family", "sans-serif");

    // Epicenter Marker
    const epicenterGroups = enterGroup.filter(d => d.type === 'epicenter');
    epicenterGroups.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text("×")
      .attr("font-size", "42px")
      .attr("font-weight", "bold")
      .attr("stroke", "white")
      .attr("stroke-width", "4")
      .attr("stroke-linejoin", "round")
      .style("paint-order", "stroke")
      .attr("fill", "#ef4444");

    const allMarkers = enterGroup.merge(updateSelection);
    allMarkers.attr("transform", d => `translate(${d.x}, ${d.y}) scale(${1 / k})`);

    allMarkers.filter(d => d.type === 'intensity').each(function(d) {
        const sel = d3.select(this);
        const intensity = d.scale!;
        let color = '#334155'; let text = '?'; let textColor = '#fff';
        switch(intensity) {
             case 10: color = '#64748b'; text="1"; break;
             case 20: color = '#3b82f6'; text="2"; break;
             case 30: color = '#1d4ed8'; text="3"; break;
             case 40: color = '#facc15'; text="4"; textColor="#0f172a"; break;
             case 45: color = '#f97316'; text="5-"; textColor="#0f172a"; break;
             case 50: color = '#ea580c'; text="5+"; textColor="#0f172a"; break;
             case 55: color = '#dc2626'; text="6-"; break;
             case 60: color = '#b91c1c'; text="6+"; break;
             case 70: color = '#7e22ce'; text="7"; break;
        }
        sel.select("rect").attr("fill", color);
        sel.select("text").text(text).attr("fill", textColor);
    });

    // Debug Markers (Only relevant for Japan map stations)
    if (isDebugMode) {
       const keys = Object.keys(STATION_COORDINATES);
       const debugData: {id: string, x: number, y: number, name: string}[] = [];
       keys.forEach(key => {
          const [lat, lon] = STATION_COORDINATES[key];
          const coords = projection([lon, lat]);
          if (coords) debugData.push({ id: `debug-${key}`, x: coords[0], y: coords[1], name: key });
       });
       const debugSelection = g.selectAll<SVGGElement, any>(".debug-marker").data(debugData, d => d.id);
       debugSelection.exit().remove();
       const debugEnter = debugSelection.enter().append("g").attr("class", "debug-marker");
       debugEnter.append("circle").attr("r", 3).attr("fill", "#06b6d4").attr("stroke", "#fff").attr("stroke-width", 0.5);
       debugEnter.append("title").text(d => d.name);
       debugEnter.merge(debugSelection).attr("transform", d => `translate(${d.x}, ${d.y}) scale(${1/k})`);
    } else {
       g.selectAll(".debug-marker").remove();
    }

  }, [latestQuake, eew, japanGeoData, worldGeoData, isDebugMode]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-950 overflow-hidden relative">
      <svg ref={svgRef} className="w-full h-full cursor-move touch-none"></svg>
      {/* Minimal Legend */}
      <div className="absolute bottom-4 left-4 flex gap-1.5 opacity-60 hover:opacity-100 transition-opacity pointer-events-none select-none">
           {[
             {c: "bg-gray-500", l: "1"}, {c: "bg-blue-500", l: "2"}, {c: "bg-blue-700", l: "3"},
             {c: "bg-yellow-400", l: "4"}, {c: "bg-orange-500", l: "5-"}, {c: "bg-orange-600", l: "5+"},
             {c: "bg-red-600", l: "6-"}, {c: "bg-red-700", l: "6+"}, {c: "bg-purple-700", l: "7"}
           ].map((i) => (
             <div key={i.l} className={`${i.c} w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold text-white/90`}>{i.l}</div>
           ))}
      </div>
    </div>
  );
};
