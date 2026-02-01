import { Effect, Option } from 'effect'
import type { AuthSignInRequest } from '@satori/domain/auth/schemas'
import type { AuthSession } from '@satori/api-contract/api/auth/auth-model'
import { EnvVars } from '../../config/env-vars'
import type { UserRow } from '../../repository/users-repository'
import { UsersRepository } from '../../repository/users-repository'
import type { DbError, JwtError, PasswordVerifyError } from '../../errors'
import { verifyPassword } from '../../utils/password'
import { signJwt } from '../../utils/jwt'
import { InvalidCredentialsError } from './auth-errors'

export class AuthService extends Effect.Service<AuthService>()('services/AuthService', {
  dependencies: [EnvVars.Default, UsersRepository.Default],
  effect: Effect.gen(function* () {
    const env = yield* EnvVars
    const users = yield* UsersRepository

    const makeAuthSession = (user: UserRow): Effect.Effect<AuthSession, JwtError> =>
      Effect.gen(function* () {
        const expSeconds = Math.floor(Date.now() / 1000) + env.expiresInSeconds
        const accessToken = yield* signJwt(env.jwtSecret, {
          sub: user.id,
          email: user.email,
          role: user.role,
          exp: expSeconds
        })

        return {
          accessToken,
          userId: user.id,
          email: user.email,
          role: user.role,
          expiresAtMs: expSeconds * 1000
        }
      })

    const signIn = (
      request: AuthSignInRequest
    ): Effect.Effect<
      AuthSession,
      DbError | PasswordVerifyError | JwtError | InvalidCredentialsError
    > =>
      Effect.gen(function* () {
        const maybeUser = yield* users.findByEmail(request.email)
        if (Option.isNone(maybeUser)) {
          return yield* Effect.fail(
            new InvalidCredentialsError({ message: 'Invalid email or password' })
          )
        }

        const user = maybeUser.value
        const passwordOk = yield* verifyPassword(request.password, user.passwordHash)
        if (!passwordOk) {
          return yield* Effect.fail(
            new InvalidCredentialsError({ message: 'Invalid email or password' })
          )
        }

        return yield* makeAuthSession(user)
      })

    return { signIn } as const
  })
}) {}
