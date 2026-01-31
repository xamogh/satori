import { Schema } from "effect"
import { EntityIdSchema, Nullable, TimestampMsSchema } from "./common"

export const EventSchema = Schema.Struct({
  id: EntityIdSchema,
  title: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  startsAtMs: TimestampMsSchema,
  endsAtMs: Nullable(TimestampMsSchema),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema),
})

export type Event = Schema.Schema.Type<typeof EventSchema>

export const EventCreateInputSchema = Schema.Struct({
  title: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  startsAtMs: TimestampMsSchema,
  endsAtMs: Nullable(TimestampMsSchema),
})

export type EventCreateInput = Schema.Schema.Type<typeof EventCreateInputSchema>

export const EventUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  title: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  startsAtMs: TimestampMsSchema,
  endsAtMs: Nullable(TimestampMsSchema),
})

export type EventUpdateInput = Schema.Schema.Type<typeof EventUpdateInputSchema>

export const EventDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema,
})

export type EventDeleteInput = Schema.Schema.Type<typeof EventDeleteInputSchema>

export const EventListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString),
})

export type EventListQuery = Schema.Schema.Type<typeof EventListQuerySchema>
