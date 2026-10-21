/**
 * Grades an answer against the question's stored correct answer.
 *
 * The comparison is deliberately type-aware:
 *  - `multi` questions require the selected set to match exactly.
 *  - `mcq` / `boolean` / `numeric` compare the normalised scalar values.
 *  - `text` / `code` compare case-insensitively after trimming.
 *
 * When no correct answer has been recorded the attempt cannot be graded, so
 * it is reported as incorrect rather than guessing.
 */
export function gradeAnswer(
  questionType: string,
  correctAnswer: unknown,
  answer: unknown,
): boolean {
  if (correctAnswer === null || correctAnswer === undefined) return false

  if (Array.isArray(correctAnswer)) {
    const expected = correctAnswer.map((v) => String(v).trim().toLowerCase()).sort()
    const given = Array.isArray(answer)
      ? answer.map((v) => String(v).trim().toLowerCase()).sort()
      : [String(answer ?? '').trim().toLowerCase()]
    return expected.length === given.length && expected.every((v, i) => v === given[i])
  }

  if (questionType === 'boolean') {
    const expected = String(correctAnswer).toLowerCase()
    const given = String(answer).toLowerCase()
    return expected === given
  }

  if (questionType === 'numeric') {
    const expected = Number(correctAnswer)
    const given = Number(answer)
    if (Number.isNaN(expected) || Number.isNaN(given)) return false
    return Math.abs(expected - given) < 1e-9
  }

  const expected = String(correctAnswer).trim().toLowerCase()
  const given = String(answer ?? '').trim().toLowerCase()
  return expected === given
}
