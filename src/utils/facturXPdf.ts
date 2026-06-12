/**
 * Génération d'un PDF Factur-X côté navigateur avec pdf-lib.
 *
 * Pipeline : buildInvoicePdf() -> embedFacturX() -> téléchargement.
 *   1. buildInvoicePdf : dessine un PDF lisible de la facture.
 *   2. embedFacturX     : attache le XML CII (`factur-x.xml`) + métadonnées XMP.
 *
 * ⚠️ LIMITES DE CONFORMITÉ (à connaître) :
 *   - Un Factur-X *certifié* doit être un PDF/A-3 : polices EMBARQUÉES (pas les
 *     polices standard), profil colorimétrique ICC, XMP `pdfaid:part=3`.
 *   - Ici on utilise Helvetica (police standard, NON embarquée) pour rester
 *     léger et sans dépendance. Le XML est correctement embarqué et déclaré,
 *     mais pour une conformité PDF/A-3 stricte il faut :
 *       a) embarquer une vraie police TTF via @pdf-lib/fontkit, et
 *       b) ajouter un OutputIntent ICC,
 *     ou déléguer le packaging final à une PDP / un service serveur.
 *   Validez le fichier via le validateur FNFE-MPE / Chorus Pro avant production.
 */
import { PDFDocument, StandardFonts, rgb, AFRelationship, PDFName, PDFArray, PDFDict } from 'pdf-lib'
import type { Invoice, FacturXProfile } from '../types/invoice'
import { LEGAL_MENTIONS_ME } from './legalMentions'
// Source unique de vérité pour les montants : le PDF visuel et le XML embarqué
// consomment EXACTEMENT les mêmes valeurs arrondies -> jamais d'écart d'un centime.
import { buildFacturXXml, computeAmounts, round2 } from './facturX'

/**
 * Nettoie une chaîne pour l'encodage WinAnsi de pdf-lib (polices standard) :
 * remplace les caractères Unicode courants qui feraient planter drawText.
 */
function winAnsi(s: string): string {
  return s
    .replace(/[   ]/g, ' ') // espaces fines / insécables -> espace normal
    .replace(/[‘’]/g, "'") // guillemets simples typographiques
    .replace(/[“”]/g, '"') // guillemets doubles typographiques
    .replace(/…/g, '...') // points de suspension
    .replace(/[–—]/g, '-') // tirets demi / cadratin
}

/** Formatage monétaire sûr pour WinAnsi (espaces normaux + code devise). */
function money(n: number, currency: string): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  return winAnsi(`${formatted} ${currency}`)
}

// ---------------------------------------------------------------------------
// 1. Dessin du PDF lisible
// ---------------------------------------------------------------------------

export async function buildInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4 en points
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const M = 50 // marge
  let y = 800
  const dark = rgb(0.07, 0.09, 0.15)
  const gray = rgb(0.4, 0.4, 0.45)

  // Montants calculés UNE fois — partagés par les lignes et les totaux (= XML).
  const amounts = computeAmounts(invoice)

  // Helper de dessin : sanitize systématiquement le texte (WinAnsi).
  const text = (s: string, x: number, yy: number, size = 10, f = font, color = dark) =>
    page.drawText(winAnsi(s), { x, y: yy, size, font: f, color })

  // En-tête
  text('FACTURE', M, y, 22, bold)
  text(invoice.number, M, y - 20, 11, font, gray)
  text(`Émise le ${invoice.date}`, 400, y, 10, font, gray)
  if (invoice.dueDate) text(`Échéance ${invoice.dueDate}`, 400, y - 14, 10, font, gray)
  y -= 60

  // Parties (émetteur / client) côte à côte
  const party = (title: string, x: number) => {
    const p = title === 'DE' ? invoice.emitter : invoice.client
    let py = y
    text(title, x, py, 8, bold, gray); py -= 16
    text(p.name || '—', x, py, 11, bold); py -= 14
    if (title === 'DE' && invoice.isMicroEntrepreneur) { text('Micro-entrepreneur', x, py, 9, font, gray); py -= 13 }
    if (p.siret) { text(`SIRET : ${p.siret}`, x, py, 9, font, gray); py -= 13 }
    if (p.vatNumber) { text(`TVA : ${p.vatNumber}`, x, py, 9, font, gray); py -= 13 }
    if (p.address) { text(p.address, x, py, 9, font, gray); py -= 13 }
    if (p.postalCode || p.city) { text(`${p.postalCode} ${p.city}`.trim(), x, py, 9, font, gray); py -= 13 }
    if (p.country) { text(p.country, x, py, 9, font, gray); py -= 13 }
    return py
  }
  const yLeft = party('DE', M)
  const yRight = party('FACTURÉ À', 320)
  y = Math.min(yLeft, yRight) - 20

  // Tableau des lignes
  text('Description', M, y, 9, bold)
  text('Qté', 350, y, 9, bold)
  text('P.U.', 410, y, 9, bold)
  text('Total', 500, y, 9, bold)
  y -= 6
  page.drawLine({ start: { x: M, y }, end: { x: 545, y }, thickness: 1, color: dark })
  y -= 16

  for (const [i, item] of invoice.items.entries()) {
    text(item.description || `Article ${i + 1}`, M, y, 9)
    text(String(item.quantity), 350, y, 9)
    // PU arrondi et total de ligne issus de computeAmounts -> identiques au XML.
    text(money(round2(item.unitPrice), invoice.currency), 410, y, 9)
    text(money(amounts.lineTotals[i], invoice.currency), 500, y, 9)
    y -= 16
  }

  // Totaux — issus du même `amounts` que les lignes et le XML embarqué
  y -= 10
  const { basis, vat, grandTotal } = amounts
  if (invoice.vatEnabled) {
    text('Sous-total HT', 380, y, 10, font, gray); text(money(basis, invoice.currency), 480, y, 10); y -= 16
    text(`TVA (${invoice.vatRate}%)`, 380, y, 10, font, gray); text(money(vat, invoice.currency), 480, y, 10); y -= 16
    text('Total TTC', 380, y, 12, bold); text(money(grandTotal, invoice.currency), 480, y, 12, bold); y -= 20
  } else {
    text('Total', 380, y, 12, bold); text(money(grandTotal, invoice.currency), 480, y, 12, bold); y -= 20
  }

  // Mentions légales
  y -= 10
  text('Mentions légales', M, y, 8, bold, gray); y -= 14
  for (const m of LEGAL_MENTIONS_ME) { text(`• ${m}`, M, y, 8, font, gray); y -= 12 }

  return doc.save()
}

