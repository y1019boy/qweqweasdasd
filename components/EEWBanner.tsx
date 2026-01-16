import React from 'react';
import { EEWState } from '../types';
import { AlertTriangle, BellRing } from 'lucide-react';

interface Props {
  eew: EEWState;
}

export const EEWBanner: React.FC<Props> = ({ eew }) => {
  if (!eew.isActive) return null;

  const isWarning = eew.isWarning;
  const mag = eew.magnitude ? `M${eew.magnitude.toFixed(1)}` : 'M不明';
  const depth = eew.depth ? `${eew.depth}km` : '深さ不明';
  const intensity = eew.maxIntensity ? `最大震度${eew.maxIntensity}` : '';

  return (
    <div className={`fixed top-0 left-0 w-full z-50 ${isWarning ? 'bg-red-600' : 'bg-yellow-500'} text-white shadow-xl`}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 md:gap-4">
            {isWarning ? <BellRing className="w-6 h-6 md:w-8 md:h-8 animate-bounce" /> : <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />}
            <div>
                <h2 className="text-base md:text-xl font-bold leading-none mb-1">
                    {isWarning ? '緊急地震速報（警報）' : '緊急地震速報（予報）'}
                </h2>
                <div className="text-xs md:text-sm font-medium opacity-90">
                   {isWarning ? '強い揺れに警戒' : '今後の情報に注意'}
                   {intensity && <span className="ml-2 font-bold bg-white/20 px-1.5 rounded">{intensity}</span>}
                </div>
            </div>
        </div>
        
        <div className="text-right">
             <div className="text-[10px] opacity-75 uppercase tracking-wider mb-0.5">Epicenter</div>
             <div className="font-bold text-base md:text-xl leading-none mb-1">{eew.hypocenterName || "調査中"}</div>
             <div className="flex items-center justify-end gap-3 text-xs md:text-sm font-mono opacity-90">
                <span>{mag}</span>
                <span className="w-px h-3 bg-white/40"></span>
                <span>{depth}</span>
             </div>
        </div>
      </div>
      
      {eew.areas.length > 0 && (
          <div className={`${isWarning ? 'bg-red-700' : 'bg-yellow-600'} px-4 md:px-6 py-1.5 text-xs overflow-hidden whitespace-nowrap flex items-center`}>
              <span className="font-bold mr-2 opacity-75">TARGET:</span>
              <div className="inline-block font-medium">
                  {eew.areas.join(" ")}
              </div>
          </div>
      )}
    </div>
  );
};