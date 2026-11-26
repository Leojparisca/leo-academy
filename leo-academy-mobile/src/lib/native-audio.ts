import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { getDatabase } from "./database";

const SAMPLE_RATE = 22_050;
const PIANO_FIRST_MIDI = 48; // C3
const PIANO_LAST_MIDI = 79; // G5
const LATENCY_KEY = "device_latency_offset_ms";
export type PianoNote = number;
export type PercussionKind = "kick" | "snare" | "hihat" | "metronome";

const players = new Map<string, AudioPlayer>();
let bootPromise: Promise<boolean> | null = null;
let audioReady = false;

export function measureMonotonicTime() {
  return globalThis.performance?.now?.() ?? Date.now();
}

/** Schedule against the monotonic JS clock; returns a cancellation function. */
export function scheduleAt(targetMs: number, callback: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    const remaining = targetMs - measureMonotonicTime();
    if (remaining > 4) timer = setTimeout(tick, Math.max(1, remaining - 2));
    else callback();
  };
  tick();
  return () => { cancelled = true; if (timer) clearTimeout(timer); };
}

function midiFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function pianoSamples(midi: number) {
  const duration = 0.85;
  const frames = Math.floor(SAMPLE_RATE * duration);
  const fundamental = midiFrequency(midi);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.012);
    const decay = Math.exp(-3.9 * t);
    const tone = Math.sin(2 * Math.PI * fundamental * t)
      + 0.34 * Math.sin(2 * Math.PI * fundamental * 2.01 * t)
      + 0.14 * Math.sin(2 * Math.PI * fundamental * 3.98 * t)
      + 0.055 * Math.sin(2 * Math.PI * fundamental * 6.1 * t);
    samples[i] = Math.tanh(tone * 0.55) * attack * decay * 0.68;
  }
  return samples;
}

function percussionSamples(kind: PercussionKind, accented = false) {
  const duration = kind === "kick" ? 0.48 : kind === "snare" ? 0.3 : kind === "hihat" ? 0.12 : 0.16;
  const frames = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(frames);
  let noise = 0x6d2b79f5;
  const random = () => {
    noise = Math.imul(noise ^ (noise >>> 15), noise | 1);
    noise ^= noise + Math.imul(noise ^ (noise >>> 7), noise | 61);
    return ((noise ^ (noise >>> 14)) >>> 0) / 4_294_967_296;
  };
  const gain = accented ? 1 : 0.72;
  for (let i = 0; i < frames; i += 1) {
    const t = i / SAMPLE_RATE;
    const p = t / duration;
    const n = random() * 2 - 1;
    if (kind === "kick") {
      const frequency = 45 + 110 * Math.exp(-t * 21);
      samples[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 9) * gain * 0.82;
    } else if (kind === "snare") {
      const noisePart = n * Math.exp(-t * 18);
      const body = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 25);
      samples[i] = (noisePart * 0.72 + body * 0.28) * gain * 0.62;
    } else if (kind === "hihat") {
      samples[i] = n * Math.exp(-t * 40) * gain * 0.32;
    } else {
      const frequency = accented ? 1_720 : 1_260;
      samples[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 28) * gain * 0.52;
    }
    // Short cosine tail prevents a click when the PCM sample ends.
    if (p > 0.9) samples[i] *= Math.max(0, (1 - p) / 0.1);
  }
  return samples;
}

function wavBytes(samples: Float32Array) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
  };
  ascii(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? value * 32_768 : value * 32_767, true);
  }
  return bytes;
}

async function waitForPlayer(player: AudioPlayer) {
  if (player.isLoaded) return true;
  return new Promise<boolean>((resolve) => {
    let done = false;
    let subscription: { remove(): void } | undefined;
    const finish = (loaded: boolean) => {
      if (done) return;
      done = true;
      subscription?.remove();
      clearTimeout(timeout);
      resolve(loaded);
    };
    const timeout = setTimeout(() => finish(player.isLoaded), 8_000);
    subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded) finish(true);
    });
    if (player.isLoaded) finish(true);
  });
}

async function writeSample(key: string, samples: Float32Array) {
  const file = new FileSystem.File(FileSystem.Paths.cache, `leo-audio-${key}-v1.wav`);
  if (!file.exists) {
    file.create({ intermediates: true });
    file.write(wavBytes(samples));
  }
  return file.uri;
}

async function addSample(key: string, samples: Float32Array) {
  const uri = await writeSample(key, samples);
  const player = createAudioPlayer({ uri }, { updateInterval: 1_000 });
  players.set(key, player);
  return waitForPlayer(player);
}

export function initializeNativeAudio() {
  bootPromise ??= (async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" });
      const tasks: Array<Promise<boolean>> = [];
      for (let midi = PIANO_FIRST_MIDI; midi <= PIANO_LAST_MIDI; midi += 1) {
        tasks.push(addSample(`note-${midi}`, pianoSamples(midi)));
      }
      for (const kind of ["kick", "snare", "hihat", "metronome"] as const) {
        tasks.push(addSample(kind, percussionSamples(kind)));
      }
      tasks.push(addSample("metronome-accent", percussionSamples("metronome", true)));
      const loaded = await Promise.all(tasks);
      audioReady = loaded.every(Boolean);
      return audioReady;
    } catch (error) {
      audioReady = false;
      console.warn("[leo-mobile] No se pudieron precargar todos los sonidos", error);
      return false;
    }
  })();
  return bootPromise;
}

async function playSample(key: string) {
  if (!audioReady) await initializeNativeAudio();
  const player = players.get(key);
  if (!player?.isLoaded) return;
  try {
    await player.seekTo(0);
    player.play();
  } catch (error) {
    console.warn(`[leo-mobile] No se pudo reproducir ${key}`, error);
  }
}

export function playNote(note: PianoNote) {
  const midi = Math.round(note);
  if (midi < PIANO_FIRST_MIDI || midi > PIANO_LAST_MIDI) return Promise.resolve();
  return playSample(`note-${midi}`);
}

export function playPercussion(kind: PercussionKind, accented = false) {
  return playSample(kind === "metronome" && accented ? "metronome-accent" : kind);
}

export async function getLatencyOffsetMs() {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM device_settings WHERE key = ?", LATENCY_KEY);
    const offset = Number(row?.value ?? 0);
    return Number.isFinite(offset) ? Math.max(-300, Math.min(300, offset)) : 0;
  } catch { return 0; }
}

export async function setLatencyOffsetMs(offset: number) {
  const value = Math.round(Math.max(-300, Math.min(300, offset)));
  const db = await getDatabase();
  await db.runAsync("INSERT INTO device_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", LATENCY_KEY, String(value));
  return value;
}

export function recordTouchFeedback() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function successFeedback() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function errorFeedback() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

export function releaseNativeAudio() {
  for (const player of players.values()) player.remove();
  players.clear();
  audioReady = false;
  bootPromise = null;
}
