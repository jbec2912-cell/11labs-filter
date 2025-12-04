// pages/api/filter.js  ←  FINAL VERSION (correct column order + names)
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

const upload = multer();

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  upload.single('file')(req, {}, async (err) => {
    if (err || !req.file) return res.status(400).send('No file uploaded');

    const buffer = req.file.buffer.toString('utf8');

    const records = [];
    require('stream').Readable.from(buffer)
      .pipe(parse({ from_line: 6 }))
      .on('data', (row) => records.push(row))
      .on('end', () => process(records));
  });

  function process(rows) {
    const result = rows
      .map((r) => ({
        name:         r[0]  || '',
        vehicle:      r[1]  || '',
        mileage:      r[3]  || '',
        appt:         r[4]  || '',
        purchaseDate: r[7]  || '',
        phones:       r[11] || '',
      }))
      .filter((r) => r.vehicle && r.vehicle.trim() !== '')
      .filter((r) => !/202[56]/.test(r.vehicle))
      .filter((r) => {
        if (!r.purchaseDate) return true;
        const bought = new Date(r.purchaseDate);
        if (isNaN(bought)) return true;
        const months = (new Date().getFullYear() - bought.getFullYear()) * 12 +
                       (new Date().getMonth() - bought.getMonth());
        return months >= 12;
      })
      .map((r) => {
        // First name only
        const firstName = r.name.trim().split(/\s+/)[0] || '';
        const customer = firstName ? firstName[0].toUpperCase() + firstName.slice(1).toLowerCase() : '';

        // 2-digit year
        const year2 = r.vehicle.match(/20(\d{2})/)?.[1] || '';

        // Model (remove year)
        const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();

        // Miles
        const miles = parseInt(r.mileage.replace(/,/g, '')) || 0;

        // Phone — delete row if none
        const digits = (r.phones.match(/\d{10,11}/g) || []).pop() || '';
        let phone = '';
        if (digits.length === 10) phone = '1' + digits;
        else if (digits.length === 11 && digits.startsWith('1')) phone = digits;
        if (!phone) return null;

        return {
          customer:   customer,
          year:       year2,
          model:      model,
          miles:      miles,
          appointment: r.appt.trim(),
          phone_number: phone
        };
      })
      .filter(Boolean);

    // Sort newest year → oldest, then by appointment time
    result.sort((a, b) => b.year.localeCompare(a.year) || a.appointment.localeCompare(b.appointment);

    const csv = stringify(result, {
      header: true,
      columns: [
        { key: 'customer',    header: 'customer' },
        { key: 'year',       header: 'year' },
        { key: 'model',      header: 'model' },
        { key: 'miles',      header: 'miles' },
        { key: 'appointment', header: 'appointment' },
        { key: 'phone_number',header: 'phone_number' }
      ]
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
    res.status(200).send(csv);
  }
}
