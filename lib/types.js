// v2/lib/types.js — JSDoc type definitions for wcCompiler v2

/**
 * @typedef {Object} ReactiveVar
 * @property {string} name — Signal variable name (e.g., 'count')
 * @property {string} value — Initial value expression (e.g., '0', '[1, 2, 3]')
 */

/**
 * @typedef {Object} ComputedDef
 * @property {string} name — Computed variable name (e.g., 'doubled')
 * @property {string} body — Computed expression body (e.g., 'count() * 2')
 */

/**
 * @typedef {Object} EffectDef
 * @property {string} body — Effect function body
 */

/**
 * @typedef {Object} ConstantVar
 * @property {string} name — Constant variable name (e.g., 'TAX_RATE')
 * @property {string} value — Value expression (e.g., '0.21', "'hello'")
 */

/**
 * @typedef {Object} LifecycleHook
 * @property {string} body — The callback body (JavaScript code)
 * @property {boolean} async — Whether the callback is async
 */

/**
 * @typedef {Object} WatcherDef
 * @property {string} target — Signal/prop/computed name to watch (e.g., 'count')
 * @property {string} newParam — Parameter name for new value (e.g., 'newVal')
 * @property {string} oldParam — Parameter name for old value (e.g., 'oldVal')
 * @property {string} body — Callback body
 */

/**
 * @typedef {Object} MethodDef
 * @property {string} name — Function name (e.g., 'increment')
 * @property {string} params — Parameter list (e.g., '', 'a, b')
 * @property {string} body — Function body
 */

/**
 * @typedef {Object} PropDef
 * @property {string} name — camelCase prop name (e.g., 'itemCount')
 * @property {string} default — Default value as source string (e.g., '0', "'Click'", 'undefined')
 * @property {string} attrName — kebab-case attribute name (e.g., 'item-count')
 */

/**
 * @typedef {Object} Binding
 * @property {string} varName — Internal name (e.g., '__b0')
 * @property {string} name — Variable name from {{name}}
 * @property {'signal'|'computed'|'method'|'prop'} type — Binding source type
 * @property {string[]} path — DOM path from root (e.g., ['childNodes[0]', 'childNodes[1]'])
 */

/**
 * @typedef {Object} EventBinding
 * @property {string} varName — Internal name (e.g., '__e0')
 * @property {string} event — Event name (e.g., 'click')
 * @property {string} handler — Handler function name (e.g., 'increment')
 * @property {string[]} path — DOM path from root
 */

/**
 * @typedef {Object} ParseResult
 * @property {string} tagName — Custom element tag (e.g., 'wcc-counter')
 * @property {string} className — PascalCase class name (e.g., 'WccCounter')
 * @property {string} template — Raw HTML template content
 * @property {string} style — Raw CSS content (empty string if none)
 * @property {ReactiveVar[]} signals — signal() declarations
 * @property {ComputedDef[]} computeds — computed() declarations
 * @property {EffectDef[]} effects — effect() declarations
 * @property {ConstantVar[]} constantVars — Plain const declarations (non-reactive)
 * @property {WatcherDef[]} watchers — watch() declarations
 * @property {MethodDef[]} methods — function declarations
 * @property {PropDef[]} propDefs — Prop definitions with names and defaults
 * @property {string|null} propsObjectName — Variable name from `const X = defineProps(...)`
 * @property {string[]} emits — Event names declared in defineEmits (empty array if no defineEmits)
 * @property {string|null} emitsObjectName — Variable name from `const X = defineEmits(...)`
 * @property {Binding[]} bindings — (populated by tree-walker)
 * @property {EventBinding[]} events — (populated by tree-walker)
 * @property {string|null} processedTemplate — (populated by tree-walker)
 * @property {IfBlock[]} ifBlocks — Conditional blocks (empty array if none)
 * @property {ShowBinding[]} showBindings — Show bindings (empty array if none)
 * @property {ForBlock[]} forBlocks — For blocks (empty array if none)
 * @property {LifecycleHook[]} onMountHooks — Mount lifecycle hooks (empty array if none)
 * @property {LifecycleHook[]} onDestroyHooks — Destroy lifecycle hooks (empty array if none)
 * @property {ModelBinding[]} modelBindings — Model bindings (empty array if none)
 * @property {AttrBinding[]} attrBindings — Attribute bindings (empty array if none)
 * @property {SlotBinding[]} slots — Slot bindings (empty array if no slots)
 * @property {RefDeclaration[]} refs — templateRef declarations from script (empty array if none)
 * @property {RefBinding[]} refBindings — ref attribute bindings from template (empty array if none)
 * @property {ChildComponentBinding[]} childComponents — Child component bindings (empty array if none)
 * @property {ChildComponentImport[]} childImports — Resolved child component imports (empty array if none)
 */

/**
 * @typedef {Object} ShowBinding
 * @property {string} varName
 * @property {string} expression
 * @property {string[]} path
 */

