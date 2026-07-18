# Prisma migrations

The Prisma schema in `../schema.prisma` is the canonical database definition.

An initial SQL migration is intentionally not fabricated inside the build sandbox because Prisma's schema-engine binary could not be downloaded there. Create the initial migration against your real Neon **development branch**, review the generated SQL, commit it here, and then use `prisma migrate deploy` in production:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
```

Never point `migrate dev` at a production database. Use a separate Neon development branch for migration generation and validation.
