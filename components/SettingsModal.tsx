import React, { useState } from 'react';
import { X, Scan, Database, Search, ChevronRight, TestTube, Play, History, RefreshCw, Filter, Calendar, BarChart } from 'lucide-react';
import { P2PQuakeData, JMASeismicIntensity } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDebugMode: boolean;
  setDebugMode: (val: boolean) => void;
  isAutoZoomEnabled: boolean;
  setAutoZoomEnabled: (val: boolean) => void;
  onSelectQuake: (data: P2PQuakeData) => void;
  onStartSimulation: () => void;
}

const formatHistoryTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const getIntensityLabel = (intensity: JMASeismicIntensity) => {
    switch(intensity) {
        case 10: return { label: "1", color: "bg-gray-500" };
        case 20: return { label: "2", color: "bg-blue-500" };
        case 30: return { label: "3", color: "bg-blue-700" };
        case 40: return { label: "4", color: "bg-yellow-400 text-black" };
        case 45: return { label: "5-", color: "bg-orange-500 text-black" };
        case 50: return { label: "5+", color: "bg-orange-600 text-black" };
        case 55: return { label: "6-", color: "bg-red-600" };
        case 60: return { label: "6+", color: "bg-red-700" };
        case 70: return { label: "7", color: "bg-purple-800" };
        default: return { label: "?", color: "bg-gray-700" };
    }
};

// Helper to approximate USGS MMI/CDI to JMA Intensity
const convertMMItoJMA = (mmi: number): JMASeismicIntensity => {
    if (mmi < 1.5) return JMASeismicIntensity.Scale10; // I -> 1
    if (mmi < 2.5) return JMASeismicIntensity.Scale20; // II -> 2
    if (mmi < 3.5) return JMASeismicIntensity.Scale30; // III -> 3
    if (mmi < 4.5) return JMASeismicIntensity.Scale40; // IV -> 4
    if (mmi < 5.5) return JMASeismicIntensity.Scale45; // V -> 5-
    if (mmi < 6.5) return JMASeismicIntensity.Scale50; // VI -> 5+
    if (mmi < 7.5) return JMASeismicIntensity.Scale55; // VII -> 6-
    if (mmi < 8.5) return JMASeismicIntensity.Scale60; // VIII -> 6+
    return JMASeismicIntensity.Scale70; // IX+ -> 7
};

