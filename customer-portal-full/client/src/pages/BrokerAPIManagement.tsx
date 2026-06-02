import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// DEMO_MODE fallback with realistic Nigerian insurance data
const DEMO_API_KEYS = [
  {
    id: 'api_key_12345',
    name: 'Lead Generation App',
    key: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    status: 'active',
    createdAt: '2023-01-15T10:00:00Z',
    expiresAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'api_key_67890',
    name: 'Claims Processing Integration',
    key: 'sk-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
    status: 'revoked',
    createdAt: '2023-03-20T11:30:00Z',
    expiresAt: '2024-03-20T11:30:00Z',
  },
  {
    id: 'api_key_abcde',
    name: 'Partner Broker Portal',
    key: 'sk-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    status: 'active',
    createdAt: '2023-06-01T09:00:00Z',
    expiresAt: '2024-06-01T09:00:00Z',
  },
];

const DEMO_MODE = process.env.DEMO_MODE === 'true';

export default function BrokerAPIManagement() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  // tRPC queries and mutations
  const { data: apiKeys, isLoading, isError, error } = trpc.brokerApi.keys.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });
  const createKeyMutation = trpc.brokerApi.create.useMutation();
  const revokeKeyMutation = trpc.brokerApi.revoke.useMutation();
  const trpcUtils = trpc.useUtils();

  // Fallback to demo data if not authenticated or in DEMO_MODE
  const displayApiKeys = useMemo(() => {
    if (DEMO_MODE || !isAuthenticated) {
      return DEMO_API_KEYS.filter(key =>
        key.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return (apiKeys || []).filter(key =>
      key.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [apiKeys, searchTerm, isAuthenticated]);

  // Handle loading and error states
  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold">
        Please log in to manage Broker API Keys.
      </div>
    );
  }

  if (isError && !DEMO_MODE) {
    toast.error(`Failed to load API keys: ${error?.message || 'Unknown error'}`);
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold text-red-600">
        Error loading API keys. Please try again later.
      </div>
    );
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('API Key name cannot be empty.');
      return;
    }
    try {
      await createKeyMutation.mutateAsync({ name: newKeyName });
      toast.success('API Key created successfully!');
      trpcUtils.brokerApi.keys.invalidate();
      setNewKeyName('');
      setIsCreateDialogOpen(false);
    } catch (err: any) {
      toast.error(`Failed to create API Key: ${err.message || 'Unknown error'}`);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeKeyMutation.mutateAsync({ id });
      toast.success('API Key revoked successfully!');
      trpcUtils.brokerApi.keys.invalidate();
    } catch (err: any) {
      toast.error(`Failed to revoke API Key: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Broker API Management</CardTitle>
          <CardDescription>Manage your API keys for broker integrations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search API keys by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>Create New API Key</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New API Key</DialogTitle>
                  <DialogDescription>
                    Enter a name for your new API key. This will help you identify its purpose.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="keyName" className="text-right">
                      Key Name
                    </Label>
                    <Input
                      id="keyName"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateKey}
                    disabled={createKeyMutation.isLoading}
                  >
                    {createKeyMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Key
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {(isLoading && !DEMO_MODE) ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Expires At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayApiKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No API keys found.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayApiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-sm">{key.key}</TableCell>
                      <TableCell>
                        <Badge variant={key.status === 'active' ? 'default' : 'destructive'}>
                          {key.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(key.expiresAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeKey(key.id)}
                          disabled={key.status === 'revoked' || revokeKeyMutation.isLoading}
                        >
                          {revokeKeyMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}