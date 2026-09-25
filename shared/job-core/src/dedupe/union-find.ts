/**
 * Disjoint Set Union (Union-Find) with path compression and rank optimization.
 */

export class UnionFind {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array<number>(size).fill(0);
  }

  find(x: number): number {
    let root = x;
    while (root !== this.parent[root]) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounded array index
      root = this.parent[root]!;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounded array index
      const next = this.parent[curr]!;
      this.parent[curr] = root;
      curr = next;
    }
    return root;
  }

  union(x: number, y: number): boolean {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounded array index
    const rankX = this.rank[rootX]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounded array index
    const rankY = this.rank[rootY]!;

    if (rankX < rankY) {
      this.parent[rootX] = rootY;
    } else if (rankX > rankY) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX] = rankX + 1;
    }

    return true;
  }

  /**
   * Returns a map from root index to all element indices in that set.
   */
  getGroups(): Map<number, number[]> {
    const groups = new Map<number, number[]>();
    for (let i = 0; i < this.parent.length; i++) {
      const root = this.find(i);
      const list = groups.get(root);
      if (list) {
        list.push(i);
      } else {
        groups.set(root, [i]);
      }
    }
    return groups;
  }
}
