'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatEther,
  isAddress,
  parseEther,
  type Address,
} from 'viem'
import { avalancheFuji } from 'wagmi/chains'
import {
  useChainId,
  useAccount,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Vote,
  Wallet,
  Zap,
} from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  circleAbi,
  FACTORY_ADDRESS,
  factoryAbi,
} from '@/constants/contracts'
import { isValidCircleAddress, shortAddress } from '@/lib/eth'
import {
  formatRequestStatus,
  formatTrustLevel,
} from '@/lib/trust-circle'
import { cn } from '@/lib/utils'

const chainId = avalancheFuji.id

type RequestRow = {
  id: number
  requester: Address
  amount: bigint
  reason: string
  deadline: bigint
  votesFor: bigint
  votesAgainst: bigint
  status: number
}

function parseGetRequest(raw: unknown): Omit<RequestRow, 'id'> | null {
  if (!Array.isArray(raw) || raw.length < 7) return null
  return {
    requester: raw[0] as Address,
    amount: raw[1] as bigint,
    reason: raw[2] as string,
    deadline: raw[3] as bigint,
    votesFor: raw[4] as bigint,
    votesAgainst: raw[5] as bigint,
    status: Number(raw[6]),
  }
}

export default function CircleDetailPage() {
  const params = useParams()
  const raw = params.address
  const circleAddress =
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''

  const connection = useAccount()
  const wallet = connection.addresses?.[0]
  const activeChainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [contribAvax, setContribAvax] = useState('0.01')
  const [reqAmountAvax, setReqAmountAvax] = useState('0.01')
  const [reqReason, setReqReason] = useState('')
  const [newMember, setNewMember] = useState('')
  const [newMinAvax, setNewMinAvax] = useState('0.01')
  const [actionError, setActionError] = useState<string | null>(null)

  const valid = isValidCircleAddress(circleAddress)
  const caMaybe = valid ? (circleAddress as Address) : undefined

  const coreContracts = useMemo(() => {
    if (!caMaybe) return []
    return [
      { chainId, address: caMaybe, abi: circleAbi, functionName: 'owner' as const },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'circleName' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'totalPool' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'requestCount' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'memberCount' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'paused' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'minContribution' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'isNative' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'tokenAddress' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'trustLevel' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'quorumBps' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'votingDuration' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'recoveryActive' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'recoveryProposal' as const,
      },
      {
        chainId,
        address: caMaybe,
        abi: circleAbi,
        functionName: 'getMembers' as const,
      },
    ]
  }, [caMaybe])

  const { data: coreResults, refetch: refetchCore } = useReadContracts({
    contracts: coreContracts,
    query: { enabled: Boolean(caMaybe) },
  })

  const owner = coreResults?.[0]?.result as Address | undefined
  const circleName = coreResults?.[1]?.result as string | undefined
  const totalPool = coreResults?.[2]?.result as bigint | undefined
  const requestCount = coreResults?.[3]?.result as bigint | undefined
  const memberCount = coreResults?.[4]?.result as bigint | undefined
  const paused = coreResults?.[5]?.result as boolean | undefined
  const minContribution = coreResults?.[6]?.result as bigint | undefined
  const isNative = coreResults?.[7]?.result as boolean | undefined
  const tokenAddress = coreResults?.[8]?.result as Address | undefined
  const trustLevel = Number(coreResults?.[9]?.result ?? 0)
  const quorumBps = coreResults?.[10]?.result as bigint | undefined
  const votingDuration = coreResults?.[11]?.result as bigint | undefined
  const recoveryActive = coreResults?.[12]?.result as boolean | undefined
  const recoveryRaw = coreResults?.[13]?.result as
    | readonly [Address, bigint, bigint, bigint, boolean]
    | undefined
  const members = coreResults?.[14]?.result as Address[] | undefined

  const recoveryProposal = recoveryRaw
    ? {
        proposed: recoveryRaw[0],
        deadline: recoveryRaw[1],
        votesFor: recoveryRaw[2],
        votesAgainst: recoveryRaw[3],
        executed: recoveryRaw[4],
      }
    : undefined

  const nRequests = requestCount !== undefined ? Number(requestCount) : 0

  const requestContracts = useMemo(() => {
    if (!caMaybe || nRequests <= 0) return []
    return Array.from({ length: nRequests }, (_, i) => ({
      chainId,
      address: caMaybe,
      abi: circleAbi,
      functionName: 'getRequest' as const,
      args: [BigInt(i)] as const,
    }))
  }, [caMaybe, nRequests])

  const { data: requestResults, refetch: refetchRequests } = useReadContracts({
    contracts: requestContracts,
    query: { enabled: requestContracts.length > 0 },
  })

  const requests: RequestRow[] = useMemo(() => {
    if (!requestResults?.length) return []
    return requestResults.map((r, id) => {
      const p = parseGetRequest(r.result)
      if (!p) {
        return {
          id,
          requester: '0x0' as Address,
          amount: BigInt(0),
          reason: '',
          deadline: BigInt(0),
          votesFor: BigInt(0),
          votesAgainst: BigInt(0),
          status: 0,
        }
      }
      return { id, ...p }
    })
  }, [requestResults])

  const hasVotedContracts = useMemo(() => {
    if (!caMaybe || !wallet || nRequests <= 0) return []
    return Array.from({ length: nRequests }, (_, i) => ({
      chainId,
      address: caMaybe,
      abi: circleAbi,
      functionName: 'hasVoted' as const,
      args: [BigInt(i), wallet] as const,
    }))
  }, [caMaybe, wallet, nRequests])

  const { data: votedResults } = useReadContracts({
    contracts: hasVotedContracts,
    query: { enabled: hasVotedContracts.length > 0 },
  })

  const { data: isMemberRaw } = useReadContract({
    address: caMaybe,
    abi: circleAbi,
    functionName: 'isMember',
    args: wallet ? [wallet] : undefined,
    chainId,
    query: { enabled: Boolean(caMaybe && wallet) },
  })
  const isMember = isMemberRaw === true

  const { data: myContribution } = useReadContract({
    address: caMaybe,
    abi: circleAbi,
    functionName: 'contributions',
    args: wallet ? [wallet] : undefined,
    chainId,
    query: { enabled: Boolean(caMaybe && wallet) },
  })

  const { data: reputation } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: 'getReputation',
    args: wallet ? [wallet] : undefined,
    chainId,
    query: { enabled: Boolean(wallet) },
  })

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash,
      chainId,
    })

  const wrongNetwork =
    connection.status === 'connected' && activeChainId !== chainId
  const isAdmin =
    wallet && owner && wallet.toLowerCase() === owner.toLowerCase()

  const lastHandledHash = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!txSuccess || !txHash || lastHandledHash.current === txHash) return
    lastHandledHash.current = txHash
    void refetchCore()
    void refetchRequests()
  }, [txSuccess, txHash, refetchCore, refetchRequests])

  function clearErrors() {
    setActionError(null)
    resetWrite()
  }

  const busy = isWritePending || isConfirming

  if (!valid) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-destructive">Invalid circle address.</p>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: 'link' }), 'mt-4 px-0')}
        >
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const ca = circleAddress as Address

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Dashboard
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {circleName ?? 'Trust Circle'}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
            {ca}
          </p>
        </div>
        <a
          href={`https://testnet.snowtrace.io/address/${ca}`}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'gap-1.5',
          )}
        >
          Snowtrace
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>

      {wrongNetwork && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-amber-100">
            <Zap className="size-4" aria-hidden />
            Switch to Avalanche Fuji to interact.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId })}
          >
            {isSwitching ? 'Switching…' : 'Switch to Fuji'}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pool &amp; governance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Total pool</p>
              <p className="font-mono font-medium">
                {totalPool !== undefined
                  ? `${formatEther(totalPool)} ${isNative ? 'AVAX' : 'tokens'}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your contribution</p>
              <p className="font-mono font-medium">
                {myContribution !== undefined && isNative !== undefined
                  ? `${formatEther(myContribution as bigint)} ${
                      isNative ? 'AVAX' : 'tokens'
                    }`
                  : wallet
                    ? '—'
                    : 'Connect wallet'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Min contribution</p>
              <p className="font-mono">
                {minContribution !== undefined && isNative !== undefined
                  ? `${formatEther(minContribution)} ${
                      isNative ? 'AVAX' : 'tokens'
                    }`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Members</p>
              <p>{memberCount !== undefined ? String(memberCount) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trust tier</p>
              <p>{formatTrustLevel(trustLevel)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quorum / voting</p>
              <p>
                {quorumBps !== undefined
                  ? `${Number(quorumBps) / 100}%`
                  : '—'}{' '}
                ·{' '}
                {votingDuration !== undefined
                  ? `${Number(votingDuration) / 3600}h`
                  : '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Status</p>
              <p>
                {paused ? (
                  <span className="text-amber-400">Paused</span>
                ) : (
                  <span className="text-emerald-400/90">Active</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {wallet && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4" aria-hidden />
                Your account
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">Reputation (factory)</p>
              <p className="font-mono text-xl font-semibold">
                {reputation !== undefined ? String(reputation) : '—'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Member: {isMember ? 'yes' : 'no'}
                {isAdmin ? ' · Admin' : ''}
              </p>
            </CardContent>
          </Card>
        )}

        {isNative && isMember && !paused && wallet && !wrongNetwork && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contribute (AVAX)</CardTitle>
              <CardDescription>
                Must be ≥ min contribution. Sends native AVAX with{' '}
                <code className="text-xs">contribute()</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="contrib">Amount (AVAX)</Label>
                <Input
                  id="contrib"
                  value={contribAvax}
                  onChange={(e) => setContribAvax(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  clearErrors()
                  try {
                    const v = parseEther(contribAvax || '0')
                    writeContract({
                      address: ca,
                      abi: circleAbi,
                      functionName: 'contribute',
                      args: [BigInt(0)],
                      value: v,
                      chainId,
                    })
                  } catch {
                    setActionError('Invalid AVAX amount.')
                  }
                }}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : 'Deposit'}
              </Button>
            </CardContent>
          </Card>
        )}

        {!isNative && isMember && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ERC-20 pool</CardTitle>
              <CardDescription>
                Call <code className="text-xs">approve</code> on the token for
                this circle, then <code className="text-xs">contribute(amount)</code>{' '}
                from your wallet or Snowtrace.                 Token:{' '}
                <span className="font-mono text-xs">
                  {tokenAddress ?? '—'}
                </span>
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {isMember && !paused && wallet && !wrongNetwork && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency request</CardTitle>
              <CardDescription>
                Ask the pool for funds; members vote, then anyone executes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="req-amt">Amount ({isNative ? 'AVAX' : 'token wei'})</Label>
                <Input
                  id="req-amt"
                  value={reqAmountAvax}
                  onChange={(e) => setReqAmountAvax(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="req-reason">Reason</Label>
                <Input
                  id="req-reason"
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Short description"
                />
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  clearErrors()
                  try {
                    const amt = isNative
                      ? parseEther(reqAmountAvax || '0')
                      : BigInt(reqAmountAvax || '0')
                    writeContract({
                      address: ca,
                      abi: circleAbi,
                      functionName: 'submitRequest',
                      args: [amt, reqReason.trim() || '—'],
                      chainId,
                    })
                  } catch {
                    setActionError('Invalid request amount.')
                  }
                }}
              >
                Submit request
              </Button>
            </CardContent>
          </Card>
        )}

        {requests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Vote className="size-4" aria-hidden />
                Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {requests.map((req) => {
                const voted = votedResults?.[req.id]?.result as
                  | boolean
                  | undefined
                const selfVote =
                  wallet &&
                  req.requester.toLowerCase() === wallet.toLowerCase()
                const pending = req.status === 0
                return (
                  <div
                    key={req.id}
                    className="rounded-lg border border-border/80 bg-muted/20 p-3 text-sm"
                  >
                    <p className="font-medium">#{req.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRequestStatus(req.status)} · by{' '}
                      {shortAddress(req.requester)} ·{' '}
                      {formatEther(req.amount)} {isNative ? 'AVAX' : 'tokens'}
                    </p>
                    <p className="mt-2 text-xs">{req.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Votes: {String(req.votesFor)} for /{' '}
                      {String(req.votesAgainst)} against · deadline{' '}
                      {new Date(Number(req.deadline) * 1000).toLocaleString()}
                    </p>
                    {isMember && !paused && wallet && !wrongNetwork && pending && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!selfVote && !voted && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                clearErrors()
                                writeContract({
                                  address: ca,
                                  abi: circleAbi,
                                  functionName: 'vote',
                                  args: [BigInt(req.id), true],
                                  chainId,
                                })
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                clearErrors()
                                writeContract({
                                  address: ca,
                                  abi: circleAbi,
                                  functionName: 'vote',
                                  args: [BigInt(req.id), false],
                                  chainId,
                                })
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            clearErrors()
                            writeContract({
                              address: ca,
                              abi: circleAbi,
                              functionName: 'executeRequest',
                              args: [BigInt(req.id)],
                              chainId,
                            })
                          }}
                        >
                          Execute / finalize
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {isAdmin && !wrongNetwork && wallet && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin</CardTitle>
              <CardDescription>Add members or update min contribution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="member-addr">Member address</Label>
                  <Input
                    id="member-addr"
                    value={newMember}
                    onChange={(e) => setNewMember(e.target.value)}
                    placeholder="0x…"
                    className="font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  disabled={busy || !isAddress(newMember)}
                  onClick={() => {
                    clearErrors()
                    writeContract({
                      address: ca,
                      abi: circleAbi,
                      functionName: 'addMember',
                      args: [newMember as Address],
                      chainId,
                    })
                  }}
                >
                  Add member
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-min">New min ({isNative ? 'AVAX' : 'wei'})</Label>
                  <Input
                    id="new-min"
                    value={newMinAvax}
                    onChange={(e) => setNewMinAvax(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    clearErrors()
                    try {
                      const v = isNative
                        ? parseEther(newMinAvax || '0')
                        : BigInt(newMinAvax || '0')
                      writeContract({
                        address: ca,
                        abi: circleAbi,
                        functionName: 'setMinContribution',
                        args: [v],
                        chainId,
                      })
                    } catch {
                      setActionError('Invalid min amount.')
                    }
                  }}
                >
                  Set minimum
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {recoveryActive && recoveryProposal && !recoveryProposal.executed && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin recovery vote</CardTitle>
              <CardDescription>
                Factory-initiated handoff to{' '}
                <span className="font-mono text-xs">
                  {shortAddress(recoveryProposal.proposed)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Deadline:{' '}
                {new Date(
                  Number(recoveryProposal.deadline) * 1000,
                ).toLocaleString()}
              </p>
              <p>
                Votes: {String(recoveryProposal.votesFor)} for /{' '}
                {String(recoveryProposal.votesAgainst)} against
              </p>
              {isMember && wallet && !wrongNetwork && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      clearErrors()
                      writeContract({
                        address: ca,
                        abi: circleAbi,
                        functionName: 'voteAdminRecovery',
                        args: [true],
                        chainId,
                      })
                    }}
                  >
                    Accept new admin
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      clearErrors()
                      writeContract({
                        address: ca,
                        abi: circleAbi,
                        functionName: 'voteAdminRecovery',
                        args: [false],
                        chainId,
                      })
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      clearErrors()
                      writeContract({
                        address: ca,
                        abi: circleAbi,
                        functionName: 'executeAdminRecovery',
                        args: [],
                        chainId,
                      })
                    }}
                  >
                    Execute recovery
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(actionError || writeError || txHash) && (
          <Card>
            <CardContent className="pt-6 text-sm">
              {actionError && (
                <p className="text-destructive" role="alert">
                  {actionError}
                </p>
              )}
              {writeError && (
                <p className="text-destructive" role="alert">
                  {writeError instanceof Error
                    ? writeError.message
                    : String(writeError)}
                </p>
              )}
              {txHash && (
                <p className="mt-2 font-mono text-xs break-all">
                  <a
                    href={`https://testnet.snowtrace.io/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    {txHash}
                  </a>
                  {isConfirming && ' · confirming…'}
                  {txSuccess && ' · confirmed'}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {members && members.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 font-mono text-xs">
                {members.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
