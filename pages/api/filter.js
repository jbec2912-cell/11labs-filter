// pages/api/filter.js
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify from 'csv-stringify/sync';

const upload = multer();

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  upload.single('file')(req, {}, async (err) => {
    if (err) {
      res.status(500).end('Upload error');
      return;
    }

    const buffer = req.file.buffer.toString('utf8');

    const records = [];
    require('stream').Readable.from(buffer)
      .pipe(parse({ from_line: 6 })) // skips the first 5 junk rows
      .on('data', (row) => records.push(row))
      .on('end', () => processCSV(records));
    
    const processCSV = (rows) => {
      let filtered = rows
        .map(r => ({
          Customer:     r[0]  || '',
          Vehicle:      r[1]  || '',
          Mileage:      r[3]  || '',
          Appointment:  r[4]  || '',
          PurchaseDate: r[7]  || '',
          Phones:       r[11] || '',
        }))
        .filter(r => r.Vehicle && !/202[56]/.test(r.Vehicle))
        .filter(r => {
          if (!r.PurchaseDate) return true;
          const bought = new Date(r.PurchaseDate);
          const months = (new Date().getMonth() - bought.getMonth() + 12*(new Date().getFullYear() - bought.getFullYear());
          return months >= 12 || isNaN(months);
        });

      const finalRows = filtered.map(r => {
        const nameParts = r.Customer.trim().split(/\s+/g);
        const first = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase() : '';
        let last = nameParts.slice(1).join(' ');
        last = last.replace(/\bjr\b/gi, 'Jr').replace(/\bsr\b/gi, 'Sr');
        last = last ? last.charAt(0).toUpperCase() + last.slice(1).toLowerCase() : '';

        const year2 = r.Vehicle.match(/20(\d{2})/)?.[1] || '';
        const model = r.Vehicle.replace(/20\d{2}\s*/, '').trim();
        const miles = parseInt(r.Mileage) || 0;

        const phoneDigits = (r.Phones.match(/\d{10,11}/g) || []).pop() || '';
        const phone = phoneDigits.length === 10 ? '1' + phoneDigits : phoneDigits;

        return {
          Tag: "Future Service Appointment",
          Customer: first,
          Last_Name: last,
          Year: year2,
          Vehicle: model,
          Miles: miles,
          Appointment: r.Appointment,
          Phone_Number: phone
        };
      });

      // Sort exactly like your example
      finalRows.sort((a, b) => b.Year - a.Year || a.Appointment.localeCompare(b.Appointment));

      const csvContent = stringify(finalRows, { header: true });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=Filtered For 11Labs.csv');
      res.status(200).send(csvContent);
    };
  });
}
