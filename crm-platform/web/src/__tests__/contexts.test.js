/**
 * Context tests — verify context modules export correctly.
 */
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

describe('TenantContext exports', () => {
  it('exports TenantProvider', async () => {
    const mod = await import('@/contexts/TenantContext')
    expect(mod.TenantProvider).toBeDefined()
  })

  it('exports useTenant', async () => {
    const mod = await import('@/contexts/TenantContext')
    expect(mod.useTenant).toBeDefined()
    expect(typeof mod.useTenant).toBe('function')
  })

  it('exports TenantContext', async () => {
    const mod = await import('@/contexts/TenantContext')
    expect(mod.TenantContext || mod.default).toBeDefined()
  })
})

describe('AuthContext exports', () => {
  it('exports AuthProvider', async () => {
    const mod = await import('@/contexts/AuthContext')
    expect(mod.AuthProvider).toBeDefined()
  })

  it('exports useAuth', async () => {
    const mod = await import('@/contexts/AuthContext')
    expect(mod.useAuth).toBeDefined()
    expect(typeof mod.useAuth).toBe('function')
  })
})

describe('ThemeContext exports', () => {
  it('exports ThemeProvider', async () => {
    const mod = await import('@/contexts/ThemeContext')
    expect(mod.ThemeProvider).toBeDefined()
  })

  it('exports useTheme', async () => {
    const mod = await import('@/contexts/ThemeContext')
    expect(mod.useTheme).toBeDefined()
    expect(typeof mod.useTheme).toBe('function')
  })
})

describe('NotificationContext exports', () => {
  it('exports NotificationProvider', async () => {
    const mod = await import('@/contexts/NotificationContext')
    expect(mod.NotificationProvider).toBeDefined()
  })
})

describe('I18n exports', () => {
  it('exports I18nProvider', async () => {
    const mod = await import('@/lib/i18n/useTranslation')
    expect(mod.I18nProvider).toBeDefined()
  })

  it('exports useTranslation', async () => {
    const mod = await import('@/lib/i18n/useTranslation')
    expect(mod.useTranslation).toBeDefined()
    expect(typeof mod.useTranslation).toBe('function')
  })
})

describe('UI utilities', () => {
  it('ErrorBoundary exports', async () => {
    const mod = await import('@/components/ui/ErrorBoundary')
    expect(mod.ErrorBoundary).toBeDefined()
  })

  it('Toast exports', async () => {
    const mod = await import('@/components/ui/Toast')
    expect(mod.ToastProvider).toBeDefined()
  })

  it('LoadingSpinner exports', async () => {
    const mod = await import('@/components/ui/LoadingSpinner')
    expect(mod.LoadingSpinner).toBeDefined()
  })

  it('DataStates exports', async () => {
    const mod = await import('@/components/ui/DataStates')
    expect(mod.LoadingState).toBeDefined()
    expect(mod.ErrorState).toBeDefined()
    expect(mod.EmptyState).toBeDefined()
  })
})
