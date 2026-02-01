import { Schema } from 'effect'
import { BooleanFromNumberSchema, EntityIdSchema, Nullable, TimestampMsSchema } from './common'

export const EmpowermentSchema = Schema.Struct({
  id: EntityIdSchema,
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  className: Nullable(Schema.String),
  type: Nullable(Schema.String),
  form: Nullable(Schema.String),
  prerequisites: Nullable(Schema.String),
  majorEmpowerment: BooleanFromNumberSchema,
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type Empowerment = Schema.Schema.Type<typeof EmpowermentSchema>

export const EmpowermentCreateInputSchema = Schema.Struct({
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  className: Nullable(Schema.String),
  type: Nullable(Schema.String),
  form: Nullable(Schema.String),
  prerequisites: Nullable(Schema.String),
  majorEmpowerment: BooleanFromNumberSchema
})

export type EmpowermentCreateInput = Schema.Schema.Type<typeof EmpowermentCreateInputSchema>

export const EmpowermentUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  name: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  className: Nullable(Schema.String),
  type: Nullable(Schema.String),
  form: Nullable(Schema.String),
  prerequisites: Nullable(Schema.String),
  majorEmpowerment: BooleanFromNumberSchema
})

export type EmpowermentUpdateInput = Schema.Schema.Type<typeof EmpowermentUpdateInputSchema>

export const EmpowermentDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type EmpowermentDeleteInput = Schema.Schema.Type<typeof EmpowermentDeleteInputSchema>

export const EmpowermentListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString)
})

export type EmpowermentListQuery = Schema.Schema.Type<typeof EmpowermentListQuerySchema>
