import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Truck,
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  PieChart,
  Download,
  Upload,
  RefreshCw,
  ShoppingCart,
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Building,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const InventoryManagement = () => {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('inventorymanagement', () => apiClient.dashboard.metrics(), { fallback: [] })
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  // Mock data
  const [inventoryMetrics, setInventoryMetrics] = useState({
    totalProducts: 1247,
    totalValue: 2847392,
    lowStockItems: 23,
    outOfStockItems: 8,
    totalSuppliers: 45,
    totalWarehouses: 6
  })

  const [products, setProducts] = useState([
    {
      id: 1,
      name: 'Enterprise Software License',
      sku: 'ESL-001',
      category: 'Software',
      brand: 'TechCorp',
      description: 'Complete enterprise software solution',
      price: 1299.99,
      cost: 899.99,
      quantity: 150,
      minStock: 20,
      maxStock: 500,
      status: 'Active',
      supplier: 'TechCorp Inc',
      warehouse: 'Main Warehouse',
      lastUpdated: '2024-01-15',
      image: null,
      tags: ['software', 'enterprise', 'license']
    },
    {
      id: 2,
      name: 'Professional Services Package',
      sku: 'PSP-002',
      category: 'Services',
      brand: 'ServicePro',
      description: 'Professional consulting and implementation services',
      price: 2499.99,
      cost: 1799.99,
      quantity: 8,
      minStock: 5,
      maxStock: 50,
      status: 'Low Stock',
      supplier: 'ServicePro Ltd',
      warehouse: 'Service Center',
      lastUpdated: '2024-01-14',
      image: null,
      tags: ['services', 'consulting', 'implementation']
    },
    {
      id: 3,
      name: 'Hardware Support Kit',
      sku: 'HSK-003',
      category: 'Hardware',
      brand: 'HardwarePlus',
      description: 'Complete hardware support and maintenance kit',
      price: 599.99,
      cost: 399.99,
      quantity: 0,
      minStock: 10,
      maxStock: 100,
      status: 'Out of Stock',
      supplier: 'HardwarePlus Corp',
      warehouse: 'Hardware Depot',
      lastUpdated: '2024-01-13',
      image: null,
      tags: ['hardware', 'support', 'maintenance']
    }
  ])

  const [suppliers, setSuppliers] = useState([
    {
      id: 1,
      name: 'TechCorp Inc',
      contactPerson: 'John Smith',
      email: 'john.smith@techcorp.com',
      phone: '+1 (555) 123-4567',
      address: '123 Tech Street, Silicon Valley, CA 94105',
      status: 'Active',
      rating: 4.8,
      productsSupplied: 45,
      totalOrders: 156,
      totalValue: 1250000,
      paymentTerms: 'Net 30',
      leadTime: '5-7 days',
      lastOrder: '2024-01-15'
    },
    {
      id: 2,
      name: 'ServicePro Ltd',
      contactPerson: 'Sarah Johnson',
      email: 'sarah.j@servicepro.com',
      phone: '+1 (555) 987-6543',
      address: '456 Service Ave, Business District, NY 10001',
      status: 'Active',
      rating: 4.6,
      productsSupplied: 23,
      totalOrders: 89,
      totalValue: 890000,
      paymentTerms: 'Net 15',
      leadTime: '3-5 days',
      lastOrder: '2024-01-12'
    }
  ])

  const [warehouses, setWarehouses] = useState([
    {
      id: 1,
      name: 'Main Warehouse',
      location: 'San Francisco, CA',
      capacity: 10000,
      used: 7500,
      available: 2500,
      status: 'Active',
      manager: 'Mike Wilson',
      products: 450
    },
    {
      id: 2,
      name: 'Service Center',
      location: 'Austin, TX',
      capacity: 5000,
      used: 3200,
      available: 1800,
      status: 'Active',
      manager: 'Lisa Chen',
      products: 180
    }
  ])

  const [stockMovements, setStockMovements] = useState([
    {
      id: 1,
      product: 'Enterprise Software License',
      type: 'In',
      quantity: 50,
      date: '2024-01-15',
      reason: 'Purchase Order',
      reference: 'PO-2024-001',
      warehouse: 'Main Warehouse'
    },
    {
      id: 2,
      product: 'Professional Services Package',
      type: 'Out',
      quantity: 5,
      date: '2024-01-14',
      reason: 'Sale',
      reference: 'SO-2024-045',
      warehouse: 'Service Center'
    }
  ])

  const [inventoryTrends, setInventoryTrends] = useState([
    { month: 'Jan', inbound: 1200, outbound: 800, value: 2400000 },
    { month: 'Feb', inbound: 1400, outbound: 950, value: 2600000 },
    { month: 'Mar', inbound: 1100, outbound: 1200, value: 2200000 },
    { month: 'Apr', inbound: 1600, outbound: 1100, value: 2800000 },
    { month: 'May', inbound: 1300, outbound: 1300, value: 2500000 },
    { month: 'Jun', inbound: 1500, outbound: 1000, value: 2900000 }
  ])

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'low stock': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'out of stock': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getStockLevel = (product) => {
    if (product.quantity === 0) return 'Out of Stock'
    if (product.quantity <= product.minStock) return 'Low Stock'
    if (product.quantity >= product.maxStock * 0.9) return 'Overstocked'
    return 'Normal'
  }

  const getStockLevelColor = (level) => {
    switch (level) {
      case 'Out of Stock': return 'text-red-600 dark:text-red-400'
      case 'Low Stock': return 'text-yellow-600 dark:text-yellow-400'
      case 'Overstocked': return 'text-orange-600 dark:text-orange-400'
      case 'Normal': return 'text-green-600 dark:text-green-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const MetricCard = ({ title, value, trend, icon: Icon, format = 'number' }) => {
    const formatValue = (val) => {
      if (format === 'currency') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(val)
      }
      return new Intl.NumberFormat('en-US').format(val)
    }

    const isPositive = trend > 0
    const TrendIcon = isPositive ? TrendingUp : TrendingDown

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        tabIndex="0" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {formatValue(value)}
            </p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
            <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center mt-4">
            <TrendIcon className={`h-4 w-4 ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`} />
            <span className={`text-sm font-medium ml-1 ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {Math.abs(trend)}%
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">vs last month</span>
          </div>
        )}
      </motion.div>
    )
  }

  const ProductCard = ({ product }) => {
    const stockLevel = getStockLevel(product)
    const stockPercentage = (product.quantity / product.maxStock) * 100

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{product.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {product.sku}</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
            {product.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Price</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              ${product.price.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Stock</p>
            <p className={`font-semibold ${getStockLevelColor(stockLevel)}`}>
              {product.quantity} units
            </p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">Stock Level</span>
            <span className={`font-medium ${getStockLevelColor(stockLevel)}`}>
              {stockLevel}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                stockLevel === 'Out of Stock' ? 'bg-red-500' :
                stockLevel === 'Low Stock' ? 'bg-yellow-500' :
                stockLevel === 'Overstocked' ? 'bg-orange-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span>{product.category}</span> • <span>{product.warehouse}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                setSelectedProduct(product)
                setShowProductModal(true)
              }}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
              <Edit className="h-4 w-4" />
            </button>
            <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  const SupplierCard = ({ supplier }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Building className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{supplier.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{supplier.contactPerson}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {supplier.rating}
          </span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <Mail className="h-4 w-4" />
          <span>{supplier.email}</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <Phone className="h-4 w-4" />
          <span>{supplier.phone}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Products</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {supplier.productsSupplied}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            ${supplier.totalValue.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(supplier.status)}`}>
          {supplier.status}
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setSelectedSupplier(supplier)
              setShowSupplierModal(true)
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
            <Edit className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )

  if (loading) {
    return (
      <div role="region" aria-label="InventoryManagement"  className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Inventory Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your products, suppliers, and warehouse operations
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Import</span>
          </button>
          <button className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Products"
          value={inventoryMetrics.totalProducts}
          trend={8.5}
          icon={Package}
        />
        <MetricCard
          title="Inventory Value"
          value={inventoryMetrics.totalValue}
          trend={12.3}
          icon={DollarSign}
          format="currency"
        />
        <MetricCard
          title="Low Stock Items"
          value={inventoryMetrics.lowStockItems}
          trend={-15.2}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Total Suppliers"
          value={inventoryMetrics.totalSuppliers}
          trend={5.7}
          icon={Truck}
        />
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'products', label: 'Products', icon: Package },
              { id: 'suppliers', label: 'Suppliers', icon: Truck },
              { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
              { id: 'movements', label: 'Stock Movements', icon: TrendingUp }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Inventory Trends
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={inventoryTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis dataKey="month" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#F9FAFB'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="inbound"
                        stackId="1"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="outbound"
                        stackId="1"
                        stroke="#EF4444"
                        fill="#EF4444"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Stock Status Distribution
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Normal Stock', value: 85, color: '#10B981' },
                          { name: 'Low Stock', value: 12, color: '#F59E0B' },
                          { name: 'Out of Stock', value: 3, color: '#EF4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {[
                          { name: 'Normal Stock', value: 85, color: '#10B981' },
                          { name: 'Low Stock', value: 12, color: '#F59E0B' },
                          { name: 'Out of Stock', value: 3, color: '#EF4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {warehouses.map(warehouse => (
                  <motion.div
                    key={warehouse.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {warehouse.name}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(warehouse.status)}`}>
                        {warehouse.status}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Capacity</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {warehouse.used.toLocaleString()} / {warehouse.capacity.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(warehouse.used / warehouse.capacity) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Products</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {warehouse.products}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Product Catalog
                </h3>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Supplier Management
                </h3>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Supplier</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suppliers.map(supplier => (
                  <SupplierCard key={supplier.id} supplier={supplier} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Stock Movements
                </h3>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Record Movement</span>
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {stockMovements.map(movement => (
                        <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {movement.product}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {movement.warehouse}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              movement.type === 'In' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                            }`}>
                              {movement.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                            {movement.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                            {new Date(movement.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                            {movement.reason}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                            {movement.reference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InventoryManagement

