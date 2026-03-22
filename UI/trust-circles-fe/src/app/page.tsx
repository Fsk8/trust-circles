'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CircleDot, Loader2, Sparkles, Zap } from 'lucide-react'
import { parseEther, zeroAddress } from 'viem'
import { avalancheFuji } from 'wagmi/chains'
import {
  useChainId,
  useAccount,
  useDisconnect,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FACTORY_ADDRESS, factoryAbi } from '@/constants/contracts'
import { cn } from '@/lib/utils'

// 🚀 LA CLAVE: Cargar la sección de wallet SOLO en el cliente
const ConnectSection = dynamic(() => import('@/components/ConnectSection'), { 
  ssr: false,
  loading: () => <div className="h-10 w-32 animate-pulse rounded-lg bg-white/5" />
})

export default function Page() {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [name, setName] = useState('')
  const [minContribution, setMinContribution] = useState('0.01')
  const [durationDays, setDurationDays] = useState('3')
  const [formError, setFormError] = useState<string | null>(null)

  const { writeContract, data: hash, isPending: isWritePending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const wrongNetwork = isConnected && chainId !== avalancheFuji.id

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected) return setFormError('Connect first!')
    try {
      writeContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: 'createCircle',
        args: [name, true, zeroAddress, 1, [], parseEther(minContribution)],
      })
    } catch (err) { setFormError('Check amounts') }
  }

  return (
    <div className="relative min-h-screen bg-[#030303] text-slate-200 selection:bg-cyan-500/30">
      {/* Glow Effects - Estilo Aleph */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-lg px-6 py-12">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-600/20 border border-cyan-500/30">
              <CircleDot className="size-6 text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Trust Circles
            </h1>
          </div>
          <ConnectSection disconnect={disconnect} />
        </header>

        <Card className="border-white/5 bg-white/[0.02] backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Sparkles className="size-5 text-cyan-400" /> Create Circle
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Deploy a new trust-based pool on Avalanche Fuji.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-4">
              {wrongNetwork && (
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex flex-col gap-2">
                  <span className="flex items-center gap-2 font-semibold"><Zap className="size-4" /> Wrong Network</span>
                  <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => switchChain({ chainId: avalancheFuji.id })}>
                    Switch to Fuji
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-slate-500">Circle Name</Label>
                <Input className="bg-white/5 border-white/10 focus:border-cyan-500/50 transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cochabamba Devs" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-slate-500">Min. Contribution (AVAX)</Label>
                <Input type="number" step="0.01" className="bg-white/5 border-white/10 focus:border-cyan-500/50" value={minContribution} onChange={e => setMinContribution(e.target.value)} />
              </div>

              {hash && (
                <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 animate-in slide-in-from-bottom-2">
                  <p className="text-[10px] text-cyan-400 font-mono mb-1 uppercase tracking-wider">Transaction Sent</p>
                  <a href={`https://testnet.snowtrace.io/tx/${hash}`} target="_blank" className="text-xs underline break-all opacity-70 hover:opacity-100 transition-opacity">{hash}</a>
                  {isConfirmed && <p className="text-emerald-400 text-xs mt-2 font-bold">✓ Circle Deployed Successfully</p>}
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button type="submit" size="lg" className="w-full bg-gradient-to-r from-cyan-600 to-violet-600 hover:scale-[1.02] active:scale-[0.98] transition-all font-bold shadow-lg shadow-cyan-500/20" disabled={isWritePending || isConfirming}>
                {(isWritePending || isConfirming) ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2 size-4 fill-current" />}
                {isConfirming ? 'Confirming...' : 'Deploy on Fuji'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-[0.2em]">
            Dashboard View →
          </Link>
        </div>
      </div>
    </div>
  )
}