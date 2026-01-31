import { Schema } from "effect"
import { ErrorCauseSchema } from "@satori/shared/utils/errorCause"

export class EnvError extends Schema.TaggedError<EnvError>("EnvError")("EnvError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class BodyReadError extends Schema.TaggedError<BodyReadError>("BodyReadError")(
  "BodyReadError",
  {
    message: Schema.String,
    cause: ErrorCauseSchema,
  }
) {}

export class JsonParseError extends Schema.TaggedError<JsonParseError>("JsonParseError")(
  "JsonParseError",
  {
    message: Schema.String,
    cause: ErrorCauseSchema,
  }
) {}

export class RequestDecodeError extends Schema.TaggedError<RequestDecodeError>(
  "RequestDecodeError"
)("RequestDecodeError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class DbError extends Schema.TaggedError<DbError>("DbError")("DbError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class MigrationError extends Schema.TaggedError<MigrationError>(
  "MigrationError"
)("MigrationError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class PasswordHashError extends Schema.TaggedError<PasswordHashError>(
  "PasswordHashError"
)("PasswordHashError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class PasswordVerifyError extends Schema.TaggedError<PasswordVerifyError>(
  "PasswordVerifyError"
)("PasswordVerifyError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>(
  "UnauthorizedError"
)("UnauthorizedError", {
  message: Schema.String,
}) {}

export class JwtError extends Schema.TaggedError<JwtError>("JwtError")("JwtError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}
