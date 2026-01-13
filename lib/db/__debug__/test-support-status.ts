import { getUserSupportStatus } from "@/lib/db/queries";

async function run() {
  const userId = BigInt("427297927774601217"); // test user

  const row = await getUserSupportStatus(userId);
  console.log("RAW ROW:", row);

  if (!row) {
    console.log("STATE: resolved (no rows)");
  } else if (!row.active) {
    console.log("STATE: resolved");
  } else if (row.assignedAt) {
    console.log("STATE: assigned");
  } else {
    console.log("STATE: waiting");
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
