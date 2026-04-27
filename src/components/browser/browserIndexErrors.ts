export function isProtectedFolderError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('system files') || normalized.includes('wellknowndirectory');
}
