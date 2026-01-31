import type { Person } from "@satori/domain/domain/person"
import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"
import { Button } from "../ui/button"
import { buttonVariants } from "../ui/button-variants"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { SchemaIssueList } from "../SchemaIssueList"

export type PeopleCreateFormState = {
  readonly open: boolean
  readonly displayName: string
  readonly email: string
  readonly phone: string
  readonly issues: ReadonlyArray<SchemaIssue>
  readonly error: string | null
  readonly onOpenChange: (open: boolean) => void
  readonly onDisplayNameChange: (value: string) => void
  readonly onEmailChange: (value: string) => void
  readonly onPhoneChange: (value: string) => void
  readonly onCancel: () => void
  readonly onSubmit: () => void
}

export type PeoplePhotoDialogState = {
  readonly open: boolean
  readonly url: string | null
  readonly error: string | null
  readonly onClose: () => void
}

export type PeoplePageProps = {
  readonly query: string
  readonly loading: boolean
  readonly error: string | null
  readonly people: ReadonlyArray<Person>
  readonly onQueryChange: (value: string) => void
  readonly onRefresh: () => void
  readonly onDeletePerson: (id: string) => void
  readonly onViewPhoto: (photoId: string) => void
  readonly onUploadPhoto: (personId: string, file: File) => void
  readonly create: PeopleCreateFormState
  readonly photoDialog: PeoplePhotoDialogState
}

export const PeoplePage = ({
  query,
  loading,
  error,
  people,
  onQueryChange,
  onRefresh,
  onDeletePerson,
  onViewPhoto,
  onUploadPhoto,
  create,
  photoDialog,
}: PeoplePageProps): React.JSX.Element => (
  <div className="grid gap-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-2xl font-semibold">People</div>
        <div className="text-sm text-muted-foreground">
          Directory for registrations and attendance.
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name or email…"
          className="w-full sm:w-[280px]"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </Button>
          <Dialog open={create.open} onOpenChange={create.onOpenChange}>
            <DialogTrigger asChild>
              <Button>Add person</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add person</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="person-name">Display name</Label>
                  <Input
                    id="person-name"
                    value={create.displayName}
                    onChange={(event) => create.onDisplayNameChange(event.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="person-email">Email (optional)</Label>
                  <Input
                    id="person-email"
                    value={create.email}
                    onChange={(event) => create.onEmailChange(event.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="person-phone">Phone (optional)</Label>
                  <Input
                    id="person-phone"
                    value={create.phone}
                    onChange={(event) => create.onPhoneChange(event.target.value)}
                    placeholder="+1 (555) 555-5555"
                  />
                </div>

                <SchemaIssueList issues={create.issues} />
                {create.error ? (
                  <div className="text-sm text-destructive">{create.error}</div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={create.onCancel}>
                  Cancel
                </Button>
                <Button onClick={create.onSubmit}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>

    {error ? (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    ) : null}

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">All people</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[320px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">{person.displayName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {person.email ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {person.photoId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewPhoto(person.photoId!)}
                      >
                        View photo
                      </Button>
                    ) : null}

                    <label className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Upload photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0]
                          event.currentTarget.value = ""
                          if (!file) return
                          onUploadPhoto(person.id, file)
                        }}
                      />
                    </label>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDeletePerson(person.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {people.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  No people found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog open={photoDialog.open} onOpenChange={(open) => (open ? null : photoDialog.onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Photo</DialogTitle>
        </DialogHeader>

        {photoDialog.error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {photoDialog.error}
          </div>
        ) : null}

        {photoDialog.url ? (
          <div className="flex justify-center">
            <img
              src={photoDialog.url}
              alt="Person"
              className="max-h-[420px] w-auto rounded-md border object-contain"
            />
          </div>
        ) : photoDialog.error ? (
          <div className="text-sm text-muted-foreground">Unable to load photo.</div>
        ) : (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={photoDialog.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
)
