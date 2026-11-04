"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getAudioEngine,
  type EnginePreset,
  type PercussionKind,
} from "@/lib/audio-engine";

/**
 * React bridge to the shared Sapphire Acoustic Engine. The engine is a lazy
 * singleton so the keyboard, the lab and the rhythm trainer all speak through
 * the same warm instrument and a single AudioContext.
 */
export function useAudioEngine() {
  const engine = getAudioEngine();
  const ready = useSyncExternalStore(
    engine.subscribe,
    engine.getReady,
    () => false,
  );
  const silent = useSyncExternalStore(
    engine.subscribe,
    engine.getSilent,
    () => false,
  );
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    setAnalyser(engine.getAnalyser());
  }, [engine, ready]);

  const unlock = useCallback(() => engine.unlock(), [engine]);
  const noteOn = useCallback(
    (midi: number, velocity = 0.8) => engine.noteOn(midi, velocity),
    [engine],
  );
  const noteOff = useCallback((midi: number) => engine.noteOff(midi), [engine]);
  const forceNoteOff = useCallback(
    (midi: number) => engine.forceNoteOff(midi),
    [engine],
  );
  const playNote = useCallback(
    (midi: number, duration = 1.8, velocity = 0.78) =>
      engine.playNote(midi, duration, velocity),
    [engine],
  );
  const playChord = useCallback(
    (midis: number[], duration = 1.8, velocity = 0.74) =>
      engine.playChord(midis, duration, velocity),
    [engine],
  );
  const playPercussion = useCallback(
    (
      kind: PercussionKind,
      options?: { accent?: boolean; when?: number },
    ) => engine.playPercussion(kind, options),
    [engine],
  );
  const setSustain = useCallback(
    (on: boolean) => engine.setSustain(on),
    [engine],
  );
  const setVolume = useCallback(
    (percent: number) => engine.setVolume(percent),
    [engine],
  );
  const setPreset = useCallback(
    (preset: EnginePreset) => engine.setPreset(preset),
    [engine],
  );
  const releaseAll = useCallback(() => engine.releaseAll(), [engine]);
  const now = useCallback(() => engine.now(), [engine]);

  // A stable facade: keyboard effects depend on this object, so returning a
  // fresh literal on every render would re-run them (and could loop).
  return useMemo(
    () => ({
      engine,
      ready,
      silent,
      analyser,
      unlock,
      noteOn,
      noteOff,
      forceNoteOff,
      playNote,
      playChord,
      playPercussion,
      setSustain,
      setVolume,
      setPreset,
      releaseAll,
      now,
    }),
    [
      engine,
      ready,
      silent,
      analyser,
      unlock,
      noteOn,
      noteOff,
      forceNoteOff,
      playNote,
      playChord,
      playPercussion,
      setSustain,
      setVolume,
      setPreset,
      releaseAll,
      now,
    ],
  );
}
