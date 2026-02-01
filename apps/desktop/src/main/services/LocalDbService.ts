import { app } from "electron"
import { join } from "node:path"
import { Worker } from "node:worker_threads"
import { Cause, Effect, Exit, Option, Schema } from "effect"
import { LOCAL_DB_FILENAME } from "../constants/localDb"
import { LocalDbMigrationError, LocalDbOpenError, LocalDbQueryError } from "../errors"
import {
  isLocalDbWorkerMessage,
  type LocalDbWorkerRequest,
  type LocalDbWorkerResponse,
  type SerializedError,
  type SqliteParams,
} from "../utils/localDbWorkerProtocol"

export type SqliteRunResult = {
  readonly changes: number
  readonly lastInsertRowid: number | bigint
}

export type LocalDbClient = {
  readonly exec: (sql: string) => Effect.Effect<void, LocalDbQueryError>
  readonly run: (
    sql: string,
    params: SqliteParams
  ) => Effect.Effect<SqliteRunResult, LocalDbQueryError>
  readonly get: <A, I>(
    sql: string,
    schema: Schema.Schema<A, I, never>,
    params: SqliteParams
  ) => Effect.Effect<Option.Option<A>, LocalDbQueryError>
  readonly all: <A, I>(
    sql: string,
    schema: Schema.Schema<A, I, never>,
    params: SqliteParams
  ) => Effect.Effect<ReadonlyArray<A>, LocalDbQueryError>
  readonly transaction: <A, E>(
    run: (tx: Omit<LocalDbClient, "transaction">) => Effect.Effect<A, E>
  ) => Effect.Effect<A, E | LocalDbQueryError>
}

const userDataDir = (): string => app.getPath("userData")

const dbFilePath = (): string => join(userDataDir(), LOCAL_DB_FILENAME)

const workerScriptPath = (): string => join(__dirname, "workers/localDbWorker.js")

const isSqliteRunResult = (value: unknown): value is SqliteRunResult =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { readonly changes?: unknown }).changes === "number" &&
  ("lastInsertRowid" in value) &&
  (typeof (value as { readonly lastInsertRowid?: unknown }).lastInsertRowid === "number" ||
    typeof (value as { readonly lastInsertRowid?: unknown }).lastInsertRowid === "bigint")

