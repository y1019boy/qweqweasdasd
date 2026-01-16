import React, { useMemo } from 'react';
import { P2PQuakeData, JMASeismicIntensity } from '../types';
import { IntensityBadge } from './IntensityBadge';
import { Activity, Globe, Info } from 'lucide-react';

interface Props {
  data: P2PQuakeData | null;
}

const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export const InfoPanel: React.FC<Props> = ({ data }) => {
  const intensityGroups = useMemo(() => {
    if (!data || !data.points) return [];
    
    // Group by Scale -> Pref -> Areas
    const groups: { scale: JMASeismicIntensity; prefs: { name: string; areas: string[] }[] }[] = [];
    
    // Get unique scales sorted desc
    const uniqueScales: JMASeismicIntensity[] = Array.from(new Set(data.points.map(p => p.scale))).sort((a, b) => (b as number) - (a as number));

    uniqueScales.forEach(scale => {
        const pointsInScale = data.points.filter(p => p.scale === scale);
        
        // Group by Pref
        const prefsMap = new Map<string, string[]>();
        pointsInScale.forEach(p => {
            if (!prefsMap.has(p.pref)) {
                prefsMap.set(p.pref, []);
            }
            // Avoid duplicates in addr
            if (!prefsMap.get(p.pref)?.includes(p.addr)) {
                prefsMap.get(p.pref)?.push(p.addr);
            }
        });

        const prefs: { name: string; areas: string[] }[] = [];
        prefsMap.forEach((areas, prefName) => {
            prefs.push({ name: prefName, areas: areas.sort() });
        });

        groups.push({ scale, prefs });
    });

    return groups;
  }, [data]);

  // Handle No Data
  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-700 relative pb-20">
        {/* Mobile Drag Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-700 rounded-full md:hidden opacity-50"></div>
        
        <Activity className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm font-light tracking-wider">NO ACTIVE DATA</p>
      </div>
    );
  }

  const { earthquake } = data;
  const hypocenter = earthquake.hypocenter;

  const displayDepth = hypocenter?.depth === -1 || hypocenter?.depth === undefined
    ? "不明" 
    : hypocenter?.depth === 0 
        ? "ごく浅い" 
        : `${hypocenter?.depth}km`;
  
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar relative pb-24 md:pb-0">
      
      {/* Mobile Drag Handle Visual */}
      <div className="sticky top-0 z-20 w-full flex justify-center py-3 bg-slate-950/95 backdrop-blur md:hidden border-b border-white/5">
         <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
      </div>

      {/* Top Section: Primary Data */}
      <div className="p-5 md:p-6 border-b border-slate-900 space-y-4 md:space-y-6 flex-shrink-0">
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-500 tracking-wider">
                    {formatTime(earthquake.time)}
                </span>
                {earthquake.domesticTsunami !== 'None' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-900/50">
                        {earthquake.domesticTsunami}
                    </span>
                )}
            </div>
            <h2 className="text-xl md:text-3xl font-medium text-slate-100 leading-tight">
                {hypocenter?.name || "震源地不明"}
            </h2>
        </div>

        <div className="flex items-end gap-5 md:gap-6">
             <div className="flex-shrink-0">
                <IntensityBadge scale={earthquake.maxScale} size="lg" />
             </div>
             
             <div className="flex gap-6 md:gap-8 pb-1">
                <div>
                    <div className="text-[10px] text-slate-600 tracking-widest uppercase mb-0.5">Magnitude</div>
                    <div className="text-lg md:text-xl text-slate-200 font-light">
                        {hypocenter?.magnitude === -1 || hypocenter?.magnitude === undefined ? "-" : `M${hypocenter.magnitude}`}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] text-slate-600 tracking-widest uppercase mb-0.5">Depth</div>
                    <div className="text-lg md:text-xl text-slate-200 font-light">
                        {displayDepth}
                    </div>
                </div>
             </div>
        </div>
      </div>

      {/* Bottom Section: Area List OR Details */}
      {intensityGroups.length > 0 ? (
        <div className="p-5 md:p-6 bg-slate-950/50">
            <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-4 md:mb-6 border-b border-slate-900 pb-2">
                Intensity Report
            </div>
            
            <div className="space-y-4 md:space-y-6">
                {intensityGroups.map(group => (
                    <div key={group.scale} className="flex gap-4 items-start">
                        <div className="mt-0.5 flex-shrink-0">
                            <IntensityBadge scale={group.scale} size="sm" />
                        </div>
                        <div className="flex-1 space-y-2 md:space-y-3">
                             {group.prefs.map(pref => (
                                 <div key={pref.name} className="flex flex-col">
                                     <span className="text-sm font-medium text-slate-300 mb-0.5 md:mb-1">{pref.name}</span>
                                     <span className="text-xs text-slate-400 leading-relaxed font-medium">
                                         {pref.areas.join("　")}
                                     </span>
                                 </div>
                             ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      ) : (
        // Fallback for USGS/Historical Data without points
        <div className="p-5 md:p-6 bg-slate-950/50 flex-1">
             <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-4 border-b border-slate-900 pb-2">
                Earthquake Details
            </div>
            <div className="text-slate-400 text-sm">
                <div className="flex items-start gap-3 mb-4 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed text-xs">
                        詳細な震度観測点データはありません。これは過去のデータ、海外のデータ、または震源パラメータのみの速報である可能性があります。
                    </p>
                </div>
                
                {(hypocenter?.latitude !== undefined && hypocenter?.longitude !== undefined) && (
                    <div className="mt-6">
                        <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
                            <Globe className="w-3 h-3" />
                            COORDINATES
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900 p-3 rounded border border-slate-800">
                                <span className="block text-[10px] text-slate-600 mb-1 tracking-wider">LATITUDE</span>
                                <span className="text-lg text-slate-200 font-mono">{hypocenter.latitude.toFixed(4)}°N</span>
                            </div>
                            <div className="bg-slate-900 p-3 rounded border border-slate-800">
                                <span className="block text-[10px] text-slate-600 mb-1 tracking-wider">LONGITUDE</span>
                                <span className="text-lg text-slate-200 font-mono">{hypocenter.longitude.toFixed(4)}°E</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};