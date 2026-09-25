/**
 * SQL LIKE escaping helper for queries with ESCAPE '\'.
 */

export function escapeLike(query: string): string {
  return query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
