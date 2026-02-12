import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
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
  AuthModeSchema,
  AuthSignInRequestSchema,
  UserRoleSchema,
  type AuthMode,
  type AuthModeStatus,
  type AuthSignInRequest,
  type AuthState,
  type LocalAuthCredentials
} from '@satori/domain/auth/schemas'
import {
  AUTH_LOCAL_ACCOUNT_FILENAME,
  AUTH_MODE_FILENAME,
  AUTH_SESSION_FILENAME,
  LOCAL_SESSION_TTL_MS
} from '../constants/auth'
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

const StoredModeSchema = Schema.Struct({
  mode: AuthModeSchema
})

type StoredMode = Schema.Schema.Type<typeof StoredModeSchema>

const LocalAccountSchema = Schema.Struct({
  userId: Schema.String,
  username: Schema.String,
  usernameNormalized: Schema.String,
  role: UserRoleSchema,
  passwordHash: Schema.String
})

type LocalAccount = Schema.Schema.Type<typeof LocalAccountSchema>

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

const passwordHashParams = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1
} as const

const passwordSaltBytes = 16
const passwordKeyBytes = 32

const authSessionFilePath = (): string => join(app.getPath('userData'), AUTH_SESSION_FILENAME)

const authModeFilePath = (): string => join(app.getPath('userData'), AUTH_MODE_FILENAME)

const localAccountFilePath = (): string =>
  join(app.getPath('userData'), AUTH_LOCAL_ACCOUNT_FILENAME)

const encodeBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64')

const encryptText = (text: string): Effect.Effect<string, never> =>
  !safeStorage.isEncryptionAvailable()
    ? Effect.succeed(text)
    : Effect.try({
        try: () => safeStorage.encryptString(text).toString('base64'),
        catch: (cause) => new SafeStorageEncryptError({ cause })
      }).pipe(Effect.catchTag('SafeStorageEncryptError', () => Effect.succeed(text)))

const decryptText = (text: string): Effect.Effect<string, never> =>
  !safeStorage.isEncryptionAvailable()
    ? Effect.succeed(text)
    : Effect.try({
        try: () => safeStorage.decryptString(Buffer.from(text, 'base64')),
        catch: (cause) => new SafeStorageDecryptError({ cause })
      }).pipe(Effect.catchTag('SafeStorageDecryptError', () => Effect.succeed(text)))

const deleteFileIgnoringErrors = (
  fs: FileSystem.FileSystem,
  filePath: string
): Effect.Effect<void, never> =>
  fs.remove(filePath, { force: true }).pipe(
    Effect.catchTag('BadArgument', () => Effect.void),
    Effect.catchTag('SystemError', () => Effect.void)
  )

const readOptionalEncryptedFile = (
  fs: FileSystem.FileSystem,
  filePath: string,
  message: string
): Effect.Effect<Option.Option<string>, AuthStorageError> =>
  fs.readFileString(filePath, 'utf8').pipe(
    Effect.map(Option.some),
    Effect.catchTag('SystemError', (error) =>
      error.reason === 'NotFound' ? Effect.succeed(Option.none()) : Effect.fail(error)
    ),
    Effect.mapError(
      (cause) =>
        new AuthStorageError({
          message,
          path: filePath,
          cause
        })
    ),
    Effect.flatMap((encryptedText) =>
      Option.match(encryptedText, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (text) => decryptText(text).pipe(Effect.map(Option.some))
      })
    )
  )

const writeEncryptedFile = (
  fs: FileSystem.FileSystem,
  filePath: string,
  content: string,
  message: string
): Effect.Effect<void, AuthStorageError> =>
  Effect.gen(function* () {
    const encrypted = yield* encryptText(content)

    yield* fs.writeFileString(filePath, encrypted).pipe(
      Effect.mapError(
        (cause) =>
          new AuthStorageError({
            message,
            path: filePath,
            cause
          })
      )
    )
  })

