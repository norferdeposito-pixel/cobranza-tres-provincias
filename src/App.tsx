import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import InsuranceCollections from "./pages/InsuranceCollections.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { RequireUserProfile } from "@/components/RequireUserProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserProfileProvider>
          <Routes>
            <Route
              path="/"
              element={
                <RequireUserProfile>
                  <Index />
                </RequireUserProfile>
              }
            />
            <Route
              path="/compras"
              element={
                <RequireUserProfile>
                  <Index />
                </RequireUserProfile>
              }
            />
            <Route path="/cobranza" element={<InsuranceCollections />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserProfileProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
