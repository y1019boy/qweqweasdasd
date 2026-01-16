
// P2P Quake API Types

export enum JMASeismicIntensity {
  Scale10 = 10, // 1
  Scale20 = 20, // 2
  Scale30 = 30, // 3
  Scale40 = 40, // 4
  Scale45 = 45, // 5-
  Scale50 = 50, // 5+
  Scale55 = 55, // 6-
  Scale60 = 60, // 6+
  Scale70 = 70, // 7
  Unknown = -1
}

export interface QuakePoint {
  pref: string;
  addr: string;
  isArea: boolean;
  scale: JMASeismicIntensity;
}

export interface QuakeIssue {
  time: string;
  type: string;
}

export interface QuakeEarthquake {
  time: string;
  hypocenter?: {
    name: string;
    latitude: number;
    longitude: number;
    depth: number; // in km, -1 if unknown
    magnitude: number; // -1 if unknown
  };
  maxScale: JMASeismicIntensity;
  domesticTsunami?: string; // None, Checking, NonEffective, Watch, Warning
}

export interface P2PQuakeData {
  _id: string;
  code: number; // 551: Earthquake, 554: EEW, 556: EEW Test/Cancel, 9611: User Report
  time: string;
  issue: QuakeIssue;
  earthquake: QuakeEarthquake;
  points: QuakePoint[];
  areas?: {
    pref: string;
    name: string;
    scaleFrom: JMASeismicIntensity;
    scaleTo: JMASeismicIntensity;
  }[];
  cancelled?: boolean;
}

export interface EEWState {
  isActive: boolean;
  isWarning: boolean; // True if it's a "Warning" (Alarm), False if "Forecast"
  isFinal?: boolean; // True if this is the final report
  hypocenterName?: string;
  magnitude?: number;
  depth?: number;
  maxIntensity?: string; // Wolfx often sends string "4", "5+" etc
  areas: string[]; // List of area/prefecture names targeted
  occurredTime?: string;
  title?: string;
  updatedTime?: number; // Internal timestamp for timeout logic
}

// Wolfx API Types (Approximate)
export interface WolfxEEWData {
  Type: string;
  Title: string;
  Hypocenter: string;
  Magnitude: string;
  Depth?: string; // "10km" etc
  MaxIntensity: string;
  AnnouncedTime: string;
  EventID: string;
  isCancel?: boolean;
  isFinal?: boolean;
  // Warning areas are not always provided in simple stream, but we can infer state
}
