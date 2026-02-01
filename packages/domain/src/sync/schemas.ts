import { Schema } from 'effect'
import { AttendanceSchema } from '../domain/attendance'
import { EntityIdSchema, Nullable, TimestampMsSchema } from '../domain/common'
import { EmpowermentSchema } from '../domain/empowerment'
import { EventAttendeeSchema, EventDaySchema, EventSchema } from '../domain/event'
import { GroupSchema, PersonGroupSchema } from '../domain/group'
import { GuruSchema } from '../domain/guru'
import { MahakramaHistorySchema, MahakramaStepSchema } from '../domain/mahakrama'
import { PersonSchema } from '../domain/person'
import { PhotoApiSchema } from '../domain/photo'

export const SyncCursorMsSchema = Schema.Number

export type SyncCursorMs = Schema.Schema.Type<typeof SyncCursorMsSchema>

export const SyncOpIdSchema = Schema.UUID

export type SyncOpId = Schema.Schema.Type<typeof SyncOpIdSchema>

export const SyncOperationSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('EventUpsert'),
    opId: SyncOpIdSchema,
    event: EventSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('EventDelete'),
    opId: SyncOpIdSchema,
    eventId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('EventDayUpsert'),
    opId: SyncOpIdSchema,
    eventDay: EventDaySchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('EventDayDelete'),
    opId: SyncOpIdSchema,
    eventDayId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('EventAttendeeUpsert'),
    opId: SyncOpIdSchema,
    attendee: EventAttendeeSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('EventAttendeeDelete'),
    opId: SyncOpIdSchema,
    attendeeId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('PersonUpsert'),
    opId: SyncOpIdSchema,
    person: PersonSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('PersonDelete'),
    opId: SyncOpIdSchema,
    personId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('AttendanceUpsert'),
    opId: SyncOpIdSchema,
    attendance: AttendanceSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('AttendanceDelete'),
    opId: SyncOpIdSchema,
    attendanceId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('GroupUpsert'),
    opId: SyncOpIdSchema,
    group: GroupSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('GroupDelete'),
    opId: SyncOpIdSchema,
    groupId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('PersonGroupUpsert'),
    opId: SyncOpIdSchema,
    personGroup: PersonGroupSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('PersonGroupDelete'),
    opId: SyncOpIdSchema,
    personGroupId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('EmpowermentUpsert'),
    opId: SyncOpIdSchema,
    empowerment: EmpowermentSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('EmpowermentDelete'),
    opId: SyncOpIdSchema,
    empowermentId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('GuruUpsert'),
    opId: SyncOpIdSchema,
    guru: GuruSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('GuruDelete'),
    opId: SyncOpIdSchema,
    guruId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('MahakramaStepUpsert'),
    opId: SyncOpIdSchema,
    mahakramaStep: MahakramaStepSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('MahakramaStepDelete'),
    opId: SyncOpIdSchema,
    mahakramaStepId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('MahakramaHistoryUpsert'),
    opId: SyncOpIdSchema,
    mahakramaHistory: MahakramaHistorySchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('MahakramaHistoryDelete'),
    opId: SyncOpIdSchema,
    mahakramaHistoryId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('PhotoUpsert'),
    opId: SyncOpIdSchema,
    photo: PhotoApiSchema
  }),
  Schema.Struct({
    _tag: Schema.Literal('PhotoDelete'),
    opId: SyncOpIdSchema,
    photoId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema
  })
)

export type SyncOperation = Schema.Schema.Type<typeof SyncOperationSchema>

export const SyncRequestSchema = Schema.Struct({
  cursorMs: Schema.optional(SyncCursorMsSchema),
  operations: Schema.Array(SyncOperationSchema)
})

export type SyncRequest = Schema.Schema.Type<typeof SyncRequestSchema>

export const SyncChangesSchema = Schema.Struct({
  events: Schema.Array(EventSchema),
  eventDays: Schema.Array(EventDaySchema),
  eventAttendees: Schema.Array(EventAttendeeSchema),
  persons: Schema.Array(PersonSchema),
  attendance: Schema.Array(AttendanceSchema),
  groups: Schema.Array(GroupSchema),
  personGroups: Schema.Array(PersonGroupSchema),
  empowerments: Schema.Array(EmpowermentSchema),
  gurus: Schema.Array(GuruSchema),
  mahakramaSteps: Schema.Array(MahakramaStepSchema),
  mahakramaHistory: Schema.Array(MahakramaHistorySchema),
  photos: Schema.Array(PhotoApiSchema)
})

export type SyncChanges = Schema.Schema.Type<typeof SyncChangesSchema>

export const SyncResponseSchema = Schema.Struct({
  cursorMs: SyncCursorMsSchema,
  ackOpIds: Schema.Array(SyncOpIdSchema),
  changes: SyncChangesSchema
})

export type SyncResponse = Schema.Schema.Type<typeof SyncResponseSchema>

export const SyncStatusSchema = Schema.Struct({
  lastAttemptAtMs: Nullable(TimestampMsSchema),
  lastSuccessAtMs: Nullable(TimestampMsSchema),
  lastError: Nullable(Schema.String),
  pendingOutboxCount: Schema.Number
})

export type SyncStatus = Schema.Schema.Type<typeof SyncStatusSchema>
