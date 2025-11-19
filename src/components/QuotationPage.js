import React, { useState } from "react";
import { Button, DropdownButton, Dropdown } from "react-bootstrap";
import DataTable from "react-data-table-component";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./QuotationPage.css";
import AppLogo from '../App Logo.png';
import ExcelJS from "exceljs/dist/exceljs.min.js"; // use ExcelJS browser build
import { saveAs } from "file-saver";


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
  const [vendorCode, setVendorCode] = useState("");
  const [description, setDescription] = useState(
    "For 100 MM Vertical BLINDS of MAC PRODUCT. (ROLLER)"
  );
  // Editable header / contact / sch / to fields
  const [headerTitle, setHeaderTitle] = useState("SKIPPER CARPET HOUSE");
  const [supplierLine, setSupplierLine] = useState(
    "Supplier of: TISCO, TELCO, TIMKEN, TRF, UCIL, HCL & GOVERNMENT CONCERNS"
  );
  const [email, setEmail] = useState("skippercarpet@gmail.com");
  const [watermarkUrl, setWatermarkUrl] = useState(AppLogo);

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

  
  const formatDateDisplay = (isoDateStr) => {
    if (!isoDateStr) return "";
    const [y, m, d] = isoDateStr.split("-");
    return `${d}.${m}.${y}`;
  };
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [notes, setNotes] = useState([
    "Material will be supplied within 15 days after getting confirmation order.",
    "Payment 20% advance & rest payment after supplying and fixing the blinds at same day.",
    "Fixing charges will be extra 150/- Per Pic",
  ]);

  
  const [savedNotes, setSavedNotes] = useState([...notes]);

  
  const [isEditingNotes, setIsEditingNotes] = useState(true);

  
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
      
      area: derived.totalArea_m2,
      amount: derived.amount,
      gstRate: newRow.gstRate == null ? null : Number(newRow.gstRate), 
      unit: measurementUnit, 
    };

    setTableData((prev) => [...prev, rowToInsert]);

   
    setNewRow({
      width: 100,
      drop: 115,
      nos: 1,
      room: "ROOM",
      shade: "",
      rate: 1500.0,
    });
  };

  
  const deleteRow = (sn) => {
    setTableData((prev) => prev.filter((r) => r.sn !== sn));
  };
  
  const updateRowFieldBySN = (sn, field, value) => {
    setTableData((prev) =>
      prev.map((r) => {
        if (r.sn !== sn) return r;
        
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

  

// Add this helper near other helpers in your file
const dataUrlToBase64 = (dataUrl) => {
  // dataUrl is like "data:image/png;base64,AAAA..."
  const parts = dataUrl.split(",");
  return parts[1]; // base64 part
};

const exportToExcel = async () => {
  try {
    // 1) Build the same rows you had before (or reuse the logic)
    // We'll create a workbook and worksheet, then add rows one-by-one so we can also merge & style.
    const workbook = new ExcelJS.Workbook();
    workbook.creator = headerTitle || "Quotation";
    const sheet = workbook.addWorksheet("Quotation");

    // set default column widths similar to ws["!cols"]
    sheet.columns = [
      { header: "", key: "A", width: 26 }, // col A
      { header: "", key: "B", width: 22 }, // col B
      { header: "", key: "C", width: 12 },
      { header: "", key: "D", width: 15 },
      { header: "", key: "E", width: 14 },
      { header: "", key: "F", width: 12 },
      { header: "", key: "G", width: 22 },
      { header: "", key: "H", width: 14 },
      { header: "", key: "I", width: 12 },
      { header: "", key: "J", width: 14 },
      { header: "", key: "K", width: 18 },
      { header: "", key: "L", width: 12 },
    ];

    // 2) Header rows (mirrors pushRow calls)
    // We'll write to row numbers explicitly so we can merge ranges.
    let r = 1;
    sheet.mergeCells(r, 1, r, 12);
    sheet.getCell(r, 1).value = headerTitle;
    sheet.getCell(r, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(r, 1).font = { bold: true, size: 14 };
    r++;

    sheet.mergeCells(r, 1, r, 12);
    sheet.getCell(r, 1).value = supplierLine;
    sheet.getCell(r, 1).alignment = { horizontal: "center" };
    r++;

    sheet.mergeCells(r, 1, r, 12);
    sheet.getCell(r, 1).value = `E-mail: ${email}`;
    sheet.getCell(r, 1).alignment = { horizontal: "center" };
    r++;

    // blank row
    r++;

    sheet.mergeCells(r, 1, r, 12);
    sheet.getCell(r, 1).value = "QUOTATION";
    sheet.getCell(r, 1).font = { bold: true, size: 12 };
    sheet.getCell(r, 1).alignment = { horizontal: "center" };
    r += 2;

    // SCH and Date similar to your logic
    sheet.getCell(r, 1).value = schNumber || "";
    sheet.getCell(r, 1);
    r++;

    // Date row
    sheet.getCell(r, 1).value = "DT";
    sheet.getCell(r, 2).value = `${formatDateDisplay(date)}`;
    r++;

    // Vendor Code row (NEW: inserted below DT)
    sheet.getCell(r, 1).value = "VENDOR CODE:";
    sheet.getCell(r, 2).value = vendorCode || "";
    r++;

    // TO block
    sheet.getCell(r, 1).value = "TO:";
    sheet.getCell(r, 1).font = { bold: true };
    sheet.getCell(r, 2).value = toName;
    r++;
    sheet.getCell(r, 2).value = toLocation;
    r++;
    r++;

    // Description
    sheet.getCell(r, 1).value = "Description:";
    sheet.getCell(r, 1).font = { bold: true };
    sheet.mergeCells(r, 2, r, 12);
    sheet.getCell(r, 2).value = description;
    r += 2;

    // ARC / MATERIAL / ITEM row
    sheet.getCell(r, 1).value = "ARC NO:";
    sheet.getCell(r, 2).value = arcNo;
    sheet.getCell(r, 4).value = "MATERIAL NO:";
    sheet.getCell(r, 5).value = materialNo;
    sheet.getCell(r, 7).value = "ITEM NO:";
    sheet.getCell(r, 8).value = itemNo;
    r += 2;

    // Table header row - match your tableHeader
    const headerRowValues = [
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
      "TOTAL AMT",
    ];
    sheet.getRow(r).values = headerRowValues;
    sheet.getRow(r).font = { bold: true };
    sheet.getRow(r).alignment = { horizontal: "center" };
    r++;

    // Add the computedData rows
    computedData.forEach((rd) => {
      const gstPercent = rd.gstRate == null ? gstRate : rd.gstRate;
      const rowVals = [
        rd.sn,
        rd.width,
        rd.drop,
        rd.nos,
        rd.room,
        Number(rd.area.toFixed(2)),
        rd.shade,
        Number(rd.rate.toFixed(2)),
        Number(gstPercent.toFixed(2)),
        Number(rd.gst.toFixed(2)),
        Number(rd.amount.toFixed(2)),
        Number(rd.total.toFixed(2)),
      ];
      sheet.getRow(r).values = rowVals;

      // optional formatting for numeric columns
      sheet.getCell(r, 6).numFmt = "0.00"; // AREA
      sheet.getCell(r, 8).numFmt = "0.00"; // RATE
      sheet.getCell(r, 9).numFmt = "0.00"; // GST %
      sheet.getCell(r, 10).numFmt = "0.00"; // GST amt
      sheet.getCell(r, 11).numFmt = "0.00"; // AMOUNT
      sheet.getCell(r, 12).numFmt = "0.00"; // TOTAL

      r++;
    });

    // Blank row then totals (similar to your previous rows)
    r++;
    const nosRow = sheet.getRow(r);
    nosRow.getCell(1).value = "Total NOS";
    nosRow.getCell(1).font = { bold: true };
    nosRow.getCell(2).value = totals.nos;
    nosRow.getCell(10).value = "Amount";
    nosRow.getCell(10).font = { bold: true };
    nosRow.getCell(11).value = Number(totals.amount.toFixed(2));
    r++;

    const areaRow = sheet.getRow(r);
    areaRow.getCell(1).value = "Total Area (m2)";
    areaRow.getCell(1).font = { bold: true };
    areaRow.getCell(2).value = Number(totals.area.toFixed(2));
    areaRow.getCell(10).value = "GST Amt";
    areaRow.getCell(10).font = { bold: true };
    areaRow.getCell(11).value = Number(totals.gst.toFixed(2));
    r++;

    r++;
    const totalRow = sheet.getRow(r);
    totalRow.getCell(10).value = "Total Amt";
    totalRow.getCell(10).font = { bold: true };
    totalRow.getCell(11).value = Number(totals.total.toFixed(2));
    r += 2;

    // NOTES - write saved notes if present
    const notesToWrite = savedNotes && savedNotes.length ? savedNotes : notes;
    if (notesToWrite && notesToWrite.length) {
      sheet.mergeCells(r, 1, r, 12);
      sheet.getCell(r, 1).value = "NOTE:";
      sheet.getCell(r, 1).font = { bold: true };
      r++;
      notesToWrite.forEach((nText, idx) => {
        sheet.mergeCells(r, 1, r, 12);
        sheet.getCell(r, 1).value = `${String(idx + 1).padStart(2, "0")}. ${nText}`;
        r++;
      });
    }

    // 3) Now embed watermark image (if watermarkUrl is provided)
    if (watermarkUrl) {
      // create semi-transparent data URL using your existing helper
      const wmDataUrl = await createImageDataUrlWithOpacity(watermarkUrl, 0.12);
      const base64 = dataUrlToBase64(wmDataUrl);

      // Determine extension from dataURL
      const ext = wmDataUrl.startsWith("data:image/png") ? "png" : "jpeg";

      // workbook.addImage accepts base64 string + extension
      const imageId = workbook.addImage({
        base64: base64,
        extension: ext,
      });

      // place the image roughly centered across the sheet's printable area:
      // We'll place from cell B3 to J20 (example) - adjust as needed.
      // You can compute ext.width/height in pixels; here we use ext to cover many cells.
      sheet.addImage(imageId, {
        tl: { col: 1, row: 3 }, // top-left cell index where image starts (0-based)
        ext: { width: 1100, height: 600 }, // pixel width/height - adjust to taste
        editAs: "absolute",
      });
    }

    // 4) Finalize workbook to buffer and save using file-saver
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/octet-stream" });
    saveAs(blob, "quotation.xlsx");
  } catch (err) {
    console.error("ExcelJS export failed:", err);
    // fallback: call existing exportToExcel that uses SheetJS if needed
    exportToExcel();
  }
};


const createImageDataUrlWithOpacity = (url, opacity = 0.12) => {
  
  return new Promise((resolve, reject) => {
    
    const img = new Image();
    
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = opacity; // set desired opacity here (0.0 - 1.0)
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(new Error("Failed to load watermark image: " + e));
    img.src = url;
    
  });
};

  const exportToPDF = async () => {
  const doc = new jsPDF();

  // Header - centered
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(headerTitle, 105, 15, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const supplierLines = doc.splitTextToSize(supplierLine, 180);
  doc.text(supplierLines, 105, 21, { align: "center" });
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

  // Vendor Code (inserted below DT)
  doc.text(`Vendor Code: ${vendorCode || ""}`, 15, 56);

  // TO block
  doc.setFont("helvetica", "bold");
  doc.text("TO:", 15, 61);
  doc.setFont("helvetica", "normal");
  doc.text(toName, 15, 67);
  doc.text(toLocation, 15, 73);

  // Description
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Description: ", 15, 79);
  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(description, 180);
  doc.text(descLines, 36, 79);

  // ARC / MATERIAL / ITEM
  doc.setFontSize(10);
  doc.text(`ARC NO: ${arcNo}`, 15, 86);
  doc.text(`MATERIAL NO: ${materialNo}`, 90, 86);
  doc.text(`ITEM NO: ${itemNo}`, 160, 86);

  // Table head + body for autoTable
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
      "TOTAL AMT",
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
    (r.gstRate == null ? gstRate : r.gstRate).toFixed(2),
    r.gst.toFixed(2),
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
      3: { halign: "center" },
      5: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
      11: { halign: "right" },
    },
  });

  // where table ended
  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 92;
  finalY += 8;

  // Left totals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total NOS: ${totals.nos}`, 14, finalY + 10);
  doc.text(`Total Area: ${totals.area.toFixed(2)}`, 14, finalY + 18);

  // Right totals
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

  // NOTES
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

  
  if (watermarkUrl) {
    try {
      
      const wmDataUrl = await createImageDataUrlWithOpacity(watermarkUrl, 0.12);

      
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();

        
        const targetWidth = pw * 1;
        
        const targetHeight = targetWidth * 0.6;

        const x = (pw - targetWidth) / 2;
        const y = (ph - targetHeight) / 2;

        try {
          doc.addImage(wmDataUrl, "PNG", x, y, targetWidth, targetHeight, undefined, "FAST");
        } catch (addErr) {
          
          try {
            doc.addImage(wmDataUrl, "JPEG", x, y, targetWidth, targetHeight, undefined, "FAST");
          } catch (e) {
            
            console.warn("Failed to add watermark image to page", e);
          }
        }
      }
    } catch (err) {
      
      console.warn("Watermark creation failed, skipping watermark:", err);
    }
  }
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
      name: "TOTAL AMT",
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
        <div className="mb-2 d-flex align-items-center gap-2">
          <label className="mb-0">Vendor Code:</label>
          <input
            type="text"
            className="form-control form-control-sm d-inline-block"
            style={{ width: "220px" }}
            value={vendorCode}
            onChange={(e) => setVendorCode(e.target.value)}
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
            <div className="mb-1">Total NOS: {totals.nos}</div>
            <div>Total Area: {totals.area.toFixed(2)}</div>
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
