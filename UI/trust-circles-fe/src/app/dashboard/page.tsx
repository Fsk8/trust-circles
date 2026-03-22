'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { type Address, formatEther } from 'viem'
import { avalancheFuji } from 'wagmi/chains'
import {
  useAccount,
  useReadContract,
  useReadContracts,
} from 'wagmi'
import { Loader2, RefreshCw, Shield, Users } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  circleAbi,
  FACTORY_ADDRESS,
  factoryAbi,
  REPUTATION_ADDRESS,
} from '@/constants/contracts'
import { shortAddress } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { formatTrustLevel } from '@/lib/trust-circle'

type CircleInfoTuple = readonly [
  `0x${string}`,
  `0x${string}`,
  string,
  boolean,
  `0x${string}`,
  number,
  bigint,
]

function parseCircleInfo(raw: unknown): CircleInfoTuple | null {
  if (!Array.isArray(raw) || raw.length < 7) return null
  return raw as unknown as CircleInfoTuple
}

export default function DashboardPage() {
  const connection = useAccount()
  const wallet = connection.address

  const {
    data: circleAddresses,
    isLoading: loadingList,
    refetch: refetchList,
    error: listError,
  } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'getAllCircles',
    chainId: avalancheFuji.id,
  })

  const circles = (circleAddresses ?? []) as readonly Address[]

  const detailContracts = useMemo(() => {
    if (!circles.length) return []
    return circles.flatMap((addr) => [
      {
        chainId: avalancheFuji.id,
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: 'circleInfo' as const,
        args: [addr],
      },
      {
        chainId: avalancheFuji.id,
        address: addr,
        abi: circleAbi,
        functionName: 'totalPool' as const,
      },
      {
        chainId: avalancheFuji.id,
        address: addr,
        abi: circleAbi,
        functionName: 'memberCount' as const,
      },
      {
        chainId: avalancheFuji.id,
        address: addr,
        abi: circleAbi,
        functionName: 'paused' as const,
      },
    ])
  }, [circles])

  const { data: detailResults, refetch: refetchDetails } = useReadContracts({
    contracts: detailContracts,
    query: { enabled: detailContracts.length > 0 },
  })

  const { data: reputation } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'getReputation',
    args: wallet ? [wallet] : undefined,
    chainId: avalancheFuji.id,
    query: { enabled: Boolean(wallet) },
  })

  const rows = useMemo(() => {
    if (!circles.length || !detailResults?.length) return []
    return circles.map((addr, i) => {
      const base = i * 4
      const infoRaw = detailResults[base]?.result
      const totalPool = detailResults[base + 1]?.result as bigint | undefined
      const memberCount = detailResults[base + 2]?.result as bigint | undefined
      const paused = detailResults[base + 3]?.result as boolean | undefined
      const info = parseCircleInfo(infoRaw)
      return {
        address: addr,
        name: info?.[2] ?? '—',
        admin: info?.[1],
        isNative: info?.[3] ?? true,
        trustLevel: Number(info?.[5] ?? 0),
        createdAt: info?.[6],
        totalPool,
        memberCount,
        paused,
      }
    })
  }, [circles, detailResults])

  async function handleRefresh() {
    await refetchList()
    await refetchDetails()
  }

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Circles on Avalanche Fuji · interact from each card
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 self-start sm:self-auto"
          onClick={() => void handleRefresh()}
          disabled={loadingList}
        >
          <RefreshCw
            className={`size-3.5 ${loadingList ? 'animate-spin' : ''}`}
            aria-hidden
          />
          Refresh
        </Button>
      </div>

      {wallet && (
        <Card className="mb-8 border-cyan-500/20 bg-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-cyan-400" aria-hidden />
              Your reputation
            </CardTitle>
            <CardDescription>
              Via factory proxy to{' '}
              <code className="rounded bg-muted px-1 font-mono text-xs">
                ReputationManager
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {reputation !== undefined ? String(reputation) : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Wallet {shortAddress(wallet)}
            </p>
          </CardContent>
        </Card>
      )}

      {!wallet && (
        <p className="mb-6 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Connect a wallet to see your reputation score.
        </p>
      )}

      {listError && (
        <p className="mb-6 text-sm text-destructive" role="alert">
          {listError.message}
        </p>
      )}

      {loadingList && circleAddresses === undefined && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading circles…
        </div>
      )}

      {!loadingList && circles.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No circles yet</CardTitle>
            <CardDescription>
              Deploy the first one from the Create page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className={cn(buttonVariants(), 'inline-flex gap-2')}>
              Create a circle
            </Link>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.address}>
              <Card className="overflow-hidden transition-colors hover:border-border">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-lg">{row.name}</CardTitle>
                    <CardDescription className="mt-1 font-mono text-xs">
                      {row.address}
                    </CardDescription>
                  </div>
                  <Link
                    href={`/circle/${row.address}`}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                  >
                    Open
                  </Link>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Pool</p>
                    <p className="font-mono font-medium">
                      {row.totalPool !== undefined
                        ? `${formatEther(row.totalPool)} ${
                            row.isNative ? 'AVAX' : 'tokens'
                          }`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="flex items-center gap-1.5 font-medium">
                      <Users className="size-3.5 text-muted-foreground" />
                      {row.memberCount !== undefined
                        ? String(row.memberCount)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trust tier</p>
                    <p>{formatTrustLevel(row.trustLevel)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Admin</p>
                    <p className="font-mono text-xs">
                      {row.admin ? shortAddress(row.admin) : '—'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p>
                      {row.paused ? (
                        <span className="text-amber-400">Paused</span>
                      ) : (
                        <span className="text-emerald-400/90">Active</span>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-12 border-t border-border/60 pt-6 text-center text-[0.65rem] text-muted-foreground">
        <p className="mb-2 font-medium text-foreground/80">Contracts (Fuji)</p>
        <p>
          Factory{' '}
          <a
            href={`https://testnet.snowtrace.io/address/${FACTORY_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-cyan-500/90 underline-offset-2 hover:underline"
          >
            {shortAddress(FACTORY_ADDRESS)}
          </a>
          {' · '}
          Reputation{' '}
          <a
            href={`https://testnet.snowtrace.io/address/${REPUTATION_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-cyan-500/90 underline-offset-2 hover:underline"
          >
            {shortAddress(REPUTATION_ADDRESS)}
          </a>
        </p>
      </footer>
    </div>
  )
}
