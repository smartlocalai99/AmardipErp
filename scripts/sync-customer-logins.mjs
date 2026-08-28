import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const shouldApply = process.argv.includes("--apply");

function normalizeMobile(value) {
  return String(value || "").replace(/\D/g, "");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();

try {
  const customerResult = await client.query(`
    SELECT id, record_no, customer_name, mobile_no
    FROM elevator_service_customers
    ORDER BY record_no NULLS LAST, customer_name, id
  `);

  const missingMobile = [];
  const accounts = new Map();

  for (const customer of customerResult.rows) {
    const mobile = normalizeMobile(customer.mobile_no);
    if (!mobile) {
      missingMobile.push(customer);
      continue;
    }

    const account = accounts.get(mobile) || { mobile, records: [], names: [] };
    account.records.push(customer);
    if (customer.customer_name && !account.names.includes(customer.customer_name)) {
      account.names.push(customer.customer_name);
    }
    accounts.set(mobile, account);
  }

  const sharedAccounts = [...accounts.values()].filter((account) => account.records.length > 1).length;

  if (!shouldApply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      accounts: accounts.size,
      linkedCustomerRecords: customerResult.rows.length - missingMobile.length,
      missingMobileRecords: missingMobile.length,
      sharedAccounts,
    }, null, 2));
    process.exitCode = 2;
  } else {
    const passwordHashes = new Map(
      await Promise.all(
        [...accounts.values()].map(async (account) => [
          account.mobile,
          await bcrypt.hash(account.mobile.slice(-4), 10),
        ])
      )
    );

    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_user_links (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES elevator_service_customers(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, customer_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_user_links_customer
      ON customer_user_links(customer_id)
    `);

    const accountUserIds = [];

    for (const account of accounts.values()) {
      const result = await client.query(
        `
        INSERT INTO users (username, password_hash, name, role, phone, designation)
        VALUES ($1, $2, $3, 'customer', $1, 'Customer')
        ON CONFLICT (username) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            designation = EXCLUDED.designation
        WHERE users.role = 'customer'
        RETURNING id
        `,
        [account.mobile, passwordHashes.get(account.mobile), account.names[0] || "Customer"]
      );

      if (!result.rows[0]) {
        throw new Error("A mobile number conflicts with a non-customer user account.");
      }

      const userId = result.rows[0].id;
      accountUserIds.push(userId);
      await client.query("DELETE FROM customer_user_links WHERE user_id = $1", [userId]);

      for (const record of account.records) {
        await client.query(
          `
          INSERT INTO customer_user_links (user_id, customer_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [userId, record.id]
        );
      }
    }

    await client.query("COMMIT");

    const verification = await client.query(
      `
      SELECT u.username, u.password_hash, COUNT(cul.customer_id)::int AS linked_records
      FROM users u
      JOIN customer_user_links cul ON cul.user_id = u.id
      WHERE u.id = ANY($1::int[])
      GROUP BY u.id, u.username, u.password_hash
      `,
      [accountUserIds]
    );

    const passwordChecks = await Promise.all(
      verification.rows.map((row) => bcrypt.compare(row.username.slice(-4), row.password_hash))
    );
    const linkedRecords = verification.rows.reduce((sum, row) => sum + row.linked_records, 0);

    if (verification.rows.length !== accounts.size || linkedRecords !== customerResult.rows.length - missingMobile.length || passwordChecks.some((valid) => !valid)) {
      throw new Error("Customer credential verification failed after synchronization.");
    }

    console.log(JSON.stringify({
      mode: "applied-and-verified",
      accounts: verification.rows.length,
      linkedCustomerRecords: linkedRecords,
      missingMobileRecords: missingMobile.length,
      sharedAccounts,
      passwordsVerified: passwordChecks.length,
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
