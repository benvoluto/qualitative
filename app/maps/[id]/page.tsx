import { notFound } from "next/navigation";
import { requireAccountId } from "@/lib/account-context";
import { customers, extracts, extractPositions, tags } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { MapCanvas } from "../map-canvas";

export const dynamic = "force-dynamic";

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId();
  const { id } = await params;
  const customer = await customers.getCustomerById(accountId, id);
  if (!customer) notFound();

  const [extractRows, positions, accountTags] = await Promise.all([
    extracts.getExtractsWithTagsByCustomerId(accountId, id),
    extractPositions.getPositionsForCustomer(accountId, id),
    tags.getTags(accountId),
  ]);

  const positionByExtract = new Map(positions.map((p) => [p.extract_id, p]));
  const stickies = extractRows.map((e) => ({
    id: e.id,
    summary: e.summary,
    quotes: e.quotes,
    is_action_item: e.is_action_item,
    tags: e.tags,
    position: positionByExtract.get(e.id)
      ? {
          x: positionByExtract.get(e.id)!.x,
          y: positionByExtract.get(e.id)!.y,
          width: positionByExtract.get(e.id)!.width,
          height: positionByExtract.get(e.id)!.height,
          color: positionByExtract.get(e.id)!.color,
        }
      : null,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <PageHeader title={`Map · ${customer.name}`} />
      <MapCanvas
        customerId={customer.id}
        stickies={stickies}
        accountTags={accountTags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
      />
    </div>
  );
}
