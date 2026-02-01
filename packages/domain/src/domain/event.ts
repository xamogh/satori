import { Schema } from 'effect'
import { BooleanFromNumberSchema, EntityIdSchema, Nullable, TimestampMsSchema } from './common'

export const EventRegistrationModeSchema = Schema.Union(
  Schema.Literal('PRE_REGISTRATION'),
  Schema.Literal('WALK_IN')
)

export type EventRegistrationMode = Schema.Schema.Type<typeof EventRegistrationModeSchema>

export const EventStatusSchema = Schema.Union(
  Schema.Literal('DRAFT'),
  Schema.Literal('ACTIVE'),
  Schema.Literal('CLOSED')
)

export type EventStatus = Schema.Schema.Type<typeof EventStatusSchema>

export const EventSchema = Schema.Struct({
  id: EntityIdSchema,
  parentEventId: Nullable(EntityIdSchema),
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  registrationMode: EventRegistrationModeSchema,
  status: EventStatusSchema,
  startsAtMs: TimestampMsSchema,
  endsAtMs: Nullable(TimestampMsSchema),
  empowermentId: Nullable(EntityIdSchema),
  guruId: Nullable(EntityIdSchema),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type Event = Schema.Schema.Type<typeof EventSchema>

export const EventCreateInputSchema = Schema.Struct({
  parentEventId: Nullable(EntityIdSchema),
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  registrationMode: EventRegistrationModeSchema,
  status: EventStatusSchema,
  startsAtMs: TimestampMsSchema,
  endsAtMs: Nullable(TimestampMsSchema),
  empowermentId: Nullable(EntityIdSchema),
  guruId: Nullable(EntityIdSchema)
})

export type EventCreateInput = Schema.Schema.Type<typeof EventCreateInputSchema>

export const EventUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  parentEventId: Nullable(EntityIdSchema),
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  registrationMode: EventRegistrationModeSchema,
  status: EventStatusSchema,
  startsAtMs: TimestampMsSchema,
  endsAtMs: Nullable(TimestampMsSchema),
  empowermentId: Nullable(EntityIdSchema),
  guruId: Nullable(EntityIdSchema)
})

export type EventUpdateInput = Schema.Schema.Type<typeof EventUpdateInputSchema>

export const EventDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type EventDeleteInput = Schema.Schema.Type<typeof EventDeleteInputSchema>

export const EventListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString)
})

export type EventListQuery = Schema.Schema.Type<typeof EventListQuerySchema>

export const EventDaySchema = Schema.Struct({
  id: EntityIdSchema,
  eventId: EntityIdSchema,
  dayNumber: Schema.Number,
  dateMs: TimestampMsSchema,
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type EventDay = Schema.Schema.Type<typeof EventDaySchema>

export const EventDayCreateInputSchema = Schema.Struct({
  eventId: EntityIdSchema,
  dayNumber: Schema.Number,
  dateMs: TimestampMsSchema
})

export type EventDayCreateInput = Schema.Schema.Type<typeof EventDayCreateInputSchema>

export const EventDayUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  eventId: EntityIdSchema,
  dayNumber: Schema.Number,
  dateMs: TimestampMsSchema
})

export type EventDayUpdateInput = Schema.Schema.Type<typeof EventDayUpdateInputSchema>

export const EventDayDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type EventDayDeleteInput = Schema.Schema.Type<typeof EventDayDeleteInputSchema>

export const EventDayListQuerySchema = Schema.Struct({
  eventId: Schema.optional(EntityIdSchema)
})

export type EventDayListQuery = Schema.Schema.Type<typeof EventDayListQuerySchema>

export const AttendanceOverrideStatusSchema = Schema.Union(
  Schema.Literal('attended'),
  Schema.Literal('not_attended')
)

export type AttendanceOverrideStatus = Schema.Schema.Type<typeof AttendanceOverrideStatusSchema>

export const EventAttendeeSchema = Schema.Struct({
  id: EntityIdSchema,
  eventId: EntityIdSchema,
  personId: EntityIdSchema,
  registrationMode: EventRegistrationModeSchema,
  registeredAtMs: Nullable(TimestampMsSchema),
  registeredBy: Nullable(Schema.String),
  registeredForDayId: Nullable(EntityIdSchema),
  notes: Nullable(Schema.String),
  isCancelled: BooleanFromNumberSchema,
  attendanceOverrideStatus: Nullable(AttendanceOverrideStatusSchema),
  attendanceOverrideNote: Nullable(Schema.String),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type EventAttendee = Schema.Schema.Type<typeof EventAttendeeSchema>

export const EventAttendeeCreateInputSchema = Schema.Struct({
  eventId: EntityIdSchema,
  personId: EntityIdSchema,
  registrationMode: EventRegistrationModeSchema,
  registeredAtMs: Nullable(TimestampMsSchema),
  registeredBy: Nullable(Schema.String),
  registeredForDayId: Nullable(EntityIdSchema),
  notes: Nullable(Schema.String),
  isCancelled: BooleanFromNumberSchema,
  attendanceOverrideStatus: Nullable(AttendanceOverrideStatusSchema),
  attendanceOverrideNote: Nullable(Schema.String)
})

export type EventAttendeeCreateInput = Schema.Schema.Type<typeof EventAttendeeCreateInputSchema>

export const EventAttendeeUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  eventId: EntityIdSchema,
  personId: EntityIdSchema,
  registrationMode: EventRegistrationModeSchema,
  registeredAtMs: Nullable(TimestampMsSchema),
  registeredBy: Nullable(Schema.String),
  registeredForDayId: Nullable(EntityIdSchema),
  notes: Nullable(Schema.String),
  isCancelled: BooleanFromNumberSchema,
  attendanceOverrideStatus: Nullable(AttendanceOverrideStatusSchema),
  attendanceOverrideNote: Nullable(Schema.String)
})

export type EventAttendeeUpdateInput = Schema.Schema.Type<typeof EventAttendeeUpdateInputSchema>

export const EventAttendeeDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type EventAttendeeDeleteInput = Schema.Schema.Type<typeof EventAttendeeDeleteInputSchema>

export const EventAttendeeListQuerySchema = Schema.Struct({
  eventId: Schema.optional(EntityIdSchema),
  personId: Schema.optional(EntityIdSchema)
})

export type EventAttendeeListQuery = Schema.Schema.Type<typeof EventAttendeeListQuerySchema>
