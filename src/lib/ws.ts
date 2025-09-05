import { writable } from "svelte/store";
import { API_BASE } from "$lib/config";

export const sessionId = writable<string | null>(null);
export const status = writable<string>("waiting");

let ws: WebSocket | null = null;


export function connectWS() {
    ws = new WebSocket(`ws://${API_BASE}/ws`);
    
    ws.onopen = () => {
        status.set("connected");
    }
    
    ws.onclose = () => {
        status.set("disconnected; reconnecting...");
        setTimeout(connectWS, 2000);
    }
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.sessionId) {
            sessionId.set(data.sessionId);
        }
        if (data.status) {
            status.set(data.status);
        }
    }
}