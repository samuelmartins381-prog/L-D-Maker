// Question logic, independent of the UI: answer state, grading, attempts, module score.
// Reused by tracking (J1 step 5) to report score, success and interactions to the LMS.
import type { Module, Question } from "@ldm/schema";

export interface AnswerState {
  /** Display order of choice ids, fixed once per learner so it never reshuffles mid-session. */
  order: string[];
  /** Choice ids currently selected. */
  selected: string[];
  /** Number of submitted attempts. */
  attempts: number;
  /** Result of the last submission; null before the first one. */
  correct: boolean | null;
}

export type Rng = () => number;

export function shuffled<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function initialAnswer(
  q: Question,
  rng: Rng = Math.random,
): AnswerState {
  const ids = q.choices.map((c) => c.id);
  return {
    order: q.shuffle ? shuffled(ids, rng) : ids,
    selected: [],
    attempts: 0,
    correct: null,
  };
}

/** All-or-nothing in schema v0.1 (ADR 0002): the selection must equal the set of correct choices. */
export function isCorrect(q: Question, selected: readonly string[]): boolean {
  const expected = q.choices.filter((c) => c.correct).map((c) => c.id);
  return (
    expected.length === selected.length &&
    expected.every((id) => selected.includes(id))
  );
}

export function toggle(
  q: Question,
  state: AnswerState,
  choiceId: string,
): AnswerState {
  if (isFinal(q, state)) return state;
  const selected =
    q.variant === "single"
      ? [choiceId]
      : state.selected.includes(choiceId)
        ? state.selected.filter((id) => id !== choiceId)
        : [...state.selected, choiceId];
  // Changing the selection after a wrong attempt starts a new attempt.
  return { ...state, selected, correct: null };
}

export function submit(q: Question, state: AnswerState): AnswerState {
  if (
    isFinal(q, state) ||
    state.selected.length === 0 ||
    state.correct !== null
  )
    return state;
  return {
    ...state,
    attempts: state.attempts + 1,
    correct: isCorrect(q, state.selected),
  };
}

/** Final when answered correctly or out of attempts: the answer key is then revealed. */
export function isFinal(q: Question, state: AnswerState): boolean {
  return (
    state.correct === true ||
    (state.correct === false && state.attempts >= q.attempts)
  );
}

export function attemptsLeft(q: Question, state: AnswerState): number {
  return Math.max(0, q.attempts - state.attempts);
}

export interface Score {
  /** Scored questions answered correctly (final state). */
  raw: number;
  /** Number of scored questions. */
  max: number;
  /** raw / max in [0, 1]; 1 when the module has no scored question. */
  scaled: number;
  /** All scored questions are in a final state. */
  complete: boolean;
  passed: boolean;
}

export function scoredQuestions(m: Module): Question[] {
  return m.sections
    .flatMap((s) => s.screens.flatMap((sc) => sc.blocks))
    .filter((b): b is Question => b.type === "question" && b.scored);
}

export function moduleScore(
  m: Module,
  answers: ReadonlyMap<string, AnswerState>,
  passingScore: number = m.assessment.passingScore,
): Score {
  const questions = scoredQuestions(m);
  let raw = 0;
  let complete = true;
  for (const q of questions) {
    const a = answers.get(q.id);
    if (!a || !isFinal(q, a)) complete = false;
    else if (a.correct) raw++;
  }
  const max = questions.length;
  const scaled = max === 0 ? 1 : raw / max;
  return {
    raw,
    max,
    scaled,
    complete,
    passed: complete && scaled * 100 >= passingScore,
  };
}
