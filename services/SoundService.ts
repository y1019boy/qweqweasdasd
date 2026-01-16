// =============================================================================
// 【設定】音声合成用素材 (Base64コード入力欄)
// =============================================================================
// 以下の各キーに対応する音声ファイルのBase64文字列を入力してください。
// 例: "data:audio/mp3;base64,AAAA..." または "AAAA..."

const VOICE_ASSETS: { [key: string]: string } = {
  // --- 数字 ---
  "0": "", "1": "", "2": "", "3": "", "4": "", 
  "5": "", "6": "", "7": "", "8": "", "9": "",
  "10": "",   // 「じゅう」
  "100": "",  // 「ひゃく」
  "1000": "", // 「せん」

  // --- 単位・区切り ---
  "point": "", // 小数点「てん」
  "ji": "",    // 「じ」 (時)
  "fun": "",   // 「ふん」 (分)
  "byou": "",  // 「びょう」 (秒)
  "km": "",    // 「キロメートル」
  
  // --- 時間 ---
  "gozen": "", // 「ごぜん」
  "gogo": "",  // 「ごご」

  // --- 地震用語 ---
  "jishin": "",   // 「地震」
  "sokuhou": "",  // 「速報」
  "eew_yohou": "",  // 「緊急地震速報、予報」
  "eew_keihou": "", // 「緊急地震速報、警報」
  
  "shindo": "",   // 「震度」
  "jaku": "",     // 「弱」
  "kyou": "",     // 「強」
  
  "shingen": "",     // 「震源地は」
  "magnitude": "",   // 「マグニチュード」
  "fukasa": "",      // 「深さは」
  
  "desu": "",        // 「です」
  "arimasita": "",   // 「ありました」
  "kaijo": "",       // 「解除されました」
  
  // --- その他通知音 ---
  "chime": "",       // チャイム音（ピンポンパンポン）
  "ping": "",        // 単発通知音
};

// =============================================================================

