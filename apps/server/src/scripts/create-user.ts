import { Effect, Option, Schema } from "effect"
import { Pool } from "pg"
import { UserRoleSchema } from "@satori/shared/auth/schemas"
import { toErrorCause } from "@satori/shared/utils/errorCause"
import { DATABASE_URL_ENV } from "../constants/env"
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
          cause: toErrorCause(error),
        })
    )
  )

  const databaseUrl = yield* getEnvString(DATABASE_URL_ENV)
  const pool = new Pool({ connectionString: databaseUrl })

  const passwordHash = yield* hashPassword(password)

  const rows = yield* Effect.tryPromise({
    try: async () => {
      const result = await pool.query(
        'insert into users (email, password_hash, role) values ($1, $2, $3) returning id, email, role',
        [email, passwordHash, role]
      )
      const raw: unknown = result.rows
      return raw
    },
    catch: (error) =>
      new DbError({ message: "Failed to insert user", cause: toErrorCause(error) }),
  })

  const inserted = yield* Schema.decodeUnknown(Schema.Array(CreateUserRowSchema))(rows).pipe(
    Effect.mapError(
      (error) =>
        new DbError({
          message: "Inserted user but could not decode response",
          cause: toErrorCause(error),
        })
    )
  )

  yield* Effect.tryPromise({
    try: async () => {
      await pool.end()
    },
    catch: (error) =>
      new DbError({ message: "Failed to close DB connection", cause: toErrorCause(error) }),
  })

  if (inserted.length === 0) {
    console.error("Inserted user but did not receive a row back")
    process.exitCode = 1
    return
  }

  const user = inserted[0]!
  console.log(`Created user ${user.email} (${user.role}) id=${user.id}`)
})

Effect.runPromise(
  program.pipe(
    Effect.catchTag("EnvError", (error) =>
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
