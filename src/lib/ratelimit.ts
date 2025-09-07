export type Policy = { requests: number, seconds: number }


export class TokenBucket {

    private tokens: number;
    private lastRefill: number;
    
    constructor(private policy: Policy) {
        this.tokens = policy.requests;
        this.lastRefill = Date.now();
    }

    /**
     * @returns The number of milliseconds to wait until the next request can be made.
     *          If the bucket is not empty, the function will return 0.
     */
    nextAvailable(): number {
        this.refill();
        if (this.tokens > 0) {
            this.tokens--;
            return 0;
        }

        const now = Date.now()
        return this.lastRefill + this.policy.seconds * 1000 - now;
    }

    private refill() {
        const now = Date.now();
        if (now - this.lastRefill >= this.policy.seconds * 1000) {
            this.tokens = this.policy.requests;
            this.lastRefill = now;
        }
    }

}