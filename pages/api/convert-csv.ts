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
    if (err || !req.file) return res.status(400).send("No file uploaded");

    const results: any[] = [];

    Readable.from(req.file!.buffer)
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", async () => {
        const rows = results
          .filter((r) => r.Vehicle && r.Mileage && r["Appointment Date"] && r.Vehicle.match(/^\d{4}/))
          .map((r) => {
            const firstName = (r.Customer || "").split(" ")[0].split(",")[0].trim();
            const year2 = (r.Vehicle || "").substring(0, 4).slice(-2);
            const model = (r.Vehicle || "").replace(/^\d{4}\s+/, "").split(" ")[0];

            const phoneText = r["Phone Numbers"] || "";
            const cellMatch = phoneText.match(/C:[^\d]*(\d{3}[^\d]*\d{3}[^\d]*\d{4})/);
            const cellDigits = cellMatch ? cellMatch[1].replace(/\D/g, "") : "";
            const phone11 = cellDigits.length >= 10 ? "1" + cellDigits.slice(-10) : "";

            const timeStr = r["Appointment Date"];
            let iso = "";
            if (timeStr.includes("7:00:00 AM")) iso = "2025-12-01T06:59:59.999";
            else if (timeStr.includes("8:00:00 AM")) iso = "2025-12-01T07:59:59.999";
            else {
              const [datePart, timePart, period] = timeStr.split(" ");
              let [h, m, s] = timePart.split(":");
              let hour = parseInt(h);
              if (period === "PM" && hour !== 12) hour += 12;
              if (period === "AM" && hour === 12) hour = 0;
              iso = `2025-12-01T${hour.toString().padStart(2, "0")}:${m}:${s}`;
            }

            return {
              customer: firstName,
              year: year2,
              model: model,
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
