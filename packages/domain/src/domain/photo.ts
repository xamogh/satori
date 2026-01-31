import { Schema } from "effect"
import { EntityIdSchema, Nullable, TimestampMsSchema } from "./common"

const photoFields = {
  id: EntityIdSchema,
  personId: EntityIdSchema,
  mimeType: Schema.NonEmptyTrimmedString,
  updatedAtMs: TimestampMsSchema,
  deletedAtMs: Nullable(TimestampMsSchema),
  serverModifiedAtMs: Nullable(TimestampMsSchema),
} as const

export const PhotoSchema = Schema.Struct({
  ...photoFields,
  bytes: Schema.Uint8ArrayFromSelf,
})

export type Photo = Schema.Schema.Type<typeof PhotoSchema>

export const PhotoApiSchema = Schema.Struct({
  ...photoFields,
  bytes: Schema.Uint8ArrayFromBase64,
})

export type PhotoApi = Schema.Schema.Type<typeof PhotoApiSchema>

export const PhotoCreateInputSchema = Schema.Struct({
  personId: EntityIdSchema,
  mimeType: Schema.NonEmptyTrimmedString,
  bytes: Schema.Uint8ArrayFromSelf,
})

export type PhotoCreateInput = Schema.Schema.Type<typeof PhotoCreateInputSchema>

export const PhotoDeleteInputSchema = Schema.Struct({
  id: EntityIdSchema,
})

export type PhotoDeleteInput = Schema.Schema.Type<typeof PhotoDeleteInputSchema>
