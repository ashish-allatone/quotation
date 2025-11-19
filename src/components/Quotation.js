import React, { useState } from "react";
import DataTable from "react-data-table-component";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button, Dropdown, DropdownButton } from "react-bootstrap";
import "./Quotation.css";

const Quotation = () => {
  const [depot, setDepot] = useState("1 Field Ord Depot");
  const [filterText, setFilterText] = useState("");

  const data = [
    {
      demandNo: "TS/SA/25/2018",
      demandDate: "20180704",
      cosSec: "C1",
      partNumber: "5220-000218",
      nomenclature:
        "GAUGE ARMOURERS PLUG .302-IN 1A REJ DIA OF BARREL BORE",
      au: "NOS",
      qtyDemanded: "1.000",
      issued: "0",
      duesout: "1.000",
      controlNumber: "193900039",
      ctrlDate: "20190603",
      expiryDate: "20210531",
      demandType: "OTHERS",
      ordDepot: "1 FIELD ORD DEPOT",
    },
    {
      demandNo: "TS/SA/26",
      demandDate: "20180704",
      cosSec: "C1",
      partNumber: "5220-001099",
      nomenclature: "GAUGE ARMOURERS HEADSPACE 1.645-IN MK 2#",
      au: "NOS",
      qtyDemanded: "1.000",
      issued: "0",
      duesout: "1.000",
      controlNumber: "193900041",
      ctrlDate: "20190603",
      expiryDate: "20210531",
      demandType: "OTHERS",
      ordDepot: "1 FIELD ORD DEPOT",
    },
    {
      demandNo: "SMT/51",
      demandDate: "20180806",
      cosSec: "B2",
      partNumber: "5220-000137",
      nomenclature: "GAUGE ARMOURERS HEADSPACE 1.643-IN REJECT",
      au: "NOS",
      qtyDemanded: "1.000",
      issued: "0",
      duesout: "1.000",
      controlNumber: "183901938",
      ctrlDate: "20190322",
      expiryDate: "20210319",
      demandType: "OTHERS",
      ordDepot: "1 FIELD ORD DEPOT",
    },
  ];

  const columns = [
    { name: "Demand No", selector: (row) => row.demandNo, sortable: true },
    { name: "Demand Date", selector: (row) => row.demandDate, sortable: true },
    { name: "COS Sec", selector: (row) => row.cosSec },
    { name: "Part Number", selector: (row) => row.partNumber },
    { name: "Nomenclature", selector: (row) => row.nomenclature },
    { name: "A/U", selector: (row) => row.au },
    { name: "Qty Demanded", selector: (row) => row.qtyDemanded },
    { name: "Issued", selector: (row) => row.issued },
    { name: "Duesout", selector: (row) => row.duesout },
    { name: "Control Number", selector: (row) => row.controlNumber },
    { name: "Ctrl Date", selector: (row) => row.ctrlDate },
    { name: "Expiry Date", selector: (row) => row.expiryDate },
    { name: "Demand Type", selector: (row) => row.demandType },
    { name: "Ord_Depot", selector: (row) => row.ordDepot },
  ];

  const filteredData = data.filter(
    (item) =>
      item.demandNo.toLowerCase().includes(filterText.toLowerCase()) ||
      item.nomenclature.toLowerCase().includes(filterText.toLowerCase())
  );

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotation");
    XLSX.writeFile(wb, "quotation.xlsx");
  };

  const exportToPDF = () => {
  const doc = new jsPDF();
  doc.text("Quotation Table", 14, 10);

  const tableColumn = columns.map((col) => col.name);
  const tableRows = filteredData.map((row) =>
    columns.map((col) => col.selector(row))
  );

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 20,
  });

  doc.save("quotation.pdf");
};


  return (
    <div className="container-fluid quotation-container">
      <h2 className="hello">Demand Controlled</h2>

      <div className="row mb-3 g-3">
        <div className="col-md-3">
          <label className="form-label">Depot:</label>
          <DropdownButton
            title={depot}
            className="w-100"
            variant="primary"
            onSelect={(val) => setDepot(val)}
          >
            <Dropdown.Item eventKey="1 Field Ord Depot">
              1 Field Ord Depot
            </Dropdown.Item>
            <Dropdown.Item eventKey="Depot 2">Depot 2</Dropdown.Item>
            <Dropdown.Item eventKey="Depot 3">Depot 3</Dropdown.Item>
          </DropdownButton>
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-start gap-3 mb-3">
        <Button variant="primary">List of Items</Button>
        <span className="text-muted fw-semibold">
          (Total No of Items = {filteredData.length})
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex gap-2">
          <DropdownButton id="export" title="Export" variant="outline-primary">
            <Dropdown.Item as={CSVLink} data={filteredData} filename="quotation.csv">
              Download CSV
            </Dropdown.Item>
            <Dropdown.Item onClick={exportToExcel}>Download Excel</Dropdown.Item>
            <Dropdown.Item onClick={exportToPDF}>Download PDF</Dropdown.Item>
          </DropdownButton>
        </div>

        <div className="input-group" style={{ width: "300px" }}>
          <span className="input-group-text">🔎</span>
          <input
            type="text"
            className="form-control"
            placeholder="Search..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      <div className="table-fixed">
        <DataTable
          columns={columns}
          data={filteredData}
          pagination
          highlightOnHover
          dense
          striped
        />
      </div>
    </div>
  );
};

export default Quotation;
