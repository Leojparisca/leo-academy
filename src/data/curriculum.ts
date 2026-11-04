/**
 * Leo Academy — Phase 3 curriculum.
 *
 * A synchronized tree: five thresholds, three branches. Every level crosses
 * Ritmo, Melodía and Armonía at the same time, and each node opens only when
 * the three branches of the previous threshold are sealed.
 *
 * Client-safe: no server code, no secrets.
 */

export type BranchId = "ritmo" | "melodia" | "armonia";
export type LessonStepKind = "sentir" | "escuchar" | "comprender" | "reto";
export type ChordQuality = "maj" | "min" | "dim" | "sus4" | "maj7" | "m7" | "dom7";
export type Hand = "left" | "right";

export type RhythmHit = { at: number; hand: Hand };

export type RhythmDrill = {
  kind: "rhythm";
  bpm: number;
  bars: number;
  hits: RhythmHit[];
  label: string;
};

export type MelodyDrill = {
  kind: "melody";
  mode: "direction" | "interval" | "read";
  intervals: number[];
  rounds: number;
  baseMidi: number;
  label: string;
};

export type HarmonyDrill = {
  kind: "harmony";
  mode: "build" | "color" | "progression";
  qualities: ChordQuality[];
  roots: number[];
  rounds: number;
  progression?: Array<{ roman: string; rootPc: number; quality: ChordQuality }>;
  label: string;
};

export type CurriculumDrill = RhythmDrill | MelodyDrill | HarmonyDrill;

export type CurriculumStep = {
  kind: LessonStepKind;
  title: string;
  prompt: string;
  cue: string;
};

export type CurriculumNode = {
  id: string;
  branch: BranchId;
  level: number;
  title: string;
  subtitle: string;
  minutes: number;
  xp: number;
  concept: string;
  steps: CurriculumStep[];
  drill: CurriculumDrill;
};

export type CurriculumTier = {
  level: number;
  title: string;
  subtitle: string;
  minutes: number;
};

export const BRANCHES: Record<
  BranchId,
  {
    id: BranchId;
    label: string;
    short: string;
    tagline: string;
    color: string;
    glow: string;
    game: string;
  }
> = {
  ritmo: {
    id: "ritmo",
    label: "Ritmo",
    short: "RIT",
    tagline: "El pulso que sostiene todo",
    color: "#F2B45C",
    glow: "rgba(242, 180, 92, 0.34)",
    game: "Groove Pad Dual",
  },
  melodia: {
    id: "melodia",
    label: "Melodía",
    short: "MEL",
    tagline: "La línea que cuenta historias",
    color: "#38BDF8",
    glow: "rgba(56, 189, 248, 0.34)",
    game: "Cazador de Intervalos",
  },
  armonia: {
    id: "armonia",
    label: "Armonía",
    short: "ARM",
    tagline: "El color que abraza la línea",
    color: "#9DB5FF",
    glow: "rgba(157, 181, 255, 0.34)",
    game: "Arquitecto de Acordes",
  },
};

export const BRANCH_ORDER: BranchId[] = ["ritmo", "melodia", "armonia"];

export const CURRICULUM_TIERS: CurriculumTier[] = [
  {
    level: 1,
    title: "Fundamentos",
    subtitle: "El cuerpo, el pulso y las primeras tres notas",
    minutes: 12,
  },
  {
    level: 2,
    title: "Contraste",
    subtitle: "Subdivisión, intervalos y el color menor",
    minutes: 14,
  },
  {
    level: 3,
    title: "Síncopa y tensión",
    subtitle: "Acentos fuera del tiempo, disminuidos y Sus4",
    minutes: 16,
  },
  {
    level: 4,
    title: "Silencio y séptima",
    subtitle: "El aire entre golpes y las cuatro voces",
    minutes: 18,
  },
  {
    level: 5,
    title: "Dominio de Acordes con 7ma y Enlaces",
    subtitle: "I–V–vi–IV, séptimas y conducción de voces",
    minutes: 22,
  },
];

