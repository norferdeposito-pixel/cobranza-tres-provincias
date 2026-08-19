import { useEffect } from "react";
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
import { isCollectionsApp } from "@/lib/appBrand";

const queryClient = new QueryClient();
const collectionsDeployment = isCollectionsApp();

const ActiveMonthGuard = () => {
  useEffect(() => {
    if (!collectionsDeployment) return;

    const storageKey = "cobranza-active-month-ui-v1";

    const rememberUserMonth = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== "active-month" || target.type !== "month") return;
      if (!event.isTrusted || !/^\d{4}-\d{2}$/.test(target.value)) return;
      window.sessionStorage.setItem(storageKey, target.value);
    };

    const restoreUserMonth = () => {
      const desiredMonth = window.sessionStorage.getItem(storageKey);
      if (!desiredMonth) return;

      const input = document.getElementById("active-month");
      if (!(input instanceof HTMLInputElement) || input.value === desiredMonth) return;

      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (valueSetter) valueSetter.call(input, desiredMonth);
      else input.value = desiredMonth;

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    document.addEventListener("change", rememberUserMonth, true);
    const intervalId = window.setInterval(restoreUserMonth, 250);

    return () => {
      document.removeEventListener("change", rememberUserMonth, true);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserProfileProvider>
          <ActiveMonthGuard />
          <Routes>
            <Route
              path="/"
              element={
                <RequireUserProfile>
                  {collectionsDeployment ? <InsuranceCollections /> : <Index />}
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
            <Route
              path="/cobranza"
              element={
                <RequireUserProfile>
                  <InsuranceCollections />
                </RequireUserProfile>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </UserProfileProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
