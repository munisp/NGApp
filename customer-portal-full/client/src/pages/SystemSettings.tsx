import React, { useState, useEffect } from 'react';
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const DEMO_MODE = process.env.DEMO_MODE === 'true';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const demoProfile: UserProfile = {
  name: "Aisha Bello",
  email: "aisha.bello@example.com",
  phone: "+2348012345678",
  address: "123 Lagos Street, Victoria Island, Lagos, Nigeria",
};

export default function SystemSettings() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();

  const { data: profileData, isLoading: isProfileLoading, error: profileError } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      utils.profile.get.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (DEMO_MODE) {
      setName(demoProfile.name);
      setEmail(demoProfile.email);
      setPhone(demoProfile.phone);
      setAddress(demoProfile.address);
    } else if (profileData) {
      setName(profileData.name || '');
      setEmail(profileData.email || '');
      setPhone(profileData.phone || '');
      setAddress(profileData.address || '');
    }
  }, [profileData]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Please log in to view system settings.</p>
      </div>
    );
  }

  if (isProfileLoading && !DEMO_MODE) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading settings...</p>
      </div>
    );
  }

  if (profileError && !DEMO_MODE) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Error loading settings: {profileError.message}</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (DEMO_MODE) {
      toast.success("Profile updated successfully in DEMO MODE!");
      console.log("DEMO MODE: Updated profile", { name, email, phone, address });
      return;
    }
    updateProfileMutation.mutate({ name, email, phone, address });
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>Manage your profile and system preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={updateProfileMutation.isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={updateProfileMutation.isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+234..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={updateProfileMutation.isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                type="text"
                placeholder="Your Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={updateProfileMutation.isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateProfileMutation.isLoading}>
              {updateProfileMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}