export const CHORD_QUALITIES: Record<
  ChordQuality,
  {
    label: string;
    short: string;
    intervals: number[];
    emotion: "alegre" | "melancólico" | "tenso" | "suspendido";
    formula: string;
    glyph: string;
  }
> = {
  maj: {
    label: "Mayor",
    short: "maj",
    intervals: [0, 4, 7],
    emotion: "alegre",
    formula: "0 · 4 · 7",
    glyph: "☀",
  },
  min: {
    label: "Menor",
    short: "m",
    intervals: [0, 3, 7],
    emotion: "melancólico",
    formula: "0 · 3 · 7",
    glyph: "☂",
  },
  dim: {
    label: "Disminuido",
    short: "dim",
    intervals: [0, 3, 6],
    emotion: "tenso",
    formula: "0 · 3 · 6",
    glyph: "⚡",
  },
  sus4: {
    label: "Sus4",
    short: "sus4",
    intervals: [0, 5, 7],
    emotion: "suspendido",
    formula: "0 · 5 · 7",
    glyph: "◌",
  },
  maj7: {
    label: "Mayor séptima",
    short: "maj7",
    intervals: [0, 4, 7, 11],
    emotion: "alegre",
    formula: "0 · 4 · 7 · 11",
    glyph: "✦",
  },
  m7: {
    label: "Menor séptima",
    short: "m7",
    intervals: [0, 3, 7, 10],
    emotion: "melancólico",
    formula: "0 · 3 · 7 · 10",
    glyph: "☾",
  },
  dom7: {
    label: "Séptima dominante",
    short: "7",
    intervals: [0, 4, 7, 10],
    emotion: "tenso",
    formula: "0 · 4 · 7 · 10",
    glyph: "⚑",
  },
};

export const EMOTION_META: Record<
  "alegre" | "melancólico" | "tenso" | "suspendido",
  { label: string; glyph: string; color: string; copy: string }
> = {
  alegre: {
    label: "Alegre",
    glyph: "☀",
    color: "#F2B45C",
    copy: "Luz, apertura, ganas de avanzar.",
  },
  melancólico: {
    label: "Melancólico",
    glyph: "☂",
    color: "#7C9CFF",
    copy: "Una habitación azul, íntima.",
  },
  tenso: {
    label: "Tenso",
    glyph: "⚡",
    color: "#FB7185",
    copy: "Algo pide resolverse ya.",
  },
  suspendido: {
    label: "Suspendido",
    glyph: "◌",
    color: "#38BDF8",
    copy: "El aire queda en suspenso.",
  },
};

const step = (
  kind: LessonStepKind,
  title: string,
  prompt: string,
  cue: string,
): CurriculumStep => ({ kind, title, prompt, cue });

const rhythm = (bpm: number, label: string, hits: RhythmHit[], bars = 4): RhythmDrill => ({
  kind: "rhythm",
  bpm,
  bars,
  hits,
  label,
});

const melody = (
  mode: MelodyDrill["mode"],
  intervals: number[],
  rounds: number,
  baseMidi: number,
  label: string,
): MelodyDrill => ({ kind: "melody", mode, intervals, rounds, baseMidi, label });

const harmony = (
  mode: HarmonyDrill["mode"],
  qualities: ChordQuality[],
  roots: number[],
  rounds: number,
  label: string,
  progression?: HarmonyDrill["progression"],
): HarmonyDrill => ({
  kind: "harmony",
  mode,
  qualities,
  roots,
  rounds,
  label,
  progression,
});

const node = (
  branch: BranchId,
  level: number,
  title: string,
  subtitle: string,
  concept: string,
  minutes: number,
  xp: number,
  steps: CurriculumStep[],
  drill: CurriculumDrill,
): CurriculumNode => ({
  id: `cur-${branch}-${level}`,
  branch,
  level,
  title,
  subtitle,
  concept,
  minutes,
  xp,
  steps,
  drill,
});

