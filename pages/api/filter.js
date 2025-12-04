// pages/api/filter.js
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

const upload = multer();

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  upload.single('file')(req, {}, async (err) => {
    if (err || !req.file) {
      return res.status(400).send('No file uploaded');
    }

    const buffer = req.file.buffer.toString('utf8');

    const records = [];
    require('stream').Readable.from(buffer)
      .pipe(parse({ from_line: 6 })) // skip first 5 header/junk rows
      .on('data', (row) => records.push(row))
      .on('end', () => processRecords(records));
  });

  function processRecords(rows) {
    const filtered = rows
      .map((r) => ({
        name: r[0] || '',
        vehicle: r[1] || '',
        mileage: r[3] || '',
        appt: r[4] || '',
        purchaseDate: r[7] || '',
        phones: r[11] || '',
      }))
      .filter((r) => r.vehicle && r.vehicle.trim() !== '')
      .filter((r) => !/202[56]/.test(r.vehicle)) // remove 2025 & 2026 models
      .filter((r) => {
        if (!r.purchaseDate) return true;
        const bought = new Date(r.purchaseDate);
        if (isNaN(bought)) return true;
        const months =
          (new Date().getFullYear() - bought.getFullYear()) * 12 +
          (new Date().getMonth() - bought.getMonth());
        return months >= 12;
      });

    const finalRows = filtered
      .map((r) => {
        // Name handling
        const parts = r.name.trim().split(/\s+/);
        const first = parts[0]
          ? parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase()
          : '';
        let last = parts.slice(1).join(' ');
        last = last.replace(/\bjr\b/gi, 'Jr').replace(/\bsr\b/gi, 'Sr');
        last = last ? last[0].toUpperCase() + last.slice(1).toLowerCase() : '';

        // Year & Model
        const yearMatch = r.vehicle.match(/20(\d{2})/);
        const year2 = yearMatch ? yearMatch[1] : '';
        const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();

        // Mileage
        const miles = parseInt(r.mileage.replace(/,/g, '')) || 0;

        // PHONE: extract last 10 or 11 digits, force 1xxxxxxxxxx
        const phoneDigits = (r.phones.match(/\d{10,11}/g) || []).pop() || '';
        let cleanPhone = '';
        if (phoneDigits.length === 10) cleanPhone = '1' + phoneDigits;
        else if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) cleanPhone = phoneDigits;

        // DELETE ROW IF NO PHONE
        if (!cleanPhone) return null;

        return {
          Tag: 'Future Service Appointment',
          Customer: first,
          Last_Name: last || '',
          Year: year2,
          Vehicle: model,
          Miles: miles,
          Appointment: r.appt,
          Phone_Number: cleanPhone,
        };
      })
      .filter(Boolean); // removes null rows (no phone)

    // Sort: newest year first, then by appointment time
    finalRows.sort((a, b) => b.Year.localeCompare(a.Year) || a.Appointment.localeCompare(b.Appointment));

    const csv = stringify(finalRows, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
    res.status(200).send(csv);
  }
}
