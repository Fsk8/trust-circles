'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Create' },
  { href: '/dashboard', label: 'Dashboard' },
] as const

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          Trust Circles
        </Link>
        <div className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active =
              href === '/'
                ? pathname === '/'
                : href === '/dashboard'
                  ? pathname === '/dashboard' ||
                    pathname.startsWith('/circle/')
                  : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
