"use client";

/**
 * Leo Academy — Sapphire Acoustic Engine.
 *
 * A hand-built polyphonic Web Audio instrument: additive harmonics with a
 * detuned twin fundamental, per-partial decay, velocity-sensitive dynamic
 * low-pass filter, hammer noise transient and a real ADSR amplitude envelope.
 * It also synthesises the percussion kit (kick, snare, woodblock/click) used by
 * the rhythm laboratory. No samples, no beeps.
 */

export type EnginePreset = "rhodes" | "grand" | "glass";
export type PercussionKind = "kick" | "snare" | "woodblock" | "click";

type Partial = { ratio: number; gain: number };

type Preset = {
  partials: Partial[];
  detune: number;
  inharmonicity: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  q: number;
  hammer: number;
};

const PRESETS: Record<EnginePreset, Preset> = {
  rhodes: {
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.5 },
      { ratio: 3, gain: 0.26 },
      { ratio: 4, gain: 0.14 },
      { ratio: 5, gain: 0.08 },
      { ratio: 6, gain: 0.045 },
      { ratio: 8, gain: 0.025 },
    ],
    detune: 3.5,
    inharmonicity: 0.0007,
    attack: 0.006,
    decay: 0.55,
    sustain: 0.34,
    release: 0.55,
    cutoff: 2400,
    q: 0.65,
    hammer: 0.16,
  },
  grand: {
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.62 },
      { ratio: 3, gain: 0.34 },
      { ratio: 4, gain: 0.22 },
      { ratio: 5, gain: 0.14 },
      { ratio: 6, gain: 0.09 },
      { ratio: 7, gain: 0.055 },
      { ratio: 8, gain: 0.04 },
      { ratio: 10, gain: 0.022 },
    ],
    detune: 1.4,
    inharmonicity: 0.00035,
    attack: 0.004,
    decay: 0.7,
    sustain: 0.28,
    release: 0.7,
    cutoff: 5200,
    q: 0.45,
    hammer: 0.11,
  },
  glass: {
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.36 },
      { ratio: 3, gain: 0.2 },
      { ratio: 4, gain: 0.13 },
      { ratio: 6, gain: 0.07 },
      { ratio: 8, gain: 0.04 },
      { ratio: 12, gain: 0.02 },
    ],
    detune: 7,
    inharmonicity: 0.0016,
    attack: 0.01,
    decay: 0.85,
    sustain: 0.4,
    release: 1.15,
    cutoff: 8200,
    q: 0.85,
    hammer: 0.05,
  },
};

type Voice = {
  midi: number;
  sources: AudioScheduledSourceNode[];
  amp: GainNode;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  release: number;
  released: boolean;
  sustained: boolean;
  startedAt: number;
  cleanup: number | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Soft saturation keeps dense chords glued instead of clipping. */
function makeSoftClip() {
  const size = 2048;
  const curve = new Float32Array(size);
  const amount = 1.7;
  for (let index = 0; index < size; index += 1) {
    const x = (index * 2) / size - 1;
    curve[index] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

function makeNoise(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 1.5);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Procedural stereo impulse: a small, dark room around the piano. */
function makeImpulse(context: AudioContext, seconds = 2.8): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const t = index / length;
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
    }
  }
  return buffer;
}

class AudioEngine {
  private context: AudioContext | null = null;
  private input: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Map<number, Voice>();
  private listeners = new Set<() => void>();
  private preset: EnginePreset = "rhodes";
  private volume = 72;
  private sustainOn = false;
  private ready = false;
  private maxVoices = 20;

