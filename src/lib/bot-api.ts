import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './bot-api.d'

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    request.headers.set('Authorization', `Bearer ${process.env.BOT_API_SECRET!}`)
    return request
  },
}

const botApiClient = createClient<paths>({
  baseUrl: process.env.BOT_API_URL!,
})

botApiClient.use(authMiddleware)

export { botApiClient }
