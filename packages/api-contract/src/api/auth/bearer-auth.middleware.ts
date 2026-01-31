import * as HttpApiMiddleware from "@effect/platform/HttpApiMiddleware"
import * as HttpApiSecurity from "@effect/platform/HttpApiSecurity"
import { Schema } from "effect"
import { BadRequest, InternalServerError, Unauthorized } from "../http-errors"
import { AuthContext } from "./auth-context"

const BearerAuthMiddlewareFailure = Schema.Union(
  Unauthorized,
  BadRequest,
  InternalServerError
)

export class BearerAuthMiddleware extends HttpApiMiddleware.Tag<BearerAuthMiddleware>()(
  "BearerAuthMiddleware",
  {
    security: {
      bearer: HttpApiSecurity.bearer,
    },
    failure: BearerAuthMiddlewareFailure,
    provides: AuthContext,
  }
) {}

