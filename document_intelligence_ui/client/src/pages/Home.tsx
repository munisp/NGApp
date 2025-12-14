import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Upload, FileSearch, Zap, Shield, BarChart3, Clock, Database, FileType, Activity, FileDown, CalendarClock, Wrench, Layers } from "lucide-react";
import { Link } from "wouter";
import { NotificationBell } from "@/components/NotificationBell";
import HelpMenu from "@/components/HelpMenu";
import WelcomeModal from "@/components/WelcomeModal";

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <WelcomeModal />
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold text-foreground">{APP_TITLE}</span>
          </div>
          <nav className="flex items-center gap-4">
            {user && <NotificationBell />}
            <HelpMenu />
            {user ? (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/documents">My Documents</Link>
                </Button>
                <Button asChild>
                  <Link href="/upload">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild>
                <a href={getLoginUrl()}>Sign In</a>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Intelligent Document Processing
            <br />
            <span className="text-primary">Made Simple</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your health insurance marketplace documents and get accurate OCR results in milliseconds.
            Powered by multi-engine ensemble technology with 96% accuracy.
          </p>
          <div className="flex gap-4 justify-center">
            {user ? (
              <>
                <Button size="lg" asChild>
                  <Link href="/upload">
                    <Upload className="mr-2 h-5 w-5" />
                    Upload Document
                  </Link>
                </Button>
               <Button asChild variant="outline">
              <Link href="/batch-upload">
                <Upload className="w-4 h-4 mr-2" />
                Batch Upload
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/analytics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/lakehouse">
                <Database className="w-4 h-4 mr-2" />
                Lakehouse
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/templates">
                <FileType className="w-4 h-4 mr-2" />
                Templates
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/custom-templates">
                <Wrench className="w-4 h-4 mr-2" />
                Custom
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/batch-template-application">
                <Layers className="w-4 h-4 mr-2" />
                Batch Apply
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/progress-dashboard">
                <Activity className="w-4 h-4 mr-2" />
                Progress
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/export">
                <FileDown className="w-4 h-4 mr-2" />
                Export
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/scheduled-exports">
                <CalendarClock className="w-4 h-4 mr-2" />
                Scheduled
              </Link>
            </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/documents">View Documents</Link>
                </Button>
              </>
            ) : (
              <Button size="lg" asChild>
                <a href={getLoginUrl()}>Get Started</a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <div className="rounded-lg bg-primary/10 p-3 w-fit mb-2">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>Average processing time of just 425ms per document</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="rounded-lg bg-primary/10 p-3 w-fit mb-2">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Highly Accurate</CardTitle>
              <CardDescription>96% accuracy with our highest_confidence ensemble strategy</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="rounded-lg bg-primary/10 p-3 w-fit mb-2">
                <FileSearch className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Smart Extraction</CardTitle>
              <CardDescription>Automatically extracts SSN, dates, amounts, and more</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Supported Categories */}
      <section className="container py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Supported Document Categories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "👤", title: "Citizenship & Identity", desc: "Birth certificates, passports" },
              { icon: "🛂", title: "Immigration Status", desc: "Visas, green cards, work permits" },
              { icon: "💼", title: "Income & Employment", desc: "Pay stubs, W-2 forms, tax returns" },
              { icon: "🪶", title: "Tribal/AIAN", desc: "Tribal enrollment certificates" },
              { icon: "🏥", title: "Health Coverage", desc: "Insurance cards, coverage letters" },
              { icon: "📄", title: "Supporting Documents", desc: "Address verification, bank statements" },
            ].map((category, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{category.icon}</span>
                    <div>
                      <CardTitle className="text-base">{category.title}</CardTitle>
                      <CardDescription className="text-sm">{category.desc}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container py-16">
        <Card className="max-w-5xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
          <CardContent className="pt-12 pb-12">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-5xl font-bold mb-2">96%</div>
                <div className="text-blue-100">Accuracy Rate</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">425ms</div>
                <div className="text-blue-100">Avg. Processing Time</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">150+</div>
                <div className="text-blue-100">Document Types</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <Card className="max-w-3xl mx-auto text-center">
          <CardContent className="pt-12 pb-12">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Upload your first document and experience the power of intelligent OCR processing.
            </p>
            {user ? (
              <Button size="lg" asChild>
                <Link href="/upload">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Your First Document
                </Link>
              </Button>
            ) : (
              <Button size="lg" asChild>
                <a href={getLoginUrl()}>Sign In to Get Started</a>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm py-8">
        <div className="container text-center text-muted-foreground">
          <p>&copy; 2025 {APP_TITLE}. Powered by multi-engine OCR ensemble technology.</p>
        </div>
      </footer>
    </div>
  );
}
