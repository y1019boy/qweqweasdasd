// A wrapper for the Web Speech API.
// To use Aquestalk (Yukkuri Voice), you would replace the implementation inside 'speak' 
// with your Aquestalk WASM library calls.

class SpeechService {
  private synth: SpeechSynthesis;
  private queue: string[] = [];
  private isSpeaking: boolean = false;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    if (this.synth) {
        // Try to load voices
        this.synth.onvoiceschanged = () => {
            const voices = this.synth.getVoices();
            // Try to find a Japanese voice
            this.voice = voices.find(v => v.lang === 'ja-JP') || null;
        };
    }
  }

  public speak(text: string) {
    if (!this.synth) return;

    // Cancel current speech if it's just a generic queue, 
    // but for earthquakes, we might want to queue them.
    // For urgency, let's cancel previous non-urgent messages.
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.1; // Slightly faster for alerts
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (this.voice) {
        utterance.voice = this.voice;
    }

    this.synth.speak(utterance);
  }

  public cancel() {
    if (this.synth) {
        this.synth.cancel();
    }
  }
}

export const speechService = new SpeechService();
