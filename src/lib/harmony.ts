"use client";

/**
 * Shared harmonic vocabulary: note naming, staff positions and a chord /
 * interval detector that works from the notes the student is actually holding.
 */

export type NamingMode = "solfege" | "letters" | "degrees" | "clean";

export const LETTERS = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export const SOLFEGE = [
  "Do",
  "Do♯",
  "Re",
  "Re♯",
  "Mi",
  "Fa",
  "Fa♯",
  "Sol",
  "Sol♯",
  "La",
  "La♯",
  "Si",
] as const;

/** Functional degrees in C major, with flats for the black keys. */
export const DEGREES = [
  "1",
  "♭2",
  "2",
  "♭3",
  "3",
  "4",
  "♯4",
  "5",
  "♭6",
  "6",
  "♭7",
  "7",
] as const;

const LETTER_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const NOTE_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export type HarmonyKind = "silence" | "note" | "interval" | "chord" | "cluster";

export type HarmonyAnalysis = {
  kind: HarmonyKind;
  label: string;
  quality: string;
  rootPc: number | null;
  bassPc: number | null;
  inversion: number;
  notes: number[];
  pcs: number[];
  intervals: number[];
  roman: string | null;
};

type Shape = {
  suffix: string;
  quality: string;
  pcs: number[];
  minorish?: boolean;
};

const SHAPES: Shape[] = [
  { suffix: "maj9", quality: "mayor novena", pcs: [0, 2, 4, 7, 11] },
  { suffix: "m9", quality: "menor novena", pcs: [0, 2, 3, 7, 10], minorish: true },
  { suffix: "9", quality: "novena", pcs: [0, 2, 4, 7, 10] },
  { suffix: "6/9", quality: "sexta novena", pcs: [0, 2, 4, 7, 9] },
  { suffix: "maj7", quality: "mayor séptima", pcs: [0, 4, 7, 11] },
  { suffix: "m7", quality: "menor séptima", pcs: [0, 3, 7, 10], minorish: true },
  { suffix: "7", quality: "séptima dominante", pcs: [0, 4, 7, 10] },
  { suffix: "m7♭5", quality: "semidisminuido", pcs: [0, 3, 6, 10], minorish: true },
  { suffix: "dim7", quality: "disminuido séptima", pcs: [0, 3, 6, 9], minorish: true },
  { suffix: "6", quality: "sexta", pcs: [0, 4, 7, 9] },
  { suffix: "m6", quality: "menor sexta", pcs: [0, 3, 7, 9], minorish: true },
  { suffix: "add9", quality: "novena añadida", pcs: [0, 2, 4, 7] },
  { suffix: "m(add9)", quality: "menor novena añadida", pcs: [0, 2, 3, 7], minorish: true },
  { suffix: "maj", quality: "mayor", pcs: [0, 4, 7] },
  { suffix: "m", quality: "menor", pcs: [0, 3, 7], minorish: true },
  { suffix: "dim", quality: "disminuido", pcs: [0, 3, 6], minorish: true },
  { suffix: "aug", quality: "aumentado", pcs: [0, 4, 8] },
  { suffix: "sus2", quality: "suspendido 2", pcs: [0, 2, 7] },
  { suffix: "sus4", quality: "suspendido 4", pcs: [0, 5, 7] },
];

const ROMAN_DEGREE: Record<number, string> = {
  0: "I",
  1: "♭II",
  2: "II",
  3: "♭III",
  4: "III",
  5: "IV",
  6: "♯IV",
  7: "V",
  8: "♭VI",
  9: "VI",
  10: "♭VII",
  11: "VII",
};

const SIMPLE_NUMBER = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7];
const SIMPLE_QUALITY = [
  "justa",
  "menor",
  "mayor",
  "menor",
  "mayor",
  "justa",
  "aumentada",
  "justa",
  "menor",
  "mayor",
  "menor",
  "mayor",
];

export function midiToPc(midi: number) {
  return ((midi % 12) + 12) % 12;
}

export function midiToOctave(midi: number) {
  return Math.floor(midi / 12) - 1;
}

export function midiToName(midi: number) {
  return `${LETTERS[midiToPc(midi)]}${midiToOctave(midi)}`;
}

/** Diatonic index used by the staff (C4 = 28, D4 = 29, E4 = 30…). */
export function diatonicIndex(midi: number) {
  return midiToOctave(midi) * 7 + LETTER_INDEX[midiToPc(midi)];
}

export function formatMidi(
  midi: number,
  mode: NamingMode,
  withOctave = true,
) {
  if (mode === "clean") return "";
  const pc = midiToPc(midi);
  const octave = withOctave ? midiToOctave(midi) : "";
  if (mode === "degrees") return DEGREES[pc];
  if (mode === "solfege") return `${SOLFEGE[pc]}${octave}`;
  return `${LETTERS[pc]}${octave}`;
}

