import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";

const PAGE_WIDTH_MM = 215.9;
const PAGE_HEIGHT_MM = 279.4;
const BODY_LEFT_MM = 25.4;
const BODY_RIGHT_MM = 25.4;
const BODY_WIDTH_MM = PAGE_WIDTH_MM - BODY_LEFT_MM - BODY_RIGHT_MM;
const SUPPORT_PHONE = "08562359223";

function defaultLetterheadDataUrl() {
  const file = path.join(process.cwd(), "public", "handover-letterhead.png");
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

function writeWrapped(doc, text, x, y, width, lineHeight = 5.5) {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function generateWarrantyExpiryPdf(letter, options = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: false });
  const background = options.letterheadDataUrl || defaultLetterheadDataUrl();
  doc.addImage(background, "PNG", 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM);

  let y = 55;
  doc.setTextColor(15, 23, 42);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text("To,", BODY_LEFT_MM, y);
  doc.text(letter.expiryDate, PAGE_WIDTH_MM - BODY_RIGHT_MM, y, { align: "right" });
  y += 7;
  doc.setFont("times", "bold");
  doc.text(`MR/MS ${letter.customerName}`, BODY_LEFT_MM, y);
  y += 6;
  if (letter.recipientLocation) {
    doc.text(letter.recipientLocation, BODY_LEFT_MM, y);
    y += 9;
  } else {
    y += 3;
  }

  doc.setFont("times", "bold");
  y = writeWrapped(doc, "Sub: Your Lift's Warranty Period is Ending Soon - Regarding.", BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 5;
  doc.setFont("times", "normal");
  y = writeWrapped(doc, `This is to inform you that the one-year warranty period for your ${letter.liftDescription} at ${letter.installationAddress}, which began on ${letter.hocDate}, is scheduled to end on ${letter.expiryDate}.`, BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 5;
  y = writeWrapped(doc, "To continue uninterrupted maintenance support after this date, we recommend renewing your Annual Maintenance Contract (AMC) with us before the warranty expires.", BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 5;
  y = writeWrapped(doc, `Please contact our office at ${SUPPORT_PHONE} to discuss AMC renewal options and pricing for your lift.`, BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 5;
  y = writeWrapped(doc, "We assure you of our best services always.", BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 10;
  doc.text("Thanking you sir,", BODY_LEFT_MM, y);
  y += 12;
  doc.text("Yours sincerely,", BODY_LEFT_MM, y);

  return Buffer.from(doc.output("arraybuffer"));
}
