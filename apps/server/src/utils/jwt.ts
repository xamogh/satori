import { createHmac, timingSafeEqual } from "node:crypto"
import { Effect, Schema } from "effect"
import { UserRoleSchema } from "@satori/domain/auth/schemas"
import { JwtError } from "../errors"

const base64UrlEncodeBytes = (bytes: Uint8Array): string =>
  Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")

const base64UrlEncodeText = (text: string): string =>
  base64UrlEncodeBytes(Buffer.from(text, "utf8"))

const base64UrlDecode = (text: string): string => {
  const padded = text
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=")

  return Buffer.from(padded, "base64").toString("utf8")
}

const JwtHeaderSchema = Schema.Struct({
  alg: Schema.Literal("HS256"),
  typ: Schema.Literal("JWT"),
})

const JwtPayloadSchema = Schema.Struct({
  sub: Schema.String,
  email: Schema.String,
  role: UserRoleSchema,
  exp: Schema.Number,
  iat: Schema.Number,
})

export type JwtPayload = Schema.Schema.Type<typeof JwtPayloadSchema>

const signInput = (headerB64: string, payloadB64: string): string =>
  `${headerB64}.${payloadB64}`

const signHS256 = (secret: string, input: string): string =>
  base64UrlEncodeBytes(createHmac("sha256", secret).update(input).digest())

export const signJwt = (
  secret: string,
  payload: Omit<JwtPayload, "iat">
): Effect.Effect<string, JwtError> =>
  Effect.try({
    try: () => {
      const header = { alg: "HS256", typ: "JWT" } as const
      const iat = Math.floor(Date.now() / 1000)

      const headerJson = JSON.stringify(header)
      const payloadJson = JSON.stringify({ ...payload, iat })

      const headerB64 = base64UrlEncodeText(headerJson)
      const payloadB64 = base64UrlEncodeText(payloadJson)
      const input = signInput(headerB64, payloadB64)
      const signatureB64 = signHS256(secret, input)

      return `${input}.${signatureB64}`
    },
    catch: (error) =>
      new JwtError({
        message: "Failed to sign JWT",
        cause: error,
      }),
  })

const decodePart = (part: string): Effect.Effect<unknown, JwtError> =>
  Effect.try({
    try: () => {
      const parsed: unknown = JSON.parse(base64UrlDecode(part))
      return parsed
    },
    catch: (error) =>
      new JwtError({
        message: "Invalid JWT encoding",
        cause: error,
      }),
  })

export const verifyJwt = (
  secret: string,
  token: string
): Effect.Effect<JwtPayload, JwtError> =>
  Effect.gen(function* () {
    const parts = token.split(".")
    if (parts.length !== 3) {
      return yield* Effect.fail(
        new JwtError({
          message: "Invalid JWT format",
          cause: "Expected 3 segments",
        })
      )
    }

    const [headerB64, payloadB64, signatureB64] = parts
    const input = signInput(String(headerB64), String(payloadB64))
    const expectedSignature = signHS256(secret, input)

    if (String(signatureB64).length !== expectedSignature.length) {
      return yield* Effect.fail(
        new JwtError({
          message: "Invalid JWT signature",
          cause: "Signature mismatch",
        })
      )
    }

    const signatureOk = timingSafeEqual(
      Buffer.from(String(signatureB64), "utf8"),
      Buffer.from(expectedSignature, "utf8")
    )

    if (!signatureOk) {
      return yield* Effect.fail(
        new JwtError({
          message: "Invalid JWT signature",
          cause: "Signature mismatch",
        })
      )
    }

    const headerUnknown = yield* decodePart(String(headerB64))
    const payloadUnknown = yield* decodePart(String(payloadB64))

    yield* Schema.decodeUnknown(JwtHeaderSchema)(headerUnknown).pipe(
      Effect.mapError((error) =>
        new JwtError({
          message: "Invalid JWT header",
          cause: error,
        })
      )
    )

    const payload = yield* Schema.decodeUnknown(JwtPayloadSchema)(payloadUnknown).pipe(
      Effect.mapError((error) =>
        new JwtError({
          message: "Invalid JWT payload",
          cause: error,
        })
      )
    )

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp <= now) {
      return yield* Effect.fail(
        new JwtError({
          message: "JWT expired",
          cause: "Token expired",
        })
      )
    }

    return payload
  })
