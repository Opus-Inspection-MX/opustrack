import { describe, expect, it } from "vitest";

import {
  normalizePagination,
  TRACKING_DEFAULT_PAGE_SIZE,
  TRACKING_PAGE_SIZES,
} from "./pagination";

describe("normalizePagination", () => {
  it("defaults to page 1 with 50 rows", () => {
    expect(normalizePagination()).toEqual({ page: 1, pageSize: 50 });
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 50 });
    expect(TRACKING_DEFAULT_PAGE_SIZE).toBe(50);
    expect([...TRACKING_PAGE_SIZES]).toEqual([50, 100, 200]);
  });

  it("keeps valid pages and sizes", () => {
    expect(normalizePagination({ page: 2, pageSize: 100 })).toEqual({
      page: 2,
      pageSize: 100,
    });
    expect(normalizePagination({ page: 3, pageSize: 200 })).toEqual({
      page: 3,
      pageSize: 200,
    });
  });

  it("clamps a forged size or page to the contract", () => {
    expect(normalizePagination({ page: 0, pageSize: 30 })).toEqual({
      page: 1,
      pageSize: 50,
    });
    expect(normalizePagination({ page: -4, pageSize: 10_000 })).toEqual({
      page: 1,
      pageSize: 50,
    });
  });
});
