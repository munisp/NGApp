import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, getLoginUrl } from "@/const";
import { CreditCard, Shield, Zap, Globe, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

export default function PaymentGateway() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold">{APP_TITLE}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/">Home</Link>
            </Button>
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground">Welcome, {user?.name}</span>
                <Button onClick={() => setLocation("/dashboard")}>
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <a href={getLoginUrl()}>Sign In</a>
                </Button>
                <Button size="lg" asChild>
                  <Link href="/dashboard">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Accept Payments Anywhere
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            A modern payment gateway built for developers. Integrate secure checkout in minutes with our powerful API and beautiful hosted payment pages.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <a href={getLoginUrl()}>
                Start Building
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built on top of enterprise-grade infrastructure with all the features you need to scale
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Process payments in milliseconds with our optimized infrastructure
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Secure by Default</CardTitle>
              <CardDescription>
                PCI DSS compliant with built-in fraud detection and encryption
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Global Ready</CardTitle>
              <CardDescription>
                Support for multiple currencies and payment methods worldwide
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">Get started in three simple steps</p>
          </div>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Create Your Account</h3>
                <p className="text-muted-foreground">
                  Sign up and create a merchant account in seconds. Get your API credentials instantly.
                </p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Integrate the API</h3>
                <p className="text-muted-foreground">
                  Use our simple REST API to create payment sessions. We'll handle the checkout experience.
                </p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Start Accepting Payments</h3>
                <p className="text-muted-foreground">
                  Your customers get a beautiful, secure checkout page. You get paid automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Multiple Payment Methods</h2>
          <p className="text-muted-foreground">Support for all major payment types</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center">
              <CreditCard className="h-8 w-8 mx-auto mb-3 text-blue-600" />
              <p className="font-semibold">Credit & Debit Cards</p>
              <p className="text-sm text-muted-foreground mt-1">Visa, Mastercard, Amex</p>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardContent className="pt-6 text-center">
              <Globe className="h-8 w-8 mx-auto mb-3 text-gray-400" />
              <p className="font-semibold">Bank Transfer</p>
              <p className="text-sm text-muted-foreground mt-1">Coming Soon</p>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardContent className="pt-6 text-center">
              <div className="h-8 w-8 mx-auto mb-3 bg-gray-200 rounded" />
              <p className="font-semibold">QR Code</p>
              <p className="text-sm text-muted-foreground mt-1">Coming Soon</p>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardContent className="pt-6 text-center">
              <div className="h-8 w-8 mx-auto mb-3 bg-gray-200 rounded" />
              <p className="font-semibold">Digital Wallets</p>
              <p className="text-sm text-muted-foreground mt-1">Coming Soon</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of businesses using our platform to accept payments
          </p>
          <Button size="lg" variant="secondary" asChild>
            <a href={getLoginUrl()}>
              Create Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5" />
                <span className="font-bold">{APP_TITLE}</span>
              </div>
              <p className="text-sm text-gray-400">
                Modern payment infrastructure for the internet
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/" className="hover:text-white">Home</Link></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 {APP_TITLE}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
