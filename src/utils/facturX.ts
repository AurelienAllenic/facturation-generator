/**
 * Génération + VALIDATION du XML Factur-X (norme CII — Cross Industry Invoice, UN/CEFACT).
 *
 * Deux profils sont supportés :
 *  - 'minimum' : en-tête + totaux uniquement (le plus simple, accepté pour la réforme).
 *  - 'basic'   : ajoute le détail des lignes et la ventilation de TVA. Recommandé en B2B,
 *                car il porte explicitement le motif d'exonération (franchise micro-entreprise).
 *
 * Ce fichier ne dépend PAS du PDF : il transforme + valide les données métier en XML.
 * L'injection dans le PDF est faite séparément (voir facturXPdf.ts).
 *
 * MOTEUR DE VALIDATION (sécurise la conformité avant génération) :
 *   1. Arrondis stricts à 2 décimales (au plus proche) sur TOUS les montants.
 *   2. Cohérence mathématique : Σ lignes = base, et base + TVA = TTC, au centime près.
 *   3. Données obligatoires : code pays ISO, mention d'exonération si TVA = 0,
 *      format/clé de contrôle SIREN-SIRET.
 *
 * Toute non-conformité lève une `FacturXValidationError` explicite AVANT de produire
 * un XML qui serait rejeté en aval (PDP / Chorus Pro).
 *
 * ⚠️ Validez aussi le XML produit contre le XSD/Schematron officiel FNFE-MPE.
 */
import type { Invoice, InvoiceParty, FacturXProfile } from '../types/invoice'
import { LEGAL_MENTIONS_ME } from './legalMentions'

// Identifiants de profil (BT-24 — Specification identifier)
const GUIDELINE: Record<FacturXProfile, string> = {
  minimum: 'urn:factur-x.eu:1p0:minimum',
  basic: 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
}

// ===========================================================================
// MOTEUR D'ARRONDI ET DE MONTANTS (source unique de vérité)
// ===========================================================================

/**
 * RÈGLE 1 — Arrondi à 2 décimales, "au plus proche" (demi écarté de zéro).
 *
 * C'est l'arrondi commercial retenu par l'administration fiscale française pour
 * la TVA. Le `Number.EPSILON` corrige les imprécisions binaires (ex. 1.005 qui,
 * en flottant, vaut 1.00499999… et s'arrondirait à tort à 1.00).
 *
 * NB : à ne pas confondre avec l'arrondi "banquier" strict (demi vers le pair),
 * qui n'est PAS celui appliqué par la DGFiP pour la TVA.
 */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1
  return (sign * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100
}

/** Convertit un montant en centimes entiers — base des comparaisons "au centime près". */
function toCents(n: number): number {
  return Math.round(round2(n) * 100)
}

/** Montant formaté pour le XML : point décimal, 2 décimales, déjà arrondi. */
function amount(n: number): string {
  return round2(n).toFixed(2)
}

/** Tous les montants d'une facture, calculés UNE fois et arrondis (réutilisés partout). */
export interface FacturXAmounts {
  /** Total de chaque ligne (quantité × PU), arrondi (BT-131). */
  lineTotals: number[]
  /** Taux de TVA appliqué (%). 0 si non assujetti. */
  rate: number
  /** Base imposable = Σ des totaux de ligne (BT-109 / TaxBasisTotalAmount). */
  basis: number
  /** Montant de TVA = round2(base × taux) (BT-110 / TaxTotalAmount). */
  vat: number
  /** Total TTC = base + TVA (BT-112 / GrandTotalAmount). */
  grandTotal: number
  /** Net à payer (BT-115 / DuePayableAmount). Ici = TTC (pas d'acompte). */
  duePayable: number
}

/**
 * Calcule TOUS les montants en appliquant la règle d'arrondi à chaque étape.
 * Cette fonction est la SEULE à produire des montants : validation et XML
 * consomment exactement les mêmes valeurs → aucune divergence possible.
 */
