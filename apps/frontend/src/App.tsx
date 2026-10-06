import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import WhatsAppAccountPage from "@/pages/whatsapp-account";
import TemplatesPage from "@/pages/templates/templates-list";
import TemplateBuilderPage from "@/pages/templates/template-builder";
import ContactsPage from "@/pages/contacts/contacts-list";
import CampaignsPage from "@/pages/campaigns/campaigns-list";
import CampaignWizardPage from "@/pages/campaigns/campaign-wizard";
import CampaignDetailPage from "@/pages/campaigns/campaign-detail";
import NotificationsPage from "@/pages/notifications";
import ConversationsPage from "@/pages/conversations";
import SendNotificationPage from "@/pages/send-notification";
import ApiIntegrationPage from "@/pages/api-integration";
import LogsPage from "@/pages/logs";
import SettingsPage from "@/pages/settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/whatsapp-account" element={<WhatsAppAccountPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/new" element={<TemplateBuilderPage />} />
        <Route path="/templates/:id/edit" element={<TemplateBuilderPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/new" element={<CampaignWizardPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/send" element={<SendNotificationPage />} />
        <Route path="/api-integration" element={<ApiIntegrationPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
