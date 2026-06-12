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
  /**
   * Code pays ISO 3166-1 alpha-2 (FR, BE, DE…) — OBLIGATOIRE pour Factur-X.
   * `country` reste le libellé lisible ("France"), `countryCode` la donnée structurée.
   */
  countryCode?: string
  email: string
  phone: string
  /** SIRET (14 chiffres) — identifiant légal de l'établissement. */
  siret?: string
  /** N° de TVA intracommunautaire (ex: FR12345678901). Vide pour un micro en franchise. */
  vatNumber?: string
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
  /**
   * Référence acheteur (BT-10) : n° de commande / engagement juridique.
   * Obligatoire pour le secteur public (Chorus Pro) et fortement recommandée en B2B.
   */
  buyerReference?: string
  /**
   * Motif d'exonération de TVA (BT-120). Pour un micro en franchise :
   * "TVA non applicable, art. 293 B du CGI".
   */
  vatExemptionReason?: string
  status: 'draft' | 'sent' | 'paid'
  createdAt: string
  updatedAt: string
}

/** Profils Factur-X supportés. MINIMUM = totaux uniquement ; BASIC = + lignes & TVA détaillée. */
export type FacturXProfile = 'minimum' | 'basic'

export type View = 'dashboard' | 'form' | 'preview'
