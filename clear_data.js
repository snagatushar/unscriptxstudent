import pg from 'pg';

const { Client } = pg;
const connectionString = "postgres://postgres:Prutus227055@unscriptx-db.cxkccq4i00c9.ap-south-1.rds.amazonaws.com:5432/unscriptx_student";

async function clearData() {
    const client = new Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        
        // Get all tables
        const res = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public';
        `);
        
        const tables = res.rows.map(row => row.tablename);
        
        if (tables.length > 0) {
            console.log("Emptying data from tables:", tables.join(', '));
            // TRUNCATE empties the tables but keeps the structure
            await client.query(`TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} CASCADE;`);
            console.log("✅ All tables are now empty and ready for the student site!");
        } else {
            console.log("No tables found in public schema.");
        }
        
    } catch (err) {
        console.error("❌ Error clearing data:", err);
    } finally {
        await client.end();
    }
}

clearData();
