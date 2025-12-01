import type { NextApiRequest, NextApiResponse } from "next";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import ExcelJS from "exceljs";

const upload = multer({ storage: multer.memoryStorage() });
export const config = { api: { bodyParser: false } };

let lineCount = 0;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  upload.single("file")(req as any, res as any, async (err) => {
    if (err || !(req as any).file) return res.status(400).send("No file");

    lineCount = 0;
    const goodRows: any[] = [];

    Readable.from((req as any).file!.buffer)
      .pipe(csv())
      .on("data", (row) => {
        lineCount++;

        // Skip the 5 junk lines at the top
        if (lineCount <= 5) return;

        // Must have a Customer name and a Vehicle that starts with 4 digits
        if (!row.Customer || !row.Vehicle || !/^\d{4}/.test(row.Vehicle.trim())) return;

        goodRows.push(row);
      })
      .on("end", async () => {
        const finalRows = goodRows.map((r) => {
          const firstName = (r.Customer || "").split(" ")[0].replace(",", "").trim();
          const year2 = r.Vehicle.trim().substring(0, 4).slice(-2);
          const model = r.Vehicle.trim().replace(/^\d{4}\s+/, "").split(" ")[0];

          const phoneText = r["Phone Numbers"] || "";
          const cellMatch = phoneText.match(/C:[^0-9]*([0-9]{3}[^0-9]*[0-9]{3}[^0-9]*[0-9]{4})/i);
          const phone11 = cellMatch ? "1" + cellMatch[1].replace(/\D/g, "") : "";

          const timeStr = r["Appointment Date"] || "";
          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2}) (AM|PM)/i);
          let iso = "2025-12-01T12:00:00";
          if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const period = timeMatch[4].toUpperCase();
            if (period === "PM" && hour !== 12) hour += 12;
            if (period === "AM" && hour === 12) hour = 0;
            iso = `2025-12-01T${hour.toString().padStart(2, "0")}:${timeMatch[2]}:${timeMatch[3]}`;
          }

          return {
            customer: firstName,
            year: year2,
            model: model,
            miles: (r.Mileage || "").replace(/,/g, ""),
            appointment: iso,
            phone_number: phone11,
          };
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("TEXTEDLY TEMPLATE");
        sheet.columns = [
          { header: "customer", key: "customer" },
          { header: "year", key: "year" },
          { header: "model", key: "model" },
          { header: "miles", key: "miles" },
          { header: "appointment", key: "appointment" },
          { header: "phone_number", key: "phone_number" },
        ];
        sheet.addRows(finalRows);

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="elevenlabs_ready.xlsx"');
        res.status(200).send(buffer);
      });
  });
}