export function computeAmounts(invoice: Invoice): FacturXAmounts {
  const rate = invoice.vatEnabled ? invoice.vatRate : 0
  // PU arrondi puis total de ligne arrondi (display et calcul cohérents).
  const lineTotals = invoice.items.map((it) => round2(it.quantity * round2(it.unitPrice)))
  const basis = round2(lineTotals.reduce((sum, v) => sum + v, 0))
  const vat = round2(basis * (rate / 100))
  const grandTotal = round2(basis + vat)
  const duePayable = grandTotal
  return { lineTotals, rate, basis, vat, grandTotal, duePayable }
}

// ===========================================================================
// MOTEUR DE VALIDATION
// ===========================================================================

/** Erreur de conformité Factur-X : porte la liste détaillée des problèmes. */
export class FacturXValidationError extends Error {
  issues: string[]
  constructor(issues: string[]) {
    super(`Facture non conforme Factur-X :\n- ${issues.join('\n- ')}`)
    this.name = 'FacturXValidationError'
    this.issues = issues
  }
}

/** Algorithme de Luhn (clé de contrôle SIREN/SIRET). */
function luhnValid(num: string): boolean {
  if (!/^\d+$/.test(num)) return false
  let sum = 0
  let double = false
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** Date au format ISO "YYYY-MM-DD" et réellement valide. */
function isISODate(s: string | undefined): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return false
  return !Number.isNaN(new Date(s).getTime())
}

/**
 * RÈGLE 3 — Format du SIREN/SIRET.
 * - requis pour le vendeur (BT-30), facultatif pour l'acheteur.
 * - 9 chiffres (SIREN) ou 14 chiffres (SIRET).
 * - clé de Luhn valide (exception connue : La Poste, SIREN 356000000).
 */
function validateRegistration(who: string, p: InvoiceParty, issues: string[], required: boolean): void {
  const d = (p.siret ?? '').replace(/\D/g, '')
  if (!d) {
    if (required) issues.push(`SIREN/SIRET de l'${who} requis pour le profil BASIC (BT-30).`)
    return
  }
  if (d.length !== 9 && d.length !== 14) {
    issues.push(`SIREN/SIRET de l'${who} : 9 (SIREN) ou 14 (SIRET) chiffres attendus, reçu ${d.length}.`)
    return
  }
  const sirenPart = d.slice(0, 9)
  const isLaPoste = sirenPart === '356000000' // exception historique non conforme à Luhn
  if (!isLaPoste && !luhnValid(sirenPart)) {
    issues.push(`SIREN de l'${who} invalide (clé de contrôle Luhn incorrecte) : ${sirenPart}.`)
  }
  if (d.length === 14 && !isLaPoste && !luhnValid(d)) {
    issues.push(`SIRET de l'${who} invalide (clé de contrôle Luhn incorrecte) : ${d}.`)
  }
}

/** RÈGLE 3 — Code pays ISO 3166-1 alpha-2 (FR, BE, DE…). */
function validateCountry(who: string, p: InvoiceParty, issues: string[]): void {
  const code = (p.countryCode ?? '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) {
    issues.push(`Code pays de l'${who} invalide : ISO 3166-1 alpha-2 attendu (ex. FR), reçu "${p.countryCode ?? ''}".`)
  }
}

/**
 * RÈGLE 3 — Validation des données obligatoires du profil.
 * Retourne la liste des problèmes (vide = conforme).
 */
export function validateData(invoice: Invoice, profile: FacturXProfile, amounts: FacturXAmounts): string[] {
  const issues: string[] = []

  // En-tête du document
  if (!invoice.number?.trim()) issues.push("Numéro de facture (BT-1) manquant.")
  if (!isISODate(invoice.date)) issues.push("Date d'émission (BT-2) manquante ou invalide.")
  if (!invoice.currency?.trim()) issues.push('Devise (BT-5) manquante.')

  // Vendeur (BT-27 nom, BT-30 immatriculation, BT-40 pays)
  if (!invoice.emitter.name?.trim()) issues.push("Nom de l'émetteur (BT-27) manquant.")
  validateRegistration('émetteur', invoice.emitter, issues, true)
  validateCountry('émetteur', invoice.emitter, issues)

  // Acheteur (BT-44 nom, BT-55 pays) — immatriculation facultative
  if (!invoice.client.name?.trim()) issues.push('Nom du client (BT-44) manquant.')
  validateCountry('client', invoice.client, issues)
  validateRegistration('client', invoice.client, issues, false)

  // Mention d'exonération obligatoire si TVA à 0 (BT-120)
  if (amounts.rate === 0) {
    const reason = invoice.vatExemptionReason?.trim() || LEGAL_MENTIONS_ME[0]
    if (!reason) {
      issues.push("Mention d'exonération de TVA requise lorsque la TVA est à 0 (BT-120).")
    }
  }

  // En BASIC, au moins une ligne valorisée
  if (profile === 'basic' && invoice.items.length === 0) {
    issues.push('Au moins une ligne de facturation est requise (profil BASIC).')
  }

  return issues
}

