import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const DEMO_MODE = process.env.NODE_ENV === 'development'; // Or any other condition for demo mode

interface FinancialScore {
  score: number;
  level: string;
  description: string;
}

interface Recommendation {
  id: string;
  title: string;
  category: string;
  impact: string;
  status: 'Pending' | 'Completed';
}

const demoFinancialScore: FinancialScore = {
  score: 750,
  level: 'Excellent',
  description: 'Your financial health is strong, indicating good management of your finances and low risk.'
};

const demoRecommendations: Recommendation[] = [
  { id: 'rec1', title: 'Review your pension plan', category: 'Retirement', impact: 'High', status: 'Pending' },
  { id: 'rec2', title: 'Increase emergency savings', category: 'Savings', impact: 'Medium', status: 'Completed' },
  { id: 'rec3', title: 'Explore investment opportunities', category: 'Investment', impact: 'High', status: 'Pending' },
  { id: 'rec4', title: 'Optimize insurance coverage', category: 'Insurance', impact: 'Medium', status: 'Pending' },
];

export default function FinancialWellness() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const { data: financialScore, isLoading: scoreLoading, error: scoreError } = trpc.financialWellness.score.useQuery(undefined, {
    enabled: !DEMO_MODE && isAuthenticated,
  });

  const { data: recommendations, isLoading: recommendationsLoading, error: recommendationsError } = trpc.financialWellness.recommendations.useQuery(undefined, {
    enabled: !DEMO_MODE && isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold text-red-500">
        Please log in to view your financial wellness.
      </div>
    );
  }

  if (scoreError) {
    toast.error(`Failed to fetch financial score: ${scoreError.message}`);
  }

  if (recommendationsError) {
    toast.error(`Failed to fetch recommendations: ${recommendationsError.message}`);
  }

  const currentFinancialScore = DEMO_MODE ? demoFinancialScore : financialScore;
  const currentRecommendations = DEMO_MODE ? demoRecommendations : recommendations;

  const filteredRecommendations = currentRecommendations?.filter(rec => {
    const matchesSearch = rec.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || rec.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = Array.from(new Set(demoRecommendations.map(rec => rec.category)));

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Financial Wellness Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Financial Score</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreLoading && !DEMO_MODE ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : currentFinancialScore ? (
              <div className="text-center">
                <p className="text-5xl font-extrabold text-primary">{currentFinancialScore.score}</p>
                <Badge className={`mt-2 text-lg ${currentFinancialScore.level === 'Excellent' ? 'bg-green-500' : currentFinancialScore.level === 'Good' ? 'bg-blue-500' : 'bg-yellow-500'}`}>
                  {currentFinancialScore.level}
                </Badge>
                <p className="mt-4 text-gray-600">{currentFinancialScore.description}</p>
              </div>
            ) : (
              <p className="text-center text-gray-500">No financial score available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personalized Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2 mb-4">
              <Input
                placeholder="Search recommendations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow"
              />
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {recommendationsLoading && !DEMO_MODE ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredRecommendations && filteredRecommendations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecommendations.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.title}</TableCell>
                      <TableCell>{rec.category}</TableCell>
                      <TableCell>{rec.impact}</TableCell>
                      <TableCell>
                        <Badge variant={rec.status === 'Completed' ? 'default' : 'outline'}>
                          {rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">View Details</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{rec.title}</DialogTitle>
                              <DialogDescription>
                                Category: {rec.category} | Impact: {rec.impact} | Status: {rec.status}
                                <p className="mt-2">Detailed information about this recommendation would go here.</p>
                              </DialogDescription>
                            </DialogHeader>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500">No recommendations found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}