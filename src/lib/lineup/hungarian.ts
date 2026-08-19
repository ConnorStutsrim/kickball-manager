/**
 * Hungarian algorithm (Kuhn-Munkres) for the square assignment problem:
 * given an n x n cost matrix, find the assignment of rows to columns that
 * minimizes total cost. O(n^3), which is more than fast enough for the
 * small (<= ~14) matrices this app ever produces.
 *
 * Classic shortest-augmenting-path formulation with row/column potentials.
 */
export function solveAssignment(costMatrix: number[][]): number[] {
  const n = costMatrix.length;
  if (n === 0) return [];
  if (costMatrix.some((row) => row.length !== n)) {
    throw new Error("solveAssignment requires a square cost matrix");
  }

  const INF = Infinity;
  // 1-indexed internally (index 0 is a sentinel "no row/column").
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0); // p[j] = row currently assigned to column j
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array(n).fill(0);
  for (let j = 1; j <= n; j++) {
    if (p[j] > 0) result[p[j] - 1] = j - 1;
  }
  return result;
}
