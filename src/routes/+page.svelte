<script lang="ts">

    import { onMount } from "svelte";
    import { sessionId, status, connectWS } from "$lib/ws";
    import { qr } from "@svelte-put/qr/svg";
    import { browser } from "$app/environment";
    import { API_BASE } from "$lib/config";

    let isMobile = false;
    if (browser) {
        const ua = navigator.userAgent.toLowerCase();
        const mobileRe = /(iphone|ipod|ipad(?!.*mac os)|android.+mobile|windows phone|iemobile|opera mini|blackberry|bb10|mobile safari|silk|kindle|palm|symbian)/;
        isMobile = mobileRe.test(ua) || window.innerWidth < 900;
    }

    type QueueItem = {
        file: File;
        id: string;
        progress: number;
        state: "pending" | "uploading" | "done" | "error" | "skipped";
        error?: string;
    }

    let queue: QueueItem[] = [];
    let uploading = false;
    let message = "";

    $: $sessionId, $status;

    onMount(() => {
        connectWS();
    });

    function makeId(f: File) {
        return `${f.name}|${f.size}|${f.lastModified}`
    }

    function addFiles(files: FileList | File[]) {
        const arr = Array.from(files);
        for (const f of arr) {
            if (f.size > 8 * 1024 * 1024) {
                queue.push({
                    file: f,
                    id: makeId(f),
                    progress: 0,
                    state: "skipped",
                    error: "Max file size is 8MB"
                });
                continue;
            }

            const id = makeId(f);
            if (!queue.some((q) => q.id === id)) {
                queue.push({
                    file: f,
                    id,
                    progress: 0,
                    state: "pending"
                })
            }
        }
        queue = queue; // update pls
    }

    function onInputChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files.length) {
            addFiles(input.files);
            input.value = "";
        }
    }

    function onDragOver(e: DragEvent) {
        e.preventDefault();
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        if (!e.dataTransfer) return;
        const files = e.dataTransfer.files;
        if (files && files.length) {
            addFiles(files);
        }
    }

    async function uploadQueue() {
        message = "";
        if (!browser) return;
        if (!$sessionId) {
            message = "Link Telegram first.";
            return;
        }

        if (uploading) return;

        uploading = true;
        try {
            for (const item of queue) {
                if (item.state !== "pending") continue;
                item.state = "uploading";
                item.progress = 0;
                queue = queue;
                
                try {
                    await uploadOne(item);
                    item.state = "done";
                    item.progress = 100;
                } catch (err: any) {
                    item.state = "error";
                    item.error = err?.message || "Upload failed"
                } finally {
                    queue = queue;
                }

            }
        } finally {
            uploading = false;
        }
    }

    function uploadOne(item: QueueItem) {
        if (!$sessionId) {
            throw new Error("Link Telegram first.");
        }

        return new Promise<void>((resolve, reject) => {
            const fd = new FormData();
            fd.append("sessionId", $sessionId);
            fd.append("file", item.file, item.file.name);

            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${API_BASE}/upload`);
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    item.progress = Math.round(e.loaded / e.total * 100);
                    queue = queue;
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

    function clearDone() {
        queue = queue.filter(q => q.state !== "done" && q.state !== "skipped");
    }

    function removeItem(id: string) {
        queue = queue.filter(q => q.id !== id);
    }

</script>

<style>
    .qr {
        max-height: 10em;
    }
</style>

{#if isMobile}
    <p>Mobile access is restricted. Please use a desktop browser.</p>
{:else}
<input type="file" class="hidden" id="file-input" multiple on:change={onInputChange} />
<div class="content flex items-center justify-between flex-col p-4 h-full">

    <div class="flex flex-col justify-center items-center gap-5">
        <h1 class="text-2xl font-bold">Aki Forwarder</h1>
        {#if $status == "connected"}
            <svg class="qr mt-3"
                use:qr={{
                    data: 'https://t.me/aki_forwarder_bot?start=' + $sessionId,
                }}
            />
        {/if}
        {#if $status == "linked"}
            <div
                class="item dropzone flex flex-col items-center justify-center p-2"
                on:dragover={onDragOver}
                on:drop={onDrop}
                role="region"
            >
                <h2 class="font-bold text-xl">Drag & drop files here</h2>
                <div class="gray-text m-0.5 mb-1">or</div>
                <label for="file-input" class="base-border file-select font-semibold cursor-pointer">Select files <span class="gray-text font-medium">(max 8mb)</span></label>
            </div>
            <div class="item queue p-2 gap-2 flex flex-col">
                {#each queue as item (item.id)}
                    <div class="row base-border item-file p-3 gap-1 flex flex-col">
                        <div class="flex flex-row justify-between items-center">
                            <div>
                                <div class="font-medium">{item.file.name}</div>
                                <div class="gray-text flex flex-row gap-1">
                                    <div>
                                        {(item.file.size / (1024 * 1024)).toFixed(2)}MB -
                                    </div>
                                    <div class="state">
                                        {#if item.state === "pending"}Pending{/if}
                                        {#if item.state === "uploading"}Uploading…{/if}
                                        {#if item.state === "done"}Done{/if}
                                        {#if item.state === "skipped"}Skipped{/if}
                                        {#if item.state === "error"}Error: {item.error}{/if}
                                    </div>
                                </div>
                            </div>
                            <div>
                                {#if item.state === "pending"}
                                    <button class="small text-red-900"
                                    on:click={() => removeItem(item.id)}>
                                        Remove
                                    </button>
                                {/if}
                            </div>
                        </div>
                        <div class="progressbar" aria-label="progress">
                            <div style={`width: ${item.progress}%`}></div>
                        </div>
                    </div>
                {/each}
            </div>
            <div>
                <button class="base-border px-4 cursor-pointer font-semibold" on:click|preventDefault={uploadQueue} disabled={uploading || queue.every(q => q.state !== "pending")}>
                    {uploading ? "Uploading..." : "Upload all"}
                </button>
                <button class="small base-border px-4 cursor-pointer font-semibold" on:click={clearDone}>
                    Clear done
                </button>
            </div>
        {/if}
        {#if message}
            <p>{message}</p>
        {/if}
    </div>

    <div class="flex flex-row gap-3 gray-text text-sm font-medium">
        <p>Status: {$status}</p>
        {#if $sessionId}
            <p class="border-l-1 pl-3">Session ID: {$sessionId}</p>
        {/if}
    </div>

</div>
{/if}