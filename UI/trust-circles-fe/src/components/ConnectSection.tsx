'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { shortAddress } from '@/lib/eth'
import { Button } from '@/components/ui/button'
import { Wallet } from 'lucide-react'

export default function ConnectSection({ disconnect }: { disconnect: () => void }) {
  const { isConnected, address } = useAccount()

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2 animate-in fade-in duration-500">
        <span className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs text-cyan-300 backdrop-blur-sm">
          {shortAddress(address)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/10 hover:bg-white/5"
          onClick={() => disconnect()}
        >
          Exit
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-in zoom-in-95 duration-500">
      <ConnectButton 
        label="Connect Wallet"
        showBalance={false}
        chainStatus="icon"
      />
    </div>
  )
}