/**
 * findAnchor — runtime anchor resolution for structural directives.
 *
 * Replaces compile-time `childNodes[N]` hardcoded paths by searching the
 * live DOM at runtime using TreeWalker (standard browser API, zero deps).
 *
 * Structural directives (`if`, `each`, `dynamic`) leave comment markers
 * in the HTML template: `<!-- if -->`, `<!-- each -->`, `<!-- dynamic -->`.
 * This function finds the n-th marker of a given type within a root subtree.
 *
 * @param {Node} root - Root element or fragment to search within
 * @param {'each'|'if'|'dynamic'} type - Marker type to find
 * @param {number} index - Zero-based index among markers of the same type
 * @returns {Node|null} The matching comment node, or null if not found
 */
export function findAnchor(root, type, index) {
  const needle = ' ' + type + ' ';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let count = 0;
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent === needle) {
      if (count === index) return node;
      count++;
    }
  }
  return null;
}
