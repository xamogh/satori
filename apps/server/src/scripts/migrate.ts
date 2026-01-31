import { join } from "node:path"
import { FileSystem } from "@effect/platform"
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { Layer } from "effect"
import { PgClient } from "../db/pg-client"
import { DbError, MigrationError } from "../errors"

const schemaFilePath = join(__dirname, "../../sql/schema.sql")

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const db = yield* PgClient

  const sql = yield* fs.readFileString(schemaFilePath, "utf8").pipe(
    Effect.mapError(
      (cause) =>
        new MigrationError({
          message: "Failed to read schema.sql",
          cause,
        })
    )
  )

  yield* db.transaction((tx) => tx.query(sql)).pipe(
    Effect.asVoid,
    Effect.mapError(
      (cause) =>
        new DbError({
          message: "Migration failed",
          cause,
        })
    )
  )

  yield* Effect.sync(() => {
    console.log("Migration applied successfully.")
  })
})

const Live = Layer.mergeAll(NodeFileSystem.layer, PgClient.Default)

NodeRuntime.runMain(
  Effect.scoped(
    program.pipe(
      Effect.provide(Live),
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
      ),
      Effect.catchTag("EnvError", (error) =>
        Effect.sync(() => {
          console.error(error.message)
          process.exitCode = 1
        })
      )
    )
  )
)
