import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";

const PAGE_WIDTH_MM = 215.9;
const PAGE_HEIGHT_MM = 279.4;
const BODY_LEFT_MM = 25.4;
const BODY_RIGHT_MM = 25.4;
const BODY_WIDTH_MM = PAGE_WIDTH_MM - BODY_LEFT_MM - BODY_RIGHT_MM;

function defaultLetterheadDataUrl() {
  const file = path.join(process.cwd(), "public", "handover-letterhead.png");
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

function writeWrapped(doc, text, x, y, width, lineHeight = 5) {
  doc.setFont("times", "normal");
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function writeNoteWrapped(doc, text, x, y, width, lineHeight = 5) {
  doc.setFont("times", "bolditalic");
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  doc.setFont("times", "normal");
  return y + lines.length * lineHeight;
}

// "Charges: <bold value>" on one line — label normal weight, value bold,
// matching the supplied WARRANTY_EXPIRY_LETTER.docx template exactly.
function writeChargesLine(doc, value, x, y) {
  doc.setFont("times", "normal");
  doc.text("Charges: ", x, y);
  const labelWidth = doc.getTextWidth("Charges: ");
  doc.setFont("times", "bold");
  doc.text(value, x + labelWidth, y);
  doc.setFont("times", "normal");
  return y + 5;
}

function formatRupees(amount) {
  const numeric = Number(amount);
  const value = Number.isFinite(numeric) ? numeric : 0;
  return `Rs. ${value.toLocaleString("en-IN")}/-`;
}

// Renders the letter from public/WARRANTY_EXPIRY_LETTER.docx: same branded
// background as the handing-over letter, with this letter's own wording —
// including the admin-entered AMC renewal amount, since that price isn't
// derivable from the customer record.
export function generateWarrantyExpiryPdf(letter, options = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: false });
  const background = options.letterheadDataUrl || defaultLetterheadDataUrl();
  doc.addImage(background, "PNG", 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM);

  let y = 55;
  doc.setTextColor(15, 23, 42);
  doc.setFont("times", "normal");
  doc.setFontSize(11);

  doc.text("To", BODY_LEFT_MM, y);
  y += 6;
  doc.text(letter.customerName, BODY_LEFT_MM, y);
  y += 10;

  doc.text("Subject: Expiry of Lift Warranty – Intimation", BODY_LEFT_MM, y);
  y += 9;

  doc.text("Dear Sir/Madam,", BODY_LEFT_MM, y);
  y += 8;
  doc.text("We hope this letter finds you well.", BODY_LEFT_MM, y);
  y += 8;

  y = writeWrapped(
    doc,
    `This is to kindly bring to your attention that the one-year warranty period for the lift installed at your house has commenced on ${letter.hocDate}, has ended on ${letter.expiryDate}. As a result, the warranty monthly maintenance service offered during the warranty period also stands concluded as of the above date.`,
    BODY_LEFT_MM, y, BODY_WIDTH_MM,
  );
  y += 6;

  doc.text("Going forward, please note the following service options:", BODY_LEFT_MM, y);
  y += 5;
  doc.text("Annual Maintenance Contract (AMC):", BODY_LEFT_MM, y);
  y += 5;
  y = writeChargesLine(doc, formatRupees(letter.amcAmount), BODY_LEFT_MM, y);
  y = writeWrapped(
    doc,
    "Benefits: Monthly preventive maintenance visits (same as the warranty period maintenance visits) and if there is any breakdown also our technician will visit.",
    BODY_LEFT_MM, y, BODY_WIDTH_MM,
  );
  y += 2;
  y = writeNoteWrapped(
    doc,
    "Please note: Any spare parts required during maintenance are charged separately, with a 10% discount applicable on all spare parts.",
    BODY_LEFT_MM, y, BODY_WIDTH_MM,
  );
  y += 6;

  doc.text("Service on Call:", BODY_LEFT_MM, y);
  y += 5;
  y = writeChargesLine(doc, "Rs. 2,500 per visit", BODY_LEFT_MM, y);
  doc.text("Our technician will attend to service or maintenance as per your request.", BODY_LEFT_MM, y);
  y += 5;
  y = writeNoteWrapped(
    doc,
    "Please note: Any spare parts required during maintenance are charged separately.",
    BODY_LEFT_MM, y, BODY_WIDTH_MM,
  );
  y += 6;

  y = writeWrapped(
    doc,
    "To ensure your lift continues to function smoothly and without interruptions, we recommend enrolling in our Annual Maintenance Contract (AMC).",
    BODY_LEFT_MM, y, BODY_WIDTH_MM,
  );
  y += 1;
  y = writeWrapped(
    doc,
    "Thank you for your continued trust in Amardip Elevators. We assure you of our best services at all times.",
    BODY_LEFT_MM, y, BODY_WIDTH_MM,
  );
  y += 1;
  y = writeWrapped(
    doc,
    "For any queries or to enroll in the AMC plan, please feel free to contact us.",
    BODY_LEFT_MM, y, BODY_WIDTH_MM,
  );
  y += 8;

  doc.text("Warm regards,", BODY_LEFT_MM, y);
  y += 6;
  doc.text("Amardip Elevators", BODY_LEFT_MM, y);

  return Buffer.from(doc.output("arraybuffer"));
}
