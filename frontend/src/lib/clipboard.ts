/**
 * Cross-environment clipboard utility.
 * Falls back from navigator.clipboard → textarea execCommand → manual prompt.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for HTTP environments
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      const success = document.execCommand('copy');
      document.body.removeChild(ta);
      return success;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }
}
