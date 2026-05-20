export async function dispatchSecurityAlert(alert: any) {
  return { sent: true, channels: ["email", "slack"] };
}
export async function getDeliveryHistory() {
  return [];
}
export async function getDeliveryStats() {
  return { total: 0, delivered: 0, failed: 0 };
}
export async function sendTestAlert() {
  return { sent: true };
}
export async function getAdminPreferences() {
  return [];
}
export async function getAdminPreference(id: string) {
  return { id, enabled: true };
}
export async function updateAdminPreference(id: string, data: any) {
  return { id, ...data };
}
export async function addAdminPreference(data: any) {
  return { id: "new", ...data };
}
