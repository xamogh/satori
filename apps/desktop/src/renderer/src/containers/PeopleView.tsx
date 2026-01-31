import { useCallback, useEffect, useMemo, useState } from "react"
import { Either, Schema } from "effect"
import { Button } from "../components/ui/button"
import { buttonVariants } from "../components/ui/button-variants"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { SchemaIssueList } from "../components/SchemaIssueList"
import {
  PersonCreateInputSchema,
  type Person,
} from "@satori/domain/domain/person"
import { formatParseIssues } from "@satori/ipc-contract/utils/parseIssue"
import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"

const normalizeQuery = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const fileToBytes = async (file: File): Promise<Uint8Array> => {
  const buffer = await file.arrayBuffer()
  return new Uint8Array(buffer)
}

const mimeTypeOrDefault = (file: File): string =>
  file.type.trim().length > 0 ? file.type : "application/octet-stream"

export const PeopleView = (): React.JSX.Element => {
  const [query, setQuery] = useState("")
  const normalizedQuery = useMemo(() => normalizeQuery(query), [query])

  const [people, setPeople] = useState<ReadonlyArray<Person>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const [createOpen, setCreateOpen] = useState(false)
  const [createDisplayName, setCreateDisplayName] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createIssues, setCreateIssues] = useState<ReadonlyArray<SchemaIssue>>([])
  const [createError, setCreateError] = useState<string>("")

  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string>("")

  const closePhotoDialog = useCallback((): void => {
    setPhotoOpen(false)
    setPhotoError("")
    setPhotoUrl((current) => {
      if (typeof current === "string") {
        URL.revokeObjectURL(current)
      }
      return null
    })
  }, [])

  const refresh = useCallback((): void => {
    setLoading(true)
    setError("")

    window.api
      .personsList({ query: normalizedQuery })
      .then(
        (result) => {
          if (result._tag === "Ok") {
            setPeople(result.value)
            return
          }

          setError(result.error.message)
        },
        (reason) => setError(String(reason))
      )
      .finally(() => setLoading(false))
  }, [normalizedQuery])

  useEffect(() => {
    const id = window.setTimeout(() => {
      refresh()
    }, 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  const submitCreate = useCallback((): void => {
    setCreateError("")

    const decoded = Schema.decodeUnknownEither(PersonCreateInputSchema)({
      displayName: createDisplayName,
      email: createEmail.trim().length === 0 ? null : createEmail,
      phone: createPhone.trim().length === 0 ? null : createPhone,
    })

    if (Either.isLeft(decoded)) {
      setCreateIssues(formatParseIssues(decoded.left))
      return
    }

    setCreateIssues([])
    window.api.personsCreate(decoded.right).then(
      (result) => {
        if (result._tag === "Ok") {
          setCreateOpen(false)
          setCreateDisplayName("")
          setCreateEmail("")
          setCreatePhone("")
          refresh()
          return
        }

        setCreateError(result.error.message)
      },
      (reason) => setCreateError(String(reason))
    )
  }, [createDisplayName, createEmail, createPhone, refresh])

  const deletePerson = useCallback(
    (id: string): void => {
      setError("")
      window.api.personsDelete({ id }).then(
        (result) => {
          if (result._tag === "Ok") {
            refresh()
            return
          }
          setError(result.error.message)
        },
        (reason) => setError(String(reason))
      )
    },
    [refresh]
  )

  const viewPhoto = useCallback(
    (photoId: string): void => {
      setPhotoError("")
      setPhotoOpen(true)

      window.api.photosGet({ id: photoId }).then(
        (result) => {
          if (result._tag !== "Ok") {
            setPhotoError(result.error.message)
            return
          }

          const bytes = Uint8Array.from(result.value.bytes)
          const blob = new Blob([bytes], { type: result.value.mimeType })
          const url = URL.createObjectURL(blob)

          setPhotoUrl((current) => {
            if (typeof current === "string") {
              URL.revokeObjectURL(current)
            }
            return url
          })
        },
        (reason) => setPhotoError(String(reason))
      )
    },
    []
  )

  const uploadPhotoForPerson = useCallback(
    async (personId: string, file: File): Promise<void> => {
      setError("")

      const bytes = await fileToBytes(file)
      const mimeType = mimeTypeOrDefault(file)

      const result = await window.api.photosCreate({ personId, mimeType, bytes })
      if (result._tag === "Ok") {
        refresh()
        return
      }

      setError(result.error.message)
    },
    [refresh]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>People</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email…"
            className="w-[260px]"
          />
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Search"}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                    value={createDisplayName}
                    onChange={(event) => setCreateDisplayName(event.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="person-email">Email (optional)</Label>
                  <Input
                    id="person-email"
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="person-phone">Phone (optional)</Label>
                  <Input
                    id="person-phone"
                    value={createPhone}
                    onChange={(event) => setCreatePhone(event.target.value)}
                    placeholder="+1 (555) 555-5555"
                  />
                </div>

                <SchemaIssueList issues={createIssues} />
                {createError.length > 0 ? (
                  <div className="text-sm text-destructive">{createError}</div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {error.length > 0 ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[260px] text-right">Actions</TableHead>
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
                        onClick={() => viewPhoto(person.photoId!)}
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
                          uploadPhotoForPerson(person.id, file).catch((reason) =>
                            setError(String(reason))
                          )
                        }}
                      />
                    </label>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deletePerson(person.id)}
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

      <Dialog open={photoOpen} onOpenChange={(open) => (open ? null : closePhotoDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Photo</DialogTitle>
          </DialogHeader>

          {photoError.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {photoError}
            </div>
          ) : null}

          {photoUrl ? (
            <div className="flex justify-center">
              <img
                src={photoUrl}
                alt="Person"
                className="max-h-[420px] w-auto rounded-md border object-contain"
              />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={closePhotoDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
