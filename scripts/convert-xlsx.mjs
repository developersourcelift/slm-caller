// Dev helper: converts the lead workbook into public/demo/leads.json so DEMO mode
// can load it with one click. public/demo/ is git-ignored, so the data is never deployed.
// Usage: npm run demo-data -- "C:/path/to/uae_leads_combined.xlsx"
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { workbookToLeads } from '../src/lib/mapping.js'

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run demo-data -- <path-to-xlsx>')
  process.exit(1)
}
const buf = readFileSync(file)
const { leads, perSheet } = workbookToLeads(XLSX, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
mkdirSync('public/demo', { recursive: true })
writeFileSync('public/demo/leads.json', JSON.stringify(leads))
console.log('Wrote public/demo/leads.json', perSheet, 'total', leads.length)
