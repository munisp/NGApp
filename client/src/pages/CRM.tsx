import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BarChart3, Package, Search, Plus, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function CRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("customers");

  const customersQuery = trpc.crm.customers.list.useQuery({
    search: searchQuery || undefined,
    limit: 50,
  });

  const segmentsQuery = trpc.crm.analytics.customerSegments.useQuery();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM & Customer Management</h1>
          <p className="text-muted-foreground">Manage customers, leads, and inventory</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{Array.isArray(customersQuery.data) ? customersQuery.data.length : 0}</p>
              <p className="text-sm text-muted-foreground">Total Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <UserCheck className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">
                {Array.isArray(segmentsQuery.data) ? segmentsQuery.data.length : 0}
              </p>
              <p className="text-sm text-muted-foreground">Segments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BarChart3 className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Active Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Package className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Products</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers by name or email..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.isArray(customersQuery.data) && customersQuery.data.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div>
                      <p className="font-medium">{c.full_name || c.username}</p>
                      <p className="text-sm text-muted-foreground">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.role || 'user'}</Badge>
                    </div>
                  </div>
                ))}
                {(!customersQuery.data || !Array.isArray(customersQuery.data) || customersQuery.data.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">No customers found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Lead tracking and pipeline management</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage products, stock levels, and warehouses</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>CRM Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h3 className="font-medium">Customer Segments</h3>
                {Array.isArray(segmentsQuery.data) && segmentsQuery.data.map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <p className="font-medium capitalize">{s.segment}</p>
                    <Badge>{s.count} customers</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
