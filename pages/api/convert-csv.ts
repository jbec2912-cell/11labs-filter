import type { NextApiRequest, NextApiResponse } from "next";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import ExcelJS from "exceljs";

const upload = multer({ storage: multer.memoryStorage() });
export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  upload.single("file")(req as any, res as any, async (err) => {
    if (err || !(req as any).file) return res.status(400).send("No file");

    const results: any[] = [];

    Readable.from((req as any).file!.buffer)
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", async () => {
        const rows = results
          // Remove empty rows and junk header rows
          .filter((r) => r.Customer && r.Vehicle && r.Mileage && r["Appointment Date"] && /^\d{4}/.test(r.Vehicle))
          .map((r) => {
            const firstName = (r.Customer || "").split(" ")[0].split(",")[0].trim();
            const year2 = (r.Vehicle || "").substring(0, 4).slice(-2);
            const model = (r.Vehicle || "").replace(/^\d{4}\s+/, "").split(" ")[0];

            const phoneText = r["Phone Numbers"] || "";
            const cellMatch = phoneText.match(/C:[^\d]*(\d{3}[^\d]*\d{3}[^\d]*\d{4})/);
            const cellDigits = cellMatch ? cellMatch[1].replace(/\D/g, "") : "";
            const phone11 = cellDigits.length >= 10 ? "1" + cellDigits.slice(-10) : "";

            // Super-robust time parsing
            let iso = "2025-12-01T12:00:00";
            const timeStr = r["Appointment Date"] || "";
            const match = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2}) (AM|PM)/);
            if (match) {
              let [_, h, m, s, period] = match;
              let hour = parseInt(h);
              if (period === "PM" && hour !== 12) hour += 12;
              if (period === "AM" && hour === 12) hour = 0;
              iso = `2025-12-01T${hour.toString().padStart(2, "0")}:${m}:${s}`;
            }

            return {
              customer: firstName || "Unknown",
              year: year2,
              model: model || "Unknown",
              miles: (r.Mileage || "").replace(/,/g, ""),
              appointment: iso,
              phone_number: phone11 || "",
            };
          })
          .sort((a, b) => a.appointment.localeCompare(b.appointment));

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("ElevenLabs");
        sheet.columns = [
          { header: "customer", key: "customer" },
          { header: "year", key: "year" },
          { header: "model", key: "model" },
          { header: "miles", key: "miles" },
          { header: "appointment", key: "appointment" },
          { header: "phone_number", key: "phone_number" },
        ];
        sheet.addRows(rows);

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="elevenlabs_ready.xlsx"');
        res.status(200).send(buffer);
      });
  });
}
