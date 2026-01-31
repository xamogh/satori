import { Schema } from "effect"
import { EntityIdSchema, Nullable, TimestampMsSchema } from "../domain/common"
import { EventSchema } from "../domain/event"
import { PersonSchema } from "../domain/person"
import { RegistrationSchema } from "../domain/registration"
import { AttendanceSchema } from "../domain/attendance"
import { PhotoApiSchema } from "../domain/photo"

export const SyncCursorMsSchema = Schema.Number

export type SyncCursorMs = Schema.Schema.Type<typeof SyncCursorMsSchema>

export const SyncOpIdSchema = Schema.UUID

export type SyncOpId = Schema.Schema.Type<typeof SyncOpIdSchema>

export const SyncOperationSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("EventUpsert"),
    opId: SyncOpIdSchema,
    event: EventSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("EventDelete"),
    opId: SyncOpIdSchema,
    eventId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("PersonUpsert"),
    opId: SyncOpIdSchema,
    person: PersonSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("PersonDelete"),
    opId: SyncOpIdSchema,
    personId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("RegistrationUpsert"),
    opId: SyncOpIdSchema,
    registration: RegistrationSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("RegistrationDelete"),
    opId: SyncOpIdSchema,
    registrationId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("AttendanceUpsert"),
    opId: SyncOpIdSchema,
    attendance: AttendanceSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("AttendanceDelete"),
    opId: SyncOpIdSchema,
    attendanceId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("PhotoUpsert"),
    opId: SyncOpIdSchema,
    photo: PhotoApiSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal("PhotoDelete"),
    opId: SyncOpIdSchema,
    photoId: EntityIdSchema,
    deletedAtMs: TimestampMsSchema,
  })
)

export type SyncOperation = Schema.Schema.Type<typeof SyncOperationSchema>

export const SyncRequestSchema = Schema.Struct({
  cursorMs: Schema.optional(SyncCursorMsSchema),
  operations: Schema.Array(SyncOperationSchema),
})

export type SyncRequest = Schema.Schema.Type<typeof SyncRequestSchema>

export const SyncChangesSchema = Schema.Struct({
  events: Schema.Array(EventSchema),
  persons: Schema.Array(PersonSchema),
  registrations: Schema.Array(RegistrationSchema),
  attendance: Schema.Array(AttendanceSchema),
  photos: Schema.Array(PhotoApiSchema),
})

export type SyncChanges = Schema.Schema.Type<typeof SyncChangesSchema>

export const SyncResponseSchema = Schema.Struct({
  cursorMs: SyncCursorMsSchema,
  ackOpIds: Schema.Array(SyncOpIdSchema),
  changes: SyncChangesSchema,
})

export type SyncResponse = Schema.Schema.Type<typeof SyncResponseSchema>

export const SyncStatusSchema = Schema.Struct({
  lastAttemptAtMs: Nullable(TimestampMsSchema),
  lastSuccessAtMs: Nullable(TimestampMsSchema),
  lastError: Nullable(Schema.String),
  pendingOutboxCount: Schema.Number,
})

export type SyncStatus = Schema.Schema.Type<typeof SyncStatusSchema>
