import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { Effect } from "effect"
import { PasswordHashError, PasswordVerifyError } from "../errors"

type ScryptParams = {
  readonly cost: number
  readonly blockSize: number
  readonly parallelization: number
}

const defaultScryptParams: ScryptParams = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
}

const saltBytes = 16
const keyBytes = 32

const encodeBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64")

const decodeBase64 = (text: string): Uint8Array => Buffer.from(text, "base64")

const deriveKey = (
  password: string,
  salt: Uint8Array,
  keyLength: number,
  params: ScryptParams
): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      {
        cost: params.cost,
        blockSize: params.blockSize,
        parallelization: params.parallelization,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }
        resolve(derivedKey)
      }
    )
  })

export const hashPassword = (
  password: string,
  params: ScryptParams = defaultScryptParams
): Effect.Effect<string, PasswordHashError> =>
  Effect.tryPromise({
    try: async () => {
      const salt = randomBytes(saltBytes)
      const derivedKey = await deriveKey(password, salt, keyBytes, params)

      return [
        "scrypt",
        String(params.cost),
        String(params.blockSize),
        String(params.parallelization),
        encodeBase64(salt),
        encodeBase64(derivedKey),
      ].join("$")
    },
    catch: (error) =>
      new PasswordHashError({
        message: "Failed to hash password",
        cause: error,
      }),
  })

const parseHash = (
  storedHash: string
): Effect.Effect<
  {
    readonly params: ScryptParams
    readonly salt: Uint8Array
    readonly derivedKey: Uint8Array
  },
  PasswordVerifyError
> =>
  Effect.suspend(() => {
    const parts = storedHash.split("$")
    if (parts.length !== 6) {
      return Effect.fail(
        new PasswordVerifyError({
          message: "Invalid stored password hash",
          cause: "Invalid hash format",
        })
      )
    }

    const [algo, cost, blockSize, parallelization, salt, key] = parts
    if (algo !== "scrypt") {
      return Effect.fail(
        new PasswordVerifyError({
          message: "Invalid stored password hash",
          cause: "Unsupported password hash algorithm",
        })
      )
    }

    const params: ScryptParams = {
      cost: Number(cost),
      blockSize: Number(blockSize),
      parallelization: Number(parallelization),
    }

    if (
      !Number.isFinite(params.cost) ||
      !Number.isFinite(params.blockSize) ||
      !Number.isFinite(params.parallelization)
    ) {
      return Effect.fail(
        new PasswordVerifyError({
          message: "Invalid stored password hash",
          cause: "Invalid scrypt params",
        })
      )
    }

    return Effect.succeed({
      params,
      salt: decodeBase64(String(salt)),
      derivedKey: decodeBase64(String(key)),
    })
  })

export const verifyPassword = (
  password: string,
  storedHash: string
): Effect.Effect<boolean, PasswordVerifyError> =>
  Effect.gen(function* () {
    const { params, salt, derivedKey } = yield* parseHash(storedHash)

    const candidate = yield* Effect.tryPromise({
      try: async () =>
        deriveKey(password, salt, derivedKey.byteLength, params),
      catch: (error) =>
        new PasswordVerifyError({
          message: "Failed to verify password",
          cause: error,
        }),
    })

    if (candidate.byteLength !== derivedKey.byteLength) {
      return false
    }

    return timingSafeEqual(Buffer.from(candidate), Buffer.from(derivedKey))
  })
