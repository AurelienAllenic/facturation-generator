import type { InvoiceItem } from '../types/invoice'

export function calcSubtotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function calcVat(subtotal: number, vatRate: number): number {
  return subtotal * (vatRate / 100)
}

export function calcTotal(subtotal: number, vat: number): number {
  return subtotal + vat
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function generateInvoiceNumber(existing: string[]): string {
  const year = new Date().getFullYear()
  const prefix = `FAC-${year}-`
  const nums = existing
    .filter(n => n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
