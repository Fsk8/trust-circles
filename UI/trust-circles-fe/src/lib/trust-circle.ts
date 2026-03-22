export function formatTrustLevel(level: number) {
  switch (level) {
    case 0:
      return 'High'
    case 1:
      return 'Medium'
    default:
      return 'Low'
  }
}

export const REQUEST_STATUS_LABELS = [
  'Pending',
  'Approved',
  'Rejected',
  'Executed',
  'Expired',
] as const

export function formatRequestStatus(status: number) {
  return REQUEST_STATUS_LABELS[status] ?? `Unknown (${status})`
}
