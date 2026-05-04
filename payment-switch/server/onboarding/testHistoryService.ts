import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getDb } from "../db";
import { testExecutions, testScenarios } from "../../drizzle/schema";

/**
 * Get test execution history with filtering and pagination
 */
export async function getTestHistory(params: {
  credentialId: number;
  scenarioId?: number;
  status?: "pending" | "running" | "passed" | "failed";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(testExecutions.credentialId, params.credentialId)];

  if (params.scenarioId) {
    conditions.push(eq(testExecutions.scenarioId, params.scenarioId));
  }

  if (params.status) {
    conditions.push(eq(testExecutions.status, params.status));
  }

  if (params.startDate) {
    conditions.push(gte(testExecutions.createdAt, params.startDate));
  }

  if (params.endDate) {
    conditions.push(lte(testExecutions.createdAt, params.endDate));
  }

  const limit = params.limit || 50;
  const offset = params.offset || 0;

  // Get executions with scenario names
  const executions = await db
    .select({
      id: testExecutions.id,
      scenarioId: testExecutions.scenarioId,
      scenarioName: testScenarios.name,
      status: testExecutions.status,
      startedAt: testExecutions.startedAt,
      completedAt: testExecutions.completedAt,
      result: testExecutions.result,
      errorMessage: testExecutions.errorMessage,
    })
    .from(testExecutions)
    .leftJoin(testScenarios, eq(testExecutions.scenarioId, testScenarios.id))
    .where(and(...conditions))
    .orderBy(desc(testExecutions.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: testExecutions.id })
    .from(testExecutions)
    .where(and(...conditions));

  const total = countResult.length;

  return {
    executions,
    total,
    limit,
    offset,
  };
}

/**
 * Get detailed execution information
 */
export async function getExecutionDetails(executionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const executions = await db
    .select({
      id: testExecutions.id,
      scenarioId: testExecutions.scenarioId,
      scenarioName: testScenarios.name,
      scenarioDescription: testScenarios.description,
      status: testExecutions.status,
      startedAt: testExecutions.startedAt,
      completedAt: testExecutions.completedAt,
      result: testExecutions.result,
      errorMessage: testExecutions.errorMessage,
      logs: testExecutions.logs,
    })
    .from(testExecutions)
    .leftJoin(testScenarios, eq(testExecutions.scenarioId, testScenarios.id))
    .where(eq(testExecutions.id, executionId))
    .limit(1);

  if (executions.length === 0) {
    throw new Error("Execution not found");
  }

  return executions[0];
}

/**
 * Get execution statistics
 */
export async function getHistoryStats(credentialId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all executions for this credential
  const executions = await db
    .select()
    .from(testExecutions)
    .where(eq(testExecutions.credentialId, credentialId));

  const totalRuns = executions.length;
  const passedRuns = executions.filter((e) => e.status === "passed").length;
  const failedRuns = executions.filter((e) => e.status === "failed").length;

  const successRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

  // Calculate average duration (in milliseconds)
  const durations = executions
    .filter((e) => e.startedAt && e.completedAt)
    .map((e) => {
      const start = new Date(e.startedAt!).getTime();
      const end = new Date(e.completedAt!).getTime();
      return end - start;
    });

  const avgDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  // Get recent executions (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentExecutions = executions.filter(
    (e) => new Date(e.createdAt) >= sevenDaysAgo
  );

  return {
    totalRuns,
    passedRuns,
    failedRuns,

    successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
    avgDuration: Math.round(avgDuration),
    recentRuns: recentExecutions.length,
  };
}
