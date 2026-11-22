/**
 * Pure TypeScript evaluator for a LightGBM model saved with `booster.dump_model()` (JSON).
 * No native runtime (no Python, no ONNX binaries) is needed in production: the trained trees are
 * just data, and walking them is a few lines. Supports numerical splits, binary sigmoid objective,
 * LightGBM's missing-value rules, and random-forest mode (`average_output`: trees are averaged, not summed).
 */

interface SplitNode {
  split_feature: number;
  threshold: number;
  decision_type: string;
  default_left: boolean;
  missing_type: "None" | "Zero" | "NaN";
  left_child: TreeNode;
  right_child: TreeNode;
}
interface LeafNode {
  leaf_value: number;
}
type TreeNode = SplitNode | LeafNode;

export interface LightGbmDump {
  objective?: string;
  /** True for boosting_type="rf": the raw score is the mean of the trees. */
  average_output?: boolean;
  feature_names: string[];
  tree_info: { tree_structure: TreeNode }[];
}

const ZERO = 1e-35; // LightGBM's kZeroThreshold

function isLeaf(n: TreeNode): n is LeafNode {
  return (n as LeafNode).leaf_value !== undefined;
}

function goLeft(node: SplitNode, raw: number): boolean {
  if (node.decision_type !== "<=") throw new Error(`Unsupported split type ${node.decision_type}`);
  let v = raw;
  const missingNaN = Number.isNaN(v);
  if (node.missing_type === "NaN" && missingNaN) return node.default_left;
  if (missingNaN) v = 0; // missing_type None or Zero: NaN is treated as zero
  if (node.missing_type === "Zero" && Math.abs(v) <= ZERO) return node.default_left;
  return v <= node.threshold;
}

export function rawScore(model: LightGbmDump, x: number[]): number {
  let sum = 0;
  for (const t of model.tree_info) {
    let n = t.tree_structure;
    while (!isLeaf(n)) n = goLeft(n, x[n.split_feature] ?? Number.NaN) ? n.left_child : n.right_child;
    sum += n.leaf_value;
  }
  return model.average_output && model.tree_info.length ? sum / model.tree_info.length : sum;
}

/** Probability of the positive class for a binary model. */
export function predictProba(model: LightGbmDump, x: number[]): number {
  const m = /sigmoid:([\d.]+)/.exec(model.objective ?? "");
  const sigmoid = m ? Number(m[1]) : 1;
  return 1 / (1 + Math.exp(-sigmoid * rawScore(model, x)));
}
