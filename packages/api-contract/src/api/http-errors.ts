import * as HttpApiSchema from "@effect/platform/HttpApiSchema"
import { Schema } from "effect"

export class BadRequest extends Schema.TaggedError<BadRequest>("BadRequest")(
  "BadRequest",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
  HttpApiSchema.annotations({
    status: 400,
    description: "The request was invalid or cannot be otherwise served",
  })
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>("Unauthorized")(
  "Unauthorized",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
  HttpApiSchema.annotations({
    status: 401,
    description:
      "Authentication is required and has failed or has not been provided",
  })
) {}

export class InternalServerError extends Schema.TaggedError<InternalServerError>(
  "InternalServerError"
)(
  "InternalServerError",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
  HttpApiSchema.annotations({
    status: 500,
    description: "An unexpected internal server error occurred",
  })
) {}

