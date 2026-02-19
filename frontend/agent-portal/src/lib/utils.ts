import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency formatting utilities
export const formatCurrency = (amount: number, currency: string = 'NGN'): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-NG').format(num)
}

// Date formatting utilities
export const formatDate = (date: string | Date, format: 'short' | 'long' | 'time' = 'short'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  switch (format) {
    case 'long':
      return dateObj.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    case 'time':
      return dateObj.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit'
      })
    default:
      return dateObj.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
  }
}

export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
  
  return formatDate(dateObj)
}

// Transaction utilities
export const getTransactionStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'bg-green-100 text-green-800'
    case 'pending':
    case 'processing':
      return 'bg-yellow-100 text-yellow-800'
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-blue-100 text-blue-800'
  }
}

export const getTransactionTypeColor = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'deposit':
    case 'credit':
      return 'text-green-600 bg-green-100'
    case 'withdrawal':
    case 'debit':
      return 'text-red-600 bg-red-100'
    case 'transfer':
      return 'text-blue-600 bg-blue-100'
    case 'commission':
      return 'text-purple-600 bg-purple-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

// Agent utilities
export const getAgentLevelColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'master agent':
      return 'bg-purple-100 text-purple-800'
    case 'super agent':
      return 'bg-blue-100 text-blue-800'
    case 'agent':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getAgentStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'inactive':
      return 'bg-gray-100 text-gray-800'
    case 'suspended':
      return 'bg-red-100 text-red-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Performance utilities
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`
}

export const getPerformanceColor = (percentage: number): string => {
  if (percentage > 0) return 'text-green-600'
  if (percentage < 0) return 'text-red-600'
  return 'text-gray-600'
}

// Validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhoneNumber = (phone: string): boolean => {
  // Nigerian phone number validation
  const phoneRegex = /^(\+234|234|0)?[789][01]\d{8}$/
  return phoneRegex.test(phone.replace(/[\s-]/g, ''))
}

export const validateAmount = (amount: string | number): boolean => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return !isNaN(numAmount) && numAmount > 0
}

// Search and filter utilities
export const searchFilter = <T>(
  items: T[],
  searchTerm: string,
  searchFields: (keyof T)[]
): T[] => {
  if (!searchTerm.trim()) return items
  
  const lowercaseSearch = searchTerm.toLowerCase()
  
  return items.filter(item =>
    searchFields.some(field => {
      const value = item[field]
      if (typeof value === 'string') {
        return value.toLowerCase().includes(lowercaseSearch)
      }
      if (typeof value === 'number') {
        return value.toString().includes(lowercaseSearch)
      }
      return false
    })
  )
}

export const multiFilter = <T>(
  items: T[],
  filters: Record<string, any>
): T[] => {
  return items.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === 'all' || value === '' || value === null || value === undefined) {
        return true
      }
      
      const itemValue = (item as any)[key]
      
      if (Array.isArray(value)) {
        return value.includes(itemValue)
      }
      
      return itemValue === value
    })
  })
}

// Data export utilities
export const exportToCSV = <T>(data: T[], filename: string): void => {
  if (data.length === 0) return
  
  const headers = Object.keys(data[0] as any).join(',')
  const rows = data.map(item => 
    Object.values(item as any).map(value => 
      typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value
    ).join(',')
  )
  
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  
  window.URL.revokeObjectURL(url)
}

export const exportToJSON = <T>(data: T[], filename: string): void => {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.json`
  link.click()
  
  window.URL.revokeObjectURL(url)
}

// Local storage utilities
export const setLocalStorage = (key: string, value: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

export const getLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error('Error reading from localStorage:', error)
    return defaultValue
  }
}

export const removeLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Error removing from localStorage:', error)
  }
}

// Nigerian states and LGAs
export const nigerianStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
]

// Common Nigerian names for demo data
export const nigerianNames = {
  male: [
    'Adebayo', 'Chinedu', 'Emeka', 'Ibrahim', 'Kelechi', 'Olumide', 'Tunde', 'Uche',
    'Yakubu', 'Biodun', 'Chijioke', 'Femi', 'Ikechukwu', 'Jide', 'Kunle', 'Musa',
    'Nneka', 'Obinna', 'Segun', 'Taiwo'
  ],
  female: [
    'Adunni', 'Blessing', 'Chioma', 'Fatima', 'Hauwa', 'Kemi', 'Ngozi', 'Omotola',
    'Patience', 'Rashida', 'Stella', 'Titilayo', 'Uzoamaka', 'Victoria', 'Yetunde',
    'Zainab', 'Amina', 'Bukola', 'Damilola', 'Folake'
  ]
}

// Generate random Nigerian name
export const generateNigerianName = (gender?: 'male' | 'female'): string => {
  const genderToUse = gender || (Math.random() > 0.5 ? 'male' : 'female')
  const firstNames = nigerianNames[genderToUse]
  const lastNames = [...nigerianNames.male, ...nigerianNames.female]
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  
  return `${firstName} ${lastName}`
}

// Generate random Nigerian phone number
export const generateNigerianPhone = (): string => {
  const prefixes = ['803', '806', '809', '810', '813', '814', '816', '818', '703', '706', '708', '709']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const suffix = Math.floor(Math.random() * 10000000).toString().padStart(7, '0')
  return `+234-${prefix}-${suffix.slice(0, 3)}-${suffix.slice(3)}`
}

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

