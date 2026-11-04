"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  ACTIVE_STUDENT_KEY,
  UNPLUGGED_KEY,
  getLevel,
  type Skill,
  type Student,
} from "@/lib/academy";
import {
  getLocalDb,
  markBackupSynced,
  markQueueEntry,
  pendingMutationCount,
  queueMutation,
  readBackupDump,
  readBackupStamp,
  readBackupStats,
  readPracticeQueue,
  readXpTotals,
  saveCurriculumResult,
  seedLocalDb,
  appendXp,
  writeBackupStamp,
  type LocalCurriculumProgress,
  type LocalLessonProgress,
  type LocalSkillScore,
  type PracticePayload,
} from "@/lib/local-db";
import type {
  BackupState,
  BackupSummary,
  LocalBackupStats,
} from "@/lib/backup";
import {
  fetchStudentsAction,
  logPracticeAction,
  syncPracticeSessionsAction,
} from "@/server/actions/students";
import { syncLiveProgressAction } from "@/server/actions/live";
import { fetchClassroomRosterAction } from "@/server/actions/student-auth";
import { syncBackupAction } from "@/server/actions/sync";
import { getCurriculumNode, xpForNode } from "@/data/curriculum";
import { clamp, uid } from "@/lib/utils";

export type NoticeTone = "info" | "success" | "warning";
export type Notice = { id: string; message: string; tone: NoticeTone };

type LogPracticeInput = {
  levelId: string;
  minutes: number;
  skill: Skill;
  score?: number;
  /** The caller already shows its own compact confirmation (passive studio). */
  quiet?: boolean;
};

type CurriculumResultInput = {
  nodeId: string;
  stars: 1 | 2 | 3;
  accuracy: number;
};

type GameResultInput = {
  skill: Skill;
  accuracy: number;
  xp: number;
  detail: string;
};

export type LiveActivityPatch = {
  tab?: string;
  levelId?: string | null;
  exercise?: string;
  keyLabel?: string | null;
  skill?: Skill | null;
  practicing?: boolean;
};

type AcademyContextValue = {
  students: Student[];
  /** `null` until a real student profile exists (first launch / empty class). */
  activeStudent: Student | null;
  activeStudentId: string | null;
  setActiveStudentId: (id: string) => void;
  teacherMode: boolean;
  studentMode: boolean;
  ownStudentId: string | null;
  canSwitchStudents: boolean;
  passThePhone: boolean;
  enablePassThePhone: () => Promise<void>;
  disablePassThePhone: () => void;
  reportLiveActivity: (patch: LiveActivityPatch) => void;
  offlineMode: boolean;
  toggleOfflineMode: () => void;
  pendingSync: number;
  syncState: "idle" | "syncing" | "offline" | "error";
  dataSource: "local" | "server";
  backupState: BackupState;
  backupStats: LocalBackupStats | null;
  lastBackupAt: string | null;
  backupToServer: () => Promise<BackupSummary | null>;
  progress: LocalLessonProgress[];
  skillScores: LocalSkillScore[];
  curriculum: LocalCurriculumProgress[];
  xpByStudent: Record<string, number>;
  logPractice: (input: LogPracticeInput) => Promise<void>;
  recordCurriculumResult: (
    input: CurriculumResultInput,
  ) => Promise<{ stars: number; accuracy: number; xp: number }>;
  recordGameResult: (input: GameResultInput) => Promise<void>;
  awardGroupXp: (studentId: string, amount: number, detail: string) => Promise<void>;
  refreshFromServer: () => Promise<void>;
  notice: Notice | null;
  notify: (message: string, tone?: NoticeTone) => void;
  dismissNotice: () => void;
};

const AcademyContext = createContext<AcademyContextValue | null>(null);

function tabFromPath(pathname: string) {
  if (pathname.startsWith("/estudio")) return "estudio";
  if (pathname.startsWith("/juegos")) return "juegos";
  if (pathname.startsWith("/profesor")) return "profesor";
  return "mapa";
}

