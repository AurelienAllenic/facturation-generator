import type { Invoice } from '../types/invoice'
import { formatCurrency, calcSubtotal, calcVat, calcTotal, formatDate } from '../utils/calculations'

interface DashboardProps {
  invoices: Invoice[]
  onNew: () => void
  onSelect: (invoice: Invoice) => void
}

const STATUS_LABEL: Record<Invoice['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
}

const STATUS_COLOR: Record<Invoice['status'], string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function Dashboard({ invoices, onNew, onSelect }: DashboardProps) {
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, inv) => {
      const sub = calcSubtotal(inv.items)
      return sum + calcTotal(sub, calcVat(sub, inv.vatEnabled ? inv.vatRate : 0))
    }, 0)

  const totalPending = invoices
    .filter(i => i.status === 'sent')
    .reduce((sum, inv) => {
      const sub = calcSubtotal(inv.items)
      return sum + calcTotal(sub, calcVat(sub, inv.vatEnabled ? inv.vatRate : 0))
    }, 0)

  const totalDraft = invoices.filter(i => i.status === 'draft').length

  return (
    <div className="animate-fade-in px-4 py-6 sm:p-8 max-w-5xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl text-[#0f0e0d] leading-tight">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1.5">Gérez et suivez toutes vos factures</p>
        </div>
        <button
          onClick={onNew}
          className="self-start sm:self-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all shadow-sm shadow-blue-200 hover:shadow-md hover:shadow-blue-200 whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Nouvelle facture
        </button>
      </div>

      {/* Stats — 1 col on mobile, 3 on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
          <div className="flex items-center gap-3 sm:mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13 4L6 11L3 8" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 font-medium sm:hidden">Total encaissé</span>
          </div>
          <div className="sm:mt-0">
            <span className="hidden sm:block text-sm text-gray-500 font-medium mb-2">Total encaissé</span>
            <p className="text-xl sm:text-2xl font-semibold text-gray-900">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{invoices.filter(i => i.status === 'paid').length} payée(s)</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
          <div className="flex items-center gap-3 sm:mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#2563eb" strokeWidth="1.5" />
                <path d="M8 5v3l2 2" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 font-medium sm:hidden">En attente</span>
          </div>
          <div>
            <span className="hidden sm:block text-sm text-gray-500 font-medium mb-2">En attente</span>
            <p className="text-xl sm:text-2xl font-semibold text-gray-900">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{invoices.filter(i => i.status === 'sent').length} envoyée(s)</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
          <div className="flex items-center gap-3 sm:mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v5l3 1.5" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="6" stroke="#d97706" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 font-medium sm:hidden">Brouillons</span>
          </div>
          <div>
            <span className="hidden sm:block text-sm text-gray-500 font-medium mb-2">Brouillons</span>
            <p className="text-xl sm:text-2xl font-semibold text-gray-900">{totalDraft}</p>
            <p className="text-xs text-gray-400 mt-0.5">non finalisée(s)</p>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Toutes les factures</h2>
          <span className="text-sm text-gray-400">{invoices.length} au total</span>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="5" y="3" width="14" height="19" rx="2" stroke="#9ca3af" strokeWidth="1.5" />
                <path d="M9 9h6M9 13h6M9 17h4" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="20" cy="20" r="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5" />
                <path d="M20 17v3l2 1" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Aucune facture</p>
              <p className="text-xs text-gray-400 mt-1">Créez votre première facture pour commencer</p>
            </div>
            <button onClick={onNew} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Créer une facture →
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-medium">N° Facture</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Statut</th>
                    <th className="text-right px-6 py-3 font-medium">Montant TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const sub = calcSubtotal(inv.items)
                    const total = calcTotal(sub, calcVat(sub, inv.vatEnabled ? inv.vatRate : 0))
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => onSelect(inv)}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-blue-600 group-hover:text-blue-700">
                            {inv.number}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-800">{inv.client.name || '—'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{inv.client.email}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{formatDate(inv.date)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[inv.status]}`}>
                            {STATUS_LABEL[inv.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(total, inv.currency)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list — hidden on sm+ */}
            <ul className="sm:hidden divide-y divide-gray-50">
              {invoices.map(inv => {
                const sub = calcSubtotal(inv.items)
                const total = calcTotal(sub, calcVat(sub, inv.vatEnabled ? inv.vatRate : 0))
                return (
                  <li key={inv.id}>
                    <button
                      onClick={() => onSelect(inv)}
                      className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-blue-600">{inv.number}</p>
                          <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{inv.client.name || '—'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(inv.date)}</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(total, inv.currency)}</span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[inv.status]}`}>
                            {STATUS_LABEL[inv.status]}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
