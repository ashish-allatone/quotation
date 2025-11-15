import React, { useState } from "react";
import { Button, DropdownButton, Dropdown } from "react-bootstrap";
import DataTable from "react-data-table-component";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./QuotationPage.css";

const SQFT_TO_M2 = 0.092903; // conversion constant

const QuotationPage = () => {
  // ------------------ STATIC TABLE DATA ------------------
  const initialTableData = [
    {
      sn: 1,
      width: 100,
      drop: 115,
      nos: 3,
      room: "ROOM",
      area: 3.45,
      shade: "",
      rate: 1500.0,
      amount: 5175.0,
      gstRate: null, // <-- per-row GST %
    },
    {
      sn: 2,
      width: 160,
      drop: 130,
      nos: 2,
      room: "ROOM",
      area: 4.16,
      shade: "BDF 5880",
      rate: 1500.0,
      amount: 6240.0,
      gstRate: null,
    },
    {
      sn: 3,
      width: 155,
      drop: 130,
      nos: 1,
      room: "ROOM",
      area: 2.02,
      shade: "",
      rate: 1500.0,
      amount: 3022.5,
      gstRate: null,
    },
  ];

  const [tableData, setTableData] = useState(initialTableData);

  // const grandTotal = 17370; // with fixing charge
  const [gstRate, setGstRate] = useState(12); // default GST 12%

  // ---------- NEW: measurement unit (cm or sqft) ----------
  const [measurementUnit, setMeasurementUnit] = useState("cm");

  // REPLACE computedData mapping with this derived calculation
  const computedData = tableData.map((r, idx) => {
    const width = Number(r.width || 0);
    const drop = Number(r.drop || 0);
    const nos = Number(r.nos || 0);
    const rate = Number(r.rate || 0);

    // In table we keep AREA as m^2 (same as before)
    const area_m2 = Number(r.area || 0);
    const amount = Number(r.amount || 0);

    // Use per-row GST if present; otherwise fall back to global gstRate state
    const rowGstPercent = Number(
      // r.gstRate may be 0, so explicit nullish fallback is safer:
      r.gstRate == null ? gstRate : r.gstRate
    );

    const gst = parseFloat((amount * (rowGstPercent / 100)).toFixed(2));
    const total = parseFloat((amount + gst).toFixed(2));

    return {
      ...r,
      sn: r.sn ?? idx + 1,
      width,
      drop,
      nos,
      room: r.room,
      area: parseFloat(area_m2.toFixed(2)), // total area (m^2)
      rate,
      amount: parseFloat(amount.toFixed(2)),
      // gstRate: rowGstPercent, // expose per-row GST %
      gst,
      total,
    };
  });

  // ------------------ COMPUTE GRAND TOTALS ------------------
  const totals = computedData.reduce(
    (acc, row) => {
      acc.nos += Number(row.nos || 0);
      acc.area += Number(row.area || 0);
      acc.amount += Number(row.amount || 0);
      acc.gst += Number(row.gst || 0);
      acc.total += Number(row.total || 0);
      return acc;
    },
    { nos: 0, area: 0, amount: 0, gst: 0, total: 0 }
  );

  totals.area = parseFloat(totals.area.toFixed(2));
  totals.amount = parseFloat(totals.amount.toFixed(2));
  totals.gst = parseFloat(totals.gst.toFixed(2));
  totals.total = parseFloat(totals.total.toFixed(2));

  // ------------------ SEARCH + PAGINATION ------------------
  const [filterText, setFilterText] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(
    "For 100 MM Vertical BLINDS of MAC PRODUCT. (ROLLER)"
  );
  // Editable header / contact / sch / to fields
  const [headerTitle, setHeaderTitle] = useState("SKIPPER CARPET HOUSE");
  const [supplierLine, setSupplierLine] = useState(
    "Supplier of: TISCO, TELCO, TIMKEN, TRF, UCIL, HCL & GOVERNMENT CONCERNS"
  );
  const [email, setEmail] = useState("skippercarpet@gmail.com");

  const [schNumber, setSchNumber] = useState("SCH/QTN 1859/2025-26");
  const [toName, setToName] = useState("TCI LTD TRANSPORT");
  const [toLocation, setToLocation] = useState("JAMSHEDPUR");
  const [newRow, setNewRow] = useState({
    width: 100,
    drop: 115,
    nos: 1,
    room: "ROOM",
    shade: "",
    rate: 1500.0,
    gstRate: null, // default per-row GST uses top-level GST state
  });

  // ---- ADD: ARC / MATERIAL / ITEM dropdowns with dynamic add ----
  const [arcOptions, setArcOptions] = useState(["4700115720"]); // sample default
  const [materialOptions, setMaterialOptions] = useState(["5406A0087"]);
  const [itemOptions, setItemOptions] = useState(["00030"]);

  const [arcNo, setArcNo] = useState(arcOptions[0] || "");
  const [materialNo, setMaterialNo] = useState(materialOptions[0] || "");
  const [itemNo, setItemNo] = useState(itemOptions[0] || "");

  // inputs to add new option
  const [newArcInput, setNewArcInput] = useState("");
  const [newMaterialInput, setNewMaterialInput] = useState("");
  const [newItemInput, setNewItemInput] = useState("");

  const addArcOption = () => {
    const v = (newArcInput || "").trim();
    if (!v) return;
    if (!arcOptions.includes(v)) setArcOptions((prev) => [...prev, v]);
    setArcNo(v);
    setNewArcInput("");
  };

  const addMaterialOption = () => {
    const v = (newMaterialInput || "").trim();
    if (!v) return;
    if (!materialOptions.includes(v))
      setMaterialOptions((prev) => [...prev, v]);
    setMaterialNo(v);
    setNewMaterialInput("");
  };

  const addItemOption = () => {
    const v = (newItemInput || "").trim();
    if (!v) return;
    if (!itemOptions.includes(v)) setItemOptions((prev) => [...prev, v]);
    setItemNo(v);
    setNewItemInput("");
  };

  // helper to update a field in newRow (string inputs => numbers parsed)
  const updateNewRowField = (field, value) => {
    // parse numeric fields
    if (["width", "drop", "nos", "rate", "gstRate"].includes(field)) {
      const num = Number(value || 0);
      setNewRow((prev) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
    } else {
      setNewRow((prev) => ({ ...prev, [field]: value }));
    }
  };

  // compute derived preview for the newRow (area & amount)
  // UPDATED: takes measurementUnit into account and returns both display area and area in m2
  const computeRowDerived = (row) => {
    const width = Number(row.width || 0);
    const drop = Number(row.drop || 0);
    const nos = Number(row.nos || 0);
    const rate = Number(row.rate || 0);

    if (measurementUnit === "cm") {
      // inputs are in cm, area in m^2
      const areaPerItem_m2 = (width / 100) * (drop / 100); // m^2 per item
      const totalArea_m2 = areaPerItem_m2 * nos;
      const amount = totalArea_m2 * rate;
      return {
        areaPerItem_display: parseFloat(areaPerItem_m2.toFixed(4)),
        totalArea_display: parseFloat(totalArea_m2.toFixed(2)), // m^2
        totalArea_m2: parseFloat(totalArea_m2.toFixed(4)),
        amount: parseFloat(amount.toFixed(2)),
      };
    } else {
      // measurementUnit === 'sqft' - inputs are in feet, area in sqft for display
      const areaPerItem_sqft = width * drop; // sqft per item
      const totalArea_sqft = areaPerItem_sqft * nos;
      const totalArea_m2 = totalArea_sqft * SQFT_TO_M2;
      const amount = totalArea_m2 * rate;
      return {
        areaPerItem_display: parseFloat(areaPerItem_sqft.toFixed(4)),
        totalArea_display: parseFloat(totalArea_sqft.toFixed(2)), // sqft
        totalArea_m2: parseFloat(totalArea_m2.toFixed(4)),
        amount: parseFloat(amount.toFixed(2)),
      };
    }
  };

  // helper to format yyyy-mm-dd -> dd.mm.yyyy for PDF display
  const formatDateDisplay = (isoDateStr) => {
    if (!isoDateStr) return "";
    const [y, m, d] = isoDateStr.split("-");
    return `${d}.${m}.${y}`;
  };
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  // ---------- Notes state & editing control (ADD THIS) ----------
  // initial notes (use the existing text you had before)
  const [notes, setNotes] = useState([
    "Material will be supplied within 15 days after getting confirmation order.",
    "Payment 20% advance & rest payment after supplying and fixing the blinds at same day.",
    "Fixing charges will be extra 150/- Per Pic",
  ]);

  // savedNotes holds the finalized notes used for export; initially same as notes
  const [savedNotes, setSavedNotes] = useState([...notes]);

  // editing mode: true = show inputs, false = show saved text
  const [isEditingNotes, setIsEditingNotes] = useState(true);

  // handlers
  const updateNote = (index, value) => {
    const copy = [...notes];
    copy[index] = value;
    setNotes(copy);
  };
  const deleteNote = (index) => {
    setNotes((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      return copy;
    });
  };

  const addNote = () => {
    setNotes((prev) => [...prev, ""]);
    setIsEditingNotes(true);
  };

  const saveNotes = () => {
    setSavedNotes([...notes]);
    setIsEditingNotes(false);
  };

  const editNotes = () => {
    setIsEditingNotes(true);
  };

  const filteredData = computedData.filter((item) => {
    const combined = Object.values(item).join(" ").toLowerCase();
    return combined.includes(filterText.toLowerCase());
  });

  const totalItems = filteredData.length;

  // ADD: add new row to tableData - uses computeRowDerived (which handles unit conversion)
  const addRow = () => {
    const derived = computeRowDerived(newRow);
    const nextSN = tableData.length
      ? Math.max(...tableData.map((t) => t.sn || 0)) + 1
      : 1;

    const rowToInsert = {
      sn: nextSN,
      width: Number(newRow.width || 0),
      drop: Number(newRow.drop || 0),
      nos: Number(newRow.nos || 0),
      room: newRow.room || "",
      shade: newRow.shade || "",
      rate: Number(newRow.rate || 0),
      // store area as m^2 (this keeps rest of the code compatible)
      area: derived.totalArea_m2,
      amount: derived.amount,
      gstRate: newRow.gstRate == null ? null : Number(newRow.gstRate), // <-- store per-row GST
      unit: measurementUnit, // optional: store which unit this row was added with
    };

    setTableData((prev) => [...prev, rowToInsert]);

    // optional: reset newRow to sensible defaults (keep this or change to blank)
    setNewRow({
      width: 100,
      drop: 115,
      nos: 1,
      room: "ROOM",
      shade: "",
      rate: 1500.0,
    });
  };

  // ADD: delete row by sn (or index)
  const deleteRow = (sn) => {
    setTableData((prev) => prev.filter((r) => r.sn !== sn));
  };
  // update a specific field on an existing row by sn (used for per-row GST edit)
  const updateRowFieldBySN = (sn, field, value) => {
    setTableData((prev) =>
      prev.map((r) => {
        if (r.sn !== sn) return r;
        // accept numeric for gstRate
        if (
          [
            "width",
            "drop",
            "nos",
            "rate",
            "gstRate",
            "amount",
            "area",
          ].includes(field)
        ) {
          const num = Number(value || 0);
          return { ...r, [field]: isNaN(num) ? 0 : num };
        }
        return { ...r, [field]: value };
      })
    );
  };

  // ------------------ EXPORT FUNCTIONS ------------------
  // ------------------ EXPORT TO EXCEL (REPLACEMENT) ------------------
// ------------------ EXPORT TO EXCEL (ENHANCED: centered headers, left & right blocks) ------------------
const exportToExcel = () => {
  // We'll build a 12-column layout (A..L) that mirrors the PDF visually.
  const COLS = 12; // number of columns we use for layout

  // Helper to push a row with exactly COLS columns (pads with empty strings)
  const pushRow = (rows, arr) => {
    const copy = Array.from(arr);
    while (copy.length < COLS) copy.push("");
    rows.push(copy);
  };

  const rows = [];

  // 0.. -> Build rows in order (we'll merge/center some later)
  pushRow(rows, [headerTitle]); // 0 - header title (will be merged & centered)
  pushRow(rows, [supplierLine]); // 1 - supplier (merged)
  pushRow(rows, [`E-mail: ${email}`]); // 2 - email (merged)
  pushRow(rows, []); // 3 - empty
  pushRow(rows, ["QUOTATION"]); // 4 - quotation title (merged)
  pushRow(rows, []); // 5 - empty

  // SCH / DT row: left block (SCH) in columns A,B ; right block (DT) in columns J,K
  // We'll place SCH label & value in col A/B and DT label/value in J/K
  // SCH row (left side)
const schRow = [];
schRow[0] = schNumber;
pushRow(rows, schRow); // schRow index (previously 6)

// DT row (placed BELOW the SCH row, on the left side)
const dtRow = Array(COLS).fill("");
dtRow[0] = "DT";
dtRow[1] = formatDateDisplay(date);
pushRow(rows, dtRow); // new DT row (will be schRowIndex + 1)

// TO rows - left column (A/B) (moved down because of inserted DT)
const toRow = [];
toRow[0] = "TO";
toRow[1] = toName;
pushRow(rows, toRow); // toRow

const toLocRow = [];
toLocRow[1] = toLocation;
pushRow(rows, toLocRow); // toLocRow


  pushRow(rows, []); // 9

  // Description (left)
  pushRow(rows, ["Description", description]); // 10
  pushRow(rows, []); // 11

  // ARC / MATERIAL / ITEM row (spread across left-to-right)
  const arcRow = [];
  arcRow[0] = "ARC NO:";
  arcRow[1] = arcNo;
  arcRow[3] = "MATERIAL NO:";
  arcRow[4] = materialNo;
  arcRow[6] = "ITEM NO:";
  arcRow[7] = itemNo;
  pushRow(rows, arcRow); // 12

  pushRow(rows, []); // 13 - space before table

  // Table header (14)
  const widthLabelXlsx = measurementUnit === "cm" ? "WIDTH (cm)" : "WIDTH (ft)";
  const dropLabelXlsx = measurementUnit === "cm" ? "DROP (cm)" : "DROP (ft)";
  const tableHeader = [
    "SN",
    widthLabelXlsx,
    dropLabelXlsx,
    "NOS",
    "ROOM",
    "AREA (m2)",
    "SHADE",
    "RATE",
    "GST (%)",
    "G.S.T. AMT",
    "AMOUNT",
    "TOTAL",
  ];
  pushRow(rows, tableHeader); // 14

  // Table body - start at row index 15
  computedData.forEach((r) => {
    pushRow(rows, [
      r.sn,
      r.width,
      r.drop,
      r.nos,
      r.room,
      Number(r.area.toFixed(2)),
      r.shade,
      Number(r.rate.toFixed(2)),
      Number((r.gstRate == null ? gstRate : r.gstRate).toFixed(2)),
      Number(r.gst.toFixed(2)),
      Number(r.amount.toFixed(2)),
      Number(r.total.toFixed(2)),
    ]);
  });

 // ---------- REPLACEMENT: Put Amount/GST/Total aligned to the RIGHT but on same lines as NOS/AREA ----------
pushRow(rows, []); // blank after table

// NOS row with Amount on the right (col index 9 label, 10 value)
const nosRow = Array(COLS).fill("");
nosRow[0] = "NOS";
nosRow[1] = totals.nos;
nosRow[9] = "Amount";
nosRow[10] = Number(totals.amount.toFixed(2));
rows.push(nosRow);

// AREA row with GST Amt on the right
const areaRow = Array(COLS).fill("");
areaRow[0] = "AREA (m2)";
areaRow[1] = Number(totals.area.toFixed(2));
areaRow[9] = "GST Amt";
areaRow[10] = Number(totals.gst.toFixed(2));
rows.push(areaRow);

// blank row then Total Amt (right)
pushRow(rows, []);
const totalRow = Array(COLS).fill("");
totalRow[9] = "Total Amt";
totalRow[10] = Number(totals.total.toFixed(2));
rows.push(totalRow);


  pushRow(rows, []); // space before notes

  // NOTES
  const notesToWrite = savedNotes && savedNotes.length ? savedNotes : notes;
  if (notesToWrite && notesToWrite.length) {
    pushRow(rows, ["NOTE:"]);
    notesToWrite.forEach((n, idx) => {
      pushRow(rows, [`${String(idx + 1).padStart(2, "0")}. ${n}`]);
    });
  }

  // Build worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);
// Helper to set basic style (center + bold optionally)
const setCellStyles = (r, c, style) => {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!ws[ref]) ws[ref] = { t: "s", v: "" };
  ws[ref].s = Object.assign({}, ws[ref].s || {}, style);
};

// Center and bold the main header lines (apply style to the top-left cell of each merged region)
setCellStyles(0, 0, {
  alignment: { horizontal: "center", vertical: "center" },
  font: { bold: true, sz: 14 },
});
setCellStyles(1, 0, {
  alignment: { horizontal: "center", vertical: "center" }
});
setCellStyles(2, 0, {
  alignment: { horizontal: "center", vertical: "center" }
});
setCellStyles(4, 0, {
  alignment: { horizontal: "center", vertical: "center" },
  font: { bold: true },
});

  // Optional: set column widths (adjust as needed)
 ws["!cols"] = [
  { wch: 15 }, // 0 → big label column (A)
  { wch: 14 }, // 1 → value column (B)
  { wch: 10  }, // 2 → small spacer
  { wch: 20 }, // 3 → MATERIAL label (D)
  { wch: 12 }, // 4 → MATERIAL value
  { wch: 10  }, // 5 → spacer
  { wch: 20 }, // 6 → ITEM label
  { wch: 12 }, // 7 → ITEM value
  { wch: 10 }, // 8 → small shading / misc col
  { wch: 12 }, // 9 → right-side label (Amount / GST / Total label)
  { wch: 16 }, // 10 → right-side values (Amount / GST / Total value)
  { wch: 10 }, // 11 → small total column (reduces the visual gap)
];

  // ------------------ merges & styles ------------------
  // Merge header / supplier / email / QUOTATION across A..L (0..11)
  // We'll merge the first three rows and the QUOTATION row to center them.
  ws["!merges"] = ws["!merges"] || [];
  const pushMerge = (sr, sc, er, ec) => ws["!merges"].push({ s: { r: sr, c: sc }, e: { r: er, c: ec } });
  // header rows: row indexes (0-based)
  pushMerge(0, 0, 0, COLS - 1); // headerTitle row 0
  pushMerge(1, 0, 1, COLS - 1); // supplierLine row 1
  pushMerge(2, 0, 2, COLS - 1); // email row 2
  pushMerge(4, 0, 4, COLS - 1); // QUOTATION row 4

  // Optionally merge description across many columns
  // pushMerge(10, 1, 10, COLS - 1); // description value (row 10, col B..L)
  pushMerge(11, 1, 11, COLS - 1); // description value (row 11, col B..L)
  // ---------- MERGE NOTES ROWS TO FULL WIDTH (A..L) ----------
if (notesToWrite && notesToWrite.length) {
  // compute where notes start in the rows array
  // find the first row index where a note was added by searching for the "NOTE:" cell text
  let notesStart = -1;
  for (let r = 0; r < rows.length; r++) {
    const cellVal = rows[r][0];
    if (cellVal === "NOTE:") {
      notesStart = r;
      break;
    }
  }
  if (notesStart !== -1) {
    // merge each note row across all columns 0..(COLS-1)
    for (let i = 0; i < (notesToWrite.length + 1); i++) {
      // +1 because the first "NOTE:" row is included, and follow-up lines are separate
      const rr = notesStart + i;
      pushMerge(rr, 0, rr, COLS - 1);
    }
  }
}


  // Center the merged header cells and QUOTATION
  const setCellStyle = (r, c, style) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = Object.assign({}, ws[ref].s || {}, style);
  };

  // center header rows (A1, A2, A3, A5 indexes)
  setCellStyle(0, 0, { alignment: { horizontal: "center", vertical: "center" }, font: { bold: true, sz: 14 } });
  setCellStyle(1, 0, { alignment: { horizontal: "center" , vertical: "center"} });
  setCellStyle(2, 0, { alignment: { horizontal: "center" , vertical: "center"} });
  setCellStyle(4, 0, { alignment: { horizontal: "center", vertical: "center" }, font: { bold: true ,sz: 14} });

  // Make table header bold and centered (row index 14)
  const headerRowIndex = 15;
  for (let c = 0; c < COLS; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRowIndex, c });
    if (ws[ref]) {
      ws[ref].s = Object.assign({}, ws[ref].s || {}, { font: { bold: true }, alignment: { horizontal: "center" } });
    }
  }

  // Right-align the DT cell(s) (we placed DT label at col 9, value at col10) and right totals
  // setCellStyle(6, 9, { alignment: { horizontal: "right" }, font: { bold: true } }); // "DT" label
  // setCellStyle(6, 10, { alignment: { horizontal: "right" } }); // date value

  // style DT row (left side)
  const dtIndex = 7;
