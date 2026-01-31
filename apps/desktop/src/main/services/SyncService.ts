import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { Cause, Effect, Either, Option, Schema } from "effect"
import { AuthService } from "./AuthService"
import { LocalDbService } from "./LocalDbService"
import { getApiConfig } from "../utils/apiConfig"
import { SYNC_BATCH_SIZE, SYNC_INTERVAL_MS } from "../constants/sync"
import { BadRequest, InternalServerError, Unauthorized } from "@satori/api-contract/api/http-errors"
import {
  SyncOperationSchema,
  SyncRequestSchema,
  SyncResponseSchema,
  type SyncOperation,
  type SyncRequest,
  type SyncResponse,
  type SyncStatus,
} from "@satori/domain/sync/schemas"
import { ApiAuthError, type LocalDbQueryError } from "../errors"
import type { Attendance } from "@satori/domain/domain/attendance"
import type { Event } from "@satori/domain/domain/event"
import type { Person } from "@satori/domain/domain/person"
import type { Photo } from "@satori/domain/domain/photo"
import type { Registration } from "@satori/domain/domain/registration"

const nowMs = (): number => Date.now()

const CountRowSchema = Schema.Struct({
  count: Schema.Number,
})

const CursorRowSchema = Schema.Struct({
  cursorMs: Schema.Union(Schema.Number, Schema.Null),
})

const OutboxRowSchema = Schema.Struct({
  opId: Schema.String,
  bodyJson: Schema.String,
})

type OutboxRow = Schema.Schema.Type<typeof OutboxRowSchema>

const emptyStatus: SyncStatus = {
  lastAttemptAtMs: null,
  lastSuccessAtMs: null,
  lastError: null,
  pendingOutboxCount: 0,
}

const HttpErrorSchema = Schema.Union(Unauthorized, BadRequest, InternalServerError)

const opPlaceholderParams = (count: number): string =>
  Array.from({ length: count }, () => "?").join(",")

