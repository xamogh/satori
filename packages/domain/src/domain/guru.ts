import { Schema } from "effect"
import { EntityIdSchema, Nullable, TimestampMsSchema } from "./common"

export const GuruSchema = Schema.Struct({
  id: EntityIdSchema,
  name: Schema.NonEmptyTrimmedString,
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema),
})

export type Guru = Schema.Schema.Type<typeof GuruSchema>

export const GuruCreateInputSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
})

export type GuruCreateInput = Schema.Schema.Type<typeof GuruCreateInputSchema>

export const GuruUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  name: Schema.NonEmptyTrimmedString,
})

export type GuruUpdateInput = Schema.Schema.Type<typeof GuruUpdateInputSchema>

export const GuruDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema,
})

export type GuruDeleteInput = Schema.Schema.Type<typeof GuruDeleteInputSchema>

export const GuruListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString),
})

export type GuruListQuery = Schema.Schema.Type<typeof GuruListQuerySchema>
