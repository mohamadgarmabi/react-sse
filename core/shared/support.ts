/**
 * Detects if the current environment (browser/device) supports SharedWorker.
 * SharedWorker is not available in:
 * - IE (all versions)
 * - Safari iOS 7–15.8
 * - Some private/embedded contexts
 * - Non-secure contexts in some browsers (e.g. non-HTTPS)
 *
 * @returns true if SharedWorker is supported and can be used
 */
export function isSharedWorkerSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return typeof (window as Window & { SharedWorker?: typeof SharedWorker }).SharedWorker !== 'undefined';
}
