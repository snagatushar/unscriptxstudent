import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: "postgres://postgres:Prutus227055@unscriptx-db.cxkccq4i00c9.ap-south-1.rds.amazonaws.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query("SELECT id, email, role FROM users WHERE LOWER(email) = 'nagatushars05@gmail.com'");
    console.log('User role info:', res.rows);
    await pool.end();
  } catch (err) {
    console.error('DB Error:', err);
    process.exit(1);
  }
}

check();
