import { randomUUID } from 'node:crypto'
import { Effect, Option, Schema } from 'effect'
import { LocalDbService, type LocalDbClient } from './LocalDbService'
import { EntityNotFoundError, OutboxEncodeError } from '../errors'
import type { LocalDbQueryError } from '../errors'
import {
  EventSchema,
  type Event,
  type EventCreateInput,
  type EventDeleteInput,
  type EventListQuery,
  type EventUpdateInput,
  EventDaySchema,
  type EventDay,
  type EventDayCreateInput,
  type EventDayDeleteInput,
  type EventDayListQuery,
  type EventDayUpdateInput,
  EventAttendeeSchema,
  type EventAttendee,
  type EventAttendeeCreateInput,
  type EventAttendeeDeleteInput,
  type EventAttendeeListQuery,
  type EventAttendeeUpdateInput
} from '@satori/domain/domain/event'
import {
  PersonSchema,
  type Person,
  type PersonCreateInput,
  type PersonDeleteInput,
  type PersonListQuery,
  type PersonUpdateInput
} from '@satori/domain/domain/person'
import {
  AttendanceSchema,
  type Attendance,
  type AttendanceCreateInput,
  type AttendanceDeleteInput,
  type AttendanceListQuery,
  type AttendanceUpdateInput
} from '@satori/domain/domain/attendance'
import {
  GroupSchema,
  PersonGroupSchema,
  type Group,
  type GroupCreateInput,
  type GroupDeleteInput,
  type GroupListQuery,
  type GroupUpdateInput,
  type PersonGroup,
  type PersonGroupCreateInput,
  type PersonGroupDeleteInput,
  type PersonGroupListQuery,
  type PersonGroupUpdateInput
} from '@satori/domain/domain/group'
import {
  EmpowermentSchema,
  type Empowerment,
  type EmpowermentCreateInput,
  type EmpowermentDeleteInput,
  type EmpowermentListQuery,
  type EmpowermentUpdateInput
} from '@satori/domain/domain/empowerment'
import {
  GuruSchema,
  type Guru,
  type GuruCreateInput,
  type GuruDeleteInput,
  type GuruListQuery,
  type GuruUpdateInput
} from '@satori/domain/domain/guru'
import {
  MahakramaHistorySchema,
  MahakramaStepSchema,
  type MahakramaHistory,
  type MahakramaHistoryCreateInput,
  type MahakramaHistoryDeleteInput,
  type MahakramaHistoryListQuery,
  type MahakramaHistoryUpdateInput,
  type MahakramaStep,
  type MahakramaStepCreateInput,
  type MahakramaStepDeleteInput,
  type MahakramaStepListQuery,
  type MahakramaStepUpdateInput
} from '@satori/domain/domain/mahakrama'
import {
  PhotoSchema,
  type Photo,
  type PhotoCreateInput,
  type PhotoDeleteInput
} from '@satori/domain/domain/photo'
import { toSqliteBoolean } from '../utils/sqlite'
import { SyncOperationSchema } from '@satori/domain/sync/schemas'

const nowMs = (): number => Date.now()

const escapeLike = (query: string): string =>
  query.replaceAll('~', '~~').replaceAll('%', '~%').replaceAll('_', '~_')

const likeQuery = (query: string): string => `%${escapeLike(query)}%`

const encodeSyncOperationJson = (
  op: Schema.Schema.Type<typeof SyncOperationSchema>
): Effect.Effect<string, OutboxEncodeError> =>
  Schema.encode(SyncOperationSchema)(op).pipe(
    Effect.map((encoded) => JSON.stringify(encoded)),
    Effect.mapError(
      (error) =>
        new OutboxEncodeError({
          message: 'Failed to encode outbox operation',
          cause: error
        })
    )
  )

