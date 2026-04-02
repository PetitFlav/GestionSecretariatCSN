# Gestion Secrétariat CSN

Application web de gestion des adhérents du Centre Subaquatique Nantais.

## Démarrage rapide (GitHub Codespaces)

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Éditer `.env` et renseigner :
- `DATABASE_URL` et `DIRECT_URL` → vos URLs Supabase
- `SESSION_SECRET` → une chaîne aléatoire longue (`openssl rand -base64 32`)
- `NEXT_PUBLIC_APP_URL` → `http://localhost:3000` en dev

### 3. Initialiser la base de données

```bash
# Générer le client Prisma
npm run db:generate

# Appliquer les migrations
npm run db:migrate

# Ou en développement (push direct sans migration)
npm run db:push
```

### 4. Lancer le serveur de développement

```bash
npm run dev
```

L'application tourne sur http://localhost:3000

---

## Premier utilisateur (superuser)

Aucun compte n'existe au départ. Pour créer le premier superuser,
utilisez Prisma Studio ou une insertion directe en base :

```bash
npm run db:studio
```

Ou via psql / Supabase SQL editor :

```sql
INSERT INTO users (id, email, "firstName", "lastName", "passwordHash", role, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'votre@email.fr',
  'Prénom',
  'Nom',
  -- hash bcrypt de votre mot de passe (générer avec: node -e "require('bcryptjs').hash('motdepasse',12).then(console.log)")
  '$2a$12$...',
  'SUPERUSER',
  'ACTIVE',
  now(),
  now()
);
```

---

## Gestion des versions

Le numéro de version est dans `package.json` → champ `"version"`.

Convention : `MAJEUR.MINEUR.PATCH`

| Version | Contenu |
|---------|---------|
| `1.0.0` | Socle : auth, écran principal |
| `1.1.0` | Import Excel VPdive |
| `1.2.0` | Édition et impression étiquettes |
| `1.3.0` | Attestations PDF + email |
| `1.4.0` | Validation FFESSM |

Pour bumper la version avant un commit :

```bash
# Patch (1.0.0 → 1.0.1) — correction de bug
npm version patch

# Minor (1.0.0 → 1.1.0) — nouvelle fonctionnalité
npm version minor

# Major (1.0.0 → 2.0.0) — changement majeur
npm version major
```

Ces commandes mettent à jour `package.json` ET créent un tag git automatiquement.

---

## Variables d'environnement (Vercel)

À configurer dans Settings → Environment Variables de votre projet Vercel :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL Supabase avec pgbouncer |
| `DIRECT_URL` | URL Supabase directe (pour migrations) |
| `SESSION_SECRET` | Secret de session (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | URL de l'app en production |
| `SMTP_HOST` | Serveur SMTP |
| `SMTP_PORT` | Port SMTP (587) |
| `SMTP_USER` | Identifiant SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `SMTP_FROM` | Email expéditeur |

> ⚠️ Sans SMTP configuré, les liens de création de mot de passe s'affichent
> dans les logs serveur (utile en développement).

---

## Structure du projet

```
src/
├── app/
│   ├── actions/
│   │   └── auth.ts          # Server Actions auth
│   ├── admin/users/         # Gestion utilisateurs (admin)
│   ├── adherents/           # Liste adhérents (Phase 2)
│   ├── attestations/        # Attestations (Phase 4)
│   ├── auth/setup-password/ # Création mot de passe
│   ├── config/              # Configuration
│   ├── import/              # Import Excel (Phase 2)
│   ├── login/               # Page connexion
│   ├── register/            # Demande d'accès
│   ├── layout.tsx
│   ├── page.tsx             # Écran principal
│   └── globals.css
├── components/
│   ├── AppLayout.tsx        # Layout pages authentifiées
│   ├── AuthCard.tsx         # Carte auth
│   ├── AuthLayout.tsx       # Layout pages auth
│   ├── BottomBar.tsx        # Barre bas (version)
│   ├── StepIndicator.tsx    # Indicateur étapes
│   └── TopBar.tsx           # Barre haut (logo, user)
├── lib/
│   ├── db.ts                # Client Prisma singleton
│   ├── email.ts             # Nodemailer
│   ├── session.ts           # iron-session
│   └── validations.ts       # Schémas Zod
└── middleware.ts             # Protection des routes
```
