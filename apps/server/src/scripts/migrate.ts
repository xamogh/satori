import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import { Pool } from "pg"
import { toErrorCause } from "@satori/shared/utils/errorCause"
import { DATABASE_URL_ENV } from "../constants/env"
import { DbError, EnvError, MigrationError } from "../errors"

const getEnvString = (key: string): Effect.Effect<string, EnvError> =>
  Effect.suspend(() => {
    const value = process.env[key]
    if (typeof value !== "string" || value.length === 0) {
      return Effect.fail(
        new EnvError({
          message: `Missing ${key}`,
          cause: toErrorCause(`Missing env var ${key}`),
        })
      )
    }
    return Effect.succeed(value)
  })

const schemaFilePath = (): string =>
  join(__dirname, "../../sql/schema.sql")

const readSchemaSql = (): Effect.Effect<string, MigrationError> =>
  Effect.tryPromise({
    try: () => readFile(schemaFilePath(), { encoding: "utf8" }),
    catch: (error) =>
      new MigrationError({
        message: "Failed to read schema.sql",
        cause: toErrorCause(error),
      }),
  })

const withPool = <A, E>(
  databaseUrl: string,
  use: (pool: Pool) => Effect.Effect<A, E>
): Effect.Effect<A, E | DbError> =>
  Effect.scoped(
    Effect.acquireRelease(
      Effect.sync(() => new Pool({ connectionString: databaseUrl })),
      (pool) =>
        Effect.tryPromise({
          try: () => pool.end(),
          catch: (error) =>
            new DbError({
              message: "Failed to close DB pool",
              cause: toErrorCause(error),
            }),
        }).pipe(Effect.orElse(() => Effect.void))
    ).pipe(Effect.flatMap(use))
  )

const applySchema = (
  pool: Pool,
  sql: string
): Effect.Effect<void, DbError> =>
  Effect.tryPromise({
    try: async () => {
      const client = await pool.connect()
      try {
        await client.query("begin")
        await client.query(sql)
        await client.query("commit")
      } catch (error) {
        try {
          await client.query("rollback")
        } catch {
          // ignore rollback errors
        }
        throw error
      } finally {
        client.release()
      }
    },
    catch: (error) =>
      new DbError({ message: "Migration failed", cause: toErrorCause(error) }),
  })

const program = Effect.gen(function* () {
  const databaseUrl = yield* getEnvString(DATABASE_URL_ENV)
  const sql = yield* readSchemaSql()

  yield* withPool(databaseUrl, (pool) => applySchema(pool, sql))
  yield* Effect.sync(() => {
    console.log("Migration applied successfully.")
  })
})

Effect.runPromise(
  program.pipe(
    Effect.catchTag("EnvError", (error) =>
      Effect.sync(() => {
        console.error(error.message)
        process.exitCode = 1
      })
    ),
    Effect.catchTag("MigrationError", (error) =>
      Effect.sync(() => {
        console.error(error.message)
        process.exitCode = 1
      })
    ),
    Effect.catchTag("DbError", (error) =>
      Effect.sync(() => {
        console.error(error.message)
        process.exitCode = 1
      })
    )
  )
).catch((error) => {
  console.error(toErrorCause(error).message)
  process.exitCode = 1
})
