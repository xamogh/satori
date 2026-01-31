import { Layer } from "effect"
import { AuthApiLive } from "./auth/auth-api-live"
import { HealthApiLive } from "./health/health-api-live"
import { SyncApiLive } from "./sync/sync-api-live"

export const ApiGroupsLive = Layer.mergeAll(HealthApiLive, AuthApiLive, SyncApiLive)

