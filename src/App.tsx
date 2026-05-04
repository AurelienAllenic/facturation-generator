import { useState } from 'react'
import type { Invoice, View } from './types/invoice'
import { useInvoices } from './hooks/useInvoices'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import InvoiceForm from './components/InvoiceForm'
import InvoicePreview from './components/InvoicePreview'

export default function App() {
  const { invoices, saveInvoice, deleteInvoice } = useInvoices()
  const [view, setView] = useState<View>('dashboard')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleNew() {
    setSelectedInvoice(null)
    setView('form')
  }

  function handleSelect(invoice: Invoice) {
    setSelectedInvoice(invoice)
    setView('preview')
  }

  function handleEdit() {
    setView('form')
  }

  function handleSave(invoice: Invoice) {
    saveInvoice(invoice)
    setSelectedInvoice(invoice)
    setView('preview')
  }

  function handleMarkPaid(invoice: Invoice) {
    saveInvoice(invoice)
    setSelectedInvoice(invoice)
  }

  function handlePreview(invoice: Invoice) {
    setSelectedInvoice(invoice)
    setView('preview')
  }

  function handleDelete(id: string) {
    deleteInvoice(id)
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(null)
      setView('dashboard')
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f5f3ef]">
      <Sidebar
        invoices={invoices}
        currentView={view}
        selectedId={selectedInvoice?.id ?? null}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onNew={handleNew}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile top bar with burger */}
        <header className="no-print md:hidden flex items-center gap-3 px-4 py-4 border-b border-gray-200 bg-[#f5f3ef]">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="1" width="8" height="11" rx="1" stroke="white" strokeWidth="1.5" />
                <path d="M5 5h4M5 7.5h4M5 10h2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M10 5l3 3-3 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-800">FacturaPro</span>
          </div>
        </header>

        {view === 'dashboard' && (
          <Dashboard
            invoices={invoices}
            onNew={handleNew}
            onSelect={handleSelect}
          />
        )}

        {view === 'form' && (
          <InvoiceForm
            invoice={selectedInvoice}
            existingNumbers={invoices.map(i => i.number)}
            onSave={handleSave}
            onPreview={handlePreview}
            onCancel={() => setView(selectedInvoice ? 'preview' : 'dashboard')}
          />
        )}

        {view === 'preview' && selectedInvoice && (
          <InvoicePreview
            invoice={selectedInvoice}
            onEdit={handleEdit}
            onBack={() => setView('dashboard')}
            onMarkPaid={handleMarkPaid}
          />
        )}
      </main>
    </div>
  )
}
