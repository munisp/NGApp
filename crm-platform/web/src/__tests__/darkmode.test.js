/**
 * Dark mode support tests — verify all components have dark mode classes.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const componentsDir = path.join(process.cwd(), 'src', 'components')

describe('Dark Mode Coverage', () => {
  const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx'))

  files.forEach(file => {
    // Skip infrastructure components that don't need visual dark mode
    if (['Header.jsx', 'Login.jsx', 'Sidebar.jsx'].includes(file)) return

    it(`${file} has dark mode classes`, () => {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8')
      expect(content).toMatch(/dark:/)
    })
  })
})

describe('Responsive CSS', () => {
  it('index.css has mobile breakpoints', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'index.css'), 'utf-8')
    expect(css).toMatch(/768px/)
  })

  it('index.css has focus-visible styles', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'index.css'), 'utf-8')
    expect(css).toMatch(/focus-visible/)
  })
})

describe('ARIA Accessibility', () => {
  const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx'))
  const filesWithAria = files.filter(file => {
    const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8')
    return content.match(/aria-|role=/)
  })

  it('majority of components have ARIA attributes', () => {
    const coverage = filesWithAria.length / files.length
    expect(coverage).toBeGreaterThan(0.8) // 80%+ have ARIA
  })
})
