const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const INDIAN_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function parseCustomerDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const isoMatch = text.match(ISO_DATE);
  const indianMatch = text.match(INDIAN_DATE);
  if (!isoMatch && !indianMatch) return null;

  const [year, month, day] = isoMatch
    ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
    : [Number(indianMatch[3]), Number(indianMatch[2]), Number(indianMatch[1])];

  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function getCustomerDueDate(customer) {
  return (
    parseCustomerDate(customer?.amc_warranty_due) ||
    parseCustomerDate(customer?.amc_ending_date)
  );
}

function assertColumnReference(column) {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(column)) {
    throw new Error(`Invalid customer date column reference: ${column}`);
  }
}

export function buildCustomerDateSql(column) {
  assertColumnReference(column);

  const value = `NULLIF(BTRIM(${column}::text), '')`;
  const isoYear = `split_part(${value}, '-', 1)::int`;
  const isoMonth = `split_part(${value}, '-', 2)::int`;
  const isoDay = `split_part(${value}, '-', 3)::int`;
  const indianDay = `split_part(${value}, '/', 1)::int`;
  const indianMonth = `split_part(${value}, '/', 2)::int`;
  const indianYear = `split_part(${value}, '/', 3)::int`;

  return `
    CASE
      WHEN ${value} ~ '^\\d{4}-\\d{1,2}-\\d{1,2}$' THEN
        CASE
          WHEN ${isoYear} BETWEEN 1000 AND 9999
            AND ${isoMonth} BETWEEN 1 AND 12
          THEN
            CASE
              WHEN ${isoDay} BETWEEN 1 AND EXTRACT(
                DAY FROM (make_date(${isoYear}, ${isoMonth}, 1) + interval '1 month - 1 day')
              )::int
              THEN make_date(${isoYear}, ${isoMonth}, ${isoDay})
              ELSE NULL::date
            END
          ELSE NULL::date
        END
      WHEN ${value} ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$' THEN
        CASE
          WHEN ${indianYear} BETWEEN 1000 AND 9999
            AND ${indianMonth} BETWEEN 1 AND 12
          THEN
            CASE
              WHEN ${indianDay} BETWEEN 1 AND EXTRACT(
                DAY FROM (make_date(${indianYear}, ${indianMonth}, 1) + interval '1 month - 1 day')
              )::int
              THEN make_date(${indianYear}, ${indianMonth}, ${indianDay})
              ELSE NULL::date
            END
          ELSE NULL::date
        END
      ELSE NULL::date
    END
  `;
}

export const CUSTOMER_DUE_DATE_SQL = `COALESCE(
  ${buildCustomerDateSql("amc_warranty_due")},
  ${buildCustomerDateSql("amc_ending_date")}
)`;
