import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { 
  ShoppingCart, Heart, Search, Star, StarHalf, Filter, 
  ChevronRight, Package, Truck, Shield, MessageCircle,
  Menu, X, Phone, Mail, MapPin, Facebook, Instagram, Twitter,
  TrendingUp, Zap, Gift, Tag, User, CreditCard, Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './App.css'

// Mock data - In production, this would come from the API
const mockStore = {
  id: "store-1",
  name: "Mama Ada's General Store",
  description: "Quality products for everyday needs",
  logo: "https://via.placeholder.com/150",
  banner: "https://via.placeholder.com/1200x400",
  phone: "+234 803 123 4567",
  email: "mama.ada@example.com",
  address: "123 Market Street, Lagos, Nigeria",
  theme: {
    primary_color: "#667eea",
    secondary_color: "#764ba2"
  }
}

const mockProducts = [
  {
    id: "1",
    name: "Premium Rice (50kg)",
    description: "High-quality imported rice, perfect for families",
    base_price: 45000,
    currency: "NGN",
    category: "Food & Groceries",
    images: ["https://via.placeholder.com/400"],
    rating: 4.5,
    reviews_count: 128,
    stock: 45,
    is_featured: true
  },
  {
    id: "2",
    name: "Cooking Oil (5L)",
    description: "Pure vegetable oil for healthy cooking",
    base_price: 8500,
    currency: "NGN",
    category: "Food & Groceries",
    images: ["https://via.placeholder.com/400"],
    rating: 4.8,
    reviews_count: 89,
    stock: 120,
    is_featured: true
  },
  {
    id: "3",
    name: "Detergent Powder (2kg)",
    description: "Powerful cleaning for all fabrics",
    base_price: 3200,
    currency: "NGN",
    category: "Household",
    images: ["https://via.placeholder.com/400"],
    rating: 4.3,
    reviews_count: 56,
    stock: 78
  },
  {
    id: "4",
    name: "Tomato Paste (70g x 50)",
    description: "Rich tomato paste for delicious meals",
    base_price: 12000,
    currency: "NGN",
    category: "Food & Groceries",
    images: ["https://via.placeholder.com/400"],
    rating: 4.6,
    reviews_count: 92,
    stock: 34
  },
  {
    id: "5",
    name: "Bathing Soap (Pack of 12)",
    description: "Gentle soap for the whole family",
    base_price: 2400,
    currency: "NGN",
    category: "Personal Care",
    images: ["https://via.placeholder.com/400"],
    rating: 4.4,
    reviews_count: 67,
    stock: 156
  },
  {
    id: "6",
    name: "Sugar (2kg)",
    description: "Pure white sugar for sweetening",
    base_price: 1800,
    currency: "NGN",
    category: "Food & Groceries",
    images: ["https://via.placeholder.com/400"],
    rating: 4.7,
    reviews_count: 43,
    stock: 89
  }
]

const mockCampaigns = [
  {
    id: "1",
    campaign_name: "Weekend Flash Sale",
    discount_type: "percentage",
    discount_value: 15,
    coupon_code: "WEEKEND15"
  },
  {
    id: "2",
    campaign_name: "Free Delivery",
    campaign_type: "free_shipping",
    coupon_code: "FREESHIP"
  }
]

// Format currency
const formatCurrency = (amount, currency = "NGN") => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency
  }).format(amount)
}

// Star rating component
const StarRating = ({ rating }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 !== 0
  
  return (
    <div className="flex items-center gap-1">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalfStar && <StarHalf className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
      {[...Array(5 - Math.ceil(rating))].map((_, i) => (
        <Star key={i + fullStars} className="w-4 h-4 text-gray-300" />
      ))}
      <span className="text-sm text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

// Product card component
const ProductCard = ({ product, onAddToCart, onAddToWishlist }) => {
  const [isHovered, setIsHovered] = useState(false)
  const navigate = useNavigate()
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className="overflow-hidden cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative overflow-hidden aspect-square">
          <img 
            src={product.images[0]} 
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onClick={() => navigate(`/product/${product.id}`)}
          />
          {product.is_featured && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500">
              <Zap className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          )}
          {product.stock < 10 && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              Only {product.stock} left
            </Badge>
          )}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2"
              >
                <Button 
                  size="icon" 
                  variant="secondary"
                  className="rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddToWishlist(product)
                  }}
                >
                  <Heart className="w-4 h-4" />
                </Button>
                <Button 
                  size="icon"
                  className="rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/product/${product.id}`)
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2" onClick={() => navigate(`/product/${product.id}`)}>
              {product.name}
            </CardTitle>
          </div>
          <CardDescription className="line-clamp-2">{product.description}</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <StarRating rating={product.rating} />
          <p className="text-xs text-muted-foreground mt-1">{product.reviews_count} reviews</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{formatCurrency(product.base_price)}</p>
          </div>
          <Button 
            size="sm"
            onClick={() => onAddToCart(product)}
            className="gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Add
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