const makeClient: Effect.Effect<LocalDbClient, LocalDbOpenError | LocalDbMigrationError> =
  Effect.gen(function* () {
    const lock = yield* Effect.makeSemaphore(1)

    const dataDir = userDataDir()
    const filePath = dbFilePath()

    const pending = new Map<
      number,
      {
        readonly resolve: (response: LocalDbWorkerResponse) => void
        readonly reject: (error: unknown) => void
      }
    >()

    let requestId = 0
    let workerRunning = true

    const rejectAllPending = (error: unknown): void => {
      for (const entry of pending.values()) {
        entry.reject(error)
      }
      pending.clear()
    }

    const initError = (
      message: string,
      error: SerializedError
    ): LocalDbOpenError | LocalDbMigrationError => {
      if (
        message.startsWith("Failed to apply PRAGMA:") ||
        message === "Failed to migrate local database schema"
      ) {
        return new LocalDbMigrationError({ message, cause: error })
      }

      const path =
        message === "Failed to create app data directory" ? dataDir : filePath

      return new LocalDbOpenError({ message, path, cause: error })
    }

    const worker = yield* Effect.tryPromise({
      try: () =>
        new Promise<Worker>((resolve, reject) => {
          const instance = new Worker(workerScriptPath(), {
            workerData: { dbFilePath: filePath },
          })

          let ready = false

          const handleMessage = (raw: unknown): void => {
            if (!isLocalDbWorkerMessage(raw)) return

            if (raw._tag === "Ready") {
              ready = true
              resolve(instance)
              return
            }

            if (raw._tag === "InitError") {
              ready = false
              reject(initError(raw.message, raw.error))
              return
            }

            const entry = pending.get(raw.id)
            if (!entry) return
            pending.delete(raw.id)
            entry.resolve(raw)
          }

          const handleError = (error: unknown): void => {
            workerRunning = false
            rejectAllPending(error)

            if (!ready) {
              reject(error)
            }
          }

          const handleExit = (code: number | null): void => {
            workerRunning = false
            rejectAllPending({ _tag: "WorkerExit", code })

            if (!ready) {
              reject({ _tag: "WorkerExit", code })
            }
          }

          instance.on("message", handleMessage)
          instance.on("error", handleError)
          instance.on("exit", handleExit)

          instance.unref()
        }),
      catch: (error) => {
        if (error instanceof LocalDbOpenError || error instanceof LocalDbMigrationError) {
          return error
        }

        const message =
          error instanceof Error
            ? error.message
            : "Failed to start local database worker"

        return new LocalDbOpenError({
          message,
          path: filePath,
          cause: error,
        })
      },
    })

    const nextRequestId = (): number => {
      requestId += 1
      return requestId
    }

    const send = (request: LocalDbWorkerRequest): Promise<LocalDbWorkerResponse> => {
      if (!workerRunning) {
        return Promise.reject({ _tag: "WorkerNotRunning" } as const)
      }

      return new Promise((resolve, reject) => {
        pending.set(request.id, { resolve, reject })
        try {
          worker.postMessage(request)
        } catch (error) {
          pending.delete(request.id)
          reject(error)
        }
      })
    }

    const execUnsafe = (sql: string): Effect.Effect<void, LocalDbQueryError> =>
      Effect.tryPromise({
        try: () => send({ _tag: "Exec", id: nextRequestId(), sql }),
        catch: (error) =>
          new LocalDbQueryError({
            message: "Local DB exec failed",
            query: sql,
            cause: error,
          }),
      }).pipe(
        Effect.flatMap((response) => {
          if (response._tag === "Ok") return Effect.void
          return Effect.fail(
            new LocalDbQueryError({
              message: "Local DB exec failed",
              query: sql,
              cause: response.error,
            })
          )
        })
      )

    const runUnsafe = (
      sql: string,
      params: SqliteParams
    ): Effect.Effect<SqliteRunResult, LocalDbQueryError> =>
      Effect.tryPromise({
        try: () => send({ _tag: "Run", id: nextRequestId(), sql, params }),
        catch: (error) =>
          new LocalDbQueryError({
            message: "Local DB query failed",
            query: sql,
            cause: error,
          }),
      }).pipe(
        Effect.flatMap((response) => {
          if (response._tag === "Err") {
            return Effect.fail(
              new LocalDbQueryError({
                message: "Local DB query failed",
                query: sql,
                cause: response.error,
              })
            )
          }

          if (!isSqliteRunResult(response.value)) {
            return Effect.fail(
              new LocalDbQueryError({
                message: "Local DB returned invalid shape",
                query: sql,
                cause: response.value,
              })
            )
          }

          return Effect.succeed(response.value)
        })
      )

    const getUnsafe = <A, I>(
      sql: string,
      schema: Schema.Schema<A, I, never>,
      params: SqliteParams
    ): Effect.Effect<Option.Option<A>, LocalDbQueryError> =>
      Effect.tryPromise({
        try: () => send({ _tag: "Get", id: nextRequestId(), sql, params }),
        catch: (error) =>
          new LocalDbQueryError({
            message: "Local DB query failed",
            query: sql,
            cause: error,
          }),
      }).pipe(
        Effect.flatMap((response) => {
          if (response._tag === "Err") {
            return Effect.fail(
              new LocalDbQueryError({
                message: "Local DB query failed",
                query: sql,
                cause: response.error,
              })
            )
          }

          if (response.value === null) {
            return Effect.succeed(Option.none())
          }

          return Schema.decodeUnknown(schema)(response.value).pipe(
            Effect.map(Option.some),
            Effect.mapError((error) =>
              new LocalDbQueryError({
                message: "Local DB returned invalid shape",
                query: sql,
                cause: error,
              })
            )
          )
        })
      )

    const allUnsafe = <A, I>(
      sql: string,
      schema: Schema.Schema<A, I, never>,
      params: SqliteParams
    ): Effect.Effect<ReadonlyArray<A>, LocalDbQueryError> =>
      Effect.tryPromise({
        try: () => send({ _tag: "All", id: nextRequestId(), sql, params }),
        catch: (error) =>
          new LocalDbQueryError({
            message: "Local DB query failed",
            query: sql,
            cause: error,
          }),
      }).pipe(
        Effect.flatMap((response) => {
          if (response._tag === "Err") {
            return Effect.fail(
              new LocalDbQueryError({
                message: "Local DB query failed",
                query: sql,
                cause: response.error,
              })
            )
          }

          return Schema.decodeUnknown(Schema.Array(schema))(response.value).pipe(
            Effect.mapError((error) =>
              new LocalDbQueryError({
                message: "Local DB returned invalid shape",
                query: sql,
                cause: error,
              })
            )
          )
        }),
      )

    const exec = (sql: string): Effect.Effect<void, LocalDbQueryError> =>
      lock.withPermits(1)(execUnsafe(sql))

    const run = (
      sql: string,
      params: SqliteParams
    ): Effect.Effect<SqliteRunResult, LocalDbQueryError> =>
      lock.withPermits(1)(runUnsafe(sql, params))

    const get = <A, I>(
      sql: string,
      schema: Schema.Schema<A, I, never>,
      params: SqliteParams
    ): Effect.Effect<Option.Option<A>, LocalDbQueryError> =>
      lock.withPermits(1)(getUnsafe(sql, schema, params))

    const all = <A, I>(
      sql: string,
      schema: Schema.Schema<A, I, never>,
      params: SqliteParams
    ): Effect.Effect<ReadonlyArray<A>, LocalDbQueryError> =>
      lock.withPermits(1)(allUnsafe(sql, schema, params))

    const txClient = {
      exec: execUnsafe,
      run: runUnsafe,
      get: getUnsafe,
      all: allUnsafe,
    } as const satisfies Omit<LocalDbClient, "transaction">

    const transaction = <A, E>(
      runInTx: (tx: Omit<LocalDbClient, "transaction">) => Effect.Effect<A, E>
    ): Effect.Effect<A, E | LocalDbQueryError> =>
      lock.withPermits(1)(
        Effect.gen(function* () {
          yield* execUnsafe("BEGIN IMMEDIATE")

          const exit = yield* Effect.exit(runInTx(txClient))
          if (Exit.isSuccess(exit)) {
            yield* execUnsafe("COMMIT")
            return exit.value
          }

          const rollbackExit = yield* Effect.exit(execUnsafe("ROLLBACK"))
          if (Exit.isFailure(rollbackExit)) {
            return yield* Effect.failCause(
              Cause.sequential(exit.cause, rollbackExit.cause)
            )
          }

          return yield* Effect.failCause(exit.cause)
        })
      )

    return { exec, run, get, all, transaction }
  })

export class LocalDbService extends Effect.Service<LocalDbService>()("services/LocalDbService", {
  dependencies: [],
  effect: makeClient,
}) {}
