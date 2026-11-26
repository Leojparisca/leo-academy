import { Stack, usePathname, useRouter } from "expo-router";
import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { bootstrapDatabase, hasLocalProfile } from "../src/lib/database";
import { getSessionToken } from "../src/lib/auth";
import { pullProgress, showOfflineReady } from "../src/lib/sync-engine";
import { initializeNativeAudio } from "../src/lib/native-audio";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [entry, setEntry] = useState<"academy" | "welcome">("welcome");
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    void (async () => {
      await bootstrapDatabase();
      void initializeNativeAudio();
      const [token, localProfile, network] = await Promise.all([
        getSessionToken(), hasLocalProfile(), NetInfo.fetch(),
      ]);
      const canEnter = Boolean(token) || (!network.isConnected && localProfile);
      if (active) { setEntry(canEnter ? "academy" : "welcome"); setReady(true); }
      if (token) void pullProgress();
      else if (canEnter) showOfflineReady();
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const atWelcome = pathname === "/welcome";
      if (entry === "academy" && atWelcome) router.replace("/(academy)");
      if (entry === "welcome" && !atWelcome) router.replace("/welcome");
    })();
  }, [ready, entry, pathname, router]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: "#06080F", alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#38BDF8" /><Text style={{ color: "#F8FAFC", marginTop: 12 }}>Preparando tu progreso…</Text></View>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#06080F" } }} />;
}
