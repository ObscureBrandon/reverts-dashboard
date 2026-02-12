import { vi } from "vitest";

export function createMockTransaction() {
  const calls = {
    update: [] as any[],
    insert: [] as any[],
  };

  const tx = {
    update: vi.fn((table) => {
      calls.update.push(table);
      return tx;
    }),
    set: vi.fn(() => tx),
    where: vi.fn(() => tx),
    insert: vi.fn((table) => {
      calls.insert.push(table);
      return tx;
    }),
    values: vi.fn(() => tx),
  };

  return { tx, calls };
}