export function noteToMidi(name: string): number | null {
  const match = name.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const [, letter, accidental, octave] = match;
  let pc = NOTE_TO_PC[letter];
  if (accidental === "#") pc += 1;
  if (accidental === "b") pc -= 1;
  return (Number(octave) + 1) * 12 + pc;
}

export function chordMidis(rootPc: number, intervals: number[], octave = 4) {
  const base = (octave + 1) * 12 + rootPc;
  return intervals.map((interval) => base + interval).sort((a, b) => a - b);
}

export function intervalLabel(semitones: number) {
  if (semitones <= 0) return "unísono";
  if (semitones === 12) return "octava";
  if (semitones < 12) return `${SIMPLE_NUMBER[semitones]}ª ${SIMPLE_QUALITY[semitones]}`;
  const octaves = Math.floor(semitones / 12);
  const simple = semitones % 12;
  if (simple === 0) {
    return octaves === 1 ? "octava" : `${7 * octaves + 1}ª justa`;
  }
  return `${SIMPLE_NUMBER[simple] + 7 * octaves}ª ${SIMPLE_QUALITY[simple]}`;
}

function romanFor(rootPc: number, minorish: boolean) {
  const degree = ROMAN_DEGREE[rootPc] ?? "I";
  return minorish ? degree.toLowerCase() : degree;
}

function silence(): HarmonyAnalysis {
  return {
    kind: "silence",
    label: "Silencio",
    quality: "El visor espera tu mano",
    rootPc: null,
    bassPc: null,
    inversion: 0,
    notes: [],
    pcs: [],
    intervals: [],
    roman: null,
  };
}

export function analyzeHarmony(input: number[]): HarmonyAnalysis {
  const notes = [...new Set(input)].sort((a, b) => a - b);
  if (notes.length === 0) return silence();

  const pcs = [...new Set(notes.map(midiToPc))];
  const bassPc = midiToPc(notes[0]);

  if (pcs.length === 1) {
    return {
      kind: "note",
      label: notes.length > 1 ? "Octavas" : midiToName(notes[0]),
      quality: notes.length > 1 ? `${notes.length} octavas en paralelo` : "Una sola voz",
      rootPc: bassPc,
      bassPc,
      inversion: 0,
      notes,
      pcs,
      intervals: notes.slice(1).map((note) => note - notes[0]),
      roman: null,
    };
  }

  if (notes.length === 2) {
    const semitones = notes[1] - notes[0];
    return {
      kind: "interval",
      label: intervalLabel(semitones),
      quality: `${semitones} semitono${semitones === 1 ? "" : "s"}`,
      rootPc: bassPc,
      bassPc,
      inversion: 0,
      notes,
      pcs,
      intervals: [semitones],
      roman: null,
    };
  }

  const roots = [bassPc, ...pcs.filter((pc) => pc !== bassPc).sort((a, b) => a - b)];

  for (const root of roots) {
    const relative = [...new Set(pcs.map((pc) => (pc - root + 12) % 12))].sort(
      (a, b) => a - b,
    );
    const exact = SHAPES.find(
      (shape) =>
        shape.pcs.length === relative.length &&
        shape.pcs.every((value, index) => value === relative[index]),
    );
    if (exact) return buildChord(notes, pcs, bassPc, root, exact);
  }

  // One extra colour tone (a 9th, a 6th, a doubled tension) still reads as a chord.
  for (const root of roots) {
    const relative = [...new Set(pcs.map((pc) => (pc - root + 12) % 12))].sort(
      (a, b) => a - b,
    );
    const near = SHAPES.filter(
      (shape) =>
        shape.pcs.length >= 3 &&
        shape.pcs.every((value) => relative.includes(value)) &&
        relative.length - shape.pcs.length === 1,
    ).sort((a, b) => b.pcs.length - a.pcs.length)[0];
    if (near) return buildChord(notes, pcs, bassPc, root, near);
  }

  return {
    kind: "cluster",
    label: "Cluster",
    quality: "Acorde abierto, sin forma reconocida",
    rootPc: bassPc,
    bassPc,
    inversion: 0,
    notes,
    pcs,
    intervals: notes.slice(1).map((note) => note - notes[0]),
    roman: null,
  };
}

function buildChord(
  notes: number[],
  pcs: number[],
  bassPc: number,
  root: number,
  shape: Shape,
): HarmonyAnalysis {
  const bassInterval = (bassPc - root + 12) % 12;
  const inversion = shape.pcs.indexOf(bassInterval);
  const slash = bassPc !== root ? `/${LETTERS[bassPc]}` : "";
  return {
    kind: "chord",
    label: `${LETTERS[root]}${shape.suffix}${slash}`,
    quality: shape.quality,
    rootPc: root,
    bassPc,
    inversion: inversion < 0 ? 0 : inversion,
    notes,
    pcs,
    intervals: shape.pcs,
    roman: romanFor(root, Boolean(shape.minorish)),
  };
}

export const INVERSION_LABEL = [
  "Estado fundamental",
  "1ª inversión",
  "2ª inversión",
  "3ª inversión",
] as const;
