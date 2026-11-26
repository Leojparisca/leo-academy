import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "../../src/lib/database";
import { initializeNativeAudio, playNote, playPercussion, getLatencyOffsetMs, setLatencyOffsetMs, recordTouchFeedback, successFeedback, errorFeedback, measureMonotonicTime, scheduleAt } from "../../src/lib/native-audio";
import { savePracticeEvent, syncNow } from "../../src/lib/sync-engine";

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const WHITE = [60, 62, 64, 65, 67, 69, 71, 72];
const BLACK = [{ midi: 61, after: 0 }, { midi: 63, after: 1 }, { midi: 66, after: 3 }, { midi: 68, after: 4 }, { midi: 70, after: 5 }];
const name = (midi: number) => ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"][([0, 2, 4, 5, 7, 9, 11].indexOf(midi % 12))] ?? "Do";
const BEAT_MS = 600;

export default function SessionScreen() {
  const params = useLocalSearchParams<{ node?: string }>();
  const [part, setPart] = useState<"rhythm" | "melody" | "reward">("rhythm");
  const [rhythmMode, setRhythmMode] = useState<"listen" | "response">("listen");
  const [bar, setBar] = useState(0);
  const [beat, setBeat] = useState(-1);
  const [sequence, setSequence] = useState(0);
  const [good, setGood] = useState(0);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioLoading, setAudioLoading] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationCount, setCalibrationCount] = useState(0);
  const [activeKeys, setActiveKeys] = useState<number[]>([]);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const [padError, setPadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [reward, setReward] = useState(50);
  const [rewardBonus, setRewardBonus] = useState(false);
  const [interlude, setInterlude] = useState<"cascada" | "intervalos" | null>(null);
  const node = params.node ?? "cur-ritmo-1";
  const currentNode = useRef(node);
  const barRef = useRef(0);
  const target = [60, 64, 67, 62][sequence % 4];
  const finger = [1, 3, 5, 2][sequence % 4];
  const accuracy = total ? Math.round(good / total * 100) : 0;
  const expected = useRef<number[]>([]);
  const calibrationErrors = useRef<number[]>([]);
  const judged = useRef<boolean[]>([]);
  const cancels = useRef<Array<() => void>>([]);
  const starts = useRef(0);
  const offsetRef = useRef(0);
  const shake = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const resumeAfterMiniGame = useRef(false);
  const eventIds = useRef({ practice: makeId(), curriculum: makeId(), xp: makeId() });
  const bars = useMemo(() => Array.from({ length: 4 }, (_, i) => i < bar), [bar]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [loaded, savedOffset] = await Promise.all([initializeNativeAudio(), getLatencyOffsetMs()]);
      if (!active) return;
      setAudioLoaded(loaded); setAudioLoading(false); offsetRef.current = savedOffset; setOffset(savedOffset);
      scheduleRound("listen");
    })();
    return () => { active = false; cancels.current.forEach(cancel => cancel()); };
  }, []);
  useFocusEffect(useCallback(() => {
    if (resumeAfterMiniGame.current) { resumeAfterMiniGame.current = false; scheduleRound("listen"); }
    return () => { cancels.current.forEach(cancel => cancel()); cancels.current = []; };
  }, []));

  const scheduleRound = (round: "listen" | "response") => {
    cancels.current.forEach(cancel => cancel()); cancels.current = [];
    const start = measureMonotonicTime() + 450;
    starts.current = start; expected.current = Array.from({ length: 4 }, (_, i) => start + i * BEAT_MS); judged.current = [false, false, false, false];
    setRhythmMode(round); setBeat(-1);
    expected.current.forEach((time, i) => cancels.current.push(scheduleAt(time, () => {
      setBeat(i);
      void playPercussion("metronome", i === 0);
    })));
    cancels.current.push(scheduleAt(start + 4 * BEAT_MS + 250, () => {
      setBeat(-1);
      if (round === "listen") scheduleRound("response");
      else {
        const hitCount = judged.current.filter(Boolean).length;
        if (hitCount === 4) {
          void successFeedback();
          if (barRef.current >= 3) { setBar(4); setPart("melody"); setSequence(0); }
          else { barRef.current += 1; setBar(barRef.current); scheduleRound("listen"); }
        } else { void errorFeedback(); scheduleRound("listen"); }
      }
    }));
  };
  const beginCalibration = () => {
    cancels.current.forEach(cancel => cancel()); cancels.current = [];
    calibrationErrors.current = []; setCalibrationCount(0); setCalibrating(true);
    const first = measureMonotonicTime() + 1_000;
    expected.current = [0, 1, 2, 3].map(i => first + i * 800);
    cancels.current = expected.current.map((time, index) => scheduleAt(time, () => { void playPercussion("metronome", index === 0); }));
  };
  const tapCalibration = async () => {
    const index = calibrationErrors.current.length;
    if (!calibrating || index >= 4) return;
    void recordTouchFeedback();
    const delta = measureMonotonicTime() - expected.current[index];
    if (Math.abs(delta) > 500) return;
    calibrationErrors.current.push(delta); setCalibrationCount(index + 1);
    if (index === 3) {
      const sorted = [...calibrationErrors.current].sort((a, b) => a - b);
      const adjusted = await setLatencyOffsetMs(-(sorted[1] + sorted[2]) / 2);
      offsetRef.current = adjusted; setOffset(adjusted); setCalibrating(false);
      cancels.current.forEach(cancel => cancel()); scheduleRound("listen"); void successFeedback();
    }
  };
  const tapPad = () => {
    if (part !== "rhythm" || rhythmMode !== "response") return;
    void recordTouchFeedback();
    const now = measureMonotonicTime();
    const candidates = expected.current.map((time, index) => ({ index, delta: now + offsetRef.current - time })).filter(item => !judged.current[item.index]);
    candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    const closest = candidates[0];
    setTotal(value => value + 1);
    if (closest && closest.delta >= -110 && closest.delta <= 190) {
      judged.current[closest.index] = true; setGood(value => value + 1); void successFeedback();
    } else { setPadError(true); setTimeout(() => setPadError(false), 240); void errorFeedback(); }
  };
  const pressKey = (midi: number) => {
    void playNote(midi); void recordTouchFeedback(); setActiveKeys(keys => keys.includes(midi) ? keys : [...keys, midi]);
    setTotal(value => value + 1);
    if (midi === target) {
      setGood(value => value + 1); void successFeedback();
      if (sequence >= 3) { const base = Math.random() < 0.5 ? 35 : 50; const bonus = Math.round((good + 1) / (total + 1) * 100) >= 85 && Math.random() < 0.2; setRewardBonus(bonus); setReward(bonus ? base * 2 : base); setPart("reward"); }
      else setSequence(value => value + 1);
    } else {
      setWrongKey(midi); shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: -6, duration: 35, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 6, duration: 35, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -4, duration: 35, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 35, useNativeDriver: true }),
      ]).start(() => setWrongKey(null));
      void errorFeedback();
    }
  };
  const saveResult = async () => {
    if (completedRef.current || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString(); const score = accuracy; const activeNode = currentNode.current;
      const level = Math.max(1, Math.min(5, Number(activeNode.split("-").at(-1)) || 1));
      await savePracticeEvent({ type: "practice", clientId: eventIds.current.practice, levelId: `level-${String(level).padStart(2, "0")}`, minutes: 2, skill: activeNode.includes("melodia") ? "melody" : "rhythm", score, createdAt: now });
      await savePracticeEvent({ type: "curriculum", clientId: eventIds.current.curriculum, nodeId: activeNode, stars: score >= 85 ? 3 : score >= 60 ? 2 : 1, accuracy: score, updatedAt: now });
      await savePracticeEvent({ type: "xp", clientId: eventIds.current.xp, amount: reward, source: "lesson", detail: "Práctica guiada", createdAt: now });
      const db = await getDatabase();
      await db.runAsync("INSERT INTO curriculum_progress(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at", activeNode, JSON.stringify({ nodeId: activeNode, stars: score >= 85 ? 3 : score >= 60 ? 2 : 1, accuracy: score }), now);
      completedRef.current = true; setSaved(true); void syncNow();
    } catch { setSaveError(true); } finally { setSaving(false); }
  };
  useEffect(() => { if (part === "reward" && !completedRef.current && !saving) void saveResult(); }, [part]);
  const nextChallenge = () => {
    const level = Math.max(1, Math.min(5, Number(currentNode.current.split("-").at(-1)) || 1));
    const next = `cur-ritmo-${level < 5 ? level + 1 : 1}`;
    currentNode.current = next; eventIds.current = { practice: makeId(), curriculum: makeId(), xp: makeId() }; completedRef.current = false; setSaved(false); setSaveError(false); setSaving(false); setReward(0); setRewardBonus(false);
    barRef.current = 0; setPart("rhythm"); setRhythmMode("listen"); setBar(0); setBeat(-1); setSequence(0); setGood(0); setTotal(0);
    resumeAfterMiniGame.current = true; setInterlude(Math.random() < 0.5 ? "cascada" : "intervalos");
  };
  useEffect(() => {
    if (!interlude) return;
    if (interlude === "cascada") router.push({ pathname: "/(academy)/cascada", params: { returnTo: "session" } });
    else router.push({ pathname: "/(academy)/caza-intervalos", params: { returnTo: "session" } });
    setInterlude(null);
  }, [interlude]);
  const exit = () => { cancels.current.forEach(cancel => cancel()); router.replace("/(academy)"); };
  return <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: "#06080F", padding: 22, justifyContent: "space-between" }}>
    <View><Pressable onPress={exit} style={{ alignSelf: "flex-end", padding: 8 }}><Text style={{ color: "#94A3B8", fontSize: 14 }}>✕ Salir</Text></Pressable><Text style={{ color: "#F8FAFC", fontSize: 26, fontWeight: "700", marginTop: 8 }}>{part === "rhythm" ? "Escucha y repite" : part === "melody" ? "Melodía guiada" : "¡Desafío completado!"}</Text><Text style={{ color: "#94A3B8", marginTop: 8 }}>{part === "rhythm" ? rhythmMode === "listen" ? "Escucha el patrón. El pad se activa al terminar." : "Repite el patrón; si fallas, repites solo este compás." : part === "melody" ? "Sigue la tecla iluminada y el número de dedo." : saved ? `Precisión ${accuracy}% · Recompensa guardada en este teléfono` : "Guardando tu recompensa en este teléfono…"}</Text>{part === "rhythm" && <Pressable onPress={beginCalibration} style={{ alignSelf: "flex-start", paddingVertical: 12 }}><Text style={{ color: "#38BDF8" }}>Calibrar respuesta táctil</Text></Pressable>}</View>
    {part === "rhythm" && (calibrating ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}><Text style={{ color: "#F8FAFC", fontSize: 22, textAlign: "center" }}>Escucha cuatro pulsos y toca aquí al oír cada uno.</Text><Text style={{ color: "#38BDF8", fontSize: 20 }}>{calibrationCount} de 4</Text><Pressable onPressIn={() => void tapCalibration()} style={{ width: "100%", height: 180, borderRadius: 28, backgroundColor: "#0D6EFD", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>TOCAR AL PULSO</Text></Pressable><Pressable onPress={() => { setCalibrating(false); cancels.current.forEach(cancel => cancel()); scheduleRound("listen"); }}><Text style={{ color: "#94A3B8", padding: 12 }}>Cancelar calibración</Text></Pressable></View> : <View style={{ alignItems: "center", gap: 24 }}><View style={{ flexDirection: "row", gap: 12 }}>{bars.map((done, i) => <View key={i} style={{ width: 42, height: 42, borderRadius: 22, borderWidth: 2, borderColor: done ? "#38BDF8" : "#334155", backgroundColor: done ? "#0D6EFD" : "#101521", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white" }}>{done ? "✓" : i + 1}</Text></View>)}</View><Text style={{ color: "#38BDF8", fontSize: 20 }}>{audioLoading ? "Preparando sonidos…" : !audioLoaded ? "Ritmo visual" : rhythmMode === "listen" ? "Escucha el patrón" : `Compás ${bar + 1} · Tu turno`}</Text><View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: beat >= 0 ? "#38BDF8" : "#101521", borderWidth: 3, borderColor: "#38BDF8", alignItems: "center", justifyContent: "center", transform: [{ scale: beat >= 0 ? 1.08 : 1 }] }}><Text style={{ color: "white", fontSize: 32, fontWeight: "800" }}>{beat < 0 ? "·" : beat + 1}</Text></View><Text style={{ color: "#CBD5E1", fontSize: 18 }}>1 · 2 · 3 · 4</Text><Pressable disabled={audioLoading || rhythmMode === "listen"} onPressIn={tapPad} style={{ opacity: audioLoading || rhythmMode === "listen" ? 0.45 : 1, width: "100%", height: 210, borderRadius: 32, backgroundColor: padError ? "#B91C1C" : "#0D6EFD", alignItems: "center", justifyContent: "center", transform: [{ scale: padError ? 0.98 : 1 }] }}><Text style={{ color: "white", fontSize: 25, fontWeight: "800" }}>{audioLoading ? "PREPARANDO…" : rhythmMode === "listen" ? "ESCUCHA…" : "TOCA EL PULSO"}</Text></Pressable></View>)}
    {part === "melody" && <View style={{ alignItems: "center", gap: 20 }}><View style={{ borderRadius: 24, borderColor: "#38BDF8", borderWidth: 2, padding: 18, alignItems: "center" }}><Text style={{ color: "#94A3B8" }}>TOCA ESTA NOTA</Text><Text style={{ color: "#38BDF8", fontSize: 35, fontWeight: "800" }}>{name(target)}</Text><Text style={{ color: "white" }}>Dedo {finger}</Text></View><View style={{ width: "100%", height: 190, position: "relative", flexDirection: "row" }}>{WHITE.map(midi => <Pressable key={midi} onTouchStart={() => pressKey(midi)} onTouchEnd={() => setActiveKeys(keys => keys.filter(key => key !== midi))} style={{ flex: 1, marginHorizontal: 1, backgroundColor: wrongKey === midi ? "#F87171" : midi === target ? "#38BDF8" : activeKeys.includes(midi) ? "#BAE6FD" : "#F8FAFC", justifyContent: "flex-end", alignItems: "center", paddingBottom: 14, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, transform: wrongKey === midi ? [{ translateX: shake }] : [] }}><Text style={{ color: "#0F172A", fontWeight: "700" }}>{name(midi)}</Text></Pressable>)}{BLACK.map(key => <Pressable key={key.midi} onTouchStart={() => pressKey(key.midi)} onTouchEnd={() => setActiveKeys(keys => keys.filter(value => value !== key.midi))} onPress={() => undefined} style={{ position: "absolute", left: `${(key.after + 1) * 12.5 - 4}%`, zIndex: 2, width: "9%", height: 118, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: wrongKey === key.midi ? "#EF4444" : key.midi === target ? "#22D3EE" : activeKeys.includes(key.midi) ? "#475569" : "#111827", borderWidth: 1, borderColor: "#64748B", transform: wrongKey === key.midi ? [{ translateX: shake }] : [] }} />)}</View></View>}
    {part === "reward" && <View style={{ alignItems: "center", gap: 18 }}><Text style={{ fontSize: 62 }}>🎉</Text>{rewardBonus && <Text style={{ color: "#38BDF8", fontSize: 20, fontWeight: "800" }}>¡Bono Precisión ×2!</Text>}<Text style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "700" }}>+{reward} XP</Text><Text style={{ color: saveError ? "#FCA5A5" : "#94A3B8" }}>{saveError ? "No se pudo guardar. Toca para reintentar." : saved ? "Resultado guardado aquí; se sincronizará al conectar." : "Guardando el resultado…"}</Text>{saveError && <Pressable onPress={() => { setSaveError(false); void saveResult(); }}><Text style={{ color: "#38BDF8", fontWeight: "700" }}>REINTENTAR GUARDADO</Text></Pressable>}<Pressable disabled={!saved || saving} onPress={nextChallenge} style={{ minHeight: 64, width: "100%", opacity: saved ? 1 : 0.5, backgroundColor: "#0D6EFD", borderRadius: 999, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>{saving ? "GUARDANDO…" : "SIGUIENTE DESAFÍO"}</Text></Pressable></View>}
    <Text style={{ color: "#64748B", textAlign: "center", marginTop: 24 }}>{part === "rhythm" ? `Ritmo · ${bar}/4 compases · ajuste ${offset} ms` : part === "melody" ? `Melodía · ${sequence}/4 notas` : `Precisión · ${accuracy}%`}</Text>
  </ScrollView>;
}
