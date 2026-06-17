export type QuizFormatsSettings = {
  multipleChoice: boolean;
  trueFalse: boolean;
  fillInBlank: boolean;
};

export const DEFAULT_QUIZ_FORMATS: QuizFormatsSettings = {
  multipleChoice: true,
  trueFalse: false,
  fillInBlank: false,
};

export type QuizFormatDbRow = {
  quizFormatMultipleChoice?: boolean | null;
  quizFormatTrueFalse?: boolean | null;
  quizFormatFillInBlank?: boolean | null;
};

function rowToSettings(row: QuizFormatDbRow | null | undefined): QuizFormatsSettings {
  if (!row) return { ...DEFAULT_QUIZ_FORMATS };
  return {
    multipleChoice: row.quizFormatMultipleChoice ?? DEFAULT_QUIZ_FORMATS.multipleChoice,
    trueFalse: row.quizFormatTrueFalse ?? DEFAULT_QUIZ_FORMATS.trueFalse,
    fillInBlank: row.quizFormatFillInBlank ?? DEFAULT_QUIZ_FORMATS.fillInBlank,
  };
}

/** Deck nullable columns override workspace when any are set; otherwise inherit team. */
export function resolveQuizFormats(
  team: QuizFormatDbRow | null | undefined,
  deck: QuizFormatDbRow | null | undefined,
): QuizFormatsSettings {
  const teamSettings = rowToSettings(team);
  if (!deck) return teamSettings;

  const deckHasOverride =
    deck.quizFormatMultipleChoice != null ||
    deck.quizFormatTrueFalse != null ||
    deck.quizFormatFillInBlank != null;

  if (!deckHasOverride) return teamSettings;

  return {
    multipleChoice: deck.quizFormatMultipleChoice ?? teamSettings.multipleChoice,
    trueFalse: deck.quizFormatTrueFalse ?? teamSettings.trueFalse,
    fillInBlank: deck.quizFormatFillInBlank ?? teamSettings.fillInBlank,
  };
}

export type QuizFormatKey = keyof QuizFormatsSettings;

export const QUIZ_FORMAT_META: Record<
  QuizFormatKey,
  { label: string; description: string }
> = {
  multipleChoice: {
    label: "Multiple choice",
    description: "Pick the best answer from several options",
  },
  trueFalse: {
    label: "True / false",
    description: "Decide whether each statement is true or false",
  },
  fillInBlank: {
    label: "Fill in the blank",
    description: "Type the missing word or phrase",
  },
};

export function enabledQuizFormatKeys(settings: QuizFormatsSettings): QuizFormatKey[] {
  return (Object.keys(QUIZ_FORMAT_META) as QuizFormatKey[]).filter((key) => settings[key]);
}

export function quizFormatsLabel(settings: QuizFormatsSettings): string {
  const parts = enabledQuizFormatKeys(settings).map((key) => QUIZ_FORMAT_META[key].label);
  return parts.length > 0 ? parts.join(", ") : "None";
}
