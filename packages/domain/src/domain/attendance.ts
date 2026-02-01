import { Schema } from "effect"
import { EntityIdSchema, Nullable, TimestampMsSchema } from "./common"

export const AttendanceStatusSchema = Schema.Union(
  Schema.Literal("present"),
  Schema.Literal("absent")
)

export type AttendanceStatus = Schema.Schema.Type<typeof AttendanceStatusSchema>

export const AttendanceSchema = Schema.Struct({
  id: EntityIdSchema,
  eventAttendeeId: EntityIdSchema,
  eventDayId: EntityIdSchema,
  status: AttendanceStatusSchema,
  checkedInAtMs: Nullable(TimestampMsSchema),
  checkedInBy: Nullable(Schema.String),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema),
})

export type Attendance = Schema.Schema.Type<typeof AttendanceSchema>

export const AttendanceCreateInputSchema = Schema.Struct({
  eventAttendeeId: EntityIdSchema,
  eventDayId: EntityIdSchema,
  status: AttendanceStatusSchema,
  checkedInAtMs: Nullable(TimestampMsSchema),
  checkedInBy: Nullable(Schema.String),
})

export type AttendanceCreateInput = Schema.Schema.Type<typeof AttendanceCreateInputSchema>

export const AttendanceUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  eventAttendeeId: EntityIdSchema,
  eventDayId: EntityIdSchema,
  status: AttendanceStatusSchema,
  checkedInAtMs: Nullable(TimestampMsSchema),
  checkedInBy: Nullable(Schema.String),
})

export type AttendanceUpdateInput = Schema.Schema.Type<typeof AttendanceUpdateInputSchema>

export const AttendanceDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema,
})

export type AttendanceDeleteInput = Schema.Schema.Type<typeof AttendanceDeleteInputSchema>

export const AttendanceListQuerySchema = Schema.Struct({
  eventId: Schema.optional(EntityIdSchema),
  eventDayId: Schema.optional(EntityIdSchema),
  eventAttendeeId: Schema.optional(EntityIdSchema),
})

export type AttendanceListQuery = Schema.Schema.Type<typeof AttendanceListQuerySchema>
