import { GoogleGenAI } from "@google/genai";
import { JMASeismicIntensity, P2PQuakeData } from "../types";

const formatIntensity = (scale: JMASeismicIntensity): string => {
  switch (scale) {
    case 10: return "1";
    case 20: return "2";
    case 30: return "3";
    case 40: return "4";
    case 45: return "5弱";
    case 50: return "5強";
    case 55: return "6弱";
    case 60: return "6強";
    case 70: return "7";
    default: return "不明";
  }
};

export const getEarthquakeAdvice = async (quake: P2PQuakeData): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Cannot fetch safety advice.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";

  const intensityStr = formatIntensity(quake.earthquake.maxScale);
  const location = quake.earthquake.hypocenter?.name || "不明な地域";
  
  const depthVal = quake.earthquake.hypocenter?.depth;
  const depth = depthVal === -1 ? "不明" : depthVal === 0 ? "ごく浅い" : `${depthVal}km`;
  
  const mag = quake.earthquake.hypocenter?.magnitude !== -1 ? `M${quake.earthquake.hypocenter?.magnitude}` : "不明";
  
  const tsunamiInfo = quake.earthquake.domesticTsunami === "None" 
    ? "津波の心配なし" 
    : quake.earthquake.domesticTsunami;

  const prompt = `
    只今、日本で地震が発生しました。以下の情報に基づき、被災地域または周辺地域の人々に向けた、簡潔で落ち着いた安全確保のアドバイスを3つ箇条書きで提供してください。
    
    情報:
    - 震源地: ${location}
    - 最大震度: ${intensityStr}
    - マグニチュード: ${mag}
    - 深さ: ${depth}
    - 津波情報: ${tsunamiInfo}

    出力形式:
    - 落ち着いたトーンで。
    - 3つの具体的なアクション（箇条書き）。
    - 最後に一言、励ましの言葉。
    - 日本語で出力してください。
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep thought for emergency advice
      }
    });
    return response.text || "情報を取得できませんでした。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "安全情報を取得中にエラーが発生しました。身の安全を最優先に行動してください。";
  }
};