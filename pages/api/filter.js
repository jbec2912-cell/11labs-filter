// pages/api/filter.js
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

const upload = multer();

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  upload.single('file')(req, {}, (err) => {
    if (err || !req.file) return res.status(400).json({ error: 'No file' });

    const records = [];
    require('stream').Readable.from(req.file.buffer)
      .pipe(parse({ from_line: 6 }))
      .on('data', (row) => records.push(row))
      .on('end', () => {
        const rows = records
          .map((r) => ({
            name: r[0] || '',
            vehicle: r[1] || '',
            mileage: r[3] || '',
            appt: r[4] || '',
            phones: r[11] || '',
          }))
          .filter((r) => r.vehicle && !/202[56]/.test(r.vehicle))
          .map((r) => {
            const first = (r.name.split(' ')[0] || '').replace(/^\w/, (c) => c.toUpperCase());
            const year = r.vehicle.match(/20(\d{2})/)?.[1] || '';
            const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();
            const miles = parseInt(r.mileage.replace(/,/g, '')) || 0;
            const phoneMatch = (r.phones.match(/\d{10,11}/g) || []).pop() || '';
            const phone = phoneMatch.length === 10 ? '1' + phoneMatch : phoneMatch.length === 11 ? phoneMatch : null;
            if (!phone) return null;
            return { customer: first, year, model, miles, appointment: r.appt.trim(), phone_number: phone };
          })
          .filter(Boolean);

        rows.sort((a, b) => b.year.localeCompare(a.year) || a.appointment.localeCompare(b.appointment));

        const csv = stringify(rows, {
          header: true,
          columns: ['customer', 'year', 'model', 'miles', 'appointment', 'phone_number'],
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
        res.send(csv);
      });
  });
}
