import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LivenessVerification from '../LivenessVerification'

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => ({ tenant: { id: 'test-tenant', name: 'Test Org' } }),
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}))

const renderComponent = () =>
  render(
    <MemoryRouter>
      <LivenessVerification />
    </MemoryRouter>
  )

describe('LivenessVerification', () => {
  it('renders the page title and KPI cards', () => {
    renderComponent()
    expect(screen.getByText('Liveness & Anti-Spoofing')).toBeTruthy()
    expect(screen.getByText('Total Checks')).toBeTruthy()
    expect(screen.getByText('Live (Passed)')).toBeTruthy()
    expect(screen.getByText('Spoof (Blocked)')).toBeTruthy()
    expect(screen.getByText('Avg Confidence')).toBeTruthy()
  })

  it('renders all four tabs', () => {
    renderComponent()
    expect(screen.getByText('Passive Liveness')).toBeTruthy()
    expect(screen.getByText('Active Liveness')).toBeTruthy()
    expect(screen.getByText('Face Match')).toBeTruthy()
    expect(screen.getByText('Audit Log')).toBeTruthy()
  })

  it('shows passive liveness check panel by default', () => {
    renderComponent()
    expect(screen.getByText('Passive Liveness Check')).toBeTruthy()
    expect(screen.getByText('Run Passive Check')).toBeTruthy()
  })

  it('switches to active liveness tab', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Active Liveness'))
    expect(screen.getByText('Active Liveness Check')).toBeTruthy()
    expect(screen.getByText('Start Active Check')).toBeTruthy()
  })

  it('switches to face match tab', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Face Match'))
    expect(screen.getByText('Face Matching (Two Images)')).toBeTruthy()
    expect(screen.getByText('Face Detection')).toBeTruthy()
    expect(screen.getByText('68-Point Landmarks')).toBeTruthy()
    expect(screen.getByText('128-d Feature Extraction')).toBeTruthy()
    expect(screen.getByText('Cosine Similarity')).toBeTruthy()
  })

  it('switches to audit log tab with history', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Audit Log'))
    expect(screen.getByText('Liveness Audit Log')).toBeTruthy()
    expect(screen.getByText('Adebayo Okonkwo')).toBeTruthy()
    expect(screen.getByText('Chinwe Obi')).toBeTruthy()
  })

  it('filters audit log by search', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Audit Log'))
    const search = screen.getByPlaceholderText('Search by user, method, spoof type...')
    fireEvent.change(search, { target: { value: 'deepfake' } })
    expect(screen.queryByText('Adebayo Okonkwo')).toBeNull()
  })

  it('runs passive liveness check simulation', async () => {
    renderComponent()
    const btn = screen.getByText('Run Passive Check')
    fireEvent.click(btn)
    expect(screen.getByText('Analyzing...')).toBeTruthy()
    await waitFor(() => {
      const passed = screen.queryByText(/LIVE — Passed/)
      const failed = screen.queryByText(/SPOOF DETECTED/)
      expect(passed || failed).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('runs active liveness check simulation with challenge', async () => {
    renderComponent()
    fireEvent.click(screen.getByText('Active Liveness'))
    fireEvent.click(screen.getByText('Start Active Check'))
    expect(screen.getByText('Recording...')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Challenge Actions')).toBeTruthy()
    }, { timeout: 1000 })
    await waitFor(() => {
      const passed = screen.queryByText(/LIVE — Passed/)
      const failed = screen.queryByText(/SPOOF DETECTED/)
      expect(passed || failed).toBeTruthy()
    }, { timeout: 6000 })
  })

  it('displays spoof type badges in audit log', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Audit Log'))
    expect(screen.getByText('Printed Photo: 1')).toBeTruthy()
    expect(screen.getByText('Screen Replay: 1')).toBeTruthy()
    expect(screen.getByText('Deepfake: 1')).toBeTruthy()
  })

  it('shows correct KPI counts from seed data', () => {
    renderComponent()
    // 6 total, 3 live, 3 spoof
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('shows empty state when search has no results', () => {
    renderComponent()
    fireEvent.click(screen.getByText('Audit Log'))
    const search = screen.getByPlaceholderText('Search by user, method, spoof type...')
    fireEvent.change(search, { target: { value: 'zzzznonexistent' } })
    expect(screen.getByText('No matching liveness checks found')).toBeTruthy()
  })
})