  /** Stable identity for useSyncExternalStore. */
  getReady = () => this.ready;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) listener();
  }

  getAnalyser() {
    return this.analyser;
  }

  now() {
    return this.context?.currentTime ?? 0;
  }

  private volumeToGain(percent: number) {
    return Math.pow(clamp(percent, 0, 100) / 100, 1.6) * 0.92;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;

    try {
      const context = new Ctor({ latencyHint: "interactive" });
      const input = context.createGain();
      input.gain.value = 0.82;

        const shaper = context.createWaveShaper();
      shaper.curve = makeSoftClip();
      shaper.oversample = "4x";

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 20;
      compressor.ratio.value = 3.6;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.22;

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      analyser.minDecibels = -92;
      analyser.maxDecibels = -12;

      const master = context.createGain();
      master.gain.value = this.volumeToGain(this.volume);

      const reverbSend = context.createGain();
      reverbSend.gain.value = 0.2;

      const convolver = context.createConvolver();
      convolver.buffer = makeImpulse(context);

      const reverbReturn = context.createGain();
      reverbReturn.gain.value = 0.55;

      input.connect(shaper);
      shaper.connect(compressor);
      compressor.connect(analyser);
      reverbSend.connect(convolver);
      convolver.connect(reverbReturn);
      reverbReturn.connect(analyser);
      analyser.connect(master);
      master.connect(context.destination);

      this.context = context;
      this.input = input;
      this.reverbSend = reverbSend;
      this.analyser = analyser;
      this.master = master;
      this.noise = makeNoise(context);
      this.ready = true;
      this.notify();
      return context;
    } catch {
      return null;
    }
  }

  unlock() {
    const context = this.ensureContext();
    if (!context) return false;
    if (context.state !== "running") {
      void context.resume().then(() => this.notify()).catch(() => undefined);
    }
    return true;
  }

  setVolume(percent: number) {
    this.volume = clamp(percent, 0, 100);
    const context = this.context;
    if (context && this.master) {
      this.master.gain.setTargetAtTime(
        this.volumeToGain(this.volume),
        context.currentTime,
        0.04,
      );
    }
  }

  setPreset(preset: EnginePreset) {
    this.preset = preset;
  }

  noteOn(midi: number, velocity = 0.8) {
    const context = this.ensureContext();
    if (!context) return false;
    if (context.state !== "running") void context.resume().catch(() => undefined);

    const existing = this.voices.get(midi);
    if (existing) this.killVoice(existing, 0.015);

    if (this.voices.size >= this.maxVoices) {
      const oldest = [...this.voices.values()].sort(
        (a, b) => a.startedAt - b.startedAt,
      )[0];
      if (oldest) this.killVoice(oldest, 0.05);
    }

    const voice = this.createVoice(context, midi, clamp(velocity, 0.1, 1));
    if (!voice) return false;
    this.voices.set(midi, voice);
    return true;
  }

  private createVoice(
    context: AudioContext,
    midi: number,
    velocity: number,
  ): Voice | null {
    if (!this.input || !this.reverbSend) return null;
    const preset = PRESETS[this.preset];
    const now = context.currentTime + 0.004;
    const base = 440 * Math.pow(2, (midi - 69) / 12);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = preset.q;
    const register = clamp((midi - 60) / 48, -0.35, 0.6);
    const cutStart = clamp(
      preset.cutoff * (0.8 + velocity * 0.8) * (0.88 + register * 0.5),
      420,
      context.sampleRate * 0.42,
    );
    filter.frequency.setValueAtTime(cutStart, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(360, cutStart * 0.34),
      now + 0.55,
    );

    const amp = context.createGain();
    const peak = 0.15 * (0.42 + velocity * 0.78);
    const sustain = Math.max(0.0002, peak * preset.sustain);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(peak, now + preset.attack);
    amp.gain.exponentialRampToValueAtTime(
      sustain,
      now + preset.attack + preset.decay,
    );
    // Natural piano decay even if the key is held for a very long time.
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 13.5);

    const panner = context.createStereoPanner();
    panner.pan.value = clamp(((midi - 64) / 48) * 0.32, -0.3, 0.3);

    filter.connect(amp);
    amp.connect(panner);
    panner.connect(this.input);
    panner.connect(this.reverbSend);

    const sources: AudioScheduledSourceNode[] = [];

    const addOscillator = (
      frequency: number,
      gainValue: number,
      detune: number,
      decayScale: number,
      type: OscillatorType,
    ) => {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainValue, now + preset.attack);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, gainValue * 0.11),
        now + preset.attack + preset.decay * decayScale,
      );
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start(now);
      sources.push(oscillator);
    };

    preset.partials.forEach((partial, index) => {
      const frequency =
        base *
        partial.ratio *
        Math.sqrt(1 + preset.inharmonicity * partial.ratio * partial.ratio);
      const gainValue = partial.gain * (0.62 + velocity * 0.5);
      addOscillator(
        frequency,
        gainValue,
        -preset.detune - (index % 2) * 1.4,
        1 + index * 0.22,
        index === 0 ? "triangle" : "sine",
      );
      if (index < 3) {
        addOscillator(
          frequency,
          gainValue * (index === 0 ? 0.55 : 0.3),
          preset.detune + (index % 2) * 2.2,
          1 + index * 0.3,
          "sine",
        );
      }
    });

    if (this.noise) {
      const hammer = context.createBufferSource();
      hammer.buffer = this.noise;
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1400 + velocity * 2100;
      band.Q.value = 0.9;
      const hammerGain = context.createGain();
      hammerGain.gain.setValueAtTime(
        Math.max(0.0002, preset.hammer * velocity),
        now,
      );
      hammerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      hammer.connect(band);
      band.connect(hammerGain);
      hammerGain.connect(filter);
      hammer.start(now);
      hammer.stop(now + 0.09);
      sources.push(hammer);
    }

    const voice: Voice = {
      midi,
      sources,
      amp,
      filter,
      panner,
      release: preset.release,
      released: false,
      sustained: false,
      startedAt: now,
      cleanup: null,
    };

    voice.cleanup = window.setTimeout(() => {
      if (this.voices.get(midi) === voice) this.voices.delete(midi);
      this.disposeVoice(voice);
    }, 13900);

    return voice;
  }

  noteOff(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    if (this.sustainOn) {
      voice.sustained = true;
      return;
    }
    this.releaseVoice(voice);
  }

  private releaseVoice(voice: Voice) {
    if (voice.released) return;
    voice.released = true;
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    const release = Math.max(0.09, voice.release);
    if (voice.cleanup) window.clearTimeout(voice.cleanup);
    try {
      voice.amp.gain.cancelAndHoldAtTime(now);
    } catch {
      voice.amp.gain.cancelScheduledValues(now);
    }
    voice.amp.gain.exponentialRampToValueAtTime(0.0001, now + release);
    for (const source of voice.sources) {
      try {
        source.stop(now + release + 0.04);
      } catch {
        /* Already stopped. */
      }
    }
    voice.cleanup = window.setTimeout(() => {
      if (this.voices.get(voice.midi) === voice) this.voices.delete(voice.midi);
      this.disposeVoice(voice);
    }, (release + 0.2) * 1000);
  }

  private killVoice(voice: Voice, fade = 0.03) {
    if (this.voices.get(voice.midi) === voice) this.voices.delete(voice.midi);
    if (voice.released) return;
    voice.released = true;
    const context = this.context;
    if (context) {
      const now = context.currentTime;
      if (voice.cleanup) window.clearTimeout(voice.cleanup);
      try {
        voice.amp.gain.cancelAndHoldAtTime(now);
      } catch {
        voice.amp.gain.cancelScheduledValues(now);
      }
      voice.amp.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      for (const source of voice.sources) {
        try {
          source.stop(now + fade + 0.02);
        } catch {
          /* Already stopped. */
        }
      }
      voice.cleanup = window.setTimeout(
        () => this.disposeVoice(voice),
        (fade + 0.1) * 1000,
      );
    } else {
      this.disposeVoice(voice);
    }
  }

  private disposeVoice(voice: Voice) {
    if (voice.cleanup) window.clearTimeout(voice.cleanup);
    for (const source of voice.sources) {
      try {
        source.stop();
      } catch {
        /* Already stopped. */
      }
      try {
        source.disconnect();
      } catch {
        /* Already disconnected. */
      }
    }
    for (const node of [voice.filter, voice.amp, voice.panner]) {
      try {
        node.disconnect();
      } catch {
        /* Already disconnected. */
      }
    }
  }

  setSustain(on: boolean) {
    this.sustainOn = on;
    if (!on) {
      for (const voice of this.voices.values()) {
        if (voice.sustained) this.releaseVoice(voice);
      }
    }
  }

  releaseAll() {
    for (const voice of [...this.voices.values()]) {
      this.killVoice(voice, 0.05);
    }
  }

  forceNoteOff(midi: number) {
    const voice = this.voices.get(midi);
    if (voice) this.releaseVoice(voice);
  }

  playNote(midi: number, duration = 1.8, velocity = 0.78) {
    if (!this.noteOn(midi, velocity)) return;
    window.setTimeout(() => this.forceNoteOff(midi), duration * 1000);
  }

  playChord(midis: number[], duration = 1.8, velocity = 0.74) {
    for (const midi of midis) this.noteOn(midi, velocity);
    window.setTimeout(() => {
      for (const midi of midis) this.forceNoteOff(midi);
    }, duration * 1000);
  }

  private routeExtra(node: AudioNode, wet = 0.3) {
    if (!this.input || !this.reverbSend) return;
    const send = this.context?.createGain();
    if (!send) return;
    send.gain.value = wet;
    node.connect(this.input);
    node.connect(send);
    send.connect(this.reverbSend);
  }

  playPercussion(
    kind: PercussionKind,
    { accent = false, when }: { accent?: boolean; when?: number } = {},
  ) {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state !== "running") void context.resume().catch(() => undefined);
    const start = when ?? context.currentTime;

    if (kind === "kick") {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(accent ? 158 : 142, start);
      oscillator.frequency.exponentialRampToValueAtTime(44, start + 0.12);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(accent ? 0.85 : 0.68, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      oscillator.connect(gain);
      this.routeExtra(gain, 0.16);
      oscillator.start(start);
      oscillator.stop(start + 0.44);

      if (this.noise) {
        const click = context.createBufferSource();
        click.buffer = this.noise;
        const high = context.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = 1800;
        const clickGain = context.createGain();
        clickGain.gain.setValueAtTime(0.12, start);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.025);
        click.connect(high);
        high.connect(clickGain);
        this.routeExtra(clickGain, 0.05);
        click.start(start);
        click.stop(start + 0.05);
      }
      return;
    }

    if (kind === "snare") {
      if (this.noise) {
        const noise = context.createBufferSource();
        noise.buffer = this.noise;
        const band = context.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = accent ? 2200 : 1850;
        band.Q.value = 0.8;
        const gain = context.createGain();
        gain.gain.setValueAtTime(accent ? 0.5 : 0.38, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
        noise.connect(band);
        band.connect(gain);
        this.routeExtra(gain, 0.32);
        noise.start(start);
        noise.stop(start + 0.22);
      }
      const body = context.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(196, start);
      body.frequency.exponentialRampToValueAtTime(140, start + 0.08);
      const bodyGain = context.createGain();
      bodyGain.gain.setValueAtTime(0.22, start);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      body.connect(bodyGain);
      this.routeExtra(bodyGain, 0.12);
      body.start(start);
      body.stop(start + 0.12);
      return;
    }

    // Woodblock and metronome click.
    const base = kind === "woodblock" ? 980 : 1180;
    const pitch = accent ? base * 1.18 : base;
    for (const [ratio, gainValue] of [
      [1, 0.4],
      [1.63, 0.16],
    ] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(pitch * ratio, start);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(
        gainValue * (accent ? 1.15 : 0.9),
        start + 0.002,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.065);
      oscillator.connect(gain);
      this.routeExtra(gain, 0.18);
      oscillator.start(start);
      oscillator.stop(start + 0.08);
    }
    if (kind === "woodblock" && this.noise) {
      const tick = context.createBufferSource();
      tick.buffer = this.noise;
      const high = context.createBiquadFilter();
      high.type = "bandpass";
      high.frequency.value = 3400;
      high.Q.value = 1.2;
      const gain = context.createGain();
      gain.gain.setValueAtTime(accent ? 0.14 : 0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.022);
      tick.connect(high);
      high.connect(gain);
      this.routeExtra(gain, 0.1);
      tick.start(start);
      tick.stop(start + 0.04);
    }
  }
}

let engine: AudioEngine | null = null;

/** One shared instrument for the whole session: instant, warm, always in tune. */
export function getAudioEngine() {
  if (!engine) engine = new AudioEngine();
  return engine;
}
