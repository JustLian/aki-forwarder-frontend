<script lang="ts">

    import { onMount } from "svelte";
    import { sessionId, status, connectWS } from "$lib/ws";
    import { qr } from "@svelte-put/qr/svg";
    import { browser } from "$app/environment";
    import { addFiles, removeItem, clearDone, uploadQueue, queue, uploading } from "$lib/uploadQueue";
    
    import aki from '$lib/assets/aki.png';

    let isMobile = false;
    if (browser) {
        const ua = navigator.userAgent.toLowerCase();
        const mobileRe = /(iphone|ipod|ipad(?!.*mac os)|android.+mobile|windows phone|iemobile|opera mini|blackberry|bb10|mobile safari|silk|kindle|palm|symbian)/;
        isMobile = mobileRe.test(ua) || window.innerWidth < 900;
    }

    $: $sessionId, $status, $queue, $uploading;


    onMount(() => {
        connectWS();
    });

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
                {#each $queue as item (item.id)}
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
                <button class="base-border px-4 cursor-pointer font-semibold" on:click|preventDefault={(e) => uploadQueue($sessionId)} disabled={$uploading || $queue.every(q => q.state !== "pending")}>
                    {$uploading ? "Uploading..." : "Upload all"}
                </button>
                <button class="small base-border px-4 cursor-pointer font-semibold" on:click={clearDone}>
                    Clear done
                </button>
            </div>
        {/if}
    </div>

    <div class="flex flex-row gap-3 gray-text text-sm font-medium">
        <p>Status: {$status}</p>
        {#if $sessionId}
            <p class="border-l-1 pl-3">Session ID: {$sessionId}</p>
        {/if}
    </div>

    <img class="aki" src={aki} alt="Adagaki Aki">
    
</div>
{/if}
