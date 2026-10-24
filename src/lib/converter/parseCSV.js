import Papa from "papaparse";
import ExcelJS from "exceljs";
import { workbookOutput, downloadWorkbookOutput } from './workbook-output';

import { HOURS_COLUMNS, SourceValidationError, validateHoursRows } from './validation';

export function parseHoursText(text) {
  const results = Papa.parse(text, { header: false, skipEmptyLines: false });
  return validateHoursRows(results.data, results.errors);
}

/** @param {Pick<File, 'name' | 'size' | 'text'>} file
 * @returns {Promise<import('./validation').SourceResult<import('./validation').HoursRow[]>>} */
export async function readHoursFile(file) {
  if (!file.size) return { value: null, issues: [{ key: 'importValidation.empty' }] };
  if (!/\.csv$/i.test(file.name)) return { value: null, issues: [{ key: 'importValidation.hoursType' }] };
  try { return parseHoursText(await file.text()); }
  catch { return { value: null, issues: [{ key: 'importValidation.unreadable' }] }; }
}

export async function parseCsvAndExport(file, onComplete, onError, meta = {}) {
  try {
    const result = await readHoursFile(file);
    if (!result.value) throw new SourceValidationError(result.issues);
    await exportHoursRows(result.value, meta);
    onComplete();
  } catch (err) { onError(err); }
}

export async function generateHoursOutput(rows, meta = {}) {
  const workbook = buildHoursWorkbook(rows);
  const buffer = await workbook.xlsx.writeBuffer();
  const formatDate = (date) => date.slice(2, 4) + '_' + date.slice(5, 7) + date.slice(8, 10);
  const number = meta.location?.match(/#(\d+)/)?.[1] ?? 'UNKNOWN';
  const filename = `CR${number}_${formatDate(meta.startDate ?? '')}-${formatDate(meta.endDate ?? '')}_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx`;
  return workbookOutput(filename, buffer);
}

export async function exportHoursRows(rows, meta = {}) {
  return downloadWorkbookOutput(await generateHoursOutput(rows, meta));
}

export function buildHoursWorkbook(rows) {
  // A second boundary check prevents callers from accidentally bypassing validation.
  const result = validateHoursRows([HOURS_COLUMNS, ...rows.map(row => HOURS_COLUMNS.map(column => row[column]))]);
  if (!result.value) throw new SourceValidationError(result.issues);
  const grouped = groupByEmployeeExternalId(result.value);
  return createHoursWorkbook(flattenGroupedData(sortGroupedByDate(grouped)));
}

function groupByEmployeeExternalId(data) {
  const grouped = Object.create(null);
  data.forEach((row) => {
    const id = row["Employee External Id"];
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(row);
  });
  return grouped;
}

function sortGroupedByDate(grouped) {
  const sorted = Object.create(null);

  Object.entries(grouped).forEach(([id, rows]) => {
    sorted[id] = rows.sort((a, b) => {
      const dateA = new Date(a["In Date"]);
      const dateB = new Date(b["In Date"]);
      return dateA - dateB;
    });
  });

  return sorted;
}

function flattenGroupedData(grouped) {
  const result = [];

  const headerRow = {
    "Employee External Id": "Employee Id",
    Employee: "Employee",
    "Job Title": "Job Title",
    "In Date": "In Date",
    "Out Date": "Out Date",
    "Total Hours": "Total Hours",
    "Regular Hours": "Regular Hours",
    "Overtime Hours": "Overtime Hours",
  };

  Object.entries(grouped).forEach(([id, rows]) => {
    result.push(headerRow);

    result.push(...rows);

    const firstRow = rows[0]; 

    const totalRow = {
      "Employee External Id": id,
      Employee: firstRow?.Employee || "",
      "Job Title": firstRow?.["Job Title"] || "",
      "In Date": "TOTAL",
      "Out Date": "",
      "Total Hours": 0,
      "Regular Hours": 0,
      "Overtime Hours": 0,
    };

    rows.forEach((row) => {
      totalRow["Total Hours"] += parseFloat(row["Total Hours"] || "0");
      totalRow["Regular Hours"] += parseFloat(row["Regular Hours"] || "0");
      totalRow["Overtime Hours"] += parseFloat(row["Overtime Hours"] || "0");
    });

    totalRow["Total Hours"] = totalRow["Total Hours"].toFixed(2);
    totalRow["Regular Hours"] = totalRow["Regular Hours"].toFixed(2);
    totalRow["Overtime Hours"] = totalRow["Overtime Hours"].toFixed(2);

    result.push(totalRow);
    result.push({}, {}, {});
  });

  return result;
}

function createHoursWorkbook(allRows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("All Employees");

  sheet.columns = [
    { key: "Employee External Id", width: 25 },
    { key: "Employee", width: 35 },
    { key: "Job Title", width: 30 },
    { key: "In Date", width: 25 },
    { key: "Out Date", width: 25 },
    { key: "Total Hours", width: 25 },
    { key: "Regular Hours", width: 25 },
    { key: "Overtime Hours", width: 25 }
  ];

  //< page setup />

  allRows.forEach((row, rowIndex) => {
    const keys        = Object.keys(row);
    const isHeaderRow = row["Employee External Id"] === "Employee Id" && row["Employee"] === "Employee";
    const isTotalRow  = row["In Date"] === "TOTAL";

    const values = keys.map((key) => {
      if (
        !isHeaderRow &&
        ["Total Hours", "Regular Hours", "Overtime Hours"].includes(key) &&
        row[key] !== "" &&
        row[key] !== undefined &&
        row[key] !== null
      ) {
        const num = parseFloat(row[key]);
        return isNaN(num) ? null : num;
      }
      return row[key];
    });

    const addedRow = sheet.addRow(values);

    addedRow.alignment = { vertical: "middle", horizontal: "center" };

    if (!isHeaderRow && !isTotalRow) {
      addedRow.font = { name: "Arial", size: 14 };
    }
    
    const excelRowNumber = addedRow.number;

    if (!isHeaderRow) {
      ["Total Hours", "Regular Hours", "Overtime Hours"].forEach(colName => {
        const colIndex = keys.indexOf(colName) + 1;
        if (colIndex > 0) {
          const cell = sheet.getCell(excelRowNumber, colIndex);
          cell.numFmt = '0.00';
        }
      });
    }

    if (isHeaderRow) {
      addedRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 16, bold: true };
        cell.fill = undefined;
        cell.border = {
          bottom: { style: "thick", color: { argb: "000000" } } 
        };
      });
    }

    if (isTotalRow) {
      const colStart = keys.indexOf("In Date") + 1;
      const colEnd = keys.indexOf("Out Date") + 1;

      if (colStart > 0 && colEnd > colStart) {
        sheet.mergeCells(excelRowNumber, colStart, excelRowNumber, colEnd);

        const mergedCell = sheet.getCell(excelRowNumber, colStart);
        mergedCell.alignment = { vertical: "middle", horizontal: "center" };
        mergedCell.font = { bold: true, name: 'Arial', size: 16 };
      }

      addedRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 16, bold: true };
      });

      addedRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thick", color: { argb: "000000" } }
        };
      });
    }
  });

  const endRow = sheet.addRow(["*** END OF REPORT ***"]);
  endRow.alignment = { vertical: "middle", horizontal: "center" };
  endRow.font = { name: "Arial", bold: true, size: 16 };

  const endRowNumber = endRow.number;
  sheet.mergeCells(endRowNumber, 1, endRowNumber, 8);

  return workbook;
}
