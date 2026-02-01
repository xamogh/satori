import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import { GroupsPage, type GroupsCreateFormValues } from '../components/pages/GroupsPage'
import {
  GroupCreateInputSchema,
  type Group,
  type GroupCreateInput
} from '@satori/domain/domain/group'
import { createStore } from '../utils/store'
import { clampPageIndex, slicePage } from '../utils/pagination'
import { createSchemaFormValidator } from '../utils/formValidation'
import { trimToNull } from '../utils/string'

const normalizeQuery = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

type GroupsListState = {
  readonly groups: ReadonlyArray<Group>
  readonly loading: boolean
  readonly error: string | null
}

const groupsListStore = createStore<GroupsListState>({
  groups: [],
  loading: false,
  error: null
})

let groupsListStarted = false
let groupsListRequestId = 0

const refreshGroupsList = (query: string | undefined): Promise<void> => {
  groupsListRequestId += 1
  const requestId = groupsListRequestId

  groupsListStore.updateSnapshot((current) => ({
    ...current,
    loading: true,
    error: null
  }))

  return window.api.groupsList({ query }).then(
    (result) => {
      if (groupsListRequestId !== requestId) {
        return
      }

      if (result._tag === 'Ok') {
        groupsListStore.setSnapshot({
          groups: result.value,
          loading: false,
          error: null
        })
        return
      }

      groupsListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: result.error.message
      }))
    },
    (reason) => {
      if (groupsListRequestId !== requestId) {
        return
      }

      groupsListStore.updateSnapshot((current) => ({
        ...current,
        loading: false,
        error: String(reason)
      }))
    }
  )
}

const subscribeGroupsList = (listener: () => void): (() => void) => {
  if (!groupsListStarted) {
    groupsListStarted = true
    void refreshGroupsList(undefined)
  }

  return groupsListStore.subscribe(listener)
}

export const GroupsContainer = (): React.JSX.Element => {
  const { groups, loading, error } = useSyncExternalStore(
    subscribeGroupsList,
    groupsListStore.getSnapshot,
    groupsListStore.getSnapshot
  )

  const [query, setQuery] = useState('')
  const normalizedQuery = useMemo(() => normalizeQuery(query), [query])

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const safePageIndex = useMemo(
    () => clampPageIndex(pageIndex, groups.length, pageSize),
    [pageIndex, pageSize, groups.length]
  )

  const pagedGroups = useMemo(
    () => slicePage(groups, safePageIndex, pageSize),
    [groups, safePageIndex, pageSize]
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const refresh = useCallback((): void => {
    setPageIndex(0)
    void refreshGroupsList(normalizedQuery)
  }, [normalizedQuery])

  const buildGroupCreateInput = useCallback(
    (values: GroupsCreateFormValues): GroupCreateInput => ({
      name: values.name,
      description: trimToNull(values.description)
    }),
    []
  )

  const groupCreateDefaults: GroupsCreateFormValues = {
    name: '',
    description: ''
  }

  const groupCreateForm = useForm({
    defaultValues: groupCreateDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(
        GroupCreateInputSchema,
        (values: GroupsCreateFormValues) => Either.right(buildGroupCreateInput(values))
      )
    },
    onSubmit: ({ value, formApi }) => {
      setCreateError(null)
      return window.api.groupsCreate(buildGroupCreateInput(value)).then(
        (result) => {
          if (result._tag === 'Ok') {
            setCreateOpen(false)
            formApi.reset()
            refresh()
            return
          }

          setCreateError(result.error.message)
        },
        (reason) => setCreateError(String(reason))
      )
    }
  })

  const cancelCreate = useCallback((): void => {
    setCreateOpen(false)
    setCreateError(null)
    groupCreateForm.reset()
  }, [groupCreateForm])

  const deleteGroup = useCallback(
    (id: string): void => {
      window.api.groupsDelete({ id }).then(
        (result) => {
          if (result._tag === 'Ok') {
            refresh()
            return
          }

          groupsListStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message
          }))
        },
        (reason) =>
          groupsListStore.updateSnapshot((current) => ({
            ...current,
            error: String(reason)
          }))
      )
    },
    [refresh]
  )

  return (
    <GroupsPage
      query={query}
      loading={loading}
      error={error}
      groups={pagedGroups}
      groupsTotal={groups.length}
      pageIndex={safePageIndex}
      pageSize={pageSize}
      onPageIndexChange={setPageIndex}
      onPageSizeChange={(nextPageSize) => {
        setPageIndex(0)
        setPageSize(nextPageSize)
      }}
      onQueryChange={(value) => {
        setPageIndex(0)
        setQuery(value)
      }}
      onRefresh={refresh}
      onDelete={deleteGroup}
      create={{
        open: createOpen,
        form: groupCreateForm,
        error: createError,
        onOpenChange: (open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateError(null)
            groupCreateForm.reset()
          }
        },
        onCancel: cancelCreate
      }}
    />
  )
}
