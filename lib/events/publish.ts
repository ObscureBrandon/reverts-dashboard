import { redis } from "./redis";

export async function publishEvent(
  stream: string,
  payload: object
) {
  await redis.xadd(
    stream,
    "*",
    "event",
    JSON.stringify(payload)
  );
}
