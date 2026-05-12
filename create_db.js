import pg from 'pg';

const { Client } = pg;

// Existing DB URL
const connectionString = "postgres://postgres:Prutus227055@unscriptx-db.cxkccq4i00c9.ap-south-1.rds.amazonaws.com:5432/postgres";

async function createDatabase() {
    const client = new Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        console.log("Connected to existing PostgreSQL server.");
        
        // Attempt to create the new database
        await client.query('CREATE DATABASE unscriptx_student;');
        console.log("✅ Successfully created new database: unscriptx_student");
    } catch (err) {
        if (err.code === '42P04') {
            console.log("✅ Database 'unscriptx_student' already exists!");
        } else {
            console.error("❌ Error creating database:", err);
        }
    } finally {
        await client.end();
    }
}

createDatabase();
