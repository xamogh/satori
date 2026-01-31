import { Schema } from "effect"

export const ErrorCauseSchema = Schema.Struct({
  name: Schema.String,
  message: Schema.String,
  stack: Schema.optional(Schema.String),
})

export type ErrorCause = Schema.Schema.Type<typeof ErrorCauseSchema>

export const toErrorCause = (cause: unknown): ErrorCause => {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    }
  }

  return {
    name: "Unknown",
    message: String(cause),
  }
}

