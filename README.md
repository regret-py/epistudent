# epistudent

**[epistudent.fr](https://epistudent.fr)** — calculateur de budget étudiant.

Tu entres ton **budget du mois**, l'**épargne** que tu veux mettre de côté et, si tu en as, ton **loyer et tes charges fixes**. Le site répartit ce qui reste par poste, au mois, à la semaine et au jour :

| poste | part par défaut |
| --- | --- |
| bouffe | 40 % |
| sorties | 15 % |
| transport | 12 % |
| shopping | 9 % |
| abonnements | 8 % |
| hygiène & santé | 8 % |
| imprévus | 8 % |

- Répartition au centime près (la somme des postes = le montant à dépenser).
- **Profils** : équilibré, chez les parents, coloc / studio, budget serré.
- **Suivi des dépenses du mois** par poste : dépensé, reste, reste par jour jusqu'à la fin du mois (remis à zéro chaque mois).
- **Objectif d'épargne** : « 600 € pour un ordi » → nombre de mois et date d'arrivée.
- **Lien de partage** : les montants voyagent dans le fragment `#…` de l'URL, jamais envoyé à un serveur.
- Équivalence en repas, impression / PDF, pourcentages personnalisables, copier, remise à zéro, thème clair / sombre.
- Sans compte, sans serveur, sans traceur : le calcul se fait dans le navigateur, les montants restent dans `localStorage`.

## Stack

Next.js 14 en export statique · TypeScript · Tailwind · [shadcn/ui](https://github.com/shadcn/ui) (`packages/ui`) · GitHub Pages.

```
apps/web/app/page.tsx          la page (résultat, répartition, FAQ)
apps/web/lib/plan.ts           calculs : répartition, saisie des montants, texte copié (tests Vitest)
apps/web/lib/use-saved.ts      mémorisation locale des montants
apps/web/scripts/csp.mjs       ajoute la Content-Security-Policy aux pages exportées
apps/web/e2e/                  tests Playwright (mobile + desktop)
packages/ui                    bouton shadcn + preset Tailwind
```

## Sécurité

GitHub Pages ne permet pas d'envoyer des en-têtes HTTP : la politique de sécurité est donc mise dans chaque page.

- **CSP stricte** injectée après le build (`scripts/csp.mjs`) : `default-src 'none'`, scripts autorisés uniquement par empreinte SHA-256, aucun style inline, aucune origine tierce, `form-action 'none'`, `base-uri 'none'`. Le build échoue si une page ne peut pas être protégée.
- **Anti-clickjacking** : le site refuse de s'afficher dans un cadre (`components/frame-guard.tsx`).
- **Aucune requête externe** : police auto-hébergée, pas d'analytics ; `referrer: no-referrer`.
- **Données locales validées** : tout ce qui est relu depuis `localStorage` est filtré (clés connues, bornes, pas de pollution de prototype).
- Les tests E2E échouent à la moindre violation CSP, erreur console ou requête vers un autre domaine.

## Développer

```bash
corepack enable && pnpm install
pnpm dev                                    # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test    # ESLint, tsc, Vitest
pnpm --filter @studybuddy/web build         # export statique + CSP → apps/web/out
pnpm test:e2e                               # Playwright sur le site exporté
```

## Mise en ligne

Chaque push sur `main` ou `claude/studybuddy-epitech-build-1hgay1` lance [`deploy.yml`](.github/workflows/deploy.yml) : lint, types, tests unitaires, build, tests E2E, puis publication. **Rien n'est publié si un test échoue.** Les autres branches et les pull requests passent par [`ci.yml`](.github/workflows/ci.yml).

Réglages à faire une fois sur GitHub :

1. **Settings › Pages › Build and deployment › Source : « GitHub Actions »**. En mode « Deploy from a branch », GitHub publie aussi la racine du dépôt (le README) à chaque push et peut écraser le site.
2. Même page : *Custom domain* `epistudent.fr`, puis cocher **Enforce HTTPS** dès que le certificat est prêt.
3. **Vérifier le domaine** (protection contre la prise de contrôle du domaine) : *Settings du compte › Pages › Add a domain* → `epistudent.fr`, ajouter l'enregistrement TXT `_github-pages-challenge-<compte>` demandé chez le registrar, puis *Verify*.
4. DNS chez le registrar : 4 enregistrements A `epistudent.fr` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (et AAAA `2606:50c0:8000::153` … `8003::153`). Pas d'enregistrement wildcard `*.epistudent.fr` vers GitHub.
