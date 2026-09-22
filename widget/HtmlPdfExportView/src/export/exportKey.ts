let sequence = 0;

export function createExportKey(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
    } else {
        for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
    }
    sequence++;
    return `${Date.now().toString(36)}-${sequence.toString(36)}-${Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("")}`;
}
