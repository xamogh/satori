import { randomUUID } from "node:crypto"
import { Effect, Option, Schema } from "effect"
import { LocalDbService } from "./LocalDbService"
import { EntityNotFoundError, OutboxEncodeError } from "../errors"
import type { LocalDbQueryError } from "../errors"
import {
  EventSchema,
  type Event,
  type EventCreateInput,
  type EventDeleteInput,
  type EventListQuery,
  type EventUpdateInput,
} from "@satori/domain/domain/event"
import {
  PersonSchema,
  type Person,
  type PersonCreateInput,
  type PersonDeleteInput,
  type PersonListQuery,
  type PersonUpdateInput,
} from "@satori/domain/domain/person"
import {
  RegistrationSchema,
  type Registration,
  type RegistrationCreateInput,
  type RegistrationDeleteInput,
  type RegistrationListQuery,
  type RegistrationUpdateInput,
} from "@satori/domain/domain/registration"
import {
  AttendanceSchema,
  type Attendance,
  type AttendanceCreateInput,
  type AttendanceDeleteInput,
  type AttendanceListQuery,
  type AttendanceUpdateInput,
} from "@satori/domain/domain/attendance"
import { PhotoSchema, type Photo, type PhotoCreateInput, type PhotoDeleteInput } from "@satori/domain/domain/photo"
import { SyncOperationSchema } from "@satori/domain/sync/schemas"

const nowMs = (): number => Date.now()

const escapeLike = (query: string): string =>
  query
    .replaceAll("~", "~~")
    .replaceAll("%", "~%")
    .replaceAll("_", "~_")

const likeQuery = (query: string): string => `%${escapeLike(query)}%`

const encodeSyncOperationJson = (
  op: Schema.Schema.Type<typeof SyncOperationSchema>
): Effect.Effect<string, OutboxEncodeError> =>
  Schema.encode(SyncOperationSchema)(op).pipe(
    Effect.map((encoded) => JSON.stringify(encoded)),
    Effect.mapError(
      (error) =>
        new OutboxEncodeError({
          message: "Failed to encode outbox operation",
          cause: error,
        })
    )
  )

