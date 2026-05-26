import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light')
  const [systemTheme, setSystemTheme] = useState('light')

  useEffect(() => {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme')
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    
    setSystemTheme(systemPreference)
    
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      setTheme(systemPreference)
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      const newSystemTheme = e.matches ? 'dark' : 'light'
      setSystemTheme(newSystemTheme)
      
      // If user hasn't set a preference, follow system
      if (!localStorage.getItem('theme')) {
        setTheme(newSystemTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement
    
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const setLightTheme = () => {
    setTheme('light')
    localStorage.setItem('theme', 'light')
  }

  const setDarkTheme = () => {
    setTheme('dark')
    localStorage.setItem('theme', 'dark')
  }

  const setSystemThemePreference = () => {
    setTheme(systemTheme)
    localStorage.removeItem('theme')
  }

  const value = {
    theme,
    systemTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setSystemThemePreference,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

