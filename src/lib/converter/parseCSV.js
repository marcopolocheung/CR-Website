import Papa from "papaparse";
import ExcelJS from "exceljs";

export function parseCsvAndExport(file, onComplete, onError, meta = {}) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const grouped = groupByEmployeeExternalId(results.data);
      const sorted = sortGroupedByDate(grouped);
      const flattened = flattenGroupedData(sorted);
      exportSingleSheetXlsx(flattened, meta); 
      onComplete();
    },
    error: (err) => {
      onError(err);
    },
  });
}

function groupByEmployeeExternalId(data) {
  const grouped = {};
  data.forEach((row) => {
    const id = row["Employee External Id"];
    if (!id) return;
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(row);
  });
  return grouped;
}

function sortGroupedByDate(grouped) {
  const sorted = {};

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

async function exportSingleSheetXlsx(allRows, meta = {}) {
  const { location = "", startDate = "", endDate = "" } = meta;
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

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  

  function formatDate(dateStr) {

    const date = new Date(dateStr);
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const yy = year.toString().slice(-2); 
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    
    return `${yy}_${mm}${dd}`;
  }


  function extractChinaRoseNumber(locationStr) {
    const match = locationStr?.match(/#(\d+)/);
    return match ? match[1] : "UNKNOWN";
  }

  const chinaRoseNumber = extractChinaRoseNumber(location);
  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);

  const fileName = `CR${chinaRoseNumber}_${formattedStartDate}-${formattedEndDate}_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx`;

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}