import { initializeDefaultTemplates } from "./server/onboarding/permissionService.ts";

console.log("Initializing default permission templates...");
await initializeDefaultTemplates();
console.log("Default templates initialized successfully!");
process.exit(0);
