import { Schema } from 'effect'
import { EntityIdSchema, Nullable, TimestampMsSchema } from './common'

export const RegistrationStatusSchema = Schema.Union(
  Schema.Literal('registered'),
  Schema.Literal('cancelled')
)

export type RegistrationStatus = Schema.Schema.Type<typeof RegistrationStatusSchema>

export const RegistrationSchema = Schema.Struct({
  id: EntityIdSchema,
  eventId: EntityIdSchema,
  personId: EntityIdSchema,
  status: RegistrationStatusSchema,
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type Registration = Schema.Schema.Type<typeof RegistrationSchema>

export const RegistrationCreateInputSchema = Schema.Struct({
  eventId: EntityIdSchema,
  personId: EntityIdSchema,
  status: RegistrationStatusSchema
})

export type RegistrationCreateInput = Schema.Schema.Type<typeof RegistrationCreateInputSchema>

export const RegistrationUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  eventId: EntityIdSchema,
  personId: EntityIdSchema,
  status: RegistrationStatusSchema
})

export type RegistrationUpdateInput = Schema.Schema.Type<typeof RegistrationUpdateInputSchema>

export const RegistrationDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type RegistrationDeleteInput = Schema.Schema.Type<typeof RegistrationDeleteInputSchema>

export const RegistrationListQuerySchema = Schema.Struct({
  eventId: Schema.optional(EntityIdSchema),
  personId: Schema.optional(EntityIdSchema)
})

export type RegistrationListQuery = Schema.Schema.Type<typeof RegistrationListQuerySchema>
