import { NodeRuntime } from "@effect/platform-node"
import { Effect, Option, Schema } from "effect"
import { UserRoleSchema } from "@satori/domain/auth/schemas"
import { PgClient } from "../db/pg-client"
import { DbError, EnvError } from "../errors"
import { hashPassword } from "../utils/password"

const usage = (): void => {
  console.error(
    [
      "Usage:",
      "  pnpm server:create-user -- --email <email> --password <password> [--role admin|staff|viewer]",
    ].join("\n")
  )
}

const getArg = (name: string): Option.Option<string> => {
  const index = process.argv.findIndex((arg) => arg === name)
  if (index < 0) return Option.none()
  const value = process.argv[index + 1]
  return typeof value === "string" ? Option.some(value) : Option.none()
}

const CreateUserRowSchema = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  role: UserRoleSchema,
})

const program = Effect.gen(function* () {
  const email = Option.getOrElse(getArg("--email"), () => "")
  const password = Option.getOrElse(getArg("--password"), () => "")
  const roleInput = Option.getOrElse(getArg("--role"), () => "staff")

  if (email.length === 0 || password.length === 0) {
    usage()
    process.exitCode = 1
    return
  }

  const role = yield* Schema.decodeUnknown(UserRoleSchema)(roleInput).pipe(
    Effect.mapError(
      (error) =>
        new EnvError({
          message: "Invalid role",
          cause: error,
        })
    )
  )

  const passwordHash = yield* hashPassword(password)

  const db = yield* PgClient
  const rows = yield* db
    .query(
      'insert into users (email, password_hash, role) values ($1, $2, $3) returning id, email, role',
      [email, passwordHash, role]
    )
    .pipe(
      Effect.map((result) => result.rows),
      Effect.mapError(
        (cause) =>
          new DbError({
            message: "Failed to insert user",
            cause,
          })
      )
    )

  const inserted = yield* Schema.decodeUnknown(Schema.Array(CreateUserRowSchema))(rows).pipe(
    Effect.mapError(
      (error) =>
        new DbError({
          message: "Inserted user but could not decode response",
          cause: error,
        })
    )
  )

  if (inserted.length === 0) {
    console.error("Inserted user but did not receive a row back")
    process.exitCode = 1
    return
  }

  const user = inserted[0]!
  console.log(`Created user ${user.email} (${user.role}) id=${user.id}`)
})

NodeRuntime.runMain(
  Effect.scoped(
    program.pipe(
      Effect.provide(PgClient.Default),
      Effect.catchTag("EnvError", (error) =>
        Effect.sync(() => {
          console.error(error.message)
          process.exitCode = 1
        })
      ),
      Effect.catchTag("PasswordHashError", (error) =>
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
  )
)
