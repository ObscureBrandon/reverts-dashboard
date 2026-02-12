import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { userSupervisors } from "@/lib/db/auth-schema";

let container: any;
let db: any;
let client: any;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("testdb")
    .withUsername("test")
    .withPassword("test")
    .start();

  client = new pg.Client({
    connectionString: container.getConnectionUri(),
  });

  await client.connect();
  db = drizzle(client);

  // Create table schema manually for test
  await client.query(`
    CREATE TABLE "UserSupervisor" (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      supervisor_id BIGINT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
});

afterAll(async () => {
  await client.end();
  await container.stop();
});

describe("UserSupervisor DB Integration", () => {
  it("inserts supervisor correctly", async () => {
    await db.insert(userSupervisors).values({
      userId: 123n,
      supervisorId: 999n,
      active: true,
    });

    const result = await client.query(
      `SELECT * FROM "UserSupervisor" WHERE user_id = 123`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].supervisor_id).toBe("999");
  });
});
