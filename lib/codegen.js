export { generateComponent } from './codegen/index.js';
export { transformExpr, transformMethodBody, pathExpr, wrapTernaryExpr } from './transform/expr-transformer.js';
export { transformForExpr, isStaticForBinding, isStaticForExpr } from './transform/for-transformer.js';
export { extractDeps, refsComputedOrMethod, extractComputedDeps, topologicalSortComputeds, buildDepGraph } from './transform/dep-graph.js';
