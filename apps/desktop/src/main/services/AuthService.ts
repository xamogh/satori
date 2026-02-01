import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import {
  FetchHttpClient,
  FileSystem,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse
} from '@effect/platform'
import { NodeFileSystem } from '@effect/platform-node'
import { Effect, Either, Option, Schema } from 'effect'
import { AuthSessionSchema, type AuthSession } from '@satori/api-contract/api/auth/auth-model'
import { BadRequest, InternalServerError, Unauthorized } from '@satori/api-contract/api/http-errors'
import {
  AuthSignInRequestSchema,
  UserRoleSchema,
  type AuthSignInRequest,
  type AuthState
} from '@satori/domain/auth/schemas'
import {
  AuthStorageError,
  ApiAuthError,
  ApiConfigError,
  LockedError,
  UnauthorizedError
} from '../errors'
import type { ApiConfig } from '../utils/apiConfig'
import { getApiConfig } from '../utils/apiConfig'

const StoredSessionSchema = Schema.Struct({
  accessToken: Schema.String,
  userId: Schema.String,
  email: Schema.String,
  role: UserRoleSchema,
  expiresAtMs: Schema.Number
})

type StoredSession = Schema.Schema.Type<typeof StoredSessionSchema>

class SafeStorageEncryptError extends Schema.TaggedError<SafeStorageEncryptError>(
  'SafeStorageEncryptError'
)('SafeStorageEncryptError', {
  cause: Schema.Unknown
}) {}

class SafeStorageDecryptError extends Schema.TaggedError<SafeStorageDecryptError>(
  'SafeStorageDecryptError'
)('SafeStorageDecryptError', {
  cause: Schema.Unknown
}) {}

const authSessionFilePath = (): string => join(app.getPath('userData'), 'auth.session')

const encryptSessionText = (text: string): Effect.Effect<string, never> =>
  !safeStorage.isEncryptionAvailable()
    ? Effect.succeed(text)
    : Effect.try({
        try: () => safeStorage.encryptString(text).toString('base64'),
        catch: (cause) => new SafeStorageEncryptError({ cause })
      }).pipe(Effect.catchTag('SafeStorageEncryptError', () => Effect.succeed(text)))

const decryptSessionText = (text: string): Effect.Effect<string, never> =>
  !safeStorage.isEncryptionAvailable()
    ? Effect.succeed(text)
    : Effect.try({
        try: () => safeStorage.decryptString(Buffer.from(text, 'base64')),
        catch: (cause) => new SafeStorageDecryptError({ cause })
      }).pipe(Effect.catchTag('SafeStorageDecryptError', () => Effect.succeed(text)))

const deleteSessionFileIgnoringErrors = (
  fs: FileSystem.FileSystem,
  filePath: string
): Effect.Effect<void, never> =>
  fs.remove(filePath, { force: true }).pipe(
    Effect.catchTag('BadArgument', () => Effect.void),
    Effect.catchTag('SystemError', () => Effect.void)
  )

const loadStoredSession = (
  fs: FileSystem.FileSystem
): Effect.Effect<Option.Option<StoredSession>, AuthStorageError> => {
  const filePath = authSessionFilePath()

  const decodeStoredSession = Schema.decodeUnknownEither(Schema.parseJson(StoredSessionSchema))

  return fs.readFileString(filePath, 'utf8').pipe(
    Effect.map(Option.some),
    Effect.catchTag('SystemError', (error) =>
      error.reason === 'NotFound' ? Effect.succeed(Option.none()) : Effect.fail(error)
    ),
    Effect.mapError(
      (cause) =>
        new AuthStorageError({
          message: 'Failed to read auth session',
          path: filePath,
          cause
        })
    ),
    Effect.flatMap((encryptedText) =>
      Option.match(encryptedText, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (text) =>
          decryptSessionText(text).pipe(
            Effect.flatMap((decrypted) => {
              const decoded = decodeStoredSession(decrypted)
              return Either.isLeft(decoded)
                ? deleteSessionFileIgnoringErrors(fs, filePath).pipe(Effect.as(Option.none()))
                : Effect.succeed(Option.some(decoded.right))
            })
          )
      })
    )
  )
}

