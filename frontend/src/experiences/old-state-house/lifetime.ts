export function createDeferredDisposal(dispose: () => void) {
  let leases = 0, revision = 0, disposed = false
  return { retain() {
    leases++; revision++
    let released = false
    return () => {
      if (released) return
      released = true; leases--
      const ticket = ++revision
      queueMicrotask(() => { if (!disposed && leases === 0 && revision === ticket) { disposed = true; dispose() } })
    }
  } }
}
