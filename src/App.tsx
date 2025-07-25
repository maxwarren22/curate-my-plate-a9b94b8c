import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  console.log('App component is rendering...');
  
  return (
    <div style={{padding: '20px', backgroundColor: 'red', color: 'white', fontSize: '24px'}}>
      <h1>TEST - React App is Working!</h1>
      <p>If you can see this, React is rendering correctly.</p>
    </div>
  );
};

export default App;
