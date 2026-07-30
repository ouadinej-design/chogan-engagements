// ============================================================
// CONFIGURATION — Mes Engagements Chogan
// ============================================================
// Mot de passe de l'espace Nada (Formatrice)
export const NADA_PASSWORD = "nada2025";

// Code admin : débloque l'ouverture même avant la fin du verrou
export const ADMIN_PASSWORD = "admin2025";

// Code PIN fixe de Nada utilisé pour sceller/ouvrir les enveloppes.
// C'est CE code qu'elle devra taper le jour du coaching, en plus
// du code PIN personnel de la consultante.
// À changer dès que Nada a choisi son vrai code.
export const NADA_SEAL_PIN = "0000";

// Durée pendant laquelle l'enveloppe reste verrouillée après le
// scellement, avant que Nada puisse l'ouvrir avec la consultante.
// Valeur actuelle : 30 secondes (mode test).
// Pour la mise en production réelle "30 jours", remplacer par :
//   export const DUREE_VERROU_MS = 30 * 24 * 60 * 60 * 1000;
export const DUREE_VERROU_MS = 30 * 1000;
