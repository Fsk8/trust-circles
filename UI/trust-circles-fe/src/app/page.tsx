'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { CircleDot, Loader2, Sparkles, Wallet, Zap } from 'lucide-react'
import { parseEther, zeroAddress } from 'viem'
import { avalancheFuji } from 'wagmi/chains'
import {
  useChainId,
  useConnect,
  useAccount,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FACTORY_ADDRESS, factoryAbi } from '@/constants/contracts'
import { shortAddress } from '@/lib/eth'
import { cn } from '@/lib/utils'

function daysToTrustLevel(days: number): 0 | 1 | 2 {
  const d = Math.max(1, Math.min(365, Math.round(days)))
  if (d <= 1) return 0
  if (d === 2) return 1
  return 2
}

export default function Page() {
  const [mounted, setMounted] = useState(false)
  
  // Siempre llamar a los hooks en el top level
  const connection = useAccount()
  const chainId = useChainId()
  const { connect, status: connectStatus, reset: resetConnect } = useConnect()
  const connectors = useConnectors()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [name, setName] = useState('')
  const [minContribution, setMinContribution] = useState('0.01')
  const [durationDays, setDurationDays] = useState('3')
  const [formError, setFormError] = useState<string | null>(null)

  const { writeContract, data: hash, isPending: isWritePending, error: writeError, reset: resetWrite } = useWriteContract()
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    chainId: avalancheFuji.id,
  })

  // Hook de montaje
  useEffect(() => {
    setMounted(true)
  }, [])

  const trustLevel = useMemo(() => daysToTrustLevel(Number(durationDays) || 1), [durationDays])
  const defaultConnector = useMemo(() => connectors[0], [connectors])
  const isConnected = connection.status === 'connected'
  const address = connection.addresses?.[0]
  const wrongNetwork = isConnected && chainId !== avalancheFuji.id

  const handleConnectWallet = (connector = defaultConnector) => {
    if (!connector) return
    resetConnect()
    connect({ connector, chainId: avalancheFuji.id })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!isConnected || !address) return setFormError('Connect wallet first.')
    try {
      const minWei = parseEther(minContribution || '0')
      writeContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: 'createCircle',
        args: [name.trim(), true, zeroAddress, trustLevel, [], minWei],
        chainId: avalancheFuji.id,
      })
    } catch (err) {
      setFormError('Invalid amount.')
    }
  }

  // --- RENDERIZADO CRÍTICO ---
  // Si no está montado, el servidor devuelve un div vacío. 
  // Esto garantiza que NO haya mismatch de HTML.
  if (!mounted) return <div className="min-h-screen bg-black" />

  return (
    <div className="relative min-h-screen bg-black text-white p-4 font-sans" suppressHydrationWarning>
      <div className="mx-auto max-w-lg space-y-8 pt-12">
        
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDot className="text-cyan-400 size-8" />
            <div>
              <h1 className="text-xl font-bold">Trust Circles</h1>
              <p className="text-xs text-cyan-500/80 font-mono">Fuji Testnet</p>
            </div>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded">{shortAddress(address!)}</span>
              <Button variant="ghost" size="sm" onClick={() => disconnect()}>Logout</Button>
            </div>
          ) : (
            <Button onClick={() => handleConnectWallet()} disabled={connectStatus === 'pending'}>
              {connectStatus === 'pending' ? <Loader2 className="animate-spin" /> : 'Connect'}
            </Button>
          )}
        </header>

        {/* Form Card */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="size-4 text-violet-400" /> Nuevo Círculo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {wrongNetwork && (
              <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => switchChain({ chainId: avalancheFuji.id })}>
                Switch to Fuji
              </Button>
            )}
            <div className="space-y-2">
              <Label className="text-neutral-400">Nombre</Label>
              <Input className="bg-neutral-800 border-neutral-700 text-white" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-400">Min Contribution (AVAX)</Label>
              <Input type="number" className="bg-neutral-800 border-neutral-700 text-white" value={minContribution} onChange={e => setMinContribution(e.target.value)} />
            </div>
            
            {hash && (
              <div className="p-3 bg-cyan-950/30 border border-cyan-800 rounded text-[10px] break-all">
                <p className="text-cyan-400 font-bold">Tx Hash:</p>
                <a href={`https://testnet.snowtrace.io/tx/${hash}`} target="_blank" className="underline">{hash}</a>
                {isConfirming && <p className="mt-2 animate-pulse">Esperando confirmación...</p>}
                {isConfirmed && <p className="mt-2 text-green-400 font-bold">¡Desplegado con éxito!</p>}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500" onClick={handleSubmit} disabled={isWritePending || isConfirming}>
              {(isWritePending || isConfirming) ? <Loader2 className="animate-spin" /> : 'Desplegar en Fuji'}
            </Button>
          </CardFooter>
        </Card>

        <div className="text-center">
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-cyan-400 transition-colors">
            Ir al Dashboard →
          </Link>
        </div>
      </div>
    </div>
  )
}