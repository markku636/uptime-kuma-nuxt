// types/status-page.ts

export interface StatusPage {
  id: number
  slug: string
  title: string
  description?: string
  icon?: string
  theme: string
  published: boolean
  showTags: boolean
  showPoweredBy: boolean
  customCss?: string
  footerText?: string
  createdAt: Date
  groups?: StatusPageGroup[]
  incidents?: Incident[]
}

export interface StatusPageGroup {
  id: number
  statusPageId: number
  name: string
  weight: number
  monitors?: StatusPageMonitor[]
}

export interface StatusPageMonitor {
  id: number
  groupId: number
  monitorId: number
  sendUrl: boolean
}

export interface Incident {
  id: number
  statusPageId: number
  title: string
  content: string
  style: 'info' | 'warning' | 'danger' | 'success'
  pin: boolean
  createdAt: Date
  updatedAt?: Date
}

export interface CreateStatusPageInput {
  slug: string
  title: string
  description?: string
  icon?: string
  theme?: string
  published?: boolean
  showTags?: boolean
  showPoweredBy?: boolean
  customCss?: string
  footerText?: string
}

export interface UpdateStatusPageInput extends Partial<CreateStatusPageInput> {}

export interface CreateIncidentInput {
  title: string
  content: string
  style?: 'info' | 'warning' | 'danger' | 'success'
  pin?: boolean
}
