import type { Invoice, View } from '../types/invoice'
import { formatCurrency, calcSubtotal, calcVat, calcTotal } from '../utils/calculations'

interface SidebarProps {
  invoices: Invoice[]
  currentView: View
  selectedId: string | null
  isOpen: boolean
  onToggle: () => void
  onNew: () => void
  onSelect: (invoice: Invoice) => void
  onDelete: (id: string) => void
}

const STATUS_LABEL: Record<Invoice['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
}

const STATUS_COLOR: Record<Invoice['status'], string> = {
  draft: 'bg-amber-100 text-amber-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
}

export default function Sidebar({ invoices, selectedId, isOpen, onToggle, onNew, onSelect, onDelete }: SidebarProps) {
  function handleSelect(inv: Invoice) {
    onSelect(inv)
    // close drawer on mobile after selecting
    if (window.innerWidth < 768) onToggle()
  }

  function handleNew() {
    onNew()
    if (window.innerWidth < 768) onToggle()
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="no-print fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          no-print flex flex-col bg-[#111827] text-white
          fixed inset-y-0 left-0 z-30 w-72
          transition-transform duration-300 ease-in-out
          md:static md:translate-x-0 md:z-auto md:min-h-screen
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo + close button on mobile */}
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="1" width="8" height="11" rx="1" stroke="white" strokeWidth="1.5" />
                <path d="M5 5h4M5 7.5h4M5 10h2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M10 5l3 3-3 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-wide">FacturaPro</span>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onToggle}
            className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fermer le menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* New Invoice Button */}
        <div className="px-4 pt-5 pb-3">
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Nouvelle facture
          </button>
        </div>

        {/* Invoice List */}
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-16 gap-3 opacity-40">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="6" y="3" width="16" height="22" rx="2" stroke="white" strokeWidth="1.5" />
                <path d="M10 10h8M10 14h8M10 18h5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-center">Aucune facture<br />pour le moment</p>
            </div>
          ) : (
            <ul className="space-y-1.5 mt-1">
              {invoices.map(inv => {
                const sub = calcSubtotal(inv.items)
                const total = calcTotal(sub, calcVat(sub, inv.vatEnabled ? inv.vatRate : 0))
                const isActive = inv.id === selectedId

                return (
                  <li key={inv.id} className="group animate-slide-in">
                    <button
                      onClick={() => handleSelect(inv)}
                      className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-150 border ${
                        isActive
                          ? 'bg-white/10 border-white/20'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/90 truncate">{inv.number}</p>
                          <p className="text-xs text-white/50 truncate mt-0.5">{inv.client.name || 'Client sans nom'}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLOR[inv.status]}`}>
                          {STATUS_LABEL[inv.status]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-white/40">{inv.date}</span>
                        <span className="text-xs font-semibold text-white/80">{formatCurrency(total, inv.currency)}</span>
                      </div>
                    </button>
                    <div className="flex justify-end px-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 mb-1">
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(inv.id) }}
                        className="text-[10px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded"
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-[10px] text-white/30 text-center">
            {invoices.length} facture{invoices.length !== 1 ? 's' : ''} sauvegardée{invoices.length !== 1 ? 's' : ''}
          </p>
        </div>
      </aside>
    </>
  )
}
