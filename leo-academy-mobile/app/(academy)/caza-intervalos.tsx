import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { playNote, recordTouchFeedback, successFeedback, errorFeedback } from "../../src/lib/native-audio";
import { saveGameResult } from "../../src/lib/game-progress";

type Question = { kind: "direction" | "quality"; answer: "Subió" | "Bajó" | "Mayor" | "Menor"; first: number; second: number };
const createQuestion = (): Question => {
  if (Math.random() < 0.5) { const up = Math.random() < 0.5; return { kind: "direction", answer: up ? "Subió" : "Bajó", first: up ? 60 : 67, second: up ? 67 : 60 }; }
  const major = Math.random() < 0.5; return { kind: "quality", answer: major ? "Mayor" : "Menor", first: 60, second: major ? 64 : 63 };
};
const makeRunId = () => `interval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export default function IntervalHuntScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [question, setQuestion] = useState<Question>(createQuestion);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const runId = useRef(makeRunId());
  const play = () => { if (playing) return; setPlaying(true); void playNote(question.first); setTimeout(() => { void playNote(question.second); setPlaying(false); }, 700); };
  useEffect(() => { play(); }, [question]);
  const answer = (choice: Question["answer"]) => {
    if (saving || saved || round >= 4) return;
    if (choice !== question.answer) { setFeedback("Escucha otra vez y prueba de nuevo."); void errorFeedback(); return; }
    const nextCorrect = correct + 1; setCorrect(nextCorrect); setRound(value => value + 1); setFeedback("¡Muy bien!"); void successFeedback();
    if (round + 1 >= 4) {
      setSaving(true);
      void saveGameResult({ gameId: "caza-intervalos", level: 1, score: nextCorrect * 25, xp: 30, clientId: runId.current }).then(() => setSaved(true)).catch(() => { setSaveFailed(true); setFeedback("No se pudo guardar. Tus respuestas siguen en este teléfono."); }).finally(() => setSaving(false));
    } else { setQuestion(createQuestion()); }
  };
  const finish = () => params.returnTo === "session" ? router.back() : router.replace("/(academy)/map");
  const retrySave = () => { setSaveFailed(false); setSaving(true); void saveGameResult({ gameId: "caza-intervalos", level: 1, score: correct * 25, xp: 30, clientId: runId.current }).then(() => setSaved(true)).catch(() => { setSaveFailed(true); setFeedback("No se pudo guardar. Comprueba el espacio disponible e inténtalo de nuevo."); }).finally(() => setSaving(false)); };
  const choices: Question["answer"][] = question.kind === "direction" ? ["Subió", "Bajó"] : ["Mayor", "Menor"];
  return <View style={{ flex: 1, backgroundColor: "#06080F", padding: 24, justifyContent: "space-between" }}>
    <View><Pressable onPress={finish} style={{ alignSelf: "flex-start", paddingVertical: 10 }}><Text style={{ color: "#94A3B8" }}>✕ Salir</Text></Pressable><Text style={{ color: "#F8FAFC", fontSize: 28, fontWeight: "800", marginTop: 10 }}>Caza-Intervalos</Text><Text style={{ color: "#94A3B8", marginTop: 8 }}>Escucha las dos notas y responde. {round}/4</Text></View>
    <View style={{ alignItems: "center", gap: 24 }}><Text style={{ color: "#38BDF8", fontSize: 22, fontWeight: "700" }}>{question.kind === "direction" ? "¿Subió o bajó?" : "¿Mayor o menor?"}</Text><Pressable accessibilityRole="button" onPress={play} disabled={playing} style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: playing ? "#164E63" : "#0D6EFD", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 20, fontWeight: "800" }}>{playing ? "♫" : "ESCUCHAR"}</Text></Pressable><View style={{ width: "100%", gap: 14 }}>{choices.map(choice => <Pressable key={choice} accessibilityRole="button" disabled={saving || saved || round >= 4} onPressIn={() => void recordTouchFeedback()} onPress={() => answer(choice)} style={{ minHeight: 72, opacity: saving || saved || round >= 4 ? 0.5 : 1, borderRadius: 20, backgroundColor: "#101521", borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "700" }}>{choice}</Text></Pressable>)}</View><Text accessibilityLiveRegion="polite" style={{ color: feedback === "¡Muy bien!" ? "#38BDF8" : "#94A3B8", textAlign: "center" }}>{feedback}</Text>{saveFailed && <Pressable onPress={retrySave} style={{ padding: 12 }}><Text style={{ color: "#38BDF8", fontWeight: "700" }}>REINTENTAR GUARDADO</Text></Pressable>}</View>
    {saved ? <Pressable onPress={finish} style={{ minHeight: 64, borderRadius: 999, backgroundColor: "#0D6EFD", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontWeight: "800" }}>VOLVER AL CAMINO</Text></Pressable> : saving ? <Text style={{ color: "#64748B", textAlign: "center" }}>Guardando tu avance…</Text> : <Text style={{ color: "#64748B", textAlign: "center" }}>{feedback || `Aciertos · ${correct}`}</Text>}
  </View>;
}
