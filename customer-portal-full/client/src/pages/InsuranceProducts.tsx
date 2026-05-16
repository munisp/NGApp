import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// DEMO_MODE fallback data
const DEMO_MODE = false;

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  provider: string;
  features: string[];
}

const DEMO_PRODUCTS: Product[] = [
  {
    id: "prod_001",
    name: "Motor Insurance (Third Party)",
    category: "Auto",
    description: "Covers damages to third-party property and bodily injury.",
    price: 15000, // NGN
    provider: "Leadway Assurance",
    features: ["Third-party liability", "Property damage"],
  },
  {
    id: "prod_002",
    name: "Comprehensive Motor Insurance",
    category: "Auto",
    description: "Covers own vehicle damage, theft, and third-party liability.",
    price: 65000,
    provider: "AIICO Insurance",
    features: ["Own damage", "Theft", "Third-party liability", "Fire"],
  },
  {
    id: "prod_003",
    name: "Health Insurance (Basic Plan)",
    category: "Health",
    description: "Access to primary healthcare services and consultations.",
    price: 30000,
    provider: "Reliance HMO",
    features: ["GP visits", "Basic diagnostics", "Prescription drugs"],
  },
  {
    id: "prod_004",
    name: "Travel Insurance (International)",
    category: "Travel",
    description: "Covers medical emergencies, trip cancellations, and lost luggage during international travel.",
    price: 25000,
    provider: "AXA Mansard",
    features: ["Medical emergencies", "Trip cancellation", "Lost luggage"],
  },
  {
    id: "prod_005",
    name: "Home Insurance (Fire & Burglary)",
    category: "Home",
    description: "Protects your home and contents against fire and burglary.",
    price: 40000,
    provider: "Custodian Life Assurance",
    features: ["Fire damage", "Burglary", "Property damage"],
  },
  {
    id: "prod_006",
    name: "Life Assurance (Term Life)",
    category: "Life",
    description: "Provides financial protection for your loved ones for a specific term.",
    price: 50000,
    provider: "FBNInsurance",
    features: ["Death benefit", "Critical illness option"],
  },
  {
    id: "prod_007",
    name: "Education Protection Plan",
    category: "Education",
    description: "Ensures your child's education is secured even in unforeseen circumstances.",
    price: 35000,
    provider: "Cornerstone Insurance",
    features: ["School fees payment", "Parental disability cover"],
  },
  {
    id: "prod_008",
    name: "Agricultural Insurance (Crop)",
    category: "Agriculture",
    description: "Protects farmers against crop loss due to natural disasters.",
    price: 20000,
    provider: "NAIC",
    features: ["Crop failure", "Pest infestation", "Drought"],
  },
  {
    id: "prod_009",
    name: "SME Business Protection",
    category: "Business",
    description: "Comprehensive insurance for small and medium-sized enterprises.",
    price: 80000,
    provider: "Royal Exchange General Insurance",
    features: ["Property damage", "Business interruption", "Public liability"],
  },
  {
    id: "prod_010",
    name: "Gadget Insurance",
    category: "Gadget",
    description: "Covers your electronic gadgets against damage, theft, and loss.",
    price: 10000,
    provider: "Leadway Assurance",
    features: ["Screen damage", "Water damage", "Theft"],
  },
];

const CATEGORIES = [
  "All",
  "Auto",
  "Health",
  "Travel",
  "Home",
  "Life",
  "Education",
  "Agriculture",
  "Business",
  "Gadget",
];

export default function InsuranceProducts() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 5;

  const { data, isLoading, isError, error } = trpc.marketplace.products.useQuery(
    {
      category: selectedCategory === "All" ? undefined : selectedCategory,
      search: searchQuery || undefined,
    },
    {
      enabled: !DEMO_MODE && isAuthenticated,
      onError: (err) => {
        toast.error(`Failed to fetch products: ${err.message}`);
      },
    }
  );

  const purchaseMutation = trpc.marketplace.purchase.useMutation({
    onSuccess: () => {
      toast.success("Product purchased successfully!");
      utils.marketplace.products.invalidate(); // Invalidate products list after purchase
    },
    onError: (err) => {
      toast.error(`Failed to purchase product: ${err.message}`);
    },
  });

  const products = DEMO_MODE ? DEMO_PRODUCTS : data || [];

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== "All") {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [products, selectedCategory, searchQuery]);

  // Pagination logic
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstProduct,
    indexOfLastProduct
  );
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Authenticating...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        <p>You must be logged in to view insurance products.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Insurance Products</CardTitle>
          <CardDescription>Explore a wide range of insurance products tailored for your needs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-grow"
          />
          <Select
            value={selectedCategory}
            onValueChange={(value) => {
              setSelectedCategory(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && !DEMO_MODE ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="ml-2">Loading products...</p>
        </div>
      ) : isError && !DEMO_MODE ? (
        <div className="flex items-center justify-center min-h-[200px] text-red-500">
          <p>Error: {error?.message || "Failed to load products."}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No products found matching your criteria.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Available Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Price (NGN)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.category}</Badge>
                    </TableCell>
                    <TableCell>{product.provider}</TableCell>
                    <TableCell>{product.price.toLocaleString("en-NG")}</TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{product.name}</DialogTitle>
                            <DialogDescription>{product.description}</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div>
                              <h4 className="font-semibold">Provider:</h4>
                              <p>{product.provider}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold">Category:</h4>
                              <p>{product.category}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold">Price:</h4>
                              <p>NGN {product.price.toLocaleString("en-NG")}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold">Key Features:</h4>
                              <ul className="list-disc list-inside">
                                {product.features.map((feature, index) => (
                                  <li key={index}>{feature}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => purchaseMutation.mutate({ productId: product.id })}
                              disabled={purchaseMutation.isLoading}
                            >
                              {purchaseMutation.isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Purchase
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}