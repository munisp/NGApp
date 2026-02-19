import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Package, Search, Filter, Download, Plus, Edit, Trash2, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function ProductManagement() {
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showVariantsModal, setShowVariantsModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('products')
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    lowStockItems: 0,
    totalVariants: 0
  })

  // Fetch products on mount
  useEffect(() => {
    fetchProducts()
    fetchStats()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/ecommerce/products')
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/ecommerce/analytics/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleAddProduct = async (productData) => {
    try {
      const response = await fetch('/api/ecommerce/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      })
      const newProduct = await response.json()
      setProducts([...products, newProduct])
      setShowAddModal(false)
      fetchStats()
    } catch (error) {
      console.error('Error adding product:', error)
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await fetch(`/api/ecommerce/products/${productId}`, { method: 'DELETE' })
        setProducts(products.filter(p => p.id !== productId))
        fetchStats()
      } catch (error) {
        console.error('Error deleting product:', error)
      }
    }
  }

  const getStockStatus = (stock) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'destructive', icon: XCircle }
    if (stock < 10) return { label: 'Low Stock', color: 'warning', icon: AlertTriangle }
    return { label: 'In Stock', color: 'success', icon: CheckCircle }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Product Management</h1>
          <p className="text-muted-foreground">Manage your product catalog and inventory</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add New Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVariants}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products">
            <Package className="w-4 h-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products by name, SKU, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.filter(p => 
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.sku.toLowerCase().includes(searchTerm.toLowerCase())
            ).map(product => {
              const status = getStockStatus(product.stock)
              const StatusIcon = status.icon
              
              return (
                <Card key={product.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{product.name}</CardTitle>
                        <CardDescription>SKU: {product.sku}</CardDescription>
                      </div>
                      <Badge variant={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold">${product.price}</span>
                      <span className="text-sm text-muted-foreground">Stock: {product.stock}</span>
                    </div>
                    {product.variantCount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {product.variantCount} variants available
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedProduct(product)
                          setShowVariantsModal(true)
                        }}
                      >
                        Variants
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Inventory Management</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.flatMap(product => 
                    product.variants?.map(variant => {
                      const status = getStockStatus(variant.stock)
                      const StatusIcon = status.icon
                      
                      return (
                        <TableRow key={variant.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{variant.sku}</TableCell>
                          <TableCell>{variant.attributes.join(', ')}</TableCell>
                          <TableCell>{variant.stock}</TableCell>
                          <TableCell>
                            <Badge variant={status.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>${variant.price}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">Update</Button>
                          </TableCell>
                        </TableRow>
                      )
                    }) || []
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$12,450</div>
                <p className="text-xs text-muted-foreground">+20.1% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">87</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$143.10</div>
                <p className="text-xs text-muted-foreground">+5.2% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3.2%</div>
                <p className="text-xs text-muted-foreground">+0.5% from last month</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Product Modal */}
      <AddProductModal 
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddProduct}
      />

      {/* Variants Modal */}
      <VariantsModal
        open={showVariantsModal}
        onClose={() => setShowVariantsModal(false)}
        product={selectedProduct}
      />
    </div>
  )
}

// Add Product Modal Component
function AddProductModal({ open, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    category: '',
    stock: '',
    weight: '',
    sizes: '',
    colors: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
    setFormData({
      name: '',
      sku: '',
      description: '',
      price: '',
      category: '',
      stock: '',
      weight: '',
      sizes: '',
      colors: ''
    })
  }

  const generateVariantPreview = () => {
    if (!formData.sizes || !formData.colors) return []
    const sizes = formData.sizes.split(',').map(s => s.trim())
    const colors = formData.colors.split(',').map(c => c.trim())
    return sizes.flatMap(size => colors.map(color => `${size} - ${color}`))
  }

  const variantPreview = generateVariantPreview()

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>Create a new product with variants</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({...formData, sku: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="home">Home & Garden</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Quantity *</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({...formData, stock: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                value={formData.weight}
                onChange={(e) => setFormData({...formData, weight: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Product Variants</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Sizes (e.g., S, M, L, XL)"
                value={formData.sizes}
                onChange={(e) => setFormData({...formData, sizes: e.target.value})}
              />
              <Input
                placeholder="Colors (e.g., Red, Blue, Green)"
                value={formData.colors}
                onChange={(e) => setFormData({...formData, colors: e.target.value})}
              />
            </div>
            {variantPreview.length > 0 && (
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-2">
                  Preview: This will generate {variantPreview.length} variants
                </p>
                <div className="flex flex-wrap gap-2">
                  {variantPreview.slice(0, 8).map((variant, i) => (
                    <Badge key={i} variant="secondary">{variant}</Badge>
                  ))}
                  {variantPreview.length > 8 && (
                    <Badge variant="secondary">+{variantPreview.length - 8} more</Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save Product</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Variants Modal Component
function VariantsModal({ open, onClose, product }) {
  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Variants - {product.name}</DialogTitle>
          <DialogDescription>Manage individual variants with specific pricing and inventory</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {product.variants?.map(variant => (
              <TableRow key={variant.id}>
                <TableCell>{variant.attributes.join(' - ')}</TableCell>
                <TableCell>{variant.sku}</TableCell>
                <TableCell>
                  <Input type="number" step="0.01" defaultValue={variant.price} className="w-24" />
                </TableCell>
                <TableCell>
                  <Input type="number" defaultValue={variant.stock} className="w-20" />
                </TableCell>
                <TableCell>
                  <Badge variant={variant.stock > 0 ? 'success' : 'destructive'}>
                    {variant.stock > 0 ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">Save</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button>Save All Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
