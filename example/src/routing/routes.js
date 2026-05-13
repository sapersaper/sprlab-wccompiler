/**
 * Route configuration for the WCC Router.
 * Each route maps a hash path to a registered custom element tag name.
 */
export default [
  { path: '/', tag: 'wcc-page-home', label: 'Home' },
  { path: '/about', tag: 'wcc-page-about', label: 'About' },
  { path: '/contact', tag: 'wcc-page-contact', label: 'Contact' },
]
