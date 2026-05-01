import { archiveRevertTag, createRevertTag, getAllRevertTags, getRevertTags, updateRevertTag } from '@/lib/db/queries'
import { authMacro } from '@/lib/elysia/auth'
import { REVERT_TAG_CATEGORY_VALUES } from '@/lib/revert-support'
import { Elysia } from 'elysia'

const MAX_TAG_NAME_LENGTH = 64
const MAX_TAG_CATEGORY_LENGTH = 64

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isValidTagCategory(category: string) {
  return REVERT_TAG_CATEGORY_VALUES.includes(category as (typeof REVERT_TAG_CATEGORY_VALUES)[number])
}

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

      const normalizedName = name?.trim()
      const normalizedDescription = normalizeOptionalText(description)
      const normalizedEmoji = normalizeOptionalText(emoji)
      const normalizedCategory = normalizeOptionalText(category)

      if (!normalizedName || !color) {
        set.status = 400
        return { error: 'Name and color are required' }
      }

      if (normalizedName.length > MAX_TAG_NAME_LENGTH) {
        set.status = 400
        return { error: `Name must be ${MAX_TAG_NAME_LENGTH} characters or fewer` }
      }

      if (normalizedCategory && normalizedCategory.length > MAX_TAG_CATEGORY_LENGTH) {
        set.status = 400
        return { error: `Category must be ${MAX_TAG_CATEGORY_LENGTH} characters or fewer` }
      }

      if (normalizedCategory && !isValidTagCategory(normalizedCategory)) {
        set.status = 400
        return { error: `Category must be one of: ${REVERT_TAG_CATEGORY_VALUES.join(', ')}` }
      }

      const tag = await createRevertTag({
        name: normalizedName,
        description: normalizedDescription,
        color,
        emoji: normalizedEmoji,
        category: normalizedCategory,
        createdById: BigInt(discordId),
      })

      return { tag: { ...tag, createdById: tag.createdById.toString() } }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('duplicate key') || error.message.includes('already exists'))) {
        set.status = 409
        return { error: 'A tag with that name already exists' }
      }

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

      const normalizedName = normalizeOptionalText(name)
      const normalizedDescription = normalizeOptionalText(description)
      const normalizedEmoji = normalizeOptionalText(emoji)
      const normalizedCategory = normalizeOptionalText(category)

      if (normalizedName && normalizedName.length > MAX_TAG_NAME_LENGTH) {
        set.status = 400
        return { error: `Name must be ${MAX_TAG_NAME_LENGTH} characters or fewer` }
      }

      if (normalizedCategory && normalizedCategory.length > MAX_TAG_CATEGORY_LENGTH) {
        set.status = 400
        return { error: `Category must be ${MAX_TAG_CATEGORY_LENGTH} characters or fewer` }
      }

      if (normalizedCategory && !isValidTagCategory(normalizedCategory)) {
        set.status = 400
        return { error: `Category must be one of: ${REVERT_TAG_CATEGORY_VALUES.join(', ')}` }
      }

      const tag = await updateRevertTag(tagId, {
        name: normalizedName,
        description: normalizedDescription,
        color,
        emoji: normalizedEmoji,
        category: normalizedCategory,
      })

      if (!tag) {
        set.status = 404
        return { error: 'Tag not found' }
      }

      return { tag: { ...tag, createdById: tag.createdById.toString() } }
    } catch (error) {
      if (error instanceof Error && error.message.includes('System tag')) {
        set.status = 409
        return { error: error.message }
      }

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
      if (error instanceof Error && error.message.includes('System tag')) {
        set.status = 409
        return { error: error.message }
      }

      console.error('Error archiving tag:', error)
      throw new Error('Failed to archive tag')
    }
  }, { modAuth: true })
