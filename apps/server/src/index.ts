import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import { Effect, Option, Schema } from "effect"
import { Pool, types } from "pg"
import {
  ApiResultSchema,
  ApiRoutes,
  makeErr,
  makeOk,
  type ApiResult,
  type AuthSession,
} from "@satori/shared/api/contract"
import { AuthSignInRequestSchema, UserRoleSchema } from "@satori/shared/auth/schemas"
import { AttendanceSchema } from "@satori/shared/domain/attendance"
import { EventSchema } from "@satori/shared/domain/event"
import { PersonSchema } from "@satori/shared/domain/person"
import { PhotoSchema } from "@satori/shared/domain/photo"
import { RegistrationSchema } from "@satori/shared/domain/registration"
import { SyncRequestSchema, SyncResponseSchema, type SyncRequest } from "@satori/shared/sync/schemas"
import { toErrorCause } from "@satori/shared/utils/errorCause"
import type { Json } from "@satori/shared/utils/json"
import { DATABASE_URL_ENV, JWT_EXPIRES_IN_SECONDS_ENV, JWT_SECRET_ENV, PORT_ENV } from "./constants/env"
import {
  BodyReadError,
  DbError,
  EnvError,
  JsonParseError,
  JwtError,
  PasswordVerifyError,
  RequestDecodeError,
  UnauthorizedError,
} from "./errors"
import { verifyPassword } from "./utils/password"
import { signJwt, verifyJwt } from "./utils/jwt"

types.setTypeParser(20, (value: string) => Number(value))

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

const parsePort = (value: string): Option.Option<number> => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536
    ? Option.some(parsed)
    : Option.none()
}

const parsePositiveInt = (value: string): Option.Option<number> => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Option.some(parsed) : Option.none()
}

const readBodyText = (req: IncomingMessage): Effect.Effect<string, BodyReadError> =>
  Effect.tryPromise({
    try: () =>
      new Promise((resolve, reject) => {
        const chunks: Array<Uint8Array> = []

        req.on("data", (chunk: Uint8Array) => {
          chunks.push(chunk)
        })

        req.on("end", () => {
          resolve(Buffer.concat(chunks.map(Buffer.from)).toString("utf8"))
        })

        req.on("error", reject)
      }),
    catch: (error) =>
      new BodyReadError({
        message: "Failed to read request body",
        cause: toErrorCause(error),
      }),
  })

const readJsonBody = (
  req: IncomingMessage
): Effect.Effect<Json, BodyReadError | JsonParseError> =>
  Effect.flatMap(readBodyText(req), (text) =>
    Effect.try({
      try: () => JSON.parse(text) as Json,
      catch: (error) =>
        new JsonParseError({ message: "Invalid JSON", cause: toErrorCause(error) }),
    })
  )

const UserRowSchema = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  passwordHash: Schema.String,
  role: UserRoleSchema,
})

type UserRow = Schema.Schema.Type<typeof UserRowSchema>

const fetchUserByEmail = (
  pool: Pool,
  email: string
): Effect.Effect<Option.Option<UserRow>, DbError> =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: async () => {
        const result = await pool.query(
          'select id, email, password_hash as "passwordHash", role from users where email = $1 limit 1',
          [email]
        )
        const raw: unknown = result.rows
        return raw
      },
      catch: (error) =>
        new DbError({ message: "Failed to query user", cause: toErrorCause(error) }),
    })

    const decoded = yield* Schema.decodeUnknown(
      Schema.Array(UserRowSchema)
    )(rows).pipe(
      Effect.mapError(
        (error) =>
          new DbError({
            message: "Invalid user row shape",
            cause: toErrorCause(error),
          })
      )
    )

    return decoded.length > 0 ? Option.some(decoded[0]!) : Option.none()
  })

const requireUser = (
  maybeUser: Option.Option<UserRow>
): Effect.Effect<UserRow, UnauthorizedError> =>
  Option.isNone(maybeUser)
    ? Effect.fail(new UnauthorizedError({ message: "Invalid email or password" }))
    : Effect.succeed(maybeUser.value)

const decodeSignInRequest = (
  body: Json
): Effect.Effect<Schema.Schema.Type<typeof AuthSignInRequestSchema>, RequestDecodeError> =>
  Schema.decodeUnknown(AuthSignInRequestSchema)(body).pipe(
    Effect.mapError((error) =>
      new RequestDecodeError({
        message: `Invalid request: ${toErrorCause(error).message}`,
        cause: toErrorCause(error),
      })
    )
  )

