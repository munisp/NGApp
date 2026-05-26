/**
 * materialsReorder.ts — Materials reorder point alert service
 * Checks inventory levels and triggers purchase order suggestions when below reorder point
 */
import { getPool } from "../db";
import { notifyOwner } from "../_core/notification";

export interface ReorderAlert {
  materialId: string;
  materialName: string;
  currentQty: number;
  reorderPoint: number;
  unit: string;
  location: string;
}

export async function checkReorderAlerts(): Promise<ReorderAlert[]> {
  const pool = await getPool();
  if (!pool) return [];

  try {
    const result = await pool.query<ReorderAlert>(`
      SELECT
        mm.item_code AS "materialId",
        mm.item_name AS "materialName",
        COALESCE(SUM(mb.quantity), 0) AS "currentQty",
        mm.reorder_point AS "reorderPoint",
        mm.uom AS "unit",
        COALESCE(il.location_code, 'MAIN') AS "location"
      FROM material_master mm
      LEFT JOIN material_batches mb ON mb.item_id = mm.id AND mb.status = 'AVAILABLE'
      LEFT JOIN inventory_locations il ON il.id = mb.location_id
      WHERE mm.reorder_point IS NOT NULL
      GROUP BY mm.item_code, mm.item_name, mm.reorder_point, mm.uom, il.location_code
      HAVING COALESCE(SUM(mb.quantity), 0) <= mm.reorder_point
      ORDER BY (COALESCE(SUM(mb.quantity), 0) / NULLIF(mm.reorder_point, 0)) ASC
      LIMIT 50
    `);

    const alerts = result.rows;

    if (alerts.length > 0) {
      await notifyOwner({
        title: `[Materials] ${alerts.length} items below reorder point`,
        content: alerts.slice(0, 10).map(a =>
          `${a.materialName} (${a.materialId}): ${a.currentQty} ${a.unit} (reorder at ${a.reorderPoint})`
        ).join("\n"),
      });
    }

    return alerts;
  } catch (e) {
    console.error("[MaterialsReorder] Query failed:", e);
    return [];
  }
}

export function startMaterialsReorderScheduler(): void {
  checkReorderAlerts().catch(console.error);
  setInterval(() => checkReorderAlerts().catch(console.error), 8 * 3600 * 1000);
  console.log("[MaterialsReorder] Scheduler started (every 8h)");
}