const loadStoredSession = (
  fs: FileSystem.FileSystem
): Effect.Effect<Option.Option<StoredSession>, AuthStorageError> => {
  const filePath = authSessionFilePath()
  const decodeStoredSession = Schema.decodeUnknownEither(Schema.parseJson(StoredSessionSchema))

  return readOptionalEncryptedFile(fs, filePath, 'Failed to read auth session').pipe(
    Effect.flatMap((rawText) =>
      Option.match(rawText, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (text) => {
          const decoded = decodeStoredSession(text)

          return Either.isLeft(decoded)
            ? deleteFileIgnoringErrors(fs, filePath).pipe(Effect.as(Option.none()))
            : Effect.succeed(Option.some(decoded.right))
        }
      })
    )
  )
}

const saveStoredSession = (
  fs: FileSystem.FileSystem,
  session: StoredSession
): Effect.Effect<void, AuthStorageError> => {
  const filePath = authSessionFilePath()

  return writeEncryptedFile(fs, filePath, JSON.stringify(session), 'Failed to write auth session')
}

const deleteStoredSessionFile = (
  fs: FileSystem.FileSystem
): Effect.Effect<void, AuthStorageError> => {
  const filePath = authSessionFilePath()

  return fs.remove(filePath, { force: true }).pipe(
    Effect.mapError(
      (cause) =>
        new AuthStorageError({
          message: 'Failed to delete auth session',
          path: filePath,
          cause
        })
    )
  )
}

const loadStoredMode = (
  fs: FileSystem.FileSystem
): Effect.Effect<Option.Option<AuthMode>, AuthStorageError> => {
  const filePath = authModeFilePath()
  const decodeStoredMode = Schema.decodeUnknownEither(Schema.parseJson(StoredModeSchema))

  return readOptionalEncryptedFile(fs, filePath, 'Failed to read auth mode').pipe(
    Effect.flatMap((rawText) =>
      Option.match(rawText, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (text) => {
          const decoded = decodeStoredMode(text)

          return Either.isLeft(decoded)
            ? deleteFileIgnoringErrors(fs, filePath).pipe(Effect.as(Option.none()))
            : Effect.succeed(Option.some(decoded.right.mode))
        }
      })
    )
  )
}

const saveStoredMode = (
  fs: FileSystem.FileSystem,
  mode: AuthMode
): Effect.Effect<void, AuthStorageError> => {
  const filePath = authModeFilePath()
  const value: StoredMode = { mode }

  return writeEncryptedFile(fs, filePath, JSON.stringify(value), 'Failed to write auth mode')
}

const loadLocalAccount = (
  fs: FileSystem.FileSystem
): Effect.Effect<Option.Option<LocalAccount>, AuthStorageError> => {
  const filePath = localAccountFilePath()
  const decodeLocalAccount = Schema.decodeUnknownEither(Schema.parseJson(LocalAccountSchema))

  return readOptionalEncryptedFile(fs, filePath, 'Failed to read local account').pipe(
    Effect.flatMap((rawText) =>
      Option.match(rawText, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (text) => {
          const decoded = decodeLocalAccount(text)

          return Either.isLeft(decoded)
            ? deleteFileIgnoringErrors(fs, filePath).pipe(Effect.as(Option.none()))
            : Effect.succeed(Option.some(decoded.right))
        }
      })
    )
  )
}

const saveLocalAccount = (
  fs: FileSystem.FileSystem,
  account: LocalAccount
): Effect.Effect<void, AuthStorageError> => {
  const filePath = localAccountFilePath()

  return writeEncryptedFile(fs, filePath, JSON.stringify(account), 'Failed to write local account')
}

const normalizeUsername = (value: string): string => value.trim().toLowerCase()

const hashLocalPassword = (password: string): string => {
  const salt = randomBytes(passwordSaltBytes)
  const key = scryptSync(password, salt, passwordKeyBytes, {
    N: passwordHashParams.cost,
    r: passwordHashParams.blockSize,
    p: passwordHashParams.parallelization
  })

  return [
    'scrypt',
    String(passwordHashParams.cost),
    String(passwordHashParams.blockSize),
    String(passwordHashParams.parallelization),
    encodeBase64(salt),
    encodeBase64(key)
  ].join('$')
}

