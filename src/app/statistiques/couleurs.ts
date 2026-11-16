// Couleurs partagées des graphiques de statistiques.

// Évolution par saison : une couleur par saison, du plus clair (ancienne) au
// plus foncé (récente), même teinte : la lecture « avant → maintenant » est
// immédiate. Le plus clair passe sous 3:1 sur blanc : compensé par les
// chiffres écrits au-dessus des barres.
const RAMPE_SAISONS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']

export function couleursSaisons(n: number): string[] {
  // Répartit les n saisons sur toute la rampe : avec 2 saisons on obtient le
  // plus clair et le plus foncé (bien distincts), jamais deux bleus voisins.
  if (n <= 1) return [RAMPE_SAISONS[RAMPE_SAISONS.length - 1]]
  const L = RAMPE_SAISONS.length
  return Array.from({ length: n }, (_, i) =>
    RAMPE_SAISONS[Math.min(L - 1, Math.round((i * (L - 1)) / (n - 1)))])
}
