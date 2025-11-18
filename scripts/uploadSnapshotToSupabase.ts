import path from 'node:path';
import fs from 'node:fs/promises';
import { uploadSnapshotToSupabase } from '@/lib/admin/supabaseIngest';

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'snapshots');

const findLatestSnapshot = async (): Promise<string> => {
  const entries = await fs.readdir(SNAPSHOT_DIR);
  const snapshots = await Promise.all(
    entries
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => {
        const filePath = path.join(SNAPSHOT_DIR, name);
        const stat = await fs.stat(filePath);
        return { filePath, mtime: stat.mtimeMs };
      })
  );

  if (snapshots.length === 0) {
    throw new Error('Heç bir snapshot tapılmadı.');
  }

  return snapshots.sort((a, b) => b.mtime - a.mtime)[0].filePath;
};

const main = async () => {
  const snapshotArg = process.argv[2];
  let jobIdArg = process.argv[3];

  let snapshotPath: string;
  if (snapshotArg) {
    try {
      const resolved = path.resolve(snapshotArg);
      await fs.stat(resolved);
      snapshotPath = resolved;
    } catch {
      jobIdArg = snapshotArg;
      snapshotPath = await findLatestSnapshot();
    }
  } else {
    snapshotPath = await findLatestSnapshot();
  }

  const jobId = jobIdArg ?? `gha-${Date.now()}`;

  console.log(`Snapshot Supabase-ə göndərilir: ${snapshotPath}`);
  const result = await uploadSnapshotToSupabase(jobId, snapshotPath);
  console.log(`Supabase cavabı:`, result);
};

main().catch((error) => {
  console.error('Supabase sinkronizasiya xətası:', error);
  process.exit(1);
});
