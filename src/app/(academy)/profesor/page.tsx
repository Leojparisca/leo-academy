import type { Metadata } from "next";
import { TeacherDashboard } from "@/components/teacher/teacher-dashboard";
import { TeacherGate } from "@/components/teacher/teacher-gate";
import {
  isTeacherAuthenticated,
  isTeacherPinConfigured,
} from "@/server/auth/teacher-session";
import { getTeacherDashboard } from "@/server/queries/teacher";

export const metadata: Metadata = {
  title: "Profesor",
  description: "Mesa privada del profesor: evaluaciones y niveles.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfesorPage() {
  const authenticated = await isTeacherAuthenticated();

  if (!authenticated) {
    return <TeacherGate configured={isTeacherPinConfigured()} />;
  }

  const data = await getTeacherDashboard();
  return <TeacherDashboard data={data} />;
}
