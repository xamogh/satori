import { Effect, Layer, Redacted } from "effect"
import { BearerAuthMiddleware } from "@satori/api-contract/api/auth/bearer-auth.middleware"
import { Unauthorized } from "@satori/api-contract/api/http-errors"
import { EnvVars } from "../../config/env-vars"
import { verifyJwt } from "../../utils/jwt"

export const BearerAuthMiddlewareLive = Layer.effect(
  BearerAuthMiddleware,
  Effect.gen(function* () {
    const env = yield* EnvVars

    return BearerAuthMiddleware.of({
      bearer: (token: Redacted.Redacted) =>
        verifyJwt(env.jwtSecret, Redacted.value(token)).pipe(
          Effect.map((payload) => ({
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
          })),
          Effect.catchTag(
            "JwtError",
            () =>
              new Unauthorized({
                message: "Invalid or expired token",
                cause: null,
              })
          )
        ),
    })
  })
).pipe(Layer.provide(EnvVars.Default))
