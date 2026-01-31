import { useCallback, useMemo, useState, useSyncExternalStore } from "react"
import { Either, Schema } from "effect"
import { PeoplePage } from "../components/pages/PeoplePage"
import { PersonCreateInputSchema, type Person } from "@satori/domain/domain/person"
import type { SchemaIssue } from "@satori/ipc-contract/ipc/contract"
import { formatParseIssues } from "@satori/ipc-contract/utils/parseIssue"
import { createStore } from "../utils/store"

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

type PeopleListState = {
  readonly people: ReadonlyArray<Person>
  readonly loading: boolean
  readonly error: string | null
}

const peopleListStore = createStore<PeopleListState>({
  people: [],
  loading: false,
  error: null,
})

let peopleListStarted = false
let peopleListRequestId = 0

const refreshPeopleList = (query: string | undefined): Promise<void> => {
  peopleListRequestId += 1
  const requestId = peopleListRequestId

  peopleListStore.updateSnapshot((current) => ({
    ...current,
    loading: true,
    error: null,
  }))

  return window.api.personsList({ query }).then(
    (result) => {
      if (peopleListRequestId !== requestId) {
        return
      }

      if (result._tag === "Ok") {
        peopleListStore.setSnapshot({
          people: result.value,
          loading: false,
          error: null,
        })
        return
      }

      peopleListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: result.error.message,
      }))
    },
    (reason) => {
      if (peopleListRequestId !== requestId) {
        return
      }

      peopleListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: reason instanceof Error ? reason.message : String(reason),
      }))
    }
  )
}

const subscribePeopleList = (listener: () => void): (() => void) => {
  if (!peopleListStarted) {
    peopleListStarted = true
    void refreshPeopleList(undefined)
  }

  return peopleListStore.subscribe(listener)
}

export const PeopleContainer = (): React.JSX.Element => {
  const { people, loading, error } = useSyncExternalStore(
    subscribePeopleList,
    peopleListStore.getSnapshot,
    peopleListStore.getSnapshot
  )

  const [query, setQuery] = useState("")
  const normalizedQuery = useMemo(() => normalizeQuery(query), [query])

  const [createOpen, setCreateOpen] = useState(false)
  const [createDisplayName, setCreateDisplayName] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createIssues, setCreateIssues] = useState<ReadonlyArray<SchemaIssue>>([])
  const [createError, setCreateError] = useState<string | null>(null)

  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const refresh = useCallback((): void => {
    void refreshPeopleList(normalizedQuery)
  }, [normalizedQuery])

  const cancelCreate = useCallback((): void => {
    setCreateOpen(false)
    setCreateIssues([])
    setCreateError(null)
  }, [])

  const closePhotoDialog = useCallback((): void => {
    setPhotoOpen(false)
    setPhotoError(null)
    setPhotoUrl((current) => {
      if (typeof current === "string") {
        URL.revokeObjectURL(current)
      }
      return null
    })
  }, [])

  const submitCreate = useCallback((): void => {
    setCreateError(null)

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
      (reason) => setCreateError(reason instanceof Error ? reason.message : String(reason))
    )
  }, [createDisplayName, createEmail, createPhone, refresh])

  const deletePerson = useCallback(
    (id: string): void => {
      window.api.personsDelete({ id }).then(
        (result) => {
          if (result._tag === "Ok") {
            refresh()
            return
          }

          peopleListStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message,
          }))
        },
        (reason) =>
          peopleListStore.updateSnapshot((current) => ({
            ...current,
            error: reason instanceof Error ? reason.message : String(reason),
          }))
      )
    },
    [refresh]
  )

  const viewPhoto = useCallback((photoId: string): void => {
    setPhotoError(null)
    setPhotoOpen(true)
    setPhotoUrl((current) => {
      if (typeof current === "string") {
        URL.revokeObjectURL(current)
      }
      return null
    })

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
      (reason) => setPhotoError(reason instanceof Error ? reason.message : String(reason))
    )
  }, [])

  const uploadPhotoForPerson = useCallback(
    (personId: string, file: File): void => {
      peopleListStore.updateSnapshot((current) => ({ ...current, error: null }))

      fileToBytes(file)
        .then((bytes) =>
          window.api.photosCreate({
            personId,
            mimeType: mimeTypeOrDefault(file),
            bytes,
          })
        )
        .then(
          (result) => {
            if (result._tag === "Ok") {
              refresh()
              return
            }

            peopleListStore.updateSnapshot((current) => ({
              ...current,
              error: result.error.message,
            }))
          },
          (reason) =>
            peopleListStore.updateSnapshot((current) => ({
              ...current,
              error: reason instanceof Error ? reason.message : String(reason),
            }))
        )
    },
    [refresh]
  )

  return (
    <PeoplePage
      query={query}
      loading={loading}
      error={error}
      people={people}
      onQueryChange={setQuery}
      onRefresh={refresh}
      onDeletePerson={deletePerson}
      onViewPhoto={viewPhoto}
      onUploadPhoto={uploadPhotoForPerson}
      create={{
        open: createOpen,
        displayName: createDisplayName,
        email: createEmail,
        phone: createPhone,
        issues: createIssues,
        error: createError,
        onOpenChange: (open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateIssues([])
            setCreateError(null)
          }
        },
        onDisplayNameChange: setCreateDisplayName,
        onEmailChange: setCreateEmail,
        onPhoneChange: setCreatePhone,
        onCancel: cancelCreate,
        onSubmit: submitCreate,
      }}
      photoDialog={{
        open: photoOpen,
        url: photoUrl,
        error: photoError,
        onClose: closePhotoDialog,
      }}
    />
  )
}
