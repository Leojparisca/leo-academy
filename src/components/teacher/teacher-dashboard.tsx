"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Award,
  Brain,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  Gauge,
  GraduationCap,
  KeyRound,
  LogOut,
  MoonStar,
  NotebookPen,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Unlock,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InlineNotice } from "@/components/shell/neo-toast";
import { BackupPanel } from "@/components/teacher/backup-panel";
import { BulkAttendance } from "@/components/teacher/bulk-attendance";
import { LiveClassroom } from "@/components/teacher/live-classroom";
import { StudentRadar } from "@/components/teacher/student-radar";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  LEVELS,
  RUBRIC_AXES,
  SKILL_META,
  getLevel,
  type AttendanceMode,
  type LiveClassroomStudent,
  type RubricAxis,
  type Student,
  type TeacherDashboardData,
} from "@/lib/academy";
import {
  completeStudentCreation,
  newLocalStudentCode,
  queueStudentCreation,
  readPendingStudentCreations,
  type PendingStudentCreation,
} from "@/lib/local-db";
import { clamp, formatMinutes, formatShortDate } from "@/lib/utils";
import {
  addStudentAction,
  logoutTeacherAction,
  regenerateStudentCodeAction,
  saveAttendanceAction,
  saveEvaluationAction,
  unlockCurriculumLevelAction,
  updateStudentAction,
} from "@/server/actions/teacher";
import { cn } from "@/lib/utils";

type Notice = {
  tone: "success" | "error" | "warning";
  message: string;
} | null;

/** Local-only id so a pending student can render before SQLite confirms it. */
function pendingStudentId(clientId: string) {
  return `stu_local_${clientId.replace(/[^a-z0-9]/gi, "").slice(0, 16)}`;
}

function pendingToStudent(entry: PendingStudentCreation): Student {
  const parts = entry.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? entry.name;
  const initials =
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "AL";
  return {
    id: pendingStudentId(entry.clientId),
    name: entry.name,
    firstName,
    initials,
    avatarTone: "cyan",
    currentLevel: entry.level,
    age: entry.age,
    teacherNotes: entry.notes || null,
    streakDays: 0,
    totalMinutes: 0,
    accuracy: 0,
    weeklyMinutes: 0,
    weeklyGoalMinutes: entry.weeklyGoalMinutes,
    joinedAt: entry.createdAt.slice(0, 10),
    updatedAt: entry.createdAt,
  };
}

const AVATAR_TONE: Record<string, string> = {
  sapphire: "bg-[linear-gradient(145deg,#1a63c7,#0a2f63)] text-[#dbeeff]",
  cyan: "bg-[linear-gradient(145deg,#1a8fb7,#0a425e)] text-[#dcf7ff]",
  slate: "bg-[linear-gradient(145deg,#3a4c63,#18222f)] text-[#e6edf5]",
};

export type LearningStyle = {
  label: string;
  icon: typeof Eye;
  className: string;
};

/** Dominant radar axis → how this student learns best. */
export function learningStyleFor(radar: {
  melody: number;
  harmony: number;
  rhythm: number;
}): LearningStyle | null {
  const axes = [
    { key: "rhythm", value: radar.rhythm },
    { key: "melody", value: radar.melody },
    { key: "harmony", value: radar.harmony },
  ] as const;
  const dominant = axes.reduce(
    (best, axis) => (axis.value > best.value ? axis : best),
    axes[0],
  );
  if (dominant.value <= 0) {
    return {
      label: "Visual",
      icon: Eye,
      className: "border-sky-400/20 bg-sky-400/[0.06] text-sky-200/80",
    };
  }

  if (dominant.key === "rhythm") {
    return {
      label: "Kinestésico",
      icon: Gauge,
      className: "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
    };
  }
  if (dominant.key === "melody") {
    return {
      label: "Visual",
      icon: Eye,
      className: "border-sky-400/25 bg-sky-400/[0.08] text-sky-200",
    };
  }
  return {
    label: "Lógico",
    icon: Brain,
    className: "border-indigo-400/25 bg-indigo-400/[0.08] text-indigo-200",
  };
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
        {label}
        {hint && (
          <span className="normal-case tracking-normal text-faint/60">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}

function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );
}

function RubricSlider({
  axis,
  value,
  onChange,
  disabled,
}: {
  axis: RubricAxis;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const meta = RUBRIC_AXES.find((item) => item.key === axis);
  if (!meta) return null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[7.5px] font-semibold uppercase tracking-[0.14em] text-faint">
          <span
            className="h-1.5 w-1.5 flex-none rounded-full"
            style={{ background: meta.color, boxShadow: `0 0 7px ${meta.glow}` }}
          />
          {meta.label}
        </span>
        <span className="font-display text-[12px] tabular-nums text-ivory/85">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rubric-range"
        aria-label={`${meta.label}: ${value} de 100`}
        style={
          {
            "--axis-color": meta.color,
            "--axis-glow": meta.glow,
          } as React.CSSProperties
        }
      />
      <p className="mt-1 text-[7px] leading-snug text-faint/65">{meta.hint}</p>
    </div>
  );
}

function PostureDial({ value }: { value: number }) {
  const ratio = clamp(value, 0, 100) / 100;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-[58px] w-[58px] flex-none place-items-center">
        <svg viewBox="0 0 58 58" className="absolute inset-0 -rotate-90">
          <circle
            cx="29"
            cy="29"
            r={radius}
            fill="none"
            stroke="rgba(148,197,255,0.12)"
            strokeWidth="4"
          />
          <circle
            cx="29"
            cy="29"
            r={radius}
            fill="none"
            stroke="#5EEAD4"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            style={{
              transition: "stroke-dashoffset 400ms ease",
              filter: "drop-shadow(0 0 5px rgba(94,234,212,0.45))",
            }}
          />
        </svg>
        <span className="font-display text-[13px] tabular-nums text-ivory">
          {value}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-[#5EEAD4]/80">
          Postura / Digitación
        </p>
        <p className="mt-0.5 text-[7.5px] leading-snug text-faint">
          Muñeca libre, dedos redondos, hombros sin tensión.
        </p>
      </div>
    </div>
  );
}