// Header component
const Header = ({ cartCount, onOpenCart }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{mockStore.name}</h1>
              <p className="text-xs text-muted-foreground">Quality & Trust</p>
            </div>
          </Link>
          
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search products..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="hidden md:flex">
              <Heart className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="relative" onClick={onOpenCart}>
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs">
                  {cartCount}
                </Badge>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden pb-4"
            >
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search products..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

// Hero section
const HeroSection = () => {
  return (
    <div className="relative h-[400px] overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500">
      <div className="absolute inset-0 bg-black/20" />
      <div className="container mx-auto px-4 h-full flex items-center relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl text-white"
        >
          <Badge className="mb-4 bg-white/20 backdrop-blur">
            <Gift className="w-3 h-3 mr-1" />
            Special Offers Available
          </Badge>
          <h1 className="text-5xl font-bold mb-4">
            Welcome to {mockStore.name}
          </h1>
          <p className="text-xl mb-6 text-white/90">
            {mockStore.description}. Shop with confidence and get the best deals!
          </p>
          <div className="flex gap-4">
            <Button size="lg" variant="secondary" className="gap-2">
              <ShoppingCart className="w-5 h-5" />
              Start Shopping
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-white/10 backdrop-blur border-white/30 text-white hover:bg-white/20">
              <MessageCircle className="w-5 h-5" />
              Chat on WhatsApp
            </Button>
          </div>
        </motion.div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}

// Features section
const FeaturesSection = () => {
  const features = [
    { icon: Truck, title: "Fast Delivery", description: "Same-day delivery available" },
    { icon: Shield, title: "Secure Payment", description: "100% secure transactions" },
    { icon: Package, title: "Quality Products", description: "Verified and authentic" },
    { icon: MessageCircle, title: "24/7 Support", description: "Always here to help" }
  ]
  
  return (
    <div className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Home page
const HomePage = ({ onAddToCart, onAddToWishlist }) => {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const categories = ['all', 'Food & Groceries', 'Household', 'Personal Care']
  
  const filteredProducts = selectedCategory === 'all' 
    ? mockProducts 
    : mockProducts.filter(p => p.category === selectedCategory)
  
  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      
      {/* Active campaigns */}
      {mockCampaigns.length > 0 && (
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-4">
            {mockCampaigns.map(campaign => (
              <Card key={campaign.id} className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-none">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    <CardTitle>{campaign.campaign_name}</CardTitle>
                  </div>
                  <CardDescription className="text-white/90">
                    Use code: <strong className="text-white">{campaign.coupon_code}</strong>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Products section */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Featured Products</h2>
            <p className="text-muted-foreground">Discover our best-selling items</p>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard 
              key={product.id} 
              product={product}
              onAddToCart={onAddToCart}
              onAddToWishlist={onAddToWishlist}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Product detail page
const ProductDetailPage = ({ onAddToCart }) => {
  const { id } = useParams()
  const product = mockProducts.find(p => p.id === id)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  
  if (!product) {
    return <div className="container mx-auto px-4 py-12 text-center">Product not found</div>
  }
  
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-muted">
            <img 
              src={product.images[selectedImage]} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 ${
                    selectedImage === idx ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <div className="mb-4">
            <Badge className="mb-2">{product.category}</Badge>
            <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
            <div className="flex items-center gap-4 mb-4">
              <StarRating rating={product.rating} />
              <span className="text-muted-foreground">({product.reviews_count} reviews)</span>
            </div>
          </div>
          
          <div className="mb-6">
            <p className="text-4xl font-bold mb-2">{formatCurrency(product.base_price)}</p>
            <p className="text-muted-foreground">{product.description}</p>
          </div>
          
          <div className="mb-6">
            <p className="text-sm font-medium mb-2">Availability:</p>
            <Badge variant={product.stock > 10 ? "default" : "destructive"}>
              {product.stock > 10 ? `In Stock (${product.stock} available)` : `Only ${product.stock} left`}
            </Badge>
          </div>
          
          <div className="mb-6">
            <p className="text-sm font-medium mb-2">Quantity:</p>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
              >
                +
              </Button>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button 
              size="lg" 
              className="flex-1 gap-2"
              onClick={() => {
                onAddToCart({ ...product, quantity })
              }}
            >
              <ShoppingCart className="w-5 h-5" />
              Add to Cart
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              <MessageCircle className="w-5 h-5" />
              Order via WhatsApp
            </Button>
          </div>
          
          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium">Free Delivery</p>
                <p className="text-sm text-muted-foreground">On orders above ₦10,000</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-muted-foreground mt-1" />
              <div>
                <p className="font-medium">Secure Payment</p>
                <p className="text-sm text-muted-foreground">100% secure transactions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Checkout page
const CheckoutPage = ({ cart, onUpdateCart, onClearCart }) => {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    paymentMethod: 'qr_code'
  })
  const [orderPlaced, setOrderPlaced] = useState(false)
  
  const subtotal = cart.reduce((sum, item) => sum + (item.base_price * item.quantity), 0)
  const deliveryFee = subtotal > 10000 ? 0 : 1500
  const total = subtotal + deliveryFee
  
  const handleSubmit = (e) => {
    e.preventDefault()
    if (step < 3) {
      setStep(step + 1)
    } else {
      // Place order
      setOrderPlaced(true)
      setTimeout(() => {
        onClearCart()
      }, 3000)
    }
  }
  
  if (orderPlaced) {
    return (
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="max-w-md mx-auto text-center"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Order Placed Successfully!</h2>
          <p className="text-muted-foreground mb-6">
            Thank you for your order. We'll send you a confirmation via WhatsApp shortly.
          </p>
          <Button asChild>
            <Link to="/">Continue Shopping</Link>
          </Button>
        </motion.div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>
      
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Tabs value={`step${step}`} className="mb-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="step1" disabled={step !== 1}>1. Contact</TabsTrigger>
              <TabsTrigger value="step2" disabled={step !== 2}>2. Delivery</TabsTrigger>
              <TabsTrigger value="step3" disabled={step !== 3}>3. Payment</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Full Name</label>
                    <Input 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone Number</label>
                    <Input 
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email (Optional)</label>
                    <Input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">Continue to Delivery</Button>
                </CardFooter>
              </Card>
            )}
            
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Delivery Address</label>
                    <Textarea 
                      required
                      rows={4}
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="Enter your full delivery address"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button type="submit" className="flex-1">Continue to Payment</Button>
                </CardFooter>
              </Card>
            )}
            
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({...formData, paymentMethod: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qr_code">QR Code Payment</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="cash_on_delivery">Cash on Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {formData.paymentMethod === 'qr_code' && (
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-sm mb-2">Scan QR code to pay</p>
                      <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">QR Code</p>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" className="flex-1">Place Order</Button>
                </CardFooter>
              </Card>
            )}
          </form>
        </div>
        
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex gap-3">
                  <img src={item.images[0]} alt={item.name} className="w-16 h-16 object-cover rounded" />
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(item.base_price * item.quantity)}</p>
                </div>
              ))}
              
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee</span>
                  <span>{deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Footer
const Footer = () => {
  return (
    <footer className="bg-muted/50 border-t mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold mb-4">{mockStore.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{mockStore.description}</p>
            <div className="flex gap-3">
              <Button size="icon" variant="outline" className="rounded-full">
                <Facebook className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" className="rounded-full">
                <Instagram className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" className="rounded-full">
                <Twitter className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Home</Link></li>
              <li><Link to="/" className="hover:text-foreground">Products</Link></li>
              <li><Link to="/" className="hover:text-foreground">About Us</Link></li>
              <li><Link to="/" className="hover:text-foreground">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Categories</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Food & Groceries</Link></li>
              <li><Link to="/" className="hover:text-foreground">Household</Link></li>
              <li><Link to="/" className="hover:text-foreground">Personal Care</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5" />
                <span>{mockStore.phone}</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5" />
                <span>{mockStore.email}</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5" />
                <span>{mockStore.address}</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t pt-8 text-center text-sm text-muted-foreground">
          <p>© 2025 {mockStore.name}. All rights reserved. Powered by Agent Banking Platform</p>
        </div>
      </div>
    </footer>
  )
}

// Main App
function App() {
  const [cart, setCart] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  
  const handleAddToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id)
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + (product.quantity || 1) }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: product.quantity || 1 }])
    }
    setCartOpen(true)
  }
  
  const handleAddToWishlist = (product) => {
    if (!wishlist.find(item => item.id === product.id)) {
      setWishlist([...wishlist, product])
    }
  }
  
  const handleUpdateCart = (productId, quantity) => {
    if (quantity === 0) {
      setCart(cart.filter(item => item.id !== productId))
    } else {
      setCart(cart.map(item => 
        item.id === productId ? { ...item, quantity } : item
      ))
    }
  }
  
  const handleClearCart = () => {
    setCart([])
    setCartOpen(false)
  }
  
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + (item.base_price * item.quantity), 0)
  
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
        
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} />} />
            <Route path="/product/:id" element={<ProductDetailPage onAddToCart={handleAddToCart} />} />
            <Route path="/checkout" element={<CheckoutPage cart={cart} onUpdateCart={handleUpdateCart} onClearCart={handleClearCart} />} />
          </Routes>
        </main>
        
        <Footer />
        
        {/* Cart sidebar */}
        <Dialog open={cartOpen} onOpenChange={setCartOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Shopping Cart ({cartCount} items)</DialogTitle>
            </DialogHeader>
            
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <img src={item.images[0]} alt={item.name} className="w-20 h-20 object-cover rounded" />
                      <div className="flex-1">
                        <p className="font-medium line-clamp-1">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(item.base_price)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-6 w-6"
                            onClick={() => handleUpdateCart(item.id, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="text-sm w-8 text-center">{item.quantity}</span>
                          <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-6 w-6"
                            onClick={() => handleUpdateCart(item.id, item.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.base_price * item.quantity)}</p>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive h-6 mt-2"
                          onClick={() => handleUpdateCart(item.id, 0)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
                
                <DialogFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => setCartOpen(false)}>Continue Shopping</Button>
                  <Button asChild className="flex-1">
                    <Link to="/checkout" onClick={() => setCartOpen(false)}>
                      Checkout
                    </Link>
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Router>
  )
}

export default App

