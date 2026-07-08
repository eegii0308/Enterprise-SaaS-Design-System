import { createHash } from "node:crypto";
import { ImportRowStatus, SourceType } from "@prisma/client";

export type CsvRecord = Record<string, string>;

export type ColumnMapping = {
  transactionDate?: string;
  description?: string;
  amount?: string;
  debitAmount?: string;
  creditAmount?: string;
  currency?: string;
  reference?: string;
  vendor?: string;
};

export type PreparedImportRow = {
  rowNumber: number;
  rawData: CsvRecord;
  normalizedData: Record<string, string | number> | null;
  rowHash: string;
  validationStatus: ImportRowStatus;
  errorMessages: string[] | null;
};

export type PreparedImport = {
  columnMapping: ColumnMapping;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: PreparedImportRow[];
};

const columnAliases: Record<keyof ColumnMapping, string[]> = {
  transactionDate: ["date", "transaction date", "txn date", "posted date", "posting date", "value date"],
  description: ["description", "details", "memo", "narration", "transaction description"],
  amount: ["amount", "transaction amount", "net amount", "value"],
  debitAmount: ["debit", "debit amount", "withdrawal", "withdrawals", "paid out"],
  creditAmount: ["credit", "credit amount", "deposit", "deposits", "paid in"],
  currency: ["currency", "ccy"],
  reference: ["reference", "ref", "reference number", "transaction id", "external id"],
  vendor: ["vendor", "merchant", "payee", "counterparty"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());

  return cells;
}

export function parseCsv(csvText: string) {
  const normalizedText = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedText.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [] as string[], records: [] as CsvRecord[] };
  }

  const headers = parseCsvLine(lines[0]).map((header, index) => header || `Column ${index + 1}`);
  const records = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const record: CsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });

    return record;
  });

  return { headers, records };
}

export function detectColumnMapping(headers: string[]) {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));

  for (const [field, aliases] of Object.entries(columnAliases) as [keyof ColumnMapping, string[]][]) {
    const match = normalizedHeaders.find(({ normalized }) => aliases.includes(normalized));

    if (match) {
      mapping[field] = match.header;
    }
  }

  return mapping;
}

function parseMoney(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/,/g, "");

  if (normalized.length === 0) {
    return null;
  }

  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : null;
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value.trim());

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function getMappedValue(record: CsvRecord, mapping: ColumnMapping, field: keyof ColumnMapping) {
  const column = mapping[field];

  return column ? record[column] : undefined;
}

export function prepareImportRows(csvText: string, sourceType: SourceType, importBatchId: string): PreparedImport {
  const { headers, records } = parseCsv(csvText);
  const columnMapping = detectColumnMapping(headers);
  const duplicateFingerprints = new Set<string>();
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  const rows = records.map((record, index): PreparedImportRow => {
    const errors: string[] = [];
    const transactionDate = parseDate(getMappedValue(record, columnMapping, "transactionDate"));
    const description = getMappedValue(record, columnMapping, "description")?.trim() ?? "";
    const debitAmount = parseMoney(getMappedValue(record, columnMapping, "debitAmount"));
    const creditAmount = parseMoney(getMappedValue(record, columnMapping, "creditAmount"));
    const mappedAmount = parseMoney(getMappedValue(record, columnMapping, "amount"));
    const amount = mappedAmount ?? (creditAmount ?? 0) - (debitAmount ?? 0);

    if (!columnMapping.transactionDate || !transactionDate) {
      errors.push("Transaction date is missing or invalid.");
    }

    if (!columnMapping.description || description.length === 0) {
      errors.push("Description is required.");
    }

    if (mappedAmount === null && debitAmount === null && creditAmount === null) {
      errors.push("Amount, debit, or credit is required.");
    }

    const normalizedData = errors.length === 0
      ? {
          sourceType,
          transactionDate: transactionDate as string,
          description,
          amount,
          debitAmount: debitAmount ?? Math.max(-amount, 0),
          creditAmount: creditAmount ?? Math.max(amount, 0),
          currency: getMappedValue(record, columnMapping, "currency")?.trim() || "MNT",
          reference: getMappedValue(record, columnMapping, "reference")?.trim() || "",
          vendor: getMappedValue(record, columnMapping, "vendor")?.trim() || "",
        }
      : null;

    const duplicateFingerprint = hashValue(normalizedData ?? record);
    const rowHash = hashValue({ importBatchId, rowNumber: index + 2, record });
    let validationStatus: ImportRowStatus = errors.length > 0 ? ImportRowStatus.INVALID : ImportRowStatus.VALID;

    if (validationStatus === ImportRowStatus.VALID && duplicateFingerprints.has(duplicateFingerprint)) {
      validationStatus = ImportRowStatus.DUPLICATE;
    }

    duplicateFingerprints.add(duplicateFingerprint);

    if (validationStatus === ImportRowStatus.VALID) {
      validRows += 1;
    } else if (validationStatus === ImportRowStatus.DUPLICATE) {
      duplicateRows += 1;
    } else {
      invalidRows += 1;
    }

    return {
      rowNumber: index + 2,
      rawData: record,
      normalizedData,
      rowHash,
      validationStatus,
      errorMessages: errors.length > 0 ? errors : null,
    };
  });

  return {
    columnMapping,
    totalRows: records.length,
    validRows,
    invalidRows,
    duplicateRows,
    rows,
  };
}
