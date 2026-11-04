import { AcademyProvider } from "@/components/providers/academy-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getStudentSessionId } from "@/server/auth/student-session";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";
import { getStudentById } from "@/server/queries/students";

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

  const initialStudent =
    !teacherMode && studentSessionId
      ? await getStudentById(studentSessionId, true)
      : null;

  const sessionKey = teacherMode
    ? "teacher"
    : (initialStudent?.id ?? "guest");

  return (
    <AcademyProvider
      key={sessionKey}
      teacherMode={teacherMode}
      initialStudent={initialStudent}
    >
      <AppShell>{children}</AppShell>
    </AcademyProvider>
  );
}
