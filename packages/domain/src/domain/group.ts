import { Schema } from 'effect'
import { EntityIdSchema, Nullable, TimestampMsSchema } from './common'

export const GroupSchema = Schema.Struct({
  id: EntityIdSchema,
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type Group = Schema.Schema.Type<typeof GroupSchema>

export const GroupCreateInputSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String)
})

export type GroupCreateInput = Schema.Schema.Type<typeof GroupCreateInputSchema>

export const GroupUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String)
})

export type GroupUpdateInput = Schema.Schema.Type<typeof GroupUpdateInputSchema>

export const GroupDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type GroupDeleteInput = Schema.Schema.Type<typeof GroupDeleteInputSchema>

export const GroupListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString)
})

export type GroupListQuery = Schema.Schema.Type<typeof GroupListQuerySchema>

export const PersonGroupSchema = Schema.Struct({
  id: EntityIdSchema,
  groupId: EntityIdSchema,
  personId: EntityIdSchema,
  joinedAtMs: Nullable(TimestampMsSchema),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type PersonGroup = Schema.Schema.Type<typeof PersonGroupSchema>

export const PersonGroupCreateInputSchema = Schema.Struct({
  groupId: EntityIdSchema,
  personId: EntityIdSchema,
  joinedAtMs: Nullable(TimestampMsSchema)
})

export type PersonGroupCreateInput = Schema.Schema.Type<typeof PersonGroupCreateInputSchema>

export const PersonGroupUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  groupId: EntityIdSchema,
  personId: EntityIdSchema,
  joinedAtMs: Nullable(TimestampMsSchema)
})

export type PersonGroupUpdateInput = Schema.Schema.Type<typeof PersonGroupUpdateInputSchema>

export const PersonGroupDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type PersonGroupDeleteInput = Schema.Schema.Type<typeof PersonGroupDeleteInputSchema>

export const PersonGroupListQuerySchema = Schema.Struct({
  groupId: Schema.optional(EntityIdSchema),
  personId: Schema.optional(EntityIdSchema)
})

export type PersonGroupListQuery = Schema.Schema.Type<typeof PersonGroupListQuerySchema>
