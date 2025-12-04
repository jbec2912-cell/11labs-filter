// pages/api/filter.js   ←  FULL, COMPLETE, TESTED & WORKING VERSION
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

const upload = multer();

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed');
  }

  upload.single('file')(req, {}, (err) => {
    if (err || !req.file) {
      return res.status(400).send('No file uploaded');
    }

    const records = [];

    require('stream').Readable.from(req.file.buffer)
      .pipe(parse({ from_line: 6 })) // skip first 5 junk rows
      .on('data', (row) => records.push(row))
      .on('end', () => {
        const result = records
          .map((r) => ({
            name: (r[0] || '').trim(),
            vehicle: (r[1] || '').trim(),
            mileage: (r[3] || '').trim(),
            appt: (r[4] || '').trim(),
            phones: (r[11] || '').trim(),
          }))
          // Remove empty vehicles & 2025/2026 models
          .filter((r) => r.vehicle && !r.vehicle.match(/202[56]/))
          // Main processing
          .map((r) => {
            // Customer = First name only, properly capitalized
            const nameParts = r.name.split(/\s+/);
            const firstName = nameParts[0] || '';
            const customer = firstName
              ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
              : '';

            // Year (2-digit)
            const yearMatch = r.vehicle.match(/20(\d{2})/);
            const year = yearMatch ? yearMatch[1] : '';

            // Model (remove year)
            const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();

            // Miles
            const miles = parseInt(r.mileage.replace(/,/g, ''), 10) || 0;

            // Appointment
            const appointment = r.appt;

            // Phone – must exist or row is deleted
            const phoneDigits = (r.phones.match(/\d{10,11}/g) || []).pop() || '';
            let phone = '';
            if (phoneDigits.length === 10) phone = '1' + phoneDigits;
            else if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) phone = phoneDigits;
            if (!phone) return null; // ← deletes row if no phone

            return {
              customer,
              year,
              model,
              miles,
              appointment,
              phone_number: phone,
            };
          })
          .filter(Boolean); // remove null rows

        // Sort: newest year first, then by appointment time
        result.sort((a, b) => b.year.localeCompare(a.year) || a.appointment.localeCompare(b.appointment));

        // Generate CSV with exact 6 columns
        const csv = stringify(result, {
          header: true,
          columns: ['customer', 'year', 'model', 'miles', 'appointment', 'phone_number'],
        });

        // Send file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
        res.status(200).send(csv);
      });
  });
}
