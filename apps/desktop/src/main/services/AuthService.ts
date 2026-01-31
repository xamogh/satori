import { app, safeStorage } from "electron"
import { readFile, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { Context, Effect, Either, Layer, Option, Schema } from "effect"
import {
  ApiResultSchema,
  ApiRoutes,
  AuthSessionSchema,
  type AuthSession,
} from "@satori/shared/api/contract"
import type { AuthSignInRequest, AuthState } from "@satori/shared/auth/schemas"
import { UserRoleSchema } from "@satori/shared/auth/schemas"
import {
  AuthStorageError,
  ApiAuthError,
  ApiConfigError,
  LockedError,
  UnauthorizedError,
} from "../errors"
import type { ApiConfig } from "../utils/apiConfig"
import { getApiConfig } from "../utils/apiConfig"
import { toErrorCause } from "@satori/shared/utils/errorCause"
import type { Json } from "@satori/shared/utils/json"

const StoredSessionSchema = Schema.Struct({
  accessToken: Schema.String,
  userId: Schema.String,
  email: Schema.String,
  role: UserRoleSchema,
  expiresAtMs: Schema.Number,
})

type StoredSession = Schema.Schema.Type<typeof StoredSessionSchema>


const authSessionFilePath = (): string =>
  join(app.getPath("userData"), "auth.session")

const encryptSessionText = (text: string): string => {
  if (!safeStorage.isEncryptionAvailable()) {
    return text
  }

  return safeStorage.encryptString(text).toString("base64")
}

const decryptSessionText = (text: string): string => {
  if (!safeStorage.isEncryptionAvailable()) {
    return text
  }

  try {
    return safeStorage.decryptString(Buffer.from(text, "base64"))
  } catch {
    return text
  }
}

type NodeError = {
  readonly code?: string
}

const isMissingFileError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as NodeError).code === "ENOENT"

const loadStoredSession = (): Effect.Effect<
  Option.Option<StoredSession>,
  AuthStorageError
> => {
  const filePath = authSessionFilePath()
  const deleteInvalidSession = Effect.tryPromise({
    try: async () => {
      await rm(filePath, { force: true })
    },
    catch: (error) =>
      new AuthStorageError({
        message: "Failed to delete invalid auth session",
        path: filePath,
        cause: toErrorCause(error),
      }),
  }).pipe(Effect.catchTag("AuthStorageError", () => Effect.succeed(undefined)))

  const program = Effect.tryPromise({
    try: async () => {
      try {
        const encryptedText = await readFile(filePath, { encoding: "utf8" })
        return Option.some(decryptSessionText(encryptedText))
      } catch (error) {
        return isMissingFileError(error) ? Option.none() : Promise.reject(error)
      }
    },
    catch: (error) =>
      new AuthStorageError({
        message: "Failed to read auth session",
        path: filePath,
        cause: toErrorCause(error),
      }),
  })

  return Effect.flatMap(program, (maybeText) =>
    Option.isNone(maybeText)
      ? Effect.succeed(Option.none())
      : Effect.gen(function* () {
          const parsed = yield* Effect.sync(() => {
            try {
              return Option.some(JSON.parse(maybeText.value) as Json)
            } catch {
              return Option.none()
            }
          })

          if (Option.isNone(parsed)) {
            yield* deleteInvalidSession
            return Option.none()
          }

          const decoded = Schema.decodeUnknownEither(StoredSessionSchema)(parsed.value)
          if (Either.isLeft(decoded)) {
            yield* deleteInvalidSession
            return Option.none()
          }

          return Option.some(decoded.right)
        })
  )
}

const saveStoredSession = (
  session: StoredSession
): Effect.Effect<void, AuthStorageError> => {
  const filePath = authSessionFilePath()

  return Effect.tryPromise({
    try: async () => {
      const text = JSON.stringify(session)
      const encrypted = encryptSessionText(text)
      await writeFile(filePath, encrypted, { encoding: "utf8" })
    },
    catch: (error) =>
      new AuthStorageError({
        message: "Failed to write auth session",
        path: filePath,
        cause: toErrorCause(error),
      }),
  })
}

const deleteStoredSession = (): Effect.Effect<void, AuthStorageError> => {
  const filePath = authSessionFilePath()

  return Effect.tryPromise({
    try: async () => {
      await rm(filePath, { force: true })
    },
    catch: (error) =>
      new AuthStorageError({
        message: "Failed to delete auth session",
        path: filePath,
        cause: toErrorCause(error),
      }),
  })
}

const lockStateFromSession = (session: StoredSession): AuthState => ({
  _tag: "Locked",
  reason: "TokenExpired",
  email: session.email,
})

const unauthenticatedState: AuthState = { _tag: "Unauthenticated" }

const authenticatedStateFromSession = (session: StoredSession): AuthState => ({
  _tag: "Authenticated",
  userId: session.userId,
  email: session.email,
  role: session.role,
  expiresAtMs: session.expiresAtMs,
})

const authStateFromStoredSession = (
  session: StoredSession,
  nowMs: number
): AuthState =>
  session.expiresAtMs <= nowMs
    ? lockStateFromSession(session)
    : authenticatedStateFromSession(session)

