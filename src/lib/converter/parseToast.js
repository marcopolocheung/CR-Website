import * as XLSX from 'xlsx';

export const toNumber = (v) => Number(String(v).replace(/[$,]/g, '')) || 0;

const getSheetDataFrom = (wb, sheetName) => {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" missing.`);
  return XLSX.utils.sheet_to_json(sheet);
};

const findCell = (rows, match, col) => {
  const row = rows.find(match);
  if (!row) throw new Error(`Row not found for column "${col}".`);
  return toNumber(row[col]);
};

const findCellSafe = (rows, match, col) => {
  const row = rows.find(match);
  if (!row) return 0;
  return toNumber(row[col]);
};

export function extractMetrics({ generalWb, lunchWb, dinnerWb }) {
  // gwb
  const revenueSummary  = getSheetDataFrom(generalWb, 'Revenue summary');
  const paymentsSummary = getSheetDataFrom(generalWb, 'Payments summary');

  const checkDiscounts = (() => {
    try { return getSheetDataFrom(generalWb, 'Check Discounts'); }
    catch { return []; }
  })();

  const voidSummary     = getSheetDataFrom(generalWb, 'Void summary');

  const revenueTotal = toNumber(revenueSummary[0]?.Total);

  const cashTotal = findCell(paymentsSummary,
    (r) => r['Payment type']?.toUpperCase() === 'CASH', 'Total');

  const card = (sub) =>
    findCellSafe(paymentsSummary,
      (r) =>
        r['Payment type']?.toUpperCase() === 'CREDIT/DEBIT' &&
        r['Payment sub type']?.toUpperCase() === sub, 'Total');

  // lunch workbook
  const lunchSummary = getSheetDataFrom(lunchWb, 'Sales category summary');
  const lunchDrink   = findCell(lunchSummary, (r) => (r['Sales category'] || "").toUpperCase() === 'DRINK', 'Net sales');
  const lunchFood    = findCell(lunchSummary, (r) => (r['Sales category'] || "").toUpperCase() === 'FOOD',  'Net sales');
  const lunchTax     = findCell(lunchSummary, (r) => r['Sales category'] === 'Total', 'Tax amount');

  // dinner workbook
  const dinnerSummary = getSheetDataFrom(dinnerWb, 'Sales category summary');
  const dinnerDrink   = findCell(dinnerSummary, (r) => (r['Sales category'] || "").toUpperCase() === 'DRINK', 'Net sales');
  const dinnerFood    = findCell(dinnerSummary, (r) => (r['Sales category'] || "").toUpperCase() === 'FOOD',  'Net sales');
  const dinnerTax     = findCell(dinnerSummary, (r) => r['Sales category'] === 'Total', 'Tax amount');

  return {
    C8:  revenueTotal,
    C9:  cashTotal,
    C10: card('DISCOVER'),
    C11: card('AMEX'),
    C12: card('MASTERCARD'),
    C13: card('VISA'),

    C16: findCellSafe(checkDiscounts, (r) => r.Discount === 'Total', 'Amount'),

    C17: toNumber(voidSummary[0]?.['Void amount']),
    C19: lunchDrink,
    C18: lunchFood,
    C20: lunchTax,
    C22: dinnerDrink,
    C21: dinnerFood,
    C23: dinnerTax,
  };
}
