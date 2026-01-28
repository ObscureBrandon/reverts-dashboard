import { getAllRoles } from '@/lib/db/queries'
import { Elysia } from 'elysia'

export const rolesRoutes = new Elysia({ prefix: '/roles' })
  .get('/', async () => {
    try {
      const roles = await getAllRoles()

      return {
        roles: roles.map(role => ({
          id: role.id.toString(),
          name: role.name,
          color: role.color,
          position: role.position,
        })),
      }
    } catch (err) {
      console.error('Error fetching roles:', err)
      throw new Error('Failed to fetch roles')
    }
  })
