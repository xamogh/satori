import { Effect, Option } from 'effect'
import {
  DATABASE_URL_ENV,
  JWT_EXPIRES_IN_SECONDS_ENV,
  JWT_SECRET_ENV,
  PORT_ENV
} from '../constants/env'
import { EnvError } from '../errors'

const getEnvString = (key: string): Effect.Effect<string, EnvError> =>
  Effect.suspend(() => {
    const value = process.env[key]
    if (typeof value !== 'string' || value.length === 0) {
      return Effect.fail(
        new EnvError({
          message: `Missing ${key}`,
          cause: `Missing env var ${key}`
        })
      )
    }

    return Effect.succeed(value)
  })

const parsePort = (value: string): Option.Option<number> => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536
    ? Option.some(parsed)
    : Option.none()
}

const parsePositiveInt = (value: string): Option.Option<number> => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Option.some(parsed) : Option.none()
}

export class EnvVars extends Effect.Service<EnvVars>()('config/EnvVars', {
  effect: Effect.gen(function* () {
    const databaseUrl = yield* getEnvString(DATABASE_URL_ENV)
    const jwtSecret = yield* getEnvString(JWT_SECRET_ENV)

    const expiresEnv = process.env[JWT_EXPIRES_IN_SECONDS_ENV]
    const expiresInSeconds =
      typeof expiresEnv === 'string'
        ? Option.getOrElse(parsePositiveInt(expiresEnv), () => 259_200)
        : 259_200

    const portEnv = process.env[PORT_ENV]
    const port =
      typeof portEnv === 'string' ? Option.getOrElse(parsePort(portEnv), () => 4000) : 4000

    return { databaseUrl, jwtSecret, expiresInSeconds, port } as const
  })
}) {}
