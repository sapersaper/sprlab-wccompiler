# BUG-0002: batch Function Not Imported from Runtime

## Metadata
- **Status**: ✅ resolved
- **Priority**: ↕️ `medium`
- **Reported by**: Dev Team / Lingma AI Testing
- **Date reported**: 2026-05-13
- **Date moved to testing**: 2026-05-14
- **Date resolved**: 2026-05-14
- **Severity**: Medium (Critical in v0.16.0, fixed in v0.16.1)
- **Component**: compiler.js (missing batch detection)
- **Related files**: 
  - `lib/parser-extractors.js` (detectBatchUsage function)
  - `lib/compiler.js` (added batch detection - FIX LOCATION)
  - `lib/codegen.js` (batch transformation)
  - `lib/parser-extractors.batch-detection.test.js` (10 tests)
  - `example/src/bug-0002-batch-test.wcc` (QA test component)

## Description
The WCC compiler does not automatically import the `__batch` function from the runtime when the `batch()` API is used in component scripts. This causes runtime errors unless the import is manually added.

## Steps to Reproduce
1. Create a component using batch:
   ```html
   <script>
   const count = signal(0)
   const name = signal('test')
   
   function updateBoth() {
     batch(() => {
       count.set(count() + 1)
       name.set('updated')
     })
   }
   </script>
   
   <template>
     <button @click="updateBoth">Update</button>
     <div>{{ count() }} - {{ name() }}</div>
   </template>
   ```

2. Compile the component
3. Run in browser
4. Observe: `ReferenceError: __batch is not defined`

## Expected Behavior
Compiler should automatically add `__batch` to the runtime imports:
```javascript
import { signal, computed, effect, batch as __batch } from '@sprlab/wccompiler/runtime'
```

## Actual Behavior
The generated import statement is missing `__batch`:
```javascript
import { signal, computed, effect } from '@sprlab/wccompiler/runtime'
// __batch is missing!
```

## Environment
- **wcCompiler version**: v0.13.0
- **Node version**: v18.x.x
- **Browser**: Chrome/Firefox (any modern browser)
- **OS**: Windows 11

## Root Cause Analysis
*(To be filled during investigation)*

The import extraction logic in `lib/codegen.js` doesn't detect usage of the `batch()` function and therefore doesn't add it to the runtime imports list.

## Proposed Solution
Add detection for `batch()` usage in the script parsing phase and automatically include it in the runtime imports alongside other reactive primitives.

## Workaround
Manually patch the compiled output to add `__batch` to the import statement:
```javascript
// Add this to the import line:
import { ..., batch as __batch } from '@sprlab/wccompiler/runtime'
```

## Impact Assessment
- **User Impact**: Medium - batch() is an optimization feature
- **Frequency**: Every time batch() is used
- **Workaround**: Available (manual import patch)
- **Performance Impact**: Without batch, multiple signal updates trigger multiple re-renders instead of one (66% more executions observed in testing)

## Performance Impact Example
In testing, updating 3 signals without batch triggered 3 effect executions. With batch properly working, it reduces to 1 execution (66% improvement).

## Additional Context
Discovered during Phase 2 testing (Reactivity). While not critical for functionality, this bug prevents users from benefiting from performance optimizations that batch provides.

## Resolution
**Root Cause**: The `compiler.js` file was missing the call to `detectBatchUsage()` function. While `parser.js` had the detection logic, `compiler.js` (which is used by the CLI and build tools) duplicated the extraction logic but did not include batch detection.

**Fix Applied**:
1. Added `detectBatchUsage` import in `lib/compiler.js`
2. Called `detectBatchUsage(sourceForExtraction)` after extracting other reactive declarations
3. Added `usesBatch` field to the `parseResult` object

**Files Modified**:
- `lib/compiler.js` (lines 36, 167, 298)

**Testing**:
- All 992 unit tests passing
- QA verification: batch() now correctly imports __batch in generated code
- Performance improvement confirmed: 66% reduction in effect executions when batching multiple signals

**Release**: v0.16.1 (patch release - critical fix for v0.16.0 regression)

---

*Created from testing report dated 2026-05-13*
*Resolved and released in v0.16.1 on 2026-05-14*
