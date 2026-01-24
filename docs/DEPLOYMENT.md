# Deployment Guide

> Production deployment and safety guidelines.

## Quick Start

```bash
# 1. Apply migrations
DATABASE_URL="your-prod-url" bun db:migrate

# 2. Build
bun run build

# 3. Start
bun start
```

---

## Environment Variables

### Required

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Discord OAuth
DISCORD_CLIENT_ID="your_client_id"
DISCORD_CLIENT_SECRET="your_client_secret"
DISCORD_GUILD_ID="your_server_id"

# Authentication
BETTER_AUTH_SECRET="your_random_secret"  # openssl rand -base64 32
BETTER_AUTH_URL="https://your-domain.com"
NEXT_PUBLIC_BETTER_AUTH_URL="https://your-domain.com"
```

### Optional

```bash
# Performance
NODE_ENV="production"
```

---

## Database Safety

> [!CAUTION]
> **Critical: Never run these commands in production**
> 
> ```bash
> # DANGEROUS - Will try to drop bot tables!
> bun drizzle-kit push
> drizzle-kit push
> 
> # DANGEROUS - Will generate migrations to drop bot tables!
> bun drizzle-kit generate
> drizzle-kit generate
> ```

### Safe Commands

```bash
# Apply migrations (SAFE - only runs pre-written SQL)
bun db:migrate

# Start the application (SAFE)
bun start
```

### Why This Is Safe

1. **`tablesFilter: ['auth_*']`** - Drizzle config only manages auth tables
2. **Manual migrations** - Pre-written SQL, no auto-generation
3. **Schema in one file** - Bot tables defined but not managed by Drizzle

---

## First Deployment

### 1. Backup Database

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### 2. Run Migrations

```bash
# Auth tables
DATABASE_URL="your-prod-url" bun db:migrate

# Performance indexes
psql $DATABASE_URL -f migrations/001_add_search_indexes.sql
```

### 3. Verify Tables

```bash
psql $DATABASE_URL -c "\dt auth_*"
```

Expected output:
```
 Schema |       Name        | Type  | Owner 
--------+-------------------+-------+-------
 public | auth_account      | table | ...
 public | auth_session      | table | ...
 public | auth_user         | table | ...
 public | auth_verification | table | ...
```

### 4. Update Discord OAuth

Add production redirect URL in Discord Developer Portal:
```
https://your-domain.com/api/auth/callback/discord
```

### 5. Build and Start

```bash
bun run build
bun start
```

---

## Subsequent Deployments

```bash
# Pull latest code
git pull

# Install dependencies
bun install

# Run any new migrations
bun db:migrate

# Build
bun run build

# Restart application
# (depends on your hosting - PM2, systemd, Docker, etc.)
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

# Run
EXPOSE 3000
CMD ["bun", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  dashboard:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
      - DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}
      - DISCORD_GUILD_ID=${DISCORD_GUILD_ID}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BETTER_AUTH_URL=${BETTER_AUTH_URL}
      - NEXT_PUBLIC_BETTER_AUTH_URL=${NEXT_PUBLIC_BETTER_AUTH_URL}
    restart: unless-stopped
```

---

## Hosting Options

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

> [!NOTE]
> Vercel requires `bun` to be configured in project settings.

### Railway / Render / Fly.io

Most PaaS providers auto-detect Next.js projects. Just:
1. Connect your repository
2. Set environment variables
3. Deploy

### Self-Hosted (VPS)

Using PM2:

```bash
# Install PM2
npm i -g pm2

# Start
pm2 start bun --name "reverts-dashboard" -- start

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## Troubleshooting

### Auth tables fail to create

1. Check database permissions
2. Check `DATABASE_URL` is correct
3. Run migration SQL directly:
   ```bash
   psql $DATABASE_URL < drizzle/0000_initial_auth_tables.sql
   ```

### "Table already exists" error

This is **safe** - tables are already created. Mark as applied:

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) 
VALUES ('0000_initial_auth_tables', EXTRACT(EPOCH FROM NOW())::bigint * 1000);
```

### Connection refused

1. Check database is running
2. Check network/firewall allows connection
3. Verify connection string format:
   ```
   postgresql://user:password@host:5432/database
   ```

### 502 Bad Gateway

1. Check application is running: `pm2 status` or `docker ps`
2. Check logs: `pm2 logs` or `docker logs`
3. Verify port 3000 is exposed

---

## Health Checks

### API Health

```bash
curl -I https://your-domain.com/api/messages
# Should return 401 (requires auth) or 200
```

### Database Health

```sql
SELECT 1;
-- Should return quickly
```

### Index Health

```sql
SELECT 
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'Message';
```

---

## Monitoring

### Application Logs

```bash
# PM2
pm2 logs reverts-dashboard

# Docker
docker logs -f container_name

# Vercel
vercel logs
```

### Database Metrics

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT query, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

---

## Rollback

### Code Rollback

```bash
git revert HEAD
bun run build
# Restart application
```

### Database Rollback

If auth tables need removal:

```sql
DROP TABLE IF EXISTS auth_verification;
DROP TABLE IF EXISTS auth_session;
DROP TABLE IF EXISTS auth_account;
DROP TABLE IF EXISTS auth_user;
```

> [!WARNING]
> This will log out all users and delete auth data.

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Authentication](./AUTHENTICATION.md)
- [Performance](./PERFORMANCE.md)
