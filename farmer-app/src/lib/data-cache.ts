import { Directory, File, Paths } from "expo-file-system";

type Entry = { data: unknown; at: number };

const memory = new Map<string, Entry>();
const DIR_NAME = "api-cache";

function dir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function fileFor(path: string): File {
  let h = 5381;
  for (let i = 0; i < path.length; i++) h = ((h << 5) + h + path.charCodeAt(i)) | 0;
  return new File(dir(), `${(h >>> 0).toString(36)}.json`);
}

export function memoryGet(path: string): Entry | undefined {
  return memory.get(path);
}

export function memorySet(path: string, data: unknown) {
  const entry = { data, at: Date.now() };
  memory.set(path, entry);
  if (memory.size > 100) memory.delete(memory.keys().next().value!);
  void persist(path, entry);
}

export function memoryDelete(path: string) {
  memory.delete(path);
}

/** Mark everything stale after a change, so other screens refetch; saved copies stay for offline use. */
export function markAllStale() {
  for (const [k, v] of memory) memory.set(k, { ...v, at: 0 });
}

async function persist(path: string, entry: Entry) {
  try {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    await fileFor(path).write(JSON.stringify({ path, ...entry }));
  } catch {
    // storage full or unavailable: memory cache still works
  }
}

export async function diskGet(path: string): Promise<Entry | undefined> {
  try {
    const f = fileFor(path);
    if (!f.exists) return undefined;
    const saved = JSON.parse(await f.text()) as { path: string; data: unknown; at: number };
    if (saved.path !== path) return undefined;
    const entry = { data: saved.data, at: saved.at };
    if (!memory.has(path)) memory.set(path, entry);
    return entry;
  } catch {
    return undefined;
  }
}

/** Forget everything (on sign out, so the next person on this phone never sees the last farmer's data). */
export function clearDataCache() {
  memory.clear();
  try {
    const d = dir();
    if (d.exists) d.delete();
  } catch {
    // ignore
  }
}
