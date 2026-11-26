import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { getHomeMetrics } from "../../src/lib/database";
import { getSyncStatus, subscribeSyncStatus, syncNow, type SyncStatus } from "../../src/lib/sync-engine";

export default function AcademyHome() {
  const [status, setStatus] = useState<SyncStatus>({ kind: "loading", message: "Buscando tu progreso…" });
  const [metrics, setMetrics] = useState<{ streakDays: number; lastPracticedAt: string | null }>({ streakDays: 0, lastPracticedAt: null });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    void getSyncStatus().then(setStatus);
    void getHomeMetrics().then(setMetrics);
    const unsubscribe = subscribeSyncStatus(setStatus);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);
  const remainingMs = metrics.lastPracticedAt ? new Date(metrics.lastPracticedAt).getTime() + 48 * 60 * 60 * 1000 - now : null;
  const remainingSeconds = remainingMs === null ? 0 : Math.max(0, Math.floor(remainingMs / 1000));
  const timer = [Math.floor(remainingSeconds / 3600), Math.floor((remainingSeconds % 3600) / 60), remainingSeconds % 60].map(value => String(value).padStart(2, "0")).join(":");
  const resonance = remainingMs === null ? "Lista para empezar" : remainingMs <= 0 ? "Practica 2 min para recuperar" : `Expira en ${timer}`;
  return <View style={{ flex: 1, backgroundColor: "#06080F", padding: 24, justifyContent: "space-between" }}>
    <View style={{ paddingTop: 24 }}><Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>LEO ACADEMY</Text><Text style={{ color: "#F8FAFC", marginTop: 10 }}>Resonancia · {resonance}</Text><Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 6 }}>Racha · {metrics.streakDays} {metrics.streakDays === 1 ? "día" : "días"}</Text><Text accessibilityLiveRegion="polite" style={{ color: "#F8FAFC", marginTop: 12 }}>{status.message}</Text>{status.kind === "syncing" && <ActivityIndicator color="#38BDF8" style={{ alignSelf: "flex-start", marginTop: 10 }} />}
      {(status.kind === "error" || status.kind === "pending") && <Pressable accessibilityRole="button" onPress={() => status.message.includes("Tu sesión venció") ? router.replace("/welcome") : void syncNow()} style={{ marginTop: 12, paddingVertical: 10 }}><Text style={{ color: "#38BDF8", fontWeight: "600" }}>{status.message.includes("Tu sesión venció") ? "Ingresar de nuevo" : "Reintentar ahora"}</Text></Pressable>}
    </View>
    <View style={{ backgroundColor: "#101521", borderColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderRadius: 24, padding: 24 }}><Text style={{ color: "#F8FAFC", fontSize: 23, fontWeight: "700" }}>Tu siguiente práctica</Text><Text style={{ color: "rgba(255,255,255,0.65)", marginTop: 10 }}>Dos minutos para seguir avanzando.</Text></View>
    <View><Pressable accessibilityRole="button" accessibilityLabel="Empezar práctica de dos minutos" onPress={() => router.push("/(academy)/session")} style={{ minHeight: 64, backgroundColor: "#0D6EFD", borderRadius: 999, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>EMPEZAR PRÁCTICA (2 MIN)</Text></Pressable><Pressable accessibilityRole="link" onPress={() => router.push("/(academy)/map")} style={{ alignSelf: "center", padding: 12, marginTop: 5 }}><Text style={{ color: "#64748B", fontSize: 12 }}>Ver mi mapa completo</Text></Pressable></View>
  </View>;
}
