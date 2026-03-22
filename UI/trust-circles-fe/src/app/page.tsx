'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
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

/** Matches on-chain `TrustLevel`: voting window is 24h / 48h / 72h respectively. */
function daysToTrustLevel(days: number): 0 | 1 | 2 {
  const d = Math.max(1, Math.min(365, Math.round(days)))
  if (d <= 1) return 0
  if (d === 2) return 1
  return 2
}

function trustLevelLabel(level: 0 | 1 | 2) {
  switch (level) {
    case 0:
      return 'High — ~24h voting, 50% quorum'
    case 1:
      return 'Medium — ~48h voting, 67% quorum'
    default:
      return 'Low — ~72h voting, 80% quorum'
  }
}

export default function Page() {
  const connection = useAccount()
  const chainId = useChainId()
  const {
    connect,
    status: connectStatus,
    error: connectError,
    reset: resetConnect,
  } = useConnect()
  const connectors = useConnectors()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [name, setName] = useState('')
  const [minContribution, setMinContribution] = useState('0.01')
  const [durationDays, setDurationDays] = useState('3')
  const [formError, setFormError] = useState<string | null>(null)

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
      chainId: avalancheFuji.id,
    })

  const trustLevel = useMemo(
    () => daysToTrustLevel(Number(durationDays) || 1),
    [durationDays],
  )

  const defaultConnector = useMemo(
    () => connectors[0],
    [connectors],
  )

  const isConnected = connection.status === 'connected'
  const address = connection.addresses?.[0]
  const wrongNetwork = isConnected && chainId !== avalancheFuji.id

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    resetWrite()

    if (!isConnected || !address) {
      setFormError('Connect a wallet first.')
      return
    }
    if (wrongNetwork) {
      setFormError('Switch to Avalanche Fuji to create a circle.')
      return
    }
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Circle name is required.')
      return
    }

    let minWei: bigint
    try {
      minWei = parseEther(minContribution || '0')
    } catch {
      setFormError('Min contribution must be a valid AVAX amount.')
      return
    }
    if (minWei <= BigInt(0)) {
      setFormError('Min contribution must be greater than zero.')
      return
    }

    writeContract({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: 'createCircle',
      args: [trimmed, true, zeroAddress, trustLevel, [], minWei],
      chainId: avalancheFuji.id,
    })
  }

  const busy = isWritePending || isConfirming

  function handleConnectWallet(connector = defaultConnector) {
    if (!connector) return
    resetConnect()
    connect({ connector, chainId: avalancheFuji.id })
  }

  const connectButtonClass =
    'gap-2 bg-linear-to-r from-cyan-600 to-violet-600 text-white hover:from-cyan-500 hover:to-violet-500'

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.35),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(56,189,248,0.12),transparent),radial-gradient(ellipse_50%_30%_at_0%_80%,rgba(167,139,250,0.15),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)] [background-size:48px_48px]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-cyan-400/20 to-violet-500/20 ring-1 ring-cyan-400/30">
              <CircleDot className="size-6 text-cyan-300" aria-hidden />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Trust Circles
              </h1>
              <p className="text-xs text-muted-foreground">
                Deploy on{' '}
                <span className="font-mono text-cyan-400/90">Fuji</span> testnet
              </p>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: 'link', size: 'xs' }),
                  'mt-1 h-auto px-0 py-0 text-xs text-cyan-400/80',
                )}
              >
                View dashboard →
              </Link>
            </div>
          </div>

          {isConnected && address ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-border bg-card/80 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur-sm">
                {shortAddress(address)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => disconnect()}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <Button
                type="button"
                size="default"
                className={connectButtonClass}
                onClick={() => handleConnectWallet()}
                disabled={
                  !defaultConnector || connectStatus === 'pending'
                }
              >
                {connectStatus === 'pending' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Wallet className="size-4" aria-hidden />
                    Connect wallet
                  </>
                )}
              </Button>
              {connectors.length > 1 && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {connectors
                    .filter((c) => c.uid !== defaultConnector?.uid)
                    .map((c) => (
                      <Button
                        key={c.uid}
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => handleConnectWallet(c)}
                        disabled={connectStatus === 'pending'}
                      >
                        {c.name}
                      </Button>
                    ))}
                </div>
              )}
            </div>
          )}
        </header>

        {connectError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {connectError instanceof Error
              ? connectError.message
              : String(connectError)}
          </div>
        )}

        <Card className="border-border/60 bg-card/70 shadow-xl shadow-cyan-950/20 ring-1 ring-cyan-500/10 backdrop-blur-md">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="size-4 text-violet-400" aria-hidden />
                  Create Trust Circle
                </CardTitle>
                <CardDescription className="mt-1.5 text-pretty">
                  Native AVAX pool · Factory deploys a new{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
                    TrustCircle
                  </code>{' '}
                  contract
                </CardDescription>
              </div>
              <span className="shrink-0 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-cyan-300">
                Web3
              </span>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-5 pt-6">
              {wrongNetwork && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <p className="flex items-center gap-2 font-medium">
                    <Zap className="size-4 shrink-0" aria-hidden />
                    Wrong network — switch to Avalanche Fuji
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-fit"
                    disabled={isSwitching}
                    onClick={() =>
                      switchChain({ chainId: avalancheFuji.id })
                    }
                  >
                    {isSwitching ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Switching…
                      </>
                    ) : (
                      'Switch to Fuji'
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="circle-name">Circle name</Label>
                <Input
                  id="circle-name"
                  name="name"
                  placeholder="e.g. Builder Guild · Season 4"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  className="font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-contrib">Min contribution (AVAX)</Label>
                <Input
                  id="min-contrib"
                  name="minContribution"
                  inputMode="decimal"
                  placeholder="0.1"
                  value={minContribution}
                  onChange={(e) => setMinContribution(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sent to the contract as{' '}
                  <span className="font-mono text-foreground/80">uint256</span>{' '}
                  wei via <span className="font-mono">parseEther</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Target duration (days)</Label>
                <Input
                  id="duration"
                  name="durationDays"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                />
                <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  On-chain governance windows are fixed by trust tier — we map
                  your days to{' '}
                  <span className="font-medium text-foreground">
                    {trustLevelLabel(trustLevel)}
                  </span>
                </p>
              </div>

              {(formError || writeError) && (
                <p
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {formError ??
                    (writeError instanceof Error
                      ? writeError.message
                      : String(writeError))}
                </p>
              )}

              {hash && (
                <div className="space-y-1 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs">
                  <p className="font-medium text-cyan-200/90">Transaction</p>
                  <a
                    href={`https://testnet.snowtrace.io/tx/${hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-cyan-400/90 underline-offset-2 hover:underline"
                  >
                    {hash}
                  </a>
                  {isConfirming && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Confirming on Fuji…
                    </p>
                  )}
                  {isConfirmed && (
                    <p className="font-medium text-emerald-400/90">
                      Confirmed — your circle is live.
                    </p>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {!isConnected ? (
                <Button
                  type="button"
                  size="lg"
                  className={`w-full sm:w-auto ${connectButtonClass}`}
                  onClick={() => handleConnectWallet()}
                  disabled={
                    !defaultConnector || connectStatus === 'pending'
                  }
                >
                  {connectStatus === 'pending' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <Wallet className="size-4" aria-hidden />
                      Connect wallet
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={wrongNetwork || busy}
                  className={`w-full sm:w-auto ${connectButtonClass}`}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      {isWritePending ? 'Confirm in wallet…' : 'Confirming…'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" aria-hidden />
                      Deploy circle
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-[0.7rem] text-muted-foreground">
          Factory ·{' '}
          <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.65rem]">
            {FACTORY_ADDRESS}
          </code>
        </p>
      </div>
    </div>
  )
}
