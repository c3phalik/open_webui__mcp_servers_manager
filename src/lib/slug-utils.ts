/**
 * Utility functions for creating URL-safe slugs from server names
 */

/**
 * Convert a server name to a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces and underscores with hyphens
 * - Removes special characters except hyphens and alphanumeric
 * - Removes consecutive hyphens
 * - Trims leading/trailing hyphens
 */
export function createUrlSlug(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'unnamed'
  }

  return name
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Fallback for empty results
    || 'unnamed'
}

/**
 * Generate a short UUID (first 8 characters)
 */
export function generateShortUuid(): string {
  return crypto.randomUUID().substring(0, 8)
}

/**
 * Generate a unique ID by combining a URL-safe slug with a short UUID
 * Format: "slug-shortUuid"
 */
export function generateUniqueId(name: string, uuid?: string): string {
  const slug = createUrlSlug(name)
  const shortUuid = uuid ? uuid.substring(0, 8) : generateShortUuid()
  
  return `${slug}-${shortUuid}`
}

/**
 * Parse a unique ID to extract the slug and UUID parts
 * Returns null if the format is invalid
 */
export function parseUniqueId(uniqueId: string): { slug: string; uuid: string } | null {
  if (!uniqueId || typeof uniqueId !== 'string') {
    return null
  }

  // Find the last hyphen to split slug from UUID
  const lastHyphenIndex = uniqueId.lastIndexOf('-')
  
  if (lastHyphenIndex === -1 || lastHyphenIndex === uniqueId.length - 1) {
    return null
  }

  const slug = uniqueId.substring(0, lastHyphenIndex)
  const uuid = uniqueId.substring(lastHyphenIndex + 1)

  // Basic validation
  if (!slug || !uuid || uuid.length !== 8) {
    return null
  }

  return { slug, uuid }
}

/**
 * Validate that a string is a valid unique ID format
 */
export function isValidUniqueId(uniqueId: string): boolean {
  return parseUniqueId(uniqueId) !== null
}