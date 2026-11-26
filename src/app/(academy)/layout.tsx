import { AcademyProvider } from "@/components/providers/academy-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getStudentSessionId } from "@/server/auth/student-session";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";
import {
  getStudentById,
  getStudentProgressPackage,
} from "@/server/queries/students";

export const dynamic = "force-dynamic";

export default async function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [teacherMode, studentSessionId] = await Promise.all([
    isTeacherAuthenticated(),
    getStudentSessionId(),
  ]);

  // The profile and the progress package are read together: sending only the
  // profile would render an empty map on a brand-new device and then ask the
  // browser for the rest, which is exactly the flash this block removes.
  const initialStudent =
    !teacherMode && studentSessionId
      ? await getStudentById(studentSessionId, true)
      : null;

  const initialProgress =
    !teacherMode && studentSessionId
      ? await getStudentProgressPackage(studentSessionId)
      : null;

  const sessionKey = teacherMode
    ? "teacher"
    : (initialStudent?.id ?? "guest");

  return (
    <AcademyProvider
      key={sessionKey}
      teacherMode={teacherMode}
      initialStudent={initialStudent}
      initialProgress={initialProgress}
    >
      <AppShell>{children}</AppShell>
    </AcademyProvider>
  );
}