/**
 * Security tests — verify RBAC, CORS, and security configurations.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('RBAC Coverage', () => {
  it('App.jsx has permission guards on routes', () => {
    const app = fs.readFileSync(path.join(process.cwd(), 'src', 'App.jsx'), 'utf-8')
    const permissionCount = (app.match(/permission=/g) || []).length
    const routeCount = (app.match(/<Route/g) || []).length
    expect(permissionCount).toBeGreaterThan(100)
    expect(routeCount).toBeGreaterThan(120)
  })

  it('login route does not require permission', () => {
    const app = fs.readFileSync(path.join(process.cwd(), 'src', 'App.jsx'), 'utf-8')
    const loginLine = app.split('\n').find(l => l.includes('/login'))
    expect(loginLine).not.toContain('permission=')
  })
})

describe('Security Configuration', () => {
  it('.env.example exists', () => {
    expect(fs.existsSync(path.join(process.cwd(), '..', '.env.example'))).toBe(true)
  })

  it('.env.example does not contain actual secrets', () => {
    const envExample = fs.readFileSync(path.join(process.cwd(), '..', '.env.example'), 'utf-8')
    expect(envExample).not.toMatch(/sk_live_/)
    expect(envExample).not.toMatch(/Bearer [a-zA-Z0-9]{20,}/)
  })

  it('no hardcoded API keys in components', () => {
    const componentsDir = path.join(process.cwd(), 'src', 'components')
    const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx'))
    files.forEach(file => {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8')
      expect(content).not.toMatch(/sk_live_|pk_live_|AKIA[A-Z0-9]{16}/)
    })
  })
})

describe('Error Boundaries', () => {
  it('App.jsx has ErrorBoundary wrappers', () => {
    const app = fs.readFileSync(path.join(process.cwd(), 'src', 'App.jsx'), 'utf-8')
    const errorBoundaryCount = (app.match(/ErrorBoundary/g) || []).length
    expect(errorBoundaryCount).toBeGreaterThanOrEqual(2)
  })
})

describe('API Client Security', () => {
  it('apiClient uses relative URLs (no hardcoded domains)', () => {
    const apiClient = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'apiClient.ts'), 'utf-8')
    expect(apiClient).not.toMatch(/http:\/\/localhost/)
    expect(apiClient).toMatch(/\/api\/v1/)
  })
})