const makeDataService = Effect.gen(function* () {
  const db = yield* LocalDbService

  const insertOutbox = (
    opId: string,
    json: string
  ): Effect.Effect<void, LocalDbQueryError> =>
    db.run(
      "insert into outbox (op_id, body_json, created_at_ms) values (?, ?, ?)",
      [opId, json, nowMs()]
    ).pipe(Effect.asVoid)

  const eventsList = ({ query }: EventListQuery): Effect.Effect<ReadonlyArray<Event>, LocalDbQueryError> => {
    const where =
      typeof query === "string"
        ? "where deleted_at_ms is null and (title like ? escape '~' or description like ? escape '~')"
        : "where deleted_at_ms is null"

    const params =
      typeof query === "string"
        ? [likeQuery(query), likeQuery(query)]
        : []

    return db.all(
      `
select
  id,
  title,
  description,
  starts_at_ms as startsAtMs,
  ends_at_ms as endsAtMs,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from events
${where}
order by starts_at_ms desc
`,
      EventSchema,
      params
    )
  }

  const eventsCreate = (
    input: EventCreateInput
  ): Effect.Effect<Event, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const event: Event = {
        id: randomUUID(),
        title: input.title,
        description: input.description,
        startsAtMs: input.startsAtMs,
        endsAtMs: input.endsAtMs,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "EventUpsert",
        opId: randomUUID(),
        event,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
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
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return event
    })

  const eventsUpdate = (
    input: EventUpdateInput
  ): Effect.Effect<Event, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const event: Event = {
        id: input.id,
        title: input.title,
        description: input.description,
        startsAtMs: input.startsAtMs,
        endsAtMs: input.endsAtMs,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "EventUpsert",
        opId: randomUUID(),
        event,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
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
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return event
    })

  const eventsDelete = (
    input: EventDeleteInput
  ): Effect.Effect<"ok", LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: "EventDelete",
        opId: randomUUID(),
        eventId: id,
        deletedAtMs,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
            "update events set deleted_at_ms = ?, updated_at_ms = ? where id = ?",
            [deletedAtMs, deletedAtMs, id]
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return "ok" as const
    })

  const personsList = ({ query }: PersonListQuery): Effect.Effect<ReadonlyArray<Person>, LocalDbQueryError> => {
    const where =
      typeof query === "string"
        ? "where deleted_at_ms is null and (display_name like ? escape '~' or email like ? escape '~')"
        : "where deleted_at_ms is null"

    const params =
      typeof query === "string" ? [likeQuery(query), likeQuery(query)] : []

    return db.all(
      `
select
  id,
  display_name as displayName,
  email,
  phone,
  photo_id as photoId,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from persons
${where}
order by display_name asc
`,
      PersonSchema,
      params
    )
  }

  const personsCreate = (
    input: PersonCreateInput
  ): Effect.Effect<Person, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const person: Person = {
        id: randomUUID(),
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        photoId: null,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "PersonUpsert",
        opId: randomUUID(),
        person,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
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
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return person
    })

  const personsUpdate = (
    input: PersonUpdateInput
  ): Effect.Effect<Person, LocalDbQueryError | EntityNotFoundError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const current = yield* db.get(
        "select id, display_name as displayName, email, phone, photo_id as photoId, updated_at_ms as updatedAtMs, deleted_at_ms as deletedAtMs, server_modified_at_ms as serverModifiedAtMs from persons where id = ?",
        PersonSchema,
        [input.id]
      )

      if (Option.isNone(current)) {
        return yield* Effect.fail(
          new EntityNotFoundError({
            message: "Person not found",
            entity: "Person",
            id: input.id,
          })
        )
      }

      const person: Person = {
        ...current.value,
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        photoId: input.photoId,
        updatedAtMs: nowMs(),
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "PersonUpsert",
        opId: randomUUID(),
        person,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
            `
update persons
set display_name = ?, email = ?, phone = ?, photo_id = ?, updated_at_ms = ?, deleted_at_ms = ?, server_modified_at_ms = ?
where id = ?
`,
            [
              person.displayName,
              person.email,
              person.phone,
              person.photoId,
              person.updatedAtMs,
              person.deletedAtMs,
              person.serverModifiedAtMs,
              person.id,
            ]
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return person
    })

  const personsDelete = (
    input: PersonDeleteInput
  ): Effect.Effect<"ok", LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: "PersonDelete",
        opId: randomUUID(),
        personId: id,
        deletedAtMs,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run("update persons set deleted_at_ms = ?, updated_at_ms = ? where id = ?", [
            deletedAtMs,
            deletedAtMs,
            id,
          ])
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return "ok" as const
    })

  const registrationsList = ({
    eventId,
    personId,
  }: RegistrationListQuery): Effect.Effect<ReadonlyArray<Registration>, LocalDbQueryError> => {
    const filter = [
      "deleted_at_ms is null",
      typeof eventId === "string" ? "event_id = ?" : null,
      typeof personId === "string" ? "person_id = ?" : null,
    ].filter((x): x is string => typeof x === "string")

    const where = filter.length > 0 ? `where ${filter.join(" and ")}` : ""
    const params = [
      ...(typeof eventId === "string" ? [eventId] : []),
      ...(typeof personId === "string" ? [personId] : []),
    ]

    return db.all(
      `
select
  id,
  event_id as eventId,
  person_id as personId,
  status,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from registrations
${where}
order by updated_at_ms desc
`,
      RegistrationSchema,
      params
    )
  }

  const registrationsCreate = (
    input: RegistrationCreateInput
  ): Effect.Effect<Registration, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const registration: Registration = {
        id: randomUUID(),
        eventId: input.eventId,
        personId: input.personId,
        status: input.status,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "RegistrationUpsert",
        opId: randomUUID(),
        registration,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
            `
insert into registrations (
  id, event_id, person_id, status, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  event_id = excluded.event_id,
  person_id = excluded.person_id,
  status = excluded.status,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return registration
    })

  const registrationsUpdate = (
    input: RegistrationUpdateInput
  ): Effect.Effect<Registration, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const registration: Registration = {
        id: input.id,
        eventId: input.eventId,
        personId: input.personId,
        status: input.status,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "RegistrationUpsert",
        opId: randomUUID(),
        registration,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
            `
insert into registrations (
  id, event_id, person_id, status, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  event_id = excluded.event_id,
  person_id = excluded.person_id,
  status = excluded.status,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return registration
    })

  const registrationsDelete = ({
    id,
  }: RegistrationDeleteInput): Effect.Effect<"ok", LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: "RegistrationDelete",
        opId: randomUUID(),
        registrationId: id,
        deletedAtMs,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run("update registrations set deleted_at_ms = ?, updated_at_ms = ? where id = ?", [
            deletedAtMs,
            deletedAtMs,
            id,
          ])
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return "ok" as const
    })

  const attendanceList = ({
    eventId,
    personId,
  }: AttendanceListQuery): Effect.Effect<ReadonlyArray<Attendance>, LocalDbQueryError> => {
    const filter = [
      "deleted_at_ms is null",
      typeof eventId === "string" ? "event_id = ?" : null,
      typeof personId === "string" ? "person_id = ?" : null,
    ].filter((x): x is string => typeof x === "string")

    const where = filter.length > 0 ? `where ${filter.join(" and ")}` : ""
    const params = [
      ...(typeof eventId === "string" ? [eventId] : []),
      ...(typeof personId === "string" ? [personId] : []),
    ]

    return db.all(
      `
select
  id,
  event_id as eventId,
  person_id as personId,
  date,
  status,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from attendance
${where}
order by date desc
`,
      AttendanceSchema,
      params
    )
  }

  const attendanceCreate = (
    input: AttendanceCreateInput
  ): Effect.Effect<Attendance, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const attendance: Attendance = {
        id: randomUUID(),
        eventId: input.eventId,
        personId: input.personId,
        date: input.date,
        status: input.status,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "AttendanceUpsert",
        opId: randomUUID(),
        attendance,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
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
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return attendance
    })

  const attendanceUpdate = (
    input: AttendanceUpdateInput
  ): Effect.Effect<Attendance, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const attendance: Attendance = {
        id: input.id,
        eventId: input.eventId,
        personId: input.personId,
        date: input.date,
        status: input.status,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const syncOp = {
        _tag: "AttendanceUpsert",
        opId: randomUUID(),
        attendance,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run(
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
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return attendance
    })

  const attendanceDelete = (
    input: AttendanceDeleteInput
  ): Effect.Effect<"ok", LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: "AttendanceDelete",
        opId: randomUUID(),
        attendanceId: id,
        deletedAtMs,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run("update attendance set deleted_at_ms = ?, updated_at_ms = ? where id = ?", [
            deletedAtMs,
            deletedAtMs,
            id,
          ])
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return "ok" as const
    })

  const photosCreate = (
    input: PhotoCreateInput
  ): Effect.Effect<Photo, LocalDbQueryError | EntityNotFoundError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const photo: Photo = {
        id: randomUUID(),
        personId: input.personId,
        mimeType: input.mimeType,
        bytes: input.bytes,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const photoSyncOp = {
        _tag: "PhotoUpsert",
        opId: randomUUID(),
        photo,
      } as const

      const photoOpJson = yield* encodeSyncOperationJson(photoSyncOp)

      const updatedPerson = yield* db.get(
        `
select
  id,
  display_name as displayName,
  email,
  phone,
  photo_id as photoId,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from persons
where id = ?
`,
        PersonSchema,
        [input.personId]
      )

      if (Option.isNone(updatedPerson)) {
        return yield* Effect.fail(
          new EntityNotFoundError({
            message: "Person not found",
            entity: "Person",
            id: input.personId,
          })
        )
      }

      const person: Person = {
        ...updatedPerson.value,
        photoId: photo.id,
        updatedAtMs: nowMs(),
        deletedAtMs: null,
        serverModifiedAtMs: null,
      }

      const personSyncOp = {
        _tag: "PersonUpsert",
        opId: randomUUID(),
        person,
      } as const

      const personOpJson = yield* encodeSyncOperationJson(personSyncOp)

      yield* db.transaction(
        db
          .run(
            `
insert into photos (
  id, person_id, mime_type, bytes, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  person_id = excluded.person_id,
  mime_type = excluded.mime_type,
  bytes = excluded.bytes,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms
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
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(
              db.run("update persons set photo_id = ?, updated_at_ms = ? where id = ?", [
                photo.id,
                person.updatedAtMs,
                person.id,
              ]).pipe(Effect.asVoid)
            ),
            Effect.zipRight(insertOutbox(photoSyncOp.opId, photoOpJson)),
            Effect.zipRight(insertOutbox(personSyncOp.opId, personOpJson))
          )
      )

      return photo
    })

  const photosDelete = (
    input: PhotoDeleteInput
  ): Effect.Effect<"ok", LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: "PhotoDelete",
        opId: randomUUID(),
        photoId: id,
        deletedAtMs,
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction(
        db
          .run("update photos set deleted_at_ms = ?, updated_at_ms = ? where id = ?", [
            deletedAtMs,
            deletedAtMs,
            id,
          ])
          .pipe(
            Effect.asVoid,
            Effect.zipRight(insertOutbox(syncOp.opId, opJson))
          )
      )

      return "ok" as const
    })

  const photosGet = (
    id: string
  ): Effect.Effect<Photo, LocalDbQueryError | EntityNotFoundError> =>
    Effect.gen(function* () {
      const row = yield* db.get(
        `
select
  id,
  person_id as personId,
  mime_type as mimeType,
  bytes,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from photos
where id = ?
`,
        PhotoSchema,
        [id]
      )

      if (Option.isNone(row)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ message: "Photo not found", entity: "Photo", id })
        )
      }

      return row.value
    })

  return {
    eventsList,
    eventsCreate,
    eventsUpdate,
    eventsDelete,
    personsList,
    personsCreate,
    personsUpdate,
    personsDelete,
    registrationsList,
    registrationsCreate,
    registrationsUpdate,
    registrationsDelete,
    attendanceList,
    attendanceCreate,
    attendanceUpdate,
    attendanceDelete,
    photosCreate,
    photosDelete,
    photosGet,
  } as const
})

export class DataService extends Effect.Service<DataService>()("services/DataService", {
  dependencies: [LocalDbService.Default],
  effect: makeDataService,
}) {}
