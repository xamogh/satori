import { Effect, Schema } from "effect"
import { EmailSchema } from "@satori/domain/auth/schemas"
import { AttendanceSchema } from "@satori/domain/domain/attendance"
import { EmpowermentSchema } from "@satori/domain/domain/empowerment"
import {
  EventAttendeeSchema,
  EventDaySchema,
  EventSchema,
} from "@satori/domain/domain/event"
import { GroupSchema, PersonGroupSchema } from "@satori/domain/domain/group"
import { GuruSchema } from "@satori/domain/domain/guru"
import {
  MahakramaHistorySchema,
  MahakramaStepSchema,
} from "@satori/domain/domain/mahakrama"
import { PersonSchema } from "@satori/domain/domain/person"
import { PhotoSchema } from "@satori/domain/domain/photo"
import type { SyncChanges, SyncOperation } from "@satori/domain/sync/schemas"
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
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null
      const isEmail = Schema.is(EmailSchema)

      const decodeEvents = Schema.decodeUnknown(Schema.Array(EventSchema))
      const decodeEventDays = Schema.decodeUnknown(Schema.Array(EventDaySchema))
      const decodeEventAttendees = Schema.decodeUnknown(
        Schema.Array(EventAttendeeSchema)
      )
      const decodePersons = Schema.decodeUnknown(Schema.Array(PersonSchema))
      const decodeAttendance = Schema.decodeUnknown(Schema.Array(AttendanceSchema))
      const decodeGroups = Schema.decodeUnknown(Schema.Array(GroupSchema))
      const decodePersonGroups = Schema.decodeUnknown(
        Schema.Array(PersonGroupSchema)
      )
      const decodeEmpowerments = Schema.decodeUnknown(
        Schema.Array(EmpowermentSchema)
      )
      const decodeGurus = Schema.decodeUnknown(Schema.Array(GuruSchema))
      const decodeMahakramaSteps = Schema.decodeUnknown(
        Schema.Array(MahakramaStepSchema)
      )
      const decodeMahakramaHistory = Schema.decodeUnknown(
        Schema.Array(MahakramaHistorySchema)
      )
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
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "EventDelete": {
            return tx
              .query(
                `
update events
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.eventId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "EventDayUpsert": {
            const { eventDay } = operation
            return tx
              .query(
                `
insert into event_days (
  id, event_id, day_number, date_ms, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6, $7)
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
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "EventDayDelete": {
            return tx
              .query(
                `
update event_days
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.eventDayId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "EventAttendeeUpsert": {
            const { attendee } = operation
            return tx
              .query(
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
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
                  attendee.isCancelled,
                  attendee.attendanceOverrideStatus,
                  attendee.attendanceOverrideNote,
                  attendee.updatedAtMs,
                  attendee.deletedAtMs,
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "EventAttendeeDelete": {
            return tx
              .query(
                `
update event_attendees
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.attendeeId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "PersonUpsert": {
            const { person } = operation
            const displayName = [person.firstName, person.middleName, person.lastName]
              .filter((value): value is string => typeof value === "string" && value.length > 0)
              .join(" ")
            return tx
              .query(
                `
insert into persons (
  id,
  display_name,
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
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
on conflict(id) do update set
  display_name = excluded.display_name,
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
                  displayName,
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
                  person.isSanghaMember,
                  person.centerId,
                  person.isKramaInstructor,
                  person.kramaInstructorPersonId,
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
update persons
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.personId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "AttendanceUpsert": {
            const { attendance } = operation
            return tx
              .query(
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
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "AttendanceDelete": {
            return tx
              .query(
                `
update event_day_attendance
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.attendanceId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "GroupUpsert": {
            const { group } = operation
            return tx
              .query(
                `
insert into groups (
  id, name, description, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6)
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
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "GroupDelete": {
            return tx
              .query(
                `
update groups
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.groupId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "PersonGroupUpsert": {
            const { personGroup } = operation
            return tx
              .query(
                `
insert into person_groups (
  id, group_id, person_id, joined_at_ms, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5, $6, $7)
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
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "PersonGroupDelete": {
            return tx
              .query(
                `
update person_groups
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.personGroupId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "EmpowermentUpsert": {
            const { empowerment } = operation
            return tx
              .query(
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
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
                  empowerment.majorEmpowerment,
                  empowerment.updatedAtMs,
                  empowerment.deletedAtMs,
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "EmpowermentDelete": {
            return tx
              .query(
                `
update empowerments
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.empowermentId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "GuruUpsert": {
            const { guru } = operation
            return tx
              .query(
                `
insert into gurus (
  id, name, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values ($1, $2, $3, $4, $5)
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
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "GuruDelete": {
            return tx
              .query(
                `
update gurus
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.guruId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "MahakramaStepUpsert": {
            const { mahakramaStep } = operation
            return tx
              .query(
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
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
                  mahakramaStep.id,
                  mahakramaStep.stepId,
                  mahakramaStep.stepName,
                  mahakramaStep.sequenceNumber,
                  mahakramaStep.groupId,
                  mahakramaStep.groupName,
                  mahakramaStep.description,
                  mahakramaStep.updatedAtMs,
                  mahakramaStep.deletedAtMs,
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "MahakramaStepDelete": {
            return tx
              .query(
                `
update mahakrama_steps
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [operation.mahakramaStepId, operation.deletedAtMs, serverNowMs]
              )
              .pipe(Effect.asVoid)
          }
          case "MahakramaHistoryUpsert": {
            const { mahakramaHistory } = operation
            return tx
              .query(
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
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
                  mahakramaHistory.id,
                  mahakramaHistory.personId,
                  mahakramaHistory.mahakramaStepId,
                  mahakramaHistory.startDateMs,
                  mahakramaHistory.endDateMs,
                  mahakramaHistory.status,
                  mahakramaHistory.mahakramaInstructorPersonId,
                  mahakramaHistory.completionNotes,
                  mahakramaHistory.updatedAtMs,
                  mahakramaHistory.deletedAtMs,
                  serverNowMs,
                ]
              )
              .pipe(Effect.asVoid)
          }
          case "MahakramaHistoryDelete": {
            return tx
              .query(
                `
update mahakrama_history
set deleted_at_ms = $2, updated_at_ms = $2, server_modified_at_ms = $3
where id = $1 and $2 >= updated_at_ms
`,
                [
                  operation.mahakramaHistoryId,
                  operation.deletedAtMs,
                  serverNowMs,
                ]
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
	  parent_event_id as "parentEventId",
  coalesce(nullif(trim(name), ''), 'Untitled') as "name",
  description,
  registration_mode as "registrationMode",
  status,
  starts_at_ms as "startsAtMs",
  ends_at_ms as "endsAtMs",
  empowerment_id as "empowermentId",
  guru_id as "guruId",
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

          const normalizedEventRows = eventsRows.map((row) => {
            if (!isRecord(row)) return row
            const rawName = row["name"]
            const trimmedName = typeof rawName === "string" ? rawName.trim() : ""
            const name = trimmedName.length > 0 ? trimmedName : "Untitled"
            return { ...row, name }
          })

          const eventDayRows = yield* tx
            .query(
              `
select
  id,
  event_id as "eventId",
  day_number as "dayNumber",
  date_ms as "dateMs",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from event_days
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
            .pipe(Effect.map((result) => result.rows))

          const eventAttendeeRows = yield* tx
            .query(
              `
select
  id,
  event_id as "eventId",
  person_id as "personId",
  registration_mode as "registrationMode",
  registered_at_ms as "registeredAtMs",
  registered_by as "registeredBy",
  registered_for_day_id as "registeredForDayId",
  notes,
  is_cancelled as "isCancelled",
  attendance_override_status as "attendanceOverrideStatus",
  attendance_override_note as "attendanceOverrideNote",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from event_attendees
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
  event_attendee_id as "eventAttendeeId",
  event_day_id as "eventDayId",
  status,
  checked_in_at_ms as "checkedInAtMs",
  checked_in_by as "checkedInBy",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from event_day_attendance
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
  first_name as "firstName",
  middle_name as "middleName",
  last_name as "lastName",
  gender,
  year_of_birth as "yearOfBirth",
  email,
  phone1 as "phone1",
  phone2 as "phone2",
  address,
  country,
  nationality,
  language_preference as "languagePreference",
  notes,
  person_code as "personCode",
  referred_by as "referredBy",
  occupation,
  person_type as "personType",
  title,
  refuge_name as "refugeName",
  year_of_refuge as "yearOfRefuge",
  year_of_refuge_calendar_type as "yearOfRefugeCalendarType",
  is_sangha_member as "isSanghaMember",
  center_id as "centerId",
  is_krama_instructor as "isKramaInstructor",
  krama_instructor_person_id as "kramaInstructorPersonId",
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

          const normalizedPersonRows = personsRows.map((row) => {
            if (!isRecord(row)) return row
            const rawFirstName = row["firstName"]
            const rawMiddleName = row["middleName"]
            const rawLastName = row["lastName"]
            const rawEmail = row["email"]

            const trimmedFirstName =
              typeof rawFirstName === "string" ? rawFirstName.trim() : ""
            const trimmedMiddleName =
              typeof rawMiddleName === "string" ? rawMiddleName.trim() : ""
            const trimmedLastName =
              typeof rawLastName === "string" ? rawLastName.trim() : ""
            const trimmedEmail =
              typeof rawEmail === "string" ? rawEmail.trim() : ""

            const firstName = trimmedFirstName.length > 0 ? trimmedFirstName : "Unknown"
            const middleName =
              trimmedMiddleName.length > 0 ? trimmedMiddleName : null
            const lastName = trimmedLastName.length > 0 ? trimmedLastName : "Unknown"
            const email =
              trimmedEmail.length > 0 && isEmail(trimmedEmail)
                ? trimmedEmail
                : null

            return { ...row, firstName, middleName, lastName, email }
          })

          const groupRows = yield* tx
            .query(
              `
select
  id,
  name,
  description,
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from groups
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
            .pipe(Effect.map((result) => result.rows))

          const personGroupRows = yield* tx
            .query(
              `
select
  id,
  group_id as "groupId",
  person_id as "personId",
  joined_at_ms as "joinedAtMs",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from person_groups
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
            .pipe(Effect.map((result) => result.rows))

          const empowermentRows = yield* tx
            .query(
              `
select
  id,
  name,
  description,
  class as "className",
  type,
  form,
  prerequisites,
  major_empowerment as "majorEmpowerment",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from empowerments
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
            .pipe(Effect.map((result) => result.rows))

          const guruRows = yield* tx
            .query(
              `
select
  id,
  name,
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from gurus
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
            .pipe(Effect.map((result) => result.rows))

          const mahakramaStepRows = yield* tx
            .query(
              `
select
  id,
  step_id as "stepId",
  step_name as "stepName",
  sequence_number as "sequenceNumber",
  group_id as "groupId",
  group_name as "groupName",
  description,
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from mahakrama_steps
where server_modified_at_ms > $1
order by server_modified_at_ms asc
`,
              [cursorMs]
            )
            .pipe(Effect.map((result) => result.rows))

          const mahakramaHistoryRows = yield* tx
            .query(
              `
select
  id,
  person_id as "personId",
  mahakrama_step_id as "mahakramaStepId",
  start_date_ms as "startDateMs",
  end_date_ms as "endDateMs",
  status,
  mahakrama_instructor_person_id as "mahakramaInstructorPersonId",
  completion_notes as "completionNotes",
  updated_at_ms as "updatedAtMs",
  deleted_at_ms as "deletedAtMs",
  server_modified_at_ms as "serverModifiedAtMs"
from mahakrama_history
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

          const events = yield* decodeEvents(normalizedEventRows).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid events row shape",
                  cause: error,
                })
            )
          )

          const eventDays = yield* decodeEventDays(eventDayRows).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid event days row shape",
                  cause: error,
                })
            )
          )

          const eventAttendees = yield* decodeEventAttendees(
            eventAttendeeRows
          ).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid event attendees row shape",
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

          const persons = yield* decodePersons(normalizedPersonRows).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid persons row shape",
                  cause: error,
                })
            )
          )

          const groups = yield* decodeGroups(groupRows).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid groups row shape",
                  cause: error,
                })
            )
          )

          const personGroups = yield* decodePersonGroups(personGroupRows).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid person groups row shape",
                  cause: error,
                })
            )
          )

          const empowerments = yield* decodeEmpowerments(
            empowermentRows
          ).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid empowerments row shape",
                  cause: error,
                })
            )
          )

          const gurus = yield* decodeGurus(guruRows).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid gurus row shape",
                  cause: error,
                })
            )
          )

          const mahakramaSteps = yield* decodeMahakramaSteps(
            mahakramaStepRows
          ).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid mahakrama steps row shape",
                  cause: error,
                })
            )
          )

          const mahakramaHistory = yield* decodeMahakramaHistory(
            mahakramaHistoryRows
          ).pipe(
            Effect.mapError(
              (error) =>
                new DbError({
                  message: "Invalid mahakrama history row shape",
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

          return {
            events,
            eventDays,
            eventAttendees,
            persons,
            attendance,
            groups,
            personGroups,
            empowerments,
            gurus,
            mahakramaSteps,
            mahakramaHistory,
            photos,
          } as const
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
