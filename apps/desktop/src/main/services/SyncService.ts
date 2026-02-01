import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform"
import { Cause, Effect, Either, Option, Schema } from "effect"
import { AuthService } from "./AuthService"
import { LocalDbService, type LocalDbClient } from "./LocalDbService"
import { getApiConfig } from "../utils/apiConfig"
import { SYNC_BATCH_SIZE, SYNC_INTERVAL_MS } from "../constants/sync"
import {
  BadRequest,
  InternalServerError,
  Unauthorized,
} from "@satori/api-contract/api/http-errors"
import {
  SyncOperationSchema,
  SyncRequestSchema,
  SyncResponseSchema,
  type SyncOperation,
  type SyncRequest,
  type SyncResponse,
  type SyncStatus,
} from "@satori/domain/sync/schemas"
import { ApiAuthError, LocalDbQueryError } from "../errors"
import type { Attendance } from "@satori/domain/domain/attendance"
import type { Empowerment } from "@satori/domain/domain/empowerment"
import type { Event, EventAttendee, EventDay } from "@satori/domain/domain/event"
import type { Group, PersonGroup } from "@satori/domain/domain/group"
import type { Guru } from "@satori/domain/domain/guru"
import type { MahakramaHistory, MahakramaStep } from "@satori/domain/domain/mahakrama"
import type { Person } from "@satori/domain/domain/person"
import type { Photo } from "@satori/domain/domain/photo"
import { toSqliteBoolean } from "../utils/sqlite"

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

const HttpErrorSchema = Schema.Union(
  Unauthorized,
  BadRequest,
  InternalServerError
)

const opPlaceholderParams = (count: number): string =>
  Array.from({ length: count }, () => "?").join(",")

const stringifyUnknown = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const formatSyncError = (cause: Cause.Cause<unknown>): string => {
  const failure = Cause.failureOption(cause)
  if (Option.isSome(failure)) {
    const error = failure.value
    if (error instanceof ApiAuthError) {
      const details = stringifyUnknown(error.cause)
      return details.length > 0
        ? `${error.message} (status ${error.statusCode}): ${details}`
        : `${error.message} (status ${error.statusCode})`
    }
    if (error instanceof LocalDbQueryError) {
      return error.message
    }
    if (error instanceof Error) {
      return error.message
    }
    return stringifyUnknown(error)
  }
  return Cause.pretty(cause)
}

const logSyncError = (cause: Cause.Cause<unknown>): void => {
  const failure = Cause.failureOption(cause)
  if (Option.isSome(failure)) {
    const error = failure.value
    if (error instanceof ApiAuthError) {
      console.error("Sync API error", {
        message: error.message,
        statusCode: error.statusCode,
        cause: error.cause,
      })
      return
    }
    if (error instanceof LocalDbQueryError) {
      console.error("Sync local DB error", {
        message: error.message,
        query: error.query,
        cause: error.cause,
      })
      return
    }
    console.error("Sync error", error)
    return
  }
  console.error("Sync failed", Cause.pretty(cause))
}

