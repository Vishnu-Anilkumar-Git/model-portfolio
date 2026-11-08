import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
