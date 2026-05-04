import { useState, useEffect } from 'react'
import type { Invoice } from '../types/invoice'
import { generateId, generateInvoiceNumber } from '../utils/calculations'

const STORAGE_KEY = 'facturapro_invoices'

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices))
  }, [invoices])

  function saveInvoice(invoice: Invoice) {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === invoice.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...invoice, updatedAt: new Date().toISOString() }
        return updated
      }
      return [{ ...invoice, updatedAt: new Date().toISOString() }, ...prev]
    })
  }

  function deleteInvoice(id: string) {
    setInvoices(prev => prev.filter(i => i.id !== id))
  }

  function duplicateInvoice(invoice: Invoice): Invoice {
    return {
      ...invoice,
      id: generateId(),
      number: generateInvoiceNumber(invoices.map(i => i.number)),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  return { invoices, saveInvoice, deleteInvoice, duplicateInvoice }
}
