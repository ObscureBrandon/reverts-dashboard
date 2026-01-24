import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create connection
const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Configure connection pooling for production
const client = postgres(connectionString, {
  max: 10, // Maximum 10 connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout of 10 seconds
});

export const db = drizzle(client, { schema });

// Export schema for easy access
export { schema };
export * from './schema';
