/**
 * Transmission d'une facture électronique vers le circuit officiel.
 *
 * ⚠️ Réglementaire (modèle révisé 2024) : on n'envoie PAS directement au PPF.
 *    Le flux passe par une **PDP** (Plateforme de Dématérialisation Partenaire)
 *    immatriculée, qui transmet ensuite au destinataire et au PPF (annuaire +
 *    e-reporting). Ce module modélise donc un appel à une PDP.
 *
 * Ceci est un PLACEHOLDER : aucune requête réseau réelle. Il fixe la signature
 * et la forme des données pour brancher facilement la vraie API plus tard.
 */
import type { Invoice } from '../types/invoice'

/** Configuration de la PDP (à fournir par ton prestataire une fois choisi). */
export interface PdpConfig {
  /** URL de base de l'API de la PDP. */
  baseUrl: string
  /** Jeton d'authentification (OAuth2 / clé API) — NE PAS committer en clair. */
  apiKey: string
  /** Mode bac à sable pour tester sans envoi réel. */
  sandbox?: boolean
}

/** Résultat normalisé d'une transmission. */
export interface PpfSubmissionResult {
  success: boolean
  /** Identifiant de dépôt renvoyé par la PDP (pour le suivi du cycle de vie). */
  depositId?: string
  /** Statut du cycle de vie e-invoicing (déposée, reçue, rejetée, encaissée…). */
  status: 'submitted' | 'rejected' | 'mock'
  message: string
}

/**
 * Envoie le PDF Factur-X à la PDP. **Mock** pour l'instant.
 *
 * @param invoice   La facture (pour les métadonnées de suivi).
 * @param facturXPdf Le PDF Factur-X (octets) produit par downloadFacturX/embedFacturX.
 * @param config    Config PDP (optionnelle tant qu'on est en mock).
 */
export async function sendToPpf(
  invoice: Invoice,
  facturXPdf: Uint8Array,
  config?: PdpConfig,
): Promise<PpfSubmissionResult> {
  // --- MOCK : à remplacer par l'appel réel à la PDP -----------------------
  console.info(
    `[PPF/PDP mock] Facture ${invoice.number} prête à l'envoi ` +
      `(${facturXPdf.byteLength} octets, destinataire SIRET ${invoice.client.siret ?? 'inconnu'}).`,
  )

  if (!config) {
    return {
      success: true,
      status: 'mock',
      message:
        'Mode démo : aucune PDP configurée. Renseignez PdpConfig pour activer la transmission réelle.',
    }
  }

  /*
   * IMPLÉMENTATION FUTURE (exemple indicatif) :
   *
   * const form = new FormData()
   * form.append('file', new Blob([facturXPdf], { type: 'application/pdf' }),
   *             `${invoice.number}.pdf`)
   * form.append('format', 'FACTUR-X')
   * const res = await fetch(`${config.baseUrl}/invoices`, {
   *   method: 'POST',
   *   headers: { Authorization: `Bearer ${config.apiKey}` },
   *   body: form,
   * })
   * const data = await res.json()
   * return {
   *   success: res.ok,
   *   depositId: data.depositId,
   *   status: res.ok ? 'submitted' : 'rejected',
   *   message: data.message ?? (res.ok ? 'Déposée' : 'Rejetée'),
   * }
   */

  return {
    success: false,
    status: 'rejected',
    message: 'Transmission réelle non encore implémentée (voir le bloc commenté).',
  }
}