/**
 * RÈGLE 2 — Cohérence mathématique (au centime près).
 * Lève une erreur explicite si :
 *   - Σ(totaux de ligne) ≠ base imposable, ou
 *   - base + TVA ≠ total TTC, ou
 *   - TTC ≠ net à payer, ou
 *   - TVA ≠ round2(base × taux).
 */
export function assertMathCoherence(a: FacturXAmounts): void {
  const issues: string[] = []
  const sumLines = round2(a.lineTotals.reduce((s, v) => s + v, 0))

  if (toCents(sumLines) !== toCents(a.basis)) {
    issues.push(`Σ lignes (${amount(sumLines)}) ≠ base imposable (${amount(a.basis)}).`)
  }
  const expectedVat = round2(a.basis * (a.rate / 100))
  if (toCents(expectedVat) !== toCents(a.vat)) {
    issues.push(`Montant de TVA (${amount(a.vat)}) ≠ base × taux (${amount(expectedVat)}).`)
  }
  if (toCents(a.basis + a.vat) !== toCents(a.grandTotal)) {
    issues.push(`Base + TVA (${amount(a.basis + a.vat)}) ≠ total TTC (${amount(a.grandTotal)}).`)
  }
  if (toCents(a.grandTotal) !== toCents(a.duePayable)) {
    issues.push(`Total TTC (${amount(a.grandTotal)}) ≠ net à payer (${amount(a.duePayable)}).`)
  }

  if (issues.length) throw new FacturXValidationError(issues)
}

/**
 * Validation complète NON bloquante — pratique pour l'UI (afficher les erreurs
 * avant de proposer le téléchargement, sans try/catch).
 */
export function validateInvoiceForFacturX(
  invoice: Invoice,
  profile: FacturXProfile = 'basic',
): { valid: boolean; issues: string[] } {
  const amounts = computeAmounts(invoice)
  const issues = validateData(invoice, profile, amounts)
  try {
    assertMathCoherence(amounts)
  } catch (e) {
    if (e instanceof FacturXValidationError) issues.push(...e.issues)
    else throw e
  }
  return { valid: issues.length === 0, issues }
}

// ===========================================================================
// UTILITAIRES XML
// ===========================================================================

