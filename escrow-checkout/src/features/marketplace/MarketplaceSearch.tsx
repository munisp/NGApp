import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Star, Shield, MapPin, ChevronRight, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/api/client';
import type { MarketplaceListing } from '@/types';

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
};

const CATEGORIES = [
  'All Categories',
  'Fashion & Clothing',
  'Electronics',
  'Home & Garden',
  'Beauty & Health',
  'Food & Groceries',
  'Vehicles',
  'Services',
];

export function MarketplaceSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All Categories');
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    // Load initial listings or search results
    if (query) {
      searchListings();
    } else {
      loadFeaturedListings();
    }
  }, []);

  const loadFeaturedListings = async () => {
    setLoading(true);
    try {
      const results = await api.searchListings('', { category: category !== 'All Categories' ? category : undefined });
      setListings(results);
    } catch (err) {
      // Mock listings for demo
      setListings([
        {
          id: 'lst-001',
          title: '150 PCS Stock Jeans Bale',
          description: 'High quality stock jeans, mixed sizes',
          price: 375000,
          currency: 'NGN',
          images: [],
          category: 'Fashion & Clothing',
          seller: {
            id: 'seller-001',
            name: 'Merchant Cheena',
            username: 'merchantcheena',
            phone: '+234 906 161 1991',
            role: 'seller',
            kycLevel: 2,
            verified: true,
            location: 'Port Harcourt',
            trustScore: 4.8,
            tier: 'gold',
            totalTransactions: 1250,
            successRate: 98.5,
          },
          escrowEnabled: true,
          createdAt: new Date(),
        },
        {
          id: 'lst-002',
          title: 'iPhone 15 Pro Max 256GB',
          description: 'Brand new, sealed in box',
          price: 1850000,
          currency: 'NGN',
          images: [],
          category: 'Electronics',
          seller: {
            id: 'seller-002',
            name: 'TechHub Nigeria',
            username: 'techhubng',
            phone: '+234 803 456 7890',
            role: 'seller',
            kycLevel: 3,
            verified: true,
            location: 'Lagos',
            trustScore: 4.9,
            tier: 'platinum',
            totalTransactions: 3500,
            successRate: 99.2,
          },
          escrowEnabled: true,
          createdAt: new Date(),
        },
        {
          id: 'lst-003',
          title: 'Toyota Camry 2020 XLE',
          description: 'Foreign used, excellent condition',
          price: 18500000,
          currency: 'NGN',
          images: [],
          category: 'Vehicles',
          seller: {
            id: 'seller-003',
            name: 'AutoMart Lagos',
            username: 'automartlagos',
            phone: '+234 805 123 4567',
            role: 'seller',
            kycLevel: 3,
            verified: true,
            location: 'Lagos',
            trustScore: 4.7,
            tier: 'gold',
            totalTransactions: 890,
            successRate: 97.8,
          },
          escrowEnabled: true,
          createdAt: new Date(),
        },
        {
          id: 'lst-004',
          title: 'Ankara Fabric Bundle (20 yards)',
          description: 'Premium quality Ankara prints',
          price: 45000,
          currency: 'NGN',
          images: [],
          category: 'Fashion & Clothing',
          seller: {
            id: 'seller-004',
            name: 'Fabric Palace',
            username: 'fabricpalace',
            phone: '+234 809 876 5432',
            role: 'seller',
            kycLevel: 2,
            verified: true,
            location: 'Aba',
            trustScore: 4.6,
            tier: 'silver',
            totalTransactions: 560,
            successRate: 96.5,
          },
          escrowEnabled: true,
          createdAt: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const searchListings = async () => {
    setLoading(true);
    setSearchParams({ q: query, ...(category !== 'All Categories' && { category }) });
    
    try {
      const results = await api.searchListings(query, { 
        category: category !== 'All Categories' ? category : undefined 
      });
      setListings(results);
    } catch (err) {
      // Filter mock listings
      loadFeaturedListings();
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchListings();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="font-semibold text-slate-800">EscrowProtect Marketplace</span>
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search products, sellers..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">
              <Filter className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600">
            {listings.length} {query ? `results for "${query}"` : 'featured listings'}
          </p>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-slate-500 mt-2">Searching...</p>
          </div>
        )}

        {/* Listings Grid */}
        {!loading && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-4' : 'space-y-4'}>
            {listings.map((listing) => (
              <Card
                key={listing.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/listing/${listing.id}`)}
              >
                <CardContent className={viewMode === 'grid' ? 'p-3' : 'p-4'}>
                  {viewMode === 'grid' ? (
                    // Grid View
                    <>
                      <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg mb-3 flex items-center justify-center text-white text-3xl">
                        {listing.images?.[0] ? (
                          <img src={listing.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : '📦'}
                      </div>
                      <h3 className="font-medium text-slate-800 text-sm line-clamp-2 mb-1">
                        {listing.title}
                      </h3>
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(listing.price, listing.currency)}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {listing.seller.trustScore}
                        </div>
                        {listing.seller.verified && (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 px-1">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </>
                  ) : (
                    // List View
                    <div className="flex gap-4">
                      <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-2xl flex-shrink-0">
                        {listing.images?.[0] ? (
                          <img src={listing.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-800 line-clamp-1">{listing.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-1">{listing.description}</p>
                        <p className="text-lg font-bold text-emerald-600 mt-1">
                          {formatCurrency(listing.price, listing.currency)}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {listing.seller.trustScore}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {listing.seller.location}
                          </span>
                          {listing.seller.verified && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                              Verified
                            </Badge>
                          )}
                          {listing.escrowEnabled && (
                            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                              <Shield className="w-3 h-3 mr-1" />
                              Escrow
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0 self-center" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && listings.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-medium text-slate-800 mb-2">No listings found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketplaceSearch;
