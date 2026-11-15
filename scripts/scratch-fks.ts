import pg from "pg";

async function run() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE ccu.table_name IN ('followup_enrollments', 'followup_flow_pointers', 'followup_flow_versions', 'followup_enrollment_events')
       OR tc.table_name IN ('followup_enrollments', 'followup_flow_pointers', 'followup_flow_versions', 'followup_enrollment_events');
  `);
  console.log("Foreign keys:");
  for (const row of res.rows) {
    console.log(`${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name} (${row.delete_rule}) [${row.constraint_name}]`);
  }

  // Also check triggers on followup_enrollments, followup_flow_pointers, followup_flow_versions
  const triggers = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table IN ('followup_enrollments', 'followup_flow_pointers', 'followup_flow_versions', 'followup_enrollment_events');
  `);
  console.log("\nTriggers:");
  for (const row of triggers.rows) {
    console.log(`${row.event_object_table}: ${row.trigger_name} ${row.action_timing} ${row.event_manipulation}`);
  }

  await client.end();
}

run().catch(console.error);
