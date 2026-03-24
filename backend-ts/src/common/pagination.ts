import type { Request } from "express";

type PaginationOptions = {
  defaultSize: number;
  maxSize: number;
  defaultSortField: string;
  defaultSortDirection: "ASC" | "DESC";
  sortFields: Record<string, string>;
};

export type Pagination = {
  page: number;
  size: number;
  offset: number;
  sortColumn: string;
  sortDirection: "ASC" | "DESC";
};

const toSafeInt = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getPagination = (req: Request, options: PaginationOptions): Pagination => {
  const pageRaw = toSafeInt(req.query.page, 0);
  const sizeRaw = toSafeInt(req.query.size, options.defaultSize);

  const page = Math.max(0, pageRaw);
  const size = Math.min(options.maxSize, Math.max(1, sizeRaw));

  let sortField = options.defaultSortField;
  let sortDirection: "ASC" | "DESC" = options.defaultSortDirection;

  if (typeof req.query.sort === "string" && req.query.sort.trim().length > 0) {
    const [field, direction] = req.query.sort.split(",").map((part) => part.trim());
    if (field && field in options.sortFields) {
      sortField = field;
    }
    if (direction?.toLowerCase() === "desc") {
      sortDirection = "DESC";
    }
    if (direction?.toLowerCase() === "asc") {
      sortDirection = "ASC";
    }
  }

  return {
    page,
    size,
    offset: page * size,
    sortColumn: options.sortFields[sortField] || options.sortFields[options.defaultSortField],
    sortDirection
  };
};

