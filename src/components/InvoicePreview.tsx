import type { Invoice } from '../types/invoice'
import {
  calcSubtotal, calcVat, calcTotal,
  formatCurrency, formatDate
} from '../utils/calculations'

interface InvoicePreviewProps {
  invoice: Invoice
  onEdit: () => void
  onBack: () => void
  onMarkPaid: (invoice: Invoice) => void
}

export default function InvoicePreview({ invoice, onEdit, onBack, onMarkPaid }: InvoicePreviewProps) {
  const subtotal = calcSubtotal(invoice.items)
  const vatAmount = calcVat(subtotal, invoice.vatEnabled ? invoice.vatRate : 0)
  const total = calcTotal(subtotal, vatAmount)

  function handlePrint() {
    window.print()
  }

  const statusColors: Record<Invoice['status'], string> = {
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
    sent: 'bg-blue-50 text-blue-700 border-blue-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  const statusLabel: Record<Invoice['status'], string> = {
    draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée',
  }

  return (
    <div className="animate-fade-in flex-1 overflow-y-auto">
      {/* Toolbar — hidden on print */}
      <div className="no-print sticky top-0 z-10 bg-[#f5f3ef]/95 backdrop-blur border-b border-gray-200 px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-y-2">
        {/* Left: back + title + badge */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="shrink-0 p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm text-gray-500 truncate">
            <span className="hidden sm:inline">Aperçu — </span>
            <span className="font-semibold text-gray-700">{invoice.number}</span>
          </span>
          <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusColors[invoice.status]}`}>
            {statusLabel[invoice.status]}
          </span>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {invoice.status !== 'paid' && (
            <button
              onClick={() => onMarkPaid({ ...invoice, status: 'paid' })}
              className="text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all whitespace-nowrap"
            >
              <span className="hidden sm:inline">Marquer payée </span>✓
            </button>
          )}
          <button
            onClick={onEdit}
            className="text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all"
          >
            <span className="hidden sm:inline">Modifier</span>
            {/* pencil icon — mobile only */}
            <svg className="sm:hidden" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M10.5 2.5l2 2L5 12H3v-2l7.5-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-200 whitespace-nowrap"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="5" width="10" height="7" rx="1" stroke="white" strokeWidth="1.3" />
              <path d="M4 5V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V5" stroke="white" strokeWidth="1.3" />
              <path d="M4 9h6M4 11h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="11" cy="7.5" r="0.8" fill="white" />
            </svg>
            <span className="hidden sm:inline">Imprimer / </span>PDF
          </button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="py-10 px-8 flex justify-center">
        <div className="invoice-preview bg-white w-full max-w-[800px] shadow-xl shadow-black/5 rounded-2xl overflow-hidden border border-gray-100">
          {/* Invoice header band */}
          <div className="bg-[#111827] px-10 py-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-serif text-white tracking-tight">FACTURE</h1>
              <p className="text-blue-400 font-mono text-sm mt-1">{invoice.number}</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs mb-1">Émise le</p>
              <p className="text-white text-sm font-medium">{formatDate(invoice.date)}</p>
              {invoice.dueDate && (
                <>
                  <p className="text-white/50 text-xs mt-2 mb-1">Échéance</p>
                  <p className="text-amber-300 text-sm font-medium">{formatDate(invoice.dueDate)}</p>
                </>
              )}
            </div>
          </div>

          <div className="p-10">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-10 mb-10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">De</p>
                <p className="font-semibold text-gray-900 text-base">{invoice.emitter.name || '—'}</p>
                {invoice.emitter.siret && (
                  <p className="text-xs text-gray-400 mt-0.5">SIRET : {invoice.emitter.siret}</p>
                )}
                <div className="mt-2 space-y-0.5 text-sm text-gray-500">
                  {invoice.emitter.address && <p>{invoice.emitter.address}</p>}
                  {(invoice.emitter.postalCode || invoice.emitter.city) && (
                    <p>{invoice.emitter.postalCode} {invoice.emitter.city}</p>
                  )}
                  {invoice.emitter.country && <p>{invoice.emitter.country}</p>}
                  {invoice.emitter.email && <p className="mt-1.5">{invoice.emitter.email}</p>}
                  {invoice.emitter.phone && <p>{invoice.emitter.phone}</p>}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Facturé à</p>
                <p className="font-semibold text-gray-900 text-base">{invoice.client.name || '—'}</p>
                {invoice.client.siret && (
                  <p className="text-xs text-gray-400 mt-0.5">SIRET : {invoice.client.siret}</p>
                )}
                <div className="mt-2 space-y-0.5 text-sm text-gray-500">
                  {invoice.client.address && <p>{invoice.client.address}</p>}
                  {(invoice.client.postalCode || invoice.client.city) && (
                    <p>{invoice.client.postalCode} {invoice.client.city}</p>
                  )}
                  {invoice.client.country && <p>{invoice.client.country}</p>}
                  {invoice.client.email && <p className="mt-1.5">{invoice.client.email}</p>}
                  {invoice.client.phone && <p>{invoice.client.phone}</p>}
                </div>
              </div>
            </div>

            {/* Items table */}
            <div className="mb-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-gray-700 pb-3">Description</th>
                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-gray-700 pb-3 w-20">Qté</th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-700 pb-3 w-28">Prix unitaire</th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-700 pb-3 w-28">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3.5 pr-4 text-sm text-gray-800">{item.description || `Article ${idx + 1}`}</td>
                      <td className="py-3.5 text-sm text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3.5 text-sm text-right text-gray-600">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                      <td className="py-3.5 text-sm text-right font-medium text-gray-800">
                        {formatCurrency(item.quantity * item.unitPrice, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between text-sm text-gray-500 py-2 border-b border-gray-100">
                  <span>Sous-total HT</span>
                  <span>{formatCurrency(subtotal, invoice.currency)}</span>
                </div>
                {invoice.vatEnabled && (
                  <div className="flex justify-between text-sm text-gray-500 py-2 border-b border-gray-100">
                    <span>TVA ({invoice.vatRate}%)</span>
                    <span>{formatCurrency(vatAmount, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 mt-1">
                  <span className="font-bold text-gray-900">Total TTC</span>
                  <span className="font-bold text-xl text-blue-600">{formatCurrency(total, invoice.currency)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {(invoice.notes || !invoice.vatEnabled) && (
              <div className="mt-10 pt-6 border-t border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Notes & Conditions</p>
                {invoice.notes && (
                  <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{invoice.notes}</p>
                )}
                {!invoice.vatEnabled && !invoice.notes?.includes('TVA non applicable') && (
                  <p className="text-sm text-gray-500 mt-1">TVA non applicable, art. 293 B du CGI</p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-300">Généré via FacturaPro</p>
              <p className="text-[10px] text-gray-300 font-mono">{invoice.number} · {formatDate(invoice.date)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
