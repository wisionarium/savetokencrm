import { createAdminClient } from "../lib/supabase/admin";

async function run() {
  const supabase = createAdminClient();
  const orgId = "47fd6f1b-ca21-4937-8c54-d24b0c24e9f4";

  // Let's test on "Boas-vindas - Primeira Mensagem 2" (4752cffc-c3ac-4ef2-876d-fd007494f2df)
  // Which has 0 enrollments and 3 versions!
  const pointer2 = "4752cffc-c3ac-4ef2-876d-fd007494f2df";
  console.log("=== Testing pointer 2 ===");

  const { error: enrErr } = await supabase
    .from("followup_enrollments")
    .delete()
    .eq("pointer_id", pointer2)
    .eq("organization_id", orgId);
  console.log("enrErr:", enrErr);

  const { error: unpinErr } = await supabase
    .from("followup_flow_pointers")
    .update({ active_version_id: null, updated_at: new Date().toISOString() })
    .eq("id", pointer2)
    .eq("organization_id", orgId);
  console.log("unpinErr:", unpinErr);

  const { error: verErr } = await supabase
    .from("followup_flow_versions")
    .delete()
    .eq("pointer_id", pointer2)
    .eq("organization_id", orgId);
  console.log("verErr:", verErr);

  const { error: delErr } = await supabase
    .from("followup_flow_pointers")
    .delete()
    .eq("id", pointer2)
    .eq("organization_id", orgId);
  console.log("delErr:", delErr);
}

run().catch(console.error);
