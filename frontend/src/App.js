import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppProvider } from "./contexts/AppContext";
import { Toaster } from "./components/ui/sonner";

import Landing from "./pages/Landing";
import Quiz from "./pages/Quiz";
import Demo from "./pages/Demo";
import Conversion from "./pages/Conversion";
import Signup from "./pages/Signup";
import PostSignup from "./pages/PostSignup";
import AuthCallback from "./pages/AuthCallback";
import Privacy from "./pages/Privacy";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import VideosPage from "./pages/admin/VideosPage";
import VideoEditor from "./pages/admin/VideoEditor";
import FlowsPage from "./pages/admin/FlowsPage";
import CoveragePage from "./pages/admin/CoveragePage";
import KBPage from "./pages/admin/KBPage";
import MiniDemosPage from "./pages/admin/MiniDemosPage";
import QuizOptionsPage from "./pages/admin/QuizOptionsPage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import UnansweredPage from "./pages/admin/UnansweredPage";
import SettingsPage from "./pages/admin/SettingsPage";

function Router() {
  const location = useLocation();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash && location.hash.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/quiz" element={<Quiz />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/conversion" element={<Conversion />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<PostSignup />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="videos/:id" element={<VideoEditor />} />
        <Route path="flows" element={<FlowsPage />} />
        <Route path="coverage" element={<CoveragePage />} />
        <Route path="kb" element={<KBPage />} />
        <Route path="mini-demos" element={<MiniDemosPage />} />
        <Route path="quiz-options" element={<QuizOptionsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="unanswered" element={<UnansweredPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Router />
        <Toaster />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