type SearchMode = 'ranking' | 'recent' | 'year';

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, isDebugMode, setDebugMode, isAutoZoomEnabled, setAutoZoomEnabled, onSelectQuake, onStartSimulation }) => {
  const [history, setHistory] = useState<P2PQuakeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Historical Search State
  const [searchMode, setSearchMode] = useState<SearchMode>('ranking');
  const [searchYear, setSearchYear] = useState<number>(2024);
  const [minMag, setMinMag] = useState<number>(6);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<P2PQuakeData[]>([]);

  if (!isOpen) return null;

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
        const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=50');
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setHistory(data);
    } catch (e) {
        setError("データの取得に失敗しました");
    } finally {
        setIsLoading(false);
    }
  };

  const handleStartSim = () => {
      onStartSimulation();
      onClose();
  };

  // Fetch historical data from USGS and map to P2PQuakeData format
  const searchHistoricalQuakes = async () => {
      setSearchLoading(true);
      setSearchError(null);
      setSearchResults([]);
      
      try {
          let url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50`;

          // Construct Query based on Mode
          if (searchMode === 'ranking') {
              // All time (since 1900), sorted by magnitude
              url += `&starttime=1900-01-01&orderby=magnitude&minmagnitude=${minMag}`;
          } else if (searchMode === 'recent') {
              // Last 30 days (default behavior if no starttime), sorted by time
              // But let's be explicit: last 1 year for "Recent" broad search
              const d = new Date();
              d.setFullYear(d.getFullYear() - 1);
              const start = d.toISOString().split('T')[0];
              url += `&starttime=${start}&orderby=time&minmagnitude=${minMag}`;
          } else if (searchMode === 'year') {
              // Specific Year
              const start = `${searchYear}-01-01`;
              const end = `${searchYear}-12-31`;
              url += `&starttime=${start}&endtime=${end}&orderby=time&minmagnitude=${minMag}`;
          }
          
          const res = await fetch(url);
          if(!res.ok) throw new Error("USGS API Error");
          
          const data = await res.json();
          
          if (data.features.length === 0) {
              setSearchError("条件に一致する地震は見つかりませんでした。");
          }

          // Map USGS GeoJSON to App's Data Structure
          const mapped: P2PQuakeData[] = data.features.map((f: any) => {
              // Try to find intensity info (mmi or cdi)
              const mmi = f.properties.mmi || f.properties.cdi || null;
              const jmaScale = mmi ? convertMMItoJMA(mmi) : -1;

              return {
                  _id: f.id,
                  code: 551,
                  time: new Date(f.properties.time).toISOString(),
                  issue: { time: new Date(f.properties.time).toISOString(), type: "Foreign/Historical" },
                  earthquake: {
                      time: new Date(f.properties.time).toISOString(),
                      hypocenter: {
                          name: f.properties.place,
                          latitude: f.geometry.coordinates[1],
                          longitude: f.geometry.coordinates[0],
                          depth: f.geometry.coordinates[2],
                          magnitude: f.properties.mag
                      },
                      maxScale: jmaScale,
                      domesticTsunami: "None"
                  },
                  points: [] // No point data for historical USGS
              };
          });

          setSearchResults(mapped);

      } catch (e) {
          console.error(e);
          setSearchError("検索中にエラーが発生しました。");
      } finally {
          setSearchLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 flex-shrink-0">
          <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
          設定
        </h2>

        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-6">
          
          {/* Map Settings */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700">
             <h3 className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
                 <Scan className="w-4 h-4 text-emerald-400" />
                 地図表示設定
             </h3>

             <div className="space-y-4">
                {/* Auto Zoom Toggle */}
                <label className="flex items-center cursor-pointer gap-3 p-2 hover:bg-slate-700/50 rounded transition-colors justify-between">
                   <div className="flex-1">
                        <span className="block text-slate-200 font-medium select-none">自動ズーム・追従</span>
                        <span className="block text-xs text-slate-400 mt-1">
                            震源地に合わせて地図範囲を自動調整します。
                        </span>
                   </div>
                   <div className="relative">
                        <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={isAutoZoomEnabled}
                        onChange={(e) => setAutoZoomEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                   </div>
                </label>

                {/* Debug Mode Toggle */}
                <label className="flex items-center cursor-pointer gap-3 p-2 hover:bg-slate-700/50 rounded transition-colors justify-between">
                    <div className="flex-1">
                        <span className="block text-slate-200 font-medium select-none">観測点デバッグモード</span>
                        <span className="block text-xs text-slate-400 mt-1">
                            地図上の観測点座標をドットで表示します。
                        </span>
                    </div>
                    <div className="relative">
                        <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={isDebugMode}
                        onChange={(e) => setDebugMode(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                </label>
             </div>
          </div>

          {/* Historical Data Section (USGS) */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700">
             <h3 className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
               <Database className="w-4 h-4 text-purple-400" />
               世界・過去の地震検索 (USGS)
             </h3>
             <p className="text-xs text-slate-400 mb-4">
                 米国地質調査所(USGS)のデータを検索し、世界地図または日本地図上に表示します。
             </p>

             <div className="space-y-4">
                 {/* Search Mode Selection */}
                 <div className="flex p-1 bg-slate-900 rounded-lg">
                    <button 
                        onClick={() => setSearchMode('ranking')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${searchMode === 'ranking' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <BarChart className="w-3 h-3" />
                        規模順 (全期間)
                    </button>
                    <button 
                        onClick={() => setSearchMode('recent')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${searchMode === 'recent' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <History className="w-3 h-3" />
                        直近 (1年)
                    </button>
                    <button 
                        onClick={() => setSearchMode('year')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${searchMode === 'year' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Calendar className="w-3 h-3" />
                        年指定
                    </button>
                 </div>

                 {/* Dynamic Filters based on Mode */}
                 <div className="flex gap-3">
                     {searchMode === 'year' && (
                         <div className="flex-1">
                             <label className="text-[10px] text-slate-500 block mb-1">指定年 (Year)</label>
                             <input 
                                type="number" 
                                min="1900" 
                                max={new Date().getFullYear()} 
                                value={searchYear}
                                onChange={(e) => setSearchYear(parseInt(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                             />
                         </div>
                     )}
                     
                     <div className="w-28">
                         <label className="text-[10px] text-slate-500 block mb-1">最小規模 (M)</label>
                         <select 
                            value={minMag} 
                            onChange={(e) => setMinMag(parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
                         >
                             <option value="5">M5+</option>
                             <option value="6">M6+</option>
                             <option value="7">M7+</option>
                             <option value="8">M8+</option>
                             <option value="9">M9+</option>
                         </select>
                     </div>
                 </div>

                 <button 
                    onClick={searchHistoricalQuakes}
                    disabled={searchLoading}
                    className="w-full py-2 bg-purple-700 hover:bg-purple-600 text-white rounded font-medium text-sm flex items-center justify-center gap-2"
                 >
                     <Search className="w-4 h-4" />
                     {searchLoading ? "検索中..." : "検索実行"}
                 </button>

                 {searchError && <p className="text-xs text-red-400 text-center">{searchError}</p>}

                 {searchResults.length > 0 && (
                     <div className="space-y-2 mt-3 max-h-[200px] overflow-y-auto pr-1">
                         {searchResults.map((quake) => {
                             const intensity = getIntensityLabel(quake.earthquake.maxScale);
                             return (
                                 <button 
                                    key={quake._id}
                                    onClick={() => { onSelectQuake(quake); onClose(); }}
                                    className="w-full text-left bg-slate-800 hover:bg-slate-700 p-2.5 rounded border border-slate-600 flex items-center justify-between group transition-colors"
                                 >
                                     <div className="flex items-center gap-3 w-full">
                                         {/* Use consistent intensity badge if available */}
                                         {quake.earthquake.maxScale !== -1 ? (
                                             <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm shrink-0 ${intensity.color}`}>
                                                 {intensity.label}
                                             </div>
                                         ) : (
                                            <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-xs shrink-0 bg-slate-700 border border-slate-600">
                                                -
                                            </div>
                                         )}
                                         <div className="min-w-0 flex-1">
                                             <div className="text-sm font-bold text-slate-200 line-clamp-1">
                                                {quake.earthquake.hypocenter?.name}
                                             </div>
                                             <div className="flex items-center justify-between text-xs text-slate-400 mt-0.5">
                                                 <span>{formatHistoryTime(quake.earthquake.time)}</span>
                                                 <div className="flex gap-2">
                                                     <span className="text-purple-300 font-bold">M{quake.earthquake.hypocenter?.magnitude}</span>
                                                     {quake.earthquake.hypocenter?.depth !== undefined && (
                                                         <span className="text-slate-500">{quake.earthquake.hypocenter.depth.toFixed(0)}km</span>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                         <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                                     </div>
                                 </button>
                             );
                         })}
                     </div>
                 )}
             </div>
          </div>

          {/* Simulation Section */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700 border-yellow-500/30">
             <h3 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
               <TestTube className="w-4 h-4" />
               緊急地震速報シミュレーション
             </h3>
             <p className="text-slate-400 text-sm mb-4">
                和歌山県を震源とする大規模な地震（震度6強）の緊急地震速報と地震発生をシミュレーションします。
             </p>
             <button 
                onClick={handleStartSim}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-yellow-900/20"
             >
                <Play className="w-4 h-4 fill-current" />
                テストシミュレーション開始
             </button>
          </div>

          {/* Recent History Section */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-700">
             <h3 className="text-slate-200 font-semibold mb-4 flex items-center gap-2">
               <History className="w-4 h-4 text-green-400" />
               直近の地震情報 (P2P)
             </h3>
             
             <button 
                onClick={fetchHistory}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors font-medium mb-4 disabled:opacity-50 text-sm"
             >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                最新50件を再取得
             </button>

             {error && <div className="text-red-400 text-sm mb-2 text-center">{error}</div>}

             {history.length > 0 && (
                 <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                     {history.map((quake) => {
                         const intensity = getIntensityLabel(quake.earthquake.maxScale);
                         return (
                             <button 
                                key={quake._id}
                                onClick={() => { onSelectQuake(quake); onClose(); }}
                                className="w-full text-left bg-slate-800 hover:bg-slate-700 p-3 rounded border border-slate-700 flex items-center justify-between group transition-colors"
                             >
                                 <div className="flex items-center gap-3">
                                     <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm shrink-0 ${intensity.color}`}>
                                         {intensity.label}
                                     </div>
                                     <div className="min-w-0">
                                         <div className="text-sm font-bold text-slate-200 line-clamp-1">
                                            {quake.earthquake.hypocenter?.name || "震源不明"}
                                         </div>
                                         <div className="text-xs text-slate-400">
                                            {formatHistoryTime(quake.earthquake.time)} 
                                            <span className="mx-1">•</span> 
                                            M{quake.earthquake.hypocenter?.magnitude !== -1 ? quake.earthquake.hypocenter?.magnitude : "-"}
                                         </div>
                                     </div>
                                 </div>
                                 <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                             </button>
                         );
                     })}
                 </div>
             )}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end pt-4 border-t border-slate-700">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};