import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { Shield, Database, DollarSign, Activity, ArrowLeft } from "lucide-react";
import OpenCTIDashboard from "@/components/integrations/OpenCTIDashboard";
import WazuhDashboard from "@/components/integrations/WazuhDashboard";
import OpenSearchDashboard from "@/components/integrations/OpenSearchDashboard";
import KubecostDashboard from "@/components/integrations/KubecostDashboard";

export default function IntegrationsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("opencti");

  if (!authLoading && user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Security & Monitoring Integrations</h1>
              <p className="text-gray-600 mt-1">
                OpenCTI, Wazuh, OpenSearch, and Kubecost dashboards
              </p>
            </div>
            <Button onClick={() => setLocation("/admin")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="opencti" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              OpenCTI
            </TabsTrigger>
            <TabsTrigger value="wazuh" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Wazuh SIEM
            </TabsTrigger>
            <TabsTrigger value="opensearch" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              OpenSearch
            </TabsTrigger>
            <TabsTrigger value="kubecost" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Kubecost
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opencti">
            <OpenCTIDashboard />
          </TabsContent>

          <TabsContent value="wazuh">
            <WazuhDashboard />
          </TabsContent>

          <TabsContent value="opensearch">
            <OpenSearchDashboard />
          </TabsContent>

          <TabsContent value="kubecost">
            <KubecostDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
