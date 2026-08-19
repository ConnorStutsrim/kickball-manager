import { describe, expect, it } from "vitest";
import { solveAssignment } from "../hungarian";

function totalCost(matrix: number[][], assignment: number[]): number {
  return assignment.reduce((sum, col, row) => sum + matrix[row][col], 0);
}

function bruteForceMinCost(matrix: number[][]): number {
  const n = matrix.length;
  const cols = Array.from({ length: n }, (_, i) => i);

  function permutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];
    const result: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }

  let best = Infinity;
  for (const perm of permutations(cols)) {
    const cost = perm.reduce((sum, col, row) => sum + matrix[row][col], 0);
    if (cost < best) best = cost;
  }
  return best;
}

describe("solveAssignment", () => {
  it("picks the cheap diagonal over expensive off-diagonal options", () => {
    const matrix = [
      [1, 10, 10],
      [10, 1, 10],
      [10, 10, 1],
    ];
    const assignment = solveAssignment(matrix);
    expect(assignment).toEqual([0, 1, 2]);
    expect(totalCost(matrix, assignment)).toBe(3);
  });

  it("picks the anti-diagonal when it's actually cheaper", () => {
    const matrix = [
      [4, 1],
      [1, 4],
    ];
    const assignment = solveAssignment(matrix);
    expect(assignment).toEqual([1, 0]);
    expect(totalCost(matrix, assignment)).toBe(2);
  });

  it("handles a 1x1 matrix", () => {
    expect(solveAssignment([[5]])).toEqual([0]);
  });

  it("handles an empty matrix", () => {
    expect(solveAssignment([])).toEqual([]);
  });

  it("throws on a non-square matrix", () => {
    expect(() => solveAssignment([[1, 2], [3, 4, 5]])).toThrow();
  });

  it("matches brute-force optimal cost on random matrices", () => {
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let trial = 0; trial < 15; trial++) {
      const n = 4 + (trial % 3); // sizes 4, 5, 6
      const matrix = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => Math.floor(rng() * 20)),
      );

      const assignment = solveAssignment(matrix);
      const columnsUsed = new Set(assignment);
      expect(columnsUsed.size).toBe(n);

      expect(totalCost(matrix, assignment)).toBe(bruteForceMinCost(matrix));
    }
  });
});
