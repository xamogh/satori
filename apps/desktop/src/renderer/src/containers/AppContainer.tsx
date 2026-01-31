import { useCallback, useState, useSyncExternalStore } from "react"
import { Either, Schema } from "effect"
import { AuthScreen } from "../components/auth/AuthScreen"
import { DashboardContainer } from "./DashboardContainer"
import { AuthSignInRequestSchema } from "@satori/ipc-contract/ipc/contract"
import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"
import { formatParseIssues } from "@satori/ipc-contract/utils/parseIssue"
import { AuthStore } from "../services/AuthStore"

export const AppContainer = (): React.JSX.Element => {
  const authState = useSyncExternalStore(
    AuthStore.subscribe,
    AuthStore.getSnapshot,
    AuthStore.getSnapshot
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [issues, setIssues] = useState<ReadonlyArray<SchemaIssue>>([])
  const [error, setError] = useState<string | null>(null)

  const signIn = useCallback((): void => {
    setError(null)

    const decoded = Schema.decodeUnknownEither(AuthSignInRequestSchema)({
      email,
      password,
    })

    if (Either.isLeft(decoded)) {
      setIssues(formatParseIssues(decoded.left))
      return
    }

    setIssues([])
    AuthStore.signIn(decoded.right).then(
      (result) => {
        if (result._tag === "Ok") {
          setPassword("")
          return
        }

        setError(result.error.message)
      },
      (reason) => setError(reason instanceof Error ? reason.message : String(reason))
    )
  }, [email, password])

  const signOut = useCallback((): void => {
    setError(null)
    AuthStore.signOut().then(
      (result) => {
        if (result._tag === "Ok") return
        setError(result.error.message)
      },
      (reason) => setError(reason instanceof Error ? reason.message : String(reason))
    )
  }, [])

  if (authState._tag === "Loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (authState._tag !== "Authenticated") {
    return (
      <AuthScreen
        appName="Satori Desktop"
        mode={authState._tag === "Locked" ? "locked" : "unauthenticated"}
        email={email}
        password={password}
        issues={issues}
        error={error}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={signIn}
      />
    )
  }

  return (
    <DashboardContainer auth={authState} onSignOut={signOut} appError={error} />
  )
}
