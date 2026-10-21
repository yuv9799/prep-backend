import argon2 from 'argon2'

/**
 * Password hashing with Argon2id. Parameters are tuned for interactive logins
 * on modest hardware.
 */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTIONS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain)
  } catch {
    // A malformed hash must not surface as a 500.
    return false
  }
}

/**
 * A dummy hash used to equalise timing between "user not found" and
 * "wrong password", reducing user-enumeration signal.
 */
let dummyHashPromise: Promise<string> | null = null
export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('prepforge-timing-equalizer')
  return dummyHashPromise
}

/** True when the stored hash needs re-hashing with newer parameters. */
export async function needsRehash(hash: string): Promise<boolean> {
  try {
    return await argon2.needsRehash(hash, ARGON_OPTIONS)
  } catch {
    return false
  }
}

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
