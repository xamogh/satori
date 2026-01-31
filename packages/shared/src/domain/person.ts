import { Schema } from "effect"
import { EntityIdSchema, Nullable, TimestampMsSchema } from "./common"
import { EmailSchema } from "../auth/schemas"

export const PersonSchema = Schema.Struct({
  id: EntityIdSchema,
  displayName: Schema.NonEmptyTrimmedString,
  email: Nullable(EmailSchema),
  phone: Nullable(Schema.String),
  photoId: Nullable(EntityIdSchema),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema),
})

export type Person = Schema.Schema.Type<typeof PersonSchema>

export const PersonCreateInputSchema = Schema.Struct({
  displayName: Schema.NonEmptyTrimmedString,
  email: Nullable(EmailSchema),
  phone: Nullable(Schema.String),
})

export type PersonCreateInput = Schema.Schema.Type<typeof PersonCreateInputSchema>

export const PersonUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  displayName: Schema.NonEmptyTrimmedString,
  email: Nullable(EmailSchema),
  phone: Nullable(Schema.String),
  photoId: Nullable(EntityIdSchema),
})

export type PersonUpdateInput = Schema.Schema.Type<typeof PersonUpdateInputSchema>

export const PersonDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema,
})

export type PersonDeleteInput = Schema.Schema.Type<typeof PersonDeleteInputSchema>

export const PersonListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString),
})

export type PersonListQuery = Schema.Schema.Type<typeof PersonListQuerySchema>