setCellStyle(dtIndex, 0, { alignment: { horizontal: "left", vertical: "center" }, font: { bold: true } });
setCellStyle(dtIndex, 1, { alignment: { horizontal: "left", vertical: "center" }, font: { bold: true } });

  // Right totals already placed at columns J(9) and K(10) - set right alignment and bold label
  // find the first totals row index: locate the first row with label in col 9
  for (let r = 0; r < rows.length; r++) {
    const labelRef = XLSX.utils.encode_cell({ r, c: 9 });
    if (ws[labelRef] && ws[labelRef].v && typeof ws[labelRef].v === "string") {
      // assume these are right-totals we added; style them
      setCellStyle(r, 9, { alignment: { horizontal: "right" }, font: { bold: true } });
      setCellStyle(r, 10, { alignment: { horizontal: "right" } });
    }
  }

  // Build workbook and save
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Quotation");
  XLSX.writeFile(wb, "quotation.xlsx");
};



  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header - centered
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(headerTitle, 105, 15, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    // split supplier line to avoid overflow
    const supplierLines = doc.splitTextToSize(supplierLine, 180);
    doc.text(supplierLines, 105, 21, { align: "center" });
    // email
    doc.text(`E-mail: ${email}`, 105, 27 + (supplierLines.length - 1) * 4, {
      align: "center",
    });

    // QUOTATION centered
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("QUOTATION", 105, 36, { align: "center" });

    // SCH/QTN left, DT right
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(schNumber, 15, 45);
    doc.text("DT: " + formatDateDisplay(date), 15, 51);

    // TO block (editable)
    doc.setFont("helvetica", "bold");
    doc.text("TO:", 15, 57);
    doc.setFont("helvetica", "normal");
    doc.text(toName, 15, 63);
    doc.text(toLocation, 15, 69);

    // Description label and text
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Description: ", 15, 77);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(description, 180);
    doc.text(descLines, 36, 77);

    // ARC / MATERIAL / ITEM line (below description)
    doc.setFontSize(10);
    doc.text(`ARC NO: ${arcNo}`, 15, 86);
    doc.text(`MATERIAL NO: ${materialNo}`, 90, 86);
    doc.text(`ITEM NO: ${itemNo}`, 160, 86);

    // Table head + body
    const head = [
      [
        "SN",
        measurementUnit === "cm" ? "WIDTH (cm)" : "WIDTH (ft)",
        measurementUnit === "cm" ? "DROP (cm)" : "DROP (ft)",
        "NOS",
        "ROOM",
        "AREA (m2)",
        "SHADE",
        "RATE",
        "GST (%)",
        "G.S.T. AMT",
        "AMOUNT",
        "TOTAL",
      ],
    ];

    const body = computedData.map((r) => [
      r.sn,
      r.width,
      r.drop,
      r.nos,
      r.room,
      r.area.toFixed(2),
      r.shade,
      r.rate.toFixed(2),
      (r.gstRate || gstRate).toFixed(2), // show GST % (two decimals)
      r.gst.toFixed(2), // GST amount
      r.amount.toFixed(2),
      r.total.toFixed(2),
    ]);

    autoTable(doc, {
      startY: 92,
      head: head,
      body: body,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { textColor: [0, 0, 0], fillColor: [255, 255, 255] },
      columnStyles: {
        3: { halign: "center" }, // NOS center
        5: { halign: "right" }, // AREA
        7: { halign: "right" }, // RATE
        8: { halign: "right" }, // GST (%)  (if you want)
        9: { halign: "right" }, // GST AMT
        10: { halign: "right" }, // AMOUNT
        11: { halign: "right" }, // TOTAL
      },
    });

    let finalY = doc.lastAutoTable.finalY + 8;

    // LEFT - NOS & AREA
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`NOS: ${totals.nos}`, 14, finalY + 10);
    doc.text(`AREA: ${totals.area.toFixed(2)}`, 14, finalY + 18);

    // RIGHT - Amount / GST / Total (right aligned)
    const pageWidth = doc.internal.pageSize.getWidth();
    const rightX = pageWidth - 14;
    doc.setFont("helvetica", "bold");
    doc.text(`Amount: ${totals.amount.toFixed(2)}`, rightX, finalY + 10, {
      align: "right",
    });
    doc.text(`GST Amt: ${totals.gst.toFixed(2)}`, rightX, finalY + 18, {
      align: "right",
    });
    doc.text(`Total Amt: ${totals.total.toFixed(2)}`, rightX, finalY + 26, {
      align: "right",
    });

    // NOTES below
    const notesStartY = finalY + 40;
    doc.setFont("helvetica", "bold");
    doc.text("NOTE:", 14, notesStartY);
    doc.setFont("helvetica", "normal");
    const notesToWrite = savedNotes && savedNotes.length ? savedNotes : notes;
    notesToWrite.forEach((noteText, idx) => {
      const lineY = notesStartY + 6 + idx * 6;
      const prefix = String(idx + 1).padStart(2, "0") + ". ";
      doc.text(prefix + noteText, 20, lineY);
    });

    // Final footer total (if needed)
    // doc.setFont("helvetica", "bold");
    // doc.setFontSize(11);
    // doc.text(
    //   `Total Amt With Fixing ${grandTotal}/-`,
    //   14,
    //   notesStartY + 6 + notesToWrite.length * 6 + 14
    // );

    doc.save("quotation.pdf");
  };

  // ------------------ TABLE COLUMNS ------------------
  const widthLabel = measurementUnit === "cm" ? "WIDTH (cm)" : "WIDTH (ft)";
  const dropLabel = measurementUnit === "cm" ? "DROP (cm)" : "DROP (ft)";

  const columns = [
    { name: "SN", selector: (row) => row.sn, sortable: true, width: "70px" },
    { name: widthLabel, selector: (row) => row.width },
    { name: dropLabel, selector: (row) => row.drop },
    { name: "NOS", selector: (row) => row.nos },
    { name: "ROOM", selector: (row) => row.room },
    {
      name: "AREA (m²)",
      selector: (row) => row.area,
      format: (row) => row.area.toFixed(2),
    },
    { name: "SHADE", selector: (row) => row.shade },
    {
      name: "RATE",
      selector: (row) => row.rate,
      format: (row) => row.rate.toFixed(2),
    },

    // NEW: GST % editable column
    {
  name: "GST (%)",
  cell: (row) => (
    <select
      className="form-select form-select-sm"
      // show the row's explicit gstRate when set; otherwise show global gstRate
      value={String(row.gstRate ?? gstRate)}
      onChange={(e) =>
        // save numeric value into tableData (updateRowFieldBySN already parses numbers)
        updateRowFieldBySN(row.sn, "gstRate", Number(e.target.value))
      }
      style={{ width: 90 }}
    >
      <option value="0">0%</option>
      <option value="2">2%</option>
      <option value="5">5%</option>
      <option value="10">10%</option>
      <option value="12">12%</option>
      <option value="15">15%</option>
      <option value="18">18%</option>
      <option value="20">20%</option>
      <option value="28">28%</option>
    </select>
  ),
  ignoreRowClick: true,
  allowOverflow: true,
  width: "110px",
},

    // GST Amount (calculated)
    {
      name: "G.S.T. AMT",
      selector: (row) => row.gst,
      format: (row) => row.gst.toFixed(2),
    },

    {
      name: "AMOUNT",
      selector: (row) => row.amount,
      format: (row) => row.amount.toFixed(2),
    },

    {
      name: "TOTAL",
      selector: (row) => row.total,
      format: (row) => row.total.toFixed(2),
    },

    {
      name: "ACTION",
      cell: (row) => (
        <button
          className="btn btn-sm btn-outline-danger"
          onClick={() => deleteRow(row.sn)}
        >
          Delete
        </button>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
      width: "100px",
    },
  ];

  // ------------------ RETURN JSX ------------------
  return (
    <div className="quotation-page container mt-4 mb-5 p-4 border rounded bg-white">
      {/* Header */}
      <div className="text-center mb-2">
        {/* Title (editable) - use textarea so long titles wrap to next line */}
        <div>
          <textarea
            rows={1}
            className="text-center fw-bold text-uppercase"
            value={headerTitle}
            onChange={(e) => setHeaderTitle(e.target.value)}
            style={{
              fontSize: "1.25rem",
              border: "none",
              background: "transparent",
              outline: "none",
              display: "block",
              margin: "0 auto",
              width: "90%",
              maxWidth: "900px",
              padding: 0,
              resize: "vertical",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.05,
            }}
          />
        </div>

        {/* Supplier line (editable) - textarea so it wraps into next line(s) */}
        <div>
          <textarea
            rows={2}
            className="text-center mt-3"
            value={supplierLine}
            onChange={(e) => setSupplierLine(e.target.value)}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              display: "block",
              margin: "0 auto",
              width: "90%",
              maxWidth: "900px",
              padding: 0,
              resize: "vertical",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.05,
            }}
          />
        </div>

        {/* Email (editable) - keep input but center the control block */}
        <div className="small fw-semibold">
          E-mail:{" "}
          <input
            type="email"
            className="d-inline-block"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              display: "inline-block",
              border: "none",
              background: "transparent",
              padding: 0,
              width: "auto",
            }}
          />
        </div>
      </div>
      <h5 className="text-center mb-3 text-decoration-underline fw-bold mt-2">
        QUOTATION
      </h5>

      {/* SCH/QTN with DT in-place, and TO stacked under SCH */}
      <div className="mb-2">
        <input
          type="text"
          className="form-control form-control-sm"
          style={{
            width: "220px",
            border: "none",
            background: "transparent",
            resize: "none",
            paddingLeft: "0px",
          }}
          value={schNumber}
          onChange={(e) => setSchNumber(e.target.value)}
        />

        {/* DT stays at its original place (immediately under SCH). It's now a date picker. */}
        <div className="mb-2 d-flex align-items-center gap-2 mt-1">
          <label htmlFor="dtInput" className="mb-0">
            DT:
          </label>
          <input
            id="dtInput"
            type="date"
            className="form-control form-control-sm d-inline-block"
            style={{ width: "140px" }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* TO block is placed below SCH (stacked) */}
        <div className="mt-2">
          <label className="mb-0 fw-bold">TO:</label>
          <div className="mt-1">
            <input
              type="text"
              className="form-control form-control-sm mb-1"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                resize: "none",
                paddingLeft: "0px",
              }}
            />
            <input
              type="text"
              className="form-control form-control-sm"
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                resize: "none",
                paddingLeft: "0px",
              }}
            />
          </div>
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label mb-1 fw-semibold">Description:</label>
        <textarea
          className="form-control"
          rows={1}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter product description e.g. 200 MM, Side SYSTEM, DIY ITEM. (PENCIL)"
          style={{
            border: "none",
            background: "transparent",
            resize: "none",
            paddingLeft: "0px",
          }}
        />
      </div>

      {/* Controls */}
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <div className="d-flex align-items-center gap-2">
          <label className="mb-0">Show</label>
          <select
            className="form-select form-select-sm"
            value={perPage}
            onChange={(e) => {
              setPerPage(parseInt(e.target.value, 10));
              setCurrentPage(1);
            }}
            style={{ width: "90px" }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
          </select>
          <label className="mb-0">entries</label>
        </div>

        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Global search..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ maxWidth: 364 }}
        />

        {/* GST Dropdown */}
        <div className="d-flex align-items-center gap-2">
          <label className="mb-0">GST:</label>
          <select
            className="form-select form-select-sm"
            value={gstRate}
            onChange={(e) => setGstRate(Number(e.target.value))}
            style={{ width: "110px" }}
          > <option value={0}>0%</option>
            <option value={2}>2%</option>
            <option value={5}>5%</option>
            <option value={10}>10%</option>
            <option value={12}>12%</option>
            <option value={15}>15%</option>
            <option value={18}>18%</option>
            <option value={20}>20%</option>
            <option value={28}>28%</option>
          </select>
        </div>
      </div>

      {/* ADD: New Row entry form (live-calculative preview) */}
      <div className="card card-body mb-3">
        <div className="row g-2 align-items-end">
          {/* Measurement unit selector */}
          <div className="col-auto">
            <label className="form-label mb-1">Unit</label>
            <select
              className="form-select form-select-sm"
              value={measurementUnit}
              onChange={(e) => setMeasurementUnit(e.target.value)}
            >
              <option value="cm">cm / m² (enter dimensions in cm)</option>
              <option value="sqft">ft / sqft (enter dimensions in ft)</option>
            </select>
          </div>

          <div className="col-auto">
            <label className="form-label mb-1">
              {measurementUnit === "cm" ? "Width (cm)" : "Width (ft)"}
            </label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={newRow.width}
              onChange={(e) => updateNewRowField("width", e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">
              {measurementUnit === "cm" ? "Drop (cm)" : "Drop (ft)"}
            </label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={newRow.drop}
              onChange={(e) => updateNewRowField("drop", e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">NOS</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={newRow.nos}
              onChange={(e) => updateNewRowField("nos", e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Room</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={newRow.room}
              onChange={(e) => updateNewRowField("room", e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Shade</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={newRow.shade}
              onChange={(e) => updateNewRowField("shade", e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Rate (per m²)</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={newRow.rate}
              onChange={(e) => updateNewRowField("rate", e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">GST (%)</label>
            <select
  className="form-select form-select-sm"
  value={String(newRow.gstRate ?? gstRate)}
  onChange={(e) => updateNewRowField("gstRate", e.target.value)}
  style={{ width: 90 }}
>
  <option value="0">0%</option>
  <option value="2">2%</option>
  <option value="5">5%</option>
  <option value="10">10%</option>
  <option value="12">12%</option>
  <option value="15">15%</option>
  <option value="18">18%</option>
  <option value="20">20%</option>
  <option value="28">28%</option>
</select>
          </div>

          {/* Derived preview */}
          <div className="col-auto">
            <label className="form-label mb-1">
              {measurementUnit === "cm" ? "Area (m²)" : "Area (sqft)"}
            </label>
            <input
              type="text"
              readOnly
              className="form-control form-control-sm"
              value={computeRowDerived(newRow).totalArea_display.toFixed(2)}
            />
            {/* show equivalent in m² when sqft is selected */}
            {measurementUnit === "sqft" && (
              <div className="small text-muted">
                (~{computeRowDerived(newRow).totalArea_m2.toFixed(3)} m²)
              </div>
            )}
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Amount</label>
            <input
              type="text"
              readOnly
              className="form-control form-control-sm"
              value={computeRowDerived(newRow).amount.toFixed(2)}
            />
          </div>

          <div className="col-auto">
            <button className="btn btn-sm btn-success" onClick={addRow}>
              Add Row
            </button>
          </div>
        </div>
      </div>
      {/* ADD: ARC / MATERIAL / ITEM selectors (with add-new inputs) */}
      <div className="card card-body mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-auto">
            <label className="form-label mb-1">ARC NO</label>
            <select
              className="form-select form-select-sm"
              value={arcNo}
              onChange={(e) => setArcNo(e.target.value)}
            >
              {arcOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Add ARC</label>
            <div className="d-flex">
              <input
                className="form-control form-control-sm"
                value={newArcInput}
                onChange={(e) => setNewArcInput(e.target.value)}
                placeholder="Enter ARC no"
              />
              <button
                className="btn btn-sm btn-outline-primary ms-2"
                onClick={addArcOption}
              >
                Add
              </button>
            </div>
          </div>

          <div className="col-auto">
            <label className="form-label mb-1">MATERIAL NO</label>
            <select
              className="form-select form-select-sm"
              value={materialNo}
              onChange={(e) => setMaterialNo(e.target.value)}
            >
              {materialOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Add MATERIAL</label>
            <div className="d-flex">
              <input
                className="form-control form-control-sm"
                value={newMaterialInput}
                onChange={(e) => setNewMaterialInput(e.target.value)}
                placeholder="Enter material no"
              />
              <button
                className="btn btn-sm btn-outline-primary ms-2"
                onClick={addMaterialOption}
              >
                Add
              </button>
            </div>
          </div>

          <div className="col-auto">
            <label className="form-label mb-1">ITEM NO</label>
            <select
              className="form-select form-select-sm"
              value={itemNo}
              onChange={(e) => setItemNo(e.target.value)}
            >
              {itemOptions.map((it) => (
                <option key={it} value={it}>
                  {it}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Add ITEM</label>
            <div className="d-flex">
              <input
                className="form-control form-control-sm"
                value={newItemInput}
                onChange={(e) => setNewItemInput(e.target.value)}
                placeholder="Enter item no"
              />
              <button
                className="btn btn-sm btn-outline-primary ms-2"
                onClick={addItemOption}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        highlightOnHover
        responsive
        pagination
        paginationPerPage={perPage}
        paginationRowsPerPageOptions={[5, 10, 20, 30, 40]}
      />

      {/* Totals */}
      <div className="mt-2">
        <div className="d-flex justify-content-between fw-bold">
          {/* Left column: NOS above AREA */}
          <div className="d-flex flex-column">
            <div className="mb-1">NOS: {totals.nos}</div>
            <div>AREA: {totals.area.toFixed(2)}</div>
          </div>

          {/* Right column: Amount above GST above Total (right-aligned) */}
          <div className="d-flex flex-column text-end">
            <div className="mb-1">Amount: {totals.amount.toFixed(2)}</div>
            <div className="mb-1">GST Amt: {totals.gst.toFixed(2)}</div>
            <div>Total Amt: {totals.total.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="text-end text-muted mt-2">Total Items: {totalItems}</div>

      {/* Editable Notes area (REPLACE previous static notes block with this) */}
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-start">
          <h6 className="fw-bold mb-2">NOTE:</h6>

          {/* Buttons: Save / Edit / Add */}
          <div className="d-flex gap-2">
            {isEditingNotes ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={saveNotes}
                >
                  Save Notes
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={addNote}
                >
                  Add Note
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={editNotes}
                >
                  Edit Notes
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={addNote}
                >
                  Add Note
                </button>
              </>
            )}
          </div>
        </div>

        {/* Notes list: either inputs (editing) or plain text (saved) */}
        <div className="mt-2">
          {isEditingNotes
            ? // EDIT MODE: show inputs for each note with serial numbers and delete button
              notes.map((n, idx) => (
                <div
                  className="mb-2 d-flex gap-2 align-items-start"
                  key={`note-edit-${idx}`}
                >
                  <div style={{ minWidth: 42, fontWeight: 600 }}>
                    {String(idx + 1).padStart(2, "0") + "."}
                  </div>

                  <input
                    type="text"
                    className="form-control"
                    value={n}
                    onChange={(e) => updateNote(idx, e.target.value)}
                  />

                  {/* Delete (X) button */}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => deleteNote(idx)}
                    title="Delete note"
                    style={{ marginLeft: 8 }}
                  >
                    &#x2715;
                  </button>
                </div>
              ))
            : // VIEW MODE: show saved notes as stacked lines with serials
              savedNotes.map((n, idx) => (
                <p className="mb-1" key={`note-view-${idx}`}>
                  <span style={{ fontWeight: 600 }}>
                    {String(idx + 1).padStart(2, "0") + " ."}
                  </span>{" "}
                  {n}
                </p>
              ))}
        </div>
      </div>

      {/* Total Fixing */}
      {/* <div className="bg-warning text-dark p-2 mt-3 fw-bold fs-6 text-center rounded">
        Total Amt With Fixing ₹{grandTotal}/-
      </div> */}

      {/* Export */}
      <div className="d-flex gap-3 justify-content-end mt-4">
        <DropdownButton id="export" title="Export" variant="outline-primary">
          <Dropdown.Item
            as={CSVLink}
            data={computedData}
            filename="quotation.csv"
          >
            Download CSV
          </Dropdown.Item>
          <Dropdown.Item onClick={exportToExcel}>Download Excel</Dropdown.Item>
          <Dropdown.Item onClick={exportToPDF}>Download PDF</Dropdown.Item>
        </DropdownButton>
      </div>
    </div>
  );
};

export default QuotationPage;
