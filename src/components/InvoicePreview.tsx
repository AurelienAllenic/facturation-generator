import { useState } from 'react'
import type { Invoice } from '../types/invoice'
import { formatCurrency, formatDate } from '../utils/calculations'
import { LEGAL_MENTIONS_ME } from '../utils/legalMentions'
// Source unique de vérité des montants + validation fiscale (léger, sans pdf-lib).
import { computeAmounts, round2, validateInvoiceForFacturX, FacturXValidationError } from '../utils/facturX'

interface InvoicePreviewProps {
  invoice: Invoice
  onEdit: () => void
  onBack: () => void
  onMarkPaid: (invoice: Invoice) => void
}

export default function InvoicePreview({ invoice, onEdit, onBack, onMarkPaid }: InvoicePreviewProps) {
  // Montants centralisés : aperçu écran, impression, PDF pdf-lib et XML Factur-X
  // partagent désormais TOUS la même source de vérité (computeAmounts).
  const amounts = computeAmounts(invoice)
  const subtotal = amounts.basis
  const vatAmount = amounts.vat
  const total = amounts.grandTotal

  // État de conformité au rendu : conditionne le lien de téléversement PPF.
  const facturXCheck = validateInvoiceForFacturX(invoice, 'basic')
  // Placeholder : URL officielle du Portail Public de Facturation (ou de la PDP à terme).
  const PPF_URL = 'https://www.portailpublicfacturation.finances.gouv.fr'

  const isME = invoice.isMicroEntrepreneur ?? true

  const [generating, setGenerating] = useState(false)
  // Liste des problèmes de conformité Factur-X à afficher dans l'UI (vide = OK).
  const [facturXIssues, setFacturXIssues] = useState<string[]>([])

  function handlePrint() {
    window.print()
  }

  // Génère et télécharge le PDF Factur-X (PDF + XML CII embarqué).
  async function handleFacturX() {
    setFacturXIssues([])

    // 1) Validation fiscale AVANT de charger pdf-lib : si la facture est invalide,
    //    on affiche précisément ce qui bloque, sans rien télécharger.
    const { valid, issues } = validateInvoiceForFacturX(invoice, 'basic')
    if (!valid) {
      setFacturXIssues(issues)
      return
    }

    // 2) Génération + téléchargement (pdf-lib chargé à la demande).
    try {
      setGenerating(true)
      const { downloadFacturX } = await import('../utils/facturXPdf')
      await downloadFacturX(invoice, 'basic')
    } catch (err) {
      // Filet de sécurité : si une règle est levée plus bas, on l'affiche aussi.
      if (err instanceof FacturXValidationError) {
        setFacturXIssues(err.issues)
      } else {
        console.error('Erreur génération Factur-X :', err)
        setFacturXIssues(['Erreur inattendue lors de la génération du fichier Factur-X (voir la console).'])
      }
    } finally {
      setGenerating(false)
    }
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
            <svg className="sm:hidden" width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M10.5 2.5l2 2L5 12H3v-2l7.5-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all whitespace-nowrap"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4 5V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4 9h6M4 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="11" cy="7.5" r="0.8" fill="currentColor" />
            </svg>
            <span className="hidden sm:inline">Imprimer / </span>PDF
          </button>
          {/* Factur-X : PDF + XML CII embarqué (facture électronique conforme à la réforme) */}
          <button
            onClick={handleFacturX}
            disabled={generating}
            title="Télécharger un PDF Factur-X (XML CII embarqué)"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-all shadow-sm shadow-blue-200 whitespace-nowrap"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 6l3 3 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11h10" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {generating ? 'Génération…' : 'Factur-X'}
          </button>

          {/* Téléversement vers le Portail Public de Facturation (PPF / PDP).
              Actif uniquement si la facture est conforme Factur-X. */}
          {facturXCheck.valid ? (
            <a
              href={PPF_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Téléverser vers le Portail Public de Facturation"
              className="group flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm shadow-emerald-200 whitespace-nowrap"
            >
              {/* Icône cloud-upload */}
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M4.5 11.5a2.5 2.5 0 01-.3-4.98A3.5 3.5 0 0111 6.2a2.4 2.4 0 01.6 4.8" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 7v5M6 9l2-2 2 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Téléverser</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/20 tracking-wide">
                PPF · Officiel
              </span>
            </a>
          ) : (
            <button
              type="button"
              aria-disabled="true"
              title="Veuillez corriger les erreurs de la facture avant de pouvoir la téléverser"
              onClick={() => setFacturXIssues(facturXCheck.issues)}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-2 rounded-lg bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed whitespace-nowrap"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M4.5 11.5a2.5 2.5 0 01-.3-4.98A3.5 3.5 0 0111 6.2a2.4 2.4 0 01.6 4.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 7v5M6 9l2-2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Téléverser</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 tracking-wide">
                PPF
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Panneau d'erreurs de conformité Factur-X (non imprimé) */}
      {facturXIssues.length > 0 && (
        <div className="no-print px-4 md:px-8 pt-4">
          <div className="max-w-[800px] mx-auto rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="6.5" stroke="#dc2626" strokeWidth="1.3" />
                  <path d="M8 4.5v4M8 10.5v.5" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <p className="text-sm font-semibold text-red-700">
                  Facture non conforme Factur-X — {facturXIssues.length} point{facturXIssues.length > 1 ? 's' : ''} à corriger
                </p>
              </div>
              <button
                onClick={() => setFacturXIssues([])}
                className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
                aria-label="Fermer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="mt-3 space-y-1.5">
              {facturXIssues.map((issue, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                  <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-red-400" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onEdit}
              className="mt-3 text-xs font-medium text-red-700 underline hover:text-red-900"
            >
              Corriger la facture →
            </button>
          </div>
        </div>
      )}

      {/* Invoice Document */}
      <div className="py-10 px-4 sm:px-8 flex justify-center">
        <div className="invoice-preview bg-white w-full max-w-[800px] shadow-xl shadow-black/5 rounded-2xl overflow-hidden border border-gray-100">
          {/* Header band */}
          <div className="bg-[#111827] px-8 sm:px-10 py-8 flex items-start justify-between">
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

          <div className="p-8 sm:p-10">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-8 sm:gap-10 mb-10">
              {/* Emitter */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">De</p>
                <p className="font-semibold text-gray-900 text-base leading-snug">{invoice.emitter.name || '—'}</p>
                {/* Rule 1 — Micro-entrepreneur mention */}
                {isME && (
                  <p className="text-xs text-blue-600 font-medium mt-0.5">Micro-entrepreneur</p>
                )}
                {invoice.emitter.siret && (
                  <p className="text-xs text-gray-400 mt-1">SIRET : {invoice.emitter.siret}</p>
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

              {/* Client */}
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
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-700 pb-3 w-28">
                      {/* Rule 5 — label changes when no TVA */}
                      {invoice.vatEnabled ? 'Total HT' : 'Montant'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3.5 pr-4 text-sm text-gray-800">{item.description || `Article ${idx + 1}`}</td>
                      <td className="py-3.5 text-sm text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3.5 text-sm text-right text-gray-600">{formatCurrency(round2(item.unitPrice), invoice.currency)}</td>
                      <td className="py-3.5 text-sm text-right font-medium text-gray-800">
                        {formatCurrency(amounts.lineTotals[idx], invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals — Rule 5 */}
            <div className="flex justify-end">
              <div className="w-64">
                {invoice.vatEnabled ? (
                  <>
                    <div className="flex justify-between text-sm text-gray-500 py-2 border-b border-gray-100">
                      <span>Sous-total HT</span>
                      <span>{formatCurrency(subtotal, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 py-2 border-b border-gray-100">
                      <span>TVA ({invoice.vatRate}%)</span>
                      <span>{formatCurrency(vatAmount, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between py-3 mt-1">
                      <span className="font-bold text-gray-900">Total TTC</span>
                      <span className="font-bold text-xl text-blue-600">{formatCurrency(total, invoice.currency)}</span>
                    </div>
                  </>
                ) : (
                  /* No TVA: HT = TTC, single line */
                  <div className="flex justify-between py-3 border-t-2 border-gray-900">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-xl text-blue-600">{formatCurrency(subtotal, invoice.currency)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* User notes */}
            {invoice.notes && (
              <div className="mt-10 pt-6 border-t border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Notes</p>
                <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}

            {/* Rule 2 — Fixed legal mentions, always present */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Mentions légales</p>
              <ol className="space-y-1">
                {LEGAL_MENTIONS_ME.map((mention, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                    <span className="shrink-0 text-gray-300 font-mono mt-px">{i + 1}.</span>
                    {mention}
                  </li>
                ))}
              </ol>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-5 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-300">Généré via FacturaPro</p>
              <p className="text-[10px] text-gray-300 font-mono">{invoice.number} · {formatDate(invoice.date)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