const bearerTokenFromHeader = (req: IncomingMessage): Option.Option<string> => {
  const header = req.headers.authorization
  if (typeof header !== "string") {
    return Option.none()
  }

  const prefix = "Bearer "
  if (!header.startsWith(prefix)) {
    return Option.none()
  }

  const token = header.slice(prefix.length).trim()
  return token.length > 0 ? Option.some(token) : Option.none()
}

const requireBearerToken = (req: IncomingMessage): Effect.Effect<string, UnauthorizedError> =>
  Effect.suspend(() => {
    const maybeToken = bearerTokenFromHeader(req)
    return Option.isNone(maybeToken)
      ? Effect.fail(new UnauthorizedError({ message: "Missing bearer token" }))
      : Effect.succeed(maybeToken.value)
  })

const requireValidJwt = (
  jwtSecret: string,
  req: IncomingMessage
): Effect.Effect<void, UnauthorizedError> =>
  Effect.flatMap(requireBearerToken(req), (token) =>
    verifyJwt(jwtSecret, token).pipe(
      Effect.asVoid,
      Effect.mapError(
        () =>
          new UnauthorizedError({
            message: "Invalid or expired token",
          })
      )
    )
  )

const decodeSyncRequest = (
  body: Json
): Effect.Effect<SyncRequest, RequestDecodeError> =>
  Schema.decodeUnknown(SyncRequestSchema)(body).pipe(
    Effect.mapError((error) =>
      new RequestDecodeError({
        message: `Invalid request: ${toErrorCause(error).message}`,
        cause: toErrorCause(error),
      })
    )
  )

const makeAuthSession = (
  jwtSecret: string,
  expiresInSeconds: number,
  user: UserRow
): Effect.Effect<AuthSession, JwtError> =>
  Effect.gen(function* () {
    const expSeconds = Math.floor(Date.now() / 1000) + expiresInSeconds
    const accessToken = yield* signJwt(jwtSecret, {
      sub: user.id,
      email: user.email,
      role: user.role,
      exp: expSeconds,
    })

    return {
      accessToken,
      userId: user.id,
      email: user.email,
      role: user.role,
      expiresAtMs: expSeconds * 1000,
    }
  })

const signInHandler = (
  pool: Pool,
  jwtSecret: string,
  expiresInSeconds: number,
  req: IncomingMessage
): Effect.Effect<
  AuthSession,
  BodyReadError | JsonParseError | RequestDecodeError | DbError | UnauthorizedError | PasswordVerifyError | JwtError
> =>
  Effect.gen(function* () {
    const body = yield* readJsonBody(req)
    const request = yield* decodeSignInRequest(body)
    const user = yield* fetchUserByEmail(pool, request.email).pipe(
      Effect.flatMap(requireUser)
    )

    const passwordOk = yield* verifyPassword(request.password, user.passwordHash)
    if (!passwordOk) {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Invalid email or password" })
      )
    }

    return yield* makeAuthSession(jwtSecret, expiresInSeconds, user)
  })

const signInRoute = (
  pool: Pool,
  jwtSecret: string,
  expiresInSeconds: number,
  req: IncomingMessage
): Effect.Effect<ApiResult<AuthSession>, never> =>
  signInHandler(pool, jwtSecret, expiresInSeconds, req).pipe(
    Effect.map(makeOk),
    Effect.catchTag("BodyReadError", (error) =>
      Effect.succeed(makeErr({ _tag: "RequestDecodeError", message: error.message }))
    ),
    Effect.catchTag("JsonParseError", (error) =>
      Effect.succeed(makeErr({ _tag: "RequestDecodeError", message: error.message }))
    ),
    Effect.catchTag("RequestDecodeError", (error) =>
      Effect.succeed(makeErr({ _tag: "RequestDecodeError", message: error.message }))
    ),
    Effect.catchTag("UnauthorizedError", (error) =>
      Effect.succeed(makeErr({ _tag: "Unauthorized", message: error.message }))
    ),
    Effect.catchTag("PasswordVerifyError", (error) =>
      Effect.succeed(makeErr({ _tag: "HandlerError", message: error.message }))
    ),
    Effect.catchTag("DbError", (error) =>
      Effect.succeed(makeErr({ _tag: "HandlerError", message: error.message }))
    ),
    Effect.catchTag("JwtError", (error) =>
      Effect.succeed(makeErr({ _tag: "HandlerError", message: error.message }))
    )
  )

