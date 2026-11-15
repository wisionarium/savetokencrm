import { createAdminClient } from "../lib/supabase/admin";

async function run() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("followup_flow_pointers")
    .select("id")
    .limit(1);

  // Let's test calling an RPC or query if any, or test with a user token!
  // Can we sign in as a user or get a session?
  console.log("Admin client can query:", data, error);
}

run().catch(console.error);
