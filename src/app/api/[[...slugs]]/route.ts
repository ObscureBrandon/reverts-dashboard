import { auth } from '@/lib/auth'
import { authMacro } from '@/lib/elysia/auth'
import { messagesRoutes } from '@/lib/elysia/routes/messages'
import { panelsRoutes } from '@/lib/elysia/routes/panels'
import { relationsRoutes } from '@/lib/elysia/routes/relations'
import { rolesRoutes } from '@/lib/elysia/routes/roles'
import { ticketsRoutes } from '@/lib/elysia/routes/tickets'
import { usersRoutes } from '@/lib/elysia/routes/users'
import { Elysia } from 'elysia'

// Main API routes with /api prefix
const apiRoutes = new Elysia({ prefix: '/api' })
  .use(authMacro)
  .use(rolesRoutes)
  .use(panelsRoutes)
  .use(relationsRoutes)
  .use(usersRoutes)
  .use(ticketsRoutes)
  .use(messagesRoutes)

// Root app - mounts better-auth at root (it handles /api/auth internally)
// and the API routes separately
const app = new Elysia()
  .mount(auth.handler)
  .use(apiRoutes)

// Export type for Eden client
export type App = typeof app

// Export handlers for all HTTP methods
export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const DELETE = app.fetch
export const PATCH = app.fetch

