let actx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientStarted = false;
let muted = false;

export function initAudio(initialMuted = false): void {
  if (actx) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    actx = new Ctx();
    masterGain = actx.createGain();
    masterGain.gain.value = initialMuted ? 0 : 0.5;
    masterGain.connect(actx.destination);
    muted = initialMuted;
    startAmbient();
  } catch { /* ignore */ }
}

export function setMuted(m: boolean): void {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.5;
}

export function isMuted(): boolean { return muted; }

export function resumeAudio(): void {
  if (actx && actx.state === 'suspended') actx.resume();
}

function startAmbient(): void {
  if (!actx || !masterGain || ambientStarted) return;
  const drone = actx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 55;
  const drone2 = actx.createOscillator(); drone2.type = 'sine'; drone2.frequency.value = 82.4;
  const noise = actx.createBufferSource();
  const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  noise.buffer = buf; noise.loop = true;
  const filt = actx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 400; filt.Q.value = 0.5;
  const ambGain = actx.createGain(); ambGain.gain.value = 0.04;
  const droneGain = actx.createGain(); droneGain.gain.value = 0.025;
  drone.connect(droneGain); drone2.connect(droneGain); droneGain.connect(masterGain);
  noise.connect(filt); filt.connect(ambGain); ambGain.connect(masterGain);
  const lfo = actx.createOscillator(); lfo.frequency.value = 0.1;
  const lfoGain = actx.createGain(); lfoGain.gain.value = 200;
  lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
  drone.start(); drone2.start(); noise.start(); lfo.start();
  ambientStarted = true;
}

function beep(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, attack = 0.005): void {
  if (!actx || !masterGain) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  const t = actx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + dur + 0.02);
}

export const Audio = {
  buy(): void {
    beep(800, 0.04, 'triangle', 0.08);
    setTimeout(() => beep(1200, 0.05, 'triangle', 0.06), 35);
  },
  sellProfit(): void {
    beep(1046, 0.06, 'square', 0.10);
    setTimeout(() => beep(1318, 0.06, 'square', 0.10), 60);
    setTimeout(() => beep(1568, 0.12, 'triangle', 0.10), 120);
    setTimeout(() => beep(2093, 0.18, 'sine', 0.08), 200);
    setTimeout(() => {
      if (!actx || !masterGain) return;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = 2500;
      g.gain.setValueAtTime(0.08, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.5);
      o.connect(g); g.connect(masterGain);
      o.start(); o.stop(actx.currentTime + 0.5);
    }, 150);
  },
  sellLoss(): void {
    beep(220, 0.15, 'sawtooth', 0.08);
    setTimeout(() => beep(165, 0.2, 'sawtooth', 0.08), 100);
  },
  crash(): void {
    if (!actx || !masterGain) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        beep(440, 0.15, 'sawtooth', 0.12);
        setTimeout(() => beep(220, 0.15, 'sawtooth', 0.12), 80);
      }, i * 180);
    }
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(80, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(30, actx.currentTime + 1);
    g.gain.setValueAtTime(0.15, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 1);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(actx.currentTime + 1.1);
  },
  boom(): void {
    beep(440, 0.08, 'square', 0.08);
    setTimeout(() => beep(659, 0.1, 'square', 0.09), 70);
    setTimeout(() => beep(880, 0.18, 'sine', 0.1), 140);
  },
  click(): void { beep(600, 0.02, 'square', 0.05); },
  success(): void {
    beep(523.25, 0.05, 'sine', 0.12);
    setTimeout(() => beep(659.25, 0.05, 'sine', 0.12), 40);
    setTimeout(() => beep(783.99, 0.05, 'sine', 0.12), 80);
    setTimeout(() => beep(1046.5, 0.12, 'triangle', 0.1), 120);
  },
  error(): void {
    beep(196, 0.08, 'sawtooth', 0.10);
    setTimeout(() => beep(185, 0.15, 'sawtooth', 0.10), 60);
  },
};
