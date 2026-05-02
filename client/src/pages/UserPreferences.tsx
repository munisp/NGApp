import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, Globe, Bell, Palette, Save } from "lucide-react";

export default function UserPreferences() {
  const [prefs, setPrefs] = useState({
    language: "en", currencyDisplay: "NGN", theme: "light", timezone: "Africa/Lagos", dateFormat: "DD/MM/YYYY",
    notifyEmail: true, notifySms: false, notifyPush: true, notifyInApp: true, emailDigestFrequency: "daily",
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Settings className="h-8 w-8" /> Preferences</h1>
          <p className="text-muted-foreground mt-1">Customize your experience</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Display</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>Theme</Label><p className="text-sm text-muted-foreground">Choose light or dark mode</p></div>
              <Select value={prefs.theme} onValueChange={v => setPrefs({ ...prefs, theme: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="system">System</SelectItem></SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label>Date Format</Label></div>
              <Select value={prefs.dateFormat} onValueChange={v => setPrefs({ ...prefs, dateFormat: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem><SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem><SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Regional</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>Language</Label></div>
              <Select value={prefs.language} onValueChange={v => setPrefs({ ...prefs, language: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">French</SelectItem><SelectItem value="yo">Yoruba</SelectItem><SelectItem value="ha">Hausa</SelectItem><SelectItem value="ig">Igbo</SelectItem></SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label>Currency Display</Label></div>
              <Select value={prefs.currencyDisplay} onValueChange={v => setPrefs({ ...prefs, currencyDisplay: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NGN">NGN (₦)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem></SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label>Timezone</Label></div>
              <Select value={prefs.timezone} onValueChange={v => setPrefs({ ...prefs, timezone: v })}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Africa/Lagos">Africa/Lagos (WAT)</SelectItem><SelectItem value="UTC">UTC</SelectItem><SelectItem value="America/New_York">US Eastern</SelectItem><SelectItem value="Europe/London">UK (GMT/BST)</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "notifyEmail", label: "Email notifications", desc: "Receive updates via email" },
              { key: "notifySms", label: "SMS notifications", desc: "Receive SMS for critical alerts" },
              { key: "notifyPush", label: "Push notifications", desc: "Browser push notifications" },
              { key: "notifyInApp", label: "In-app notifications", desc: "Show notifications in the app" },
            ].map(n => (
              <div key={n.key} className="flex items-center justify-between">
                <div><Label>{n.label}</Label><p className="text-sm text-muted-foreground">{n.desc}</p></div>
                <Switch checked={prefs[n.key as keyof typeof prefs] as boolean} onCheckedChange={v => setPrefs({ ...prefs, [n.key]: v })} />
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between">
              <div><Label>Email Digest</Label><p className="text-sm text-muted-foreground">How often to receive email summaries</p></div>
              <Select value={prefs.emailDigestFrequency} onValueChange={v => setPrefs({ ...prefs, emailDigestFrequency: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="realtime">Real-time</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="never">Never</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg"><Save className="mr-2 h-4 w-4" /> Save Preferences</Button>
      </div>
    </div>
  );
}
