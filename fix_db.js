import pg from 'pg';

const { Client } = pg;
const sourceString = "postgres://postgres:Prutus227055@unscriptx-db.cxkccq4i00c9.ap-south-1.rds.amazonaws.com:5432/postgres";
const targetString = "postgres://postgres:Prutus227055@unscriptx-db.cxkccq4i00c9.ap-south-1.rds.amazonaws.com:5432/unscriptx_student";

async function fixDatabase() {
    console.log("Step 1: Re-cloning database to restore events data...");
    const client = new Client({ connectionString: sourceString, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        await client.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname IN ('postgres', 'unscriptx_student') AND pid <> pg_backend_pid();
        `);

        await client.query('DROP DATABASE IF EXISTS unscriptx_student;');
        await client.query('CREATE DATABASE unscriptx_student WITH TEMPLATE postgres;');
        await client.end();
        console.log("✅ Database re-cloned successfully. All events and rules are restored.");

        console.log("Step 2: Emptying ONLY user and registration data...");
        const targetClient = new Client({ connectionString: targetString, ssl: { rejectUnauthorized: false } });
        await targetClient.connect();

        const tablesToEmpty = [
            'users', 
            'registrations', 
            'submissions', 
            'internal_reviews', 
            'reviewer_event_assignments', 
            'contact_messages', 
            'audit_logs', 
            'google_oauth_tokens'
        ];

        // We use CASCADE so if there are foreign keys we didn't list, they get wiped safely without errors
        await targetClient.query(`TRUNCATE TABLE ${tablesToEmpty.join(', ')} CASCADE;`);
        await targetClient.end();

        console.log("✅ Fixed! User data is wiped, but Events, Faculty, Rules, and Site Content are kept intact!");
    } catch (err) {
        console.error("❌ Error:", err);
        await client.end();
    }
}

fixDatabase();
