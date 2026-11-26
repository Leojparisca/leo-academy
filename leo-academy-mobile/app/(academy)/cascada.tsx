import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { playNote, playPercussion, recordTouchFeedback, successFeedback, errorFeedback, measureMonotonicTime, scheduleAt } from "../../src/lib/native-audio";
import { saveGameResult } from "../../src/lib/game-progress";

const WHITE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79]; // C4–G5 inclusive.
const BLACK = [{ note: 61, after: 0 }, { note: 63, after: 1 }, { note: 66, after: 3 }, { note: 68, after: 4 }, { note: 70, after: 5 }, { note: 73, after: 7 }, { note: 75, after: 8 }, { note: 78, after: 10 }];
const CHORDS = [[60, 64, 67], [60, 64, 69], [60, 65, 69]]; // C, Am, F voicings with C as the golden common tone.
const label = (midi: number) => ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"][midi % 12];
const makeRunId = () => `cascade-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export default function CascadaScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [hits, setHits] = useState(0);
  const [notes, setNotes] = useState<number[]>([60, 64, 67]);
  const [active, setActive] = useState<number[]>([]);
  const activeRef = useRef<number[]>([]);
  const [target, setTarget] = useState<number[]>([60]);
  const nextBeatAt = useRef(0);
  const lastBeatAt = useRef(0);
  const pulseCount = useRef(0);
  const targetRef = useRef<number[]>([60]);
  const chordTouches = useRef<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tempoPulse, setTempoPulse] = useState(0);
  const frame = useRef<number | null>(null);
  const running = useRef(true);
  const savedLevel = useRef(0);
  const runId = useRef(makeRunId());
  const fall = useRef(new Animated.Value(0)).current;

  const restorePortrait = () => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined); };
  useEffect(() => {
    running.current = true;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).then(() => setReady(true)).catch(() => { setReady(true); setError("No pudimos girar la pantalla. Puedes continuar en horizontal."); });
    let last = 0;
    const animate = (time: number) => {
      if (!running.current) return;
      if (time - last >= 16) { last = time; fall.setValue((time % 2_000) / 2_000); }
      frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => { running.current = false; if (frame.current !== null) cancelAnimationFrame(frame.current); restorePortrait(); };
  }, [fall]);

  useEffect(() => {
    if (level !== 3) return;
    let cancelled = false;
    let cancel: (() => void) | undefined;
    const pulse = () => {
      if (cancelled) return;
      const at = nextBeatAt.current;
      lastBeatAt.current = at;
      void playPercussion("metronome", pulseCount.current % 4 === 0);
      pulseCount.current += 1;
      setTempoPulse(value => value + 1);
      nextBeatAt.current = at + 650;
      cancel = scheduleAt(nextBeatAt.current, pulse);
    };
    nextBeatAt.current = measureMonotonicTime() + 500;
    cancel = scheduleAt(nextBeatAt.current, pulse);
    return () => { cancelled = true; cancel?.(); };
  }, [level]);

  useEffect(() => {
    if (hits >= 8 && !saved && !saving) {
      setSaving(true);
      void saveGameResult({ gameId: "cascada-zafiro", level, score: Math.round(score / Math.max(1, score + misses) * 100), xp: 20 + level * 10, clientId: runId.current })
        .then(() => { savedLevel.current = level; setSaved(true); void successFeedback(); })
        .catch(() => setError("No se pudo guardar todavía. Tu práctica sigue disponible para reintentar."))
        .finally(() => setSaving(false));
    }
  }, [hits, level, saved, saving, score, misses]);

  const chooseTarget = () => {
    let next: number[];
    if (level === 1) next = [WHITE[Math.floor(Math.random() * WHITE.length)]];
    else {
      const chord = CHORDS[Math.floor(Math.random() * CHORDS.length)];
      next = chord.filter(note => note >= 60 && note <= 79);
    }
    targetRef.current = next; setTarget(next); chordTouches.current = [];
    const extras = Array.from({ length: Math.max(0, (level === 1 ? 3 : 6) - next.length) }, (_, index) => level === 1 ? WHITE[(Math.floor(Math.random() * WHITE.length) + index) % WHITE.length] : CHORDS[(index + Math.floor(Math.random() * 3)) % 3][index % 3]).filter(note => note >= 60 && note <= 79);
    setNotes([...next, ...extras]);
    fall.setValue(0);
  };
  const press = (note: number) => {
    if (!activeRef.current.includes(note) && activeRef.current.length >= 3) return;
    if (!activeRef.current.includes(note)) activeRef.current = [...activeRef.current, note];
    setActive([...activeRef.current]);
    void playNote(note); void recordTouchFeedback();
    const onBeat = level !== 3 || Math.abs(measureMonotonicTime() - lastBeatAt.current) <= 350;
    if (targetRef.current.includes(note) && onBeat) {
      if (!chordTouches.current.includes(note)) chordTouches.current.push(note);
      if (targetRef.current.every(required => chordTouches.current.includes(required))) { setScore(value => value + 1); setHits(value => value + 1); void successFeedback(); chooseTarget(); }
    } else { setMisses(value => value + 1); void errorFeedback(); }
  };
  const release = (note: number) => { activeRef.current = activeRef.current.filter(value => value !== note); setActive([...activeRef.current]); };
  const retrySave = () => {
    setError(""); setSaving(true);
    void saveGameResult({ gameId: "cascada-zafiro", level, score: Math.round(score / Math.max(1, score + misses) * 100), xp: 20 + level * 10, clientId: runId.current }).then(() => { savedLevel.current = level; setSaved(true); }).catch(() => setError("Sigue sin guardarse. Comprueba el espacio del dispositivo e inténtalo otra vez.")).finally(() => setSaving(false));
  };
  const advance = () => {
    if (level < 3) { const nextLevel = level + 1; runId.current = makeRunId(); setLevel(nextLevel); setHits(0); setScore(0); setMisses(0); setSaved(false); savedLevel.current = 0; const next = nextLevel === 1 ? [60] : CHORDS[0].filter(note => note >= 60 && note <= 79); targetRef.current = next; setTarget(next); chordTouches.current = []; setNotes(next); fall.setValue(0); return; }
    restorePortrait();
    if (params.returnTo === "session") router.back();
    else router.replace("/(academy)/map");
  };
  const exit = () => { restorePortrait(); params.returnTo ? router.back() : router.replace("/(academy)"); };
  const octaveWidth = Math.max(520, width - 32);
  return <View style={{ flex: 1, backgroundColor: "#06080F", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
    <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Pressable accessibilityRole="button" onPress={exit} style={{ padding: 8 }}><Text style={{ color: "#CBD5E1", fontSize: 16 }}>✕ Salir</Text></Pressable><Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Cascada Zafiro · Nivel {level}</Text><Text style={{ color: "#38BDF8", fontWeight: "700" }}>{score} puntos</Text></View>
    {error ? <Text accessibilityLiveRegion="polite" style={{ color: "#FCA5A5", paddingVertical: 4 }}>{error}</Text> : null}
    <View style={{ flex: 1, minHeight: 100, position: "relative", overflow: "hidden", borderRadius: 20, backgroundColor: "#0B1220", marginVertical: 5 }}>
      <View style={{ position: "absolute", left: 20, top: 8 }}><Text style={{ color: "#F59E0B", fontWeight: "700" }}>HILO ANCLA · nota común Do entre acordes</Text><Text style={{ color: "#CBD5E1", marginTop: 4 }}>{level === 1 ? "Notas sueltas · sigue las notas que caen" : level === 2 ? "Acordes guiados · conserva Do como ancla" : "Enlaces armónicos · 92 BPM · toca cerca del pulso"}</Text></View>
      <View style={{ position: "absolute", left: 12, right: 12, top: "82%", height: 2, backgroundColor: "#F59E0B" }} />
      {notes.map((note, index) => { const x = 12 + ((note - 60) / 19) * Math.max(100, width - 80); return <Animated.View key={`${note}-${index}-${hits}`} style={{ position: "absolute", left: Math.min(width - 76, x), top: fall.interpolate({ inputRange: [0, 1], outputRange: [10, Math.max(40, height * 0.34)] }), transform: [{ translateY: index % 3 * 14 }] }}>{note === 60 && level > 1 && <View style={{ position: "absolute", left: 23, top: 12, width: 2, height: 70, backgroundColor: "#F59E0B" }} />}<View style={{ minWidth: 48, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: target.includes(note) ? "#F59E0B" : "#38BDF8", backgroundColor: target.includes(note) ? "#78350F" : "#0D6EFD", paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: "white", fontWeight: "800" }}>{label(note)}</Text><Text style={{ color: "#FDE68A", fontSize: 11 }}>{index % 3 === 0 ? "1" : index % 3 === 1 ? "3" : "5"}</Text></View></Animated.View>; })}
    </View>
    <View style={{ height: Math.min(200, height * 0.33), alignSelf: "center", width: octaveWidth, position: "relative", flexDirection: "row" }}>{WHITE.map(note => <Pressable key={note} accessibilityRole="button" accessibilityLabel={`Tecla ${label(note)}`} onTouchStart={() => press(note)} onTouchEnd={() => release(note)} style={{ flex: 1, marginHorizontal: 1, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, justifyContent: "flex-end", alignItems: "center", paddingBottom: 12, backgroundColor: active.includes(note) ? "#38BDF8" : target.includes(note) ? "#BAE6FD" : "#F8FAFC" }}><Text style={{ color: "#0F172A", fontSize: 12, fontWeight: "700" }}>{label(note)}</Text></Pressable>)}{BLACK.map(key => <Pressable key={key.note} accessibilityRole="button" accessibilityLabel={`Tecla ${label(key.note)}`} onTouchStart={() => press(key.note)} onTouchEnd={() => release(key.note)} style={{ position: "absolute", left: `${(key.after + 1) * (100 / 12) - 3.3}%`, top: 0, width: "6.4%", height: "62%", zIndex: 2, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: active.includes(key.note) ? "#38BDF8" : target.includes(key.note) ? "#F59E0B" : "#111827", borderWidth: 1, borderColor: "#64748B" }} />)}</View>
    {saved ? <View style={{ position: "absolute", left: 16, right: 16, bottom: 8, minHeight: 54, borderRadius: 999, backgroundColor: "#0D6EFD", alignItems: "center", justifyContent: "center", flexDirection: "row" }}><Pressable onPress={advance} style={{ padding: 14 }}><Text style={{ color: "white", fontWeight: "800" }}>JUGAR SIGUIENTE NIVEL</Text></Pressable><Pressable onPress={exit} style={{ padding: 14 }}><Text style={{ color: "white" }}>SALIR</Text></Pressable></View> : <Text style={{ color: ready ? "#94A3B8" : "#38BDF8", textAlign: "center", paddingVertical: 4 }}>{saving ? "Guardando tu avance…" : ready ? `${hits}/8 · ${level === 3 ? `Pulso ${tempoPulse} · ` : ""}Toca ${target.map(label).join(" + ")}` : "Girando la pantalla…"}</Text>}
    {error && !saved && <Pressable onPress={retrySave} style={{ alignSelf: "center", padding: 8 }}><Text style={{ color: "#38BDF8" }}>REINTENTAR GUARDADO</Text></Pressable>}
  </View>;
}
