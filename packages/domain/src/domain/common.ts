import { Schema } from "effect"

export const TimestampMsSchema = Schema.Number

export type TimestampMs = Schema.Schema.Type<typeof TimestampMsSchema>

export const EntityIdSchema = Schema.UUID

export type EntityId = Schema.Schema.Type<typeof EntityIdSchema>

export const BooleanFromNumberSchema = Schema.transform(
  Schema.Union(Schema.Boolean, Schema.Number),
  Schema.Boolean,
  {
    decode: (value) => (typeof value === "number" ? value !== 0 : value),
    encode: (value) => value,
  }
)

export type BooleanFromNumber = Schema.Schema.Type<
  typeof BooleanFromNumberSchema
>

export const Nullable = <A, I, R>(
  schema: Schema.Schema<A, I, R>
): Schema.Schema<A | null, I | null, R> => Schema.Union(schema, Schema.Null)
