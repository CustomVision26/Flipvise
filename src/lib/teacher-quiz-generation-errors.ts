/**
 * Map technical AI / validation failures to formal messages for the teacher UI.
 * Never surface raw OpenAI schema or provider dump text to end users.
 */
export function formatTeacherQuizGenerationError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message.trim()
      : typeof error === "string"
        ? error.trim()
        : "";

  if (!raw) {
    return "Quiz generation could not be completed. Please try again.";
  }

  if (/PASSAGE_DIVERSITY_FAILED/i.test(raw) || /sufficiently different passages/i.test(raw)) {
    return "The generator could not produce sufficiently different passages. Please try again.";
  }

  if (
    /Invalid schema for response_format/i.test(raw) ||
    /response_format/i.test(raw) ||
    /'required' is required/i.test(raw) ||
    /Missing 'questionType'/i.test(raw) ||
    /structured output/i.test(raw)
  ) {
    return "Reading passage generation failed due to a temporary formatting issue. Please try again.";
  }

  if (/AI quiz generation returned no output/i.test(raw)) {
    return "No quiz content was returned. Please try generating again.";
  }

  if (/incomplete passage questions/i.test(raw)) {
    return "Some passage questions were incomplete. Please try generating again.";
  }

  if (/Saved lesson plan not found/i.test(raw)) {
    return "The selected lesson plan could not be found. Please choose another plan and try again.";
  }

  if (/OPENAI_API_KEY|api key/i.test(raw)) {
    return "AI generation is unavailable right now. Please try again later.";
  }

  if (/rate limit|429|quota|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(raw)) {
    return "The AI service is temporarily unavailable. Please wait a moment and try again.";
  }

  // Keep short, non-technical app messages; hide long provider dumps.
  if (
    raw.length > 160 ||
    /context=\(|properties'|JSON schema|zod|stack|at Object\./i.test(raw)
  ) {
    return "Quiz generation could not be completed. Please try again.";
  }

  return raw;
}
