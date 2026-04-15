interface EmlOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export function generateEml({
  to,
  subject,
  body,
  from = "sohil@kalinda.ai",
}: EmlOptions): string {
  const date = new Date().toUTCString();
  const messageId = `<${crypto.randomUUID()}@kalinda.ai>`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
  ];

  return headers.join("\r\n") + "\r\n\r\n" + body;
}

export function downloadEml(filename: string, emlContent: string): void {
  const blob = new Blob([emlContent], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".eml") ? filename : `${filename}.eml`;
  a.click();
  URL.revokeObjectURL(url);
}
