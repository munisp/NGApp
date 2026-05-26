import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, getLoginUrl } from "@/const";
import { 
  Building2, 
  FileCheck, 
  Rocket, 
  Shield, 
  ArrowRight, 
  CheckCircle2,
  Users,
  TrendingUp,
  Clock,
  CreditCard
} from "lucide-react";
import { useLocation } from "wouter";

export default function OnboardingHome() {
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
            <Building2 className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold">Participant Onboarding Portal</span>
          </div>
          <div className="flex items-center gap-4">
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
                  <Link href="/onboarding/portal">Apply Now</Link>
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
            Join the Payment Switch Network
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamlined onboarding for banks, merchants, payment service providers, and financial institutions. 
            Get certified and go live in days, not months.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/onboarding/portal">
                Start Application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={() => {
              document.getElementById('process')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-3xl font-bold">500+</p>
              <p className="text-sm text-muted-foreground">Active Participants</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-3xl font-bold">$2.5B</p>
              <p className="text-sm text-muted-foreground">Monthly Volume</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Clock className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-3xl font-bold">7 Days</p>
              <p className="text-sm text-muted-foreground">Avg. Onboarding Time</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Shield className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <p className="text-3xl font-bold">100%</p>
              <p className="text-sm text-muted-foreground">PCI DSS Compliant</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Onboarding Process */}
      <section id="process" className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">5-Step Onboarding Process</h2>
            <p className="text-muted-foreground">From application to production in a structured, transparent workflow</p>
          </div>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Registration</h3>
                <p className="text-muted-foreground">
                  Submit organization details, contact information, and settlement preferences. 
                  Upload required documents with OCR-powered auto-fill.
                </p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Technical Onboarding</h3>
                <p className="text-muted-foreground">
                  Configure technical specifications, API endpoints, and security credentials. 
                  Our team reviews and approves your setup.
                </p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Integration Development</h3>
                <p className="text-muted-foreground">
                  Access sandbox environment, API documentation, and SDK libraries. 
                  Build and test your integration at your own pace.
                </p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                4
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Testing & Certification</h3>
                <p className="text-muted-foreground">
                  Complete mandatory test scenarios, security audits, and compliance checks. 
                  Get certified by our technical team.
                </p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 h-12 w-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                5
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Production Go-Live</h3>
                <p className="text-muted-foreground">
                  Receive production credentials, complete final checks, and go live. 
                  Start processing real transactions on the network.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Participant Types */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Who Can Join?</h2>
          <p className="text-muted-foreground">We welcome various types of financial institutions and service providers</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Banks & Financial Institutions</CardTitle>
              <CardDescription>
                Commercial banks, retail banks, and financial institutions looking to connect to the payment network
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Payment Service Providers</CardTitle>
              <CardDescription>
                PSPs, payment processors, and payment gateways seeking to expand their network reach
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-2 hover:border-blue-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Merchants & Businesses</CardTitle>
              <CardDescription>
                Large merchants and enterprises requiring direct network access for payment processing
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Join Our Network?</h2>
            <p className="text-muted-foreground">Benefits of becoming a network participant</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Fast Onboarding</h3>
                <p className="text-sm text-muted-foreground">
                  Streamlined process with OCR document processing and automated workflows
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Comprehensive Support</h3>
                <p className="text-sm text-muted-foreground">
                  Dedicated technical support team throughout the onboarding journey
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Secure Infrastructure</h3>
                <p className="text-sm text-muted-foreground">
                  PCI DSS Level 1 certified infrastructure with enterprise-grade security
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Flexible Integration</h3>
                <p className="text-sm text-muted-foreground">
                  RESTful APIs, SDKs, and comprehensive documentation for easy integration
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Real-time Monitoring</h3>
                <p className="text-sm text-muted-foreground">
                  Track your application status and integration progress in real-time
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">Network Access</h3>
                <p className="text-sm text-muted-foreground">
                  Connect with 500+ participants and process billions in transactions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Join?</h2>
          <p className="text-xl mb-8 opacity-90">
            Start your onboarding application today and become part of our growing network
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/onboarding/portal">
                Start Application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10" asChild>
              <Link href="/payments">
                View Payment Solutions
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5" />
                <span className="font-bold">Participant Onboarding Portal</span>
              </div>
              <p className="text-sm text-gray-400">
                Streamlined onboarding for payment network participants
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Onboarding</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/onboarding/portal" className="hover:text-white">Apply Now</Link></li>
                <li><Link href="/onboarding/apply" className="hover:text-white">Check Status</Link></li>
                <li><a href="#process" className="hover:text-white">Process Overview</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/payments" className="hover:text-white">Payment Solutions</Link></li>
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
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
            <p>&copy; 2024 Participant Onboarding Portal. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
