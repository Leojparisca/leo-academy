"use client";

/**
 * Leo Academy — Sapphire Acoustic Engine.
 *
 * A hand-built polyphonic Web Audio instrument: additive harmonics with a
 * detuned twin fundamental, per-partial decay, velocity-sensitive dynamic
 * low-pass filter, hammer noise transient and a real ADSR amplitude envelope.
 * It also synthesises the percussion kit (warm kick, defined snare, bright
 * hi-hat, woodblock/click) used by the rhythm laboratory, plus a spaced
 * arpeggio used as a reward. No samples, no beeps.
 */

export type EnginePreset = "rhodes" | "grand" | "glass";
export type PercussionKind = "kick" | "snare" | "hat" | "woodblock" | "click";

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
  extra: AudioNode[];
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
  private silent = false;
  private hasPlayed = false;
  private silenceTimer: number | null = null;

  /** Stable identity for useSyncExternalStore. */
  getReady = () => this.ready;

  /** True when the context is suspended or the output measures as silence. */
  getSilent = () => this.silent;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private setSilent(next: boolean) {
    if (this.silent === next) return;
    this.silent = next;
    this.notify();
  }

  /**
   * Hardware mute is invisible to the Web Audio API, but a suspended context,
   * a zero master volume or a route that never reaches the analyser all show up
   * as silence. Probing shortly after a note starts catches the common cases
   * (iOS silent switch context interruption, muted tab, volume at 0).
   */
  private scheduleSilenceCheck(delay = 360) {
    if (typeof window === "undefined") return;
    if (this.silenceTimer !== null) window.clearTimeout(this.silenceTimer);
    this.silenceTimer = window.setTimeout(() => {
      this.silenceTimer = null;
      this.measureSilence();
    }, delay);
  }

  private measureSilence() {
    const context = this.context;
    if (!context) return;
    if (this.volume <= 0.5) {
      this.setSilent(true);
      return;
    }
    if (context.state !== "running") {
      this.setSilent(true);
      return;
    }
    const analyser = this.analyser;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let energy = 0;
    for (let index = 0; index < data.length; index += 1) {
      const sample = (data[index] - 128) / 128;
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / data.length);
    this.setSilent(rms < 0.0015);
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
      context.onstatechange = () => {
        this.notify();
        if (!this.hasPlayed) return;
        if (context.state !== "running") this.setSilent(true);
        else this.scheduleSilenceCheck(160);
      };
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
      void context
        .resume()
        .then(() => {
          this.notify();
          if (this.hasPlayed) this.scheduleSilenceCheck(160);
        })
        .catch(() => undefined);
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
    if (this.hasPlayed) {
      if (this.volume <= 0.5) this.setSilent(true);
      else if (this.voices.size > 0) this.scheduleSilenceCheck(140);
      // No note is sounding: trust the gesture that raised the volume instead of
      // measuring an empty analyser and re-showing the warning immediately.
      else this.setSilent(false);
    }
  }

  setPreset(preset: EnginePreset) {
    this.preset = preset;
  }

  noteOn(
    midi: number,
    velocity = 0.8,
    { when, wet }: { when?: number; wet?: number } = {},
  ) {
    const context = this.ensureContext();
    if (!context) return false;
    this.hasPlayed = true;
    if (context.state !== "running") void context.resume().catch(() => undefined);
    this.scheduleSilenceCheck();

    const existing = this.voices.get(midi);
    if (existing) this.killVoice(existing, 0.015);

    if (this.voices.size >= this.maxVoices) {
      const oldest = [...this.voices.values()].sort(
        (a, b) => a.startedAt - b.startedAt,
      )[0];
      if (oldest) this.killVoice(oldest, 0.05);
    }

    const voice = this.createVoice(context, midi, clamp(velocity, 0.1, 1), {
      when,
      wet,
    });
    if (!voice) return false;
    this.voices.set(midi, voice);
    return true;
  }

  private createVoice(
    context: AudioContext,
    midi: number,
    velocity: number,
    { when, wet }: { when?: number; wet?: number } = {},
  ): Voice | null {
    if (!this.input || !this.reverbSend) return null;
    const preset = PRESETS[this.preset];
    const now = Math.max(context.currentTime, when ?? context.currentTime + 0.004);
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
    const extra: AudioNode[] = [];
    if (wet && wet > 0) {
      const send = context.createGain();
      send.gain.value = wet;
      panner.connect(send);
      send.connect(this.reverbSend);
      extra.push(send);
    } else {
      panner.connect(this.reverbSend);
    }

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
      extra,
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
    for (const node of voice.extra) {
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

  /**
   * Reward arpeggio: the chord blooms note by note into a wide, reverberated
   * room. Everything is scheduled on the audio clock, so it never drifts.
   */
  playArpeggio(
    midis: number[],
    {
      step = 0.085,
      duration = 1.9,
      velocity = 0.72,
      wet = 0.55,
    }: { step?: number; duration?: number; velocity?: number; wet?: number } = {},
  ) {
    if (!midis.length) return;
    const context = this.ensureContext();
    if (!context) return;
    this.hasPlayed = true;
    if (context.state !== "running") void context.resume().catch(() => undefined);
    this.scheduleSilenceCheck(600 + midis.length * step * 1000);
    const origin = context.currentTime;
    midis.forEach((midi, index) => {
      const start = origin + 0.04 + index * step;
      this.noteOn(midi, Math.max(0.18, velocity - index * 0.012), {
        when: start,
        wet,
      });
      window.setTimeout(
        () => this.forceNoteOff(midi),
        Math.max(80, (start - origin + duration) * 1000),
      );
    });
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
    this.hasPlayed = true;
    if (context.state !== "running") void context.resume().catch(() => undefined);
    this.scheduleSilenceCheck(520);
    const start = when ?? context.currentTime;

    if (kind === "kick") {
      const body = context.createOscillator();
      body.type = "sine";
      body.frequency.setValueAtTime(accent ? 156 : 140, start);
      body.frequency.exponentialRampToValueAtTime(46, start + 0.13);
      const bodyGain = context.createGain();
      bodyGain.gain.setValueAtTime(0.0001, start);
      bodyGain.gain.linearRampToValueAtTime(accent ? 0.82 : 0.66, start + 0.005);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

      // A round sub layer under the beater: warm, never boomy.
      const sub = context.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(62, start);
      sub.frequency.exponentialRampToValueAtTime(48, start + 0.2);
      const subGain = context.createGain();
      subGain.gain.setValueAtTime(0.0001, start);
      subGain.gain.linearRampToValueAtTime(accent ? 0.3 : 0.22, start + 0.008);
      subGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);

      const warmth = context.createBiquadFilter();
      warmth.type = "lowpass";
      warmth.frequency.value = 320;
      warmth.Q.value = 0.55;

      body.connect(bodyGain);
      sub.connect(subGain);
      bodyGain.connect(warmth);
      subGain.connect(warmth);
      this.routeExtra(warmth, 0.14);
      body.start(start);
      body.stop(start + 0.46);
      sub.start(start);
      sub.stop(start + 0.38);

      if (this.noise) {
        const click = context.createBufferSource();
        click.buffer = this.noise;
        const high = context.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = 2400;
        const clickGain = context.createGain();
        clickGain.gain.setValueAtTime(0.1, start);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.022);
        click.connect(high);
        high.connect(clickGain);
        this.routeExtra(clickGain, 0.04);
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
        band.frequency.value = accent ? 2150 : 1900;
        band.Q.value = 0.75;
        const gain = context.createGain();
        gain.gain.setValueAtTime(accent ? 0.46 : 0.36, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
        noise.connect(band);
        band.connect(gain);
        this.routeExtra(gain, 0.3);
        noise.start(start);
        noise.stop(start + 0.2);

        // Bright "crack" that gives the attack its definition.
        const crack = context.createBufferSource();
        crack.buffer = this.noise;
        const high = context.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = 4600;
        const crackGain = context.createGain();
        crackGain.gain.setValueAtTime(accent ? 0.2 : 0.15, start);
        crackGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
        crack.connect(high);
        high.connect(crackGain);
        this.routeExtra(crackGain, 0.18);
        crack.start(start);
        crack.stop(start + 0.09);
      }
      const body = context.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(198, start);
      body.frequency.exponentialRampToValueAtTime(148, start + 0.07);
      const bodyGain = context.createGain();
      bodyGain.gain.setValueAtTime(0.2, start);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      body.connect(bodyGain);
      this.routeExtra(bodyGain, 0.1);
      body.start(start);
      body.stop(start + 0.11);
      return;
    }

    if (kind === "hat") {
      if (this.noise) {
        const noise = context.createBufferSource();
        noise.buffer = this.noise;
        const high = context.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = 7200;
        high.Q.value = 0.7;
        const shimmer = context.createBiquadFilter();
        shimmer.type = "bandpass";
        shimmer.frequency.value = 10800;
        shimmer.Q.value = 0.85;
        const gain = context.createGain();
        const decay = accent ? 0.085 : 0.05;
        gain.gain.setValueAtTime(accent ? 0.19 : 0.125, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        noise.connect(high);
        high.connect(shimmer);
        shimmer.connect(gain);
        this.routeExtra(gain, 0.1);
        noise.start(start);
        noise.stop(start + decay + 0.02);
      }
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
