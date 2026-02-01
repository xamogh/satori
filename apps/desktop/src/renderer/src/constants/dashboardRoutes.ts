export const DashboardRoute = {
  overview: 'overview',
  events: 'events',
  people: 'people',
  groups: 'groups',
  attendance: 'attendance',
  sync: 'sync'
} as const

export type DashboardRoute = (typeof DashboardRoute)[keyof typeof DashboardRoute]
