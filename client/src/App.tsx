import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import InventoryPage from "@/pages/inventory";
import OrdersPage from "@/pages/orders";
import BooksPage from "@/pages/books";
import EmployeesPage from "@/pages/employees";

function ProtectedRoute({ 
  component: Component, 
  page 
}: { 
  component: React.ComponentType; 
  page: string;
}) {
  const { canAccessPage, isLoading, user } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-pulse text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }
  
  if (!user || !canAccessPage(page)) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/books" component={BooksPage} />
      <Route path="/employees">
        {() => <ProtectedRoute component={EmployeesPage} page="employees" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const sidebarStyle = {
    "--sidebar-width": "12rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="hidden sm:flex" />
            <div className="sm:hidden" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
