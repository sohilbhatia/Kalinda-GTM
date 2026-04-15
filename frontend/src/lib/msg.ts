function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(text: string): string {
  const body = esc(text)
    .replace(/\r?\n/g, "<br>\r\n")
    .replace(
      /kalinda\.ai/g,
      '<a href="https://www.kalinda.ai" style="color:#1155CC;">kalinda.ai</a>',
    );

  return (
    '<html><head><meta charset="utf-8"></head><body>' +
    '<div style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.0;">' +
    body +
    "</div></body></html>"
  );
}

export interface MsgOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export function generateMsg({ to, subject, body, from = "sohil@kalinda.ai" }: MsgOptions): string {
  const date = new Date().toUTCString();
  const boundary = "----=_Part_" + crypto.randomUUID().replace(/-/g, "");
  const messageId = `<${crypto.randomUUID()}@kalinda.ai>`;
  const htmlBody = textToHtml(body);

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

export function downloadMsg(filename: string, content: string): void {
  const blob = new Blob([content], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const base = filename.replace(/\.(eml|msg|oft)$/, "");
  a.download = `${base}.eml`;
  a.click();
  URL.revokeObjectURL(url);
}