/**
 * @typedef {Object} AttrBinding
 * @property {string} varName
 * @property {string} attr
 * @property {string} expression
 * @property {'attr'|'class'|'style'|'bool'} kind
 * @property {string[]} path
 */

/**
 * @typedef {Object} IfBranch
 * @property {'if'|'else-if'|'else'} type — Branch type
 * @property {string|null} expression — JS expression (null for else)
 * @property {string} templateHtml — Processed HTML (directive attr removed)
 * @property {Binding[]} bindings — Text interpolation bindings
 * @property {EventBinding[]} events — @event bindings
 * @property {ShowBinding[]} showBindings — show bindings
 * @property {AttrBinding[]} attrBindings — :attr / bind bindings
 * @property {ModelBinding[]} modelBindings — model bindings
 * @property {SlotBinding[]} slots — slot bindings
 */

/**
 * @typedef {Object} IfBlock
 * @property {string} varName — Unique name: '__if0', '__if1', ...
 * @property {string[]} anchorPath — DOM path to comment anchor from __root
 * @property {IfBranch[]} branches — Array of branches in chain order
 */

/**
 * @typedef {Object} ForBlock
 * @property {string} varName — Unique name: '__for0', '__for1', ...
 * @property {string} itemVar — Iteration variable name (e.g., 'item')
 * @property {string|null} indexVar — Index variable name or null
 * @property {string} source — Source expression (e.g., 'items', '5')
 * @property {string|null} keyExpr — :key expression or null
 * @property {string} templateHtml — Processed item HTML (each/:key attrs removed)
 * @property {string[]} anchorPath — DOM path to comment anchor from __root
 * @property {Binding[]} bindings — Text interpolation bindings within item
 * @property {EventBinding[]} events — @event bindings within item
 * @property {ShowBinding[]} showBindings — show bindings within item
 * @property {AttrBinding[]} attrBindings — :attr bindings within item
 * @property {ModelBinding[]} modelBindings — model bindings within item
 * @property {SlotBinding[]} slots — slot bindings within item
 */

/**
 * @typedef {Object} ModelBinding
 * @property {string} varName      — Internal name: '__model0', '__model1', ...
 * @property {string} signal       — Signal name referenced by model (e.g., 'name', 'count')
 * @property {string} prop         — DOM property to bind: 'value' or 'checked'
 * @property {string} event        — Event to listen for: 'input' or 'change'
 * @property {boolean} coerce      — true if value requires Number() coercion (input type="number")
 * @property {string|null} radioValue — Value attribute for radio inputs, null for others
 * @property {string[]} path       — DOM path from root to the element
 */

/**
 * @typedef {Object} RefDeclaration
 * @property {string} varName  — Variable name from script (e.g., 'canvas')
 * @property {string} refName  — Ref name from templateRef argument (e.g., 'canvas')
 */

/**
 * @typedef {Object} RefBinding
 * @property {string} refName  — Ref name from ref attribute (e.g., 'canvas')
 * @property {string[]} path   — DOM path from root to the element (e.g., ['childNodes[0]'])
 */

/**
 * @typedef {Object} SlotProp
 * @property {string} prop    — Prop name (attribute name without ':'), e.g. 'item'
 * @property {string} source  — Source expression (attribute value), e.g. 'currentItem'
 */

/**
 * @typedef {Object} SlotBinding
 * @property {string} varName        — Internal name (e.g., '__s0')
 * @property {string} name           — Slot name (empty string for default slot)
 * @property {string[]} path         — DOM path from root to the replacement span
 * @property {string} defaultContent — Fallback content from original <slot> element
 * @property {SlotProp[]} slotProps  — Array of :prop="expr" bindings on the slot
 */

/**
 * @typedef {Object} ChildPropBinding
 * @property {string} attr   — Attribute name on the child element (e.g., 'label')
 * @property {string} expr   — Expression from {{expr}} (e.g., 'role')
 * @property {string} type   — Binding source type: 'signal' | 'computed' | 'prop' | 'constant' | 'method'
 */

/**
 * @typedef {Object} ChildComponentBinding
 * @property {string} tag          — Child component tag name (e.g., 'wcc-badge')
 * @property {string} varName      — Internal ref name (e.g., '__child0')
 * @property {string[]} path       — DOM path from __root
 * @property {ChildPropBinding[]} propBindings — Reactive attribute bindings
 */

/**
 * @typedef {Object} ChildComponentImport
 * @property {string} tag          — Child component tag name
 * @property {string} importPath   — Relative import path (e.g., './wcc-badge.js')
 */

/**
 * Set of HTML attributes that use property assignment instead of setAttribute.
 * @type {Set<string>}
 */
export const BOOLEAN_ATTRIBUTES = new Set([
  'disabled', 'checked', 'hidden', 'readonly', 'required',
  'selected', 'multiple', 'autofocus', 'autoplay', 'controls',
  'loop', 'muted', 'open', 'novalidate'
]);

export {}
