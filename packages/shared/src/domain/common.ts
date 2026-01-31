import { Schema } from "effect"

export const TimestampMsSchema = Schema.Number

export type TimestampMs = Schema.Schema.Type<typeof TimestampMsSchema>

export const EntityIdSchema = Schema.UUID

export type EntityId = Schema.Schema.Type<typeof EntityIdSchema>

export const Nullable = <A, I, R>(
  schema: Schema.Schema<A, I, R>
): Schema.Schema<A | null, I | null, R> => Schema.Union(schema, Schema.Null)

