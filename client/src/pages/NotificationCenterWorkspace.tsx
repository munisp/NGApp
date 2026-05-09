import { Bell } from "lucide-react";
import CrudWorkspace, { type CrudConfig } from "@/components/CrudWorkspace";

const config: CrudConfig = {
  domainKey: "notification-center",
  title: "Notification Center",
  subtitle: "Multi-channel notifications — email, SMS, push, in-app, WhatsApp with templates and delivery tracking",
  icon: Bell,
  accentColor: "bg-yellow-600",
  idField: "id",
  statusField: "status",
  searchFields: ["id", "recipient", "recipientId", "channel", "subject"],
  apiBase: "/api/platform/notifications",
  fields: [
    { key: "channel", label: "Channel", type: "select", options: ["email", "sms", "push", "in_app", "whatsapp"], required: true },
    { key: "recipient", label: "Recipient", type: "text", required: true },
    { key: "recipientId", label: "Recipient ID", type: "text" },
    { key: "subject", label: "Subject", type: "text", required: true },
    { key: "body", label: "Body", type: "text", required: true },
    { key: "templateId", label: "Template ID", type: "text" },
    { key: "priority", label: "Priority", type: "select", options: ["critical", "high", "normal", "low"], defaultValue: "normal" },
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "channel", label: "Channel" },
    { key: "recipient", label: "Recipient" },
    { key: "subject", label: "Subject" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "sentAt", label: "Sent" },
  ],
  actions: [
    { label: "Resend", key: "resend", condition: (r) => r.status === "failed" },
    { label: "Mark Read", key: "mark_read", condition: (r) => r.status === "delivered" },
  ],
};

export default function NotificationCenterWorkspace() {
  return <CrudWorkspace config={config} />;
}
