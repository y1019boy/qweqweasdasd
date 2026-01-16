
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { P2PQuakeData, EEWState, WolfxEEWData, JMASeismicIntensity } from './types';
import { MapComponent } from './components/MapComponent';
import { InfoPanel } from './components/InfoPanel';
import { EEWBanner } from './components/EEWBanner';
import { SettingsModal } from './components/SettingsModal';
import { soundService } from './services/SoundService';
import { Wifi, WifiOff, Settings, Home, TestTube, History as HistoryIcon, Volume2, VolumeX } from 'lucide-react';

const P2P_WS_URL = 'wss://api.p2pquake.net/v2/ws';
const P2P_API_HISTORY = 'https://api.p2pquake.net/v2/history?codes=551&limit=1';
const WOLFX_WS_URL = 'wss://ws-api.wolfx.jp/jma_eew';

type ViewMode = 'live' | 'history' | 'simulation';

const App: React.FC = () => {
  // --- Data Stores ---
  // "Live" holds the real-time data from WebSockets
  const [liveQuake, setLiveQuake] = useState<P2PQuakeData | null>(null);
  const [liveEEW, setLiveEEW] = useState<EEWState>({ isActive: false, isWarning: false, isFinal: false, areas: [] });
  
  // "Display" is what is passed to components (switched based on mode)
  const [displayQuake, setDisplayQuake] = useState<P2PQuakeData | null>(null);
  const [displayEEW, setDisplayEEW] = useState<EEWState>({ isActive: false, isWarning: false, isFinal: false, areas: [] });

  const [mode, setMode] = useState<ViewMode>('live');

  const [p2pStatus, setP2pStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [wolfxStatus, setWolfxStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isAutoZoomEnabled, setIsAutoZoomEnabled] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  
  const p2pWsRef = useRef<WebSocket | null>(null);
  const wolfxWsRef = useRef<WebSocket | null>(null);
  const simulationTimersRef = useRef<number[]>([]);
  
  // Refs for tracking changes
  const prevEEWRef = useRef<EEWState>({ isActive: false, isWarning: false, isFinal: false, areas: [] });
  const prevQuakeIdRef = useRef<string>("");

  // 1. Initial Data Fetch
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(P2P_API_HISTORY);
        const data = await res.json();
        if (data && data.length > 0) {
          setLiveQuake(data[0]);
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      }
    };
    fetchHistory();
  }, []);

  // 2. Sync Display Data with Live Data when in 'live' mode
  useEffect(() => {
    if (mode === 'live') {
      setDisplayQuake(liveQuake);
      setDisplayEEW(liveEEW);
    }
  }, [liveQuake, liveEEW, mode]);

  // EEW Timeout Logic (20 seconds inactivity)
  useEffect(() => {
      if (mode !== 'live' || !liveEEW.isActive) return;

      const timer = setInterval(() => {
          if (liveEEW.updatedTime && Date.now() - liveEEW.updatedTime > 20000) {
              setLiveEEW(prev => ({ ...prev, isActive: false, areas: [] }));
          }
      }, 1000);

      return () => clearInterval(timer);
  }, [liveEEW, mode]);


  // 3. Audio Logic Monitoring
  useEffect(() => {
      if (!isSoundEnabled) return;

      const currentEEW = displayEEW;
      const prevEEW = prevEEWRef.current;

      // --- EEW Warning Loop Logic ---
      // Start Loop if Warning active and NOT final
      if (currentEEW.isActive && currentEEW.isWarning && !currentEEW.isFinal) {
          soundService.startAlarm();
      } else {
          // Stop Loop if not warning, or if final, or if inactive
          soundService.stopAlarm();
      }

      // --- Single Sound Logic ---
      
      // Case A: EEW Forecast Started (only if not warning)
      if (currentEEW.isActive && !prevEEW.isActive && !currentEEW.isWarning) {
          soundService.playForecast();
      }

      // Case B: Final Report Reached
      if (currentEEW.isFinal && !prevEEW.isFinal && currentEEW.isActive) {
          soundService.stopAlarm();
          soundService.playNotification(); // "Resolved" sound
      }

      // Case C: New Quake Report
      if (displayQuake && displayQuake._id !== prevQuakeIdRef.current) {
          const isRecent = new Date(displayQuake.time).getTime() > Date.now() - 1000 * 60 * 10;
          if (isRecent || mode === 'simulation') {
              soundService.playQuakeInfo();
          }
          prevQuakeIdRef.current = displayQuake._id;
      }

      prevEEWRef.current = currentEEW;
  }, [displayEEW, displayQuake, isSoundEnabled, mode]);

  // 4. WS Handlers
  const handleNewLiveQuake = useCallback((data: P2PQuakeData) => {
    setLiveQuake(data);
  }, []);

  const handleLiveWolfxEEW = useCallback((data: WolfxEEWData) => {
    if (data.isCancel || data.Title.includes("取消")) {
        setLiveEEW({ isActive: false, isWarning: false, isFinal: true, areas: [] });
        return;
    }
    const isWarning = data.Title.includes("警報") || data.Title.includes("Warning");
    
    // Parse Magnitude safely
    let mag: number | undefined = undefined;
    if (data.Magnitude) {
        const m = parseFloat(data.Magnitude);
        if (!isNaN(m)) mag = m;
    }

    // Parse Depth safely (e.g. "10km" -> 10)
    let depth: number | undefined = undefined;
    if (data.Depth) {
        const d = parseInt(data.Depth.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(d)) depth = d;
    }

    setLiveEEW({
        isActive: true,
        isWarning: isWarning,
        isFinal: data.isFinal || false,
        hypocenterName: data.Hypocenter,
        magnitude: mag,
        depth: depth,
        maxIntensity: data.MaxIntensity,
        areas: [],
        occurredTime: data.AnnouncedTime, 
        title: data.Title,
        updatedTime: Date.now() // Track for timeout
    });
  }, []);

  // 5. WebSocket Connections
  useEffect(() => {
    const connectP2P = () => {
      const ws = new WebSocket(P2P_WS_URL);
      p2pWsRef.current = ws;
      ws.onopen = () => setP2pStatus('connected');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data) as P2PQuakeData;
        if (data.code === 551) handleNewLiveQuake(data);
      };
      ws.onclose = () => { setP2pStatus('disconnected'); setTimeout(connectP2P, 5000); };
      ws.onerror = () => ws.close();
    };

    const connectWolfx = () => {
      const ws = new WebSocket(WOLFX_WS_URL);
      wolfxWsRef.current = ws;
      ws.onopen = () => setWolfxStatus('connected');
      ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.Type === 'jma_eew' || data.type === 'jma_eew') {
                handleLiveWolfxEEW(data as WolfxEEWData);
            }
        } catch (e) { console.error("Wolfx Parse Error", e); }
      };
      ws.onclose = () => { setWolfxStatus('disconnected'); setTimeout(connectWolfx, 5000); };
      ws.onerror = () => ws.close();
    };

    connectP2P();
    connectWolfx();
    return () => { 
        if (p2pWsRef.current) p2pWsRef.current.close();
        if (wolfxWsRef.current) wolfxWsRef.current.close();
    };
  }, [handleNewLiveQuake, handleLiveWolfxEEW]);

  // --- Actions ---

  const handleReturnHome = () => {
    simulationTimersRef.current.forEach(t => window.clearTimeout(t));
    simulationTimersRef.current = [];
    
    // Stop any alarm
    soundService.stopAlarm();

    setMode('live');
    prevEEWRef.current = { isActive: false, isWarning: false, isFinal: false, areas: [] };
  };

  const handleSelectHistoryQuake = (data: P2PQuakeData) => {
    setMode('history');
    setDisplayQuake(data);
    setDisplayEEW({ isActive: false, isWarning: false, isFinal: false, areas: [] });
  };

  const startSimulation = () => {
    handleReturnHome();
    setMode('simulation');
    
    prevEEWRef.current = { isActive: false, isWarning: false, isFinal: false, areas: [] };
    
    const now = new Date();
    const originTime = new Date(now.getTime() - 2000).toISOString(); 

    // Step 1: Initial EEW (Forecast)
    setDisplayEEW({
        isActive: true,
        isWarning: false,
        isFinal: false,
        hypocenterName: "和歌山県北部",
        magnitude: 4.5,
        depth: 10,
        maxIntensity: "3",
        areas: ["和歌山県"],
        occurredTime: originTime,
        title: "緊急地震速報（予報）",
        updatedTime: Date.now()
    });
    setDisplayQuake(null);

    // Step 2: Update EEW (Warning)
    const t1 = window.setTimeout(() => {
        setDisplayEEW({
            isActive: true,
            isWarning: true,
            isFinal: false,
            hypocenterName: "和歌山県北部",
            magnitude: 7.2,
            depth: 10,
            maxIntensity: "6強",
            areas: ["和歌山県", "大阪府", "奈良県", "徳島県", "兵庫県"],
            occurredTime: originTime,
            title: "緊急地震速報（警報）",
            updatedTime: Date.now()
        });
    }, 6000);

    // Step 3: Final Report (Simulated) - Stops sound
    const t2 = window.setTimeout(() => {
        setDisplayEEW(prev => ({ ...prev, isFinal: true, updatedTime: Date.now() }));
    }, 12000);

    // Step 4: Final Quake Report
    const t3 = window.setTimeout(() => {
        const mockQuake: P2PQuakeData = {
            _id: "sim_" + Date.now(),
            code: 551,
            time: new Date().toISOString(),
            issue: { time: new Date().toISOString(), type: "Focus" },
            earthquake: {
                time: originTime,
                hypocenter: {
                    name: "和歌山県北部",
                    latitude: 34.23,
                    longitude: 135.17,
                    depth: 10,
                    magnitude: 7.2
                },
                maxScale: JMASeismicIntensity.Scale60, 
                domesticTsunami: "Checking"
            },
            points: [
                { pref: "和歌山県", addr: "和歌山市", isArea: false, scale: 60 },
                { pref: "大阪府", addr: "大阪市", isArea: false, scale: 55 },
                { pref: "奈良県", addr: "奈良市", isArea: false, scale: 50 },
                { pref: "徳島県", addr: "徳島市", isArea: false, scale: 45 },
            ]
        };
        setDisplayQuake(mockQuake);
    }, 15000);

    const t4 = window.setTimeout(() => {
        setDisplayEEW({ isActive: false, isWarning: false, isFinal: false, areas: [] });
    }, 25000);

    simulationTimersRef.current.push(t1, t2, t3, t4);
  };

  const toggleSound = () => {
      const newState = !isSoundEnabled;
      setIsSoundEnabled(newState);
      soundService.enabled = newState;
      
      if (newState) {
          soundService.playNotification(); // Feedback
      }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-200 font-sans relative overflow-hidden">
      
      <EEWBanner eew={displayEEW} />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        isDebugMode={isDebugMode}
        setDebugMode={setIsDebugMode}
        isAutoZoomEnabled={isAutoZoomEnabled}
        setAutoZoomEnabled={setIsAutoZoomEnabled}
        onSelectQuake={handleSelectHistoryQuake}
        onStartSimulation={startSimulation}
      />

      <header className={`flex items-center justify-between px-4 md:px-5 py-3 border-b border-slate-900 bg-slate-950 z-20 ${displayEEW.isActive ? 'mt-14' : ''} transition-all duration-300 flex-shrink-0`}>
        <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : mode === 'simulation' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
             <h1 className="text-base font-medium text-slate-300 tracking-tight">Quake Monitor AI</h1>
             
             {mode !== 'live' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 rounded text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {mode === 'simulation' && <TestTube className="w-3 h-3" />}
                    {mode === 'history' && <HistoryIcon className="w-3 h-3" />}
                    {mode}
                </div>
             )}
        </div>

        <div className="flex items-center gap-4">
            {mode === 'live' && (
                <div className="flex items-center gap-1" title="Data Stream Status">
                    <div className={`w-1.5 h-1.5 rounded-full ${p2pStatus === 'connected' ? 'bg-slate-700' : 'bg-red-800'}`} />
                    <div className={`w-1.5 h-1.5 rounded-full ${wolfxStatus === 'connected' ? 'bg-slate-700' : 'bg-red-800'}`} />
                </div>
            )}
            
            <button
                onClick={toggleSound}
                className={`p-1.5 rounded-md transition-all ${isSoundEnabled ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                title={isSoundEnabled ? "Sound On" : "Sound Off"}
            >
                {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
                onClick={handleReturnHome}
                className={`p-1.5 rounded-md transition-all ${mode !== 'live' ? 'text-blue-400 hover:text-blue-300 bg-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                title="Home"
            >
                <Home className="w-4 h-4" />
            </button>

            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                title="Settings"
            >
                <Settings className="w-4 h-4" />
            </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="flex-1 relative bg-slate-950 min-h-0">
            <MapComponent 
              latestQuake={displayQuake} 
              eew={displayEEW} 
              isDebugMode={isDebugMode} 
              isAutoZoomEnabled={isAutoZoomEnabled}
            />
        </div>

        <div className="
            relative z-10 bg-slate-950 flex flex-col shrink-0
            w-full h-[50vh] shadow-[0_-8px_30px_rgba(0,0,0,0.6)] rounded-t-3xl border-t border-slate-800/50 -mt-6
            md:mt-0 md:h-auto md:w-[400px] md:rounded-none md:border-t-0 md:border-l md:border-slate-900 md:shadow-none
        ">
            <InfoPanel data={displayQuake} />
        </div>
      </main>
    </div>
  );
};

export default App;
