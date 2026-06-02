import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MicroinsuranceProduct {
  id: string;
  name: string;
  description: string;
  premium: number;
  coverage: string;
  eligibility: string;
  provider: string;
}

const DEMO_PRODUCTS: MicroinsuranceProduct[] = [
  {
    id: 'prod_001',
    name: 'Farmer Shield',
    description: 'Affordable insurance for small-scale farmers against crop failure and livestock loss.',
    premium: 1500,
    coverage: 'Up to NGN 100,000 for crop loss, NGN 50,000 for livestock.',
    eligibility: 'Farmers with less than 5 acres of land.',
    provider: 'AgroSure Insurance',
  },
  {
    id: 'prod_002',
    name: 'Trader Protect',
    description: 'Daily income protection for market traders in case of illness or market disruption.',
    premium: 500,
    coverage: 'NGN 5,000 daily income replacement for up to 10 days.',
    eligibility: 'Registered market traders.',
    provider: 'MarketGuard',
  },
  {
    id: 'prod_003',
    name: 'Artisan Cover',
    description: 'Tools and personal accident insurance for artisans like tailors, carpenters, and mechanics.',
    premium: 1000,
    coverage: 'NGN 200,000 for accidental death, NGN 50,000 for tool damage.',
    eligibility: 'Certified artisans.',
    provider: 'CraftSecure',
  },
  {
    id: 'prod_004',
    name: 'Health Micro',
    description: 'Basic health coverage for low-income families, covering common ailments and emergencies.',
    premium: 2500,
    coverage: 'Hospitalization up to NGN 150,000, outpatient visits.',
    eligibility: 'Families with monthly income below NGN 80,000.',
    provider: 'WellLife Health',
  },
];

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const MicroinsurancePage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<MicroinsuranceProduct | null>(null);

  const { data: products, isLoading, isError, error } = trpc.microinsurance.products.useQuery();
  const enrollMutation = trpc.microinsurance.enroll.useMutation({
    onSuccess: () => {
      toast.success('Successfully enrolled in microinsurance product!');
      trpc.useUtils().microinsurance.products.invalidate();
      setSelectedProduct(null);
    },
    onError: (err) => {
      toast.error(`Enrollment failed: ${err.message}`);
    },
  });

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        <p>You must be logged in to view this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading microinsurance products...</p>
      </div>
    );
  }

  if (isError) {
    toast.error(`Failed to load products: ${error?.message}`);
  }

  const displayedProducts = DEMO_MODE ? DEMO_PRODUCTS : (products || []);

  const filteredProducts = displayedProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEnroll = (productId: string) => {
    if (DEMO_MODE) {
      toast.info('Enrollment is in DEMO MODE. No actual enrollment will occur.');
      toast.success(`Successfully simulated enrollment for product ID: ${productId}`);
      return;
    }
    enrollMutation.mutate({ productId });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Microinsurance Products</h1>

      <div className="flex justify-between items-center mb-4">
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {DEMO_MODE && (
        <Badge variant="destructive" className="mb-4">DEMO MODE ACTIVE: Displaying sample data.</Badge>
      )}

      {filteredProducts.length === 0 ? (
        <p className="text-center text-gray-500">No microinsurance products found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>{product.provider}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                <p className="font-semibold">Premium: NGN {product.premium.toLocaleString()}</p>
                <p className="text-sm">Coverage: {product.coverage}</p>
                <p className="text-sm">Eligibility: {product.eligibility}</p>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedProduct(product)}>Enroll Now</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Enrollment</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to enroll in the <strong>{selectedProduct?.name}</strong> product?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p><strong>Product:</strong> {selectedProduct?.name}</p>
                      <p><strong>Premium:</strong> NGN {selectedProduct?.premium.toLocaleString()}</p>
                      <p><strong>Coverage:</strong> {selectedProduct?.coverage}</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSelectedProduct(null)}>Cancel</Button>
                      <Button
                        onClick={() => selectedProduct && handleEnroll(selectedProduct.id)}
                        disabled={enrollMutation.isLoading}
                      >
                        {enrollMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MicroinsurancePage;