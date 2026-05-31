export { walkTree, walkBranch, recomputeAnchorPath, isChainPredecessor } from './walker/tree-walker.js';
export { processIfChains, buildIfBlock } from './walker/if-processor.js';
export { processForBlocks, parseEachExpression } from './walker/each-processor.js';
export { processDynamicComponents, detectRefs } from './walker/dynamic-processor.js';
