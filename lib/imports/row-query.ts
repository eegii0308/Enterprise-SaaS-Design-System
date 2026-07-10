import { ImportRowStatus, Prisma } from "@prisma/client";

export type ImportRowSearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function enumValue<T extends Record<string, string>>(enumObject: T, value: string | undefined): T[keyof T] | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(enumObject).includes(value) ? (value as T[keyof T]) : undefined;
}

export function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * Builds the filtered/searchable, organization- and batch-scoped query for
 * an import batch's row-level results. Reuses stored data only: `status`
 * filters on the validationStatus already persisted by prepareImportRows
 * (csv-core.ts) and processImportBatch (processor.ts), and `search` matches
 * against ImportRow.searchText, a flattened copy of that same row's rawData
 * values and errorMessages built at write time. No CSV re-parsing or
 * re-validation happens here.
 */
export function buildImportRowQuery(searchParams: ImportRowSearchParams, organizationId: string, importBatchId: string) {
  const status = enumValue(ImportRowStatus, firstParam(searchParams.status));
  const search = firstParam(searchParams.q)?.trim();
  const page = parsePage(firstParam(searchParams.page));

  const where: Prisma.ImportRowWhereInput = {
    organizationId,
    importBatchId,
    ...(status ? { validationStatus: status } : {}),
    ...(search ? { searchText: { contains: search, mode: "insensitive" } } : {}),
  };

  return { status, search, page, where };
}
