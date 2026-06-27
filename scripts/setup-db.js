const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// Manually load .env.local variables
try {
    const envPath = path.join(__dirname, "../.env.local");
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, "utf8");
        envFile.split(/\r?\n/).forEach((line) => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.substring(1, value.length - 1);
                }
                process.env[key] = value;
            }
        });
        console.log("Successfully loaded .env.local environment variables.");
    }
} catch (e) {
    console.warn("Could not load .env.local file:", e.message);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function setup() {
    console.log("Connecting to database pool...");
    const client = await pool.connect();
    
    try {
        console.log("Creating users table if it does not exist...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                role VARCHAR(20) NOT NULL,
                phone VARCHAR(20),
                designation VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)");
        console.log("Table 'users' is verified/created.");

        console.log("Checking if default superadmin exists...");
        const res = await client.query("SELECT id FROM users WHERE username = $1", ["superadmin"]);
        if (res.rowCount === 0) {
            console.log("Hashing password for superadmin...");
            const hash = await bcrypt.hash("superadmin123", 10);
            await client.query(
                `INSERT INTO users (username, password_hash, name, role, phone) VALUES ($1, $2, $3, $4, $5)`,
                ["superadmin", hash, "Super Admin", "superadmin", "+91 99999 99999"]
            );
            console.log("Default superadmin created successfully.");
        }

        console.log("Checking if default customer exists...");
        const resCust = await client.query("SELECT id FROM users WHERE username = $1", ["9999999999"]);
        if (resCust.rowCount === 0) {
            console.log("Hashing password for customer...");
            const hashCust = await bcrypt.hash("customer123", 10);
            await client.query(
                `INSERT INTO users (username, password_hash, name, role, phone) VALUES ($1, $2, $3, $4, $5)`,
                ["9999999999", hashCust, "Apex Business Park", "customer", "9999999999"]
            );
            console.log("Default customer created successfully: username='9999999999', password='customer123'");
        }

        console.log("Checking if default technician exists...");
        const resTech = await client.query("SELECT id FROM users WHERE username = $1", ["tech50"]);
        if (resTech.rowCount === 0) {
            console.log("Hashing password for technician...");
            const hashTech = await bcrypt.hash("tech123", 10);
            await client.query(
                `INSERT INTO users (username, password_hash, name, role, phone) VALUES ($1, $2, $3, $4, $5)`,
                ["tech50", hashTech, "Suresh R.", "worker", "9876500001"]
            );
            console.log("Default technician created successfully: username='tech50', password='tech123'");
        }

        console.log("Checking if default storekeeper exists...");
        const resStore = await client.query("SELECT id FROM users WHERE username = $1", ["store50"]);
        if (resStore.rowCount === 0) {
            console.log("Hashing password for storekeeper...");
            const hashStore = await bcrypt.hash("store123", 10);
            await client.query(
                `INSERT INTO users (username, password_hash, name, role, phone) VALUES ($1, $2, $3, $4, $5)`,
                ["store50", hashStore, "Rajesh K.", "storekeeper", "9876500003"]
            );
            console.log("Default storekeeper created successfully: username='store50', password='store123'");
        }
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
        console.log("Database connection closed.");
    }
}

setup();
