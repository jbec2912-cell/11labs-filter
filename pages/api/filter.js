// pages/api/filter.js  ←  FINAL – 6 columns exactly as you want
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

const upload = multer();

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  upload.single('file')(req, {}, async (err) => {
    if (err || !req.file) return res.status(400).send('No file');

    const buffer = req.file.buffer.toString('utf8');

    const records = [];
    require('stream').Readable.from(buffer)
      .pipe(parse({ from_line: 6 }))           // skip junk rows
      .on('data', row => records.push(row))
      .on('end', () => process(records));
  });

  function process(rows) {
    const result = rows
      .map(r => ({
        name:    r[0]  || '',
        vehicle: r[1]  || '',
        mileage: r[3]  || '',
        appt:    r[4]  || '',
        phones:  r[11] || '',
      }))
      .filter(r => r.vehicle && !/202[56]/.test(r.vehicle))           // no 2025/2026
      .map(r => {
        // First name only
        const first = r.name.trim().split(/\s+/)[0] || '';
        const customer = first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';

        // Year (2-digit)
        const year2 = r.vehicle.match(/20(\d{2})/)?.[1] || '';

        // Model (remove year)
        const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();

        // Miles
        const miles = parseInt(r.mileage.replace(/,/g, '')) || 0;

        // Appointment
        const appointment = r.appt.trim();

        // Phone – delete row if none
        const digits = (r.phones.match(/\d{10,11}/g) || []).pop() || '';
        let phone = '';
        if (digits.length === 10) phone = '1' + digits;
        else if (digits.length === 11 && digits.startsWith('1')) phone = digits;
        if (!phone) return null;

        return { customer, year: year2, model, miles, appointment, phone_number: phone };
      })
      .filter(Boolean);

    // Sort newest → oldest year, then by appointment
    result.sort((a, b) => b.year.localeCompare(a.year) || a.appointment.localeCompare(b.appointment));

    const csv = stringify(result, {
      header: true,
      columns: ['customer','year','model','miles','appointment','phone_number']
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
    res.status(200).send(csv);
  }
}