const saveStoredSession = (
  fs: FileSystem.FileSystem,
  session: StoredSession
): Effect.Effect<void, AuthStorageError> => {
  const filePath = authSessionFilePath()
  return Effect.gen(function* () {
    const text = JSON.stringify(session)
    const encrypted = yield* encryptSessionText(text)

    yield* fs.writeFileString(filePath, encrypted).pipe(
      Effect.mapError(
        (cause) =>
          new AuthStorageError({
            message: 'Failed to write auth session',
            path: filePath,
            cause
          })
      )
    )
  })
}

const deleteStoredSession = (fs: FileSystem.FileSystem): Effect.Effect<void, AuthStorageError> => {
  const filePath = authSessionFilePath()

  return Effect.gen(function* () {
    yield* fs.remove(filePath, { force: true }).pipe(
      Effect.mapError(
        (cause) =>
          new AuthStorageError({
            message: 'Failed to delete auth session',
            path: filePath,
            cause
          })
      )
    )
  })
}

const lockStateFromSession = (session: StoredSession): AuthState => ({
  _tag: 'Locked',
  reason: 'TokenExpired',
  email: session.email
})

const unauthenticatedState: AuthState = { _tag: 'Unauthenticated' }

const authenticatedStateFromSession = (session: StoredSession): AuthState => ({
  _tag: 'Authenticated',
  userId: session.userId,
  email: session.email,
  role: session.role,
  expiresAtMs: session.expiresAtMs
})

const authStateFromStoredSession = (session: StoredSession, nowMs: number): AuthState =>
  session.expiresAtMs <= nowMs
    ? lockStateFromSession(session)
    : authenticatedStateFromSession(session)

const HttpErrorSchema = Schema.Union(Unauthorized, BadRequest, InternalServerError)

const authSignInRequest = (
  client: HttpClient.HttpClient,
  config: ApiConfig,
  request: AuthSignInRequest
): Effect.Effect<AuthSession, ApiAuthError> =>
  Effect.gen(function* () {
    const url = `${config.baseUrl}/auth/sign-in`

    const httpRequest = yield* HttpClientRequest.schemaBodyJson(AuthSignInRequestSchema)(
      HttpClientRequest.acceptJson(HttpClientRequest.post(url)),
      request
    ).pipe(
      Effect.mapError(
        (cause) =>
          new ApiAuthError({
            message: 'Invalid sign-in request',
            statusCode: 0,
            cause
          })
      )
    )

    const response = yield* client.execute(httpRequest).pipe(
      Effect.mapError(
        (cause) =>
          new ApiAuthError({
            message: 'Network error',
            statusCode: 0,
            cause
          })
      )
    )

    return yield* HttpClientResponse.matchStatus(response, {
      '2xx': (ok) =>
        HttpClientResponse.schemaBodyJson(AuthSessionSchema)(ok).pipe(
          Effect.mapError(
            (cause) =>
              new ApiAuthError({
                message: 'Invalid auth response from API',
                statusCode: ok.status,
                cause
              })
          )
        ),
      orElse: (notOk) =>
        HttpClientResponse.schemaBodyJson(HttpErrorSchema)(notOk).pipe(
          Effect.mapError(
            (cause) =>
              new ApiAuthError({
                message: 'Invalid error response from API',
                statusCode: notOk.status,
                cause
              })
          ),
          Effect.flatMap((httpError) =>
            Effect.fail(
              new ApiAuthError({
                message: httpError.message,
                statusCode: notOk.status,
                cause: httpError.cause
              })
            )
          )
        )
    })
  })

