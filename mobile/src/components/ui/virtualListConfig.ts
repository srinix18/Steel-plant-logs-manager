/** Lists that can exceed this count must use FlatList (P6-PERF). */
export const LIST_VIRTUALIZE_THRESHOLD = 50;

export function shouldVirtualizeList(rowCount: number): boolean {
  return rowCount > LIST_VIRTUALIZE_THRESHOLD;
}
