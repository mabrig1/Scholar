# Research Assistant Marketplace & Grant Management

This directory is the ownership boundary for the RA directory, grant-project
tracking, milestones, and reconciliation receipts. Marketplace code must not be
added to existing Scholar core libraries unless it is exposed through the
public feature barrel in `index.ts`.

## Persistence and authentication contract

Scholar currently uses MongoDB through Mongoose and protects administrator
routes with environment-backed middleware credentials. It does not yet have a
PostgreSQL client or per-user JWT sessions. The SQL migration in
`database/migrations/20260829140000_create_ra_marketplace.sql` is therefore a
forward migration contract, not a migration that can safely run against the
current production database.

Before runtime wiring, the application must provide:

1. `public.users(id uuid)` in PostgreSQL;
2. a signed JWT whose `sub` claim is that user ID;
3. a server-only PostgreSQL client; and
4. an explicit data migration or identity bridge from `MabrigUser._id`.

The SQL migration fails early when the user-table prerequisite is absent or
uses a non-UUID key. This prevents an apparently successful but disconnected
marketplace deployment.

## Exact feature hierarchy

```text
src/features/marketplace/
├── README.md
├── index.ts
├── actions/
│   └── .gitkeep
├── components/
│   ├── RADirectory.tsx                 # Step 3
│   └── ProjectGrantWorkspace.tsx       # Step 4
├── hooks/
│   └── .gitkeep
├── services/
│   └── .gitkeep
├── types/
│   └── index.ts
└── validation/
    └── .gitkeep
```

- `components/`: reusable client and server presentation components.
- `actions/`: authenticated Next.js server actions; never imported by client
  components except through action references.
- `services/`: server-only persistence queries, project totals, and receipt
  projections.
- `hooks/`: client-only filtering and interaction state.
- `types/`: serializable feature contracts shared across component boundaries.
- `validation/`: bounded input parsing for profiles, projects, and milestones.

Routes should remain thin adapters under `app/(marketplace)/` and import from
this feature. No marketplace route is added during Steps 1–2, so the scaffold
does not change the current navigation or runtime bundle.
