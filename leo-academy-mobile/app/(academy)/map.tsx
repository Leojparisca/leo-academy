import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "../../src/lib/database";
import { getLatencyOffsetMs, setLatencyOffsetMs, recordTouchFeedback, measureMonotonicTime, scheduleAt, playPercussion } from "../../src/lib/native-audio";

const levels = ["Ritmo", "Melodía", "Armonía"];
export default function MapScreen() {
  const [done, setDone] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [samples, setSamples] = useState<number[]>([]);
  const tapTimes = useRef<number[]>([]);
  const expectedTimes = useRef<number[]>([]);
  const cancels = useRef<Array<() => void>>([]);
  useFocusEffect(useCallback(() => { void (async () => { const db = await getDatabase(); const rows = await db.getAllAsync<{ payload: string }>("SELECT payload FROM curriculum_progress"); setDone(rows.flatMap(row => { try { const payload = JSON.parse(row.payload) as { nodeId?: string }; return payload.nodeId ? [payload.nodeId] : []; } catch { return []; } })); setOffset(await getLatencyOffsetMs()); })(); return () => cancels.current.forEach(cancel => cancel()); }, []));
  const calibrate = () => {
    tapTimes.current = []; setSamples([]); setCalibrating(true);
    const first = measureMonotonicTime() + 1000;
    expectedTimes.current = [0, 1, 2, 3].map(index => first + index * 800);
    cancels.current.forEach(cancel => cancel());
    cancels.current = expectedTimes.current.map((time, index) => scheduleAt(time, () => { void playPercussion("metronome", index === 0); }));
  };
  const tapCalibrate = async () => {
    if (!calibrating) return;
    void recordTouchFeedback();
    const now = measureMonotonicTime();
    const pendingIndex = tapTimes.current.length;
    if (pendingIndex >= 4 || now < expectedTimes.current[pendingIndex] - 200 || now > expectedTimes.current[pendingIndex] + 450) return;
    tapTimes.current.push(now - expectedTimes.current[pendingIndex]);
    setSamples([...tapTimes.current]);
    if (tapTimes.current.length >= 4) { const errors = [...tapTimes.current].sort((a, b) => a - b); const measured = Math.round(-(errors[1] + errors[2]) / 2); await setLatencyOffsetMs(measured); setOffset(measured); setCalibrating(false); cancels.current.forEach(cancel => cancel()); }
  };
  return <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: "#06080F", padding: 22 }}><Pressable onPress={() => router.back()}><Text style={{ color: "#94A3B8", paddingVertical: 10 }}>‹ Inicio</Text></Pressable><Text style={{ color: "#F8FAFC", fontSize: 28, fontWeight: "700", marginTop: 12 }}>Mapa de aprendizaje</Text><Text style={{ color: "#94A3B8", marginTop: 8 }}>Avanza paso a paso por los tres caminos.</Text>
    {[1, 2, 3, 4, 5].map(level => <View key={level} style={{ marginTop: 18, padding: 16, borderRadius: 24, backgroundColor: "#101521", borderColor: "rgba(255,255,255,0.08)", borderWidth: 1 }}><Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700" }}>Nivel {level}</Text>{levels.map((label, branchIndex) => { const branch = ["ritmo", "melodia", "armonia"][branchIndex]; const id = `cur-${branch}-${level}`; const completed = done.includes(id); const unlocked = branch === "armonia" ? false : level === 1 || ["ritmo", "melodia"].every(prev => done.includes(`cur-${prev}-${level - 1}`)); return <Pressable key={id} disabled={!unlocked} onPress={() => router.push({ pathname: "/(academy)/session", params: { node: id } })} style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}><Text style={{ color: unlocked ? "#F8FAFC" : "#64748B", fontWeight: "600" }}>{completed ? "✓  " : unlocked ? "▶  " : "🔒  "}{label} {completed ? "· completado" : branch === "armonia" ? "· próxima fase" : ""}</Text></Pressable>; })}</View>)}
    <View style={{ marginTop: 22, padding: 18, borderRadius: 24, backgroundColor: "#101521", borderColor: "rgba(255,255,255,0.08)", borderWidth: 1 }}><Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "800" }}>Salón de Juegos</Text><Text style={{ color: "#94A3B8", marginTop: 4 }}>Entrena por tu cuenta cuando quieras.</Text><Pressable onPress={() => router.push({ pathname: "/(academy)/cascada", params: { returnTo: "map" } })} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}><Text style={{ color: "#F8FAFC", fontSize: 17, fontWeight: "700" }}>▶  Cascada Zafiro</Text><Text style={{ color: "#94A3B8", marginTop: 4 }}>Teclas, acordes y notas ancla</Text></Pressable><Pressable onPress={() => router.push({ pathname: "/(academy)/caza-intervalos", params: { returnTo: "map" } })} style={{ paddingVertical: 16 }}><Text style={{ color: "#F8FAFC", fontSize: 17, fontWeight: "700" }}>▶  Caza-Intervalos</Text><Text style={{ color: "#94A3B8", marginTop: 4 }}>¿Subió o bajó? · ¿Mayor o menor?</Text></Pressable></View>
    <View style={{ marginTop: 22, padding: 18, borderRadius: 24, backgroundColor: "#101521" }}><Text style={{ color: "#F8FAFC", fontSize: 18, fontWeight: "700" }}>Calibración de ritmo</Text><Text style={{ color: "#94A3B8", marginTop: 6 }}>Ajuste guardado en este teléfono: {offset} ms</Text><Pressable onPress={calibrating ? undefined : calibrate} onPressIn={calibrating ? tapCalibrate : undefined} style={{ marginTop: 14, backgroundColor: "#1E293B", borderRadius: 16, minHeight: 52, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "#38BDF8", fontWeight: "700" }}>{calibrating ? `TOCA AL PULSO · ${samples.length}/4` : "CALIBRAR LATENCIA"}</Text></Pressable></View>
  </ScrollView>;
}
