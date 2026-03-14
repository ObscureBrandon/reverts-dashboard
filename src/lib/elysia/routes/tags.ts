import { archiveRevertTag, createRevertTag, getAllRevertTags, getRevertTags, updateRevertTag } from '@/lib/db/queries'
import { authMacro } from '@/lib/elysia/auth'
import { Elysia } from 'elysia'

export const tagsRoutes = new Elysia({ prefix: '/tags' })
  .use(authMacro)

  // GET /tags - List all non-archived tags
  .get('/', async () => {
    try {
      const tags = await getRevertTags()
      return { tags: tags.map(t => ({ ...t, createdById: t.createdById.toString() })) }
    } catch (error) {
      console.error('Error fetching tags:', error)
      throw new Error('Failed to fetch tags')
    }
  }, { modAuth: true })

  // GET /tags/all - List all tags including archived (for management page)
  .get('/all', async () => {
    try {
      const tags = await getAllRevertTags()
      return {
        tags: tags.map(t => ({
          ...t.tag,
          id: t.tag.id,
          createdById: t.tag.createdById.toString(),
          activeCount: t.activeCount,
        }))
      }
    } catch (error) {
      console.error('Error fetching all tags:', error)
      throw new Error('Failed to fetch tags')
    }
  }, { modAuth: true })

  // POST /tags - Create a new tag
  .post('/', async ({ body, discordId, set }) => {
    try {
      const { name, description, color, emoji, category } = body as {
        name: string
        description?: string
        color: string
        emoji?: string
        category?: string
      }

      if (!name || !color) {
        set.status = 400
        return { error: 'Name and color are required' }
      }

      const tag = await createRevertTag({
        name,
        description,
        color,
        emoji,
        category,
        createdById: BigInt(discordId),
      })

      return { tag: { ...tag, createdById: tag.createdById.toString() } }
    } catch (error) {
      console.error('Error creating tag:', error)
      throw new Error('Failed to create tag')
    }
  }, { modAuth: true })

  // PATCH /tags/:id - Update a tag
  .patch('/:id', async ({ params, body, set }) => {
    try {
      const tagId = parseInt(params.id)
      if (isNaN(tagId)) {
        set.status = 400
        return { error: 'Invalid tag ID' }
      }

      const { name, description, color, emoji, category } = body as {
        name?: string
        description?: string
        color?: string
        emoji?: string
        category?: string
      }

      const tag = await updateRevertTag(tagId, { name, description, color, emoji, category })

      if (!tag) {
        set.status = 404
        return { error: 'Tag not found' }
      }

      return { tag: { ...tag, createdById: tag.createdById.toString() } }
    } catch (error) {
      console.error('Error updating tag:', error)
      throw new Error('Failed to update tag')
    }
  }, { modAuth: true })

  // PATCH /tags/:id/archive - Archive a tag
  .patch('/:id/archive', async ({ params, set }) => {
    try {
      const tagId = parseInt(params.id)
      if (isNaN(tagId)) {
        set.status = 400
        return { error: 'Invalid tag ID' }
      }

      const tag = await archiveRevertTag(tagId)

      if (!tag) {
        set.status = 404
        return { error: 'Tag not found' }
      }

      return { success: true }
    } catch (error) {
      console.error('Error archiving tag:', error)
      throw new Error('Failed to archive tag')
    }
  }, { modAuth: true })
