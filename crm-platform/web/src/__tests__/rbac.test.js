import { describe, it, expect } from 'vitest'

const PERMISSIONS = [
  'customers:read', 'customers:write',
  'analytics:read', 'analytics:write',
  'campaigns:read', 'campaigns:write',
  'compliance:read', 'compliance:write',
  'banking:read', 'banking:write',
  'operations:read', 'operations:write',
  'security:read', 'security:write',
  'audit:read', 'audit:write',
  'admin:full',
]

const ROLES = {
  admin: PERMISSIONS,
  manager: ['customers:read', 'customers:write', 'analytics:read', 'campaigns:read', 'campaigns:write', 'compliance:read'],
  analyst: ['analytics:read', 'customers:read'],
  agent: ['customers:read', 'customers:write', 'campaigns:read'],
  viewer: ['customers:read', 'analytics:read'],
}

function hasPermission(role, permission) {
  return ROLES[role]?.includes(permission) || ROLES[role]?.includes('admin:full')
}

describe('RBAC Permission System', () => {
  it('admin has all permissions', () => {
    PERMISSIONS.forEach(perm => {
      expect(hasPermission('admin', perm)).toBe(true)
    })
  })

  it('manager cannot access security dashboard', () => {
    expect(hasPermission('manager', 'security:read')).toBe(false)
    expect(hasPermission('manager', 'security:write')).toBe(false)
  })

  it('analyst has read-only access', () => {
    expect(hasPermission('analyst', 'analytics:read')).toBe(true)
    expect(hasPermission('analyst', 'analytics:write')).toBe(false)
    expect(hasPermission('analyst', 'customers:read')).toBe(true)
    expect(hasPermission('analyst', 'customers:write')).toBe(false)
  })

  it('agent can read and write customers', () => {
    expect(hasPermission('agent', 'customers:read')).toBe(true)
    expect(hasPermission('agent', 'customers:write')).toBe(true)
  })

  it('agent cannot access admin features', () => {
    expect(hasPermission('agent', 'admin:full')).toBe(false)
  })

  it('viewer has minimal read access', () => {
    expect(hasPermission('viewer', 'customers:read')).toBe(true)
    expect(hasPermission('viewer', 'analytics:read')).toBe(true)
    expect(hasPermission('viewer', 'campaigns:read')).toBe(false)
    expect(hasPermission('viewer', 'admin:full')).toBe(false)
  })

  it('undefined role has no permissions', () => {
    expect(hasPermission('nonexistent', 'customers:read')).toBeFalsy()
    expect(hasPermission(undefined, 'admin:full')).toBeFalsy()
  })

  it('all defined roles exist and have at least one permission', () => {
    Object.entries(ROLES).forEach(([role, perms]) => {
      expect(perms.length).toBeGreaterThan(0)
      expect(typeof role).toBe('string')
    })
  })
})