export class SoundService {
  private ctx: AudioContext | null = null;
  private loopInterval: number | null = null;
  private _enabled: boolean = false;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) {
        this.ctx = new AC();
    }
  }

  public set enabled(val: boolean) {
    this._enabled = val;
    if (val && this.ctx?.state === 'suspended') {
        this.ctx.resume().catch(e => console.error("Audio resume failed", e));
    }
    if (!val) {
        this.stopAlarm();
    }
  }

  public get enabled() {
      return this._enabled;
  }

  /**
   * Base64文字列をAudioBufferに変換してキャッシュする
   */
  private async getAudioBuffer(key: string): Promise<AudioBuffer | null> {
      if (!this.ctx) return null;
      if (this.audioBufferCache.has(key)) return this.audioBufferCache.get(key)!;

      const base64Data = VOICE_ASSETS[key];
      if (!base64Data) return null;

      try {
        const cleanBase64 = base64Data.replace(/^data:audio\/.*?;base64,/, '');
        const binaryString = window.atob(cleanBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // decodeAudioDataはArrayBufferの所有権を奪うことがあるためスライスを渡す
        const buffer = await this.ctx.decodeAudioData(bytes.buffer.slice(0));
        this.audioBufferCache.set(key, buffer);
        return buffer;
      } catch (e) {
        console.warn(`Failed to decode audio for key: ${key}`, e);
        return null;
      }
  }

  /**
   * 音声キーの配列を受け取り、順番に再生する（文をつなげる）
   */
  private async playSequence(keys: string[]) {
      if (!this._enabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      // 全てのバッファを先にロード
      const buffers: AudioBuffer[] = [];
      for (const key of keys) {
          const buf = await this.getAudioBuffer(key);
          if (buf) buffers.push(buf);
      }

      if (buffers.length === 0) return;

      // 順番に再生スケジュールを組む
      let startTime = this.ctx.currentTime;
      // 少し未来から開始して安定させる
      startTime += 0.1; 

      for (const buffer of buffers) {
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.ctx.destination);
          source.start(startTime);
          startTime += buffer.duration;
      }
  }

  /**
   * 数字を読み上げるためのキー配列を生成する (0-999まで対応)
   */
  private getNumberKeys(num: number): string[] {
      const keys: string[] = [];
      let n = Math.floor(num);
      
      if (n < 0 || n >= 10000) {
          // 簡易実装のため、範囲外はそのまま文字化
          keys.push(n.toString());
          return keys;
      }

      // 1000の位 (簡易)
      if (n >= 1000) {
          const thousand = Math.floor(n / 1000);
          n %= 1000;
          if (thousand > 1) keys.push(thousand.toString());
          keys.push("1000"); // 「せん」
      }

      // 100の位
      if (n >= 100) {
          const hundred = Math.floor(n / 100);
          n %= 100;
          // 100は「ひゃく」 (いっぴゃく とかは考慮せず簡易的に)
          if (hundred > 1) keys.push(hundred.toString());
          keys.push("100"); // 「ひゃく」
      }

      // 10の位
      if (n >= 10) {
          const ten = Math.floor(n / 10);
          n %= 10;
          if (ten > 1) keys.push(ten.toString());
          keys.push("10"); // 「じゅう」
      }

      // 1の位
      if (n > 0) {
          keys.push(n.toString());
      } else if (keys.length === 0) {
          // 元の数が0の場合
          keys.push("0");
      }

      return keys;
  }

  /**
   * 時刻読み上げキー生成
   */
  private getTimeKeys(dateStr?: string): string[] {
      const d = dateStr ? new Date(dateStr) : new Date();
      const h = d.getHours();
      const m = d.getMinutes();
      
      const keys: string[] = [];
      
      // 午前/午後
      keys.push(h < 12 ? "gozen" : "gogo");
      
      // 時 (12時間表記変換)
      const hour12 = h % 12 || 12;
      keys.push(...this.getNumberKeys(hour12));
      keys.push("ji");
      
      // 分
      if (m === 0) {
          // ジャストの時は「0分」とは言わないことが多いが、ここでは省略
      } else {
          keys.push(...this.getNumberKeys(m));
          keys.push("fun");
      }
      
      return keys;
  }

  /**
   * 震度読み上げキー生成
   */
  private getIntensityKeys(scaleStr: string | undefined): string[] {
      if (!scaleStr) return [];
      const keys: string[] = ["shindo"];
      
      // 例: "5弱" -> "5", "jaku"
      const numPart = scaleStr.replace(/[弱強\-\+]/g, '');
      const suffix = scaleStr.includes('弱') || scaleStr.includes('-') ? 'jaku' 
                   : scaleStr.includes('強') || scaleStr.includes('+') ? 'kyou' 
                   : null;

      if (numPart) keys.push(numPart);
      if (suffix) keys.push(suffix);
      
      return keys;
  }

  /**
   * 単純な電子音（フォールバック用）
   */
  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.5) {
      if (!this._enabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
  }

  // --- Public Methods ---

  // 緊急地震速報（予報）受信時
  public async playForecast() {
      // 素材があれば: チャイム -> "緊急地震速報、予報"
      if (VOICE_ASSETS["chime"] || VOICE_ASSETS["eew_yohou"]) {
          await this.playSequence(["chime", "eew_yohou"]);
      } else {
          this.playTone(660, 'sine', 0.5, 0.3);
      }
  }

  // 地震情報受信時 (例: チャイム -> x時x分頃 -> 地震がありました -> 震源地は [省略] -> マグニチュード x -> 深さは x キロ -> 震度x)
  public async playQuakeInfo(data?: any) {
      if (!this._enabled) return;
      
      // ベースアセットチェック
      if (!VOICE_ASSETS["jishin"]) {
          this.playTone(440, 'sine', 0.5, 0.3);
          return;
      }

      const seq: string[] = ["chime"];

      // 時刻
      if (data?.earthquake?.time) {
          seq.push(...this.getTimeKeys(data.earthquake.time));
          seq.push("jishin", "arimasita"); // ～地震がありました
      } else {
          seq.push("jishin", "sokuhou"); // 地震速報
      }

      // マグニチュード読み上げ
      if (data?.earthquake?.hypocenter?.magnitude && data.earthquake.hypocenter.magnitude !== -1) {
        seq.push("magnitude");
        const mag = data.earthquake.hypocenter.magnitude;
        const magInt = Math.floor(mag);
        const magDec = Math.round((mag - magInt) * 10);
        
        seq.push(...this.getNumberKeys(magInt));
        if (magDec > 0) {
            seq.push("point");
            seq.push(...this.getNumberKeys(magDec));
        }
      }

      // 深さ読み上げ
      if (data?.earthquake?.hypocenter?.depth !== undefined && data.earthquake.hypocenter.depth !== -1) {
          const depth = data.earthquake.hypocenter.depth;
          if (depth === 0) {
             // ごく浅い (アセットがないのでスキップか、0kmと読む)
             // seq.push("fukasa", "0", "km"); 
          } else {
             seq.push("fukasa"); // 「深さは」
             seq.push(...this.getNumberKeys(depth));
             seq.push("km"); // 「キロメートル」
          }
      }

      // 震度 (最大震度)
      if (data?.earthquake?.maxScale) {
          let scaleStr = "";
          const s = data.earthquake.maxScale;
          if (s === 10) scaleStr = "1";
          if (s === 20) scaleStr = "2";
          if (s === 30) scaleStr = "3";
          if (s === 40) scaleStr = "4";
          if (s === 45) scaleStr = "5弱";
          if (s === 50) scaleStr = "5強";
          if (s === 55) scaleStr = "6弱";
          if (s === 60) scaleStr = "6強";
          if (s === 70) scaleStr = "7";
          
          if (scaleStr) {
             seq.push(...this.getIntensityKeys(scaleStr)); // 震度〇
          }
      }

      await this.playSequence(seq);
  }

  // その他通知（キャンセル、最終報など）
  public async playNotification() {
      if (VOICE_ASSETS["ping"]) {
          await this.playSequence(["ping"]);
      } else {
          this.playTone(880, 'sine', 0.3, 0.2);
      }
  }

  // 緊急地震速報（警報）のループ音（これだけは指定により電子音）
  public playPong() {
      this.playTone(784, 'sine', 1.2, 0.5);
  }

  public startAlarm() {
      if (this.loopInterval) return;
      this.playPong();
      this.loopInterval = window.setInterval(() => {
          this.playPong();
      }, 1000); 
  }

  public stopAlarm() {
      if (this.loopInterval) {
          window.clearInterval(this.loopInterval);
          this.loopInterval = null;
      }
  }
}

export const soundService = new SoundService();
