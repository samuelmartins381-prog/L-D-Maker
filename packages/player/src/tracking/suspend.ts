// Compact resume state ("suspend data"). SCORM 1.2 allows only 4,096 characters, so ids are
// replaced by positions in the module and everything is packed into one short string:
//
//   2|<module id>@<version>|<locale>|<screen index>|<visited, hex bitset>|<answers>
//   answers = one entry per question (module order), comma-separated:
//             <choice order, base36 digits>.<selected, base36 digits>.<attempts>.<c: 1 | 0 | ->
//
// A state written for another module or version is ignored rather than misapplied.
import type { Module, Question } from "@ldm/schema";
import type { AnswerState } from "../grading.ts";

export const SUSPEND_FORMAT = "2";

export interface ResumeState {
  locale: string;
  index: number;
  visited: string[];
  answers: Map<string, AnswerState>;
}

function screensOf(m: Module) {
  return m.sections.flatMap((s) => s.screens);
}

function questionsOf(m: Module): Question[] {
  return screensOf(m)
    .flatMap((s) => s.blocks)
    .filter((b): b is Question => b.type === "question");
}

const moduleKey = (m: Module) => `${m.id}@${m.version}`;

function toHexBitset(flags: boolean[]): string {
  let hex = "";
  for (let i = 0; i < flags.length; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) if (flags[i + b]) nibble |= 1 << b;
    hex += nibble.toString(16);
  }
  return hex;
}

function fromHexBitset(hex: string, length: number): boolean[] {
  const flags: boolean[] = [];
  for (let i = 0; i < length; i++) {
    const nibble = Number.parseInt(hex[Math.floor(i / 4)] ?? "0", 16);
    flags.push((nibble >> (i % 4)) % 2 === 1);
  }
  return flags;
}

export function encodeSuspend(m: Module, state: ResumeState): string {
  const screens = screensOf(m);
  const visited = toHexBitset(screens.map((s) => state.visited.includes(s.id)));
  const answers = questionsOf(m).map((q) => {
    const a = state.answers.get(q.id);
    if (!a) return "";
    const pos = (id: string) =>
      q.choices.findIndex((c) => c.id === id).toString(36);
    const c = a.correct === null ? "-" : a.correct ? "1" : "0";
    return `${a.order.map(pos).join("")}.${a.selected.map(pos).join("")}.${a.attempts}.${c}`;
  });
  return [
    SUSPEND_FORMAT,
    moduleKey(m),
    state.locale,
    state.index,
    visited,
    answers.join(","),
  ].join("|");
}

/** Returns null for empty, foreign, outdated or corrupted data (the learner simply starts over). */
export function decodeSuspend(
  m: Module,
  data: string | null | undefined,
): ResumeState | null {
  if (!data) return null;
  const [format, key, locale, rawIndex, visitedHex, rawAnswers] =
    data.split("|");
  if (
    format !== SUSPEND_FORMAT ||
    key !== moduleKey(m) ||
    !locale ||
    rawAnswers === undefined
  )
    return null;
  const screens = screensOf(m);
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || index >= screens.length)
    return null;
  if (!/^[0-9a-f]*$/.test(visitedHex ?? "")) return null;
  const flags = fromHexBitset(visitedHex ?? "", screens.length);
  const visited = screens.filter((_, i) => flags[i]).map((s) => s.id);

  const questions = questionsOf(m);
  const entries = rawAnswers === "" ? [] : rawAnswers.split(",");
  if (entries.length !== questions.length) return null;
  const answers = new Map<string, AnswerState>();
  for (const [i, entry] of entries.entries()) {
    const q = questions[i] as Question;
    if (entry === "") continue;
    const [order, selected, attempts, c] = entry.split(".");
    const id = (digit: string) => q.choices[Number.parseInt(digit, 36)]?.id;
    const orderIds = [...(order ?? "")].map(id);
    const selectedIds = [...(selected ?? "")].map(id);
    // The order must be a permutation of the current choices, otherwise the content changed.
    if (
      orderIds.length !== q.choices.length ||
      orderIds.some((x) => !x) ||
      new Set(orderIds).size !== orderIds.length
    )
      return null;
    if (selectedIds.some((x) => !x)) return null;
    answers.set(q.id, {
      order: orderIds as string[],
      selected: selectedIds as string[],
      attempts: Number(attempts) || 0,
      correct: c === "1" ? true : c === "0" ? false : null,
    });
  }
  return { locale, index, visited, answers };
}
