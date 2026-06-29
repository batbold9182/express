/** Remove reviews whose author was deleted and strip comments from deleted authors. */
export function stripNullAuthors(reviews: any[]): any[] {
  return reviews
    .filter(r => r.userId != null)
    .map(r => {
      const obj = typeof r.toObject === 'function' ? r.toObject() : r;
      return { ...obj, comments: (obj.comments ?? []).filter((c: any) => c.userId != null) };
    });
}
