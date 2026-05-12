import pg from 'pg';

const { Client } = pg;
const connectionString = "postgres://postgres:Prutus227055@unscriptx-db.cxkccq4i00c9.ap-south-1.rds.amazonaws.com:5432/postgres";

async function copyDatabase() {
    const client = new Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        
        console.log("Disconnecting other users to allow copy...");
        await client.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = 'postgres' AND pid <> pg_backend_pid();
        `);

        console.log("Dropping empty new database...");
        await client.query('DROP DATABASE IF EXISTS unscriptx_student;');
        
        console.log("Creating new database with tables copied from existing...");
        await client.query('CREATE DATABASE unscriptx_student WITH TEMPLATE postgres;');
        
        console.log("✅ Successfully cloned database! Tables are copied.");
    } catch (err) {
        console.error("❌ Error copying database:", err);
    } finally {
        await client.end();
    }
}

copyDatabase();
