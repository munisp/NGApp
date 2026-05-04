import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as service from "./productionGoLiveService";
import * as alertsService from "./monitoringAlertsService";
import * as slackService from "./slackNotificationService";

export const productionGoLiveRouter = router({
  // Initialize go-live checklist
  initializeChecklist: protectedProcedure
    .input(z.object({ applicationId: z.number() }))
    .mutation(async ({ input }) => {
      return await service.initializeGoLiveChecklist(input.applicationId);
    }),

  // Get go-live checklist
  getChecklist: protectedProcedure
    .input(z.object({ applicationId: z.number() }))
    .query(async ({ input }) => {
      return await service.getGoLiveChecklist(input.applicationId);
    }),

  // Update checklist item
  updateChecklistItem: protectedProcedure
    .input(
      z.object({
        applicationId: z.number(),
        updates: z.object({
          certificationPassed: z.boolean().optional(),
          securityAuditCompleted: z.boolean().optional(),
          complianceVerified: z.boolean().optional(),
          integrationTested: z.boolean().optional(),
          documentationReviewed: z.boolean().optional(),
          supportContactsProvided: z.boolean().optional(),
          disasterRecoveryPlanSubmitted: z.boolean().optional(),
          productionEndpointsConfigured: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      return await service.updateChecklistItem(
        input.applicationId,
        input.updates
      );
    }),

  // Validate go-live readiness
  validateGoLive: protectedProcedure
    .input(z.object({ applicationId: z.number() }))
    .query(async ({ input }) => {
      return await service.validateGoLiveReadiness(input.applicationId);
    }),

  // Request production access
  requestProductionAccess: protectedProcedure
    .input(
      z.object({
        applicationId: z.number(),
        productionEndpoint: z.string().url(),
        productionWebhookUrl: z.string().url().optional(),
        dailyTransactionLimit: z.number().positive(),
        monthlyTransactionLimit: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { applicationId, ...config } = input;
      return await service.requestProductionAccess(
        applicationId,
        ctx.user.id,
        config
      );
    }),

  // Get production credentials
  getProductionCredentials: protectedProcedure
    .input(z.object({ applicationId: z.number() }))
    .query(async ({ input }) => {
      return await service.getProductionCredentials(input.applicationId);
    }),

  // Admin: Activate production access
  activateProductionAccess: adminProcedure
    .input(z.object({ credentialId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return await service.activateProductionAccess(
        input.credentialId,
        ctx.user.id
      );
    }),

  // Get monitoring data
  getMonitoringData: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      return await service.getMonitoringData(
        input.credentialId,
        input.startDate,
        input.endDate
      );
    }),

  // Record monitoring metrics (Internal/Admin)
  recordMonitoringMetrics: adminProcedure
    .input(
      z.object({
        credentialId: z.number(),
        totalTransactions: z.number(),
        successfulTransactions: z.number(),
        failedTransactions: z.number(),
        averageResponseTime: z.number().optional(),
        peakTps: z.number().optional(),
        uptimePercentage: z.number().optional(),
        errorRate: z.number().optional(),
        alertsTriggered: z.number().optional(),
        incidentsReported: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { credentialId, ...metrics } = input;
      return await service.recordMonitoringMetrics(credentialId, metrics);
    }),

  // Create incident report
  createIncident: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        incidentType: z.enum([
          "outage",
          "performance_degradation",
          "security_breach",
          "data_issue",
          "integration_failure",
          "other",
        ]),
        severity: z.enum(["low", "medium", "high", "critical"]),
        title: z.string(),
        description: z.string(),
        affectedTransactions: z.number().optional(),
        estimatedDowntime: z.number().optional(),
        financialImpact: z.number().optional(),
        occurredAt: z.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { credentialId, ...incident } = input;
      return await service.createIncidentReport(
        credentialId,
        ctx.user.id,
        incident
      );
    }),

  // Update incident status
  updateIncident: protectedProcedure
    .input(
      z.object({
        incidentId: z.number(),
        status: z.enum(["open", "investigating", "resolved", "closed"]).optional(),
        resolution: z.string().optional(),
        resolvedBy: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { incidentId, ...updates } = input;
      return await service.updateIncidentStatus(incidentId, updates);
    }),

  // Get incidents
  getIncidents: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await service.getIncidents(input.credentialId, input.status);
    }),

  // Alert Management
  createAlertRule: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        ruleName: z.string(),
        metricType: z.enum(["error_rate", "response_time", "transaction_volume", "uptime", "failure_rate", "peak_tps"]),
        operator: z.enum(["greater_than", "less_than", "equals", "not_equals"]),
        thresholdValue: z.number(),
        duration: z.number().optional(),
        severity: z.enum(["info", "warning", "critical"]),
        enabled: z.boolean().optional(),
        notifyEmail: z.boolean().optional(),
        notifyInApp: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { credentialId, ...rule } = input;
      return await alertsService.createAlertRule(credentialId, ctx.user.id, rule);
    }),

  updateAlertRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number(),
        ruleName: z.string().optional(),
        thresholdValue: z.number().optional(),
        duration: z.number().optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        enabled: z.boolean().optional(),
        notifyEmail: z.boolean().optional(),
        notifyInApp: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { ruleId, ...updates } = input;
      return await alertsService.updateAlertRule(ruleId, updates);
    }),

  deleteAlertRule: protectedProcedure
    .input(z.object({ ruleId: z.number() }))
    .mutation(async ({ input }) => {
      return await alertsService.deleteAlertRule(input.ruleId);
    }),

  getAlertRules: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .query(async ({ input }) => {
      return await alertsService.getAlertRules(input.credentialId);
    }),

  getActiveAlerts: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .query(async ({ input }) => {
      return await alertsService.getActiveAlerts(input.credentialId);
    }),

  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return await alertsService.acknowledgeAlert(input.alertId, ctx.user.id);
    }),

  resolveAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return await alertsService.resolveAlert(input.alertId, ctx.user.id);
    }),

  getAlertHistory: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return await alertsService.getAlertHistory(input.credentialId, input.limit);
    }),

  evaluateMonitoringData: adminProcedure
    .input(
      z.object({
        credentialId: z.number(),
        monitoringData: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      return await alertsService.evaluateMonitoringData(
        input.credentialId,
        input.monitoringData
      );
    }),

  detectAnomalies: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        currentData: z.any(),
      })
    )
    .query(async ({ input }) => {
      return await alertsService.detectAnomalies(
        input.credentialId,
        input.currentData
      );
    }),

  // Slack Integration
  configureSlackWebhook: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        webhookUrl: z.string().url(),
        channelName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await slackService.configureSlackWebhook(
        input.credentialId,
        input.webhookUrl,
        input.channelName
      );
    }),

  getSlackConfiguration: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .query(async ({ input }) => {
      return await slackService.getSlackConfiguration(input.credentialId);
    }),

  testSlackWebhook: protectedProcedure
    .input(z.object({ webhookUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      return await slackService.testSlackWebhook(input.webhookUrl);
    }),

  enableSlackNotifications: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .mutation(async ({ input }) => {
      return await slackService.enableSlackNotifications(input.credentialId);
    }),

  disableSlackNotifications: protectedProcedure
    .input(z.object({ credentialId: z.number() }))
    .mutation(async ({ input }) => {
      return await slackService.disableSlackNotifications(input.credentialId);
    }),
});