export const CURRICULUM_NODES: CurriculumNode[] = [
  /* ------------------------------------------------------------------ LEVEL 1 */
  node(
    "ritmo",
    1,
    "El latido",
    "Negras que caminan · 72 BPM",
    "Pulso estable",
    12,
    120,
    [
      step(
        "sentir",
        "El cuerpo primero",
        "Camina en el sitio y toca el pulso con una mano distinta en cada tiempo.",
        "1 · 2 · 3 · 4, sin prisa.",
      ),
      step(
        "escuchar",
        "Pulso sin adorno",
        "Escucha cuatro golpes. ¿Son iguales o alguno corre?",
        "El pulso no se adelanta.",
      ),
      step(
        "comprender",
        "La negra es un paso",
        "Cada huella del carril equivale a un paso. Toca el carril para encender los cuatro.",
        "Negra = 1 tiempo.",
      ),
      step(
        "reto",
        "Enciende el groove",
        "Percute las cuatro negras alternando mano izquierda y derecha.",
        "Perfecto < 35 ms · Bueno < 80 ms.",
      ),
    ],
    rhythm(72, "Negras alternadas", [
      { at: 0, hand: "left" },
      { at: 1, hand: "right" },
      { at: 2, hand: "left" },
      { at: 3, hand: "right" },
    ]),
  ),
  node(
    "melodia",
    1,
    "Arriba o abajo",
    "Contorno y dirección",
    "Dirección melódica",
    12,
    120,
    [
      step(
        "sentir",
        "La mano dibuja",
        "Canta una sílaba y sube la mano cuando la nota suba; bájala cuando baje.",
        "El oído sigue al gesto.",
      ),
      step(
        "escuchar",
        "Dos notas, una dirección",
        "Escucha la nota base y la nota objetivo. ¿La segunda sube o baja?",
        "No busques el nombre todavía.",
      ),
      step(
        "comprender",
        "La escalera",
        "Toca cada peldaño para oír cómo crece el intervalo desde la nota base.",
        "2ª · 3ª · 5ª · octava.",
      ),
      step(
        "reto",
        "Cazador de dirección",
        "Ocho pares de notas. Responde si la segunda sube o baja.",
        "Velocidad sin adivinar.",
      ),
    ],
    melody("direction", [2, 3, 4, 5, 7, 12], 8, 60, "Dirección"),
  ),
  node(
    "armonia",
    1,
    "Tres notas, un color",
    "Mayor vs. menor",
    "Tríadas básicas",
    12,
    120,
    [
      step(
        "sentir",
        "Canta la tercera",
        "Sostén la raíz y canta la nota del medio: la que decide el color.",
        "Mayor sonríe; menor mira al suelo.",
      ),
      step(
        "escuchar",
        "Sol o lluvia",
        "Escucha un acorde. ¿Suena alegre o melancólico?",
        "El color llega antes que el nombre.",
      ),
      step(
        "comprender",
        "Cuenta semitonos",
        "Construye Do mayor y luego Do menor. Solo cambia la tercera: 4→3 semitonos.",
        "0 · 4 · 7 vs. 0 · 3 · 7.",
      ),
      step(
        "reto",
        "Arquitecto principiante",
        "Construye tríadas mayores y menores contando semitonos.",
        "Raíz, tercera, quinta.",
      ),
    ],
    harmony("build", ["maj", "min"], [0, 2, 5, 7, 9], 5, "Mayor y menor"),
  ),

  /* ------------------------------------------------------------------ LEVEL 2 */
  node(
    "ritmo",
    2,
    "Corcheas que corren",
    "Subdivisión binaria · 84 BPM",
    "Corcheas",
    14,
    150,
    [
      step(
        "sentir",
        "Dos pasos por tiempo",
        "Di «ta-ka» en cada tiempo mientras caminas. El pie sigue marcando la negra.",
        "Ta-ka · ta-ka · ta-ka · ta-ka.",
      ),
      step(
        "escuchar",
        "Negra o corchea",
        "Escucha el patrón: ¿hay uno o dos golpes dentro de cada tiempo?",
        "La corchea parte el tiempo en dos.",
      ),
      step(
        "comprender",
        "El reloj partido",
        "Toca los ocho puntos del carril. Cada pareja comparte un mismo tiempo.",
        "8 corcheas = 4 negras.",
      ),
      step(
        "reto",
        "Doble densidad",
        "Percute ocho corcheas alternando manos sin perder el pulso.",
        "Mano firme, muñeca suelta.",
      ),
    ],
    rhythm(84, "Corcheas continuas", [
      { at: 0, hand: "left" },
      { at: 0.5, hand: "right" },
      { at: 1, hand: "left" },
      { at: 1.5, hand: "right" },
      { at: 2, hand: "left" },
      { at: 2.5, hand: "right" },
      { at: 3, hand: "left" },
      { at: 3.5, hand: "right" },
    ]),
  ),
  node(
    "melodia",
    2,
    "La tercera que habla",
    "2ª, 3ª y 5ª",
    "Intervalos",
    14,
    150,
    [
      step(
        "sentir",
        "Dos canciones",
        "Canta una 3ª mayor y una 3ª menor. La distancia cambia el carácter.",
        "Amplia vs. estrecha.",
      ),
      step(
        "escuchar",
        "Nombre del intervalo",
        "Escucha dos notas y elige: 2ª, 3ª o 5ª.",
        "Cuenta los pasos de la escala.",
      ),
      step(
        "comprender",
        "Escalera de intervalos",
        "Toca cada peldaño: la distancia en semitonos se ilumina.",
        "2ª = 2 · 3ª = 4 · 5ª = 7.",
      ),
      step(
        "reto",
        "Cazador de intervalos",
        "Ocho intervalos ascendentes y descendentes.",
        "2ª, 3ª y 5ª justa.",
      ),
    ],
    melody("interval", [2, 4, 7], 8, 62, "2ª · 3ª · 5ª"),
  ),
  node(
    "armonia",
    2,
    "Luz y sombra",
    "Tríadas en todas las raíces",
    "Mayor, menor y disminuido",
    14,
    150,
    [
      step(
        "sentir",
        "La mano recuerda",
        "Forma las tres notas en el aire: raíz, tercera y quinta. Cambia solo la tercera.",
        "La forma menor se cierra un semitono.",
      ),
      step(
        "escuchar",
        "Tres colores",
        "Escucha un acorde: mayor, menor o disminuido.",
        "El disminuido aprieta dos terceras menores.",
      ),
      step(
        "comprender",
        "El semitono que decide",
        "Compara Do mayor, Do menor y Do disminuido tocando cada tercera.",
        "4 → 3 → 3 semitonos.",
      ),
      step(
        "reto",
        "Arquitecto de tríadas",
        "Construye mayores, menores y disminuidos en raíces distintas.",
        "Cuenta desde la raíz, no de memoria.",
      ),
    ],
    harmony("build", ["maj", "min", "dim"], [0, 2, 4, 5, 7, 9, 11], 6, "Tríadas"),
  ),

  /* ------------------------------------------------------------------ LEVEL 3 */
  node(
    "ritmo",
    3,
    "Fuera de tiempo",
    "Síncopas y contratiempos",
    "Síncopa",
    16,
    180,
    [
      step(
        "sentir",
        "El hueco que empuja",
        "Marca el pulso con el pie y aplaude justo antes del tiempo siguiente.",
        "El acento vive en el hueco.",
      ),
      step(
        "escuchar",
        "¿Dónde cae el golpe?",
        "Escucha el patrón. ¿Los golpes caen en el tiempo o entre tiempos?",
        "Síncopa = acento desplazado.",
      ),
      step(
        "comprender",
        "Carril desplazado",
        "Enciende los puntos que caen entre las columnas de tiempo.",
        "El pulso sigue; el acento se mueve.",
      ),
      step(
        "reto",
        "Síncopa en zafiro",
        "Percute el patrón sincopado sin perder el pulso interno.",
        "Cuenta el tiempo aunque no lo toques.",
      ),
    ],
    rhythm(88, "Síncopas", [
      { at: 0, hand: "left" },
      { at: 0.5, hand: "right" },
      { at: 1.5, hand: "left" },
      { at: 2, hand: "right" },
      { at: 2.5, hand: "left" },
      { at: 3.5, hand: "right" },
    ]),
  ),
  node(
    "melodia",
    3,
    "Leer sin miedo",
    "Pentagrama en clave de sol",
    "Lectura",
    16,
    180,
    [
      step(
        "sentir",
        "La nota en el aire",
        "Señala con el dedo la línea o espacio donde crees que vive la nota.",
        "Líneas: Mi-Sol-Si-Re-Fa.",
      ),
      step(
        "escuchar",
        "Ojo y oído",
        "Mira la nota y escúchala. ¿Coincide con el nombre que pensaste?",
        "La lectura también se escucha.",
      ),
      step(
        "comprender",
        "Mapa del pentagrama",
        "Toca cada línea y cada espacio para oír su nota.",
        "Cada paso es una 2ª.",
      ),
      step(
        "reto",
        "Lectura relámpago",
        "Ubica la nota del pentagrama antes de que se apague el reloj.",
        "10 segundos por nota.",
      ),
    ],
    melody("read", [2, 4, 7, 12], 8, 60, "Lectura en clave de sol"),
  ),
  node(
    "armonia",
    3,
    "Tensión y suspensión",
    "Disminuido y Sus4",
    "Acordes de color",
    16,
    180,
    [
      step(
        "sentir",
        "Aire que no cierra",
        "Canta un acorde Sus4 y siente cómo la cuarta pide caer a la tercera.",
        "Suspendido = movimiento detenido.",
      ),
      step(
        "escuchar",
        "Tenso o suspendido",
        "Escucha dos acordes. Uno aprieta; el otro flota. ¿Cuál es cuál?",
        "Disminuido tensa; Sus4 flota.",
      ),
      step(
        "comprender",
        "La fórmula del color",
        "Toca la cuarta y la quinta de un Sus4; después baja la cuarta a tercera mayor.",
        "0 · 5 · 7 → 0 · 4 · 7.",
      ),
      step(
        "reto",
        "Arquitecto de tensiones",
        "Construye disminuidos y Sus4 contando semitonos.",
        "0 · 3 · 6 y 0 · 5 · 7.",
      ),
    ],
    harmony("build", ["dim", "sus4"], [0, 2, 5, 7, 9, 11], 6, "Disminuido y Sus4"),
  ),

  /* ------------------------------------------------------------------ LEVEL 4 */
  node(
    "ritmo",
    4,
    "El silencio también toca",
    "Silencios y respiración",
    "Silencio rítmico",
    18,
    210,
    [
      step(
        "sentir",
        "Tocar el aire",
        "Marca el pulso y deja un tiempo en silencio sin dejar de contarlo.",
        "El silencio se cuenta.",
      ),
      step(
        "escuchar",
        "¿Dónde falta el golpe?",
        "Escucha el patrón. ¿Qué tiempo quedó vacío?",
        "Un silencio no es un error.",
      ),
      step(
        "comprender",
        "Carril con huecos",
        "Enciende solo los golpes; los espacios vacíos son silencios.",
        "Lo que no suena también mide.",
      ),
      step(
        "reto",
        "Groove con aire",
        "Percute el patrón con silencios y contratiempos.",
        "No rellenes el hueco.",
      ),
    ],
    rhythm(80, "Silencios y contratiempos", [
      { at: 0, hand: "left" },
      { at: 1, hand: "right" },
      { at: 1.5, hand: "left" },
      { at: 2.5, hand: "right" },
      { at: 3, hand: "left" },
    ]),
  ),
  node(
    "melodia",
    4,
    "Contrarreloj",
    "Lectura ágil y oído",
    "Velocidad de lectura",
    18,
    210,
    [
      step(
        "sentir",
        "Anticipa",
        "Antes de que suene, imagina la nota un paso arriba o abajo.",
        "Ojo → oído → mano.",
      ),
      step(
        "escuchar",
        "Reconocer en el aire",
        "Escucha dos notas y nómbralas por su distancia, no por su altura.",
        "2ª, 3ª, 5ª u octava.",
      ),
      step(
        "comprender",
        "Dos relojes",
        "Toca una nota del pentagrama y compárala con el intervalo que suena.",
        "El reloj no espera.",
      ),
      step(
        "reto",
        "Sprint de lectura",
        "Diez notas en contrarreloj. Cada acierto enciende el compás.",
        "Rápido pero limpio.",
      ),
    ],
    melody("read", [2, 3, 4, 5, 7, 12], 10, 60, "Sprint de lectura"),
  ),
  node(
    "armonia",
    4,
    "La cuarta voz",
    "Maj7, m7 y dominante",
    "Séptimas",
    18,
    210,
    [
      step(
        "sentir",
        "La nota que añade nostalgia",
        "Canta la séptima sobre un acorde mayor y siente cómo se abre el color.",
        "Tres notas son un rostro; cuatro, una historia.",
      ),
      step(
        "escuchar",
        "¿Qué séptima?",
        "Escucha maj7, m7 y dominante. ¿Cuál brilla, cuál llora y cuál empuja?",
        "Maj7 brilla · m7 llora · 7 empuja.",
      ),
      step(
        "comprender",
        "La escalera de cuatro",
        "Añade la séptima a una tríada mayor y observa el semitono que aparece.",
        "0 · 4 · 7 · 11.",
      ),
      step(
        "reto",
        "Arquitecto de séptimas",
        "Construye maj7, m7 y séptima dominante.",
        "La séptima está a 10 u 11 semitonos.",
      ),
    ],
    harmony("build", ["maj7", "m7", "dom7"], [0, 2, 5, 7, 9], 6, "Séptimas"),
  ),

  /* ------------------------------------------------------------------ LEVEL 5 */
  node(
    "ritmo",
    5,
    "Groove completo",
    "Negras, corcheas y síncopas",
    "Lenguaje rítmico",
    22,
    260,
    [
      step(
        "sentir",
        "El cuerpo entero",
        "Alterna pie, palma y voz: tres capas del mismo pulso.",
        "Cada capa respira distinto.",
      ),
      step(
        "escuchar",
        "El mapa del groove",
        "Escucha el patrón completo y localiza el golpe más sorprendente.",
        "La sorpresa también se mide.",
      ),
      step(
        "comprender",
        "Los tres lenguajes",
        "Enciende negras, corcheas y síncopas en el mismo carril.",
        "Todo cabe en cuatro tiempos.",
      ),
      step(
        "reto",
        "Groove de concierto",
        "Percute el patrón mixto con precisión de escenario.",
        "Menos de 35 ms es perfecto.",
      ),
    ],
    rhythm(92, "Groove mixto", [
      { at: 0, hand: "left" },
      { at: 0.5, hand: "right" },
      { at: 1, hand: "left" },
      { at: 1.5, hand: "left" },
      { at: 2, hand: "right" },
      { at: 2.5, hand: "left" },
      { at: 3, hand: "right" },
      { at: 3.5, hand: "right" },
    ]),
  ),
  node(
    "melodia",
    5,
    "Cazador experto",
    "Todos los intervalos",
    "Dominio melódico",
    22,
    260,
    [
      step(
        "sentir",
        "Cantar antes de nombrar",
        "Canta el intervalo como una canción antes de decir su nombre.",
        "La voz confirma lo que el oído sospecha.",
      ),
      step(
        "escuchar",
        "El intervalo escondido",
        "Escucha dos notas y elige entre cuatro distancias posibles.",
        "Amplitud, no altura.",
      ),
      step(
        "comprender",
        "Constelación de intervalos",
        "Recorre la escalera completa y compara cada distancia con la octava.",
        "La octava es el doble exacto.",
      ),
      step(
        "reto",
        "Cazador de élite",
        "Doce intervalos, ascendentes y descendentes, sin red.",
        "Precisión antes que velocidad.",
      ),
    ],
    melody("interval", [2, 3, 4, 5, 7, 12], 12, 60, "Todos los intervalos"),
  ),
  node(
    "armonia",
    5,
    "Enlaces",
    "I–V–vi–IV con séptimas",
    "Progresiones",
    22,
    260,
    [
      step(
        "sentir",
        "Cuatro puertas",
        "Canta la fundamental de cada acorde mientras suena la progresión.",
        "I abre, V empuja, vi llora, IV respira.",
      ),
      step(
        "escuchar",
        "La progresión infinita",
        "Escucha I–V–vi–IV y siente cómo el último acorde vuelve al primero.",
        "El círculo no se cierra: gira.",
      ),
      step(
        "comprender",
        "Conducción de voces",
        "Toca cada acorde y observa qué nota se queda quieta y cuál se mueve.",
        "La voz común es el imán.",
      ),
      step(
        "reto",
        "Arquitecto de enlaces",
        "Construye I–V–vi–IV con séptimas, un acorde por vez.",
        "Do · Sol · La menor · Fa, con su séptima.",
      ),
    ],
    harmony(
      "progression",
      ["maj7", "dom7", "m7"],
      [0],
      1,
      "I–V–vi–IV",
      [
        { roman: "I", rootPc: 0, quality: "maj7" },
        { roman: "V", rootPc: 7, quality: "dom7" },
        { roman: "vi", rootPc: 9, quality: "m7" },
        { roman: "IV", rootPc: 5, quality: "maj7" },
      ],
    ),
  ),
];

