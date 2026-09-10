import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { ok, rejected } from "./result";

/**
 * The one catalog implementation behind all eight lookup catalogs.
 *
 * Every catalog used to repeat the same five operations — paginated list,
 * get-by-id, create, update, guarded soft-delete — with only the model, the
 * permission prefix, the paths, and the child relation differing. The drift
 * was already visible: three list shapes, two pagination styles, and delete
 * guards worded five different ways. New catalogs add a config, not a copy.
 *
 * Shape of the split: the factory owns the cross-cutting rules (permission
 * check, pagination envelope, input parsing, child-guard-then-deactivate,
 * revalidation, redirect-on-delete). Each catalog owns its queries as plain
 * closures, so Prisma's return types flow through untouched — pages keep the
 * exact row shapes they had before, and no `as unknown as Model` cast sits
 * between the query and the UI.
 *
 * This module is deliberately NOT `"use server"`: everything exported from a
 * `"use server"` module becomes a publicly callable Server Action, and these
 * are building blocks. The real actions live in `lookups.ts` as thin
 * `export async function` wrappers, which is what the action transform
 * registers — a factory-produced function reference would not be one.
 */

export type CatalogListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/** Minimum shape for an input schema: it parses unknown into a record. */
export type CatalogSchema = {
  parse: (data: unknown) => Record<string, unknown>;
};

export type CatalogConfig<ListRow, MappedRow, Detail, Created> = {
  /** Permission names for read/create/update/delete. */
  permissions: { read: string; create: string; update: string; del: string };
  /** List path, revalidated on every write; delete redirects here. */
  basePath: string;
  /** Update also revalidates `${basePath}/${id}` unless false. */
  revalidateDetail?: boolean;
  /** Every create/update payload is parsed through this before Prisma. */
  schema: CatalogSchema;
  /** Update payloads parse through this when it differs from `schema`. */
  updateSchema?: CatalogSchema;
  /** Paginated rows plus total for the list envelope. */
  runList: (
    search: string | undefined,
    skip: number,
    take: number,
  ) => Promise<{ rows: ListRow[]; total: number }>;
  /** Reshape list rows for client components; default is identity. */
  mapRow?: (row: ListRow) => MappedRow;
  /** Detail query for get-by-id. */
  runGetById: (id: number) => Promise<Detail | null>;
  /** Parsed payload → Prisma `data` for create / update. */
  toCreateData: (parsed: Record<string, unknown>) => unknown;
  toUpdateData: (parsed: Record<string, unknown>) => unknown;
  runCreate: (data: unknown) => Promise<Created>;
  runUpdate: (id: number, data: unknown) => Promise<Created>;
  runDeactivate: (id: number) => Promise<unknown>;
  /** Active children that block a soft-delete. */
  countChildren: (id: number) => Promise<number>;
  /** Guard message; receives the blocking child count. */
  blockedMessage: (count: number) => string;
  /**
   * Extra delete rule before the child count (e.g. the fallback incident
   * type). Returns the rejection message, or null when deletion may proceed.
   */
  preDelete?: (id: number) => Promise<string | null>;
};

export function createCatalogActions<
  ListRow,
  Detail,
  Created,
  MappedRow = ListRow,
>(config: CatalogConfig<ListRow, MappedRow, Detail, Created>) {
  const revalidateDetail = config.revalidateDetail !== false;

  async function list(params?: CatalogListParams) {
    await requirePermission(config.permissions.read);

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const skip = (page - 1) * limit;

    const { rows, total } = await config.runList(params?.search, skip, limit);

    const data: MappedRow[] = config.mapRow
      ? rows.map(config.mapRow)
      : (rows as unknown as MappedRow[]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function getById(id: number) {
    await requirePermission(config.permissions.read);
    return config.runGetById(id);
  }

  async function create(data: unknown) {
    await requirePermission(config.permissions.create);

    const row = await config.runCreate(
      config.toCreateData(config.schema.parse(data)),
    );

    revalidatePath(config.basePath);
    return ok({ data: row });
  }

  async function update(id: number, data: unknown) {
    await requirePermission(config.permissions.update);

    const row = await config.runUpdate(
      id,
      config.toUpdateData((config.updateSchema ?? config.schema).parse(data)),
    );

    revalidatePath(config.basePath);
    if (revalidateDetail) revalidatePath(`${config.basePath}/${id}`);
    return ok({ data: row });
  }

  async function remove(id: number) {
    await requirePermission(config.permissions.del);

    if (config.preDelete) {
      const blocked = await config.preDelete(id);
      if (blocked) return rejected(blocked);
    }

    const childCount = await config.countChildren(id);
    if (childCount > 0) {
      return rejected(config.blockedMessage(childCount));
    }

    await config.runDeactivate(id);

    revalidatePath(config.basePath);
    redirect(config.basePath);
  }

  return { list, getById, create, update, remove };
}