const applySyncOperation = async (
  client: {
    query: (
      text: string,
      params?: ReadonlyArray<
        string | number | boolean | null | Uint8Array | Buffer
      >
    ) => Promise<{ rowCount: number }>
  },
  operation: Schema.Schema.Type<typeof SyncRequestSchema>["operations"][number],
  serverNowMs: number
): Promise<void> => {
  switch (operation._tag) {
    case "EventUpsert": {
      const { event } = operation
      await client.query(
        `
insert into events (
  id, title, description, starts_at_ms, ends_at_ms, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6, $7, $8)
on conflict(id) do update set
  title = excluded.title,
  description = excluded.description,
  starts_at_ms = excluded.starts_at_ms,
  ends_at_ms = excluded.ends_at_ms,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= events.updated_at_ms
`,
        [
          event.id,
          event.title,
          event.description,
          event.startsAtMs,
          event.endsAtMs,
          event.updatedAtMs,
          event.deletedAtMs,
          serverNowMs,
        ]
      )
      return
    }
    case "EventDelete": {
      await client.query(
        `
insert into events (
  id, title, description, starts_at_ms, ends_at_ms, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, null, 0, null, $3, $3, $4)
on conflict(id) do update set
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= events.updated_at_ms
`,
        [operation.eventId, "[deleted]", operation.deletedAtMs, serverNowMs]
      )
      return
    }
    case "PersonUpsert": {
      const { person } = operation
      await client.query(
        `
insert into persons (
  id, display_name, email, phone, photo_id, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6, $7, $8)
on conflict(id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  phone = excluded.phone,
  photo_id = excluded.photo_id,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= persons.updated_at_ms
`,
        [
          person.id,
          person.displayName,
          person.email,
          person.phone,
          person.photoId,
          person.updatedAtMs,
          person.deletedAtMs,
          serverNowMs,
        ]
      )
      return
    }
    case "PersonDelete": {
      await client.query(
        `
insert into persons (
  id, display_name, email, phone, photo_id, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, null, null, null, $3, $3, $4)
on conflict(id) do update set
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= persons.updated_at_ms
`,
        [operation.personId, "[deleted]", operation.deletedAtMs, serverNowMs]
      )
      return
    }
    case "RegistrationUpsert": {
      const { registration } = operation
      await client.query(
        `
insert into registrations (
  id, event_id, person_id, status, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6, $7)
on conflict(id) do update set
  event_id = excluded.event_id,
  person_id = excluded.person_id,
  status = excluded.status,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= registrations.updated_at_ms
`,
        [
          registration.id,
          registration.eventId,
          registration.personId,
          registration.status,
          registration.updatedAtMs,
          registration.deletedAtMs,
          serverNowMs,
        ]
      )
      return
    }
    case "RegistrationDelete": {
      await client.query(
        `
update registrations
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
        [operation.registrationId, operation.deletedAtMs, serverNowMs]
      )
      return
    }
    case "AttendanceUpsert": {
      const { attendance } = operation
      await client.query(
        `
insert into attendance (
  id, event_id, person_id, date, status, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6, $7, $8)
on conflict(id) do update set
  event_id = excluded.event_id,
  person_id = excluded.person_id,
  date = excluded.date,
  status = excluded.status,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= attendance.updated_at_ms
`,
        [
          attendance.id,
          attendance.eventId,
          attendance.personId,
          attendance.date,
          attendance.status,
          attendance.updatedAtMs,
          attendance.deletedAtMs,
          serverNowMs,
        ]
      )
      return
    }
    case "AttendanceDelete": {
      await client.query(
        `
update attendance
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
        [operation.attendanceId, operation.deletedAtMs, serverNowMs]
      )
      return
    }
    case "PhotoUpsert": {
      const { photo } = operation
      await client.query(
        `
insert into photos (
  id, person_id, mime_type, bytes, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6, $7)
on conflict(id) do update set
  person_id = excluded.person_id,
  mime_type = excluded.mime_type,
  bytes = excluded.bytes,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= photos.updated_at_ms
`,
        [
          photo.id,
          photo.personId,
          photo.mimeType,
          Buffer.from(photo.bytes),
          photo.updatedAtMs,
          photo.deletedAtMs,
          serverNowMs,
        ]
      )
      return
    }
    case "PhotoDelete": {
      await client.query(
        `
update photos
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
        [operation.photoId, operation.deletedAtMs, serverNowMs]
      )
      return
    }
  }
}

const syncHandler = (
  pool: Pool,
  jwtSecret: string,
  req: IncomingMessage
): Effect.Effect<
  Schema.Schema.Type<typeof SyncResponseSchema>,
  BodyReadError | JsonParseError | RequestDecodeError | DbError | UnauthorizedError
> =>
  Effect.gen(function* () {
    yield* requireValidJwt(jwtSecret, req)

    const body = yield* readJsonBody(req)
    const request = yield* decodeSyncRequest(body)

    const serverNowMs = Date.now()
    const cursorMs = typeof request.cursorMs === "number" ? request.cursorMs : 0
    const ackOpIds = request.operations.map((op) => op.opId)

    const changes = yield* Effect.tryPromise({
      try: async () => {
        const client = await pool.connect()
        try {
          await client.query("begin")

          for (const operation of request.operations) {
            const inserted = await client.query(
              "insert into sync_ops (op_id, applied_at_ms) values ($1, $2) on conflict do nothing returning op_id",
              [operation.opId, serverNowMs]
            )

            if (inserted.rowCount === 0) {
              continue
            }

            await applySyncOperation(client, operation, serverNowMs)
          }

          const eventsRows = (
            await client.query(
              `
select
  id,
  title,
  description,
  starts_at_ms as "startsAtMs",
  ends_at_ms as "endsAtMs",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from events
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
          ).rows

          const personsRows = (
            await client.query(
              `
select
  id,
  display_name as "displayName",
  email,
  phone,
  photo_id as "photoId",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from persons
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
          ).rows

          const registrationsRows = (
            await client.query(
              `
select
  id,
  event_id as "eventId",
  person_id as "personId",
  status,
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from registrations
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
          ).rows

          const attendanceRows = (
            await client.query(
              `
select
  id,
  event_id as "eventId",
  person_id as "personId",
  date,
  status,
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from attendance
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
          ).rows

          const photosRows = (
            await client.query(
              `
select
  id,
  person_id as "personId",
  mime_type as "mimeType",
  bytes,
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from photos
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
          ).rows

          await client.query("commit")

          const eventsDecoded = Schema.decodeUnknownEither(Schema.Array(EventSchema))(eventsRows)
          if (eventsDecoded._tag === "Left") {
            throw new DbError({
              message: "Invalid events row shape",
              cause: toErrorCause(eventsDecoded.left),
            })
          }

          const personsDecoded = Schema.decodeUnknownEither(Schema.Array(PersonSchema))(personsRows)
          if (personsDecoded._tag === "Left") {
            throw new DbError({
              message: "Invalid persons row shape",
              cause: toErrorCause(personsDecoded.left),
            })
          }

          const registrationsDecoded = Schema.decodeUnknownEither(
            Schema.Array(RegistrationSchema)
          )(registrationsRows)
          if (registrationsDecoded._tag === "Left") {
            throw new DbError({
              message: "Invalid registrations row shape",
              cause: toErrorCause(registrationsDecoded.left),
            })
          }

          const attendanceDecoded = Schema.decodeUnknownEither(
            Schema.Array(AttendanceSchema)
          )(attendanceRows)
          if (attendanceDecoded._tag === "Left") {
            throw new DbError({
              message: "Invalid attendance row shape",
              cause: toErrorCause(attendanceDecoded.left),
            })
          }

          const photosDecoded = Schema.decodeUnknownEither(Schema.Array(PhotoSchema))(photosRows)
          if (photosDecoded._tag === "Left") {
            throw new DbError({
              message: "Invalid photos row shape",
              cause: toErrorCause(photosDecoded.left),
            })
          }

          return {
            events: eventsDecoded.right,
            persons: personsDecoded.right,
            registrations: registrationsDecoded.right,
            attendance: attendanceDecoded.right,
            photos: photosDecoded.right,
          }
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
        error instanceof DbError
          ? error
          : new DbError({ message: "Sync failed", cause: toErrorCause(error) }),
    })

    return {
      cursorMs: serverNowMs,
      ackOpIds,
      changes,
    }
  })

const encodeSyncOkResult = (
  response: Schema.Schema.Type<typeof SyncResponseSchema>
): Effect.Effect<ApiResult<Schema.Schema.Encoded<typeof SyncResponseSchema>>, DbError> =>
  Schema.encode(ApiResultSchema(SyncResponseSchema))(makeOk(response)).pipe(
    Effect.mapError(
      (error) =>
        new DbError({
          message: "Invalid sync response",
          cause: toErrorCause(error),
        })
    )
  )

const syncRoute = (
  pool: Pool,
  jwtSecret: string,
  req: IncomingMessage
): Effect.Effect<ApiResult<Schema.Schema.Encoded<typeof SyncResponseSchema>>, never> =>
  syncHandler(pool, jwtSecret, req).pipe(
    Effect.flatMap(encodeSyncOkResult),
    Effect.catchTag("UnauthorizedError", (error) =>
      Effect.succeed(makeErr({ _tag: "Unauthorized", message: error.message }))
    ),
    Effect.catchTag("BodyReadError", (error) =>
      Effect.succeed(makeErr({ _tag: "RequestDecodeError", message: error.message }))
    ),
    Effect.catchTag("JsonParseError", (error) =>
      Effect.succeed(makeErr({ _tag: "RequestDecodeError", message: error.message }))
    ),
    Effect.catchTag("RequestDecodeError", (error) =>
      Effect.succeed(makeErr({ _tag: "RequestDecodeError", message: error.message }))
    ),
    Effect.catchTag("DbError", (error) =>
      Effect.succeed(makeErr({ _tag: "HandlerError", message: error.message }))
    )
  )

const writeJson = <A>(
  res: ServerResponse,
  status: number,
  payload: ApiResult<A>
): void => {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(payload))
}

