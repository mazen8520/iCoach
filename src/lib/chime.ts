// Rest-timer "done" chime, synthesized with the Web Audio API rather than shipping an audio
// asset. Mobile/desktop autoplay policies require the AudioContext to be created or resumed
// from within a real user gesture — call `unlockChimeAudio()` from the click handler that
// starts the rest timer, then `playRestChime()` later (e.g. from a `setTimeout` callback) works
// reliably without needing another gesture.
let audioContext: AudioContext | null = null;

export function unlockChimeAudio() {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  if (!audioContext) audioContext = new Ctor();
  if (audioContext.state === "suspended") void audioContext.resume();
}

/** A short two-tone "ding" — noticeable but not long or annoying. Plays once. */
export function playRestChime() {
  const ctx = audioContext;
  if (!ctx) return;
  const now = ctx.currentTime;

  const playTone = (freq: number, start: number, duration: number) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, now + start);
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.3, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now + start);
    oscillator.stop(now + start + duration + 0.02);
  };

  playTone(880, 0, 0.18);
  playTone(1174.66, 0.16, 0.28);
}