const verifyLocalPassword = (password: string, storedHash: string): boolean => {
  try {
    const parts = storedHash.split('$')
    if (parts.length !== 6) {
      return false
    }

    const [algo, costRaw, blockSizeRaw, parallelizationRaw, saltRaw, keyRaw] = parts

    if (algo !== 'scrypt') {
      return false
    }

    const cost = Number(costRaw)
    const blockSize = Number(blockSizeRaw)
    const parallelization = Number(parallelizationRaw)

    if (
      !Number.isFinite(cost) ||
      !Number.isFinite(blockSize) ||
      !Number.isFinite(parallelization)
    ) {
      return false
    }

    const salt = Buffer.from(String(saltRaw), 'base64')
    const expectedKey = Buffer.from(String(keyRaw), 'base64')

    const candidate = scryptSync(password, salt, expectedKey.byteLength, {
      N: cost,
      r: blockSize,
      p: parallelization
    })

    if (candidate.byteLength !== expectedKey.byteLength) {
      return false
    }

    return timingSafeEqual(Buffer.from(candidate), expectedKey)
  } catch {
    return false
  }
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

const localSessionFromAccount = (account: LocalAccount): StoredSession => ({
  accessToken: randomUUID(),
  userId: account.userId,
  email: account.username,
  role: account.role,
  expiresAtMs: Date.now() + LOCAL_SESSION_TTL_MS
})

const makeAuthService = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const client = yield* HttpClient.HttpClient

  const initialStoredSession = yield* loadStoredSession(fs)
  const initialStoredMode = yield* loadStoredMode(fs)
  const initialLocalAccount = yield* loadLocalAccount(fs)

  let currentStoredSession = initialStoredSession
  let currentAuthMode = initialStoredMode
  let currentLocalAccount = initialLocalAccount

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

  const modeStatusFromState = (): AuthModeStatus =>
    Option.match(currentAuthMode, {
      onNone: () => ({ _tag: 'Unconfigured' }),
      onSome: (mode) =>
        mode === 'sync'
          ? { _tag: 'ConfiguredSync', mode: 'sync' }
          : {
              _tag: 'ConfiguredLocal',
              mode: 'local',
              localAccountExists: Option.isSome(currentLocalAccount)
            }
    })

  const setStoredSession = (session: StoredSession): Effect.Effect<void, AuthStorageError> =>
    Effect.tap(saveStoredSession(fs, session), () =>
      Effect.sync(() => {
        currentStoredSession = Option.some(session)
        currentAuthState = authenticatedStateFromSession(session)
        scheduleLock(currentAuthState)
      })
    )

  const clearStoredSession: Effect.Effect<void, AuthStorageError> = Effect.tap(
    deleteStoredSessionFile(fs),
    () =>
      Effect.sync(() => {
        currentStoredSession = Option.none()
        currentAuthState = unauthenticatedState
        clearLockTimeout()
      })
  )

  const setAuthMode = (mode: AuthMode): Effect.Effect<void, AuthStorageError> =>
    Effect.tap(saveStoredMode(fs, mode), () =>
      Effect.sync(() => {
        currentAuthMode = Option.some(mode)
      })
    )

  const getModeStatus: Effect.Effect<AuthModeStatus, AuthStorageError> =
    Effect.sync(modeStatusFromState)

  const selectMode = (mode: AuthMode): Effect.Effect<AuthModeStatus, AuthStorageError> =>
    Effect.gen(function* () {
      yield* setAuthMode(mode)
      yield* clearStoredSession
      return modeStatusFromState()
    })

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
      const mode = Option.getOrUndefined(currentAuthMode)
      const requiresInternet = mode !== 'local'

      switch (state._tag) {
        case 'Authenticated':
          return Effect.succeed(state)
        case 'Locked':
          return Effect.fail(
            new LockedError({
              message: requiresInternet
                ? 'Session expired. Please sign in again (internet required).'
                : 'Session expired. Please sign in again.'
            })
          )
        case 'Unauthenticated':
          return Effect.fail(
            new UnauthorizedError({
              message: requiresInternet
                ? 'Please sign in (internet required).'
                : 'Please sign in with your local account.'
            })
          )
      }
    }
  )

  const getAccessToken: Effect.Effect<string, UnauthorizedError | LockedError | AuthStorageError> =
    requireAuthenticated.pipe(
      Effect.flatMap(() =>
        Effect.suspend(() => {
          if (Option.isNone(currentStoredSession)) {
            return Effect.fail(new UnauthorizedError({ message: 'Please sign in.' }))
          }

          return Effect.succeed(currentStoredSession.value.accessToken)
        })
      )
    )

  const signIn = (
    request: AuthSignInRequest
  ): Effect.Effect<
    AuthState,
    ApiConfigError | ApiAuthError | AuthStorageError | UnauthorizedError
  > =>
    Effect.gen(function* () {
      const mode = Option.getOrUndefined(currentAuthMode)
      if (mode === 'local') {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: 'Local mode is active. Please use local sign-in.'
          })
        )
      }

      if (mode === undefined) {
        yield* setAuthMode('sync')
      }

      const config = yield* getApiConfig()
      const session = yield* authSignInRequest(client, config, request)

      const storedSession: StoredSession = session

      yield* setStoredSession(storedSession)
      return authenticatedStateFromSession(storedSession)
    })

  const localOnboard = (
    request: LocalAuthCredentials
  ): Effect.Effect<AuthState, AuthStorageError | UnauthorizedError> =>
    Effect.gen(function* () {
      const mode = Option.getOrUndefined(currentAuthMode)

      if (mode === 'sync') {
        return yield* Effect.fail(
          new UnauthorizedError({ message: 'Switch to local mode before local onboarding.' })
        )
      }

      if (mode === undefined) {
        yield* setAuthMode('local')
      }

      if (Option.isSome(currentLocalAccount)) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: 'Local account already exists. Please sign in with your local account.'
          })
        )
      }

      const username = request.username.trim()
      const usernameNormalized = normalizeUsername(username)

      const passwordHash = yield* Effect.try({
        try: () => hashLocalPassword(request.password),
        catch: (cause) =>
          new AuthStorageError({
            message: 'Failed to hash local password',
            path: localAccountFilePath(),
            cause
          })
      })

      const account: LocalAccount = {
        userId: randomUUID(),
        username,
        usernameNormalized,
        role: 'admin',
        passwordHash
      }

      yield* saveLocalAccount(fs, account)
      yield* Effect.sync(() => {
        currentLocalAccount = Option.some(account)
      })

      const session = localSessionFromAccount(account)
      yield* setStoredSession(session)

      return authenticatedStateFromSession(session)
    })

  const localSignIn = (
    request: LocalAuthCredentials
  ): Effect.Effect<AuthState, AuthStorageError | UnauthorizedError> =>
    Effect.gen(function* () {
      const mode = Option.getOrUndefined(currentAuthMode)

      if (mode !== 'local') {
        return yield* Effect.fail(
          new UnauthorizedError({ message: 'Local sign-in is only available in local mode.' })
        )
      }

      if (Option.isNone(currentLocalAccount)) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: 'No local account found. Complete local onboarding first.'
          })
        )
      }

      const account = currentLocalAccount.value
      const usernameMatches = normalizeUsername(request.username) === account.usernameNormalized
      const passwordMatches = verifyLocalPassword(request.password, account.passwordHash)

      if (!usernameMatches || !passwordMatches) {
        return yield* Effect.fail(
          new UnauthorizedError({ message: 'Invalid username or password.' })
        )
      }

      const session = localSessionFromAccount(account)
      yield* setStoredSession(session)

      return authenticatedStateFromSession(session)
    })

  const signOut: Effect.Effect<AuthState, AuthStorageError> = Effect.as(
    clearStoredSession,
    unauthenticatedState
  )

  return {
    getModeStatus,
    selectMode,
    getStatus,
    signIn,
    localOnboard,
    localSignIn,
    signOut,
    requireAuthenticated,
    getAccessToken
  } as const
})

export class AuthService extends Effect.Service<AuthService>()('services/AuthService', {
  dependencies: [NodeFileSystem.layer, FetchHttpClient.layer],
  effect: makeAuthService
}) {}
