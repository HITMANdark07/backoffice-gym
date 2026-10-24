import type { TableName, Tx } from '@backoffice-gym/db';

/** MAX(id) + 1 within the episode. Steps are serialized by the episode lock, so this is race-free. */
export async function nextRowId(tx: Tx, table: TableName, episodeId: string): Promise<number> {
  const rows = await tx.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT COALESCE(MAX(id), 0) + 1 AS id FROM "backoffice_gym"."${table}" WHERE episode_id = $1::uuid`,
    episodeId,
  );
  return Number(rows[0]?.id ?? 1);
}