const makeDataService = Effect.gen(function* () {
  const db = yield* LocalDbService

  type DbClient = Omit<LocalDbClient, 'transaction'>

  const insertOutbox = (
    client: DbClient,
    opId: string,
    json: string
  ): Effect.Effect<void, LocalDbQueryError> =>
    client
      .run('insert into outbox (op_id, body_json, created_at_ms) values (?, ?, ?)', [
        opId,
        json,
        nowMs()
      ])
      .pipe(Effect.asVoid)

  const eventsList = ({
    query
  }: EventListQuery): Effect.Effect<ReadonlyArray<Event>, LocalDbQueryError> => {
    const where =
      typeof query === 'string'
        ? "where deleted_at_ms is null and (name like ? escape '~' or description like ? escape '~')"
        : 'where deleted_at_ms is null'

    const params = typeof query === 'string' ? [likeQuery(query), likeQuery(query)] : []

    return db.all(
      `
select
  id,
  parent_event_id as parentEventId,
  name,
  description,
  registration_mode as registrationMode,
  status,
  starts_at_ms as startsAtMs,
  ends_at_ms as endsAtMs,
  empowerment_id as empowermentId,
  guru_id as guruId,
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
        parentEventId: input.parentEventId,
        name: input.name,
        description: input.description,
        registrationMode: input.registrationMode,
        status: input.status,
        startsAtMs: input.startsAtMs,
        endsAtMs: input.endsAtMs,
        empowermentId: input.empowermentId,
        guruId: input.guruId,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const eventDay: EventDay = {
        id: randomUUID(),
        eventId: event.id,
        dayNumber: 1,
        dateMs: event.startsAtMs,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const eventOp = {
        _tag: 'EventUpsert',
        opId: randomUUID(),
        event
      } as const

      const eventDayOp = {
        _tag: 'EventDayUpsert',
        opId: randomUUID(),
        eventDay
      } as const

      const eventJson = yield* encodeSyncOperationJson(eventOp)
      const eventDayJson = yield* encodeSyncOperationJson(eventDayOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              event.serverModifiedAtMs
            ]
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(
              tx
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
  deleted_at_ms = excluded.deleted_at_ms
`,
                  [
                    eventDay.id,
                    eventDay.eventId,
                    eventDay.dayNumber,
                    eventDay.dateMs,
                    eventDay.updatedAtMs,
                    eventDay.deletedAtMs,
                    eventDay.serverModifiedAtMs
                  ]
                )
                .pipe(Effect.asVoid)
            ),
            Effect.zipRight(insertOutbox(tx, eventOp.opId, eventJson)),
            Effect.zipRight(insertOutbox(tx, eventDayOp.opId, eventDayJson))
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
        parentEventId: input.parentEventId,
        name: input.name,
        description: input.description,
        registrationMode: input.registrationMode,
        status: input.status,
        startsAtMs: input.startsAtMs,
        endsAtMs: input.endsAtMs,
        empowermentId: input.empowermentId,
        guruId: input.guruId,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'EventUpsert',
        opId: randomUUID(),
        event
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              event.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return event
    })

  const eventsDelete = (
    input: EventDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'EventDelete',
        opId: randomUUID(),
        eventId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update events set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const eventDaysList = ({
    eventId
  }: EventDayListQuery): Effect.Effect<ReadonlyArray<EventDay>, LocalDbQueryError> => {
    const filter = [
      'deleted_at_ms is null',
      typeof eventId === 'string' ? 'event_id = ?' : null
    ].filter((value): value is string => typeof value === 'string')

    const where = filter.length > 0 ? `where ${filter.join(' and ')}` : ''
    const params = typeof eventId === 'string' ? [eventId] : []

    return db.all(
      `
select
  id,
  event_id as eventId,
  day_number as dayNumber,
  date_ms as dateMs,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from event_days
${where}
order by day_number asc
`,
      EventDaySchema,
      params
    )
  }

  const eventDaysCreate = (
    input: EventDayCreateInput
  ): Effect.Effect<EventDay, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const eventDay: EventDay = {
        id: randomUUID(),
        eventId: input.eventId,
        dayNumber: input.dayNumber,
        dateMs: input.dateMs,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'EventDayUpsert',
        opId: randomUUID(),
        eventDay
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
`,
            [
              eventDay.id,
              eventDay.eventId,
              eventDay.dayNumber,
              eventDay.dateMs,
              eventDay.updatedAtMs,
              eventDay.deletedAtMs,
              eventDay.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return eventDay
    })

  const eventDaysUpdate = (
    input: EventDayUpdateInput
  ): Effect.Effect<EventDay, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const eventDay: EventDay = {
        id: input.id,
        eventId: input.eventId,
        dayNumber: input.dayNumber,
        dateMs: input.dateMs,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'EventDayUpsert',
        opId: randomUUID(),
        eventDay
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
`,
            [
              eventDay.id,
              eventDay.eventId,
              eventDay.dayNumber,
              eventDay.dateMs,
              eventDay.updatedAtMs,
              eventDay.deletedAtMs,
              eventDay.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return eventDay
    })

  const eventDaysDelete = (
    input: EventDayDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'EventDayDelete',
        opId: randomUUID(),
        eventDayId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update event_days set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const eventAttendeesList = ({
    eventId,
    personId
  }: EventAttendeeListQuery): Effect.Effect<ReadonlyArray<EventAttendee>, LocalDbQueryError> => {
    const filter = [
      'deleted_at_ms is null',
      typeof eventId === 'string' ? 'event_id = ?' : null,
      typeof personId === 'string' ? 'person_id = ?' : null
    ].filter((value): value is string => typeof value === 'string')

    const where = filter.length > 0 ? `where ${filter.join(' and ')}` : ''
    const params = [
      ...(typeof eventId === 'string' ? [eventId] : []),
      ...(typeof personId === 'string' ? [personId] : [])
    ]

    return db.all(
      `
select
  id,
  event_id as eventId,
  person_id as personId,
  registration_mode as registrationMode,
  registered_at_ms as registeredAtMs,
  registered_by as registeredBy,
  registered_for_day_id as registeredForDayId,
  notes,
  is_cancelled as isCancelled,
  attendance_override_status as attendanceOverrideStatus,
  attendance_override_note as attendanceOverrideNote,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from event_attendees
${where}
order by updated_at_ms desc
`,
      EventAttendeeSchema,
      params
    )
  }

  const eventAttendeesCreate = (
    input: EventAttendeeCreateInput
  ): Effect.Effect<EventAttendee, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const attendee: EventAttendee = {
        id: randomUUID(),
        eventId: input.eventId,
        personId: input.personId,
        registrationMode: input.registrationMode,
        registeredAtMs: input.registeredAtMs,
        registeredBy: input.registeredBy,
        registeredForDayId: input.registeredForDayId,
        notes: input.notes,
        isCancelled: input.isCancelled,
        attendanceOverrideStatus: input.attendanceOverrideStatus,
        attendanceOverrideNote: input.attendanceOverrideNote,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'EventAttendeeUpsert',
        opId: randomUUID(),
        attendee
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              attendee.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return attendee
    })

  const eventAttendeesUpdate = (
    input: EventAttendeeUpdateInput
  ): Effect.Effect<EventAttendee, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const attendee: EventAttendee = {
        id: input.id,
        eventId: input.eventId,
        personId: input.personId,
        registrationMode: input.registrationMode,
        registeredAtMs: input.registeredAtMs,
        registeredBy: input.registeredBy,
        registeredForDayId: input.registeredForDayId,
        notes: input.notes,
        isCancelled: input.isCancelled,
        attendanceOverrideStatus: input.attendanceOverrideStatus,
        attendanceOverrideNote: input.attendanceOverrideNote,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'EventAttendeeUpsert',
        opId: randomUUID(),
        attendee
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              attendee.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return attendee
    })

  const eventAttendeesDelete = (
    input: EventAttendeeDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'EventAttendeeDelete',
        opId: randomUUID(),
        attendeeId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update event_attendees set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const attendanceList = ({
    eventId,
    eventDayId,
    eventAttendeeId
  }: AttendanceListQuery): Effect.Effect<ReadonlyArray<Attendance>, LocalDbQueryError> => {
    const filter = [
      'eda.deleted_at_ms is null',
      typeof eventId === 'string' ? 'ed.event_id = ?' : null,
      typeof eventDayId === 'string' ? 'eda.event_day_id = ?' : null,
      typeof eventAttendeeId === 'string' ? 'eda.event_attendee_id = ?' : null
    ].filter((value): value is string => typeof value === 'string')

    const where = filter.length > 0 ? `where ${filter.join(' and ')}` : ''
    const params = [
      ...(typeof eventId === 'string' ? [eventId] : []),
      ...(typeof eventDayId === 'string' ? [eventDayId] : []),
      ...(typeof eventAttendeeId === 'string' ? [eventAttendeeId] : [])
    ]

    return db.all(
      `
select
  eda.id,
  eda.event_attendee_id as eventAttendeeId,
  eda.event_day_id as eventDayId,
  eda.status,
  eda.checked_in_at_ms as checkedInAtMs,
  eda.checked_in_by as checkedInBy,
  eda.updated_at_ms as updatedAtMs,
  eda.deleted_at_ms as deletedAtMs,
  eda.server_modified_at_ms as serverModifiedAtMs
from event_day_attendance eda
left join event_days ed on ed.id = eda.event_day_id
${where}
order by eda.updated_at_ms desc
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
        eventAttendeeId: input.eventAttendeeId,
        eventDayId: input.eventDayId,
        status: input.status,
        checkedInAtMs: input.checkedInAtMs,
        checkedInBy: input.checkedInBy,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'AttendanceUpsert',
        opId: randomUUID(),
        attendance
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              attendance.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
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
        eventAttendeeId: input.eventAttendeeId,
        eventDayId: input.eventDayId,
        status: input.status,
        checkedInAtMs: input.checkedInAtMs,
        checkedInBy: input.checkedInBy,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'AttendanceUpsert',
        opId: randomUUID(),
        attendance
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              attendance.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return attendance
    })

  const attendanceDelete = (
    input: AttendanceDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'AttendanceDelete',
        opId: randomUUID(),
        attendanceId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run(
            'update event_day_attendance set deleted_at_ms = ?, updated_at_ms = ? where id = ?',
            [deletedAtMs, deletedAtMs, id]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const personsList = ({
    query
  }: PersonListQuery): Effect.Effect<ReadonlyArray<Person>, LocalDbQueryError> => {
    const where =
      typeof query === 'string'
        ? "where deleted_at_ms is null and (first_name like ? escape '~' or last_name like ? escape '~' or email like ? escape '~' or phone1 like ? escape '~' or phone2 like ? escape '~')"
        : 'where deleted_at_ms is null'

    const params =
      typeof query === 'string'
        ? [likeQuery(query), likeQuery(query), likeQuery(query), likeQuery(query), likeQuery(query)]
        : []

    return db.all(
      `
select
  id,
  first_name as firstName,
  middle_name as middleName,
  last_name as lastName,
  gender,
  year_of_birth as yearOfBirth,
  email,
  phone1,
  phone2,
  address,
  country,
  nationality,
  language_preference as languagePreference,
  notes,
  person_code as personCode,
  referred_by as referredBy,
  occupation,
  person_type as personType,
  title,
  refuge_name as refugeName,
  year_of_refuge as yearOfRefuge,
  year_of_refuge_calendar_type as yearOfRefugeCalendarType,
  is_sangha_member as isSanghaMember,
  center_id as centerId,
  is_krama_instructor as isKramaInstructor,
  krama_instructor_person_id as kramaInstructorPersonId,
  photo_id as photoId,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from persons
${where}
order by last_name asc, first_name asc
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
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        gender: input.gender,
        yearOfBirth: input.yearOfBirth,
        email: input.email,
        phone1: input.phone1,
        phone2: input.phone2,
        address: input.address,
        country: input.country,
        nationality: input.nationality,
        languagePreference: input.languagePreference,
        notes: input.notes,
        personCode: input.personCode,
        referredBy: input.referredBy,
        occupation: input.occupation,
        personType: input.personType,
        title: input.title,
        refugeName: input.refugeName,
        yearOfRefuge: input.yearOfRefuge,
        yearOfRefugeCalendarType: input.yearOfRefugeCalendarType,
        isSanghaMember: input.isSanghaMember,
        centerId: input.centerId,
        isKramaInstructor: input.isKramaInstructor,
        kramaInstructorPersonId: input.kramaInstructorPersonId,
        photoId: null,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'PersonUpsert',
        opId: randomUUID(),
        person
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              person.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return person
    })

  const personsUpdate = (
    input: PersonUpdateInput
  ): Effect.Effect<Person, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const person: Person = {
        id: input.id,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        gender: input.gender,
        yearOfBirth: input.yearOfBirth,
        email: input.email,
        phone1: input.phone1,
        phone2: input.phone2,
        address: input.address,
        country: input.country,
        nationality: input.nationality,
        languagePreference: input.languagePreference,
        notes: input.notes,
        personCode: input.personCode,
        referredBy: input.referredBy,
        occupation: input.occupation,
        personType: input.personType,
        title: input.title,
        refugeName: input.refugeName,
        yearOfRefuge: input.yearOfRefuge,
        yearOfRefugeCalendarType: input.yearOfRefugeCalendarType,
        isSanghaMember: input.isSanghaMember,
        centerId: input.centerId,
        isKramaInstructor: input.isKramaInstructor,
        kramaInstructorPersonId: input.kramaInstructorPersonId,
        photoId: input.photoId,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'PersonUpsert',
        opId: randomUUID(),
        person
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run(
            `
update persons
set
  first_name = ?,
  middle_name = ?,
  last_name = ?,
  gender = ?,
  year_of_birth = ?,
  email = ?,
  phone1 = ?,
  phone2 = ?,
  address = ?,
  country = ?,
  nationality = ?,
  language_preference = ?,
  notes = ?,
  person_code = ?,
  referred_by = ?,
  occupation = ?,
  person_type = ?,
  title = ?,
  refuge_name = ?,
  year_of_refuge = ?,
  year_of_refuge_calendar_type = ?,
  is_sangha_member = ?,
  center_id = ?,
  is_krama_instructor = ?,
  krama_instructor_person_id = ?,
  photo_id = ?,
  updated_at_ms = ?,
  deleted_at_ms = ?,
  server_modified_at_ms = ?
where id = ?
`,
            [
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
              person.id
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return person
    })

  const personsDelete = (
    input: PersonDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'PersonDelete',
        opId: randomUUID(),
        personId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update persons set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const groupsList = ({
    query
  }: GroupListQuery): Effect.Effect<ReadonlyArray<Group>, LocalDbQueryError> => {
    const where =
      typeof query === 'string'
        ? "where deleted_at_ms is null and (name like ? escape '~' or description like ? escape '~')"
        : 'where deleted_at_ms is null'

    const params = typeof query === 'string' ? [likeQuery(query), likeQuery(query)] : []

    return db.all(
      `
select
  id,
  name,
  description,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from groups
${where}
order by name asc
`,
      GroupSchema,
      params
    )
  }

  const groupsCreate = (
    input: GroupCreateInput
  ): Effect.Effect<Group, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const group: Group = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'GroupUpsert',
        opId: randomUUID(),
        group
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run(
            `
insert into groups (
  id, name, description, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms
`,
            [
              group.id,
              group.name,
              group.description,
              group.updatedAtMs,
              group.deletedAtMs,
              group.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return group
    })

  const groupsUpdate = (
    input: GroupUpdateInput
  ): Effect.Effect<Group, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const group: Group = {
        id: input.id,
        name: input.name,
        description: input.description,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'GroupUpsert',
        opId: randomUUID(),
        group
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run(
            `
insert into groups (
  id, name, description, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?, ?)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms
`,
            [
              group.id,
              group.name,
              group.description,
              group.updatedAtMs,
              group.deletedAtMs,
              group.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return group
    })

  const groupsDelete = (
    input: GroupDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'GroupDelete',
        opId: randomUUID(),
        groupId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update groups set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const personGroupsList = ({
    groupId,
    personId
  }: PersonGroupListQuery): Effect.Effect<ReadonlyArray<PersonGroup>, LocalDbQueryError> => {
    const filter = [
      'deleted_at_ms is null',
      typeof groupId === 'string' ? 'group_id = ?' : null,
      typeof personId === 'string' ? 'person_id = ?' : null
    ].filter((value): value is string => typeof value === 'string')

    const where = filter.length > 0 ? `where ${filter.join(' and ')}` : ''
    const params = [
      ...(typeof groupId === 'string' ? [groupId] : []),
      ...(typeof personId === 'string' ? [personId] : [])
    ]

    return db.all(
      `
select
  id,
  group_id as groupId,
  person_id as personId,
  joined_at_ms as joinedAtMs,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from person_groups
${where}
order by updated_at_ms desc
`,
      PersonGroupSchema,
      params
    )
  }

  const personGroupsCreate = (
    input: PersonGroupCreateInput
  ): Effect.Effect<PersonGroup, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const personGroup: PersonGroup = {
        id: randomUUID(),
        groupId: input.groupId,
        personId: input.personId,
        joinedAtMs: input.joinedAtMs,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'PersonGroupUpsert',
        opId: randomUUID(),
        personGroup
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
`,
            [
              personGroup.id,
              personGroup.groupId,
              personGroup.personId,
              personGroup.joinedAtMs,
              personGroup.updatedAtMs,
              personGroup.deletedAtMs,
              personGroup.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return personGroup
    })

  const personGroupsUpdate = (
    input: PersonGroupUpdateInput
  ): Effect.Effect<PersonGroup, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const personGroup: PersonGroup = {
        id: input.id,
        groupId: input.groupId,
        personId: input.personId,
        joinedAtMs: input.joinedAtMs,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'PersonGroupUpsert',
        opId: randomUUID(),
        personGroup
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
`,
            [
              personGroup.id,
              personGroup.groupId,
              personGroup.personId,
              personGroup.joinedAtMs,
              personGroup.updatedAtMs,
              personGroup.deletedAtMs,
              personGroup.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return personGroup
    })

  const personGroupsDelete = (
    input: PersonGroupDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'PersonGroupDelete',
        opId: randomUUID(),
        personGroupId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update person_groups set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const empowermentsList = ({
    query
  }: EmpowermentListQuery): Effect.Effect<ReadonlyArray<Empowerment>, LocalDbQueryError> => {
    const where =
      typeof query === 'string'
        ? "where deleted_at_ms is null and (name like ? escape '~' or description like ? escape '~')"
        : 'where deleted_at_ms is null'

    const params = typeof query === 'string' ? [likeQuery(query), likeQuery(query)] : []

    return db.all(
      `
select
  id,
  name,
  description,
  class as className,
  type,
  form,
  prerequisites,
  major_empowerment as majorEmpowerment,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from empowerments
${where}
order by name asc
`,
      EmpowermentSchema,
      params
    )
  }

  const empowermentsCreate = (
    input: EmpowermentCreateInput
  ): Effect.Effect<Empowerment, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const empowerment: Empowerment = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        className: input.className,
        type: input.type,
        form: input.form,
        prerequisites: input.prerequisites,
        majorEmpowerment: input.majorEmpowerment,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'EmpowermentUpsert',
        opId: randomUUID(),
        empowerment
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              empowerment.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return empowerment
    })

  const empowermentsUpdate = (
    input: EmpowermentUpdateInput
  ): Effect.Effect<Empowerment, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const empowerment: Empowerment = {
        id: input.id,
        name: input.name,
        description: input.description,
        className: input.className,
        type: input.type,
        form: input.form,
        prerequisites: input.prerequisites,
        majorEmpowerment: input.majorEmpowerment,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'EmpowermentUpsert',
        opId: randomUUID(),
        empowerment
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              empowerment.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return empowerment
    })

  const empowermentsDelete = (
    input: EmpowermentDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'EmpowermentDelete',
        opId: randomUUID(),
        empowermentId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update empowerments set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const gurusList = ({
    query
  }: GuruListQuery): Effect.Effect<ReadonlyArray<Guru>, LocalDbQueryError> => {
    const where =
      typeof query === 'string'
        ? "where deleted_at_ms is null and name like ? escape '~'"
        : 'where deleted_at_ms is null'

    const params = typeof query === 'string' ? [likeQuery(query)] : []

    return db.all(
      `
select
  id,
  name,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from gurus
${where}
order by name asc
`,
      GuruSchema,
      params
    )
  }

  const gurusCreate = (
    input: GuruCreateInput
  ): Effect.Effect<Guru, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const guru: Guru = {
        id: randomUUID(),
        name: input.name,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'GuruUpsert',
        opId: randomUUID(),
        guru
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run(
            `
insert into gurus (
  id, name, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?)
on conflict(id) do update set
  name = excluded.name,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms
`,
            [guru.id, guru.name, guru.updatedAtMs, guru.deletedAtMs, guru.serverModifiedAtMs]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return guru
    })

  const gurusUpdate = (
    input: GuruUpdateInput
  ): Effect.Effect<Guru, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const guru: Guru = {
        id: input.id,
        name: input.name,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'GuruUpsert',
        opId: randomUUID(),
        guru
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run(
            `
insert into gurus (
  id, name, updated_at_ms, deleted_at_ms, server_modified_at_ms
) values (?, ?, ?, ?, ?)
on conflict(id) do update set
  name = excluded.name,
  updated_at_ms = excluded.updated_at_ms,
  deleted_at_ms = excluded.deleted_at_ms
`,
            [guru.id, guru.name, guru.updatedAtMs, guru.deletedAtMs, guru.serverModifiedAtMs]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return guru
    })

  const gurusDelete = (
    input: GuruDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'GuruDelete',
        opId: randomUUID(),
        guruId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update gurus set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const mahakramaStepsList = ({
    query
  }: MahakramaStepListQuery): Effect.Effect<ReadonlyArray<MahakramaStep>, LocalDbQueryError> => {
    const where =
      typeof query === 'string'
        ? "where deleted_at_ms is null and (step_name like ? escape '~' or group_name like ? escape '~')"
        : 'where deleted_at_ms is null'

    const params = typeof query === 'string' ? [likeQuery(query), likeQuery(query)] : []

    return db.all(
      `
select
  id,
  step_id as stepId,
  step_name as stepName,
  sequence_number as sequenceNumber,
  group_id as groupId,
  group_name as groupName,
  description,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from mahakrama_steps
${where}
order by sequence_number asc
`,
      MahakramaStepSchema,
      params
    )
  }

  const mahakramaStepsCreate = (
    input: MahakramaStepCreateInput
  ): Effect.Effect<MahakramaStep, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const step: MahakramaStep = {
        id: randomUUID(),
        stepId: input.stepId,
        stepName: input.stepName,
        sequenceNumber: input.sequenceNumber,
        groupId: input.groupId,
        groupName: input.groupName,
        description: input.description,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'MahakramaStepUpsert',
        opId: randomUUID(),
        mahakramaStep: step
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              step.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return step
    })

  const mahakramaStepsUpdate = (
    input: MahakramaStepUpdateInput
  ): Effect.Effect<MahakramaStep, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const step: MahakramaStep = {
        id: input.id,
        stepId: input.stepId,
        stepName: input.stepName,
        sequenceNumber: input.sequenceNumber,
        groupId: input.groupId,
        groupName: input.groupName,
        description: input.description,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'MahakramaStepUpsert',
        opId: randomUUID(),
        mahakramaStep: step
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              step.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return step
    })

  const mahakramaStepsDelete = (
    input: MahakramaStepDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'MahakramaStepDelete',
        opId: randomUUID(),
        mahakramaStepId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update mahakrama_steps set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const mahakramaHistoryList = ({
    personId
  }: MahakramaHistoryListQuery): Effect.Effect<
    ReadonlyArray<MahakramaHistory>,
    LocalDbQueryError
  > => {
    const filter = [
      'deleted_at_ms is null',
      typeof personId === 'string' ? 'person_id = ?' : null
    ].filter((value): value is string => typeof value === 'string')

    const where = filter.length > 0 ? `where ${filter.join(' and ')}` : ''
    const params = typeof personId === 'string' ? [personId] : []

    return db.all(
      `
select
  id,
  person_id as personId,
  mahakrama_step_id as mahakramaStepId,
  start_date_ms as startDateMs,
  end_date_ms as endDateMs,
  status,
  mahakrama_instructor_person_id as mahakramaInstructorPersonId,
  completion_notes as completionNotes,
  updated_at_ms as updatedAtMs,
  deleted_at_ms as deletedAtMs,
  server_modified_at_ms as serverModifiedAtMs
from mahakrama_history
${where}
order by start_date_ms desc
`,
      MahakramaHistorySchema,
      params
    )
  }

  const mahakramaHistoryCreate = (
    input: MahakramaHistoryCreateInput
  ): Effect.Effect<MahakramaHistory, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const history: MahakramaHistory = {
        id: randomUUID(),
        personId: input.personId,
        mahakramaStepId: input.mahakramaStepId,
        startDateMs: input.startDateMs,
        endDateMs: input.endDateMs,
        status: input.status,
        mahakramaInstructorPersonId: input.mahakramaInstructorPersonId,
        completionNotes: input.completionNotes,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'MahakramaHistoryUpsert',
        opId: randomUUID(),
        mahakramaHistory: history
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              history.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return history
    })

  const mahakramaHistoryUpdate = (
    input: MahakramaHistoryUpdateInput
  ): Effect.Effect<MahakramaHistory, LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const timestampMs = nowMs()
      const history: MahakramaHistory = {
        id: input.id,
        personId: input.personId,
        mahakramaStepId: input.mahakramaStepId,
        startDateMs: input.startDateMs,
        endDateMs: input.endDateMs,
        status: input.status,
        mahakramaInstructorPersonId: input.mahakramaInstructorPersonId,
        completionNotes: input.completionNotes,
        updatedAtMs: timestampMs,
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const syncOp = {
        _tag: 'MahakramaHistoryUpsert',
        opId: randomUUID(),
        mahakramaHistory: history
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
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
  deleted_at_ms = excluded.deleted_at_ms
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
              history.serverModifiedAtMs
            ]
          )
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return history
    })

  const mahakramaHistoryDelete = (
    input: MahakramaHistoryDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'MahakramaHistoryDelete',
        opId: randomUUID(),
        mahakramaHistoryId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update mahakrama_history set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
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
        serverModifiedAtMs: null
      }

      const photoSyncOp = {
        _tag: 'PhotoUpsert',
        opId: randomUUID(),
        photo
      } as const

      const photoOpJson = yield* encodeSyncOperationJson(photoSyncOp)

      const updatedPerson = yield* db.get(
        `
select
  id,
  first_name as firstName,
  middle_name as middleName,
  last_name as lastName,
  gender,
  year_of_birth as yearOfBirth,
  email,
  phone1,
  phone2,
  address,
  country,
  language_preference as languagePreference,
  notes,
  person_code as personCode,
  referred_by as referredBy,
  occupation,
  is_sangha_member as isSanghaMember,
  center_id as centerId,
  is_krama_instructor as isKramaInstructor,
  krama_instructor_person_id as kramaInstructorPersonId,
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
            message: 'Person not found',
            entity: 'Person',
            id: input.personId
          })
        )
      }

      const person: Person = {
        ...updatedPerson.value,
        photoId: photo.id,
        updatedAtMs: nowMs(),
        deletedAtMs: null,
        serverModifiedAtMs: null
      }

      const personSyncOp = {
        _tag: 'PersonUpsert',
        opId: randomUUID(),
        person
      } as const

      const personOpJson = yield* encodeSyncOperationJson(personSyncOp)

      yield* db.transaction((tx) =>
        tx
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
              photo.serverModifiedAtMs
            ]
          )
          .pipe(
            Effect.asVoid,
            Effect.zipRight(
              tx
                .run('update persons set photo_id = ?, updated_at_ms = ? where id = ?', [
                  photo.id,
                  person.updatedAtMs,
                  person.id
                ])
                .pipe(Effect.asVoid)
            ),
            Effect.zipRight(insertOutbox(tx, photoSyncOp.opId, photoOpJson)),
            Effect.zipRight(insertOutbox(tx, personSyncOp.opId, personOpJson))
          )
      )

      return photo
    })

  const photosDelete = (
    input: PhotoDeleteInput
  ): Effect.Effect<'ok', LocalDbQueryError | OutboxEncodeError> =>
    Effect.gen(function* () {
      const { id } = input
      const deletedAtMs = nowMs()
      const syncOp = {
        _tag: 'PhotoDelete',
        opId: randomUUID(),
        photoId: id,
        deletedAtMs
      } as const

      const opJson = yield* encodeSyncOperationJson(syncOp)

      yield* db.transaction((tx) =>
        tx
          .run('update photos set deleted_at_ms = ?, updated_at_ms = ? where id = ?', [
            deletedAtMs,
            deletedAtMs,
            id
          ])
          .pipe(Effect.asVoid, Effect.zipRight(insertOutbox(tx, syncOp.opId, opJson)))
      )

      return 'ok' as const
    })

  const photosGet = (id: string): Effect.Effect<Photo, LocalDbQueryError | EntityNotFoundError> =>
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
          new EntityNotFoundError({ message: 'Photo not found', entity: 'Photo', id })
        )
      }

      return row.value
    })

  return {
    eventsList,
    eventsCreate,
    eventsUpdate,
    eventsDelete,
    eventDaysList,
    eventDaysCreate,
    eventDaysUpdate,
    eventDaysDelete,
    eventAttendeesList,
    eventAttendeesCreate,
    eventAttendeesUpdate,
    eventAttendeesDelete,
    personsList,
    personsCreate,
    personsUpdate,
    personsDelete,
    attendanceList,
    attendanceCreate,
    attendanceUpdate,
    attendanceDelete,
    groupsList,
    groupsCreate,
    groupsUpdate,
    groupsDelete,
    personGroupsList,
    personGroupsCreate,
    personGroupsUpdate,
    personGroupsDelete,
    empowermentsList,
    empowermentsCreate,
    empowermentsUpdate,
    empowermentsDelete,
    gurusList,
    gurusCreate,
    gurusUpdate,
    gurusDelete,
    mahakramaStepsList,
    mahakramaStepsCreate,
    mahakramaStepsUpdate,
    mahakramaStepsDelete,
    mahakramaHistoryList,
    mahakramaHistoryCreate,
    mahakramaHistoryUpdate,
    mahakramaHistoryDelete,
    photosCreate,
    photosDelete,
    photosGet
  } as const
})

export class DataService extends Effect.Service<DataService>()('services/DataService', {
  dependencies: [LocalDbService.Default],
  effect: makeDataService
}) {}
