import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Server-side record of an issued refresh token. The raw token is never stored;
 * only a SHA-256 hash, which allows lookup and revocation on rotation.
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true },
)

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema>

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema)