const statusCodeForResult = <A>(result: ApiResult<A>): number => {
  if (result._tag === "Ok") return 200
  switch (result.error._tag) {
    case "Unauthorized":
      return 401
    case "RequestDecodeError":
      return 400
    default:
      return 500
  }
}

const handleRequest = (
  service: {
    readonly pool: Pool
    readonly jwtSecret: string
    readonly expiresInSeconds: number
  },
  req: IncomingMessage,
  res: ServerResponse
): void => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  const path = url.pathname

  if (req.method === "GET" && path === "/health") {
    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method === "POST" && path === ApiRoutes.authSignIn.path) {
    Effect.runPromise(signInRoute(service.pool, service.jwtSecret, service.expiresInSeconds, req)).then(
      (result) => writeJson(res, statusCodeForResult(result), result),
      (error) =>
        writeJson(
          res,
          500,
          makeErr({ _tag: "HandlerError", message: toErrorCause(error).message })
        )
    )
    return
  }

  if (req.method === "POST" && path === ApiRoutes.sync.path) {
    Effect.runPromise(syncRoute(service.pool, service.jwtSecret, req)).then(
      (result) => writeJson(res, statusCodeForResult(result), result),
      (error) =>
        writeJson(
          res,
          500,
          makeErr({ _tag: "HandlerError", message: toErrorCause(error).message })
        )
    )
    return
  }

  writeJson(res, 404, makeErr({ _tag: "HandlerError", message: "Not found" }))
}

