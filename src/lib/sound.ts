export function playNotification() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    const play = (freq: number, start: number, duration: number, vol = 0.25) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t + start);
      gain.gain.exponentialRampToValueAtTime(0.001, t + start + duration);
      osc.start(t + start);
      osc.stop(t + start + duration);
    };

    // Dois tons curtos — "ding ding"
    play(880, 0,    0.12);
    play(1100, 0.15, 0.12);
  } catch { /* AudioContext bloqueado pelo navegador antes de interação */ }
}
