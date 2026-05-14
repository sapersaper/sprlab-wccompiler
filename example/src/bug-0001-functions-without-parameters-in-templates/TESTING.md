# Bug #1 Testing Instructions

## Quick Start

### Step 1: Stop any running dev servers
If you have other dev servers running on port 4200, stop them first.

### Step 2: Start the dev server
```bash
cd example
yarn dev
```

The server will compile all `.wcc` files in `src/` and serve them at http://localhost:4200

### Step 3: Open the test page
Open your browser and navigate to:
```
http://localhost:4200/src/bug-0001-functions-without-parameters-in-templates/index.html
```

## What You Should See

### Test Case 1 (No Collision) - Should Work ✅
- Status badge changes from "PENDING" (yellow) to "PASS" (green)
- Live demo section shows the component
- Component displays:
  - "Hello World" from `getGreeting()`
  - "Hello World" from `getFullName()`
  - Counter with increment button
- Clicking the button increments the counter

### Test Case 2 (With Collision) - Expected to Fail ❌
- This component should NOT appear
- The compiler should reject it during build
- Check the terminal for compilation errors

## Troubleshooting

### If you see "EADDRINUSE" error:
Another process is using port 4200. Either:
1. Stop the other process, or
2. Change the port in the dev server configuration

### If components don't render:
1. Check the browser console for errors
2. Verify the compiled files exist in `example/dist/`
3. Make sure the dev server compiled without errors

### To test compilation error manually:
```bash
cd example
node ../bin/wcc.js build --input src/bug-0001-functions-without-parameters-in-templates/wcc-test-with-collision.wcc
```

This should fail with an error about duplicate identifiers.
