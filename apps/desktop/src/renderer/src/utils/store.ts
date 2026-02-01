export type StoreListener = () => void

export type Store<S> = {
  readonly getSnapshot: () => S
  readonly subscribe: (listener: StoreListener) => () => void
  readonly setSnapshot: (snapshot: S) => void
  readonly updateSnapshot: (update: (snapshot: S) => S) => void
}

export const createStore = <S>(initialSnapshot: S): Store<S> => {
  let snapshot = initialSnapshot
  const listeners = new Set<StoreListener>()

  const notify = (): void => {
    listeners.forEach((listener) => listener())
  }

  const setSnapshot = (nextSnapshot: S): void => {
    snapshot = nextSnapshot
    notify()
  }

  const updateSnapshot = (update: (snapshot: S) => S): void => {
    snapshot = update(snapshot)
    notify()
  }

  const subscribe = (listener: StoreListener): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const getSnapshot = (): S => snapshot

  return { getSnapshot, subscribe, setSnapshot, updateSnapshot }
}
