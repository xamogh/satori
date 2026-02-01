import { Schema } from 'effect'
import { EntityIdSchema, Nullable, TimestampMsSchema } from './common'

export const MahakramaStepSchema = Schema.Struct({
  id: EntityIdSchema,
  stepId: Schema.NonEmptyTrimmedString,
  stepName: Schema.NonEmptyTrimmedString,
  sequenceNumber: Schema.Number,
  groupId: Schema.NonEmptyTrimmedString,
  groupName: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type MahakramaStep = Schema.Schema.Type<typeof MahakramaStepSchema>

export const MahakramaStepCreateInputSchema = Schema.Struct({
  stepId: Schema.NonEmptyTrimmedString,
  stepName: Schema.NonEmptyTrimmedString,
  sequenceNumber: Schema.Number,
  groupId: Schema.NonEmptyTrimmedString,
  groupName: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String)
})

export type MahakramaStepCreateInput = Schema.Schema.Type<typeof MahakramaStepCreateInputSchema>

export const MahakramaStepUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  stepId: Schema.NonEmptyTrimmedString,
  stepName: Schema.NonEmptyTrimmedString,
  sequenceNumber: Schema.Number,
  groupId: Schema.NonEmptyTrimmedString,
  groupName: Schema.NonEmptyTrimmedString,
  description: Nullable(Schema.String)
})

export type MahakramaStepUpdateInput = Schema.Schema.Type<typeof MahakramaStepUpdateInputSchema>

export const MahakramaStepDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type MahakramaStepDeleteInput = Schema.Schema.Type<typeof MahakramaStepDeleteInputSchema>

export const MahakramaStepListQuerySchema = Schema.Struct({
  query: Schema.optional(Schema.NonEmptyTrimmedString)
})

export type MahakramaStepListQuery = Schema.Schema.Type<typeof MahakramaStepListQuerySchema>

export const MahakramaHistorySchema = Schema.Struct({
  id: EntityIdSchema,
  personId: EntityIdSchema,
  mahakramaStepId: EntityIdSchema,
  startDateMs: TimestampMsSchema,
  endDateMs: Nullable(TimestampMsSchema),
  status: Schema.NonEmptyTrimmedString,
  mahakramaInstructorPersonId: Nullable(EntityIdSchema),
  completionNotes: Nullable(Schema.String),
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema)
})

export type MahakramaHistory = Schema.Schema.Type<typeof MahakramaHistorySchema>

export const MahakramaHistoryCreateInputSchema = Schema.Struct({
  personId: EntityIdSchema,
  mahakramaStepId: EntityIdSchema,
  startDateMs: TimestampMsSchema,
  endDateMs: Nullable(TimestampMsSchema),
  status: Schema.NonEmptyTrimmedString,
  mahakramaInstructorPersonId: Nullable(EntityIdSchema),
  completionNotes: Nullable(Schema.String)
})

export type MahakramaHistoryCreateInput = Schema.Schema.Type<
  typeof MahakramaHistoryCreateInputSchema
>

export const MahakramaHistoryUpdateInputSchema = Schema.Struct({
  id: EntityIdSchema,
  personId: EntityIdSchema,
  mahakramaStepId: EntityIdSchema,
  startDateMs: TimestampMsSchema,
  endDateMs: Nullable(TimestampMsSchema),
  status: Schema.NonEmptyTrimmedString,
  mahakramaInstructorPersonId: Nullable(EntityIdSchema),
  completionNotes: Nullable(Schema.String)
})

export type MahakramaHistoryUpdateInput = Schema.Schema.Type<
  typeof MahakramaHistoryUpdateInputSchema
>

export const MahakramaHistoryDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema
})

export type MahakramaHistoryDeleteInput = Schema.Schema.Type<
  typeof MahakramaHistoryDeleteInputSchema
>

export const MahakramaHistoryListQuerySchema = Schema.Struct({
  personId: Schema.optional(EntityIdSchema)
})

export type MahakramaHistoryListQuery = Schema.Schema.Type<typeof MahakramaHistoryListQuerySchema>
