# epistudent

**[epistudent.fr](https://epistudent.fr)** — compteur de budget mensuel pour étudiants.

- Revenus (bourse, APL, job, parents…) et dépenses par catégorie
- Lignes mensuelles (loyer, bourse, abonnements) reportées automatiquement chaque mois
- Reste du mois et **reste à vivre par jour**, alerte quand on passe dans le rouge
- Répartition des dépenses par catégorie, navigation entre les mois
- **Sans compte, sans serveur** : les données restent dans le navigateur (`localStorage`) ; export / import JSON pour sauvegarder ou changer d'appareil
- Mobile-first, thème clair / sombre

## Stack

Next.js 14 en export statique · TypeScript · Tailwind · [shadcn/ui](https://github.com/shadcn/ui) (`packages/ui`) · hébergé sur GitHub Pages.

```
apps/web/app/page.tsx      la page
apps/web/lib/budget.ts     calculs (testés avec Vitest)
apps/web/lib/use-budget.ts persistance localStorage
packages/ui                composants + preset Tailwind
```

## Développer

```bash
corepack enable && pnpm install
pnpm dev                                  # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test  # ESLint, tsc, Vitest
pnpm --filter @studybuddy/web build && pnpm test:e2e   # Playwright sur le site statique
```

## Mise en ligne

Chaque push sur `main` ou `claude/studybuddy-epitech-build-1hgay1` lance [`deploy.yml`](.github/workflows/deploy.yml) : build statique puis publication sur GitHub Pages (≈ 2 min).

Réglages GitHub (une seule fois) : *Settings › Pages* → Source **GitHub Actions**, Custom domain `epistudent.fr`, *Enforce HTTPS*.
DNS : 4 enregistrements A `epistudent.fr` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
