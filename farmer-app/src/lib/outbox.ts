import { File, Paths } from "expo-file-system";
import { onOnlineChange } from "./network";

/** A change the farmer made while offline, sent once the phone is back online. */
export interface QueuedRequest {
  id: string;
  path: string;
  method: string;
  body?: string;
  at: number;
}

let queue: QueuedRequest[] | null = null;
let flushing = false;
const listeners = new Set<(count: number) => void>();
let sender: ((req: QueuedRequest) => Promise<"sent" | "offline" | "rejected">) | null = null;

const file = () => new File(Paths.document, "outbox.json");

async function load(): Promise<QueuedRequest[]> {
  if (queue) return queue;
  try {
    const f = file();
    queue = f.exists ? (JSON.parse(await f.text()) as QueuedRequest[]) : [];
  } catch {
    queue = [];
  }
  return queue;
}

async function save() {
  try {
    await file().write(JSON.stringify(queue ?? []));
  } catch {
  }
  listeners.forEach((l) => l(queue?.length ?? 0));
}

export async function enqueue(req: Omit<QueuedRequest, "id" | "at">): Promise<void> {
  const q = await load();
  // A newer change to the same thing replaces the older one (e.g. location saved twice).
  const i = q.findIndex((x) => x.method === req.method && x.path === req.path && req.method !== "POST");
  const item = { ...req, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now() };
  if (i >= 0) q[i] = item;
  else q.push(item);
  await save();
}

export async function pendingCount(): Promise<number> {
  return (await load()).length;
}

export function onOutboxChange(fn: (count: number) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Send queued changes in order. Stops at the first network failure; drops ones the server rejects. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !sender) return 0;
  flushing = true;
  let sent = 0;
  try {
    const q = await load();
    while (q.length) {
      const result = await sender(q[0]!).catch(() => "offline" as const);
      if (result === "offline") break;
      q.shift();
      if (result === "sent") sent++;
      await save();
    }
  } finally {
    flushing = false;
  }
  return sent;
}

export function setOutboxSender(fn: (req: QueuedRequest) => Promise<"sent" | "offline" | "rejected">) {
  sender = fn;
  onOnlineChange((online) => {
    if (online) void flushOutbox();
  });
}

export function clearOutbox() {
  queue = [];
  void save();
}
