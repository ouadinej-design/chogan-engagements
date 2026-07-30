# Chogan Engagements

Application "bouteille à la mer" pour les consultantes Chogan (équipe Marie Ouadi) :
chaque consultante s'écrit une lettre d'engagements sur 30 jours, scellée avec son
propre code PIN. Le jour du coaching, Nada (formatrice) et la consultante ouvrent
la lettre ensemble avec les deux codes pour faire le point sur les victoires et
les blocages.

Basé sur le même mécanisme que "Suivi des Engagements Pep's", reconstruit en
Next.js / React / TypeScript / Tailwind.

## Configuration

Voir `src/lib/config.ts` :
- mot de passe de l'espace Nada
- code admin de secours
- code PIN fixe de Nada (scellement/ouverture)
- durée du verrou de temps (actuellement en mode test, à repasser à 30 jours en prod)

## Développement

```bash
npm install
npm run dev
```
