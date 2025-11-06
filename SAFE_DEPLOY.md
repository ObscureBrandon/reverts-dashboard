# Safe Production Deployment Guide

## ⚠️ CRITICAL: Database Safety Rules

### ✅ SAFE Commands
```bash
# Apply migrations (SAFE - only runs pre-written SQL)
bun db:migrate

# Start the application (SAFE)
bun start
```

### ❌ NEVER RUN THESE IN PRODUCTION
```bash
# DANGEROUS - Will try to drop bot tables!
bun drizzle-kit push
drizzle-kit push

# DANGEROUS - Will generate migrations to drop bot tables!
bun drizzle-kit generate
drizzle-kit generate
```

## Production Deployment Steps

### First Time Setup
1. **Backup production database** (just in case)
2. **Run migrations manually**:
   ```bash
   DATABASE_URL="your-prod-url" bun db:migrate
   ```
3. **Verify auth tables created**:
   ```bash
   psql $DATABASE_URL -c "\dt auth_*"
   ```
   Should show: `auth_user`, `auth_account`, `auth_session`, `auth_verification`

4. **Start the application**:
   ```bash
   bun start
   ```

### Subsequent Deploys
- Migrations run automatically if you add them to build/start script
- OR run `bun db:migrate` manually before deploying

## Why This Is Safe

### The Migration File
- Only contains `CREATE TABLE` statements
- No `DROP`, `DELETE`, `TRUNCATE`, or destructive commands
- Only creates 4 auth tables with `auth_*` prefix
- Bot tables are never referenced

### Protection Layers
1. **tablesFilter: ['auth_*']** - Only manages auth tables
2. **Manual migrations** - Pre-written SQL, no auto-generation
3. **Schema separation** - Bot tables not in auth-schema.ts
4. **No db:push script** - Removed to prevent accidents

## Database Table Ownership

| Table Type | Owner | Tool | Location |
|------------|-------|------|----------|
| `auth_*` | Dashboard | Drizzle | `lib/db/auth-schema.ts` |
| `User`, `Message`, etc. | Bot | Prisma | Bot repository |

## If Something Goes Wrong

1. **Auth tables fail to create**:
   - Check database permissions
   - Check DATABASE_URL is correct
   - Run migration SQL directly: `psql $DATABASE_URL < drizzle/0000_initial_auth_tables.sql`

2. **"Table already exists" error**:
   - This is SAFE - tables are already there
   - Mark migration as applied manually (see below)

3. **Mark migration as already applied**:
   ```sql
   INSERT INTO drizzle.__drizzle_migrations (hash, created_at) 
   VALUES ('0000_initial_auth_tables', EXTRACT(EPOCH FROM NOW())::bigint * 1000);
   ```

## Contact
If you're unsure about any step, DON'T run it. Test in staging first.
