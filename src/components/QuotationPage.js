import React, { useState } from "react";
import { Button, DropdownButton, Dropdown } from "react-bootstrap";
import DataTable from "react-data-table-component";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./QuotationPage.css";

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
    },
  ];

  const [tableData, setTableData] = useState(initialTableData);

  const grandTotal = 17370; // with fixing charge
  const [gstRate, setGstRate] = useState(12); // default GST 12%

  // REPLACE computedData mapping with this derived calculation
  const computedData = tableData.map((r, idx) => {
    const width = Number(r.width || 0);
    const drop = Number(r.drop || 0);
    const nos = Number(r.nos || 0);
    const rate = Number(r.rate || 0);

    const areaPerItem = (width / 100) * (drop / 100); // m^2
    const totalArea = areaPerItem * nos;
    const amount = totalArea * rate;

    const gst = parseFloat((amount * (gstRate / 100)).toFixed(2));
    const total = parseFloat((amount + gst).toFixed(2));

    return {
      ...r,
      sn: r.sn ?? idx + 1,
      width,
      drop,
      nos,
      room: r.room,
      area: parseFloat(totalArea.toFixed(2)), // total area (m^2)
      rate,
      amount: parseFloat(amount.toFixed(2)),
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
  const [date, setDate] = useState("2025-10-12");
  const [description, setDescription] = useState(
    "For 100 MM Vertical BLINDS of MAC PRODUCT. (ROLLER)"
  );
  const [newRow, setNewRow] = useState({
    width: 100,
    drop: 115,
    nos: 1,
    room: "ROOM",
    shade: "",
    rate: 1500.0,
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
    if (["width", "drop", "nos", "rate"].includes(field)) {
      const num = Number(value || 0);
      setNewRow((prev) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
    } else {
      setNewRow((prev) => ({ ...prev, [field]: value }));
    }
  };

  // compute derived preview for the newRow (area & amount)
  const computeRowDerived = (row) => {
    const width = Number(row.width || 0);
    const drop = Number(row.drop || 0);
    const nos = Number(row.nos || 0);
    const rate = Number(row.rate || 0);

    const areaPerItem = (width / 100) * (drop / 100); // m^2 per item
    const totalArea = areaPerItem * nos;
    const amount = totalArea * rate;

    return {
      areaPerItem: parseFloat(areaPerItem.toFixed(4)),
      totalArea: parseFloat(totalArea.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)),
    };
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
    // if you want the deleted note to immediately reflect in savedNotes when not editing,
    // uncomment the next line:
    // setSavedNotes(prev => prev.filter((_, i) => i !== index));
  };

  const addNote = () => {
    setNotes((prev) => [...prev, ""]);
    setIsEditingNotes(true);
  };

  const saveNotes = () => {
    // filter out blank trailing lines if you want: keep as-is so user decides
    setSavedNotes([...notes]);
    setIsEditingNotes(false);
  };

  const editNotes = () => {
    setIsEditingNotes(true);
    // keep notes array as-is so user can edit previously saved notes
  };

  const filteredData = computedData.filter((item) => {
    const combined = Object.values(item).join(" ").toLowerCase();
    return combined.includes(filterText.toLowerCase());
  });

  const totalItems = filteredData.length;

  // ADD: add new row to tableData
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
      area: derived.totalArea,
      amount: derived.amount,
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

  // ------------------ EXPORT FUNCTIONS ------------------
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(computedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotation");
    XLSX.writeFile(wb, "quotation.xlsx");
  };

  const exportToPDF = () => {
  const doc = new jsPDF();

  // Header - centered
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SKIPPER CARPET HOUSE", 105, 15, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Supplier of: TISCO, TELCO, TIMKEN, TRF, UCIL, HCL & GOVERNMENT CONCERNS",
    105,
    21,
    { align: "center" }
  );
  doc.text("E-mail: skippercarpet@gmail.com", 105, 27, { align: "center" });

  // QUOTATION centered
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", 105, 36, { align: "center" });

  // SCH/QTN left, DT right
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SCH/QTN 1859/2025-26", 15, 45);
  doc.text("DT: " + formatDateDisplay(date), 15, 51);

  // TO block
  doc.setFont("helvetica", "bold");
  doc.text("TO:", 15, 57);
  doc.setFont("helvetica", "normal");
  doc.text("TCI LTD TRANSPORT", 15, 63);
  doc.text("JAMSHEDPUR", 15, 69);

  // Description label and text
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Description: ", 15, 77);
  doc.setFont("helvetica", "normal");
  // use splitTextToSize in case description is long
  const descLines = doc.splitTextToSize(description, 180);
  doc.text(descLines, 36, 77);

  // ARC / MATERIAL / ITEM line (below description)
  doc.setFontSize(10);
  doc.text(`ARC NO: ${arcNo}`, 15, 86);
  doc.text(`MATERIAL NO: ${materialNo}`, 90, 86);
  doc.text(`ITEM NO: ${itemNo}`, 160, 86);

  // Table head + body
  const head = [
    ["SN", "WIDTH", "DROP", "NOS", "ROOM", "AREA", "SHADE", "RATE", "AMOUNT", `G.S.T. ${gstRate}% AMT`, "TOTAL"],
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
    r.amount.toFixed(2),
    r.gst.toFixed(2),
    r.total.toFixed(2),
  ]);

  // add grand total as last row in body (already present in your code earlier)
  // body.push([
  //   "GRAND TOTAL",
  //   "",
  //   "",
  //   totals.nos,
  //   "",
  //   totals.area.toFixed(2),
  //   "",
  //   "",
  //   totals.amount.toFixed(2),
  //   totals.gst.toFixed(2),
  //   totals.total.toFixed(2),
  // ]);

  // Draw table with numeric columns right-aligned and bold last row
  autoTable(doc, {
    startY: 92,
    head: head,
    body: body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { textColor: [0, 0, 0], fillColor: [255, 255, 255] },
    columnStyles: {
      3: { halign: "center" }, // NOS center
      5: { halign: "right" },  // AREA
      7: { halign: "right" },  // RATE
      8: { halign: "right" },  // AMOUNT
      9: { halign: "right" },  // GST
      10:{ halign: "right" },  // TOTAL
    },
    didParseCell: function (data) {
      if (data.section === "body" && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "";
      }
    },
  });

  // After table: put small summary on left and financial totals on right, then notes
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
  doc.text(`Amount: ${totals.amount.toFixed(2)}`, rightX, finalY + 10, { align: "right" });
  doc.text(`GST Amt: ${totals.gst.toFixed(2)}`, rightX, finalY + 18, { align: "right" });
  doc.text(`Total Amt: ${totals.total.toFixed(2)}`, rightX, finalY + 26, { align: "right" });

  // NOTES below
  const notesStartY = finalY + 40;
  doc.setFont("helvetica", "bold");
  doc.text("NOTE:", 14, notesStartY);
  doc.setFont("helvetica", "normal");
  const notesToWrite = savedNotes && savedNotes.length ? savedNotes : notes;
  let offset = 6;
  notesToWrite.forEach((noteText, idx) => {
    const lineY = notesStartY + offset + idx * 6;
    const prefix = String(idx + 1).padStart(2, "0") + ". ";
    doc.text(prefix + noteText, 20, lineY);
  });

  // Final footer total (if needed)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  // you can place this above or below notes; adjust Y if needed
  doc.text(`Total Amt With Fixing ${grandTotal}/-`, 14, notesStartY + 6 + notesToWrite.length * 6 + 14);

  doc.save("quotation.pdf");
};



  // ------------------ TABLE COLUMNS ------------------
  const columns = [
    { name: "SN", selector: (row) => row.sn, sortable: true, width: "70px" },
    { name: "WIDTH", selector: (row) => row.width },
    { name: "DROP", selector: (row) => row.drop },
    { name: "NOS", selector: (row) => row.nos },
    { name: "ROOM", selector: (row) => row.room },
    {
      name: "AREA",
      selector: (row) => row.area,
      format: (row) => row.area.toFixed(2),
    },
    { name: "SHADE", selector: (row) => row.shade },
    {
      name: "RATE",
      selector: (row) => row.rate,
      format: (row) => row.rate.toFixed(2),
    },
    {
      name: "AMOUNT",
      selector: (row) => row.amount,
      format: (row) => row.amount.toFixed(2),
    },
    {
      name: `G.S.T. ${gstRate}% AMT`,
      selector: (row) => row.gst,
      format: (row) => row.gst.toFixed(2),
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
        <h4 className="fw-bold text-uppercase">SKIPPER CARPET HOUSE</h4>
        <p className="small">
          Supplier of: TISCO, TELCO, TIMKEN, TRF, UCIL, HCL & GOVERNMENT
          CONCERNS
        </p>
        <p className="small fw-semibold">
          E-mail: <span className="text-primary">skippercarpet@gmail.com</span>
        </p>
      </div>

      <h5 className="text-center mb-3 text-decoration-underline fw-bold">
        QUOTATION
      </h5>

      {/* SCH/QTN with DT in-place, and TO stacked under SCH */}
      <div className="mb-2">
        <p className="mb-1">SCH/QTN 1859/2025-26</p>

        {/* DT stays at its original place (immediately under SCH). It's now a date picker. */}
        <div className="mb-2 d-flex align-items-center gap-2">
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
          <p className="mb-1 fw-bold">TO:</p>
          <p className="mb-1">TCI LTD TRANSPORT</p>
          <p className="mb-1">JAMSHEDPUR</p>
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
          >
            <option value={2}>2%</option>
            <option value={5}>5%</option>
            <option value={10}>10%</option>
            <option value={12}>12%</option>
            <option value={15}>15%</option>
            <option value={18}>18%</option>
            <option value={20}>20%</option>
          </select>
        </div>
      </div>

      {/* ADD: New Row entry form (live-calculative preview) */}
      <div className="card card-body mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-auto">
            <label className="form-label mb-1">Width (cm)</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={newRow.width}
              onChange={(e) => updateNewRowField("width", e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="form-label mb-1">Drop (cm)</label>
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

          {/* Derived preview */}
          <div className="col-auto">
            <label className="form-label mb-1">Area (m²)</label>
            <input
              type="text"
              readOnly
              className="form-control form-control-sm"
              value={computeRowDerived(newRow).totalArea.toFixed(2)}
            />
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
      <div className="bg-warning text-dark p-2 mt-3 fw-bold fs-6 text-center rounded">
        Total Amt With Fixing ₹{grandTotal}/-
      </div>

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
