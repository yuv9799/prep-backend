/** Mongo ObjectId pattern. Used to reject malformed IDs before hitting the DB. */
export const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i

export function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && OBJECT_ID_PATTERN.test(id)
}
