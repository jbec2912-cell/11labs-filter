// pages/api/filter.js  ←  FINAL VERSION – EXACTLY WHAT ELEVENLABS WANTS
import multer from 'multer';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

const upload = multer();

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  upload.single('file')(req, {}, async (err) => {
    if (err || !req.file) return res.status(400).send('No file uploaded');

    const buffer = req.file.buffer.toString('utf8');

    const records = [];
    require('stream').Readable.from(buffer)
      .pipe(parse({ from_line: 6 }))
      .on('data', row => records.push(row))
      .on('end', () => process(records));
  });

  function process(rows) {
    const result = rows
      .map(r => ({
        name:         r[0]  || '',
        vehicle:      r[1]  || '',
        mileage:      r[3]  || '',
        appt:         r[4]  || '',
        purchaseDate: r[7]  || '',
        phones:       r[11] || '',
      }))
      .filter(r => r.vehicle && !/202[56]/.test(r.vehicle))
      .filter(r => {
        if (!r.purchaseDate) return true;
        const bought = new Date(r.purchaseDate);
        if (isNaN(bought)) return true;
        const months = (new Date().getFullYear() - bought.getFullYear()) * 12 +
                       (new Date().getMonth() - bought.getMonth());
        return months >= 12;
      })
      .map(r => {
        // Name
        const parts = r.name.trim().split(/\s+/);
        const first = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase() : '';
        let last = parts.slice(1).join(' ');
        last = last.replace(/\bjr\b/gi, 'Jr').replace(/\bsr\b/gi, 'Sr');
        last = last ? last[0].toUpperCase() + last.slice(1).toLowerCase() : '';

        // Year & Model
        const year2 = r.vehicle.match(/20(\d{2})/)?.[1] || '';
        const model = r.vehicle.replace(/20\d{2}\s+/, '').trim();

        // Miles
        const miles = parseInt(r.mileage.replace(/,/g, '')) || 0;

        // Phone – MUST have valid phone or row is deleted
        const digits = (r.phones.match(/\d{10,11}/g) || []).pop() || '';
        let phone = '';
        if (digits.length === 10) phone = '1' + digits;
        else if (digits.length === 11 && digits.startsWith('1')) phone = digits;
        if (!phone) return null;  // ← deletes row if no phone

        return {
          phone_number: phone,
          Tag: 'Future Service Appointment',
          Customer: first,
          Last_Name: last,
          Year: year2,
          Vehicle: model,
          Miles: miles,
          Appointment: r.appt.trim()
        };
      })
      .filter(Boolean);

    // Sort: newest year first → then by appointment time
    result.sort((a, b) => b.Year.localeCompare(a.Year) || a.Appointment.localeCompare(b.Appointment));

    // EXACT column order and headers ElevenLabs wants
    const csv = stringify(result, {
      header: true,
      columns: [
        'phone_number',
        'Tag',
        'Customer',
        'Last_Name',
        'Year',
        'Vehicle',
        'Miles',
        'Appointment'
      ]
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Filtered For 11Labs.csv"');
    res.status(200).send(csv);
  }
}
