import type { Metadata } from "next";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";
import { MapaView } from "./mapa-view";

export const metadata: Metadata = {
  title: "Mapa",
  description:
    "Tu sendero de niveles de piano: arpegios, armonía, ritmo y teoría.",
};

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  // Teacher mode only changes what the teacher sees: an extra “Guía Docente”
  // trigger on every tile. Students never receive that affordance.
  const teacherMode = await isTeacherAuthenticated();

  return <MapaView teacherMode={teacherMode} />;
}
