import fs from "node:fs";
import { Pool } from "pg";

export const confirmedServiceVisitMappings = [
  map(1, "1912AMRL6", "HYDERR HOSPITALS", "NANDYAL", "9849596986", 6, "2022-12-22", "2023-11-25", "1912AG6"),
  map(2, "1915MMRL4", "SREEDHAR REDDY", "KADAPA TOWN", "9666626651", 6, "2021-06-19", "2022-10-22", "1915MG4"),
  map(3, "2513MT3", "GANGAVARAM LODGE", "KADAPA", null, 6, "2025-12-18", "2026-04-23", "AMCP2"),
  map(4, null, "L JOGI RAMI REDDY", "KADAPA TOWN", "9849794289", 4, "2023-12-27", "2024-07-22", "2311AG3"),
  map(5, null, "S KIRAN KUMAR REDDY", "KADAPA TOWN", "9885280455", 3, "2024-01-04", "2024-07-11", "2312AG3"),
  map(6, null, "VISHNU VIDYA MANDHIR", "KADAPA TOWN", null, 3, "2023-12-26", "2024-07-11", "2324MT2"),
  map(8, null, "SRI VIJAYA DURGA APARTMENT 1", "KADAPA TOWN", "9949746413", 3, "2023-12-16", "2024-06-11", "AMC1"),
  map(9, null, "KRISHNA REDDY CHOLLA", null, null, 2, "2023-12-18", "2024-06-28", "AMC3"),
  map(10, null, "AVANTHA FASHIONS", "KADAPA TOWN", null, 2, "2024-01-01", "2024-06-20", "2319AG3"),
  map(11, null, "SITHA MAHA LAKSHMI", "APSARA CIRCLE", null, 2, "2024-07-04", "2024-08-02", "2401MT5"),
  map(12, null, "RAJA REDDY", "PRODDUTUR", null, 2, "2023-12-29", "2024-06-29", "2315AG2"),
  map(13, null, "BALU HYDRALIC", "KADAPA TOWN", null, 2, "2023-12-26", "2024-06-19", "2318MH2"),
  map(14, null, "SRI VIJAYA DURGA APARTMENT 2", "KADAPA TOWN", "9949746413", 2, "2023-12-16", "2024-06-11", "AMC2"),
  map(15, "1912AMRL6", "SITHA MAHA LAKSHMI", "APSARA CIRCLE", "9701016511", 1, "2024-11-13", "2024-11-13", "2401MT5"),
  map(16, "1915MMRL4", "SREEDHAR REDDY", "#N/A", "#N/A", 1, "2021-04-09", "2021-04-09", "1915MG4"),
  map(18, "2130AT4", "RIMS", "KADAPA TOWN", null, 1, "2021-08-26", "2021-08-26", "2130AG5"),
  map(19, "2130AT4", "RAINBOW APPARTMENT", "KADAPA TOWN", null, 1, "2021-09-08", "2021-09-08", "2135MT5"),
  map(20, "2501AG5", "LAKSHMI PRATHIBA GROUP", "KADAPA TOWN", "8688888075", 1, "2025-05-22", "2025-05-22", "2443AG5"),
  map(21, "CHANDRA MOHAN REDDY", "NIHAR ENCLAVE (VASUDEVA REDDY)", "KADAPA TOWN", "6301416304", 1, "2024-06-08", "2024-06-08", "2144AT5"),
  map(22, null, "SRINIVASA ENCLAVE", "KADAPA", null, 1, "2026-04-13", "2026-04-13", "AMCP9"),
  map(23, null, "PULSE HOSPITAL", "KADAPA", null, 1, "2026-04-24", "2026-04-24", "2544AG2"),
  map(24, null, "GOPINATH", "NEAR DURGAMMA TEMPLE", null, 1, "2024-06-20", "2024-06-20", "2332AG4"),
  map(25, null, "PAVAN HOSPITAL", "KADAPA", null, 1, "2024-06-05", "2024-06-05", "2329AG5"),
  map(26, null, "SAI BRUNDHAVAN APARTMENT", "KADAPA", "9440772163", 1, "2025-09-18", "2025-09-18", "AMCP3"),
  map(27, null, "GANGAVARAM LODGE", "KADAPA", null, 1, "2026-05-20", "2026-05-20", "AMCP2"),
  map(28, null, "MANVITHA HOMES", "KADAPA", null, 1, "2026-03-08", "2026-03-08", "AMCP8"),
  map(29, null, "VISWANATHA ENCLAVE 2", "KADAPA", null, 1, "2026-06-17", "2026-06-17", "AMCP11"),
  map(30, null, "SITHA MAHA LAKSHMI 2", "KADAPA TOWN", "9701016511", 1, "2024-08-02", "2024-08-02", "2401MT5"),
  map(31, null, "RAJASEKHAR REDDY(CRS RESIDENCY)", "REDDY COLONY", null, 1, "2024-06-05", "2024-06-05", "2342MT5"),
  map(32, null, "NAGI REDDY", "NEAR MOHAN OFFICE BACK SIDE", null, 1, "2024-06-01", "2024-06-01", "2335AG3"),
  map(33, null, "OHM PRAKASH", null, null, 1, "2024-07-09", "2024-07-09", "2337AG2"),
  map(34, null, "AMMAVARISHALA", "NEAR PEDDA DARGA", null, 1, "2024-06-05", "2024-06-05", "2326AG2"),
  map(35, null, "S N APPARTMENT", "KADAPA TOWN", "9491222291", 1, "2023-12-27", "2023-12-27", "2313AT5"),
  map(36, null, "SIDDA REDDY", "BALAJI NAGAR", "9441486626", 1, "2024-08-19", "2024-08-19", "2325MT3"),
  map(37, null, "7 HILLS APPARTMENT", "REDDY COLONY", null, 1, "2024-06-21", "2024-06-21", "2345MT5"),
  map(38, null, "AMMAVARISHALA", "KADAPA TOWN", "9949111200", 1, "2025-02-22", "2025-02-22", "2326AG2"),
];