const makeSyncService = Effect.gen(function* () {
  const authService = yield* AuthService
  const db = yield* LocalDbService
  const client = yield* HttpClient.HttpClient

  type DbClient = Omit<LocalDbClient, "transaction">

  let status: SyncStatus = emptyStatus
  let running = false

  const outboxCount = db
    .get("select count(*) as count from outbox", CountRowSchema, [])
    .pipe(Effect.map((row) => (Option.isNone(row) ? 0 : row.value.count)))

  const getCursor = db
    .get("select cursor_ms as cursorMs from sync_state where id = 1", CursorRowSchema, [])
    .pipe(Effect.map((row) => (Option.isNone(row) ? null : row.value.cursorMs)))

  const setCursor = (
    client: DbClient,
    cursorMs: number
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run("update sync_state set cursor_ms = ? where id = 1", [cursorMs])
      .pipe(Effect.asVoid)

  const readOutboxBatch = db.all(
    "select op_id as opId, body_json as bodyJson from outbox order by created_at_ms asc limit ?",
    OutboxRowSchema,
    [SYNC_BATCH_SIZE]
  )

  const deleteOutboxOps = (
    client: DbClient,
    opIds: ReadonlyArray<string>
  ): Effect.Effect<void, LocalDbQueryError> =>
    opIds.length === 0
      ? Effect.void
      : client
          .run(
            `delete from outbox where op_id in (${opPlaceholderParams(opIds.length)})`,
            opIds
          )
          .pipe(Effect.asVoid)

  const upsertEvent = (
    client: DbClient,
    event: Event
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into events (
  id,
  parent_event_id,
  name,
  description,
  registration_mode,
  status,
  starts_at_ms,
  ends_at_ms,
  empowerment_id,
  guru_id,
  updated_at_ms,
  deleted_at_ms,
  server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  parent_event_id = excluded.parent_event_id,
  name = excluded.name,
  description = excluded.description,
  registration_mode = excluded.registration_mode,
  status = excluded.status,
  starts_at_ms = excluded.starts_at_ms,
  ends_at_ms = excluded.ends_at_ms,
  empowerment_id = excluded.empowerment_id,
  guru_id = excluded.guru_id,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= events.updated_at_ms
`,
        [
          event.id,
          event.parentEventId,
          event.name,
          event.description,
          event.registrationMode,
          event.status,
          event.startsAtMs,
          event.endsAtMs,
          event.empowermentId,
          event.guruId,
          event.updatedAtMs,
          event.deletedAtMs,
          event.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertEventDay = (
    client: DbClient,
    eventDay: EventDay
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into event_days (
  id, event_id, day_number, date_ms, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  event_id = excluded.event_id,
  day_number = excluded.day_number,
  date_ms = excluded.date_ms,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= event_days.updated_at_ms
`,
        [
          eventDay.id,
          eventDay.eventId,
          eventDay.dayNumber,
          eventDay.dateMs,
          eventDay.updatedAtMs,
          eventDay.deletedAtMs,
          eventDay.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertEventAttendee = (
    client: DbClient,
    attendee: EventAttendee
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into event_attendees (
  id,
  event_id,
  person_id,
  registration_mode,
  registered_at_ms,
  registered_by,
  registered_for_day_id,
  notes,
  is_cancelled,
  attendance_override_status,
  attendance_override_note,
  updated_at_ms,
  deleted_at_ms,
  server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  event_id = excluded.event_id,
  person_id = excluded.person_id,
  registration_mode = excluded.registration_mode,
  registered_at_ms = excluded.registered_at_ms,
  registered_by = excluded.registered_by,
  registered_for_day_id = excluded.registered_for_day_id,
  notes = excluded.notes,
  is_cancelled = excluded.is_cancelled,
  attendance_override_status = excluded.attendance_override_status,
  attendance_override_note = excluded.attendance_override_note,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= event_attendees.updated_at_ms
`,
        [
          attendee.id,
          attendee.eventId,
          attendee.personId,
          attendee.registrationMode,
          attendee.registeredAtMs,
          attendee.registeredBy,
          attendee.registeredForDayId,
          attendee.notes,
          toSqliteBoolean(attendee.isCancelled),
          attendee.attendanceOverrideStatus,
          attendee.attendanceOverrideNote,
          attendee.updatedAtMs,
          attendee.deletedAtMs,
          attendee.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertPerson = (
    client: DbClient,
    person: Person
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into persons (
  id,
  first_name,
  middle_name,
  last_name,
  gender,
  year_of_birth,
  email,
  phone1,
  phone2,
  address,
  country,
  nationality,
  language_preference,
  notes,
  person_code,
  referred_by,
  occupation,
  person_type,
  title,
  refuge_name,
  year_of_refuge,
  year_of_refuge_calendar_type,
  is_sangha_member,
  center_id,
  is_krama_instructor,
  krama_instructor_person_id,
  photo_id,
  updated_at_ms,
  deleted_at_ms,
  server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  first_name = excluded.first_name,
  middle_name = excluded.middle_name,
  last_name = excluded.last_name,
  gender = excluded.gender,
  year_of_birth = excluded.year_of_birth,
  email = excluded.email,
  phone1 = excluded.phone1,
  phone2 = excluded.phone2,
  address = excluded.address,
  country = excluded.country,
  nationality = excluded.nationality,
  language_preference = excluded.language_preference,
  notes = excluded.notes,
  person_code = excluded.person_code,
  referred_by = excluded.referred_by,
  occupation = excluded.occupation,
  person_type = excluded.person_type,
  title = excluded.title,
  refuge_name = excluded.refuge_name,
  year_of_refuge = excluded.year_of_refuge,
  year_of_refuge_calendar_type = excluded.year_of_refuge_calendar_type,
  is_sangha_member = excluded.is_sangha_member,
  center_id = excluded.center_id,
  is_krama_instructor = excluded.is_krama_instructor,
  krama_instructor_person_id = excluded.krama_instructor_person_id,
  photo_id = excluded.photo_id,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= persons.updated_at_ms
`,
        [
          person.id,
          person.firstName,
          person.middleName,
          person.lastName,
          person.gender,
          person.yearOfBirth,
          person.email,
          person.phone1,
          person.phone2,
          person.address,
          person.country,
          person.nationality,
          person.languagePreference,
          person.notes,
          person.personCode,
          person.referredBy,
          person.occupation,
          person.personType,
          person.title,
          person.refugeName,
          person.yearOfRefuge,
          person.yearOfRefugeCalendarType,
          toSqliteBoolean(person.isSanghaMember),
          person.centerId,
          toSqliteBoolean(person.isKramaInstructor),
          person.kramaInstructorPersonId,
          person.photoId,
          person.updatedAtMs,
          person.deletedAtMs,
          person.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertAttendance = (
    client: DbClient,
    attendance: Attendance
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into event_day_attendance (
  id,
  event_attendee_id,
  event_day_id,
  status,
  checked_in_at_ms,
  checked_in_by,
  updated_at_ms,
  deleted_at_ms,
  server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  event_attendee_id = excluded.event_attendee_id,
  event_day_id = excluded.event_day_id,
  status = excluded.status,
  checked_in_at_ms = excluded.checked_in_at_ms,
  checked_in_by = excluded.checked_in_by,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= event_day_attendance.updated_at_ms
`,
        [
          attendance.id,
          attendance.eventAttendeeId,
          attendance.eventDayId,
          attendance.status,
          attendance.checkedInAtMs,
          attendance.checkedInBy,
          attendance.updatedAtMs,
          attendance.deletedAtMs,
          attendance.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertGroup = (
    client: DbClient,
    group: Group
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into groups (
  id, name, description, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= groups.updated_at_ms
`,
        [
          group.id,
          group.name,
          group.description,
          group.updatedAtMs,
          group.deletedAtMs,
          group.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertPersonGroup = (
    client: DbClient,
    personGroup: PersonGroup
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into person_groups (
  id, group_id, person_id, joined_at_ms, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  group_id = excluded.group_id,
  person_id = excluded.person_id,
  joined_at_ms = excluded.joined_at_ms,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= person_groups.updated_at_ms
`,
        [
          personGroup.id,
          personGroup.groupId,
          personGroup.personId,
          personGroup.joinedAtMs,
          personGroup.updatedAtMs,
          personGroup.deletedAtMs,
          personGroup.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertEmpowerment = (
    client: DbClient,
    empowerment: Empowerment
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into empowerments (
  id,
  name,
  description,
  class,
  type,
  form,
  prerequisites,
  major_empowerment,
  updated_at_ms,
  deleted_at_ms,
  server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  class = excluded.class,
  type = excluded.type,
  form = excluded.form,
  prerequisites = excluded.prerequisites,
  major_empowerment = excluded.major_empowerment,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= empowerments.updated_at_ms
`,
        [
          empowerment.id,
          empowerment.name,
          empowerment.description,
          empowerment.className,
          empowerment.type,
          empowerment.form,
          empowerment.prerequisites,
          toSqliteBoolean(empowerment.majorEmpowerment),
          empowerment.updatedAtMs,
          empowerment.deletedAtMs,
          empowerment.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertGuru = (
    client: DbClient,
    guru: Guru
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into gurus (
  id, name, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?)
on conflict(id) do update set
  name = excluded.name,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= gurus.updated_at_ms
`,
        [
          guru.id,
          guru.name,
          guru.updatedAtMs,
          guru.deletedAtMs,
          guru.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertMahakramaStep = (
    client: DbClient,
    step: MahakramaStep
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into mahakrama_steps (
  id,
  step_id,
  step_name,
  sequence_number,
  group_id,
  group_name,
  description,
  updated_at_ms,
  deleted_at_ms,
  server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  step_id = excluded.step_id,
  step_name = excluded.step_name,
  sequence_number = excluded.sequence_number,
  group_id = excluded.group_id,
  group_name = excluded.group_name,
  description = excluded.description,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= mahakrama_steps.updated_at_ms
`,
        [
          step.id,
          step.stepId,
          step.stepName,
          step.sequenceNumber,
          step.groupId,
          step.groupName,
          step.description,
          step.updatedAtMs,
          step.deletedAtMs,
          step.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertMahakramaHistory = (
    client: DbClient,
    history: MahakramaHistory
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run(
        `
insert into mahakrama_history (
  id,
  person_id,
  mahakrama_step_id,
  start_date_ms,
  end_date_ms,
  status,
  mahakrama_instructor_person_id,
  completion_notes,
  updated_at_ms,
  deleted_at_ms,
  server_modified_at_ms
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  person_id = excluded.person_id,
  mahakrama_step_id = excluded.mahakrama_step_id,
  start_date_ms = excluded.start_date_ms,
  end_date_ms = excluded.end_date_ms,
  status = excluded.status,
  mahakrama_instructor_person_id = excluded.mahakrama_instructor_person_id,
  completion_notes = excluded.completion_notes,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms,
  server_modified_at_ms = excluded.server_modified_at_ms
where excluded.updated_at_ms >= mahakrama_history.updated_at_ms
`,
        [
          history.id,
          history.personId,
          history.mahakramaStepId,
          history.startDateMs,
          history.endDateMs,
          history.status,
          history.mahakramaInstructorPersonId,
          history.completionNotes,
          history.updatedAtMs,
          history.deletedAtMs,
          history.serverModifiedAtMs,
        ]
      )
      .pipe(Effect.asVoid)

  const upsertPhoto = (
    client: DbClient,
    photo: Photo
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
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
      )
      .pipe(Effect.asVoid)

  const applyChanges = (
    response: SyncResponse
  ): Effect.Effect<void, LocalDbQueryError> =>
    db.transaction((tx) =>
      Effect.forEach(response.changes.events, (event) => upsertEvent(tx, event), {
        concurrency: 1,
      }).pipe(
        Effect.zipRight(
          Effect.forEach(response.changes.eventDays, (eventDay) =>
            upsertEventDay(tx, eventDay), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.eventAttendees, (attendee) =>
            upsertEventAttendee(tx, attendee), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.persons, (person) =>
            upsertPerson(tx, person), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.attendance, (attendance) =>
            upsertAttendance(tx, attendance), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.groups, (group) =>
            upsertGroup(tx, group), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.personGroups, (personGroup) =>
            upsertPersonGroup(tx, personGroup), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.empowerments, (empowerment) =>
            upsertEmpowerment(tx, empowerment), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.gurus, (guru) => upsertGuru(tx, guru), {
            concurrency: 1,
          })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.mahakramaSteps, (step) =>
            upsertMahakramaStep(tx, step), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.mahakramaHistory, (history) =>
            upsertMahakramaHistory(tx, history), { concurrency: 1 })
        ),
        Effect.zipRight(
          Effect.forEach(response.changes.photos, (photo) => upsertPhoto(tx, photo), {
            concurrency: 1,
          })
        ),
        Effect.zipRight(setCursor(tx, response.cursorMs)),
        Effect.zipRight(deleteOutboxOps(tx, response.ackOpIds)),
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
    const start = nowMs()

    const exit = yield* syncAttempt.pipe(Effect.exit)
    const end = nowMs()

    running = false

    if (exit._tag === "Failure") {
      logSyncError(exit.cause)
    }

    const lastError = exit._tag === "Failure" ? formatSyncError(exit.cause) : null

    status = {
      lastAttemptAtMs: start,
      lastSuccessAtMs: exit._tag === "Success" ? end : status.lastSuccessAtMs,
      lastError,
      pendingOutboxCount: status.pendingOutboxCount,
    }

    return yield* refreshStatus(lastError)
  })

  const startPolling = Effect.sync(() => {
    const timer = setInterval(() => {
      Effect.runPromise(syncNow).catch((error) => {
        console.error("Failed to run sync:", error)
      })
    }, SYNC_INTERVAL_MS)

    return () => clearInterval(timer)
  })

  return {
    getStatus,
    syncNow,
    startPolling,
  } as const
}).pipe(Effect.provide(FetchHttpClient.layer))

export class SyncService extends Effect.Service<SyncService>()("services/SyncService", {
  dependencies: [AuthService.Default, LocalDbService.Default],
  effect: makeSyncService,
}) {}
