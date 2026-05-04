export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface InvoiceParty {
  name: string
  address: string
  city: string
  postalCode: string
  country: string
  email: string
  phone: string
  siret?: string
}

export interface Invoice {
  id: string
  number: string
  date: string
  dueDate: string
  emitter: InvoiceParty
  client: InvoiceParty
  items: InvoiceItem[]
  vatRate: number
  vatEnabled: boolean
  isMicroEntrepreneur: boolean
  notes: string
  currency: string
  status: 'draft' | 'sent' | 'paid'
  createdAt: string
  updatedAt: string
}

export type View = 'dashboard' | 'form' | 'preview'
