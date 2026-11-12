import { Injectable, Logger } from "@nestjs/common";
import { Socket } from "node:net";
import { loadEnv } from "../config/env";

export type ScanResult =
  | { status: "CLEAN" }
  | { status: "INFECTED"; signature: string }
  /** No scanner configured (CLAMAV_HOST unset) — scanning is optional. */
  | { status: "NOT_SCANNED" };

const CHUNK_BYTES = 64 * 1024;
const TIMEOUT_MS = 30_000;

/**
 * Scans a buffer with clamd over its INSTREAM protocol: "zINSTREAM\0", then
 * length-prefixed chunks, then a zero-length chunk. clamd replies
 * "stream: OK", "stream: <signature> FOUND" or "... ERROR".
 *
 * Throws when the scanner is configured but unreachable or errors — callers must
 * treat that as "cannot accept the file", never as clean.
 */
@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly env = loadEnv();

  async scan(buffer: Buffer): Promise<ScanResult> {
    if (!this.env.CLAMAV_HOST) return { status: "NOT_SCANNED" };

    const reply = await this.instream(this.env.CLAMAV_HOST, this.env.CLAMAV_PORT, buffer);

    if (/:\s*OK$/.test(reply)) return { status: "CLEAN" };

    const found = reply.match(/:\s*(.+)\s+FOUND$/);
    if (found) {
      this.logger.warn(`Rejected infected upload: ${found[1]}`);
      return { status: "INFECTED", signature: found[1] };
    }

    throw new Error(`Unexpected clamd reply: ${reply}`);
  }

  private instream(host: string, port: number, buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const replies: Buffer[] = [];

      socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error("clamd timed out")));
      socket.on("error", reject);
      socket.on("data", (d) => replies.push(d));
      socket.on("end", () => resolve(Buffer.concat(replies).toString("utf8").replace(/\0/g, "").trim()));

      socket.connect(port, host, () => {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < buffer.length; offset += CHUNK_BYTES) {
          const chunk = buffer.subarray(offset, offset + CHUNK_BYTES);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        socket.end(Buffer.alloc(4)); // zero-length chunk terminates the stream
      });
    });
  }
}