/** Échappe les caractères réservés XML. */
function esc(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Date "2026-06-12" -> "20260612" (format 102 de la norme). */
function dateCII(iso: string): string {
  return (iso || '').slice(0, 10).replace(/-/g, '')
}

/** SIREN (9 chiffres) dérivé du SIRET — identifiant légal BT-30. */
function siren(party: InvoiceParty): string {
  return (party.siret ?? '').replace(/\D/g, '').slice(0, 9)
}

function countryCode(party: InvoiceParty): string {
  return (party.countryCode || 'FR').toUpperCase().slice(0, 2)
}

// ---------------------------------------------------------------------------
// Fragments réutilisables
// ---------------------------------------------------------------------------

/** Adresse postale structurée (BT-50 à BT-55). */
function postalAddress(p: InvoiceParty): string {
  return `        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(p.postalCode)}</ram:PostcodeCode>
          <ram:LineOne>${esc(p.address)}</ram:LineOne>
          <ram:CityName>${esc(p.city)}</ram:CityName>
          <ram:CountryID>${countryCode(p)}</ram:CountryID>
        </ram:PostalTradeAddress>`
}

/** Bloc d'une partie (vendeur ou acheteur). `rich` = inclure adresse + TVA (profil BASIC). */
function tradeParty(tag: string, p: InvoiceParty, rich: boolean): string {
  const s = siren(p)
  const lines: string[] = [`      <ram:${tag}>`]
  lines.push(`        <ram:Name>${esc(p.name)}</ram:Name>`)
  // Identifiant légal SIREN (schemeID 0002 = répertoire SIRENE de l'INSEE)
  if (s.length === 9) {
    lines.push(`        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${s}</ram:ID>
        </ram:SpecifiedLegalOrganization>`)
  }
  if (rich) lines.push(postalAddress(p))
  // N° de TVA intracommunautaire (BT-31 / BT-48) si renseigné
  if (rich && p.vatNumber) {
    lines.push(`        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(p.vatNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`)
  }
  lines.push(`      </ram:${tag}>`)
  return lines.join('\n')
}

/** Lignes de facture (profil BASIC). Utilise les totaux déjà arrondis. */
function lineItems(invoice: Invoice, amounts: FacturXAmounts): string {
  const category = invoice.vatEnabled ? 'S' : 'E' // S = taux normal, E = exonéré
  return invoice.items
    .map((item, i) => {
      return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(item.description || `Article ${i + 1}`)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${amount(item.unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${amount(amounts.rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${amount(amounts.lineTotals[i])}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    })
    .join('\n')
}

/** Ventilation de TVA (profil BASIC) — une catégorie ici. */
function tradeTax(invoice: Invoice, amounts: FacturXAmounts): string {
  const category = invoice.vatEnabled ? 'S' : 'E'
  // Motif d'exonération : champ saisi, sinon mention micro par défaut.
  const reason = invoice.vatExemptionReason?.trim() || LEGAL_MENTIONS_ME[0]
  const exemption = invoice.vatEnabled
    ? ''
    : `\n        <ram:ExemptionReason>${esc(reason)}</ram:ExemptionReason>`
  return `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amount(amounts.vat)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${exemption}
        <ram:BasisAmount>${amount(amounts.basis)}</ram:BasisAmount>
        <ram:CategoryCode>${category}</ram:CategoryCode>
        <ram:RateApplicablePercent>${amount(amounts.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`
}

// ===========================================================================
// CONSTRUCTION DU DOCUMENT
// ===========================================================================

/**
 * Construit le XML Factur-X à partir d'une facture, APRÈS validation.
 * @throws {FacturXValidationError} si une règle fiscale n'est pas respectée.
 * @param invoice La facture (objet métier de l'app).
 * @param profile 'basic' (défaut, recommandé) ou 'minimum'.
 */
export function buildFacturXXml(invoice: Invoice, profile: FacturXProfile = 'basic'): string {
  // 1) Montants centralisés (arrondis stricts — règle 1).
  const amounts = computeAmounts(invoice)

  // 2) Données obligatoires (règle 3) — on remonte TOUTES les erreurs d'un coup.
  const dataIssues = validateData(invoice, profile, amounts)
  if (dataIssues.length) throw new FacturXValidationError(dataIssues)

  // 3) Cohérence mathématique (règle 2) — lève si Σ lignes / base / TVA / TTC divergent.
  assertMathCoherence(amounts)

  const rich = profile === 'basic'
  const linesXml = rich ? `\n${lineItems(invoice, amounts)}` : ''
  const taxXml = rich ? `\n${tradeTax(invoice, amounts)}` : ''
  const buyerRef = invoice.buyerReference
    ? `\n      <ram:BuyerReference>${esc(invoice.buyerReference)}</ram:BuyerReference>`
    : ''
  const currency = esc(invoice.currency || 'EUR')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
    xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${GUIDELINE[profile]}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateCII(invoice.date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${linesXml}
    <ram:ApplicableHeaderTradeAgreement>${buyerRef}
${tradeParty('SellerTradeParty', invoice.emitter, rich)}
${tradeParty('BuyerTradeParty', invoice.client, rich)}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery />
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${taxXml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dateCII(invoice.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>${amount(amounts.basis)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${amount(amounts.vat)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amount(amounts.grandTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amount(amounts.duePayable)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
