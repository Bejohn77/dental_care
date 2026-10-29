import "server-only";
import type { Document } from "mongodb";
import { backendRequest } from "@/lib/api/client";

export type MongoRow = Document & { id: string };

type QueryError = { message: string };
type QueryResult<T> = {
  data: T;
  error: QueryError | null;
  count?: number | null;
};
type Filter = Record<string, unknown>;

export class MongoQuery<T extends MongoRow = MongoRow, Result = T[]>
  implements PromiseLike<QueryResult<Result>>
{
  private readonly filters: Filter = {};
  private readonly sort: Record<string, 1 | -1> = {};
  private action: "find" | "insert" | "update" | "delete" | "upsert" = "find";
  private payload: Document | Document[] = {};
  private selectClause = "*";
  private isSingle = false;
  private allowEmptySingle = false;
  private countMode = false;
  private headOnly = false;
  private maxResults: number | undefined;
  private upsertKey: string | undefined;

  constructor(private readonly table: string) {}

  select(
    columns = "*",
    options?: { count?: "exact"; head?: boolean }
  ): MongoQuery<T, Result> {
    this.selectClause = columns;
    this.countMode = options?.count === "exact";
    this.headOnly = options?.head === true;
    return this;
  }

  insert(value: Document | Document[]): MongoQuery<T, Result> {
    this.action = "insert";
    this.payload = value;
    return this;
  }

  update(value: Document): MongoQuery<T, Result> {
    this.action = "update";
    this.payload = value;
    return this;
  }

  upsert(
    value: Document | Document[],
    options?: { onConflict?: string }
  ): MongoQuery<T, Result> {
    this.action = "upsert";
    this.payload = value;
    this.upsertKey = options?.onConflict?.split(",")[0];
    return this;
  }

  delete(): MongoQuery<T, Result> {
    this.action = "delete";
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters[field] = value;
    return this;
  }

  neq(field: string, value: unknown): this {
    this.filters[field] = { $ne: value };
    return this;
  }

  in(field: string, values: unknown[]): this {
    this.filters[field] = { $in: values };
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters[field] = { ...asOperatorFilter(this.filters[field]), $gte: value };
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters[field] = { ...asOperatorFilter(this.filters[field]), $lte: value };
    return this;
  }

  lt(field: string, value: unknown): this {
    this.filters[field] = { ...asOperatorFilter(this.filters[field]), $lt: value };
    return this;
  }

  or(expression: string): this {
    const alternatives: Filter[] = [];
    for (const clause of expression.split(",")) {
      const match = /^([\w.]+)\.ilike\.%(.*)%$/.exec(clause);
      if (!match) {
        throw new Error("Unsupported MongoDB search expression.");
      }
      const escaped = match[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      alternatives.push({ [match[1]]: { $regex: escaped, $options: "i" } });
    }
    this.filters.$or = alternatives;
    return this;
  }

  is(field: string, value: null | boolean): this {
    this.filters[field] = value;
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.sort[field] = options?.ascending === false ? -1 : 1;
    return this;
  }

  limit(value: number): this {
    this.maxResults = value;
    return this;
  }

  single(): MongoQuery<T, T | null> {
    this.isSingle = true;
    return this as MongoQuery<T, T | null>;
  }

  maybeSingle(): MongoQuery<T, T | null> {
    this.isSingle = true;
    this.allowEmptySingle = true;
    return this as MongoQuery<T, T | null>;
  }

  then<TResult1 = QueryResult<Result>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<Result>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<Result>> {
    try {
      return await backendRequest<QueryResult<Result>>("/api/query", {
        table: this.table,
        action: this.action,
        filters: this.filters,
        payload: this.payload,
        selectClause: this.selectClause,
        sort: this.sort,
        isSingle: this.isSingle,
        allowEmptySingle: this.allowEmptySingle,
        countMode: this.countMode,
        headOnly: this.headOnly,
        maxResults: this.maxResults,
        upsertKey: this.upsertKey,
      });
    } catch (error) {
      return {
        data: (this.isSingle ? null : []) as Result,
        error: {
          message:
            error instanceof Error ? error.message : "MongoDB request failed",
        },
      };
    }
  }
}

function asOperatorFilter(value: unknown): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function createClient() {
  return {
    from<T extends MongoRow = MongoRow>(table: string) {
      return new MongoQuery<T>(table);
    },
    async rpc(name: string, args: Record<string, string>) {
      try {
        return await backendRequest<QueryResult<unknown[]>>("/api/rpc", {
          name,
          args,
        });
      } catch (error) {
        return {
          data: null,
          error: {
            message:
              error instanceof Error ? error.message : "Could not load time slots.",
          },
        };
      }
    },
  };
}
