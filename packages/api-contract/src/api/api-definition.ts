import { HttpApi } from "@effect/platform"
import { BearerAuthMiddleware } from "./auth/bearer-auth.middleware"
import { authApiGroup } from "./auth/auth-api"
import { healthApiGroup } from "./health/health-api"
import { syncApiGroup } from "./sync/sync-api"

export const Api = HttpApi.make("api")
  .add(healthApiGroup)
  .add(authApiGroup)
  .add(syncApiGroup.middleware(BearerAuthMiddleware))

