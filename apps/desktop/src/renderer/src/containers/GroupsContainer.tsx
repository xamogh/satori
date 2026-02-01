import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import { GroupsPage, type GroupsCreateFormValues } from '../components/pages/GroupsPage'
import {
  GroupMembersDialog,
  type GroupMemberCandidate,
  type GroupMemberRow
} from '../components/groups/GroupMembersDialog'
import {
  GroupCreateInputSchema,
  type Group,
  type GroupCreateInput
} from '@satori/domain/domain/group'
import type { Person } from '@satori/domain/domain/person'
import { createStore } from '../utils/store'
import { clampPageIndex, slicePage } from '../utils/pagination'
import { createSchemaFormValidator } from '../utils/formValidation'
import { trimToNull } from '../utils/string'

const normalizeQuery = (raw: string): string | undefined => {
  const trimmed = raw.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const getFullName = (person: Person): string =>
  [person.firstName, person.middleName, person.lastName]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')

const normalizeSearchValue = (value: string): string => value.trim().toLowerCase()

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

type GroupMembersState = {
  readonly members: ReadonlyArray<GroupMemberRow>
  readonly people: ReadonlyArray<Person>
  readonly loading: boolean
  readonly error: string | null
}

const groupMembersStore = createStore<GroupMembersState>({
  members: [],
  people: [],
  loading: false,
  error: null
})

let groupsListStarted = false
let groupsListRequestId = 0
let groupMembersRequestId = 0

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

const refreshGroupMembers = (groupId: string): Promise<void> => {
  groupMembersRequestId += 1
  const requestId = groupMembersRequestId

  groupMembersStore.updateSnapshot((current) => ({
    ...current,
    members: [],
    people: [],
    loading: true,
    error: null
  }))

  return Promise.all([
    window.api.personGroupsList({ groupId }),
    window.api.personsList({ query: undefined })
  ]).then(
    ([personGroupsResult, personsResult]) => {
      if (groupMembersRequestId !== requestId) {
        return
      }

      if (personGroupsResult._tag !== 'Ok') {
        groupMembersStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: personGroupsResult.error.message
        }))
        return
      }

      if (personsResult._tag !== 'Ok') {
        groupMembersStore.updateSnapshot((current) => ({
          ...current,
          loading: false,
          error: personsResult.error.message
        }))
        return
      }

      const people = personsResult.value
      const personMap = new Map(people.map((person) => [person.id, person]))
      const members: ReadonlyArray<GroupMemberRow> = personGroupsResult.value.map((entry) => {
        const person = personMap.get(entry.personId)
        return {
          id: entry.id,
          personId: entry.personId,
          name: person ? getFullName(person) : 'Unknown',
          email: person?.email ?? null,
          phone: person?.phone1 ?? null,
          joinedAtMs: entry.joinedAtMs
        }
      })

      groupMembersStore.setSnapshot({
        members,
        people,
        loading: false,
        error: null
      })
    },
    (reason) => {
      if (groupMembersRequestId !== requestId) {
        return
      }

      groupMembersStore.updateSnapshot((current) => ({
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
  const groupMembersState = useSyncExternalStore(
    groupMembersStore.subscribe,
    groupMembersStore.getSnapshot,
    groupMembersStore.getSnapshot
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
  const [membersOpen, setMembersOpen] = useState(false)
  const [membersGroup, setMembersGroup] = useState<Group | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const normalizedAddQuery = useMemo(() => normalizeSearchValue(addQuery), [addQuery])

  const memberPersonIds = useMemo(
    () => new Set(groupMembersState.members.map((member) => member.personId)),
    [groupMembersState.members]
  )

  const availablePeople = useMemo(
    () => groupMembersState.people.filter((person) => !memberPersonIds.has(person.id)),
    [groupMembersState.people, memberPersonIds]
  )

  const candidates = useMemo<ReadonlyArray<GroupMemberCandidate>>(() => {
    const filtered =
      normalizedAddQuery.length === 0
        ? availablePeople
        : availablePeople.filter((person) => {
            const name = getFullName(person).toLowerCase()
            const email = person.email?.toLowerCase() ?? ''
            const phone1 = person.phone1?.toLowerCase() ?? ''
            const phone2 = person.phone2?.toLowerCase() ?? ''
            return (
              name.includes(normalizedAddQuery) ||
              email.includes(normalizedAddQuery) ||
              phone1.includes(normalizedAddQuery) ||
              phone2.includes(normalizedAddQuery)
            )
          })

    return filtered.map((person) => ({
      id: person.id,
      name: getFullName(person),
      email: person.email ?? null,
      phone: person.phone1 ?? null
    }))
  }, [availablePeople, normalizedAddQuery])

  const refresh = useCallback((): void => {
    setPageIndex(0)
    void refreshGroupsList(normalizedQuery)
  }, [normalizedQuery])

  const openMembers = useCallback((group: Group): void => {
    setMembersGroup(group)
    setMembersOpen(true)
    setAddOpen(false)
    setAddQuery('')
    setAddError(null)
    void refreshGroupMembers(group.id)
  }, [])

  const handleMembersOpenChange = useCallback((open: boolean): void => {
    setMembersOpen(open)
    if (!open) {
      setMembersGroup(null)
      setAddOpen(false)
      setAddQuery('')
      setAddError(null)
    }
  }, [])

  const refreshMembers = useCallback((): void => {
    if (!membersGroup) {
      return
    }
    void refreshGroupMembers(membersGroup.id)
  }, [membersGroup])

  const handleAddOpenChange = useCallback((open: boolean): void => {
    setAddOpen(open)
    if (!open) {
      setAddQuery('')
      setAddError(null)
    }
  }, [])

  const removeMember = useCallback(
    (memberId: string): void => {
      if (!membersGroup) {
        return
      }

      window.api.personGroupsDelete({ id: memberId }).then(
        (result) => {
          if (result._tag === 'Ok') {
            refreshMembers()
            return
          }

          groupMembersStore.updateSnapshot((current) => ({
            ...current,
            error: result.error.message
          }))
        },
        (reason) =>
          groupMembersStore.updateSnapshot((current) => ({
            ...current,
            error: String(reason)
          }))
      )
    },
    [membersGroup, refreshMembers]
  )

  const addMember = useCallback(
    (personId: string): void => {
      if (!membersGroup) {
        return
      }

      setAddError(null)
      window.api
        .personGroupsCreate({ groupId: membersGroup.id, personId, joinedAtMs: Date.now() })
        .then(
          (result) => {
            if (result._tag === 'Ok') {
              setAddOpen(false)
              setAddQuery('')
              refreshMembers()
              return
            }

            setAddError(result.error.message)
          },
          (reason) => setAddError(String(reason))
        )
    },
    [membersGroup, refreshMembers]
  )

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
    <>
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
        onViewMembers={openMembers}
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
      {membersGroup ? (
        <GroupMembersDialog
          open={membersOpen}
          groupName={membersGroup.name}
          loading={groupMembersState.loading}
          error={groupMembersState.error}
          members={groupMembersState.members}
          onOpenChange={handleMembersOpenChange}
          onRefresh={refreshMembers}
          onRemove={removeMember}
          add={{
            open: addOpen,
            query: addQuery,
            candidates,
            loading: groupMembersState.loading,
            error: addError,
            onOpenChange: handleAddOpenChange,
            onQueryChange: setAddQuery,
            onAdd: addMember
          }}
        />
      ) : null}
    </>
  )
}
