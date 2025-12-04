// pages/api/filter.js – THIS ONE CANNOT BREAK
import multer from 'multer';
import { parse } from 'csv-parse';

const upload = multer();

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  upload.single('file')(req, {}, (err) => {
    if (err || !req.file) return res.status(400).json({ error: 'No file' });

    const rows = [];

    require('stream')
      .Readable.from(req.file.buffer)
      .pipe(parse({ from_line: 1, relax_column_count: true, skip_empty_lines: true }))
      .on('data', (row) => {
        // Super defensive: only process rows that actually look like data
        if (row[0] || '').toString().trim() && rows.push(row);
      })
      .on('end', () => {
        try {
          const result = [];

          for (const r of rows) {
            try {
              const name    = (r[0] || '').toString().trim();
              const vehicle = (r[1] || '').toString().trim();
              const mileage = (r[3] || '').toString();
              const appt    = (r[4] || '').toString().trim();
              const phones  = (r[11] || '').toString();

              if (!vehicle || /202[56]/.test(vehicle)) continue;

              const firstName = name.split(/\s+/)[0] || '';
              const customer  = firstName ? firstName[0].toUpperCase() + firstName.slice(1).toLowerCase() : '';
              if (!customer) continue;

              const year = vehicle.match(/20(\d{2})/)?.[1] || '';
              const model = vehicle.replace(/20\d{2}\s+/, '').trim();
              const miles = parseInt(mileage.replace(/,/g, ''), 10) || 0;

              const digits = phones.match(/\d{10,11}/g)?.pop() || '';
              const phone = digits.length === 10 ? '1' + digits : digits.length === 11 ? digits : '';
              if (!phone) continue;

              result.push({ customer, year, model, miles, appointment: appt, phone_number: phone });
            } catch (e) {
              continue; // skip any single broken row
            }
          }

          result.sort((a, b) => b.year.localeCompare(a.year) || a.appointment.localeCompare(b.appointment));

          const header = 'customer,year,model,miles,appointment,phone_number\n';
          const csv = header + result.map(r => 
            `${r.customer},${r.year},${r.model},${r.miles},${r.appointment},${r.phone_number}`
          ).join('\n');

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
          res.send(csv);

        } catch (e) {
          res.status(500).send('Processing error');
        }
      });
  });
}
