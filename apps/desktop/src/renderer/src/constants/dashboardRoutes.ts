export const DashboardRoute = {
  overview: "overview",
  events: "events",
  people: "people",
  sync: "sync",
} as const

export type DashboardRoute = (typeof DashboardRoute)[keyof typeof DashboardRoute]

