/**
 * Client-safe domain vocabulary for Leo Academy.
 * This file must never import server code, SQLite or secrets.
 */

export type Skill = "melody" | "harmony" | "rhythm";
export type Focus = Skill | "theory" | "performance";

export type Student = {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  avatarTone: "sapphire" | "cyan" | "slate";
  /** “Unlocked through level N”: the map never hides anything below it. */
  currentLevel: number;
  age: number | null;
  teacherNotes: string | null;
  streakDays: number;
  totalMinutes: number;
  accuracy: number;
  weeklyMinutes: number;
  weeklyGoalMinutes: number;
  joinedAt: string;
  updatedAt: string;
};

export type Level = {
  id: string;
  ordinal: number;
  title: string;
  subtitle: string;
  focus: Focus;
  minutes: number;
  xp: number;
};

export type TeacherEvaluation = {
  id: string;
  studentId: string;
  studentName: string;
  levelId: string;
  melody: number;
  harmony: number;
  rhythm: number;
  posture: number;
  feedback: string;
  homework: string | null;
  teacherName: string;
  createdAt: string;
};

export type AttendanceMode = "normal" | "unplugged";

export type AttendanceRecord = {
  id: string;
  studentId: string;
  date: string;
  mode: AttendanceMode;
  notes: string | null;
  createdAt: string;
};

/** Triangle used by the radar chart: the three musical axes. */
export type StudentRadar = {
  melody: number;
  harmony: number;
  rhythm: number;
};

export type TeacherDashboardData = {
  source: "sqlite" | "unavailable";
  students: Student[];
  /** Private 4–5 character access code, teacher eyes only. */
  studentCodes: Record<string, string>;
  evaluations: TeacherEvaluation[];
  attendance: AttendanceRecord[];
  /** Average skill score per student, keyed by student id. */
  radar: Record<string, StudentRadar>;
  totalMinutes: number;
  unlockedCount: number;
};

export type LiveSkill = "melody" | "harmony" | "rhythm";

export type LiveClassroomStudent = {
  studentId: string;
  name: string;
  firstName: string;
  initials: string;
  avatarTone: "sapphire" | "cyan" | "slate";
  levelOrdinal: number;
  levelId: string;
  levelTitle: string;
  tab: string;
  exercise: string;
  keyLabel: string | null;
  skill: LiveSkill | null;
  melody: number;
  harmony: number;
  rhythm: number;
  progress: number;
  practicing: boolean;
  online: boolean;
  lastActivity: string | null;
  lastSeenAt: string | null;
};

export type LiveClassroomData = {
  source: "sqlite" | "unavailable";
  students: LiveClassroomStudent[];
  activeCount: number;
  updatedAt: string;
};

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export const SKILL_META: Record<
  Skill,
  { label: string; short: string; color: string; glow: string }
> = {
  melody: {
    label: "Melodía",
    short: "MEL",
    color: "#38BDF8",
    glow: "rgba(56, 189, 248, 0.35)",
  },
  harmony: {
    label: "Armonía",
    short: "ARM",
    color: "#7C9CFF",
    glow: "rgba(124, 156, 255, 0.35)",
  },
  rhythm: {
    label: "Ritmo",
    short: "RIT",
    color: "#F2B45C",
    glow: "rgba(242, 180, 92, 0.3)",
  },
};

/**
 * The four live-rubric axes of the teacher's evaluator. The first three map
 * onto the radar triangle; posture is tracked separately because it is a
 * physical habit, not a musical balance.
 */
export const RUBRIC_AXES = [
  {
    key: "rhythm",
    label: "Sentido del Ritmo",
    hint: "Pulso estable, subdivisiones y silencios medidos.",
    color: "#F2B45C",
    glow: "rgba(242, 180, 92, 0.3)",
  },
  {
    key: "melody",
    label: "Precisión Melódica",
    hint: "Altura, afinación y dirección de la frase.",
    color: "#38BDF8",
    glow: "rgba(56, 189, 248, 0.35)",
  },
  {
    key: "harmony",
    label: "Comprensión Armónica",
    hint: "Escucha de voces, color del acorde y resolución.",
    color: "#7C9CFF",
    glow: "rgba(124, 156, 255, 0.35)",
  },
  {
    key: "posture",
    label: "Postura / Digitación",
    hint: "Muñeca libre, dedos redondos y hombros sin tensión.",
    color: "#5EEAD4",
    glow: "rgba(94, 234, 212, 0.3)",
  },
] as const;

export type RubricAxis = (typeof RUBRIC_AXES)[number]["key"];

export const FOCUS_LABEL: Record<Focus, string> = {
  melody: "Melodía",
  harmony: "Armonía",
  rhythm: "Ritmo",
  theory: "Teoría",
  performance: "Interpretación",
};

export const LEVELS: Level[] = [
  {
    id: "level-01",
    ordinal: 1,
    title: "La primera tecla",
    subtitle: "Postura, digitación y el primer pulso",
    focus: "theory",
    minutes: 10,
    xp: 120,
  },
  {
    id: "level-02",
    ordinal: 2,
    title: "Latido de negras",
    subtitle: "Pulso, silencios y figuras básicas",
    focus: "rhythm",
    minutes: 12,
    xp: 140,
  },
  {
    id: "level-03",
    ordinal: 3,
    title: "Intervalos con carácter",
    subtitle: "Segundas y terceras que cuentan historias",
    focus: "melody",
    minutes: 14,
    xp: 160,
  },
  {
    id: "level-04",
    ordinal: 4,
    title: "Arpegios en La menor",
    subtitle: "Manos separadas, conducción y respiración",
    focus: "harmony",
    minutes: 16,
    xp: 200,
  },
  {
    id: "level-05",
    ordinal: 5,
    title: "Tríadas de zafiro",
    subtitle: "Acordes mayores, menores y suspendidos",
    focus: "harmony",
    minutes: 18,
    xp: 240,
  },
  {
    id: "level-06",
    ordinal: 6,
    title: "El círculo se cierra",
    subtitle: "Círculo de quintas y tonalidades vecinas",
    focus: "theory",
    minutes: 16,
    xp: 260,
  },
  {
    id: "level-07",
    ordinal: 7,
    title: "Dos manos, una voz",
    subtitle: "Melodía y acompañamiento en equilibrio",
    focus: "melody",
    minutes: 22,
    xp: 320,
  },
  {
    id: "level-08",
    ordinal: 8,
    title: "Nocturno del recital",
    subtitle: "Interpretación, dinámica y silencio",
    focus: "performance",
    minutes: 30,
    xp: 500,
  },
];

export const ACTIVE_STUDENT_KEY = "leo.activeStudent";
export const UNPLUGGED_KEY = "leo.unplugged";

export function levelStatus(
  level: Level,
  currentLevel: number,
): "completed" | "current" | "locked" {
  if (level.ordinal < currentLevel) return "completed";
  if (level.ordinal === currentLevel) return "current";
  return "locked";
}

export function getLevel(levelIdOrOrdinal: string | number): Level {
  return (
    LEVELS.find((level) =>
      typeof levelIdOrOrdinal === "number"
        ? level.ordinal === levelIdOrOrdinal
        : level.id === levelIdOrOrdinal,
    ) ?? LEVELS[0]
  );
}
