export const formatImageUrl = (src?: string): string => {
  if (!src) return '';
  if (
    src.startsWith('data:') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('/') ||
    src.startsWith('blob:')
  ) {
    return src;
  }
  if (src.startsWith('iVBOR')) return `data:image/png;base64,${src}`;
  if (src.startsWith('/9j/')) return `data:image/jpeg;base64,${src}`;
  if (src.startsWith('R0lGOD')) return `data:image/gif;base64,${src}`;
  return `data:image/jpeg;base64,${src}`;
};

