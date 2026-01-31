import { Effect, Schema } from "effect"
import type { SyncOperation } from "@satori/domain/sync/schemas"
import { AttendanceSchema } from "@satori/domain/domain/attendance"
import { EventSchema } from "@satori/domain/domain/event"
import { PersonSchema } from "@satori/domain/domain/person"
import { PhotoSchema } from "@satori/domain/domain/photo"
import { RegistrationSchema } from "@satori/domain/domain/registration"
import type { SyncChanges } from "@satori/domain/sync/schemas"
import { PgClient } from "../db/pg-client"
import { DbError } from "../errors"

type Tx = {
  readonly query: (
    text: string,
    params?: ReadonlyArray<
      string | number | boolean | null | Uint8Array | Buffer
    >
  ) => Effect.Effect<{ readonly rowCount: number; readonly rows: ReadonlyArray<unknown> }, DbError>
}

export class SyncRepository extends Effect.Service<SyncRepository>()(
  "repository/SyncRepository",
  {
    dependencies: [PgClient.Default],
    effect: Effect.gen(function* () {
      const db = yield* PgClient

      const decodeEvents = Schema.decodeUnknown(Schema.Array(EventSchema))
      const decodePersons = Schema.decodeUnknown(Schema.Array(PersonSchema))
      const decodeRegistrations = Schema.decodeUnknown(Schema.Array(RegistrationSchema))
      const decodeAttendance = Schema.decodeUnknown(Schema.Array(AttendanceSchema))
      const decodePhotos = Schema.decodeUnknown(Schema.Array(PhotoSchema))

      const applyOperation = (
        tx: Tx,
        operation: SyncOperation,
        serverNowMs: number
      ): Effect.Effect<void, DbError> => {
        switch (operation._tag) {
          case "EventUpsert": {
            const { event } = operation
            return tx
              .query(
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
              .pipe(Effect.asVoid)
          }
          case "EventDelete": {
            return tx
              .query(
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
              .pipe(Effect.asVoid)
          }
          case "PersonUpsert": {
            const { person } = operation
            return tx
              .query(
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
              .pipe(Effect.asVoid)
          }
          case "PersonDelete": {
            return tx
              .query(
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
              .pipe(Effect.asVoid)
          }
          case "RegistrationUpsert": {
            const { registration } = operation
            return tx
              .query(
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
              .pipe(Effect.asVoid)
          }
          case "RegistrationDelete": {
            return tx
              .query(
                `
update registrations
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.registrationId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "AttendanceUpsert": {
            const { attendance } = operation
            return tx
              .query(
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
              .pipe(Effect.asVoid)
          }
          case "AttendanceDelete": {
            return tx
              .query(
                `
update attendance
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.attendanceId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "PhotoUpsert": {
            const { photo } = operation
            return tx
              .query(
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
              .pipe(Effect.asVoid)
          }
          case "PhotoDelete": {
            return tx
              .query(
                `
update photos
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.photoId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
        }
      }

      const getChangesSince = (
        tx: Tx,
        cursorMs: number
      ): Effect.Effect<SyncChanges, DbError> =>
        Effect.gen(function* () {
          const eventsRows = yield* tx
            .query(
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
            .pipe(Effect.map((result) => result.rows))

          const personsRows = yield* tx
            .query(
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
            .pipe(Effect.map((result) => result.rows))

          const registrationsRows = yield* tx
            .query(
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
            .pipe(Effect.map((result) => result.rows))

          const attendanceRows = yield* tx
            .query(
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
            .pipe(Effect.map((result) => result.rows))

          const photosRows = yield* tx
            .query(
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
            .pipe(Effect.map((result) => result.rows))

          const events = yield* decodeEvents(eventsRows).pipe(
            Effect.mapError(
                  (error) =>
                    new DbError({
                      message: "Invalid events row shape",
                      cause: error,
                    })
            )
          )

          const persons = yield* decodePersons(personsRows).pipe(
            Effect.mapError(
                  (error) =>
                    new DbError({
                      message: "Invalid persons row shape",
                      cause: error,
                    })
            )
          )

          const registrations = yield* decodeRegistrations(registrationsRows).pipe(
            Effect.mapError(
                  (error) =>
                    new DbError({
                      message: "Invalid registrations row shape",
                      cause: error,
                    })
            )
          )

          const attendance = yield* decodeAttendance(attendanceRows).pipe(
            Effect.mapError(
                  (error) =>
                    new DbError({
                      message: "Invalid attendance row shape",
                      cause: error,
                    })
            )
          )

          const photos = yield* decodePhotos(photosRows).pipe(
            Effect.mapError(
                  (error) =>
                    new DbError({
                      message: "Invalid photos row shape",
                      cause: error,
                    })
            )
          )

          return { events, persons, registrations, attendance, photos } as const
        })

      const applyOperationsAndGetChanges = (params: {
        readonly cursorMs: number
        readonly operations: ReadonlyArray<SyncOperation>
        readonly serverNowMs: number
      }): Effect.Effect<SyncChanges, DbError> =>
        db.transaction((tx) =>
          Effect.gen(function* () {
            for (const operation of params.operations) {
              const inserted = yield* tx.query(
                "insert into sync_ops (op_id, applied_at_ms) values ($1, $2) on conflict do nothing returning op_id",
                [operation.opId, params.serverNowMs]
              )

              if (inserted.rowCount === 0) {
                continue
              }

              yield* applyOperation(tx, operation, params.serverNowMs)
            }

            return yield* getChangesSince(tx, params.cursorMs)
          })
        )

      return { applyOperationsAndGetChanges } as const
    }),
  }
) {}
