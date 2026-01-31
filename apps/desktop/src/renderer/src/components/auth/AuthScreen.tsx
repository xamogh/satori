import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { SchemaIssueList } from "../SchemaIssueList"

export type AuthScreenProps = {
  readonly appName: string
  readonly mode: "unauthenticated" | "locked"
  readonly email: string
  readonly password: string
  readonly issues: ReadonlyArray<SchemaIssue>
  readonly error: string | null
  readonly onEmailChange: (email: string) => void
  readonly onPasswordChange: (password: string) => void
  readonly onSubmit: () => void
}

export const AuthScreen = ({
  appName,
  mode,
  email,
  password,
  issues,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthScreenProps): React.JSX.Element => (
  <div className="flex h-full items-center justify-center p-6">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{appName}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {mode === "locked" ? (
          <div className="text-sm text-muted-foreground">
            Session expired. Please sign in again (internet required).
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="••••••••"
            type="password"
          />
        </div>

        <SchemaIssueList issues={issues} />
        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <Button onClick={onSubmit}>Sign in</Button>
      </CardContent>
    </Card>
  </div>
)
