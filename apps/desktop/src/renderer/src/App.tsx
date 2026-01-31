import { useCallback, useState } from "react"
import { Either, Schema } from "effect"
import { useAuth } from "./hooks/useAuth"
import { Button } from "./components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { SchemaIssueList } from "./components/SchemaIssueList"
import { EventsView } from "./containers/EventsView"
import { PeopleView } from "./containers/PeopleView"
import { SyncView } from "./containers/SyncView"
import { AuthSignInRequestSchema, type SchemaIssue } from "@satori/shared/ipc/contract"
import { formatParseIssues } from "@satori/shared/utils/parseIssue"
import { toErrorCause } from "@satori/shared/utils/errorCause"

function App(): React.JSX.Element {
  const { authState, signIn, signOut } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [issues, setIssues] = useState<ReadonlyArray<SchemaIssue>>([])
  const [error, setError] = useState("")

  const handleSignIn = useCallback((): void => {
    setError("")

    const decoded = Schema.decodeUnknownEither(AuthSignInRequestSchema)({
      email,
      password,
    })

    if (Either.isLeft(decoded)) {
      setIssues(formatParseIssues(decoded.left))
      return
    }

    setIssues([])
    signIn(decoded.right).catch((reason) => setError(toErrorCause(reason).message))
  }, [email, password, signIn])

  const handleSignOut = useCallback((): void => {
    setError("")
    signOut().catch((reason) => setError(toErrorCause(reason).message))
  }, [signOut])

  if (authState._tag === "Loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (authState._tag !== "Authenticated") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Satori Desktop</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {authState._tag === "Locked" ? (
              <div className="text-sm text-muted-foreground">
                Session expired. Please sign in again (internet required).
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                type="password"
              />
            </div>

            <SchemaIssueList issues={issues} />
            {error.length > 0 ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : null}

            <Button onClick={handleSignIn}>Sign in</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full">
      <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Satori Desktop</div>
            <div className="text-sm text-muted-foreground">
              {authState.email} · {authState.role}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error.length > 0 ? (
              <div className="max-w-[420px] truncate text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <Button variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>

        <Tabs defaultValue="events" className="flex-1">
          <TabsList>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="sync">Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <EventsView />
          </TabsContent>
          <TabsContent value="people">
            <PeopleView />
          </TabsContent>
          <TabsContent value="sync">
            <SyncView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
