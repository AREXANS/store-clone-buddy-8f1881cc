import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import KeySystem from "./pages/KeySystem";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BackgroundProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/developer" element={<Admin />} />
            <Route path="/key-system" element={<KeySystem />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </BackgroundProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
