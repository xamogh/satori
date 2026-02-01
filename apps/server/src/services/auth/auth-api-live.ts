import { HttpApiBuilder } from '@effect/platform'
import { Effect, Layer } from 'effect'
import { Api } from '@satori/api-contract/api/api-definition'
import { InternalServerError, Unauthorized } from '@satori/api-contract/api/http-errors'
import { EnvVars } from '../../config/env-vars'
import { PgClient } from '../../db/pg-client'
import { UsersRepository } from '../../repository/users-repository'
import { AuthService } from './auth.service'

export const AuthApiLive = HttpApiBuilder.group(Api, 'auth', (handlers) =>
  Effect.gen(function* () {
    const auth = yield* AuthService

    return handlers.handle('signIn', ({ payload }) =>
      auth.signIn(payload).pipe(
        Effect.catchTag(
          'InvalidCredentialsError',
          (error) => new Unauthorized({ message: error.message, cause: null })
        ),
        Effect.catchTag(
          'PasswordVerifyError',
          (error) =>
            new InternalServerError({
              message: 'Failed to verify password',
              cause: error.cause
            })
        ),
        Effect.catchTag(
          'DbError',
          (error) => new InternalServerError({ message: 'Failed to sign in', cause: error.cause })
        ),
        Effect.catchTag(
          'JwtError',
          (error) => new InternalServerError({ message: 'Failed to sign in', cause: error.cause })
        )
      )
    )
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(AuthService.Default, UsersRepository.Default, PgClient.Default, EnvVars.Default)
  )
)
