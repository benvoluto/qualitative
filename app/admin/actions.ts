"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { subscriptions } from "@/lib/db";

export async function toggleCompedAction(accountId: string, comped: boolean): Promise<void> {
  await requireAdmin();
  await subscriptions.setComped(accountId, comped);
  revalidatePath("/admin");
}