export const CURRICULUM_LEVEL_COUNT = CURRICULUM_TIERS.length;

export const CURRICULUM_BY_ID = new Map(
  CURRICULUM_NODES.map((entry) => [entry.id, entry]),
);

export function getCurriculumNode(nodeId: string) {
  return CURRICULUM_BY_ID.get(nodeId) ?? CURRICULUM_NODES[0];
}

export function nodesForLevel(level: number) {
  return BRANCH_ORDER.map(
    (branch) =>
      CURRICULUM_NODES.find(
        (entry) => entry.branch === branch && entry.level === level,
      )!,
  );
}

export function tierFor(level: number) {
  return (
    CURRICULUM_TIERS.find((tier) => tier.level === level) ??
    CURRICULUM_TIERS[0]
  );
}

export function starsForAccuracy(accuracy: number): 1 | 2 | 3 {
  if (accuracy >= 90) return 3;
  if (accuracy >= 70) return 2;
  return 1;
}

export function xpForNode(node: CurriculumNode, stars = 3) {
  return node.xp + Math.max(0, stars - 1) * 25;
}

/**
 * A threshold opens when the three branches of the previous one are sealed.
 * Level 1 is always open.
 */
export function unlockedLevel(completedNodeIds: Set<string> | string[]) {
  const completed =
    completedNodeIds instanceof Set
      ? completedNodeIds
      : new Set(completedNodeIds);

  let level = 1;
  for (let candidate = 2; candidate <= CURRICULUM_LEVEL_COUNT; candidate += 1) {
    const previous = nodesForLevel(candidate - 1);
    if (previous.every((entry) => completed.has(entry.id))) level = candidate;
    else break;
  }
  return level;
}

export function branchProgress(
  branch: BranchId,
  completedNodeIds: Set<string> | string[],
) {
  const completed =
    completedNodeIds instanceof Set
      ? completedNodeIds
      : new Set(completedNodeIds);
  const nodes = CURRICULUM_NODES.filter((entry) => entry.branch === branch);
  return {
    done: nodes.filter((entry) => completed.has(entry.id)).length,
    total: nodes.length,
  };
}

export const INTERVAL_LABELS: Record<number, string> = {
  2: "2ª mayor",
  3: "3ª menor",
  4: "3ª mayor",
  5: "4ª justa",
  7: "5ª justa",
  12: "Octava",
};

export function intervalAnswerLabel(semitones: number) {
  return INTERVAL_LABELS[semitones] ?? `${semitones} semitonos`;
}

export function rhythmFigureName(at: number) {
  return Number.isInteger(at) ? "negra" : "corchea";
}