const makeSyncService = Effect.gen(function* () {
  const authService = yield* AuthService
  const db = yield* LocalDbService
  const client = yield* HttpClient.HttpClient

  let status: SyncStatus = emptyStatus
  let running = false

  const outboxCount = db
    .get("select count(*) as count from outbox", CountRowSchema, [])
    .pipe(
      Effect.map((row) => (Option.isNone(row) ? 0 : row.value.count))
    )

  const getCursor = db
    .get("select cursor_ms as cursorMs from sync_state where id = 1", CursorRowSchema, [])
    .pipe(Effect.map((row) => (Option.isNone(row) ? null : row.value.cursorMs)))

  const setCursor = (cursorMs: number): Effect.Effect<void, LocalDbQueryError> =>
    db.run("update sync_state set cursor_ms = ? where id = 1", [cursorMs]).pipe(
      Effect.asVoid
    )

  const readOutboxBatch = db.all(
    "select op_id as opId, body_json as bodyJson from outbox order by created_at_ms asc limit ?",
    OutboxRowSchema,
    [SYNC_BATCH_SIZE]
  )

  const deleteOutboxOps = (opIds: ReadonlyArray<string>): Effect.Effect<void, LocalDbQueryError> =>
    opIds.length === 0
      ? Effect.void
      : db
          .run(`delete from outbox where op_id in (${opPlaceholderParams(opIds.length)})`, opIds)
          .pipe(Effect.asVoid)

  const upsertEvent = (event: Event): Effect.Effect<void, LocalDbQueryError> =>
    db.run(
      `
insert into events (
  id, title, description, starts_at_ms, ends_at_ms, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?)
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
        event.serverModifiedAtMs,
      ]
    ).pipe(Effect.asVoid)

  const upsertPerson = (person: Person): Effect.Effect<void, LocalDbQueryError> =>
    db.run(
      `
insert into persons (
  id, display_name, email, phone, photo_id, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?)
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
        person.serverModifiedAtMs,
      ]
    ).pipe(Effect.asVoid)

  const upsertRegistration = (
    registration: Registration
  ): Effect.Effect<void, LocalDbQueryError> =>
    db.run(
      `
insert into registrations (
  id, event_id, person_id, status, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?)
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
        registration.serverModifiedAtMs,
      ]
    ).pipe(Effect.asVoid)

  const upsertAttendance = (
    attendance: Attendance
  ): Effect.Effect<void, LocalDbQueryError> =>
    db.run(
      `
insert into attendance (
  id, event_id, person_id, date, status, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?)
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
        attendance.serverModifiedAtMs,
      ]
    ).pipe(Effect.asVoid)

  const upsertPhoto = (photo: Photo): Effect.Effect<void, LocalDbQueryError> =>
    db.run(
      `
insert into photos (
  id, person_id, mime_type, bytes, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?)
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
        photo.bytes,
        photo.updatedAtMs,
        photo.deletedAtMs,
        photo.serverModifiedAtMs,
      ]
    ).pipe(Effect.asVoid)

  const applyChanges = (response: SyncResponse): Effect.Effect<void, LocalDbQueryError> =>
    db.transaction(
      Effect.forEach(response.changes.events, upsertEvent, { concurrency: 1 }).pipe(
        Effect.zipRight(
          Effect.forEach(response.changes.persons, upsertPerson, { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.registrations, upsertRegistration, {
            concurrency: 1,
          })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.attendance, upsertAttendance, {
            concurrency: 1,
          })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.photos, upsertPhoto, { concurrency: 1 })
        ),
        Effect.zipRight(setCursor(response.cursorMs)),
        Effect.zipRight(deleteOutboxOps(response.ackOpIds)),
        Effect.asVoid
      )
    )

  const decodeOutboxRow = (
    row: OutboxRow
  ): Effect.Effect<Option.Option<SyncOperation>, LocalDbQueryError> =>
    Effect.gen(function* () {
      const decoded = Schema.decodeUnknownEither(
        Schema.parseJson(SyncOperationSchema)
      )(row.bodyJson)

      if (Either.isLeft(decoded)) {
        yield* db.run("delete from outbox where op_id = ?", [row.opId]).pipe(
          Effect.asVoid
        )
        return Option.none()
      }

      return Option.some(decoded.right)
    })

  const readOperations = (
    rows: ReadonlyArray<OutboxRow>
  ): Effect.Effect<ReadonlyArray<SyncOperation>, LocalDbQueryError> =>
    Effect.forEach(rows, decodeOutboxRow, { concurrency: 1 }).pipe(
      Effect.map((values) =>
        values.flatMap((value) => (Option.isNone(value) ? [] : [value.value]))
      )
    )

  const syncAttempt = Effect.gen(function* () {
    const accessToken = yield* authService.getAccessToken
    const config = yield* getApiConfig()

    const cursor = yield* getCursor
    const outboxRows = yield* readOutboxBatch
    const operations = yield* readOperations(outboxRows)

    const request: SyncRequest =
      cursor === null ? { operations } : { cursorMs: cursor, operations }

    const url = `${config.baseUrl}/sync`
    const httpRequest = yield* HttpClientRequest.schemaBodyJson(SyncRequestSchema)(
      HttpClientRequest.acceptJson(
        HttpClientRequest.bearerToken(accessToken)(HttpClientRequest.post(url))
      ),
      request
    ).pipe(
      Effect.mapError(
        (cause) =>
          new ApiAuthError({
            message: "Invalid sync request",
            statusCode: 0,
            cause,
          })
      )
    )

    const response = yield* client.execute(httpRequest).pipe(
      Effect.mapError(
        (cause) =>
          new ApiAuthError({
            message: "Network error",
            statusCode: 0,
            cause,
          })
      )
    )

    const decoded = yield* HttpClientResponse.matchStatus(response, {
      "2xx": (ok) =>
        HttpClientResponse.schemaBodyJson(SyncResponseSchema)(ok).pipe(
          Effect.mapError(
            (cause) =>
              new ApiAuthError({
                message: "Invalid API response",
                statusCode: ok.status,
                cause,
              })
          )
        ),
      orElse: (notOk) =>
        HttpClientResponse.schemaBodyJson(HttpErrorSchema)(notOk).pipe(
          Effect.mapError(
            (cause) =>
              new ApiAuthError({
                message: "Invalid error response from API",
                statusCode: notOk.status,
                cause,
              })
          ),
          Effect.flatMap((error) =>
            Effect.fail(
              new ApiAuthError({
                message: error.message,
                statusCode: notOk.status,
                cause: error.cause,
              })
            )
          )
        ),
    })

    yield* applyChanges(decoded)
  })

  const refreshStatus = (lastError: string | null): Effect.Effect<SyncStatus, never> =>
    Effect.exit(outboxCount).pipe(
      Effect.map((exit) => {
        const pendingOutboxCount =
          exit._tag === "Success" ? exit.value : status.pendingOutboxCount

        status = {
          ...status,
          lastError,
          pendingOutboxCount,
        }

        return status
      })
    )

  const getStatus: Effect.Effect<SyncStatus, never> = Effect.suspend(() =>
    refreshStatus(status.lastError)
  )

  const syncNow: Effect.Effect<SyncStatus, never> = Effect.gen(function* () {
    if (running) {
      return yield* getStatus
    }

    running = true
    status = { ...status, lastAttemptAtMs: nowMs() }

    const exit = yield* Effect.exit(syncAttempt)
    if (exit._tag === "Success") {
      status = { ...status, lastSuccessAtMs: nowMs() }
      running = false
      return yield* refreshStatus(null)
    }

    const message = Cause.pretty(exit.cause)
    running = false
    return yield* refreshStatus(message)
  })

  yield* Effect.sync(() => {
    setInterval(() => {
      Effect.runPromise(syncNow).catch(() => undefined)
    }, SYNC_INTERVAL_MS)
  })

  return { getStatus, syncNow } as const
})

export class SyncService extends Effect.Service<SyncService>()("services/SyncService", {
  dependencies: [FetchHttpClient.layer, AuthService.Default, LocalDbService.Default],
  effect: makeSyncService,
}) {}