function TeacherEvaluationCard({
  evaluation,
}: {
  evaluation: TeacherDashboardData["evaluations"][number];
}) {
  const level = getLevel(evaluation.levelId);
  const skills: Array<[RubricAxis, number]> = [
    ["melody", evaluation.melody],
    ["harmony", evaluation.harmony],
    ["rhythm", evaluation.rhythm],
    ["posture", evaluation.posture],
  ];

  return (
    <article className="relative rounded-[18px] border border-white/[0.05] bg-white/[0.014] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-[linear-gradient(145deg,#1a63c7,#0a2f63)] text-[9px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            {evaluation.studentName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11.5px] font-semibold text-ivory/90">
              {evaluation.studentName}
            </p>
            <p className="mt-0.5 truncate text-[8px] uppercase tracking-[0.12em] text-faint">
              Nivel {String(level.ordinal).padStart(2, "0")} · {level.title}
            </p>
          </div>
        </div>
        <span className="flex-none text-[7.5px] font-semibold uppercase tracking-[0.1em] text-faint/70">
          {formatShortDate(evaluation.createdAt)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-[10px] leading-[1.55] text-muted">
        {evaluation.feedback}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {skills.map(([axis, score]) => {
          const meta = RUBRIC_AXES.find((item) => item.key === axis);
          const color =
            axis === "posture" ? "#5EEAD4" : SKILL_META[axis].color;
          return (
            <div key={axis}>
              <div className="flex items-center justify-between">
                <span className="truncate text-[6px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {axis === "posture" ? "Postura" : meta?.label.split(" ").pop()}
                </span>
                <span className="text-[8px] tabular-nums text-ivory/70">
                  {score}
                </span>
              </div>
              <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/[0.055]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${score}%`,
                    background: `linear-gradient(90deg,#0D6EFD,${color})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {evaluation.homework && (
        <div className="mt-3 rounded-[10px] border border-white/[0.045] bg-black/15 px-2.5 py-2">
          <span className="text-[6px] font-bold uppercase tracking-[0.16em] text-ember/70">
            Tarea
          </span>
          <p className="mt-0.5 line-clamp-1 text-[8.5px] text-faint">
            {evaluation.homework}
          </p>
        </div>
      )}
    </article>
  );
}

type ProfileDraft = {
  name: string;
  age: string;
  level: number;
  weeklyGoalMinutes: number;
  notes: string;
};

function toDraft(student: Student): ProfileDraft {
  return {
    name: student.name,
    age: student.age == null ? "" : String(student.age),
    level: student.currentLevel,
    weeklyGoalMinutes: student.weeklyGoalMinutes,
    notes: student.teacherNotes ?? "",
  };
}

function draftAge(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function TeacherDashboard({ data }: { data: TeacherDashboardData }) {
  const router = useRouter();
  const disabled = data.source === "unavailable";
  const firstStudent = data.students[0];

  const initialScores = useMemo<Record<RubricAxis, number>>(() => {
    if (!firstStudent) {
      return { melody: 0, harmony: 0, rhythm: 0, posture: 0 };
    }
    const radar = data.radar[firstStudent.id];
    const latest = data.evaluations.find(
      (evaluation) => evaluation.studentId === firstStudent.id,
    );
    return {
      melody: radar?.melody || latest?.melody || 0,
      harmony: radar?.harmony || latest?.harmony || 0,
      rhythm: radar?.rhythm || latest?.rhythm || 0,
      posture: latest?.posture || 0,
    };
  }, [data, firstStudent]);

  const [studentId, setStudentId] = useState(firstStudent?.id ?? "");
  const [levelId, setLevelId] = useState(
    firstStudent ? getLevel(firstStudent.currentLevel).id : "level-01",
  );
  const [scores, setScores] =
    useState<Record<RubricAxis, number>>(initialScores);
  const [feedback, setFeedback] = useState("");
  const [homework, setHomework] = useState("");
  const [unlockNext, setUnlockNext] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Notice>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    age: "",
    level: 1,
    weeklyGoalMinutes: 90,
    notes: "",
  });
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<Notice>(null);
  const [pendingStudents, setPendingStudents] = useState<
    PendingStudentCreation[]
  >([]);
  const [retryingStudents, setRetryingStudents] = useState(false);
  const attemptedSync = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileDraft | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<Notice>(null);

  const [unlockBusy, setUnlockBusy] = useState<number | null>(null);
  const [unlockNotice, setUnlockNotice] = useState<Notice>(null);

  const [attendanceForm, setAttendanceForm] = useState({
    studentId: firstStudent?.id ?? "",
    date: "",
    mode: "normal" as AttendanceMode,
    notes: "",
  });
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<Notice>(null);

  const [codeBusy, setCodeBusy] = useState<string | null>(null);
  const [codeResult, setCodeResult] = useState<Notice>(null);

  useEffect(() => {
    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
    setAttendanceForm((current) =>
      current.date ? current : { ...current, date: local },
    );
  }, []);

  /**
   * Replays one Dexie-outbox row against the Server Action. The client id makes
   * the call idempotent, so a retry after a timeout returns the same student.
   */
  const syncPendingStudent = useCallback(
    async (entry: PendingStudentCreation) => {
      try {
        const response = await addStudentAction({
          name: entry.name,
          age: entry.age,
          level: entry.level,
          weeklyGoalMinutes: entry.weeklyGoalMinutes,
          notes: entry.notes,
          clientId: entry.clientId,
          preferredCode: entry.code,
        });

        if (response.ok) {
          await completeStudentCreation(entry.clientId);
          setPendingStudents((current) =>
            current.filter((item) => item.clientId !== entry.clientId),
          );
          setAddResult({
            tone: "success",
            message: `Alumno creado con éxito · código ${response.data.code}. Guardado en SQLite.`,
          });
          router.refresh();
          return true;
        }

        setAddResult((current) =>
          current?.tone === "error"
            ? current
            : {
                tone: "warning",
                message:
                  `Alumno creado con éxito · código ${entry.code}. ` +
                  "Guardado en este dispositivo; SQLite aún no responde, pero se reintentará al recargar o al pulsar Reintentar.",
              },
        );
        return false;
      } catch {
        setAddResult((current) =>
          current?.tone === "error"
            ? current
            : {
                tone: "warning",
                message:
                  `Alumno creado con éxito · código ${entry.code}. ` +
                  "Guardado en este dispositivo; la sincronización falló por red, pero nada se ha perdido.",
              },
        );
        return false;
      }
    },
    [router],
  );

  const flushPendingStudents = useCallback(
    async (entries: PendingStudentCreation[]) => {
      if (!entries.length) return;
      setRetryingStudents(true);
      for (const entry of entries) {
        const ok = await syncPendingStudent(entry);
        if (!ok) break;
      }
      setRetryingStudents(false);
    },
    [syncPendingStudent],
  );

  // Restore students created while SQLite was down (Dexie outbox).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pending = await readPendingStudentCreations();
        if (!cancelled) setPendingStudents(pending);
      } catch {
        // IndexedDB disabled: the form surfaces an explicit error if it cannot
        // persist the student locally.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // One automatic retry per mount, and only when the server is reachable.
  useEffect(() => {
    if (attemptedSync.current || !pendingStudents.length) return;
    if (data.source !== "sqlite") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    attemptedSync.current = true;
    void flushPendingStudents(pendingStudents);
  }, [data.source, flushPendingStudents, pendingStudents]);

  const selectedStudent = useMemo(
    () => data.students.find((student) => student.id === studentId),
    [data.students, studentId],
  );

  const pendingById = useMemo(
    () =>
      new Map(
        pendingStudents.map((entry) => [
          pendingStudentId(entry.clientId),
          entry,
        ]),
      ),
    [pendingStudents],
  );

  /** SQLite students first, then local-only students still waiting to sync. */
  const visibleStudents = useMemo(
    () => [
      ...data.students,
      ...pendingStudents.map(pendingToStudent),
    ],
    [data.students, pendingStudents],
  );

  const syncScoresToStudent = (id: string) => {
    const radar = data.radar[id];
    const latest = data.evaluations.find(
      (evaluation) => evaluation.studentId === id,
    );
    setScores({
      melody: radar?.melody || latest?.melody || 0,
      harmony: radar?.harmony || latest?.harmony || 0,
      rhythm: radar?.rhythm || latest?.rhythm || 0,
      posture: latest?.posture || 0,
    });
  };

  const handleStudentChange = (id: string) => {
    setStudentId(id);
    const student = data.students.find((item) => item.id === id);
    if (student) setLevelId(getLevel(student.currentLevel).id);
    syncScoresToStudent(id);
  };

  const liveRadar = {
    melody: scores.melody,
    harmony: scores.harmony,
    rhythm: scores.rhythm,
  };

  const submitEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setResult(null);

    const response = await saveEvaluationAction({
      studentId,
      levelId,
      melody: scores.melody,
      harmony: scores.harmony,
      rhythm: scores.rhythm,
      posture: scores.posture,
      feedback,
      homework,
      unlockNext,
    });

    if (response.ok) {
      setResult({
        tone: "success",
        message: unlockNext
          ? "Evaluación guardada. El siguiente nivel queda desbloqueado."
          : "Evaluación guardada en la academia.",
      });
      setFeedback("");
      setHomework("");
      router.refresh();
    } else {
      setResult({ tone: "error", message: response.error });
    }
    setSaving(false);
  };

  const submitStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (adding) return;

    // Validate here (the form is `noValidate`) so a native bubble can never
    // swallow the submit and the reason is always visible in red.
    const name = newStudent.name.trim();
    if (name.length < 2) {
      setAddResult({
        tone: "error",
        message: "Escribe el nombre completo del alumno (mínimo 2 caracteres).",
      });
      return;
    }
    const age = draftAge(newStudent.age);
    if (age != null && (age < 3 || age > 99)) {
      setAddResult({
        tone: "error",
        message: "La edad debe estar entre 3 y 99 años.",
      });
      return;
    }
    const weeklyGoalMinutes = clamp(
      Math.round(newStudent.weeklyGoalMinutes || 90),
      30,
      600,
    );

    setAdding(true);
    setAddResult(null);

    const entry: PendingStudentCreation = {
      queueId: -1,
      clientId: crypto.randomUUID(),
      code: newLocalStudentCode(),
      name,
      age,
      level: newStudent.level,
      weeklyGoalMinutes,
      notes: newStudent.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    // 1) Dexie first: the teacher gets the code instantly and nothing freezes.
    try {
      const stored = await queueStudentCreation(entry);
      setPendingStudents((current) => [stored, ...current]);
      setNewStudent({
        name: "",
        age: "",
        level: 1,
        weeklyGoalMinutes: 90,
        notes: "",
      });
      setShowAdd(false);
      setAddResult({
        tone: "success",
        message: `Alumno creado con éxito · código ${entry.code}. Guardado en este dispositivo; sincronizando con SQLite…`,
      });
    } catch {
      setAddResult({
        tone: "error",
        message:
          "No se pudo guardar el alumno en este dispositivo. Revisa el almacenamiento del navegador e inténtalo de nuevo.",
      });
      setAdding(false);
      return;
    }
    setAdding(false);

    // 2) Server in the background: on success the provisional row is replaced
    // by the authoritative one; on failure it stays queued for a retry.
    void syncPendingStudent(entry);
  };

  const openProfile = (student: Student) => {
    setEditingId(student.id);
    setProfile(toDraft(student));
    setProfileResult(null);
    setUnlockNotice(null);
  };

  const submitProfile = async (event: React.FormEvent, id: string) => {
    event.preventDefault();
    if (savingProfile || !profile) return;
    setSavingProfile(true);
    setProfileResult(null);

    const response = await updateStudentAction({
      studentId: id,
      name: profile.name,
      age: draftAge(profile.age),
      level: profile.level,
      weeklyGoalMinutes: profile.weeklyGoalMinutes,
      notes: profile.notes,
    });

    if (response.ok) {
      setProfileResult({
        tone: "success",
        message: "Perfil actualizado en SQLite.",
      });
      router.refresh();
    } else {
      setProfileResult({ tone: "error", message: response.error });
    }
    setSavingProfile(false);
  };

  const unlockLevel = async (id: string, level: number) => {
    if (unlockBusy) return;
    setUnlockBusy(level);
    setUnlockNotice(null);
    const response = await unlockCurriculumLevelAction({
      studentId: id,
      level,
    });
    if (response.ok) {
      setUnlockNotice({
        tone: "success",
        message: `Nivel ${level} desbloqueado para el alumno.`,
      });
      router.refresh();
    } else {
      setUnlockNotice({ tone: "error", message: response.error });
    }
    setUnlockBusy(null);
  };

  const submitAttendance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingAttendance) return;
    setSavingAttendance(true);
    setAttendanceResult(null);

    const response = await saveAttendanceAction({
      studentId: attendanceForm.studentId,
      date: attendanceForm.date,
      mode: attendanceForm.mode,
      notes: attendanceForm.notes,
    });

    if (response.ok) {
      setAttendanceResult({
        tone: "success",
        message:
          response.data.mode === "unplugged"
            ? "Clase en Modo Sin Luz registrada."
            : "Asistencia registrada.",
      });
      setAttendanceForm((current) => ({ ...current, notes: "" }));
      router.refresh();
    } else {
      setAttendanceResult({ tone: "error", message: response.error });
    }
    setSavingAttendance(false);
  };

  const logout = async () => {
    setLoggingOut(true);
    await logoutTeacherAction();
    router.refresh();
    setLoggingOut(false);
  };

  const gradeFromLive = (card: LiveClassroomStudent) => {
    setStudentId(card.studentId);
    setLevelId(card.levelId);
    const latest = data.evaluations.find(
      (evaluation) => evaluation.studentId === card.studentId,
    );
    setScores({
      melody: card.melody,
      harmony: card.harmony,
      rhythm: card.rhythm,
      posture: latest?.posture ?? 0,
    });
    setResult({
      tone: "success",
      message: `Rúbrica de ${card.firstName} cargada desde el salón en vivo.`,
    });
    window.requestAnimationFrame(() => {
      document
        .getElementById("evaluacion")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const regenerateCode = async (id: string) => {
    if (codeBusy) return;
    setCodeBusy(id);
    setCodeResult(null);
    const response = await regenerateStudentCodeAction({ studentId: id });
    if (response.ok) {
      setCodeResult({
        tone: "success",
        message: `Nuevo código de acceso: ${response.data.code}`,
      });
      router.refresh();
    } else {
      setCodeResult({ tone: "error", message: response.error });
    }
    setCodeBusy(null);
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-medium text-slate-300 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            Mesa del profesor · Sesión verificada
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="flex h-10 flex-none items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 text-[10px] font-semibold text-slate-300 transition-colors hover:text-white disabled:opacity-50"
          >
            <LogOut size={13} />
            {loggingOut ? "Saliendo…" : "Salir"}
          </button>
        </div>
        <h1 className="mt-4 text-[32px] font-bold leading-[1.05] tracking-[-0.03em] text-white">
          La mesa del <span className="text-sky-300">profesor</span>.
        </h1>
        <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-slate-300">
          Evalúa en vivo, abre puertas y registra la clase. Todo se guarda en el
          servidor y en este dispositivo.
        </p>
      </header>

      {data.source === "unavailable" && (
        <InlineNotice tone="warning">
          SQLite no responde ahora mismo. La evaluación queda en pausa, pero
          puedes seguir añadiendo alumnos: se guardan al instante en este
          dispositivo y se sincronizan solos cuando vuelva la base de datos.
        </InlineNotice>
      )}

      <section
        className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 backdrop-blur-xl"
        aria-label="Resumen de la academia"
      >
        <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
          {[
            { icon: Users, label: "Alumnos", value: visibleStudents.length },
            {
              icon: Award,
              label: "Evaluaciones",
              value: data.evaluations.length,
            },
            {
              icon: GraduationCap,
              label: "Niveles abiertos",
              value: data.unlockedCount,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1.5 px-1 py-4"
            >
              <stat.icon size={14} className="text-sky-300/80" />
              <span className="text-[22px] font-bold leading-none tabular-nums text-white">
                {stat.value}
              </span>
              <span className="text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[10px]">
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.1em] text-slate-400">
            <Clock3 size={11} />
            Minutos acumulados
          </span>
          <span className="text-[12px] font-bold text-white">
            {formatMinutes(data.totalMinutes)}
          </span>
        </div>
      </section>

      <LiveClassroom onGrade={gradeFromLive} />

      <section aria-labelledby="evaluacion">
        <SectionHeading
          id="evaluacion"
          index="02"
          title="Evaluador en vivo"
          meta={
            <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.14em] text-glow/80">
              <Sparkles size={9} />
              Rúbrica · 4 ejes
            </span>
          }
        />

        <form
          onSubmit={submitEvaluation}
          className="neu-card mt-3 space-y-4 rounded-[24px] p-4"
        >
          <div className="space-y-3">
            <Field label="Alumno">
              <SelectShell>
                <select
                  className="neu-input appearance-none pr-8"
                  value={studentId}
                  onChange={(event) => handleStudentChange(event.target.value)}
                  disabled={disabled}
                  required
                >
                  {data.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
            <Field
              label="Nivel evaluado"
              hint={`${String(
                LEVELS.find((level) => level.id === levelId)?.ordinal ?? 1,
              ).padStart(2, "0")} / ${String(LEVELS.length).padStart(2, "0")}`}
            >
              <SelectShell>
                <select
                  className="neu-input appearance-none pr-8"
                  value={levelId}
                  onChange={(event) => setLevelId(event.target.value)}
                  disabled={disabled}
                  required
                >
                  {LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {String(level.ordinal).padStart(2, "0")} · {level.title}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
          </div>

          {selectedStudent && (
            <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.04] bg-white/[0.015] px-3 py-2">
              <span className="grid h-6 w-6 place-items-center rounded-[8px] bg-royal/15 text-[8px] font-bold text-glow">
                {selectedStudent.initials}
              </span>
              <span className="text-[8.5px] text-faint">
                Desbloqueado hasta{" "}
                <span className="font-semibold text-ivory/80">
                  N{String(selectedStudent.currentLevel).padStart(2, "0")}
                </span>{" "}
                · racha de {selectedStudent.streakDays} días
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3.5">
              {RUBRIC_AXES.map((axis) => (
                <RubricSlider
                  key={axis.key}
                  axis={axis.key}
                  value={scores[axis.key]}
                  onChange={(value) =>
                    setScores((current) => ({ ...current, [axis.key]: value }))
                  }
                  disabled={disabled}
                />
              ))}
            </div>

            <div className="flex flex-col items-center justify-center gap-2 rounded-[18px] border border-white/[0.045] bg-white/[0.012] px-2 py-3 sm:w-[190px]">
              <p className="text-[6.5px] font-semibold uppercase tracking-[0.15em] text-faint">
                Balance en vivo
              </p>
              <StudentRadar data={liveRadar} size={148} muted />
              <PostureDial value={scores.posture} />
            </div>
          </div>

          <Field label="Lectura del profesor" hint={`${feedback.length}/600`}>
            <textarea
              className="neu-input min-h-[82px] resize-none leading-relaxed"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Qué escuchaste, qué creció, qué cuidar esta semana…"
              maxLength={600}
              minLength={8}
              required
              disabled={disabled}
            />
          </Field>

          <Field label="Tarea para casa" hint="opcional">
            <input
              className="neu-input"
              value={homework}
              onChange={(event) => setHomework(event.target.value)}
              placeholder="Ej. Arpegios de La menor a 72 BPM, manos separadas"
              maxLength={400}
              disabled={disabled}
            />
          </Field>

          <button
            type="button"
            role="switch"
            aria-checked={unlockNext}
            onClick={() => setUnlockNext((value) => !value)}
            disabled={disabled}
            className="flex w-full items-center gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-left"
          >
            <span
              className={cn(
                "relative h-6 w-11 flex-none rounded-full border transition-colors duration-300",
                unlockNext
                  ? "border-cyan-300/30 bg-royal/40"
                  : "border-white/10 bg-black/40",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.4)] transition-all duration-300",
                  unlockNext ? "left-[25px]" : "left-[3px]",
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9.5px] font-semibold text-ivory/85">
                Desbloquear el siguiente nivel
              </span>
              <span className="mt-0.5 block text-[7.5px] text-faint">
                El alumno verá la nueva puerta en su mapa.
              </span>
            </span>
            {unlockNext && <Check size={13} className="flex-none text-glow" />}
          </button>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <InlineNotice
                  tone={result.tone === "success" ? "info" : "error"}
                >
                  {result.message}
                </InlineNotice>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={saving || disabled}
            className="neu-button neu-button--primary w-full rounded-[14px] py-3 text-[10.5px] disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Guardando en SQLite…" : "Guardar evaluación"}
            <ArrowUpRight size={13} className="ml-auto opacity-60" />
          </button>
        </form>
      </section>

      <section aria-labelledby="alumnos">
        <SectionHeading
          id="alumnos"
          index="03"
          title="Alumnos"
          meta={
            <button
              type="button"
              onClick={() => {
                setShowAdd((value) => !value);
                setAddResult(null);
              }}
              aria-expanded={showAdd}
              aria-controls="nuevo-alumno"
              className="relative z-10 flex items-center gap-1 rounded-md px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-glow/85 transition-colors hover:bg-white/[0.05]"
            >
              <UserPlus size={10} />
              {showAdd ? "Cerrar" : "Añadir"}
            </button>
          }
        />

        <AnimatePresence>
          {showAdd && (
            <motion.form
              id="nuevo-alumno"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={submitStudent}
              noValidate
              className="pointer-events-auto relative z-50 mt-3 overflow-visible"
            >
              <div className="neu-card pointer-events-auto space-y-3 rounded-[20px] p-4">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-[7px]">Nuevo alumno</span>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    aria-label="Cerrar formulario"
                    className="grid h-6 w-6 place-items-center rounded-md text-faint hover:bg-white/5"
                  >
                    <X size={12} />
                  </button>
                </div>

                <Field label="Nombre completo">
                  <input
                    className="neu-input"
                    value={newStudent.name}
                    onChange={(event) =>
                      setNewStudent((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Nombre y apellidos"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </Field>

                <div className="grid grid-cols-3 gap-2">
                  <Field label="Edad" hint="años">
                    <input
                      className="neu-input"
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={99}
                      value={newStudent.age}
                      onChange={(event) =>
                        setNewStudent((current) => ({
                          ...current,
                          age: event.target.value,
                        }))
                      }
                      placeholder="—"
                    />
                  </Field>
                  <Field label="Nivel">
                    <SelectShell>
                      <select
                        className="neu-input appearance-none pr-8"
                        value={newStudent.level}
                        onChange={(event) =>
                          setNewStudent((current) => ({
                            ...current,
                            level: Number(event.target.value),
                          }))
                        }
                      >
                        {LEVELS.map((level) => (
                          <option key={level.id} value={level.ordinal}>
                            {String(level.ordinal).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </SelectShell>
                  </Field>
                  <Field label="Meta" hint="min">
                    <input
                      className="neu-input"
                      type="number"
                      min={30}
                      max={600}
                      step={15}
                      value={newStudent.weeklyGoalMinutes}
                      onChange={(event) =>
                        setNewStudent((current) => ({
                          ...current,
                          weeklyGoalMinutes: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                </div>

                <Field label="Notas privadas" hint="solo profesor">
                  <textarea
                    className="neu-input min-h-[64px] resize-none leading-relaxed"
                    value={newStudent.notes}
                    onChange={(event) =>
                      setNewStudent((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Cómo aprende, qué le motiva, qué evitar…"
                    maxLength={800}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={adding}
                  className="neu-button w-full rounded-[12px] py-2.5 text-[9.5px] disabled:opacity-50"
                >
                  {adding ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Plus size={12} />
                  )}
                  {adding ? "Cargando…" : "Añadir al sendero"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {addResult && (
          <div
            role={addResult.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            className={cn(
              "mt-3 flex items-center justify-between gap-2 rounded-[12px] border px-3 py-2.5 text-[9px] leading-[1.5]",
              addResult.tone === "success" &&
                "border-cyan-300/25 bg-cyan-300/[0.06] text-glow",
              addResult.tone === "error" &&
                "border-red-400/35 bg-red-500/10 text-red-300",
              addResult.tone === "warning" &&
                "border-amber-300/25 bg-amber-300/[0.06] text-amber-200",
            )}
          >
            <span>{addResult.message}</span>
            {pendingStudents.length > 0 && addResult.tone !== "error" && (
              <button
                type="button"
                onClick={() => void flushPendingStudents(pendingStudents)}
                disabled={retryingStudents}
                className="flex flex-none items-center gap-1 rounded-md border border-white/20 px-1.5 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
              >
                <RefreshCw
                  size={8}
                  className={retryingStudents ? "animate-spin" : undefined}
                />
                {retryingStudents ? "Reintentando…" : "Reintentar"}
              </button>
            )}
          </div>
        )}

        {!addResult && pendingStudents.length > 0 && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between gap-2 rounded-[12px] border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2.5 text-[9px] leading-[1.5] text-amber-200"
          >
            <span>
              {pendingStudents.length === 1
                ? "1 alumno guardado solo en este dispositivo."
                : `${pendingStudents.length} alumnos guardados solo en este dispositivo.`}{" "}
              Se sincronizarán con SQLite al recuperar la conexión.
            </span>
            <button
              type="button"
              onClick={() => void flushPendingStudents(pendingStudents)}
              disabled={retryingStudents}
              className="flex flex-none items-center gap-1 rounded-md border border-white/20 px-1.5 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
            >
              <RefreshCw
                size={8}
                className={retryingStudents ? "animate-spin" : undefined}
              />
              {retryingStudents ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        )}

        {visibleStudents.length === 0 && (
          <p className="mt-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[9px] text-faint">
            Todavía no hay alumnos. Pulsa «Añadir» para registrar el primero.
          </p>
        )}

        <div className="mt-3 space-y-2.5">
          {visibleStudents.map((student) => {
            const pending = pendingById.get(student.id);
            const baseRadar = data.radar[student.id] ?? {
              melody: 0,
              harmony: 0,
              rhythm: 0,
            };
            const latest = data.evaluations.find(
              (evaluation) => evaluation.studentId === student.id,
            );
            // Skill scores are the source of truth; a teacher evaluation is the
            // fallback so a brand-new student still shows a learning style.
            const hasSkillData =
              baseRadar.melody + baseRadar.harmony + baseRadar.rhythm > 0;
            const radar =
              hasSkillData || !latest
                ? baseRadar
                : {
                    melody: latest.melody,
                    harmony: latest.harmony,
                    rhythm: latest.rhythm,
                  };
            const open = editingId === student.id;
            const style = learningStyleFor(radar);

            return (
              <article
                key={student.id}
                className={cn(
                  "overflow-hidden rounded-3xl border bg-[#0E1524]/80 backdrop-blur-xl transition-colors",
                  open ? "border-sky-400/25" : "border-white/[0.08]",
                )}
              >
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <span
                    className={cn(
                      "grid h-11 w-11 flex-none place-items-center rounded-full text-[12px] font-bold ring-1 ring-white/15",
                      AVATAR_TONE[student.avatarTone] ?? AVATAR_TONE.sapphire,
                    )}
                  >
                    {student.initials}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-[14px] font-bold leading-tight text-white">
                        {student.name}
                      </p>
                      {style && (
                        <span
                          className={cn(
                            "inline-flex flex-none items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold",
                            style.className,
                          )}
                        >
                          <style.icon size={9} />
                          {style.label}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
                      {student.age != null ? `${student.age} años · ` : ""}
                      hasta N{String(student.currentLevel).padStart(2, "0")} ·{" "}
                      {student.streakDays} d de racha
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/[0.07] px-2 py-0.5 text-[9px] font-bold tracking-[0.06em] text-sky-200">
                        <KeyRound size={9} />
                        {pending
                          ? pending.code
                          : (data.studentCodes[student.id] ?? "—")}
                      </span>
                      {pending && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2 py-0.5 text-[9px] font-semibold text-amber-200/90">
                          <RefreshCw size={8} className="animate-spin" />
                          Sin sincronizar
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1">
                      {LEVELS.map((level) => (
                        <span
                          key={level.id}
                          className={cn(
                            "h-1 flex-1 rounded-full",
                            level.ordinal <= student.currentLevel
                              ? "bg-[linear-gradient(90deg,#0D6EFD,#38BDF8)]"
                              : "bg-white/[0.07]",
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-none items-center gap-1.5">
                    <StudentRadar data={radar} size={56} muted compact />
                    <button
                      type="button"
                      onClick={() =>
                        open ? setEditingId(null) : openProfile(student)
                      }
                      disabled={Boolean(pending)}
                      aria-expanded={open}
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-full border transition-colors disabled:opacity-40",
                        open
                          ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                          : "border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white",
                      )}
                      aria-label={
                        pending
                          ? `El perfil de ${student.name} se podrá editar al sincronizar`
                          : open
                            ? `Cerrar perfil de ${student.name}`
                            : `Editar perfil de ${student.name}`
                      }
                    >
                      <NotebookPen size={14} />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {open && profile && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden border-t border-white/[0.05]"
                    >
                      <div className="space-y-3.5 px-4 py-3.5">
                        <form
                          onSubmit={(event) => {
                            void submitProfile(event, student.id);
                          }}
                          className="space-y-3"
                        >
                          <div className="grid grid-cols-[1fr_74px] gap-2">
                            <Field label="Nombre">
                              <input
                                className="neu-input"
                                value={profile.name}
                                onChange={(event) =>
                                  setProfile((current) =>
                                    current
                                      ? { ...current, name: event.target.value }
                                      : current,
                                  )
                                }
                                minLength={2}
                                maxLength={80}
                                required
                              />
                            </Field>
                            <Field label="Edad">
                              <input
                                className="neu-input"
                                type="number"
                                inputMode="numeric"
                                min={3}
                                max={99}
                                value={profile.age}
                                onChange={(event) =>
                                  setProfile((current) =>
                                    current
                                      ? { ...current, age: event.target.value }
                                      : current,
                                  )
                                }
                                placeholder="—"
                              />
                            </Field>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Nivel de perfil">
                              <SelectShell>
                                <select
                                  className="neu-input appearance-none pr-8"
                                  value={profile.level}
                                  onChange={(event) =>
                                    setProfile((current) =>
                                      current
                                        ? {
                                            ...current,
                                            level: Number(event.target.value),
                                          }
                                        : current,
                                    )
                                  }
                                >
                                  {LEVELS.map((level) => (
                                    <option key={level.id} value={level.ordinal}>
                                      {String(level.ordinal).padStart(2, "0")} ·{" "}
                                      {level.title}
                                    </option>
                                  ))}
                                </select>
                              </SelectShell>
                            </Field>
                            <Field label="Meta semanal" hint="min">
                              <input
                                className="neu-input"
                                type="number"
                                min={30}
                                max={600}
                                step={15}
                                value={profile.weeklyGoalMinutes}
                                onChange={(event) =>
                                  setProfile((current) =>
                                    current
                                      ? {
                                          ...current,
                                          weeklyGoalMinutes: Number(
                                            event.target.value,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              />
                            </Field>
                          </div>

                          <Field label="Notas privadas" hint="solo profesor">
                            <textarea
                              className="neu-input min-h-[64px] resize-none leading-relaxed"
                              value={profile.notes}
                              onChange={(event) =>
                                setProfile((current) =>
                                  current
                                    ? { ...current, notes: event.target.value }
                                    : current,
                                )
                              }
                              placeholder="Diagnóstico, motivación, acuerdos…"
                              maxLength={800}
                            />
                          </Field>

                          {profileResult && (
                            <p
                              className={cn(
                                "text-[8.5px]",
                                profileResult.tone === "success"
                                  ? "text-glow/90"
                                  : "text-ember/90",
                              )}
                            >
                              {profileResult.message}
                            </p>
                          )}

                          <button
                            type="submit"
                            disabled={savingProfile || disabled}
                            className="neu-button w-full rounded-[11px] py-2 text-[9px] disabled:opacity-50"
                          >
                            <Save size={11} />
                            {savingProfile ? "Guardando…" : "Guardar perfil"}
                          </button>
                        </form>

                        <div className="flex items-center gap-2 rounded-[12px] border border-cyan-300/12 bg-cyan-300/[0.035] px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-[6.5px] font-semibold uppercase tracking-[0.13em] text-faint">
                              <KeyRound size={9} />
                              Código de alumno
                            </p>
                            <p className="mt-0.5 font-display text-[16px] tracking-[0.16em] text-ivory">
                              {data.studentCodes[student.id] ?? "—"}
                            </p>
                            <p className="text-[6.5px] text-faint/60">
                              Se usa con el nombre para entrar a su perfil.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void regenerateCode(student.id)}
                            disabled={codeBusy !== null || disabled}
                            className="neu-button h-8 min-h-0 flex-none rounded-[10px] px-2.5 text-[7.5px] disabled:opacity-50"
                          >
                            <RefreshCw
                              size={10}
                              className={
                                codeBusy === student.id ? "animate-spin" : undefined
                              }
                            />
                            {codeBusy === student.id ? "…" : "Nuevo código"}
                          </button>
                        </div>

                        {codeResult && (
                          <p
                            className={cn(
                              "text-[8px]",
                              codeResult.tone === "success"
                                ? "text-glow/90"
                                : "text-ember/90",
                            )}
                          >
                            {codeResult.message}
                          </p>
                        )}

                        <div>
                          <p className="mb-1.5 flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
                            <Unlock size={9} />
                            Desbloqueo manual del mapa
                          </p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {LEVELS.map((level) => {
                              const unlocked =
                                level.ordinal <= student.currentLevel;
                              return (
                                <button
                                  key={level.id}
                                  type="button"
                                  onClick={() =>
                                    void unlockLevel(student.id, level.ordinal)
                                  }
                                  disabled={
                                    disabled || unlocked || unlockBusy !== null
                                  }
                                  className={cn(
                                    "rounded-[9px] border px-1 py-1.5 text-[8px] font-semibold tabular-nums transition-colors",
                                    unlocked
                                      ? "border-cyan-300/20 bg-cyan-300/[0.07] text-glow/80"
                                      : "border-white/[0.07] bg-white/[0.02] text-faint hover:border-white/15 hover:text-ivory",
                                    unlockBusy === level.ordinal &&
                                      "animate-pulse",
                                  )}
                                  aria-label={
                                    unlocked
                                      ? `Nivel ${level.ordinal} ya desbloqueado`
                                      : `Desbloquear nivel ${level.ordinal}`
                                  }
                                >
                                  N{String(level.ordinal).padStart(2, "0")}
                                </button>
                              );
                            })}
                          </div>
                          {unlockNotice && (
                            <p
                              className={cn(
                                "mt-1.5 text-[8px]",
                                unlockNotice.tone === "success"
                                  ? "text-glow/90"
                                  : "text-ember/90",
                              )}
                            >
                              {unlockNotice.message}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 rounded-[12px] border border-white/[0.045] bg-white/[0.012] px-3 py-2.5">
                          <PostureDial value={latest?.posture ?? 0} />
                          <div className="min-w-0 flex-1 text-right">
                            <p className="text-[6.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                              Precisa atención
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[8px] leading-snug text-faint/80">
                              {student.teacherNotes ??
                                "Sin notas privadas todavía."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="asistencia">
        <SectionHeading
          id="asistencia"
          index="04"
          title="Asistencia"
          meta={
            <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-faint">
              <CalendarCheck size={9} />
              {data.attendance.length} registros
            </span>
          }
        />

        <BulkAttendance students={data.students} disabled={disabled} />

        <form
          onSubmit={submitAttendance}
          className="neu-card mt-3 space-y-3 rounded-[20px] p-4"
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Alumno">
              <SelectShell>
                <select
                  className="neu-input appearance-none pr-8"
                  value={attendanceForm.studentId}
                  onChange={(event) =>
                    setAttendanceForm((current) => ({
                      ...current,
                      studentId: event.target.value,
                    }))
                  }
                  disabled={disabled}
                  required
                >
                  {data.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
            <Field label="Fecha">
              <input
                type="date"
                className="neu-input min-w-0 px-3 text-[12px]"
                value={attendanceForm.date}
                onChange={(event) =>
                  setAttendanceForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                disabled={disabled}
                required
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
              Modo de clase
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  mode: "normal" as const,
                  icon: Sun,
                  label: "Clase normal",
                  hint: "Con teclado",
                },
                {
                  mode: "unplugged" as const,
                  icon: MoonStar,
                  label: "Modo Sin Luz",
                  hint: "Voz y palmas",
                },
              ].map((option) => {
                const active = attendanceForm.mode === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() =>
                      setAttendanceForm((current) => ({
                        ...current,
                        mode: option.mode,
                      }))
                    }
                    disabled={disabled}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-2 rounded-[12px] border px-2.5 py-2 text-left transition-colors",
                      active
                        ? "border-cyan-300/30 bg-cyan-300/[0.06] text-ivory"
                        : "border-white/[0.06] bg-white/[0.015] text-faint hover:text-ivory",
                    )}
                  >
                    <option.icon
                      size={13}
                      className={active ? "text-glow" : "text-faint"}
                    />
                    <span className="min-w-0">
                      <span className="block text-[8.5px] font-semibold">
                        {option.label}
                      </span>
                      <span className="block text-[6.5px] text-faint">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Nota de la clase" hint="opcional">
            <input
              className="neu-input"
              value={attendanceForm.notes}
              onChange={(event) =>
                setAttendanceForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Ej. Trabajamos síncopa sin teclado"
              maxLength={400}
              disabled={disabled}
            />
          </Field>

          {attendanceResult && (
            <p
              className={cn(
                "text-[8.5px]",
                attendanceResult.tone === "success"
                  ? "text-glow/90"
                  : "text-ember/90",
              )}
            >
              {attendanceResult.message}
            </p>
          )}

          <button
            type="submit"
            disabled={savingAttendance || disabled}
            className="neu-button w-full rounded-[12px] py-2.5 text-[9.5px] disabled:opacity-50"
          >
            <Gauge size={12} />
            {savingAttendance ? "Registrando…" : "Registrar asistencia"}
          </button>
        </form>

        {data.attendance.length > 0 && (
          <div className="neu-card mt-3 overflow-hidden rounded-[18px] px-4">
            {data.attendance.slice(0, 8).map((record, index) => {
              const student = data.students.find(
                (item) => item.id === record.studentId,
              );
              const unplugged = record.mode === "unplugged";
              return (
                <div
                  key={record.id}
                  className={cn(
                    "flex items-center gap-2.5 py-2.5",
                    index !== Math.min(data.attendance.length, 8) - 1 &&
                      "border-b border-white/[0.045]",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 flex-none place-items-center rounded-[8px] border",
                      unplugged
                        ? "border-[#F2B45C]/25 bg-[#F2B45C]/[0.08] text-[#F2B45C]"
                        : "border-cyan-300/20 bg-cyan-300/[0.06] text-glow",
                    )}
                  >
                    {unplugged ? <MoonStar size={11} /> : <Sun size={11} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9.5px] font-semibold text-ivory/85">
                      {student?.name ?? "Alumno"}
                      {unplugged && (
                        <span className="ml-1.5 text-[6.5px] font-semibold uppercase tracking-[0.1em] text-[#F2B45C]/80">
                          Sin Luz
                        </span>
                      )}
                    </p>
                    {record.notes && (
                      <p className="mt-0.5 truncate text-[7.5px] text-faint">
                        {record.notes}
                      </p>
                    )}
                  </div>
                  <span className="flex-none text-[7px] font-semibold uppercase tracking-[0.1em] text-faint/70">
                    {formatShortDate(record.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="ultimas">
        <SectionHeading
          id="ultimas"
          index="05"
          title="Últimas evaluaciones"
          meta={
            <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-faint">
              <ShieldCheck size={9} />
              {data.source === "sqlite" ? "SQLite" : "Demo"}
            </span>
          }
        />
        <div className="mt-3 space-y-2.5">
          {data.evaluations.length === 0 && (
            <div className="neu-inset rounded-[16px] p-4 text-center text-[9px] text-faint">
              Aún no hay evaluaciones guardadas.
            </div>
          )}
          {data.evaluations.map((evaluation) => (
            <TeacherEvaluationCard
              key={evaluation.id}
              evaluation={evaluation}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="pin-profesor">
        <SectionHeading
          id="pin-profesor"
          index="07"
          title="Acceso del profesor"
          meta={
            <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-faint">
              <KeyRound size={9} />
              Solo profe
            </span>
          }
        />

        <div className="neu-card mt-3 space-y-2 rounded-[20px] p-4">
          <p className="flex items-center gap-2 text-[9.5px] font-semibold text-ivory">
            <ShieldCheck size={12} className="text-glow/80" />
            El PIN se gestiona en el servidor
          </p>
          <p className="text-[8.5px] leading-relaxed text-faint">
            Por seguridad, esta mesa ya no muestra ni permite cambiar la clave.
            El PIN del profesor vive únicamente en las variables de entorno de
            tu servidor.
          </p>
          <p className="rounded-[11px] border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-[7.5px] leading-relaxed text-faint/80">
            Para rotarlo, edita{" "}
            <span className="font-semibold text-ivory/80">TEACHER_PIN</span> o{" "}
            <span className="font-semibold text-ivory/80">PROFESSOR_PIN</span>{" "}
            y reinicia la aplicación.
          </p>
        </div>
      </section>

      <BackupPanel />
    </div>
  );
}