const makeServiceFromEnv = Effect.gen(function* () {
  const databaseUrl = yield* getEnvString(DATABASE_URL_ENV)
  const jwtSecret = yield* getEnvString(JWT_SECRET_ENV)

  const expiresEnv = process.env[JWT_EXPIRES_IN_SECONDS_ENV]
  const expiresInSeconds =
    typeof expiresEnv === "string"
      ? Option.getOrElse(parsePositiveInt(expiresEnv), () => 259_200)
      : 259_200

  const portEnv = process.env[PORT_ENV]
  const port =
    typeof portEnv === "string"
      ? Option.getOrElse(parsePort(portEnv), () => 4000)
      : 4000

  const pool = new Pool({ connectionString: databaseUrl })

  return { pool, jwtSecret, expiresInSeconds, port }
})

Effect.runPromise(
  makeServiceFromEnv.pipe(
    Effect.tap(({ port }) =>
      Effect.sync(() => {
        console.log(`satori auth service starting (port=${port})`)
      })
    ),
    Effect.flatMap((service) =>
      Effect.try({
        try: () => {
          const server = createServer((req, res) => handleRequest(service, req, res))
          server.listen(service.port, () => {
            console.log(`listening on http://localhost:${service.port}`)
          })
        },
        catch: (error) =>
          new EnvError({
            message: "Failed to start server",
            cause: toErrorCause(error),
          }),
      })
    )
  )
).catch((error) => {
  console.error(toErrorCause(error).message)
  process.exitCode = 1
})
