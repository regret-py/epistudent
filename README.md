# StudyBuddy Epitech

Le QG des étudiant·e·s Epitech (Grande École, Tek1 → Tek5) : deadlines de l'intra, formation de groupes de projet, salles libres, retours Moulinette anonymes, échange de soutenances et file d'attente du Bocal.

> **État actuel** — socle livré : monorepo, schéma Supabase complet avec RLS, login Microsoft restreint à `@epitech.eu`, onboarding, dashboard (vide) mobile-first, dark mode, FR/EN, algo de matching testé, CI. Le **scraper intra n'est pas encore implémenté** (en attente de validation, voir [Prochaines étapes](#prochaines-étapes)).

## Stack

| Couche | Choix |
| --- | --- |
| Front | Next.js 14 (App Router) · TypeScript · Tailwind · [shadcn/ui](https://github.com/shadcn/ui) |
| Back | Routes API / Server Actions Next.js · Supabase (Postgres, Auth, Realtime) via [supabase-js](https://github.com/supabase/supabase-js) + `@supabase/ssr` |
| Worker | Node (service séparé) — accueillera le scraper [Playwright](https://github.com/microsoft/playwright) et le check norme [banana-vera](https://github.com/Epitech/banana-vera) |
| Auth | OAuth Microsoft (tenant Epitech) ; GitHub prévu en *compte lié* |
| Tests | Vitest (logique métier) · Playwright (E2E, mobile + desktop) |
| Deploy | Vercel (`apps/web`) · Fly.io ou Railway (`apps/worker`) |

## Structure

```
apps/
  web/        Next.js — UI, auth, server actions          (Vercel)
  worker/     service Node long-running : jobs planifiés   (Fly.io / Railway)
packages/
  db/         types générés de la DB, schémas zod, algo de matching (+ tests Vitest)
  ui/         composants shadcn/ui + preset Tailwind partagé
supabase/
  config.toml           stack locale + providers OAuth
  migrations/           migrations SQL versionnées
  seed.sql              données de dev
```

## Setup local

Prérequis : **Node 22** (`.nvmrc`), **pnpm 10** (`corepack enable`), **Docker** (démarré).

```bash
pnpm install

# 1. Supabase local (Postgres, Auth, REST, Realtime, Studio) — applique migrations + seed
cp .env.example supabase/.env    # garder seulement le bloc "Supabase local auth providers"
pnpm db:start                    # affiche API URL, anon key, service_role key

# 2. Web
cp .env.example apps/web/.env.local   # renseigner le bloc "Web" avec les clés affichées
pnpm dev                              # http://localhost:3000

# 3. Worker (optionnel pour l'instant)
cp .env.example apps/worker/.env      # bloc "Worker"
pnpm dev:worker                       # http://localhost:8080/health
# ou dans Docker : docker compose up worker
```

Commandes utiles :

| Commande | Effet |
| --- | --- |
| `pnpm db:reset` | Rejoue toutes les migrations + `seed.sql` |
| `pnpm db:types` | Régénère `packages/db/src/database.types.ts` depuis la DB locale (la CI vérifie qu'il est à jour) |
| `pnpm exec supabase migration new <nom>` | Crée une nouvelle migration versionnée |
| `pnpm db:stop` | Arrête la stack |

Studio local : http://127.0.0.1:54323 — e-mails de dev (Mailpit) : http://127.0.0.1:54324.

### Pourquoi le Supabase CLI plutôt qu'un `docker-compose.yml` Supabase

Le CLI pilote lui-même Docker (une dizaine de conteneurs : Postgres, GoTrue, PostgREST, Realtime, Kong…) en versions alignées avec la plateforme hébergée, applique `supabase/migrations` et génère les types. Un compose « self-hosted » maintenu à la main fait ~400 lignes et dérive vite. Le `docker-compose.yml` du repo sert uniquement à lancer le **worker** contre cette stack.

> Réseau restreint (GHCR bloqué) : `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start` tire les images depuis Docker Hub.

### Login Microsoft (compte Epitech)

1. Portail Azure → **Microsoft Entra ID → App registrations → New registration**.
   - *Supported account types* : **single tenant** (annuaire Epitech) si vous avez la main dessus ; sinon multi-tenant — la restriction de domaine est de toute façon appliquée côté app et DB.
   - *Redirect URI (Web)* : `http://127.0.0.1:54321/auth/v1/callback` en local, `https://<project>.supabase.co/auth/v1/callback` en prod.
2. **Certificates & secrets** → nouveau client secret.
3. Renseigner `supabase/.env` (local) ou *Dashboard → Authentication → Providers → Azure* (prod) :
   `SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID`, `..._SECRET`, `..._URL=https://login.microsoftonline.com/<tenant-id>`.
4. Prod : **désactiver le provider Email** dans le dashboard (il reste actif en local pour les tests E2E).

Le domaine `@epitech.eu` est vérifié à trois niveaux :

1. `domain_hint=epitech.eu` côté Microsoft (confort uniquement) ;
2. `/auth/callback` et le middleware déconnectent toute session hors domaine ;
3. **trigger Postgres `enforce_epitech_email`** sur `auth.users` : aucun compte hors domaine ne peut être créé, quel que soit le provider.

## Base de données

Migration initiale : [`supabase/migrations/20261005000000_init.sql`](supabase/migrations/20261005000000_init.sql). **RLS activé sur toutes les tables.** Principes :

| Table | Lecture | Écriture |
| --- | --- | --- |
| `profiles` | soi uniquement | soi, colonnes déclaratives seulement (`karma`, `role`, `email` réservés au serveur) |
| `projects` | authentifiés | worker (service_role) |
| `deadlines` | soi | statut uniquement ; lignes créées par le worker |
| `group_requests` | les siennes + demandes ouvertes **de users ayant consenti** (`matchmaking_opt_in`) | soi |
| `groups`, `messages` | membres du groupe | groupes : service ; messages : membres |
| `room_reports` | reports non expirés (TTL 45 min, purge par le worker) | soi, TTL ≤ 45 min |
| `moulinette_reports` | authentifiés (agrégats) | **aucun `user_id` stocké** ; insertion via RPC à venir (hash user+projet avec pepper serveur) |
| `defense_swaps` | ouverts + les siens | soi |
| `assistants_status` | authentifiés | assistants (role) sur leur propre ligne |

Le comportement RLS est couvert par les tests E2E authentifiés (onboarding réel contre la DB, refus des comptes hors domaine).

## Tests

```bash
pnpm test        # Vitest : matching (packages/db), scheduler (apps/worker)
pnpm lint && pnpm typecheck

# E2E — nécessite `pnpm db:start` et apps/web/.env.local rempli
pnpm --filter @studybuddy/web build
set -a; . apps/web/.env.local; set +a
pnpm test:e2e
```

- `e2e/public.spec.ts` : redirections, i18n, dark mode, lancement du flow OAuth Azure (intercepté), protection contre l'open-redirect `?next=`.
- `e2e/authenticated.spec.ts` : crée un vrai user via l'API admin, reproduit les cookies `@supabase/ssr`, puis onboarding → dashboard → logout. Ignoré automatiquement sans `SUPABASE_SERVICE_ROLE_KEY`.
- Chaque test tourne en profil **mobile (Pixel 7)** et **desktop**.

Pour les projets C des étudiants, les tests unitaires côté Epitech se font avec [Criterion](https://github.com/Snaipe/Criterion) — une piste pour enrichir les retours Moulinette (pièges de tests fréquents).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) :
1. **checks** — lint (ESLint + `tsc`), typecheck, Vitest, build de tous les packages ;
2. **e2e** — démarre Supabase via le CLI, vérifie que les types DB sont à jour, build, Playwright.

## Déploiement

- **Web → Vercel** : root directory `apps/web`, framework Next.js, install `pnpm install`. Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ajouter `https://<domaine>/auth/callback` aux *Redirect URLs* Supabase.
- **Worker → Fly.io** : `fly launch --no-deploy --config apps/worker/fly.toml` puis `fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile` depuis la racine. Secrets : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Image basée sur `mcr.microsoft.com/playwright` (Chromium prêt pour le scraper). Railway : même Dockerfile.
- **DB** : `pnpm exec supabase link --project-ref <ref>` puis `pnpm exec supabase db push`.

## Conventions i18n / UI

- Dictionnaires typés : `apps/web/lib/i18n/dictionaries/{fr,en}.ts` (EN doit avoir exactement les mêmes clés que FR — vérifié par `tsc`).
- Langue : cookie `locale` → `Accept-Language` → FR par défaut ; persistée aussi sur `profiles.locale`.
- Thème sombre par défaut (`next-themes`), tokens shadcn dans `apps/web/app/globals.css`.
- Ajout d'un composant shadcn : `pnpm dlx shadcn@latest add <comp>` dans `packages/ui` (voir `components.json`), puis export dans `src/index.ts`.

## Prochaines étapes

1. **Scraper intra** (en attente de validation — authentification, CGU, robots.txt, rate-limit 1 req/s, cache).
2. Dashboard deadlines (calendrier + liste par urgence, filtres module).
3. Matchmaking (`packages/db/src/matching.ts` est prêt et testé) + chat Realtime.
4. Salles libres (carte SVG par campus, karma), Moulinette (RPC anonymisée), bourse de soutenances, Bocal.
5. Endpoint worker « check norme » via banana-vera.