// ---------------------------------------------------------------------------
// 2. Embarquement du XML + métadonnées XMP Factur-X
// ---------------------------------------------------------------------------

/** XMP minimal déclarant le PDF/A-3 et l'extension Factur-X. */
function facturXXmp(profile: FacturXProfile): string {
  const conformance = profile === 'minimum' ? 'MINIMUM' : 'BASIC'
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${conformance}</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

/**
 * Déclare les fichiers embarqués comme "Associated Files" au niveau du catalogue
 * (tableau /AF) — REQUIS par Factur-X / PDF-A-3. pdf-lib remplit l'arbre
 * EmbeddedFiles mais n'ajoute pas ce /AF, on le fait donc à la main.
 */
function linkAssociatedFiles(doc: PDFDocument): void {
  const names = doc.catalog.lookup(PDFName.of('Names'), PDFDict)
  const embeddedFiles = names?.lookup(PDFName.of('EmbeddedFiles'), PDFDict)
  const namesArray = embeddedFiles?.lookup(PDFName.of('Names'), PDFArray)
  if (!namesArray) return

  const af = doc.context.obj([]) as PDFArray
  // Le tableau alterne [nom, filespec, nom, filespec, ...] -> on prend les filespecs.
  for (let i = 1; i < namesArray.size(); i += 2) {
    af.push(namesArray.get(i))
  }
  doc.catalog.set(PDFName.of('AF'), af)
}

/**
 * Attache le XML CII à un PDF existant et pose les métadonnées Factur-X.
 * @returns le PDF (octets) prêt à télécharger / transmettre.
 */
export async function embedFacturX(
  pdfBytes: Uint8Array,
  xml: string,
  profile: FacturXProfile = 'basic',
): Promise<Uint8Array> {
  // --- Passe 1 : attacher le XML (pdf-lib construit l'arbre EmbeddedFiles au save).
  const doc1 = await PDFDocument.load(pdfBytes)
  // Le nom de fichier DOIT être exactement "factur-x.xml" (attendu par les lecteurs).
  await doc1.attach(new TextEncoder().encode(xml), 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X invoice',
    afRelationship: AFRelationship.Alternative, // relation normative pour Factur-X
  })
  // useObjectStreams: false -> structure non compressée, plus sûre pour les validateurs PDF/A.
  const withAttachment = await doc1.save({ useObjectStreams: false })

  // --- Passe 2 : déclarer /AF au catalogue + métadonnées XMP.
  const doc2 = await PDFDocument.load(withAttachment)
  linkAssociatedFiles(doc2)

  doc2.setProducer('FacturaPro')
  doc2.setTitle('Facture')
  // XMP (flux non compressé, requis pour PDF/A).
  const xmp = facturXXmp(profile)
  const metaStream = doc2.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })
  const metaRef = doc2.context.register(metaStream)
  doc2.catalog.set(PDFName.of('Metadata'), metaRef)

  return doc2.save({ useObjectStreams: false })
}

// ---------------------------------------------------------------------------
// 3. Orchestration + téléchargement
// ---------------------------------------------------------------------------

function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Génère et télécharge le PDF Factur-X complet pour une facture. */
export async function downloadFacturX(invoice: Invoice, profile: FacturXProfile = 'basic'): Promise<void> {
  const xml = buildFacturXXml(invoice, profile)
  const pdf = await buildInvoicePdf(invoice)
  const facturX = await embedFacturX(pdf, xml, profile)
  triggerDownload(facturX, `${invoice.number || 'facture'}-facturx.pdf`)
}
