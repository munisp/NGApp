export function createNotification(data: { title: string; body: string; type?: string; userId?: string }) {
  return { id: 'notif_' + Date.now(), ...data, createdAt: new Date().toISOString(), read: false };
}
