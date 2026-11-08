import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { ResourcePage } from "@/components/ResourcePage";
import { RequireAuth } from "@/lib/auth";
import { getResource } from "@/lib/resources";
import { ChatLogs } from "@/pages/ChatLogs";
import { Dashboard } from "@/pages/Dashboard";
import { Login } from "@/pages/Login";
import { Messages } from "@/pages/Messages";
import { Profile } from "@/pages/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

const resourceRoutes = [
  "projects",
  "screenshots",
  "skills",
  "skill-categories",
  "education",
  "experience",
  "certifications",
  "achievements",
  "faqs",
  "socials",
  "suggestions",
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            {resourceRoutes.map((key) => {
              const config = getResource(key);
              if (!config) return null;
              return (
                <Route
                  key={key}
                  path={key}
                  element={<ResourcePage config={config} />}
                />
              );
            })}
            <Route path="profile" element={<Profile />} />
            <Route path="messages" element={<Messages />} />
            <Route path="chat-logs" element={<ChatLogs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