function map(reviewNo, customerCode, customerName, city, mobile, records, firstDate, lastDate, targetCustomerCode) {
  return {
    reviewNo,
    source: { customerCode, customerName, city, mobile },
    expected: { records, firstDate, lastDate },
    targetCustomerCode,
  };
}

function sameNullable(a, b) {
  return (a ?? null) === (b ?? null);
}

function groupMatches(mapping, group) {
  return (
    sameNullable(group.customer_code, mapping.source.customerCode) &&
    sameNullable(group.customer_name_snapshot, mapping.source.customerName) &&
    sameNullable(group.city_snapshot, mapping.source.city) &&
    sameNullable(group.mobile_no_snapshot, mapping.source.mobile) &&
    Number(group.records) === mapping.expected.records &&
    group.first_date === mapping.expected.firstDate &&
    group.last_date === mapping.expected.lastDate
  );
}

export function buildUpdatePlan({ groups, customers }) {
  const ready = [];
  const skipped = [];

  for (const mapping of confirmedServiceVisitMappings) {
    const group = groups.find((item) => groupMatches(mapping, item));
    const customer = customers.find((item) => item.customer_code === mapping.targetCustomerCode);

    if (!group || !customer) {
      skipped.push({
        mapping,
        reason: !group ? "source group not found or count/date mismatch" : "target customer not found",
      });
      continue;
    }

    ready.push({ mapping, group, customer });
  }

  return { ready, skipped };
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const env = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
  if (!env) {
    throw new Error("DATABASE_URL is missing");
  }

  return env.slice("DATABASE_URL=".length).replace(/^['"]|['"]$/g, "");
}

async function loadGroups(pool) {
  const result = await pool.query(`
    SELECT
      customer_code,
      customer_name_snapshot,
      city_snapshot,
      mobile_no_snapshot,
      COUNT(*)::int AS records,
      MIN(service_date)::text AS first_date,
      MAX(service_date)::text AS last_date
    FROM elevator_service_visits
    WHERE customer_id IS NULL
    GROUP BY 1, 2, 3, 4
  `);

  return result.rows;
}

async function loadCustomers(pool) {
  const targetCodes = [...new Set(confirmedServiceVisitMappings.map((mapping) => mapping.targetCustomerCode))];
  const result = await pool.query(
    `
    SELECT id, customer_code, customer_name, city, mobile_no
    FROM elevator_service_customers
    WHERE customer_code = ANY($1)
    `,
    [targetCodes]
  );

  return result.rows;
}

function sourceWhereClause(startIndex = 1) {
  return `
    customer_id IS NULL
    AND customer_code IS NOT DISTINCT FROM $${startIndex}
    AND customer_name_snapshot IS NOT DISTINCT FROM $${startIndex + 1}
    AND city_snapshot IS NOT DISTINCT FROM $${startIndex + 2}
    AND mobile_no_snapshot IS NOT DISTINCT FROM $${startIndex + 3}
    AND service_date >= $${startIndex + 4}
    AND service_date <= $${startIndex + 5}
  `;
}

async function applyMapping(pool, item) {
  const { mapping, customer } = item;
  const result = await pool.query(
    `
    UPDATE elevator_service_visits
    SET
      customer_id = $7,
      customer_code = $8,
      customer_name_snapshot = $9,
      city_snapshot = $10,
      mobile_no_snapshot = $11,
      updated_at = now()
    WHERE ${sourceWhereClause(1)}
    RETURNING id
    `,
    [
      mapping.source.customerCode,
      mapping.source.customerName,
      mapping.source.city,
      mapping.source.mobile,
      mapping.expected.firstDate,
      mapping.expected.lastDate,
      customer.id,
      customer.customer_code,
      customer.customer_name,
      customer.city,
      customer.mobile_no,
    ]
  );

  return result.rowCount;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const pool = new Pool({
    connectionString: loadDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const [groups, customers] = await Promise.all([loadGroups(pool), loadCustomers(pool)]);
    const plan = buildUpdatePlan({ groups, customers });

    console.table(
      plan.ready.map(({ mapping, customer }) => ({
        reviewNo: mapping.reviewNo,
        sourceName: mapping.source.customerName,
        records: mapping.expected.records,
        targetCode: customer.customer_code,
        targetName: customer.customer_name,
      }))
    );

    if (plan.skipped.length) {
      console.table(
        plan.skipped.map(({ mapping, reason }) => ({
          reviewNo: mapping.reviewNo,
          sourceName: mapping.source.customerName,
          targetCode: mapping.targetCustomerCode,
          reason,
        }))
      );
    }

    const totalRows = plan.ready.reduce((sum, item) => sum + item.mapping.expected.records, 0);
    console.log(`${dryRun ? "Dry run" : "Apply"} plan: ${plan.ready.length} groups, ${totalRows} rows`);

    if (dryRun) return;
    if (plan.skipped.length) {
      throw new Error("Refusing to apply while confirmed mappings are skipped.");
    }

    await pool.query("BEGIN");
    let updated = 0;
    for (const item of plan.ready) {
      const rowCount = await applyMapping(pool, item);
      if (rowCount !== item.mapping.expected.records) {
        throw new Error(`Review ${item.mapping.reviewNo} updated ${rowCount}, expected ${item.mapping.expected.records}`);
      }
      updated += rowCount;
    }
    await pool.query("COMMIT");
    console.log(`Updated ${updated} service visit rows`);
  } catch (error) {
    try {
      await pool.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
