import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Define a DEMO_MODE constant
const DEMO_MODE = process.env.DEMO_MODE === 'true';

interface RiskData {
  id: string;
  location: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  recommendations: string[];
}

const demoRiskMapData: RiskData[] = [
  {
    id: '1',
    location: 'Lagos Island, Lagos',
    riskLevel: 'High',
    description: 'High flood risk due to proximity to the ocean and poor drainage systems.',
    recommendations: ['Elevate property foundations', 'Install flood barriers', 'Secure comprehensive flood insurance'],
  },
  {
    id: '2',
    location: 'Abuja City Centre, FCT',
    riskLevel: 'Low',
    description: 'Generally low risk, but some areas may experience minor seasonal flooding.',
    recommendations: ['Regular drainage maintenance', 'Basic home insurance coverage'],
  },
  {
    id: '3',
    location: 'Port Harcourt, Rivers',
    riskLevel: 'Medium',
    description: 'Moderate risk of oil spills and environmental hazards affecting property.',
    recommendations: ['Environmental hazard insurance', 'Regular property inspections'],
  },
  {
    id: '4',
    location: 'Kano Metropolis, Kano',
    riskLevel: 'Medium',
    description: 'Moderate risk of fire incidents due to dense commercial areas and older infrastructure.',
    recommendations: ['Fire safety audits', 'Robust fire insurance policies'],
  },
];

export default function GeospatialMap() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [latitude, setLatitude] = useState<string>('6.5244'); // Default to Lagos latitude
  const [longitude, setLongitude] = useState<string>('3.3792'); // Default to Lagos longitude
  const [radius, setRadius] = useState<string>('50'); // Default radius in km

  const utils = trpc.useUtils();

  const { data: riskMapData, isLoading: isRiskMapLoading, error: riskMapError } = trpc.geospatial.riskMap.useQuery(
    {
      lat: parseFloat(latitude),
      lng: parseFloat(longitude),
      radius: parseFloat(radius),
    },
    {
      enabled: isAuthenticated && !DEMO_MODE,
      onError: (err) => {
        toast.error(`Failed to fetch risk map: ${err.message}`);
      },
    }
  );

  const analyzeMutation = trpc.geospatial.analyze.useMutation({
    onSuccess: () => {
      toast.success('Geospatial analysis initiated successfully!');
      utils.geospatial.riskMap.invalidate(); // Invalidate risk map data after analysis
    },
    onError: (err) => {
      toast.error(`Failed to initiate analysis: ${err.message}`);
    },
  });

  const handleAnalyze = () => {
    if (!isAuthenticated && !DEMO_MODE) {
      toast.error('You must be logged in to perform analysis.');
      return;
    }
    if (DEMO_MODE) {
      toast.info('Analysis is simulated in DEMO MODE.');
      // Simulate a successful analysis in demo mode
      setTimeout(() => {
        toast.success('Geospatial analysis (DEMO) completed!');
      }, 1500);
      return;
    }
    analyzeMutation.mutate();
  };

  useEffect(() => {
    if (riskMapError) {
      toast.error(`Error loading risk map: ${riskMapError.message}`);
    }
  }, [riskMapError]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated && !DEMO_MODE) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to view the Geospatial Risk Map.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayRiskData = DEMO_MODE ? demoRiskMapData : (riskMapData || []);

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Geospatial Risk Map</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Visualize and analyze insurance risk across different geographical areas in Nigeria.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Risk Map Parameters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g., 6.5244"
            />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g., 3.3792"
            />
          </div>
          <div>
            <Label htmlFor="radius">Radius (km)</Label>
            <Input
              id="radius"
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="e.g., 50"
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isLoading || isRiskMapLoading}
            >
              {(analyzeMutation.isLoading || isRiskMapLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyze Geospatial Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          {isRiskMapLoading && !DEMO_MODE ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading risk data...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {displayRiskData.length > 0 ? (
                displayRiskData.map((risk) => (
                  <Card key={risk.id} className="p-4">
                    <h3 className="text-lg font-semibold">Location: {risk.location}</h3>
                    <p><strong>Risk Level:</strong> {risk.riskLevel}</p>
                    <p><strong>Description:</strong> {risk.description}</p>
                    <p><strong>Recommendations:</strong></p>
                    <ul className="list-disc list-inside">
                      {risk.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground">No geospatial risk data available for the selected parameters.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}