const fetchJson = (
  url: string,
  init: RequestInit
): Effect.Effect<
  { readonly status: number; readonly body: Json },
  ApiAuthError
> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, init)
      const body = (await response.json()) as Json
      return { status: response.status, body }
    },
    catch: (error) =>
      new ApiAuthError({
        message: "Network error",
        statusCode: 0,
        cause: toErrorCause(error),
      }),
  })

const authSignInRequest = (
  config: ApiConfig,
  request: AuthSignInRequest
): Effect.Effect<AuthSession, ApiAuthError> =>
  Effect.gen(function* () {
    const url = `${config.baseUrl}${ApiRoutes.authSignIn.path}`

    const { status, body } = yield* fetchJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })

    const decoded = yield* Schema.decodeUnknown(
      ApiResultSchema(AuthSessionSchema)
    )(body).pipe(
      Effect.mapError(
        (error) =>
          new ApiAuthError({
            message: "Invalid auth response from API",
            statusCode: status,
            cause: toErrorCause(error),
          })
      )
    )

    if (decoded._tag === "Ok") {
      return decoded.value
    }

    return yield* Effect.fail(
      new ApiAuthError({
        message: decoded.error.message,
        statusCode: status,
        cause: toErrorCause(decoded.error),
      })
    )
  })

export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  {
    readonly getStatus: Effect.Effect<AuthState, AuthStorageError>
    readonly signIn: (
      request: AuthSignInRequest
    ) => Effect.Effect<
      AuthState,
      ApiConfigError | ApiAuthError | AuthStorageError
    >
    readonly signOut: Effect.Effect<AuthState, AuthStorageError>
    readonly requireAuthenticated: Effect.Effect<
      Extract<AuthState, { _tag: "Authenticated" }>,
      UnauthorizedError | LockedError | AuthStorageError
    >
    readonly getAccessToken: Effect.Effect<
      string,
      UnauthorizedError | LockedError | AuthStorageError
    >
  }
>() {}

const makeAuthService = Effect.gen(function* () {
  const initialStoredSession = yield* loadStoredSession()
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

    if (state._tag !== "Authenticated") {
      return
    }

    const delayMs = state.expiresAtMs - Date.now()
    if (delayMs <= 0) {
      currentAuthState = { _tag: "Locked", reason: "TokenExpired", email: state.email }
      return
    }

    lockTimeout = setTimeout(() => {
      currentAuthState = { _tag: "Locked", reason: "TokenExpired", email: state.email }
    }, delayMs)
  }

  scheduleLock(currentAuthState)

  const setStoredSession = (session: StoredSession): Effect.Effect<void, AuthStorageError> =>
    Effect.tap(saveStoredSession(session), () =>
      Effect.sync(() => {
        currentStoredSession = Option.some(session)
        currentAuthState = authenticatedStateFromSession(session)
        scheduleLock(currentAuthState)
      })
    )

  const clearStoredSession: Effect.Effect<void, AuthStorageError> = Effect.tap(
    deleteStoredSession(),
    () =>
      Effect.sync(() => {
        currentStoredSession = Option.none()
        currentAuthState = unauthenticatedState
        clearLockTimeout()
      })
  )

  const getStatus: Effect.Effect<AuthState, AuthStorageError> = Effect.sync(() => {
    if (currentAuthState._tag === "Authenticated") {
      if (currentAuthState.expiresAtMs <= Date.now()) {
        currentAuthState = {
          _tag: "Locked",
          reason: "TokenExpired",
          email: currentAuthState.email,
        }
        clearLockTimeout()
      }
    }

    return currentAuthState
  })

  const requireAuthenticated: Effect.Effect<
    Extract<AuthState, { _tag: "Authenticated" }>,
    UnauthorizedError | LockedError | AuthStorageError
  > = Effect.flatMap(getStatus, (state): Effect.Effect<
    Extract<AuthState, { _tag: "Authenticated" }>,
    UnauthorizedError | LockedError
  > => {
    switch (state._tag) {
      case "Authenticated":
        return Effect.succeed(state)
      case "Locked":
        return Effect.fail(
          new LockedError({
            message: "Session expired. Please sign in again (internet required).",
          })
        )
      case "Unauthenticated":
        return Effect.fail(
          new UnauthorizedError({ message: "Please sign in (internet required)." })
        )
    }
  })

  const getAccessToken: Effect.Effect<
    string,
    UnauthorizedError | LockedError | AuthStorageError
  > = requireAuthenticated.pipe(
    Effect.flatMap(() =>
      Effect.suspend(() => {
        if (Option.isNone(currentStoredSession)) {
          return Effect.fail(
            new UnauthorizedError({ message: "Please sign in (internet required)." })
          )
        }

        return Effect.succeed(currentStoredSession.value.accessToken)
      })
    )
  )

  const signIn = (
    request: AuthSignInRequest
  ): Effect.Effect<
    AuthState,
    ApiConfigError | ApiAuthError | AuthStorageError
  > =>
    Effect.gen(function* () {
      const config = yield* getApiConfig()
      const session = yield* authSignInRequest(config, request)

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
    getAccessToken,
  }
})

export const AuthServiceLive = Layer.effect(AuthService, makeAuthService)
