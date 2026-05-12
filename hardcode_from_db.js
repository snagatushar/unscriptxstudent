import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;
const connectionString = "postgres://postgres:Prutus227055@unscriptx-db.cxkccq4i00c9.ap-south-1.rds.amazonaws.com:5432/postgres";

async function generateHardcodedHook() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        
        // Fetch data
        const eventsRes = await client.query('SELECT * FROM events ORDER BY created_at ASC;');
        const committeeRes = await client.query('SELECT * FROM committee ORDER BY display_order ASC;');
        const rulesRes = await client.query('SELECT * FROM general_rules ORDER BY display_order ASC;');

        // Format events properly
        const formattedEvents = eventsRes.rows.map(row => ({
            ...row,
            entry_fee: Number(row.entry_fee || 0),
            participants_count: Number(row.participants_count || 0),
        }));

        const eventsCode = `const HARDCODED_EVENTS: DatabaseEvent[] = ${JSON.stringify(formattedEvents, null, 2)};`;
        const committeeCode = `const HARDCODED_COMMITTEE: CommitteeMember[] = ${JSON.stringify(committeeRes.rows, null, 2)};`;
        const rulesCode = `const HARDCODED_RULES: GeneralRule[] = ${JSON.stringify(rulesRes.rows, null, 2)};`;

        const fileContent = `import { useState, useEffect } from 'react';
import { DatabaseEvent, CommitteeMember, GeneralRule } from '../types';

// ─── HARDCODED DATA PULLED FROM DATABASE ────────────────────────────

${eventsCode}

${committeeCode}

${rulesCode}

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useEvents() {
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setEvents(HARDCODED_EVENTS);
      setLoading(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return { events, loading };
}

export function useCommittee() {
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommittee(HARDCODED_COMMITTEE);
      setLoading(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return { committee, loading };
}

export function useGeneralRules() {
  const [rules, setRules] = useState<GeneralRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRules(HARDCODED_RULES);
      setLoading(false);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return { rules, loading };
}
`;

        const hookPath = path.join(process.cwd(), 'src', 'hooks', 'useAwsData.ts');
        fs.writeFileSync(hookPath, fileContent, 'utf8');
        console.log("✅ Successfully fetched data from database and hardcoded into useAwsData.ts!");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await client.end();
    }
}

generateHardcodedHook();
