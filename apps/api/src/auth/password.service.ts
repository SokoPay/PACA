import { Injectable } from "@nestjs/common";
import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * Password hashing with argon2id.
 *
 * Parameters follow OWASP's current guidance (19 MiB memory, 2 iterations,
 * 1 degree of parallelism). Memory cost is what makes GPU cracking expensive,
 * so it is the parameter to raise first if hardware allows.
 */
const OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    return hash(plain, OPTIONS);
  }

  /**
   * Never throws on a malformed stored hash — returns false. A corrupted hash
   * must read as "wrong password", not as a 500 that tells an attacker the
   * account exists.
   */
  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(storedHash, plain, OPTIONS);
    } catch {
      return false;
    }
  }
}
