import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { InstallPWA } from "./components/InstallPWA";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { NotificationBell } from "./components/NotificationBell";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import BatchUpload from "./pages/BatchUpload";
import Batches from "./pages/Batches";
import BatchDetail from "./pages/BatchDetail";
import CompareDocuments from "./pages/CompareDocuments";
import ComparisonView from "./pages/ComparisonView";
import Analytics from "./pages/Analytics";
import LakehouseExplorer from "./pages/LakehouseExplorer";
import Notifications from "./pages/Notifications";
import ReviewQueue from "./pages/ReviewQueue";
import DocumentTemplates from "./pages/DocumentTemplates";
import ProgressDashboard from "./pages/ProgressDashboard";
import BulkExport from "./pages/BulkExport";
import ScheduledExports from "./pages/ScheduledExports";
import CustomTemplates from "./pages/CustomTemplates";
import TemplateBuilder from "./pages/TemplateBuilder";
import BatchTemplateApplication from "./pages/BatchTemplateApplication";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/upload" component={Upload} />
      <Route path="/documents" component={Documents} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/batch-upload" component={BatchUpload} />      <Route path={"/batches"} component={Batches} />
      <Route path={"/batches/:id"} component={BatchDetail} />
         <Route path="/compare" component={CompareDocuments} />
      <Route path="/compare/view" component={ComparisonView} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/lakehouse" component={LakehouseExplorer} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/review-queue" component={ReviewQueue} />
      <Route path="/templates" component={DocumentTemplates} />
      <Route path="/progress-dashboard" component={ProgressDashboard} />
      <Route path="/export" component={BulkExport} />
      <Route path="/scheduled-exports" component={ScheduledExports} />
      <Route path="/custom-templates" component={CustomTemplates} />
      <Route path="/template-builder" component={TemplateBuilder} />
      <Route path="/batch-template-application" component={BatchTemplateApplication} />
      <Route path="/404" component={NotFound} />    {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <InstallPWA />
          <ConnectionStatus />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
