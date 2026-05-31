/**
 * Shared utility functions used across multiple modules.
 */

/**
 * Convert a camelCase identifier to kebab-case for HTML attribute names.
 * e.g. 'itemCount' → 'item-count', 'label' → 'label'
 *
 * @param {string} name
 * @returns {string}
 */
export function camelToKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
