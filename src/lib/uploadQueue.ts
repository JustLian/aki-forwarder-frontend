import { writable, get, type Writable } from "svelte/store";
import { browser } from "$app/environment";
import { toast } from "svelte-sonner";
import { httpUrl } from "$lib/config";
import { TokenBucket } from "$lib/ratelimit";


type QueueState = "pending" | "uploading" | "done" | "error" | "skipped";
type QueueItem = {
    file: File;
    id: string;
    progress: number;
    state: QueueState;
    error?: string;
}

export const queue: Writable<QueueItem[]> = writable([]);
export const uploading = writable(false);
const rateLimiter = new TokenBucket({
    requests: 40,
    seconds: 60,
});

function makeId(f: File) {
    return `${f.name}|${f.size}|${f.lastModified}`
}


export function addFiles(files: FileList | File[]) {
    const upd: QueueItem[] = [];
    const arr = Array.from(files);
    for (const f of arr) {
        if (f.size > 8 * 1024 * 1024) {
            upd.push({
                file: f,
                id: makeId(f),
                progress: 0,
                state: "skipped",
                error: "Max file size is 8MB"
            });
            continue;
        }

        const id = makeId(f);
        if (!get(queue).some((q) => q.id === id)) {
            upd.push({
                file: f,
                id,
                progress: 0,
                state: "pending"
            })
        }
    }
    queue.update((q) => [...q, ...upd]);
}


function updateQueueItemState(id: string, newState: QueueState, error?: string) {
  queue.update((list) =>
    list.map((x) => (x.id === id ? { ...x, state: newState, error} : x))
  );
}


function updateQueueItemProgress(id: string, newProgress: number) {
  queue.update((list) =>
    list.map((x) => (x.id === id ? { ...x, progress: newProgress} : x))
  );
}


export async function uploadQueue(sessionId: string | null) {
    if (!browser) return;
    if (!sessionId) {
        toast.error("Link telegram first!");
        return;
    }

    if (get(uploading)) return;

    uploading.set(true);
    try {
        for (const item of get(queue)) {
            if (item.state !== "pending") continue;
            updateQueueItemState(item.id, "uploading");
            updateQueueItemProgress(item.id, 0);
            
            try {
                await uploadOne(item, sessionId);
                updateQueueItemState(item.id, "done");
                updateQueueItemProgress(item.id, 100);
            } catch (err: any) {
                updateQueueItemState(
                    item.id,
                    "error",
                    err?.message || "Upload failed"
                );
            }

        }
    } finally {
        uploading.set(false);
    }
}


function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}


async function uploadOne(item: QueueItem, sessionId: string | null) {
    if (!sessionId) {
        throw new Error("Link Telegram first.");
    }

    const nxt = rateLimiter.nextAvailable();
    if (nxt > 0) {
        await sleep(nxt);
    }

    return new Promise<void>((resolve, reject) => {
        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("file", item.file, item.file.name);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", httpUrl("/upload"));
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                updateQueueItemProgress(item.id, Math.round(e.loaded / e.total * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                const msg = 
                    xhr.response?.detail ??
                    xhr.response?.message ??
                    `HTTP ${xhr.status}`;
                reject(new Error(msg));
            }
        }

        xhr.onerror = () => {
            reject(new Error("Network error occurred"));
        }

        xhr.send(fd);
    });
}


export function clearDone() {
    queue.update((cq) => cq.filter(q => q.state !== "done" && q.state !== "skipped"));
}

export function removeItem(id: string) {
    queue.update((cq) => cq.filter(q => q.id !== id));
}