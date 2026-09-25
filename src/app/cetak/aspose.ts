// Converts the generated .xlsx (Aspose Cells Cloud) or .docx (Aspose Words Cloud)
// to PDF, so the preview is a real render of the exact file instead of a
// hand-built approximation. Free tier is only 150 calls/month -- callers should
// treat failures (quota exhausted, network error) as recoverable and fall back.

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token

  const clientId = process.env.ASPOSE_CLIENT_ID
  const clientSecret = process.env.ASPOSE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('ASPOSE_CLIENT_ID/ASPOSE_CLIENT_SECRET are not configured')

  const res = await fetch('https://api.aspose.cloud/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  })
  if (!res.ok) throw new Error(`Aspose token request failed: ${res.status} ${await res.text()}`)

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function convertToPdf(url: string, field: string, filename: string, file: Uint8Array<ArrayBuffer>) {
  const token = await getAccessToken()

  const form = new FormData()
  form.append(field, new Blob([file]), filename)

  const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form })
  if (!res.ok) throw new Error(`Aspose conversion failed: ${res.status} ${await res.text()}`)

  return new Uint8Array(await res.arrayBuffer())
}

export const convertXlsxToPdf = (xlsx: Uint8Array<ArrayBuffer>) =>
  convertToPdf('https://api.aspose.cloud/v4.0/cells/convert/spreadsheet?format=PDF', 'File', 'workbook.xlsx', xlsx)

export const convertDocxToPdf = (docx: Uint8Array<ArrayBuffer>) =>
  convertToPdf('https://api.aspose.cloud/v4.0/words/convert?format=pdf', 'document', 'document.docx', docx)
