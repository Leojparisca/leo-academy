import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { redeemCode } from "../src/lib/sync-engine";

export default function Welcome() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const enter = async () => {
    setBusy(true); setMessage("Buscando tu progreso…");
    const result = await redeemCode(code);
    setBusy(false);
    if (result.ok) { router.replace("/(academy)"); return; }
    setMessage(result.message);
  };
  return <View style={{ flex: 1, backgroundColor: "#06080F", justifyContent: "center", padding: 24 }}>
    <Text accessibilityRole="header" style={{ color: "#F8FAFC", fontSize: 30, fontWeight: "700", marginBottom: 8 }}>Leo Academy</Text>
    <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, marginBottom: 24 }}>Ingresa el código que te dio tu profe.</Text>
    <TextInput accessibilityLabel="Código de acceso" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={8} placeholder="Código de 4 a 8 caracteres" placeholderTextColor="#94A3B8" style={{ color: "#F8FAFC", borderColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderRadius: 16, padding: 18, fontSize: 20, marginBottom: 16 }} />
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: "#F8FAFC", marginBottom: 16 }}>{message}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Entrar a Leo Academy" disabled={busy || code.length < 4} onPress={enter} style={{ minHeight: 64, borderRadius: 999, backgroundColor: "#0D6EFD", alignItems: "center", justifyContent: "center", opacity: busy || code.length < 4 ? 0.55 : 1 }}>
      {busy ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>ENTRAR</Text>}
    </Pressable>
    {message.includes("internet") && <Pressable accessibilityRole="button" onPress={enter} style={{ padding: 18, alignItems: "center" }}><Text style={{ color: "#38BDF8" }}>Reintentar</Text></Pressable>}
  </View>;
}
