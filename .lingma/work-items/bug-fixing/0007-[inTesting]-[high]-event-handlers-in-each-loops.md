# BUG-0007: Event Handlers in each Loops Don't Resolve Method References

## Metadata
- **Status**: 🧪 inTesting
- **Priority**: 🔴 `high`
- **Reported by**: QA Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to research**: 2026-05-15
- **Date moved to inProgress**: 2026-05-15
- **Date moved to inTesting**: 2026-05-15
- **Date resolved**: (pending)
- **Severity**: High - Event handlers inside loops cause ReferenceError at runtime
- **Component**: codegen.js (each loop event handler compilation)
- **Related files**: 
  - `lib/codegen.js` (event handler generation in each loops)
  - `example/src/04-directives/test-list-rendering.wcc`
  - `dist/04-directives/test-list-rendering.js` (line 187)

## Description
Event handlers inside `each` loops fail to resolve method references correctly. When using arrow functions or method calls with parameters inside loops, the generated code doesn't properly prefix methods with `this._`, causing runtime errors.

## Steps to Reproduce
1. Create a component with an `each` loop and event handlers:
   ```html
   <script>
   const items = signal([
     { id: 1, name: 'Item 1', active: false },
     { id: 2, name: 'Item 2', active: true }
   ])
   
   function toggleActive(id) {
     const list = items()
     const item = list.find(i => i.id === id)
     if (item) {
       item.active = !item.active
       items.set([...list])
     }
   }
   </script>
   
   <template>
     <div each="item in items()">
       <button @click="() => toggleActive(item.id)">
         Toggle
       </button>
       <span>{{ item.name }}</span>
     </div>
   </template>
   ```

2. Compile the component
3. Click on any button
4. Observe: `ReferenceError: toggleActive is not defined`

## Expected Behavior
Generated code should properly reference methods with `this._` prefix:
```javascript
// Inside the each loop rendering:
onclick={() => this._toggleActive(item.id)}
```

## Actual Behavior
Compiler generates code without the proper `this._` prefix:
```javascript
// Generated (incorrect):
onclick={() => toggleActive(item.id)}
// toggleActive is not in scope!
```

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
*(To be filled during investigation)*

The template compiler's handling of event handlers within `each` loops doesn't apply the same method resolution logic used elsewhere. It fails to recognize that `toggleActive` should be `this._toggleActive`.

## Proposed Solution
Fix the event handler compilation within `each` loops to:
1. Detect method references in event handlers
2. Apply the `this._` prefix consistently
3. Handle both direct method calls and arrow function wrappers
4. Preserve access to loop variables (item, index, etc.)

## Test Cases to Cover
```javascript
// Direct method call
@click="toggleActive(item.id)"

// Arrow function wrapper
@click="() => toggleActive(item.id)"

// With index
@click="() => removeItem(index)"

// Multiple parameters
@click="() => updateItem(item.id, item.name)"
```

## Impact Assessment
- **User Impact**: High - Breaks interactive lists completely
- **Frequency**: Every time event handlers are used in each loops with parameters
- **Workaround**: Avoid passing parameters to handlers in loops, or manually patch compiled output
- **Affected Components**: All list components with interactive elements

## Workaround
Use inline state manipulation instead of calling methods:
```html
<!-- Instead of: -->
<button @click="() => toggleActive(item.id)">Toggle</button>

<!-- Use computed properties or restructure logic -->
```

## Additional Context
Discovered during Phase 4 testing (Directives). This is a critical bug for any list-based UI with interactive elements like todo lists, data tables, or product catalogs.

---

*Created from testing report dated 2026-05-13*
