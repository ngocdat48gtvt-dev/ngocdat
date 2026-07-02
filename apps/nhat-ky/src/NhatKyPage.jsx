import React, { useState } from "react";

import { AgGridReact } from "ag-grid-react";
import ViDateInput from "./components/ViDateInput";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

export default function NhatKyPage() {

  const [selectedDate, setSelectedDate] =
    useState(
      new Date()
        .toISOString()
        .split("T")[0]
    );

  const allData = [
    {
      date: "2025-08-07",
      km: "Km359+300",
      content: "Ổ gà mặt đường",
      solution: "Vá ổ gà"
    },

    {
      date: "2025-08-07",
      km: "Km360+200",
      content: "Cỏ che khuất biển báo",
      solution: "Phát cỏ"
    },

    {
      date: "2025-08-08",
      km: "Km361+100",
      content: "Sạt lề đường",
      solution: "Đắp lề"
    }
  ];

  const rowData = allData.filter(
    item => item.date === selectedDate
  );

  function prevDay() {

    const d = new Date(selectedDate);

    d.setDate(d.getDate() - 1);

    setSelectedDate(
      d.toISOString().split("T")[0]
    );
  }

  function nextDay() {

    const d = new Date(selectedDate);

    d.setDate(d.getDate() + 1);

    setSelectedDate(
      d.toISOString().split("T")[0]
    );
  }

  const columnDefs = [

    {
      field: "date",
      headerName: "Ngày",
      flex: 1
    },

    {
      field: "km",
      headerName: "Lý trình",
      flex: 1
    },

    {
      field: "content",
      headerName: "Nội dung phát hiện",
      flex: 2
    },

    {
      field: "solution",
      headerName: "Biện pháp",
      flex: 2
    }
  ];

  return (
    <div style={{ padding: 20 }}>

      <h1
        style={{
          textAlign: "center",
          marginBottom: 20
        }}
      >
        SỔ NHẬT KÝ TUẦN ĐƯỜNG
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          marginBottom: 20
        }}
      >

        <button
          onClick={prevDay}
          style={{
            width: 40,
            height: 40,
            border: "none",
            borderRadius: 6,
            background: "#2563eb",
            color: "white",
            fontSize: 18,
            cursor: "pointer"
          }}
        >
          ◀
        </button>

        <ViDateInput
          value={selectedDate}
          onChange={setSelectedDate}
          className="sidebar-input"
          aria-label="Chọn ngày"
        />

        <button
          onClick={nextDay}
          style={{
            width: 40,
            height: 40,
            border: "none",
            borderRadius: 6,
            background: "#2563eb",
            color: "white",
            fontSize: 18,
            cursor: "pointer"
          }}
        >
          ▶
        </button>

      </div>

      <div
        className="ag-theme-alpine"
        style={{
          height: 500,
          width: "100%"
        }}
      >

        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
        />

      </div>

    </div>
  );
}
export default NhatKyPage;