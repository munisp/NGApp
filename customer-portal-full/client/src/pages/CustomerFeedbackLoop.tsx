import React, { useState } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Button
} from "@/components/ui/button";
import {
  Input
} from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEMO_MODE = false;

interface Feedback {
  id: string;
  category: string;
  rating: number;
  comment: string;
  createdAt: string;
}

const demoFeedback: Feedback[] = [
  {
    id: "1",
    category: "Service Quality",
    rating: 5,
    comment: "Excellent service, very prompt and helpful!",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    category: "Website Usability",
    rating: 4,
    comment: "The website is good, but sometimes a bit slow to load.",
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: "3",
    category: "Policy Options",
    rating: 3,
    comment: "Could use more diverse policy options for small businesses.",
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
  },
  {
    id: "4",
    category: "Claims Process",
    rating: 5,
    comment: "Smooth claims process, very satisfied with the outcome.",
    createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
  },
  {
    id: "5",
    category: "Customer Support",
    rating: 2,
    comment: "Had trouble reaching customer support, long wait times.",
    createdAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
  },
];

const CustomerFeedbackLoop: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [category, setCategory] = useState<string>("");
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const utils = trpc.useUtils();

  const { data: feedbackList, isLoading: isFeedbackLoading, error: feedbackError } = trpc.feedback.list.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const { mutate: submitFeedback, isLoading: isSubmittingFeedback } = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success("Feedback submitted successfully!");
      setCategory("");
      setRating(0);
      setComment("");
      utils.feedback.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to submit feedback: ${err.message}`);
    },
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
      <div className="flex items-center justify-center h-screen text-lg font-semibold">
        Please log in to access the Customer Feedback Loop.
      </div>
    );
  }

  if (feedbackError && !DEMO_MODE) {
    toast.error(`Error loading feedback: ${feedbackError.message}`);
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold text-red-600">
        Error loading feedback. Please try again later.
      </div>
    );
  }

  const handleFeedbackSubmit = () => {
    if (!category || !comment || rating === 0) {
      toast.error("Please fill in all feedback fields.");
      return;
    }
    submitFeedback({ category, rating, comment });
  };

  const displayedFeedback = DEMO_MODE ? demoFeedback : (feedbackList || []);

  const filteredFeedback = displayedFeedback.filter(feedback => {
    const matchesSearch = feedback.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          feedback.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || feedback.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = Array.from(new Set(displayedFeedback.map(f => f.category)));

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Customer Feedback Loop</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Submit New Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Service Quality">Service Quality</SelectItem>
                <SelectItem value="Website Usability">Website Usability</SelectItem>
                <SelectItem value="Policy Options">Policy Options</SelectItem>
                <SelectItem value="Claims Process">Claims Process</SelectItem>
                <SelectItem value="Customer Support">Customer Support</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => setRating(parseInt(value))} value={rating.toString()}>
              <SelectTrigger>
                <SelectValue placeholder="Select Rating" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((r) => (
                  <SelectItem key={r} value={r.toString()}>{r} Star{r > 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Your feedback comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <Button onClick={handleFeedbackSubmit} disabled={isSubmittingFeedback}>
            {isSubmittingFeedback ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Submit Feedback
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Search feedback..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow"
            />
            <Select onValueChange={setFilterCategory} value={filterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isFeedbackLoading && !DEMO_MODE ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No feedback found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((feedback) => (
                  <TableRow key={feedback.id}>
                    <TableCell>{feedback.category}</TableCell>
                    <TableCell>{feedback.rating} Stars</TableCell>
                    <TableCell>{feedback.comment}</TableCell>
                    <TableCell>{new Date(feedback.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerFeedbackLoop;