import { redis } from "./redis";

export async function testRedis() {
  const pong = await redis.ping();
  console.log("Redis says:", pong);
}
