import { redis } from "@/lib/events/redis";

export async function GET() {
  const pong = await redis.ping();
  return Response.json({ redis: pong });
}
