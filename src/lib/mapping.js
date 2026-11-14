// Turns rows from the lead workbook (one tab per category) into lead records.
// Shared by the in-app importer and scripts/convert-xlsx.mjs.
// Rank / "Top lead" columns are deliberately dropped: no scoring in this app.

const SKIP_SHEETS = new Set(['about', 'notes', 'readme', 'summary'])

const s = (v) => (v === null || v === undefined ? '' : String(v).trim())

export function rowToLead(row, category) {
  const lead = {
    category,
    company: s(row['Company']),
    emirate: s(row['Emirate']),
    segment: s(row['Segment'] ?? row['Type']),
    phone: s(row['Phone']),
    mobile: s(row['Mobile']),
    email: s(row['Email']),
    website: s(row['Website']),
    address: s(row['Address']),
    maps_url: s(row['Google Maps']),
    details: {},
  }
  const detailCols = {
    'P.O. Box': 'po_box',
    'Venues / events': 'venues',
    Established: 'established',
    'Google rating': 'google_rating',
    'Google reviews': 'google_reviews',
    'Google category': 'google_category',
    Categories: 'categories',
    Description: 'description',
    'Also in interior list': 'also_in_interior',
    Source: 'source',
    'Source link': 'source_link',
  }
  for (const [col, key] of Object.entries(detailCols)) {
    const v = s(row[col])
    if (v) lead.details[key] = v
  }
  return lead
}

/** @param XLSX the SheetJS module, @param data ArrayBuffer */
export function workbookToLeads(XLSX, data) {
  const wb = XLSX.read(data, { type: 'array' })
  const leads = []
  const perSheet = {}
  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.has(name.trim().toLowerCase())) continue
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
    if (!rows.length || !('Company' in rows[0])) continue
    const mapped = rows.map((r) => rowToLead(r, name.trim())).filter((l) => l.company)
    perSheet[name.trim()] = mapped.length
    leads.push(...mapped)
  }
  return { leads, perSheet }
}
