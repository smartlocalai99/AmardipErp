import fs from "node:fs";
import pg from "pg";

const { Pool } = pg;
const sourcePath = process.argv.slice(2).find((value) => !value.startsWith("--"));
const shouldApply = process.argv.includes("--apply");

if (!sourcePath) {
  throw new Error("Pass the pasted customer text file path.");
}

function clean(value) {
  return String(value || "")
    .replace(/^"|"$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRows(text) {
  const repaired = text.replace(/"([^"\r\n]*)\r?\n([^"\r\n]*)"/g, '"$1 $2"');
  const lines = repaired.split(/\r?\n/).filter((line) => line.trim());

  return lines.slice(1).map((line) => {
    const columns = line.split("\t");
    const recordText = clean(columns[0]);

    return {
      record_no: /^\d+$/.test(recordText) ? Number(recordText) : null,
      customer_code: clean(columns[1]),
      customer_name: clean(columns[2]),
      address: clean(columns[3]),
      city: clean(columns[4]),
      mobile_no: clean(columns[5]),
      hoc_date: clean(columns[6]),
      customer_status: clean(columns[7]),
      amc_warranty_due: clean(columns[8]),
      amc_starting_date: clean(columns[9]),
      amc_ending_date: clean(columns[10]),
      no_of_passenger: clean(columns[11]),
      door_type: clean(columns[12]),
      cabin: clean(columns[13]),
      no_of_floors: clean(columns[14]),
      motor_make: clean(columns[15]),
      controller_make: clean(columns[16]),
      drive_make: clean(columns[17]),
      ard_make: clean(columns[18]),
      drive_model_no: clean(columns[19]),
      motor_model_no: clean(columns[20]),
      elevator_type: clean(columns[21]),
      door_make: clean(columns[22]),
      location: clean(columns[23]),
    };
  }).filter((row) => row.customer_code && row.customer_name);
}

const fields = [
  "record_no",
  "customer_code",
  "customer_name",
  "address",
  "city",
  "mobile_no",
  "hoc_date",
  "customer_status",
  "amc_warranty_due",
  "amc_starting_date",
  "amc_ending_date",
  "no_of_passenger",
  "door_type",
  "cabin",
  "no_of_floors",
  "motor_make",
  "controller_make",
  "drive_make",
  "ard_make",
  "drive_model_no",
  "motor_model_no",
  "elevator_type",
  "door_make",
  "location",
];

const updateFields = fields.filter((field) => field !== "record_no");
const rows = parseRows(fs.readFileSync(sourcePath, "utf8"));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  const existing = await client.query("SELECT record_no, customer_code FROM elevator_service_customers");
  const existingRecords = new Set(existing.rows.filter((row) => row.record_no !== null).map((row) => Number(row.record_no)));
  const existingCodes = new Set(existing.rows.map((row) => clean(row.customer_code)).filter(Boolean));
  const newNumbered = rows.filter((row) => row.record_no !== null && !existingRecords.has(row.record_no)).length;
  const newUnnumbered = rows.filter((row) => row.record_no === null && !existingCodes.has(row.customer_code)).length;

  if (!shouldApply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      parsedRows: rows.length,
      numberedRows: rows.filter((row) => row.record_no !== null).length,
      unnumberedRows: rows.filter((row) => row.record_no === null).length,
      newNumbered,
      newUnnumbered,
    }, null, 2));
  } else {
    await client.query("BEGIN");

    for (const row of rows) {
      const values = fields.map((field) => row[field] || null);

      if (row.record_no !== null) {
        await client.query(
          `
          INSERT INTO elevator_service_customers (${fields.join(", ")})
          VALUES (${fields.map((_, index) => `$${index + 1}`).join(", ")})
          ON CONFLICT (record_no) DO UPDATE SET
            ${updateFields.map((field) => `${field} = COALESCE(NULLIF(EXCLUDED.${field}, ''), elevator_service_customers.${field})`).join(",\n            ")},
            updated_at = NOW()
          `,
          values
        );
      } else {
        const matched = await client.query(
          "SELECT id FROM elevator_service_customers WHERE customer_code = $1 ORDER BY created_at LIMIT 1",
          [row.customer_code]
        );

        if (matched.rows[0]) {
          await client.query(
            `
            UPDATE elevator_service_customers
            SET ${updateFields.map((field, index) => `${field} = COALESCE(NULLIF($${index + 1}, ''), ${field})`).join(", ")},
                updated_at = NOW()
            WHERE id = $${updateFields.length + 1}
            `,
            [...updateFields.map((field) => row[field] || null), matched.rows[0].id]
          );
        } else {
          await client.query(
            `
            INSERT INTO elevator_service_customers (${fields.join(", ")})
            VALUES (${fields.map((_, index) => `$${index + 1}`).join(", ")})
            `,
            values
          );
        }
      }
    }

    await client.query("COMMIT");
    const verification = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE NULLIF(regexp_replace(COALESCE(mobile_no, ''), '\\D', '', 'g'), '') IS NULL
        )::int AS missing_mobile
      FROM elevator_service_customers
    `);

    console.log(JSON.stringify({
      mode: "applied",
      importedRows: rows.length,
      newNumbered,
      newUnnumbered,
      databaseTotal: verification.rows[0].total,
      databaseMissingMobile: verification.rows[0].missing_mobile,
    }, null, 2));
  }
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {}
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
