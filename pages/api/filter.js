// pages/api/filter.js – FINAL WORKING VERSION (tested today)
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

const upload = multer();

export const config = {
  api: { bodyParser: false },
};

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  upload.single('file')(req, {}, (err) => {
    if (err || !req.file) return res.status(400).send('No file uploaded');

    const records = [];

    require('stream')
      .Readable.from(req.file.buffer)
      .pipe(parse({ from_line: 6 }))
      .on('data', row => records.push(row))
      .on('end', () => {
        const rows = records
          .map(r => ({
            name:    (r[0] || '').toString().trim(),
            vehicle: (r[1] || '').toString().trim(),
            mileage: (r[3] || '').toString(),
            appt:    (r[4] || '').toString(),
            phones:  (r[11] || '').toString(),
          }))
          .filter(r => r.vehicle && !/202[56]/.test(r.vehicle))
          .map(r => {
            const first = (r.name.split(/\s+/)[0] || '').trim();
            const customer = first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';

            const year = r.vehicle.match(/20(\d{2})/)?.[1] || '';
            const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();
            const miles = parseInt(r.mileage.replace(/,/g, ''), 10) || 0;

            const digits = (r.phones.match(/\d{10,11}/g) || []).pop() || '';
            const phone = digits.length === 10 ? '1' + digits 
                        : digits.length === 11 && digits.startsWith('1') ? digits : null;

            if (!phone) return null;

            return {
              customer,
              year,
              model,
              miles,
              appointment: r.appt.trim(),
              phone_number: phone
            };
          })
          .filter(Boolean);

        rows.sort((a, b) => b.year.localeCompare(a.year) || a.appointment.localeCompare(b.appointment));

        stringify(rows, {
          header: true,
          columns: ['customer','year','model','miles','appointment','phone_number']
        }, (err, output) => {
          if (err) return res.status(500).send('Error');
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
          res.send(output);
        });
      });
  });
}
