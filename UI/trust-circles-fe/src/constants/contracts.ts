import type { Abi } from 'viem'

import circleAbiJson from '../abis/TrustCircle.json'
import factoryAbiJson from '../abis/TrustCircleFactory.json'
import reputationAbiJson from '../abis/ReputationManager.json'

/** Avalanche Fuji — ver `deployments/fuji.json` en el repo raíz */
export const FACTORY_ADDRESS =
  '0x5dFB63e77BE1346761Cd20fBa9c23551f3DE9A36' as const

export const REPUTATION_ADDRESS =
  '0xF0F8634CEB71ee407C9ebE5F510dA92d252653f8' as const

export const factoryAbi = factoryAbiJson as Abi
export const reputationAbi = reputationAbiJson as Abi
export const circleAbi = circleAbiJson as Abi