export function AcademyProvider({
  children,
  teacherMode = false,
  initialStudent = null,
}: {
  children: React.ReactNode;
  teacherMode?: boolean;
  initialStudent?: Student | null;
}) {
  const pathname = usePathname();
  const studentMode = Boolean(initialStudent) && !teacherMode;

  const [students, setStudents] = useState<Student[]>(
    initialStudent ? [initialStudent] : [],
  );
  const [activeStudentId, setActiveId] = useState<string | null>(
    initialStudent?.id ?? null,
  );
  const [passThePhone, setPassThePhone] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncState, setSyncState] = useState<
    "idle" | "syncing" | "offline" | "error"
  >("idle");
  const [dataSource, setDataSource] = useState<"local" | "server">("local");
  const [backupState, setBackupState] = useState<BackupState>("device");
  const [backupStats, setBackupStats] = useState<LocalBackupStats | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<LocalLessonProgress[]>([]);
  const [skillScores, setSkillScores] = useState<LocalSkillScore[]>([]);
  const [curriculum, setCurriculum] = useState<LocalCurriculumProgress[]>([]);
  const [xpByStudent, setXpByStudent] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const bootedRef = useRef(false);
  const offlineRef = useRef(false);
  const initialStudentRef = useRef<Student | null>(initialStudent);
  const pathRef = useRef(pathname);
  const liveRef = useRef<{
    tab: string;
    levelId: string | null;
    exercise: string;
    keyLabel: string | null;
    skill: Skill | null;
    practicing: boolean;
  }>({
    tab: tabFromPath(pathname),
    levelId: initialStudent ? getLevel(initialStudent.currentLevel).id : null,
    exercise: "",
    keyLabel: null,
    skill: null,
    practicing: false,
  });
  const statsRef = useRef({
    melody: initialStudent?.accuracy ?? 0,
    harmony: initialStudent?.accuracy ?? 0,
    rhythm: initialStudent?.accuracy ?? 0,
    progress: 0,
  });

  const notify = useCallback(
    (message: string, tone: NoticeTone = "info") => {
      setNotice({ id: uid("notice"), message, tone });
    },
    [],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    pathRef.current = pathname;
    liveRef.current.tab = tabFromPath(pathname);
  }, [pathname]);

  useEffect(() => {
    initialStudentRef.current = initialStudent;
  }, [initialStudent]);

  const activeStudent = useMemo(() => {
    return (
      students.find((student) => student.id === activeStudentId) ??
      students[0] ??
      null
    );
  }, [students, activeStudentId]);

  const activeAccuracy = activeStudent?.accuracy ?? 0;

  const liveScores = useMemo(() => {
    const buckets: Record<Skill, number[]> = {
      melody: [],
      harmony: [],
      rhythm: [],
    };
    for (const row of skillScores) buckets[row.skill].push(row.score);
    const average = (values: number[]) =>
      values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : activeAccuracy;
    return {
      melody: average(buckets.melody),
      harmony: average(buckets.harmony),
      rhythm: average(buckets.rhythm),
    };
  }, [activeAccuracy, skillScores]);

  const currentProgress = useMemo(() => {
    if (!activeStudent) return 0;
    const levelId = getLevel(activeStudent.currentLevel).id;
    return progress.find((row) => row.levelId === levelId)?.progress ?? 0;
  }, [activeStudent, progress]);

  useEffect(() => {
    statsRef.current = {
      ...liveScores,
      progress: currentProgress,
    };
  }, [currentProgress, liveScores]);

  const reportLiveActivity = useCallback((patch: LiveActivityPatch) => {
    liveRef.current = { ...liveRef.current, ...patch };
  }, []);

  const refreshBackupStatus = useCallback(async () => {
    try {
      const stats = await readBackupStats();
      const stamp = readBackupStamp();
      setBackupStats(stats);
      setLastBackupAt(stamp);
      setBackupState((current) => {
        if (current === "syncing") return current;
        const pending = stats.dirtyRows + stats.pendingSessions;
        return pending === 0 && stamp ? "synced" : "device";
      });
    } catch {
      // The cache is unavailable; keep the last known state.
    }
  }, []);

  const loadLocalSnapshot = useCallback(
    async (studentId: string) => {
      const db = getLocalDb();
      const [
        localStudents,
        localProgress,
        localScores,
        localCurriculum,
        xpTotals,
      ] = await Promise.all([
        db.students.toArray(),
        db.lessonProgress.where("studentId").equals(studentId).toArray(),
        db.skillScores.where("studentId").equals(studentId).toArray(),
        db.curriculumProgress.where("studentId").equals(studentId).toArray(),
        readXpTotals(),
      ]);
      if (teacherMode && localStudents.length) setStudents(localStudents);
      setProgress(localProgress);
      setSkillScores(localScores);
      setCurriculum(localCurriculum);
      setXpByStudent(xpTotals);
      await refreshBackupStatus();
    },
    [refreshBackupStatus],
  );

  const flushQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncState("offline");
      return;
    }
    try {
      const queue = await readPracticeQueue();
      if (!queue.length) {
        setPendingSync(0);
        setSyncState(offlineRef.current ? "offline" : "idle");
        return;
      }
      setSyncState("syncing");
      const result = await syncPracticeSessionsAction(
        queue.map((entry) => entry.payload),
      );
      if (!result.ok) {
        setSyncState("error");
        return;
      }
      for (const entry of queue) {
        await markQueueEntry(entry.id, "completed");
      }
      const remaining = await pendingMutationCount();
      setPendingSync(remaining);
      setSyncState("idle");
      if (result.data.synced > 0) {
        notify(
          `${result.data.synced} ${
            result.data.synced === 1 ? "sesión sincronizada" : "sesiones sincronizadas"
          } con la academia.`,
          "success",
        );
        const refreshed = await fetchStudentsAction();
        if (refreshed.ok) {
          const db = getLocalDb();
          await db.students.bulkPut(refreshed.data);
          setStudents(refreshed.data);
          setDataSource("server");
        }
      }
    } catch {
      setSyncState("error");
    }
  }, [notify]);

  const refreshFromServer = useCallback(async () => {
    if (offlineRef.current) return;
    const result = await fetchStudentsAction();
    if (!result.ok) {
      setDataSource("local");
      return;
    }
    const db = getLocalDb();
    const local = await db.students.toArray();
    const pending = await db.offlineQueue.where("status").equals("pending").count();
    const merged = result.data.map((remote) => {
      const cached = local.find((item) => item.id === remote.id);
      if (!cached || pending === 0) return remote;
      return cached;
    });
    await db.students.bulkPut(merged);
    setStudents(merged);
    setDataSource("server");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (bootedRef.current) return;
      bootedRef.current = true;

      if (!teacherMode && !initialStudent) {
        setSyncState("offline");
        setDataSource("local");
        return;
      }

      const storedUnplugged =
        typeof window !== "undefined" &&
        window.localStorage.getItem(UNPLUGGED_KEY) === "true";
      const storedStudent =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ACTIVE_STUDENT_KEY)
          : null;

      offlineRef.current = storedUnplugged;
      setOfflineMode(storedUnplugged);

      try {
        await seedLocalDb();
        const db = getLocalDb();
        const bootStudents = await db.students.toArray();
        if (cancelled) return;

        const nextId = initialStudent
          ? initialStudent.id
          : storedStudent &&
              bootStudents.some((student) => student.id === storedStudent)
            ? storedStudent
            : (bootStudents[0]?.id ?? null);

        if (nextId) {
          setActiveId(nextId);
          await loadLocalSnapshot(nextId);
        }
        setPendingSync(await pendingMutationCount());

        if (!storedUnplugged && navigator.onLine) {
          const pending = await pendingMutationCount();
          if (pending > 0) await flushQueue();
          await refreshFromServer();
        } else {
          setSyncState("offline");
        }
      } catch {
        setSyncState("offline");
        notify("Modo local activo: tu progreso se guarda en este dispositivo.", "warning");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [
    flushQueue,
    initialStudent,
    loadLocalSnapshot,
    notify,
    refreshFromServer,
    teacherMode,
  ]);

  useEffect(() => {
    offlineRef.current = offlineMode;
    document.documentElement.dataset.unplugged = String(offlineMode);
    window.localStorage.setItem(UNPLUGGED_KEY, String(offlineMode));
    if (!offlineMode && bootedRef.current) {
      void flushQueue();
    }
  }, [offlineMode, flushQueue]);

  useEffect(() => {
    if (!activeStudentId) return;
    window.localStorage.setItem(ACTIVE_STUDENT_KEY, activeStudentId);
    if (bootedRef.current) void loadLocalSnapshot(activeStudentId);
  }, [activeStudentId, loadLocalSnapshot]);

  useEffect(() => {
    const handleOnline = () => {
      if (!offlineRef.current) void flushQueue();
    };
    const handleOffline = () => setSyncState("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushQueue]);

  const enablePassThePhone = useCallback(async () => {
    setPassThePhone(true);
    setOfflineMode(true);
    notify(
      "Modo Sin Luz · Pasa el Teléfono. Ahora el grupo puede turnarse el dispositivo.",
      "warning",
    );
    const result = await fetchClassroomRosterAction();
    if (result.ok) setStudents(result.data);
    else notify(result.error, "warning");
  }, [notify]);

  const disablePassThePhone = useCallback(() => {
    const own = initialStudentRef.current;
    setPassThePhone(false);
    setOfflineMode(false);
    if (own) {
      setStudents([own]);
      setActiveId(own.id);
    }
    notify("Vuelves a tu perfil privado.", "info");
  }, [notify]);

  const canSwitchStudents = teacherMode || passThePhone;

  const setActiveStudentId = useCallback(
    (id: string) => {
      if (!teacherMode && !passThePhone && initialStudentRef.current) {
        if (id !== initialStudentRef.current.id) {
          notify("Tu progreso es privado. Pide el modo Pasa el Teléfono.", "warning");
          return;
        }
      }
      setActiveId(id);
      const student = students.find((item) => item.id === id);
      if (student) {
        notify(`Sendero de ${student.firstName} cargado.`, "info");
      }
    },
    [notify, passThePhone, students, teacherMode],
  );

  const toggleOfflineMode = useCallback(() => {
    setOfflineMode((previous) => {
      const next = !previous;
      notify(
        next
          ? "Modo Sin Luz activo. Todo se guarda en este dispositivo."
          : navigator.onLine
            ? "Modo Sin Luz desactivado. Sincronizando…"
            : "Sin conexión. Seguimos en modo local.",
        next ? "warning" : "info",
      );
      return next;
    });
  }, [notify]);

  const pushLive = useCallback(
    async (
      event: "heartbeat" | "exercise-complete",
      overrides?: {
        clientId?: string;
        skill?: Skill;
        score?: number;
        exercise?: string;
      },
    ) => {
      const own = initialStudentRef.current;
      if (!studentMode || !own || offlineMode || passThePhone) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const live = liveRef.current;
      const stats = statsRef.current;
      const payloadSkill = overrides?.skill ?? live.skill;
      const score = overrides?.score;
      const scores = {
        melody:
          payloadSkill === "melody" && score !== undefined ? score : stats.melody,
        harmony:
          payloadSkill === "harmony" && score !== undefined
            ? score
            : stats.harmony,
        rhythm:
          payloadSkill === "rhythm" && score !== undefined ? score : stats.rhythm,
      };

      await syncLiveProgressAction({
        studentId: own.id,
        tab: live.tab,
        levelId: live.levelId ?? getLevel(own.currentLevel).id,
        exercise: overrides?.exercise ?? live.exercise,
        keyLabel: live.keyLabel,
        skill: payloadSkill ?? null,
        melody: scores.melody,
        harmony: scores.harmony,
        rhythm: scores.rhythm,
        progress: stats.progress,
        practicing: live.practicing,
        lastActivity: new Date().toISOString(),
        event,
        clientId: overrides?.clientId,
      });
    },
    [offlineMode, passThePhone, studentMode],
  );

  const sendLiveEvent = useCallback(
    (skill: Skill, score: number, exercise: string) => {
      void pushLive("exercise-complete", {
        clientId: uid("live"),
        skill,
        score: Math.round(score),
        exercise,
      }).catch(() => undefined);
    },
    [pushLive],
  );

  useEffect(() => {
    if (!studentMode || offlineMode || passThePhone) return;
    let cancelled = false;
    let inFlight = false;

    const beat = async () => {
      if (cancelled || inFlight) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      inFlight = true;
      try {
        await pushLive("heartbeat");
      } catch {
        // The next beat retries; Dexie keeps the progress safe meanwhile.
      } finally {
        inFlight = false;
      }
    };

    void beat();
    const timer = window.setInterval(() => void beat(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [offlineMode, passThePhone, pushLive, studentMode]);

  const logPractice = useCallback(
    async ({
      levelId,
      minutes,
      skill,
      score = 80,
      quiet = false,
    }: LogPracticeInput) => {
      if (!activeStudent) return;

      const safeMinutes = clamp(Math.round(minutes), 1, 180);
      const safeScore = clamp(Math.round(score), 0, 100);
      const createdAt = new Date().toISOString();
      const clientId = uid("practice");
      const payload: PracticePayload = {
        clientId,
        studentId: activeStudent.id,
        levelId,
        minutes: safeMinutes,
        skill,
        score: safeScore,
        createdAt,
      };

      const db = getLocalDb();
      const nextStudent: Student = {
        ...activeStudent,
        totalMinutes: activeStudent.totalMinutes + safeMinutes,
        weeklyMinutes: activeStudent.weeklyMinutes + safeMinutes,
        accuracy: Math.round(
          (activeStudent.accuracy * 4 + safeScore) / 5,
        ),
        updatedAt: createdAt,
      };

      const existing = await db.lessonProgress
        .where("[studentId+levelId]")
        .equals([activeStudent.id, levelId])
        .first();

      if (existing) {
        await db.lessonProgress.update(existing.id!, {
          progress: Math.min(100, existing.progress + 6),
          minutesPracticed: existing.minutesPracticed + safeMinutes,
          updatedAt: createdAt,
          synced: 0,
        });
      } else {
        await db.lessonProgress.add({
          studentId: activeStudent.id,
          levelId,
          status: "current",
          progress: 6,
          minutesPracticed: safeMinutes,
          updatedAt: createdAt,
          synced: 0,
        });
      }

      await db.skillScores.add({
        studentId: activeStudent.id,
        skill,
        score: safeScore,
        source: "lesson",
        createdAt,
        synced: 0,
      });
      await db.students.put(nextStudent);
      setStudents((previous) =>
        previous.map((student) =>
          student.id === nextStudent.id ? nextStudent : student,
        ),
      );

      let queued = false;
      if (offlineMode || !navigator.onLine) {
        await queueMutation("practice", payload);
        queued = true;
      } else {
        const result = await logPracticeAction(payload);
        if (!result.ok) {
          await queueMutation("practice", payload);
          queued = true;
        }
      }

      await loadLocalSnapshot(activeStudent.id);
      setPendingSync(await pendingMutationCount());
      sendLiveEvent(skill, safeScore, `Sesión · ${getLevel(activeStudent.currentLevel).title}`);

      if (!quiet) {
        notify(
          queued
            ? `Sesión de ${safeMinutes} min guardada sin luz. Se sincronizará al volver la conexión.`
            : `Sesión de ${safeMinutes} min enviada a la academia.`,
          queued ? "warning" : "success",
        );
      }
    },
    [
      activeStudent,
      loadLocalSnapshot,
      notify,
      offlineMode,
      sendLiveEvent,
    ],
  );

  const recordCurriculumResult = useCallback(
    async ({ nodeId, stars, accuracy }: CurriculumResultInput) => {
      if (!activeStudent) return { stars, accuracy, xp: 0 };
      const node = getCurriculumNode(nodeId);
      const skill: Skill =
        node.branch === "ritmo"
          ? "rhythm"
          : node.branch === "melodia"
            ? "melody"
            : "harmony";
      const xp = xpForNode(node, stars);
      const saved = await saveCurriculumResult({
        studentId: activeStudent.id,
        node,
        stars,
        accuracy,
        xp,
      });

      const db = getLocalDb();
      await db.skillScores.add({
        studentId: activeStudent.id,
        skill,
        score: Math.round(accuracy),
        source: "lesson",
        createdAt: new Date().toISOString(),
        synced: 0,
      });

      await loadLocalSnapshot(activeStudent.id);
      sendLiveEvent(skill, accuracy, node.title);
      notify(
        `${node.title} sellado · +${xp} XP · ${saved.stars} ${
          saved.stars === 1 ? "estrella" : "estrellas"
        }.`,
        "success",
      );
      return { stars: saved.stars, accuracy: saved.accuracy, xp };
    },
    [activeStudent, loadLocalSnapshot, notify, sendLiveEvent],
  );

  const recordGameResult = useCallback(
    async ({ skill, accuracy, xp, detail }: GameResultInput) => {
      if (!activeStudent) return;
      const db = getLocalDb();
      const createdAt = new Date().toISOString();
      await db.skillScores.add({
        studentId: activeStudent.id,
        skill,
        score: Math.round(accuracy),
        source: "game",
        createdAt,
        synced: 0,
      });
      await appendXp({
        studentId: activeStudent.id,
        amount: xp,
        source: "game",
        detail,
      });
      await loadLocalSnapshot(activeStudent.id);
      sendLiveEvent(skill, accuracy, detail);
      notify(`${detail} · +${Math.round(xp)} XP guardados.`, "success");
    },
    [activeStudent, loadLocalSnapshot, notify, sendLiveEvent],
  );

  const awardGroupXp = useCallback(
    async (studentId: string, amount: number, detail: string) => {
      await appendXp({ studentId, amount, source: "group", detail });
      setXpByStudent(await readXpTotals());
      await refreshBackupStatus();
    },
    [refreshBackupStatus],
  );

  const backupToServer = useCallback(async () => {
    setBackupState("syncing");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setBackupState("device");
      notify(
        "Sin conexión: el respaldo sigue a salvo en el dispositivo.",
        "warning",
      );
      return null;
    }

    try {
      const dump = await readBackupDump();
      const result = await syncBackupAction(dump);

      if (!result.ok) {
        setBackupState("error");
        notify(result.error, "warning");
        return null;
      }

      await markBackupSynced();
      writeBackupStamp(result.data.syncedAt);
      setLastBackupAt(result.data.syncedAt);
      setBackupStats(await readBackupStats());
      setBackupState("synced");
      setPendingSync(await pendingMutationCount());

      notify(
        result.data.total > 0
          ? `${result.data.total} ${
              result.data.total === 1 ? "registro blindado" : "registros blindados"
            } en SQLite.`
          : "El servidor ya estaba al día. Respaldo verificado.",
        "success",
      );

      return result.data;
    } catch {
      setBackupState("error");
      notify(
        "No se pudo completar el respaldo. Tus datos siguen en el dispositivo.",
        "warning",
      );
      return null;
    }
  }, [notify]);

  const value = useMemo<AcademyContextValue>(
    () => ({
      students,
      activeStudent,
      activeStudentId: activeStudent?.id ?? null,
      setActiveStudentId,
      teacherMode,
      studentMode,
      ownStudentId: initialStudent?.id ?? null,
      canSwitchStudents,
      passThePhone,
      enablePassThePhone,
      disablePassThePhone,
      reportLiveActivity,
      offlineMode,
      toggleOfflineMode,
      pendingSync,
      syncState,
      dataSource,
      backupState,
      backupStats,
      lastBackupAt,
      backupToServer,
      progress,
      skillScores,
      curriculum,
      xpByStudent,
      logPractice,
      recordCurriculumResult,
      recordGameResult,
      awardGroupXp,
      refreshFromServer,
      notice,
      notify,
      dismissNotice,
    }),
    [
      students,
      activeStudent,
      setActiveStudentId,
      teacherMode,
      studentMode,
      initialStudent,
      canSwitchStudents,
      passThePhone,
      enablePassThePhone,
      disablePassThePhone,
      reportLiveActivity,
      offlineMode,
      toggleOfflineMode,
      pendingSync,
      syncState,
      dataSource,
      backupState,
      backupStats,
      lastBackupAt,
      backupToServer,
      progress,
      skillScores,
      curriculum,
      xpByStudent,
      logPractice,
      recordCurriculumResult,
      recordGameResult,
      awardGroupXp,
      refreshFromServer,
      notice,
      notify,
      dismissNotice,
    ],
  );

  return (
    <AcademyContext.Provider value={value}>
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademy() {
  const context = useContext(AcademyContext);
  if (!context) {
    throw new Error("useAcademy must be used inside <AcademyProvider>.");
  }
  return context;
}
