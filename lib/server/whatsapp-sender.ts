import "server-only";
import { createAdminClient } from "@/lib/server/supabase-admin";

export interface WhatsAppSendResult {
  ok: boolean;
  error?: string;
}

export interface WhatsAppSender {
  sendMessage(toE164: string, body: string): Promise<WhatsAppSendResult>;
}

// Dev/test sender: logs the message instead of sending it. There is no
// production sender wired in yet — see docs/tasks/03-auth.md's WhatsApp
// OTP section (added after the original Task 03 shipped, replacing
// authenticator-app TOTP) and the PR that introduced this file for why:
// actually delivering a WhatsApp message needs a real, persistent,
// logged-in WhatsApp sender session (e.g. an open-wa-family client), which
// is infrastructure — a phone number, a long-running service, an initial
// QR-code login — not something a code change alone can stand up or test.
// getWhatsAppSender() is the one seam a real implementation plugs into.
class ConsoleWhatsAppSender implements WhatsAppSender {
  async sendMessage(toE164: string, body: string): Promise<WhatsAppSendResult> {
    // Deliberate: this IS the delivery mechanism until a real sender is wired in.
    console.log(`[whatsapp-otp] to=${toE164} body=${JSON.stringify(body)}`);
    return { ok: true };
  }
}

// E2E runs against a real production build (`next build && next start` —
// NODE_ENV=production, see ci.yml), so this can't be an environment-mode
// check, and it can't be an in-memory singleton either: Next.js bundles
// Server Actions and Route Handlers separately even within one `next start`
// process, so a plain module-level Map here is NOT reliably visible from
// app/api/test-support/last-whatsapp-otp — confirmed empirically, not a
// hypothetical. Postgres (via the admin client) is the one thing both
// sides actually share. E2E_TEST_MODE is set explicitly, only in CI and
// local E2E runs, never in a real deploy.
class CapturingWhatsAppSender implements WhatsAppSender {
  async sendMessage(toE164: string, body: string): Promise<WhatsAppSendResult> {
    const admin = createAdminClient();
    const { error } = await admin
      .from("e2e_whatsapp_otp_capture")
      .upsert({ recipient: toE164, message: body, updated_at: new Date().toISOString() });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}

const isE2eTestMode = process.env.E2E_TEST_MODE === "true";
let sender: WhatsAppSender = isE2eTestMode
  ? new CapturingWhatsAppSender()
  : new ConsoleWhatsAppSender();

export function getWhatsAppSender(): WhatsAppSender {
  return sender;
}

// Test-only seam — never used by production code paths.
export function _setWhatsAppSenderForTests(next: WhatsAppSender): void {
  sender = next;
}
