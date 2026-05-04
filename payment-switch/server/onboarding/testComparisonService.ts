import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { testExecutions, testScenarios } from "../../drizzle/schema";

/**
 * Compare two test executions
 */
export async function compareExecutions(executionId1: number, executionId2: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get both executions
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
      createdAt: testExecutions.createdAt,
    })
    .from(testExecutions)
    .leftJoin(testScenarios, eq(testExecutions.scenarioId, testScenarios.id))
    .where(eq(testExecutions.id, executionId1));

  const executions2 = await db
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
      createdAt: testExecutions.createdAt,
    })
    .from(testExecutions)
    .leftJoin(testScenarios, eq(testExecutions.scenarioId, testScenarios.id))
    .where(eq(testExecutions.id, executionId2));

  if (executions.length === 0 || executions2.length === 0) {
    throw new Error("One or both executions not found");
  }

  const execution1 = executions[0];
  const execution2 = executions2[0];

  // Calculate durations
  const duration1 =
    execution1.startedAt && execution1.completedAt
      ? new Date(execution1.completedAt).getTime() - new Date(execution1.startedAt).getTime()
      : null;

  const duration2 =
    execution2.startedAt && execution2.completedAt
      ? new Date(execution2.completedAt).getTime() - new Date(execution2.startedAt).getTime()
      : null;

  // Parse result JSON
  let result1Data = null;
  let result2Data = null;

  try {
    result1Data = execution1.result ? JSON.parse(execution1.result) : null;
  } catch (e) {
    result1Data = execution1.result;
  }

  try {
    result2Data = execution2.result ? JSON.parse(execution2.result) : null;
  } catch (e) {
    result2Data = execution2.result;
  }

  // Calculate differences
  const differences = {
    status: execution1.status !== execution2.status,
    duration: duration1 !== duration2,
    result: JSON.stringify(result1Data) !== JSON.stringify(result2Data),
    errorMessage: execution1.errorMessage !== execution2.errorMessage,
    scenario: execution1.scenarioId !== execution2.scenarioId,
  };

  const durationDiff = duration1 && duration2 ? duration2 - duration1 : null;

  return {
    execution1: {
      ...execution1,
      duration: duration1,
      resultData: result1Data,
    },
    execution2: {
      ...execution2,
      duration: duration2,
      resultData: result2Data,
    },
    differences,
    durationDiff,
    summary: {
      statusChanged: differences.status,
      durationChanged: differences.duration,
      resultChanged: differences.result,
      errorChanged: differences.errorMessage,
      scenarioChanged: differences.scenario,
    },
  };
}
