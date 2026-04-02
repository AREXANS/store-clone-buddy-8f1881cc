import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { useIpBlock } from "./hooks/useIpBlock";
import BlockedScreen from "./components/BlockedScreen";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import KeySystem from "./pages/KeySystem";
import XCoins from "./pages/XCoins";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import LoaderAccessDenied from "./pages/LoaderAccessDenied";

const queryClient = new QueryClient();

const AppContent = () => {
  const { loading, blocked, reason } = useIpBlock();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (blocked) {
    return <BlockedScreen reason={reason} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/developer" element={<Admin />} />
        <Route path="/key-system" element={<KeySystem />} />
        <Route path="/xcoins" element={<XCoins />} />
        <Route path="/history" element={<History />} />
        <Route path="/loader" element={<LoaderAccessDenied />} />
        <Route path="/access-denied" element={<LoaderAccessDenied />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BackgroundProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </BackgroundProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
