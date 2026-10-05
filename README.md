# epistudent

**[epistudent.fr](https://epistudent.fr)** — le hub des étudiant·e·s Epitech (Tek1 → Tek5) : deadlines, groupes de projet, salles libres, retours Moulinette anonymes, échanges de soutenances et file du Bocal.

Front statique hébergé sur **GitHub Pages**, données et temps réel sur **Supabase**. Aucun serveur applicatif : toute la sécurité est en base (RLS + fonctions `security definer`).

## Fonctionnalités

| Page | Ce qui marche |
| --- | --- |
| `/login` | Connexion Microsoft (OAuth PKCE), comptes `@epitech.eu` uniquement |
| `/onboarding`, `/profile` | Promo, campus, langages notés 1-5, dispos, consentement matchmaking ; notifications |
| `/deadlines` | Liste triée par urgence, calendrier mensuel, filtre par module, statut, ajout depuis le catalogue ou nouveau projet |
| `/groups` | Demandes de groupe (taille, mode, objectif), candidats classés par l'algo de matching, rejoindre, **chat temps réel** |
| `/rooms` | Salles libres par campus (TTL 45 min, purge `pg_cron`), plan SVG, confirmation sur place, **karma** (+1 signalement, +2 confirmation) |
| `/moulinette` | Résultats anonymes (HMAC user+projet avec pepper serveur), taux de réussite, score moyen, heures, pièges fréquents, commentaires |
| `/swaps` | Bourse de créneaux de soutenance, **matching bilatéral automatique** en base, notification + partage d'email au seul match |
| `/bocal` | Assistants dispo par campus, ticket, position + ETA, l'assistant appelle le suivant (notification) |

Le **scraper intra n'est pas encore branché** (en attente de validation) : en attendant, les projets sont ajoutés par les étudiants au catalogue partagé.

## Stack

| Couche | Choix |
| --- | --- |
| Front | Next.js 14 (App Router, `output: "export"`) · TypeScript · Tailwind · [shadcn/ui](https://github.com/shadcn/ui) restylé |
| Données | Supabase (Postgres, Auth, Realtime) via [supabase-js](https://github.com/supabase/supabase-js) |
| Hébergement | GitHub Pages + domaine `epistudent.fr` (`apps/web/public/CNAME`) |
| Worker | Node (`apps/worker`) — accueillera le scraper [Playwright](https://github.com/microsoft/playwright) et le check norme [banana-vera](https://github.com/Epitech/banana-vera). Fly.io / Railway. |
| Tests | Vitest (matching, utils) · Playwright E2E mobile + desktop contre une vraie stack Supabase |

Design : inspiration streetwear — fond blanc, encre noire, un seul rouge, coins carrés, logo en boîte rouge et titres en *Jost Black Italic*. Thème sombre et FR/EN disponibles en haut à droite.

```
apps/web        site statique (pages, composants, lib/supabase, lib/auth, lib/i18n)
apps/worker     jobs planifiés (scraper à venir)
packages/db     types générés, schémas zod, algo de matching (+ tests)
packages/ui     composants shadcn/ui + preset Tailwind
supabase/       config locale, migrations versionnées, seed
```

## Mise en ligne sur epistudent.fr

À faire une fois (≈ 20 min) :

1. **Projet Supabase** — créer un projet sur [supabase.com](https://supabase.com) (région EU).
   - *Authentication › URL configuration* : Site URL `https://epistudent.fr`, Redirect URLs `https://epistudent.fr/**`.
   - *Authentication › Providers* : activer **Azure** (étape 2), **désactiver Email**.
2. **App Microsoft Entra ID** — *App registrations › New registration* ; Redirect URI (Web) : `https://<project-ref>.supabase.co/auth/v1/callback`. Créer un client secret. Dans Supabase › Azure : client id, secret, URL `https://login.microsoftonline.com/<tenant-id>` (tenant Epitech si possible, sinon `common` — le domaine est de toute façon filtré en base).
3. **Variables GitHub** — *Settings › Secrets and variables › Actions* :
   - Variables : `NEXT_PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé publique *anon*), `SUPABASE_PROJECT_ID` (`<ref>`).
   - Secrets : `SUPABASE_ACCESS_TOKEN` ([token perso](https://supabase.com/dashboard/account/tokens)), `SUPABASE_DB_PASSWORD`.
4. **GitHub Pages** — *Settings › Pages* : Source **GitHub Actions**, Custom domain `epistudent.fr`, cocher *Enforce HTTPS* (dès que le certificat est émis).
5. **DNS de epistudent.fr** chez le registrar :
   ```
   epistudent.fr.      A     185.199.108.153
   epistudent.fr.      A     185.199.109.153
   epistudent.fr.      A     185.199.110.153
   epistudent.fr.      A     185.199.111.153
   epistudent.fr.      AAAA  2606:50c0:8000::153   (+ 8001, 8002, 8003)
   www.epistudent.fr.  CNAME <owner>.github.io.
   ```
6. Pousser sur la branche : le workflow [`deploy.yml`](.github/workflows/deploy.yml) applique les migrations (`supabase db push`), build le site et le publie.

Désigner un assistant Bocal : `update profiles set role = 'assistant' where email = '…@epitech.eu';` (SQL editor Supabase).

> La clé *anon* est publique par conception : elle est dans le bundle JS. Ce qui protège les données, ce sont les politiques RLS — ne jamais mettre la clé *service_role* dans une variable `NEXT_PUBLIC_*`.

## Développement local

Prérequis : Node 22, pnpm 10 (`corepack enable`), Docker démarré.

```bash
pnpm install
cp .env.example supabase/.env          # bloc "Supabase local auth providers" (placeholders OK)
pnpm db:start                          # Postgres, Auth, REST, Realtime + migrations + seed
cp .env.example apps/web/.env.local    # bloc "Web", clés affichées par db:start
pnpm dev                               # http://localhost:3000
```

En local, la connexion Microsoft demande une vraie app Entra ID (voir plus haut, redirect `http://127.0.0.1:54321/auth/v1/callback`). Pour juste explorer l'app, les tests E2E montrent comment créer un utilisateur et injecter sa session (`apps/web/e2e/helpers.ts`).

| Commande | Effet |
| --- | --- |
| `pnpm db:reset` | Rejoue migrations + seed |
| `pnpm db:types` | Régénère `packages/db/src/database.types.ts` (vérifié en CI) |
| `pnpm exec supabase migration new <nom>` | Nouvelle migration |
| `pnpm dev:worker` / `docker compose up worker` | Worker |

Réseau qui bloque GHCR : `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start`.

Le Supabase CLI pilote lui-même les conteneurs Docker de la stack et reste aligné avec la plateforme hébergée ; `docker-compose.yml` ne sert qu'au worker.

## Sécurité & vie privée

- Domaine `@epitech.eu` vérifié côté app **et** par le trigger `enforce_epitech_email` sur `auth.users` (aucun compte hors domaine ne peut exister).
- **RLS sur toutes les tables.** Les profils ne sont lisibles que par leur propriétaire ; les autres étudiants n'en voient qu'un extrait, et seulement s'ils ont consenti (`matchmaking_opt_in`), via `matchmaking_candidates()`.
- Karma, rôle et email non modifiables par l'utilisateur (privilèges par colonne).
- Moulinette : aucun `user_id` stocké ; empreinte HMAC avec un pepper dans un schéma `private` non exposé.
- Échanges de soutenance : l'email n'est partagé qu'avec la personne qui matche (`swap_partner()`), consentement affiché avant publication.

## Tests

```bash
pnpm lint && pnpm typecheck && pnpm test    # ESLint, tsc, Vitest

# E2E : stack locale démarrée + apps/web/.env.local rempli
set -a; . apps/web/.env.local; set +a
pnpm --filter @studybuddy/web build         # → apps/web/out
pnpm test:e2e                               # sert out/ comme GitHub Pages
```

- `public.spec.ts` — redirections, i18n, thème, flow OAuth Azure PKCE (intercepté), anti open-redirect, 404.
- `authenticated.spec.ts` — refus des comptes hors domaine, onboarding, déconnexion.
- `features.spec.ts` — un scénario par fonctionnalité, multi-utilisateurs : deadlines + calendrier, salles + karma, Moulinette anonyme, échange de soutenance bilatéral, groupe + chat temps réel, file du Bocal.

Côté projets C des étudiants, les tests unitaires se font avec [Criterion](https://github.com/Snaipe/Criterion) — piste pour enrichir les pièges Moulinette.

## CI / CD

- [`ci.yml`](.github/workflows/ci.yml) — lint, typecheck, Vitest, build ; puis E2E Playwright contre Supabase lancé dans le runner.
- [`deploy.yml`](.github/workflows/deploy.yml) — migrations Supabase, build statique, publication GitHub Pages.

## Prochaines étapes

1. Scraper intra (à valider : authentification, CGU, rate-limit 1 req/s, cache).
2. Endpoint worker « check norme » via banana-vera.
