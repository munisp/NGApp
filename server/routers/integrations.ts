import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  osduDatasets, witsmlWells, prodmlProductionSets, cmmsWorkOrders, cmmsIntegrations, opcuaServerNodes,
  type OsduDataset, type WitsmlWell, type CmmsWorkOrder, type OpcuaServerNode,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

export const integrationsRouter = router({
  // ════════════════════════════════════════════════════════════════════════
  // OSDU R3
  // ════════════════════════════════════════════════════════════════════════
  listOsduDatasets: protectedProcedure
    .input(z.object({
      kind: z.string().optional(),
      namespace: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().int().max(200).default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(osduDatasets).orderBy(desc(osduDatasets.createdAt)).limit(input?.limit ?? 50);
      let filtered: OsduDataset[] = rows;
      if (input?.kind) { const k = input.kind; filtered = filtered.filter((r: OsduDataset) => r.kind.includes(k)); }
      if (input?.namespace) { const n = input.namespace; filtered = filtered.filter((r: OsduDataset) => r.namespace === n); }
      if (input?.search) { const q = input.search.toLowerCase(); filtered = filtered.filter((r: OsduDataset) => r.datasetId.toLowerCase().includes(q) || r.kind.toLowerCase().includes(q)); }
      return filtered;
    }),

  createOsduDataset: adminProcedure
    .input(z.object({
      kind: z.string().min(1),
      namespace: z.string().default("opendes"),
      version: z.string().default("1.0.0"),
      acl: z.string().optional(),
      legal: z.string().optional(),
      tags: z.string().optional(),
      data: z.string().optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const datasetId = `opendes:dataset--${input.kind.replace(/[^a-zA-Z0-9]/g, "-")}:${nanoid(8)}`;
      const [row] = await db.insert(osduDatasets).values({
        ...input,
        datasetId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  getOsduDataset: protectedProcedure
    .input(z.object({ datasetId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(osduDatasets).where(eq(osduDatasets.datasetId, input.datasetId));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  // ════════════════════════════════════════════════════════════════════════
  // WITSML Wells
  // ════════════════════════════════════════════════════════════════════════
  listWitsmlWells: protectedProcedure
    .input(z.object({
      statusWell: z.string().optional(),
      operator: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(witsmlWells).orderBy(witsmlWells.name);
      let filtered: WitsmlWell[] = rows;
      if (input?.statusWell) { const s = input.statusWell; filtered = filtered.filter((r: WitsmlWell) => r.statusWell === s); }
      if (input?.operator) { const o = input.operator; filtered = filtered.filter((r: WitsmlWell) => r.operator === o); }
      return filtered;
    }),

  createWitsmlWell: adminProcedure
    .input(z.object({
      uid: z.string().min(1),
      name: z.string().min(1),
      nameLegal: z.string().optional(),
      country: z.string().optional(),
      field: z.string().optional(),
      operator: z.string().optional(),
      numLicense: z.string().optional(),
      statusWell: z.string().optional(),
      purposeWell: z.string().optional(),
      fluidWell: z.string().optional(),
      groundElevation: z.number().optional(),
      waterDepth: z.number().optional(),
      dTimSpud: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(witsmlWells).values({
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  // PRODML Production Sets
  listProdmlSets: protectedProcedure
    .input(z.object({ uidWell: z.string(), limit: z.number().int().max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(prodmlProductionSets)
        .where(eq(prodmlProductionSets.uidWell, input.uidWell))
        .orderBy(desc(prodmlProductionSets.dTimStart))
        .limit(input.limit);
    }),

  createProdmlSet: adminProcedure
    .input(z.object({
      uidWell: z.string().min(1),
      dTimStart: z.date(),
      dTimEnd: z.date(),
      oilVolume: z.number().optional(),
      gasVolume: z.number().optional(),
      waterVolume: z.number().optional(),
      condensateVolume: z.number().optional(),
      injectedWaterVolume: z.number().optional(),
      volumeUom: z.string().default("bbl"),
      pressureAvg: z.number().optional(),
      tempAvg: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const uid = `PROD-${nanoid(12).toUpperCase()}`;
      const [row] = await db.insert(prodmlProductionSets).values({
        ...input,
        uid,
        createdAt: new Date(),
      }).returning();
      return row;
    }),

  // ════════════════════════════════════════════════════════════════════════
  // SAP PM / IBM Maximo CMMS
  // ════════════════════════════════════════════════════════════════════════
  listCmmsWorkOrders: protectedProcedure
    .input(z.object({
      cmmsSystem: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      wellId: z.string().optional(),
      limit: z.number().int().max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(cmmsWorkOrders).orderBy(desc(cmmsWorkOrders.createdAt)).limit(input?.limit ?? 100);
      let filtered: CmmsWorkOrder[] = rows;
      if (input?.cmmsSystem) { const s = input.cmmsSystem; filtered = filtered.filter((r: CmmsWorkOrder) => r.cmmsSystem === s); }
      if (input?.status) { const s = input.status; filtered = filtered.filter((r: CmmsWorkOrder) => r.status === s); }
      if (input?.priority) { const p = input.priority; filtered = filtered.filter((r: CmmsWorkOrder) => r.priority === p); }
      if (input?.wellId) { const w = input.wellId; filtered = filtered.filter((r: CmmsWorkOrder) => r.wellId === w); }
      return filtered;
    }),

  createCmmsWorkOrder: adminProcedure
    .input(z.object({
      cmmsSystem: z.enum(["sap_pm", "maximo", "infor_eam", "oracle_eam"]).default("sap_pm"),
      title: z.string().min(1),
      description: z.string().optional(),
      wellId: z.string().optional(),
      assetId: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
      workOrderType: z.enum(["corrective", "preventive", "predictive", "inspection"]).default("corrective"),
      assignedTo: z.string().optional(),
      plannedStart: z.date().optional(),
      plannedEnd: z.date().optional(),
      estimatedHours: z.number().optional(),
      estimatedCost: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const workOrderNumber = `WO-${Date.now().toString(36).toUpperCase()}`;
      const [row] = await db.insert(cmmsWorkOrders).values({
        ...input,
        workOrderNumber,
        status: "open",
        syncStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  updateCmmsWorkOrder: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      actualStart: z.date().optional(),
      actualEnd: z.date().optional(),
      actualHours: z.number().optional(),
      actualCost: z.number().optional(),
      syncStatus: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(cmmsWorkOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(cmmsWorkOrders.id, id))
        .returning();
      return row;
    }),

  listCmmsIntegrations: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(cmmsIntegrations).orderBy(cmmsIntegrations.cmmsSystem);
  }),

  createCmmsIntegration: adminProcedure
    .input(z.object({
      tenantId: z.string().min(1),
      cmmsSystem: z.string().min(1),
      baseUrl: z.string().optional(),
      authType: z.string().default("basic"),
      username: z.string().optional(),
      syncInterval: z.number().int().default(300),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(cmmsIntegrations).values({
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  // ════════════════════════════════════════════════════════════════════════
  // OPC-UA Server Nodes
  // ════════════════════════════════════════════════════════════════════════
  listOpcuaNodes: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      nodeClass: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(opcuaServerNodes).orderBy(opcuaServerNodes.nodeId);
      let filtered: OpcuaServerNode[] = rows;
      if (input?.wellId) { const w = input.wellId; filtered = filtered.filter((r: OpcuaServerNode) => r.wellId === w); }
      if (input?.nodeClass) { const n = input.nodeClass; filtered = filtered.filter((r: OpcuaServerNode) => r.nodeClass === n); }
      if (input?.isActive !== undefined) { const a = input.isActive; filtered = filtered.filter((r: OpcuaServerNode) => r.isActive === a); }
      return filtered;
    }),

  createOpcuaNode: adminProcedure
    .input(z.object({
      nodeId: z.string().min(1),
      displayName: z.string().min(1),
      nodeClass: z.string().default("Variable"),
      dataType: z.string().default("Double"),
      tagName: z.string().optional(),
      wellId: z.string().optional(),
      accessLevel: z.enum(["read", "write", "readwrite"]).default("read"),
      description: z.string().optional(),
      engineeringUnit: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(opcuaServerNodes).values({
        ...input,
        isActive: true,
        createdAt: new Date(),
      }).returning();
      return row;
    }),

  getOpcuaServerInfo: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalNodes: 0, activeNodes: 0, byClass: {} };
    const nodes = await db.select().from(opcuaServerNodes);
    const totalNodes = nodes.length;
    const activeNodes = nodes.filter((n: OpcuaServerNode) => n.isActive).length;
    const byClass: Record<string, number> = {};
    for (const n of nodes) {
      byClass[n.nodeClass] = (byClass[n.nodeClass] || 0) + 1;
    }
    return {
      totalNodes,
      activeNodes,
      byClass,
      serverEndpoint: "opc.tcp://og-rmm.internal:4840",
      serverVersion: "1.04",
      securityMode: "SignAndEncrypt",
    };
  }),

  seedOpcuaNodes: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const defaults = [
      { nodeId: "ns=2;s=WELL001.THP", displayName: "Well-001 Tubing Head Pressure", nodeClass: "Variable", dataType: "Double", tagName: "WELL-001.TUBING_PRESSURE", wellId: "WELL-001", engineeringUnit: "psi" },
      { nodeId: "ns=2;s=WELL001.CHP", displayName: "Well-001 Casing Head Pressure", nodeClass: "Variable", dataType: "Double", tagName: "WELL-001.CASING_PRESSURE", wellId: "WELL-001", engineeringUnit: "psi" },
      { nodeId: "ns=2;s=WELL001.FLOW", displayName: "Well-001 Flow Rate", nodeClass: "Variable", dataType: "Double", tagName: "WELL-001.FLOW_RATE", wellId: "WELL-001", engineeringUnit: "bbl/d" },
      { nodeId: "ns=2;s=WELL001.STATUS", displayName: "Well-001 Status", nodeClass: "Variable", dataType: "String", tagName: "WELL-001.STATUS", wellId: "WELL-001", engineeringUnit: "" },
      { nodeId: "ns=2;s=FACILITY.GAS_FLOW", displayName: "Facility Gas Flow", nodeClass: "Variable", dataType: "Double", tagName: "FACILITY.GAS_FLOW", engineeringUnit: "MMscfd" },
    ];
    for (const d of defaults) {
      await db.insert(opcuaServerNodes).values({
        ...d,
        accessLevel: "read",
        isActive: true,
        createdAt: new Date(),
      }).onConflictDoNothing();
    }
    return { seeded: defaults.length };
  }),
});