const makeAuthService = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const client = yield* HttpClient.HttpClient

  const initialStoredSession = yield* loadStoredSession(fs)
  let currentStoredSession = initialStoredSession

  let currentAuthState = Option.isNone(initialStoredSession)
    ? unauthenticatedState
    : authStateFromStoredSession(initialStoredSession.value, Date.now())

  let lockTimeout: NodeJS.Timeout | null = null

  const clearLockTimeout = (): void => {
    if (lockTimeout) {
      clearTimeout(lockTimeout)
      lockTimeout = null
    }
  }

  const scheduleLock = (state: AuthState): void => {
    clearLockTimeout()

    if (state._tag !== 'Authenticated') {
      return
    }

    const delayMs = state.expiresAtMs - Date.now()
    if (delayMs <= 0) {
      currentAuthState = { _tag: 'Locked', reason: 'TokenExpired', email: state.email }
      return
    }

    lockTimeout = setTimeout(() => {
      currentAuthState = { _tag: 'Locked', reason: 'TokenExpired', email: state.email }
    }, delayMs)
  }

  scheduleLock(currentAuthState)

  const setStoredSession = (session: StoredSession): Effect.Effect<void, AuthStorageError> =>
    Effect.tap(saveStoredSession(fs, session), () =>
      Effect.sync(() => {
        currentStoredSession = Option.some(session)
        currentAuthState = authenticatedStateFromSession(session)
        scheduleLock(currentAuthState)
      })
    )

  const clearStoredSession: Effect.Effect<void, AuthStorageError> = Effect.tap(
    deleteStoredSession(fs),
    () =>
      Effect.sync(() => {
        currentStoredSession = Option.none()
        currentAuthState = unauthenticatedState
        clearLockTimeout()
      })
  )

  const getStatus: Effect.Effect<AuthState, AuthStorageError> = Effect.sync(() => {
    if (currentAuthState._tag === 'Authenticated') {
      if (currentAuthState.expiresAtMs <= Date.now()) {
        currentAuthState = {
          _tag: 'Locked',
          reason: 'TokenExpired',
          email: currentAuthState.email
        }
        clearLockTimeout()
      }
    }

    return currentAuthState
  })

  const requireAuthenticated: Effect.Effect<
    Extract<AuthState, { _tag: 'Authenticated' }>,
    UnauthorizedError | LockedError | AuthStorageError
  > = Effect.flatMap(
    getStatus,
    (
      state
    ): Effect.Effect<
      Extract<AuthState, { _tag: 'Authenticated' }>,
      UnauthorizedError | LockedError
    > => {
      switch (state._tag) {
        case 'Authenticated':
          return Effect.succeed(state)
        case 'Locked':
          return Effect.fail(
            new LockedError({
              message: 'Session expired. Please sign in again (internet required).'
            })
          )
        case 'Unauthenticated':
          return Effect.fail(
            new UnauthorizedError({ message: 'Please sign in (internet required).' })
          )
      }
    }
  )

  const getAccessToken: Effect.Effect<string, UnauthorizedError | LockedError | AuthStorageError> =
    requireAuthenticated.pipe(
      Effect.flatMap(() =>
        Effect.suspend(() => {
          if (Option.isNone(currentStoredSession)) {
            return Effect.fail(
              new UnauthorizedError({ message: 'Please sign in (internet required).' })
            )
          }

          return Effect.succeed(currentStoredSession.value.accessToken)
        })
      )
    )

  const signIn = (
    request: AuthSignInRequest
  ): Effect.Effect<AuthState, ApiConfigError | ApiAuthError | AuthStorageError> =>
    Effect.gen(function* () {
      const config = yield* getApiConfig()
      const session = yield* authSignInRequest(client, config, request)

      const storedSession: StoredSession = session

      yield* setStoredSession(storedSession)
      return authenticatedStateFromSession(storedSession)
    })

  const signOut: Effect.Effect<AuthState, AuthStorageError> = Effect.as(
    clearStoredSession,
    unauthenticatedState
  )

  return {
    getStatus,
    signIn,
    signOut,
    requireAuthenticated,
    getAccessToken
  } as const
})

export class AuthService extends Effect.Service<AuthService>()('services/AuthService', {
  dependencies: [NodeFileSystem.layer, FetchHttpClient.layer],
  effect: makeAuthService
}) {}
