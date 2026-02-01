import { useRef } from "react"
import type { Person } from "@satori/domain/domain/person"
import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"
import { Users, Plus, Search, RefreshCw, AlertCircle, Mail, Phone, Image } from "lucide-react"
import { Button } from "../ui/button"
import { DataTable, type DataTableColumn } from "../data-table/DataTable"
import { DataTablePagination } from "../data-table/DataTablePagination"
import { RowActionsMenu } from "../data-table/RowActionsMenu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { SchemaIssueList } from "../SchemaIssueList"
import { Alert, AlertDescription } from "../ui/alert"
import { PageHeader, PageContainer } from "../layout/PageHeader"
import { EmptyState } from "../ui/empty-state"
import { Badge } from "../ui/badge"
import { Avatar, AvatarFallback } from "../ui/avatar"

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
  readonly peopleTotal: number
  readonly pageIndex: number
  readonly pageSize: number
  readonly onPageIndexChange: (pageIndex: number) => void
  readonly onPageSizeChange: (pageSize: number) => void
  readonly onQueryChange: (value: string) => void
  readonly onRefresh: () => void
  readonly onDeletePerson: (id: string) => void
  readonly onViewPhoto: (photoId: string) => void
  readonly onUploadPhoto: (personId: string, file: File) => void
  readonly create: PeopleCreateFormState
  readonly photoDialog: PeoplePhotoDialogState
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const peopleColumns = (
  onDeletePerson: (id: string) => void,
  onViewPhoto: (photoId: string) => void,
  onUploadPhoto: (personId: string, file: File) => void
): ReadonlyArray<DataTableColumn<Person>> => [
  {
    id: "person",
    header: "Person",
    cell: (person) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {getInitials(person.displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{person.displayName}</p>
          {person.email ? (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{person.email}</span>
            </div>
          ) : null}
        </div>
      </div>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    cell: (person) => (
      <div className="space-y-1 text-sm">
        {person.phone ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>{person.phone}</span>
          </div>
        ) : null}
        {person.photoId ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Image className="h-3.5 w-3.5" />
            <span>Has photo</span>
          </div>
        ) : null}
        {!person.phone && !person.photoId ? (
          <span className="text-muted-foreground">No contact info</span>
        ) : null}
      </div>
    ),
  },
  {
    id: "actions",
    header: "",
    headerClassName: "w-[56px]",
    cellClassName: "text-right",
    cell: (person) => (
      <PersonActionsCell
        person={person}
        onDeletePerson={onDeletePerson}
        onViewPhoto={onViewPhoto}
        onUploadPhoto={onUploadPhoto}
      />
    ),
  },
]

export const PeoplePage = ({
  query,
  loading,
  error,
  people,
  peopleTotal,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  onQueryChange,
  onRefresh,
  onDeletePerson,
  onViewPhoto,
  onUploadPhoto,
  create,
  photoDialog,
}: PeoplePageProps): React.JSX.Element => (
  <PageContainer>
    <PageHeader
      icon={<Users className="h-5 w-5" />}
      title="People"
      description="Directory for registrations and attendance tracking."
      badge={
        peopleTotal > 0 ? (
          <Badge variant="secondary">{peopleTotal} total</Badge>
        ) : null
      }
      actions={
        <Dialog open={create.open} onOpenChange={create.onOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Person
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Person</DialogTitle>
              <DialogDescription>
                Add a new person to your directory.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
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
                  type="email"
                  value={create.email}
                  onChange={(event) => create.onEmailChange(event.target.value)}
                  placeholder="jane@example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="person-phone">Phone (optional)</Label>
                <Input
                  id="person-phone"
                  type="tel"
                  value={create.phone}
                  onChange={(event) => create.onPhoneChange(event.target.value)}
                  placeholder="+1 (555) 555-5555"
                />
              </div>

              <SchemaIssueList issues={create.issues} />
              {create.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{create.error}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={create.onCancel}>
                Cancel
              </Button>
              <Button onClick={create.onSubmit}>Add Person</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    />

    {error ? (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search people..."
          className="pl-8"
        />
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
        {loading ? "Loading..." : "Refresh"}
      </Button>
    </div>

    {people.length === 0 && !loading ? (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="No people found"
        description={query ? "Try adjusting your search terms." : "Get started by adding your first person."}
        action={
          !query ? (
            <Button size="sm" onClick={() => create.onOpenChange(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Person
            </Button>
          ) : undefined
        }
      />
    ) : (
      <>
        <DataTable
          columns={peopleColumns(onDeletePerson, onViewPhoto, onUploadPhoto)}
          rows={people}
          loading={loading}
          getRowKey={(person) => person.id}
        />
        <DataTablePagination
          totalItems={peopleTotal}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={onPageIndexChange}
          onPageSizeChange={onPageSizeChange}
        />
      </>
    )}

    <Dialog open={photoDialog.open} onOpenChange={(open) => (open ? null : photoDialog.onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Photo</DialogTitle>
        </DialogHeader>

        {photoDialog.error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{photoDialog.error}</AlertDescription>
          </Alert>
        ) : null}

        {photoDialog.url ? (
          <div className="flex justify-center rounded-lg bg-muted/50 p-4">
            <img
              src={photoDialog.url}
              alt="Person"
              className="max-h-[400px] w-auto rounded-md object-contain"
            />
          </div>
        ) : photoDialog.error ? (
          <EmptyState
            icon={<Image className="h-6 w-6" />}
            title="Unable to load photo"
            description="There was an error loading this photo."
            className="py-8"
          />
        ) : (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={photoDialog.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </PageContainer>
)

type PersonActionsCellProps = {
  readonly person: Person
  readonly onDeletePerson: (id: string) => void
  readonly onViewPhoto: (photoId: string) => void
  readonly onUploadPhoto: (personId: string, file: File) => void
}

const PersonActionsCell = ({
  person,
  onDeletePerson,
  onViewPhoto,
  onUploadPhoto,
}: PersonActionsCellProps): React.JSX.Element => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoId = person.photoId

  return (
    <div className="flex items-center justify-end">
      <RowActionsMenu
        label="Open person actions"
        actions={[
          ...(photoId
            ? [
                {
                  id: "view_photo",
                  label: "View photo",
                  onSelect: () => onViewPhoto(photoId),
                },
              ]
            : []),
          {
            id: "upload_photo",
            label: "Upload photo",
            onSelect: () => fileInputRef.current?.click(),
          },
          {
            id: "delete",
            label: "Delete",
            destructive: true,
            onSelect: () => onDeletePerson(person.id),
          },
        ]}
      />
      <input
        ref={fileInputRef}
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
    </div>
  )
}
