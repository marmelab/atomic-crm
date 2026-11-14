import { HttpError, type Identifier } from "ra-core";

import { getSupabaseClient } from "./supabase";

export interface InventoryCount {
  product_id: Identifier;
  quantity: number;
}

const fail = (message: string, error: { message?: string; code?: string }) => {
  throw new HttpError(error.message ?? message, 400, error);
};

/** Stock operations that are more than adding a row (TZ section 5.6). */
export const stockMethods = {
  /** Cancels a posted move with its mirror image; returns the reversal id. */
  async reverseStockMove(
    moveId: Identifier,
    note?: string,
  ): Promise<Identifier> {
    const { data, error } = await getSupabaseClient().rpc(
      "reverse_stock_move",
      { p_move_id: moveId, p_note: note ?? null },
    );
    if (error) fail("Failed to reverse the move", error);
    return data as Identifier;
  },

  /**
   * Posts an inventory count of a warehouse: one adjustment per product whose
   * count differs from its stock. Returns the number of adjustments.
   */
  async postInventory(
    warehouseId: Identifier,
    counts: InventoryCount[],
    note?: string,
  ): Promise<number> {
    const { data, error } = await getSupabaseClient().rpc("post_inventory", {
      p_warehouse_id: warehouseId,
      p_counts: counts,
      p_note: note ?? null,
    });
    if (error) fail("Failed to post the inventory", error);
    return data as number;
  },
};
