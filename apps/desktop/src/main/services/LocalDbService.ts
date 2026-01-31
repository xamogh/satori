import { app } from "electron"
import { join } from "node:path"
import Database from "better-sqlite3"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Cause, Effect, Exit, Option, Schema } from "effect"
import { LOCAL_DB_FILENAME, LOCAL_DB_PRAGMAS, LOCAL_DB_SCHEMA_SQL } from "../constants/localDb"
import { LocalDbMigrationError, LocalDbOpenError, LocalDbQueryError } from "../errors"

export type SqliteValue = string | number | bigint | Uint8Array | null

type SqliteParams = ReadonlyArray<SqliteValue>
type SqliteRow = Record<string, SqliteValue>

const toParamsArray = (params: SqliteParams): Array<SqliteValue> => Array.from(params)

const userDataDir = (): string => app.getPath("userData")

const dbFilePath = (): string => join(userDataDir(), LOCAL_DB_FILENAME)

const makeClient = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const dataDir = userDataDir()

  yield* fs.makeDirectory(dataDir, { recursive: true }).pipe(
    Effect.mapError(
      (cause) =>
        new LocalDbOpenError({
          message: "Failed to create app data directory",
          path: dataDir,
          cause,
        })
    )
  )

  const filePath = dbFilePath()

  const db = yield* Effect.try({
    try: () => new Database(filePath),
    catch: (error) =>
      new LocalDbOpenError({
        message: "Failed to open local database",
        path: filePath,
        cause: error,
      }),
  })

  for (const pragma of LOCAL_DB_PRAGMAS) {
    yield* Effect.try({
      try: () => {
        db.pragma(pragma)
      },
      catch: (error) =>
        new LocalDbMigrationError({
          message: `Failed to apply PRAGMA: ${pragma}`,
          cause: error,
        }),
    })
  }

  yield* Effect.try({
    try: () => {
      db.exec(LOCAL_DB_SCHEMA_SQL)
    },
    catch: (error) =>
      new LocalDbMigrationError({
        message: "Failed to migrate local database schema",
        cause: error,
      }),
  })

  const exec = (sql: string): Effect.Effect<void, LocalDbQueryError> =>
    Effect.try({
      try: () => {
        db.exec(sql)
      },
      catch: (error) =>
        new LocalDbQueryError({
          message: "Local DB exec failed",
          query: sql,
          cause: error,
        }),
    })

  const run = (
    sql: string,
    params: SqliteParams
  ): Effect.Effect<Database.RunResult, LocalDbQueryError> =>
    Effect.try({
      try: () => db.prepare<Array<SqliteValue>>(sql).run(...toParamsArray(params)),
      catch: (error) =>
        new LocalDbQueryError({
          message: "Local DB query failed",
          query: sql,
          cause: error,
        }),
    })

  const get = <A, I>(
    sql: string,
    schema: Schema.Schema<A, I, never>,
    params: SqliteParams
  ): Effect.Effect<Option.Option<A>, LocalDbQueryError> =>
    Effect.gen(function* () {
      const raw = yield* Effect.try({
        try: () => {
          return db
            .prepare<Array<SqliteValue>, SqliteRow>(sql)
            .get(...toParamsArray(params))
        },
        catch: (error) =>
          new LocalDbQueryError({
            message: "Local DB query failed",
            query: sql,
            cause: error,
          }),
      })

      if (typeof raw === "undefined") {
        return Option.none()
      }

      const decoded = yield* Schema.decodeUnknown(schema)(raw).pipe(
        Effect.mapError((error) =>
          new LocalDbQueryError({
            message: "Local DB returned invalid shape",
            query: sql,
            cause: error,
          })
        )
      )

      return Option.some(decoded)
    })

  const all = <A, I>(
    sql: string,
    schema: Schema.Schema<A, I, never>,
    params: SqliteParams
  ): Effect.Effect<ReadonlyArray<A>, LocalDbQueryError> =>
    Effect.gen(function* () {
      const raw = yield* Effect.try({
        try: () => {
          return db
            .prepare<Array<SqliteValue>, SqliteRow>(sql)
            .all(...toParamsArray(params))
        },
        catch: (error) =>
          new LocalDbQueryError({
            message: "Local DB query failed",
            query: sql,
            cause: error,
          }),
      })

      return yield* Schema.decodeUnknown(Schema.Array(schema))(raw).pipe(
        Effect.mapError((error) =>
          new LocalDbQueryError({
            message: "Local DB returned invalid shape",
            query: sql,
            cause: error,
          })
        )
      )
    })

  const transaction = <A, E>(
    effect: Effect.Effect<A, E>
  ): Effect.Effect<A, E | LocalDbQueryError> =>
    Effect.gen(function* () {
      yield* exec("BEGIN IMMEDIATE")

      const exit = yield* Effect.exit(effect)
      if (Exit.isSuccess(exit)) {
        yield* exec("COMMIT")
        return exit.value
      }

      const rollbackExit = yield* Effect.exit(exec("ROLLBACK"))
      if (Exit.isFailure(rollbackExit)) {
        return yield* Effect.failCause(
          Cause.sequential(exit.cause, rollbackExit.cause)
        )
      }

      return yield* Effect.failCause(exit.cause)
    })

  return { exec, run, get, all, transaction } as const
})

export class LocalDbService extends Effect.Service<LocalDbService>()("services/LocalDbService", {
  dependencies: [NodeFileSystem.layer],
  effect: makeClient,
}) {}
