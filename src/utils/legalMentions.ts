export const LEGAL_MENTIONS_ME = [
  'TVA non applicable, art. 293 B du CGI',
  'Pénalités de retard : 3x le taux d\'intérêt légal en cas de retard de paiement',
  'Indemnité forfaitaire pour frais de recouvrement : 40 €',
] as const

/** Capitalise la première lettre de chaque segment séparé par " — " */
export function capitalizeDescription(value: string): string {
  return value
    .split(' — ')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' — ')
    .trimStart()
}
