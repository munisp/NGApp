/**
 * ERPNext-inspired Materials Management tRPC Router
 * Covers: Material Master, Supplier Catalog, Inventory Locations,
 * Batch/Lot Tracking, Procurement Workflow (MR → PO → GRN),
 * Field Operations (Transfer, Issue, Return tickets), Mud Tank Snapshots
 * Uses raw pg Pool queries for tables not in the Drizzle schema.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getPool } from "../db";
import { TRPCError } from "@trpc/server";
import type { Pool } from "pg";
import { withCache, cacheKey, cacheInvalidateRouter, TTL } from "../cache";

async function pool(): Promise<Pool> {
  const p = await getPool();
  if (!p) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return p;
}

// ─── Material Master ──────────────────────────────────────────────────────────

const materialMasterRouter = router({
  list: protectedProcedure
    .input(z.object({
      itemGroup: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const key = cacheKey("materials", "list", { group: input.itemGroup, search: input.search, limit: input.limit, offset: input.offset });
      return withCache(key, TTL.MATERIALS, async () => {
        const p = await pool();
        const params: unknown[] = [];
        let where = "WHERE 1=1";
        let idx = 1;
        if (input.itemGroup) { where += ` AND m.item_group = $${idx++}`; params.push(input.itemGroup); }
        if (input.search) { where += ` AND (m.item_name ILIKE $${idx} OR m.item_code ILIKE $${idx})`; params.push(`%${input.search}%`); idx++; }
        params.push(input.limit, input.offset);
        const result = await p.query(
          `SELECT m.*, s.supplier_name FROM material_master m
           LEFT JOIN suppliers s ON m.supplier_id = s.id
           ${where} ORDER BY m.item_name LIMIT $${idx++} OFFSET $${idx}`,
          params
        );
        return result.rows;
      });
    }),

  create: protectedProcedure
    .input(z.object({
      itemCode: z.string().min(1),
      itemName: z.string().min(1),
      itemGroup: z.enum(["MUD_CHEMICAL", "PIPE", "EQUIPMENT", "CONSUMABLE", "RENTAL", "SERVICE"]),
      itemType: z.enum(["CONSUMABLE", "RENTAL", "SERVICE"]).default("CONSUMABLE"),
      uom: z.string().default("BBL"),
      description: z.string().optional(),
      specGrade: z.string().optional(),
      minStockLevel: z.number().min(0).default(0),
      reorderPoint: z.number().min(0).default(0),
      unitCost: z.number().min(0).optional(),
      currency: z.string().default("USD"),
      isHazmat: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        `INSERT INTO material_master (item_code, item_name, item_group, item_type, uom, description,
          spec_grade, min_stock_level, reorder_point, unit_cost, currency, is_hazmat)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [input.itemCode, input.itemName, input.itemGroup, input.itemType, input.uom,
         input.description ?? null, input.specGrade ?? null, input.minStockLevel,
         input.reorderPoint, input.unitCost ?? null, input.currency, input.isHazmat]
      );
      return result.rows[0];
    }),

  getStockLevels: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }))
    .query(async ({ input }) => {
      const p = await pool();
      const locFilter = input.locationId ? `AND b.location_id = '${input.locationId}'::uuid` : "";
      const result = await p.query(`
        SELECT m.id, m.item_code, m.item_name, m.item_group, m.uom,
               m.min_stock_level, m.reorder_point, m.unit_cost,
               COALESCE(SUM(b.quantity), 0) AS total_stock,
               COUNT(b.id) AS batch_count,
               CASE
                 WHEN COALESCE(SUM(b.quantity), 0) <= m.min_stock_level THEN 'CRITICAL'
                 WHEN COALESCE(SUM(b.quantity), 0) <= m.reorder_point THEN 'LOW'
                 ELSE 'OK'
               END AS stock_status
        FROM material_master m
        LEFT JOIN material_batches b ON b.item_id = m.id AND b.status = 'AVAILABLE' ${locFilter}
        GROUP BY m.id ORDER BY stock_status DESC, m.item_name
      `);
      return result.rows;
    }),
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

const suppliersRouter = router({
  list: protectedProcedure
    .input(z.object({ supplierType: z.string().optional() }))
    .query(async ({ input }) => {
      const p = await pool();
      const params: unknown[] = [];
      let where = "WHERE is_approved = TRUE";
      if (input.supplierType) { where += " AND supplier_type = $1"; params.push(input.supplierType); }
      const result = await p.query(`SELECT * FROM suppliers ${where} ORDER BY supplier_name`, params);
      return result.rows;
    }),

  create: protectedProcedure
    .input(z.object({
      supplierCode: z.string().min(1),
      supplierName: z.string().min(1),
      supplierType: z.string().default("MUD_CHEMICAL"),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      country: z.string().default("SA"),
      leadTimeDays: z.number().min(0).default(7),
      paymentTerms: z.string().default("NET30"),
    }))
    .mutation(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        `INSERT INTO suppliers (supplier_code, supplier_name, supplier_type, contact_name,
          contact_email, contact_phone, country, lead_time_days, payment_terms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [input.supplierCode, input.supplierName, input.supplierType,
         input.contactName ?? null, input.contactEmail ?? null, input.contactPhone ?? null,
         input.country, input.leadTimeDays, input.paymentTerms]
      );
      return result.rows[0];
    }),

  getPerformance: protectedProcedure.query(async () => {
    const p = await pool();
    const result = await p.query(`
      SELECT s.id, s.supplier_name, s.supplier_type, s.lead_time_days,
             s.performance_score, s.payment_terms,
             COUNT(po.id) AS total_orders,
             COALESCE(SUM(po.total_amount), 0) AS total_spend
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id
      WHERE s.is_approved = TRUE
      GROUP BY s.id ORDER BY total_spend DESC
    `);
    return result.rows;
  }),
});

// ─── Inventory Locations ──────────────────────────────────────────────────────

const inventoryLocationsRouter = router({
  list: protectedProcedure
    .input(z.object({ locationType: z.string().optional() }))
    .query(async ({ input }) => {
      const p = await pool();
      const params: unknown[] = [];
      let where = "WHERE l.is_active = TRUE";
      if (input.locationType) { where += " AND l.location_type = $1"; params.push(input.locationType); }
      const result = await p.query(
        `SELECT l.*, p.location_name AS parent_name FROM inventory_locations l
         LEFT JOIN inventory_locations p ON p.id = l.parent_location_id
         ${where} ORDER BY l.location_type, l.location_name`,
        params
      );
      return result.rows;
    }),

  create: protectedProcedure
    .input(z.object({
      locationCode: z.string().min(1),
      locationName: z.string().min(1),
      locationType: z.enum(["YARD", "WAREHOUSE", "RIG", "PAD", "TANK", "BIN"]),
      parentLocationId: z.string().uuid().optional(),
      fieldId: z.string().optional(),
      gpsLat: z.number().optional(),
      gpsLon: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        `INSERT INTO inventory_locations (location_code, location_name, location_type,
          parent_location_id, field_id, gps_lat, gps_lon)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [input.locationCode, input.locationName, input.locationType,
         input.parentLocationId ?? null, input.fieldId ?? null,
         input.gpsLat ?? null, input.gpsLon ?? null]
      );
      return result.rows[0];
    }),
});

// ─── Material Requests ────────────────────────────────────────────────────────

const materialRequestsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      wellId: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const p = await pool();
      const params: unknown[] = [];
      let where = "WHERE 1=1";
      let idx = 1;
      if (input.status) { where += ` AND mr.status = $${idx++}`; params.push(input.status); }
      if (input.wellId) { where += ` AND mr.well_id = $${idx++}`; params.push(input.wellId); }
      params.push(input.limit);
      const result = await p.query(
        `SELECT mr.*, COUNT(mri.id) AS item_count,
                COALESCE(SUM(mri.estimated_cost), 0) AS estimated_total
         FROM material_requests mr
         LEFT JOIN material_request_items mri ON mri.request_id = mr.id
         ${where} GROUP BY mr.id ORDER BY mr.created_at DESC LIMIT $${idx}`,
        params
      );
      return result.rows;
    }),

  create: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      priority: z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]).default("NORMAL"),
      requiredDate: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        itemId: z.string().uuid(),
        quantity: z.number().positive(),
        uom: z.string(),
        estimatedCost: z.number().optional(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const p = await pool();
      const reqNumber = `MR-${Date.now()}`;
      const mrResult = await p.query(
        `INSERT INTO material_requests (request_number, requested_by, well_id, priority, required_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [reqNumber, ctx.user.name, input.wellId ?? null, input.priority,
         input.requiredDate ?? null, input.notes ?? null]
      );
      const mr = mrResult.rows[0] as { id: string };
      for (const item of input.items) {
        await p.query(
          `INSERT INTO material_request_items (request_id, item_id, quantity, uom, estimated_cost)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
          [mr.id, item.itemId, item.quantity, item.uom, item.estimatedCost ?? null]
        );
      }
      return mr;
    }),

  approve: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const p = await pool();
      const result = await p.query(
        `UPDATE material_requests SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
         WHERE id = $2::uuid RETURNING *`,
        [ctx.user.name, input.requestId]
      );
      return result.rows[0];
    }),

  reject: protectedProcedure
    .input(z.object({ requestId: z.string().uuid(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const p = await pool();
      const result = await p.query(
        `UPDATE material_requests SET status = 'REJECTED', approved_by = $1, notes = COALESCE(notes, '') || ' [REJECTED: ' || $2 || ']', approved_at = NOW()
         WHERE id = $3::uuid RETURNING *`,
        [ctx.user.name, input.reason ?? "No reason given", input.requestId]
      );
      return result.rows[0];
    }),
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────

const purchaseOrdersRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const p = await pool();
      const params: unknown[] = [];
      let where = "";
      if (input.status) { where = "WHERE po.status = $1"; params.push(input.status); }
      params.push(input.limit);
      const result = await p.query(
        `SELECT po.*, s.supplier_name, s.lead_time_days, COUNT(poi.id) AS line_count
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id
         LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
         ${where} GROUP BY po.id, s.supplier_name, s.lead_time_days
         ORDER BY po.created_at DESC LIMIT $${params.length}`,
        params
      );
      return result.rows;
    }),

  create: protectedProcedure
    .input(z.object({
      supplierId: z.string().uuid(),
      requestId: z.string().uuid().optional(),
      expectedDelivery: z.string().optional(),
      terms: z.string().optional(),
      items: z.array(z.object({
        itemId: z.string().uuid(),
        quantityOrdered: z.number().positive(),
        unitPrice: z.number().min(0),
        uom: z.string(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const p = await pool();
      const poNumber = `PO-${Date.now()}`;
      const totalAmount = input.items.reduce((sum, i) => sum + i.quantityOrdered * i.unitPrice, 0);
      const poResult = await p.query(
        `INSERT INTO purchase_orders (po_number, supplier_id, request_id, total_amount, expected_delivery, terms, created_by)
         VALUES ($1, $2::uuid, $3, $4, $5, $6, $7) RETURNING *`,
        [poNumber, input.supplierId, input.requestId ?? null, totalAmount,
         input.expectedDelivery ?? null, input.terms ?? null, ctx.user.name]
      );
      const po = poResult.rows[0] as { id: string };
      for (const item of input.items) {
        await p.query(
          `INSERT INTO purchase_order_items (po_id, item_id, quantity_ordered, unit_price, uom)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
          [po.id, item.itemId, item.quantityOrdered, item.unitPrice, item.uom]
        );
      }
      return po;
    }),

  receiveGoods: protectedProcedure
    .input(z.object({
      poId: z.string().uuid(),
      items: z.array(z.object({
        poItemId: z.string().uuid(),
        quantityReceived: z.number().positive(),
        batchNumber: z.string().optional(),
        mudWeightPpg: z.number().optional(),
        viscosityCp: z.number().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const p = await pool();
      for (const item of input.items) {
        await p.query(
          `UPDATE purchase_order_items SET quantity_received = quantity_received + $1 WHERE id = $2::uuid`,
          [item.quantityReceived, item.poItemId]
        );
        if (item.batchNumber) {
          const poItem = await p.query(
            `SELECT item_id, uom, unit_price FROM purchase_order_items WHERE id = $1::uuid`,
            [item.poItemId]
          );
          if (poItem.rows.length > 0) {
            const row = poItem.rows[0] as { item_id: string; uom: string; unit_price: number };
            await p.query(
              `INSERT INTO material_batches (batch_number, item_id, quantity, uom, unit_cost, mud_weight_ppg, viscosity_cp, purchase_order_id)
               VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::uuid)
               ON CONFLICT (batch_number) DO UPDATE SET quantity = material_batches.quantity + $3`,
              [item.batchNumber, row.item_id, item.quantityReceived, row.uom, row.unit_price,
               item.mudWeightPpg ?? null, item.viscosityCp ?? null, input.poId]
            );
          }
        }
      }
      await p.query(
        `UPDATE purchase_orders SET status = 'RECEIVED', updated_at = NOW() WHERE id = $1::uuid`,
        [input.poId]
      );
      return { success: true };
    }),
});

// ─── Field Operations ─────────────────────────────────────────────────────────

const fieldOperationsRouter = router({
  listTransferOrders: protectedProcedure
    .input(z.object({ status: z.string().optional(), wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const p = await pool();
      const params: unknown[] = [];
      let where = "WHERE 1=1";
      let idx = 1;
      if (input.status) { where += ` AND t.status = $${idx++}`; params.push(input.status); }
      if (input.wellId) { where += ` AND t.well_id = $${idx++}`; params.push(input.wellId); }
      const result = await p.query(
        `SELECT t.*, fl.location_name AS from_location, tl.location_name AS to_location, COUNT(ti.id) AS item_count
         FROM transfer_orders t
         LEFT JOIN inventory_locations fl ON fl.id = t.from_location_id
         LEFT JOIN inventory_locations tl ON tl.id = t.to_location_id
         LEFT JOIN transfer_order_items ti ON ti.transfer_id = t.id
         ${where} GROUP BY t.id, fl.location_name, tl.location_name ORDER BY t.created_at DESC LIMIT 100`,
        params
      );
      return result.rows;
    }),

  createTransferOrder: protectedProcedure
    .input(z.object({
      fromLocationId: z.string().uuid(),
      toLocationId: z.string().uuid(),
      wellId: z.string().optional(),
      driverName: z.string().optional(),
      vehicleNumber: z.string().optional(),
      items: z.array(z.object({
        itemId: z.string().uuid(),
        batchId: z.string().uuid().optional(),
        quantity: z.number().positive(),
        uom: z.string(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const p = await pool();
      const transferNumber = `TO-${Date.now()}`;
      const toResult = await p.query(
        `INSERT INTO transfer_orders (transfer_number, from_location_id, to_location_id, well_id, requested_by, driver_name, vehicle_number)
         VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7) RETURNING *`,
        [transferNumber, input.fromLocationId, input.toLocationId, input.wellId ?? null,
         ctx.user.name, input.driverName ?? null, input.vehicleNumber ?? null]
      );
      const to = toResult.rows[0] as { id: string };
      for (const item of input.items) {
        await p.query(
          `INSERT INTO transfer_order_items (transfer_id, item_id, batch_id, quantity, uom)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
          [to.id, item.itemId, item.batchId ?? null, item.quantity, item.uom]
        );
      }
      return to;
    }),

  createFieldIssueTicket: protectedProcedure
    .input(z.object({
      wellId: z.string().min(1),
      issuedTo: z.string().optional(),
      purpose: z.enum(["DRILLING", "COMPLETION", "WORKOVER", "MAINTENANCE"]),
      items: z.array(z.object({
        itemId: z.string().uuid(),
        batchId: z.string().uuid().optional(),
        quantity: z.number().positive(),
        uom: z.string(),
        unitCost: z.number().optional(),
        notes: z.string().optional(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const p = await pool();
      const ticketNumber = `FIT-${Date.now()}`;
      const totalCost = input.items.reduce((sum, i) => sum + (i.quantity * (i.unitCost ?? 0)), 0);
      const fitResult = await p.query(
        `INSERT INTO field_issue_tickets (ticket_number, well_id, issued_by, issued_to, purpose, total_cost)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [ticketNumber, input.wellId, ctx.user.name, input.issuedTo ?? null, input.purpose, totalCost]
      );
      const fit = fitResult.rows[0] as { id: string };
      for (const item of input.items) {
        await p.query(
          `INSERT INTO field_issue_items (ticket_id, item_id, batch_id, quantity, uom, unit_cost, notes)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)`,
          [fit.id, item.itemId, item.batchId ?? null, item.quantity, item.uom,
           item.unitCost ?? null, item.notes ?? null]
        );
        if (item.batchId) {
          await p.query(
            `UPDATE material_batches SET quantity = quantity - $1 WHERE id = $2::uuid`,
            [item.quantity, item.batchId]
          );
        }
      }
      return fit;
    }),

  getMudTankSnapshots: protectedProcedure
    .input(z.object({ wellId: z.string(), hours: z.number().min(1).max(168).default(24) }))
    .query(async ({ input }) => {
      const p = await pool();
      const result = await p.query(
        `SELECT * FROM mud_tank_snapshots
         WHERE well_id = $1 AND snapshot_at >= NOW() - ($2 || ' hours')::INTERVAL
         ORDER BY snapshot_at DESC LIMIT 500`,
        [input.wellId, input.hours]
      );
      return result.rows;
    }),

  getDashboardStats: protectedProcedure.query(async () => {
    const p = await pool();
    const [pendingMR, pendingPO, openTransfers, lowStock] = await Promise.all([
      p.query(`SELECT COUNT(*) AS count FROM material_requests WHERE status IN ('DRAFT','SUBMITTED')`),
      p.query(`SELECT COUNT(*) AS count FROM purchase_orders WHERE status IN ('DRAFT','SUBMITTED','CONFIRMED')`),
      p.query(`SELECT COUNT(*) AS count FROM transfer_orders WHERE status IN ('PENDING','IN_TRANSIT')`),
      p.query(`
        SELECT COUNT(*) AS count FROM (
          SELECT m.id FROM material_master m
          LEFT JOIN material_batches b ON b.item_id = m.id AND b.status = 'AVAILABLE'
          GROUP BY m.id, m.reorder_point
          HAVING COALESCE(SUM(b.quantity), 0) <= m.reorder_point AND m.reorder_point > 0
        ) t
      `),
    ]);
    return {
      pendingMaterialRequests: Number((pendingMR.rows[0] as { count: string }).count),
      pendingPurchaseOrders: Number((pendingPO.rows[0] as { count: string }).count),
      openTransferOrders: Number((openTransfers.rows[0] as { count: string }).count),
      lowStockItems: Number((lowStock.rows[0] as { count: string }).count),
    };
  }),
});

// ─── Main Materials Management Router ────────────────────────────────────────

// ─── Delete helpers ──────────────────────────────────────────────────────────
const deleteMaterialOpsRouter = router({
  deleteRequest: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query("DELETE FROM material_requests WHERE id = $1", [input.id]);
      return { success: true };
    }),
  deletePO: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query("DELETE FROM purchase_orders WHERE id = $1 AND status = 'DRAFT'", [input.id]);
      return { success: true };
    }),
  deleteMaterial: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query("DELETE FROM material_master WHERE id = $1", [input.id]);
      return { success: true };
    }),
});

export const materialsManagementRouter = router({
  materials: materialMasterRouter,
  suppliers: suppliersRouter,
  requests: materialRequestsRouter,
  purchaseOrders: purchaseOrdersRouter,
  fieldOps: fieldOperationsRouter,
  locations: inventoryLocationsRouter,
  deleteOps: deleteMaterialOpsRouter,
});
