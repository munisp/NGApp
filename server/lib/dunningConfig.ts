export const DUNNING_CONFIG = {
  maxRetries: 3,
  retryIntervals: [3, 7, 14], // days
  gracePeriodDays: 14,
  suspensionAfterDays: 21,
  notificationChannels: ["email", "kafka", "sms"],
};
