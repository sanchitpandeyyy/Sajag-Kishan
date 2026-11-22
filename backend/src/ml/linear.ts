/**
 * Logistic regression evaluator for a model exported by ml/train_landuse.py: missing values are
 * replaced with the training median, then standardised, then a weighted sum and a sigmoid.
 * Same maths as scikit-learn's SimpleImputer(median) -> StandardScaler -> LogisticRegression.
 */

export interface LogisticModel {
  /** Training median per feature, used for missing values. */
  impute: number[];
  mean: number[];
  scale: number[];
  coef: number[];
  intercept: number;
}

export function logisticProba(m: LogisticModel, x: number[]): number {
  let z = m.intercept;
  for (let i = 0; i < m.coef.length; i++) {
    const raw = x[i];
    const v = raw == null || Number.isNaN(raw) ? m.impute[i]! : raw;
    z += (m.coef[i]! * (v - m.mean[i]!)) / (m.scale[i] || 1);
  }
  return 1 / (1 + Math.exp(-z));
}
