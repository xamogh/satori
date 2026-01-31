import { app } from "electron"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import Database from "better-sqlite3"
import { Cause, Context, Effect, Exit, Layer, Option, Schema } from "effect"
import { LOCAL_DB_FILENAME, LOCAL_DB_PRAGMAS, LOCAL_DB_SCHEMA_SQL } from "../constants/localDb"
import { LocalDbMigrationError, LocalDbOpenError, LocalDbQueryError } from "../errors"
import { toErrorCause } from "@satori/shared/utils/errorCause"

export type SqliteValue = string | number | bigint | Uint8Array | null

type SqliteParams = ReadonlyArray<SqliteValue>
type SqliteRow = Record<string, SqliteValue>

const toParamsArray = (params: SqliteParams): Array<SqliteValue> => Array.from(params)

const userDataDir = (): string => app.getPath("userData")

const dbFilePath = (): string => join(userDataDir(), LOCAL_DB_FILENAME)

export class LocalDbService extends Context.Tag("LocalDbService")<
  LocalDbService,
  {
    readonly exec: (sql: string) => Effect.Effect<void, LocalDbQueryError>
    readonly run: (
      sql: string,
      params: SqliteParams
    ) => Effect.Effect<Database.RunResult, LocalDbQueryError>
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
      effect: Effect.Effect<A, E>
    ) => Effect.Effect<A, E | LocalDbQueryError>
  }
>() {}

const makeClient = Effect.gen(function* () {
  const dataDir = userDataDir()

  yield* Effect.try({
    try: () => {
      mkdirSync(dataDir, { recursive: true })
    },
    catch: (error) =>
      new LocalDbOpenError({
        message: "Failed to create app data directory",
        path: dataDir,
        cause: toErrorCause(error),
      }),
  })

  const filePath = dbFilePath()

  const db = yield* Effect.try({
    try: () => new Database(filePath),
    catch: (error) =>
      new LocalDbOpenError({
        message: "Failed to open local database",
        path: filePath,
        cause: toErrorCause(error),
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
          cause: toErrorCause(error),
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
        cause: toErrorCause(error),
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
          cause: toErrorCause(error),
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
          cause: toErrorCause(error),
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
            cause: toErrorCause(error),
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
            cause: toErrorCause(error),
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
            cause: toErrorCause(error),
          }),
      })

      return yield* Schema.decodeUnknown(Schema.Array(schema))(raw).pipe(
        Effect.mapError((error) =>
          new LocalDbQueryError({
            message: "Local DB returned invalid shape",
            query: sql,
            cause: toErrorCause(error),
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

  return { exec, run, get, all, transaction }
})

export const LocalDbServiceLive = Layer.effect(LocalDbService, makeClient)
