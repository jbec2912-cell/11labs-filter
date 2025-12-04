// pages/api/filter.js   ← MUST be JavaScript, not Python!
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

const upload = multer();

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  upload.single('file')(req, {}, async (err) => {
    if (err) return res.status(500).send('Upload error');

    const buffer = req.file.buffer.toString();

    const records = [];
    require('stream').Readable.from(buffer)
      .pipe(parse({ from_line: 6 }))           // skips the 5 junk header rows
      .on('data', row => records.push(row))
      .on('end', () => process(records));

    function process(rows) {
      let data = rows
        .map(r => ({
          name:         r[0]  || '',
          vehicle:      r[1]  || '',
          mileage:      r[3]  || '',
          appt:         r[4]  || '',
          purchaseDate: r[7]  || '',
          phones:       r[11] || '',
        }))
        .filter(r => r.vehicle && !/202[56]/.test(r.vehicle)) // remove 2025/2026 models
        .filter(r => {
          if (!r.purchaseDate) return true;
          const bought = new Date(r.purchaseDate);
          const months = (new Date().getFullYear() - bought.getFullYear()) * 12 +
                         (new Date().getMonth() - bought.getMonth());
          return months >= 12 || isNaN(months);
        });

      const final = data.map(r => {
        const parts = r.name.trim().split(/\s+/);
        const first = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase() : '';
        let last = parts.slice(1).join(' ');
        last = last.replace(/\bjr\b/gi, 'Jr').replace(/\bsr\b/gi, 'Sr');
        last = last ? last[0].toUpperCase() + last.slice(1).toLowerCase() : '';

        const year2 = r.vehicle.match(/20(\d{2})/)?.[1] || '';
        const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();
        const miles = parseInt(r.mileage) || 0;

        const phone = ((r.phones.match(/\d{10,11}/g) || []).pop() || '');
        const cleanPhone = phone.length === 10 ? '1' + phone : phone;

        return {
          Tag: "Future Service Appointment",
          Customer: first,
          Last_Name: last,
          Year: year2,
          Vehicle: model,
          Miles: miles,
          Appointment: r.appt,
          Phone_Number: cleanPhone
        };
      });

      final.sort((a, b) => b.Year - a.Year || a.Appointment.localeCompare(b.Appointment));

      const csv = stringify(final, { header: true });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
      res.send(csv);
    }
  });
}
