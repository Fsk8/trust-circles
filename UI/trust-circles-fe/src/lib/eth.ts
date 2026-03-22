import type { Address } from 'viem'

export function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function isValidCircleAddress(
  value: string | undefined,
): value is Address {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value))
}
