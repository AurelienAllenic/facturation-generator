import { useState, useEffect } from 'react'
import type { Invoice, InvoiceItem, InvoiceParty } from '../types/invoice'
import {
  calcSubtotal, calcVat, calcTotal,
  formatCurrency, generateId, generateInvoiceNumber
} from '../utils/calculations'
import { LEGAL_MENTIONS_ME, capitalizeDescription } from '../utils/legalMentions'

interface InvoiceFormProps {
  invoice: Invoice | null
  existingNumbers: string[]
  onSave: (invoice: Invoice) => void
  onPreview: (invoice: Invoice) => void
  onCancel: () => void
}

const EMPTY_PARTY: InvoiceParty = {
  name: '', address: '', city: '', postalCode: '', country: 'France', email: '', phone: '', siret: '',
}

const EMPTY_ITEM: () => InvoiceItem = () => ({
  id: generateId(), description: '', quantity: 1, unitPrice: 0,
})

function createEmptyInvoice(existingNumbers: string[]): Invoice {
  const now = new Date()
  const due = new Date(now); due.setDate(due.getDate() + 30)
  return {
    id: generateId(),
    number: generateInvoiceNumber(existingNumbers),
    date: now.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    emitter: { ...EMPTY_PARTY },
    client: { ...EMPTY_PARTY },
    items: [EMPTY_ITEM()],
    vatRate: 20,
    vatEnabled: false,
    isMicroEntrepreneur: true,
    notes: '',
    currency: 'EUR',
    status: 'draft',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

interface PartyFieldsProps {
  label: string
  party: InvoiceParty
  isEmitter?: boolean
  isMicroEntrepreneur?: boolean
  onChange: (party: InvoiceParty) => void
}

function PartyFields({ label, party, isEmitter, isMicroEntrepreneur, onChange }: PartyFieldsProps) {
  const f = (field: keyof InvoiceParty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...party, [field]: e.target.value })

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">{label}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom / Société</label>
          <input
            type="text"
            value={party.name}
            onChange={f('name')}
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {isEmitter && isMicroEntrepreneur && (
            <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="5.5" cy="5.5" r="5" stroke="#3b82f6" strokeWidth="1" />
                <path d="M5.5 4v3M5.5 8v.5" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              La mention «&nbsp;Micro-entrepreneur&nbsp;» apparaîtra sous votre nom sur la facture
            </p>
          )}
        </div>
        <Field label="Adresse" value={party.address} onChange={f('address')} className="col-span-2" />
        <Field label="Code postal" value={party.postalCode} onChange={f('postalCode')} />
        <Field label="Ville" value={party.city} onChange={f('city')} />
        <Field label="Pays" value={party.country} onChange={f('country')} />
        {/* SIRET with quick-fill */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">SIRET</label>
          <input
            type="text"
            value={party.siret ?? ''}
            onChange={f('siret')}
            placeholder="123 456 789 00012"
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {isEmitter && party.siret === '' && (
            <button
              type="button"
              onClick={() => onChange({ ...party, siret: 'En cours d\'immatriculation' })}
              className="mt-1 text-[11px] text-blue-500 hover:text-blue-700 hover:underline"
            >
              → En cours d'immatriculation
            </button>
          )}
        </div>
        <Field label="Email" value={party.email} onChange={f('email')} type="email" />
        <Field label="Téléphone" value={party.phone} onChange={f('phone')} className="col-span-2" />
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  className?: string
  step?: string
}

function Field({ label, value, onChange, type = 'text', className = '', step }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        step={step}
        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </div>
  )
}

export default function InvoiceForm({ invoice, existingNumbers, onSave, onPreview, onCancel }: InvoiceFormProps) {
  const [form, setForm] = useState<Invoice>(() =>
    invoice ? { ...invoice, isMicroEntrepreneur: invoice.isMicroEntrepreneur ?? true } : createEmptyInvoice(existingNumbers)
  )

  useEffect(() => {
    setForm(invoice
      ? { ...invoice, isMicroEntrepreneur: invoice.isMicroEntrepreneur ?? true }
      : createEmptyInvoice(existingNumbers)
    )
  }, [invoice, existingNumbers])

  const subtotal = calcSubtotal(form.items)
  const vatAmount = calcVat(subtotal, form.vatEnabled ? form.vatRate : 0)
  const total = calcTotal(subtotal, vatAmount)

  function updateItem(id: string, field: keyof InvoiceItem, value: string | number) {
    setForm(f => ({
      ...f,
      items: f.items.map(item =>
        item.id === id ? { ...item, [field]: field === 'description' ? value : Number(value) } : item
      ),
    }))
  }

  function handleDescriptionBlur(id: string, raw: string) {
    const capitalized = capitalizeDescription(raw)
    if (capitalized !== raw) updateItem(id, 'description', capitalized)
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, EMPTY_ITEM()] }))
  }

  function removeItem(id: string) {
    setForm(f => ({ ...f, items: f.items.filter(item => item.id !== id) }))
  }

  function handleSave(status?: Invoice['status']) {
    const toSave = status ? { ...form, status } : form
    onSave(toSave)
  }

  return (
    <div className="animate-fade-in flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl text-[#0f0e0d]">
                {invoice ? 'Modifier la facture' : 'Nouvelle facture'}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{form.number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onPreview(form)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M1 7C2.5 4 4.5 2.5 7 2.5S11.5 4 13 7c-1.5 3-3.5 4.5-6 4.5S2.5 10 1 7z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Aperçu
            </button>
            <button
              onClick={() => handleSave('draft')}
              className="text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 transition-all"
            >
              Sauvegarder
            </button>
            <button
              onClick={() => handleSave('sent')}
              className="text-sm font-medium px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-200"
            >
              Finaliser & Envoyer
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Meta */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Informations générales</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">N° de facture</label>
                <input
                  type="text"
                  value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date d'émission</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date d'échéance</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Devise</label>
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar</option>
                  <option value="GBP">GBP — Livre</option>
                  <option value="CHF">CHF — Franc suisse</option>
                </select>
              </div>
            </div>

            {/* Micro-entrepreneur toggle */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isMicroEntrepreneur}
                  onChange={e => setForm(f => ({ ...f, isMicroEntrepreneur: e.target.checked }))}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Micro-entrepreneur</span>
              </label>
              <span className="text-xs text-gray-400">Affiche le statut sur la facture et applique les mentions légales obligatoires</span>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PartyFields
                label="Émetteur (vous)"
                party={form.emitter}
                isEmitter
                isMicroEntrepreneur={form.isMicroEntrepreneur}
                onChange={emitter => setForm(f => ({ ...f, emitter }))}
              />
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PartyFields
                label="Client"
                party={form.client}
                onChange={client => setForm(f => ({ ...f, client }))}
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Articles & Prestations</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-[1fr_90px_110px_110px_36px] gap-2 px-2 mb-2">
                <span className="text-xs font-medium text-gray-400">Description</span>
                <span className="text-xs font-medium text-gray-400 text-center">Qté</span>
                <span className="text-xs font-medium text-gray-400 text-right">Prix unitaire</span>
                <span className="text-xs font-medium text-gray-400 text-right">Total HT</span>
                <span></span>
              </div>

              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-[1fr_90px_110px_110px_36px] gap-2 items-center animate-fade-in">
                    <input
                      type="text"
                      value={item.description}
                      placeholder={`ex: Modélisation 3D — article ${idx + 1}`}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                      onBlur={e => handleDescriptionBlur(item.id, e.target.value)}
                      className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      min="0"
                      step="1"
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                      className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <input
                      type="number"
                      value={item.unitPrice}
                      min="0"
                      step="0.01"
                      onChange={e => updateItem(item.id, 'unitPrice', e.target.value)}
                      className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <div className="flex items-center justify-end pr-1">
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(item.quantity * item.unitPrice, form.currency)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={form.items.length === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M5.5 6.5v4M8.5 6.5v4M3.5 4l.5 7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5L10.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addItem}
                className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Ajouter un article
              </button>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 px-6 py-5 bg-gray-50">
              <div className="flex flex-col items-end gap-2 max-w-xs ml-auto">
                {/* TVA toggle — only show HT line when TVA active */}
                {form.vatEnabled && (
                  <div className="flex justify-between w-full text-sm text-gray-500">
                    <span>Sous-total HT</span>
                    <span className="font-medium text-gray-700">{formatCurrency(subtotal, form.currency)}</span>
                  </div>
                )}

                <div className="flex justify-between w-full text-sm text-gray-500 items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.vatEnabled}
                        onChange={e => {
                          const enabled = e.target.checked
                          setForm(f => ({ ...f, vatEnabled: enabled }))
                        }}
                        className="w-3.5 h-3.5 rounded accent-blue-600"
                      />
                      <span>TVA</span>
                    </label>
                    {form.vatEnabled && (
                      <>
                        <input
                          type="number"
                          value={form.vatRate}
                          min="0"
                          max="100"
                          step="0.5"
                          onChange={e => setForm(f => ({ ...f, vatRate: Number(e.target.value) }))}
                          className="w-16 text-sm bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                        />
                        <span className="text-gray-400">%</span>
                      </>
                    )}
                  </div>
                  {form.vatEnabled && (
                    <span className="font-medium text-gray-700">{formatCurrency(vatAmount, form.currency)}</span>
                  )}
                </div>

                <div className="flex justify-between w-full pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">
                    {form.vatEnabled ? 'Total TTC' : 'Total'}
                  </span>
                  <span className="font-bold text-xl text-blue-600">{formatCurrency(total, form.currency)}</span>
                </div>

                {!form.vatEnabled && (
                  <p className="text-[11px] text-gray-400 w-full text-right -mt-1">
                    HT = TTC (TVA non applicable)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notes — user's free field */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Notes personnalisées
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Informations bancaires, références commande, conditions spécifiques..."
              rows={3}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />

            {/* Fixed legal mentions preview */}
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1v4M5 7v1" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="5" cy="5" r="4.25" stroke="#9ca3af" strokeWidth="1" />
                </svg>
                Mentions légales — toujours incluses sur la facture
              </p>
              <ol className="space-y-1">
                {LEGAL_MENTIONS_ME.map((m, i) => (
                  <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                    <span className="shrink-0 text-gray-300 font-mono">{i + 1}.</span>
                    {m}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex flex-wrap justify-end gap-3 pb-4">
            <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-all">
              Annuler
            </button>
            <button
              onClick={() => onPreview(form)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-all"
            >
              Aperçu PDF
            </button>
            <button
              onClick={() => handleSave('draft')}
              className="text-sm font-medium px-5 py-2.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-all"
            >
              Sauvegarder brouillon
            </button>
            <button
              onClick={() => handleSave('sent')}
              className="text-sm font-medium px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-200"
            >
              Finaliser & Marquer envoyée
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
