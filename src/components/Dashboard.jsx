// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { getEnteredUsers, getGiftUsers } from "../lib/supabaseClient";
import "./Dashboard.css"; // add the CSS below or merge into your main stylesheet

const PAGE_SIZE = 10;

const Dashboard = () => {
  // mode: "entered" or "gift"
  const [mode, setMode] = useState("entered");

  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [order, setOrder] = useState("desc");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      let res;
      if (mode === "entered") {
        res = await getEnteredUsers(page, PAGE_SIZE, sortBy, order);
      } else {
        res = await getGiftUsers(page, PAGE_SIZE, sortBy, order);
      }

      if (!res || res.success === false) {
        setError(res?.error ?? "Failed to fetch data");
        setRows([]);
        setCount(0);
      } else {
        setRows(res.data || []);
        setCount(res.count ?? 0);
      }
    } catch (e) {
      console.error("fetchData exception:", e);
      setError(e);
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  // fetch when mode/page/sort change
  useEffect(() => {
    setPage(1); // when mode changes, reset to page 1
  }, [mode]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page, sortBy, order]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setOrder("desc"); // default new column to desc
    }
  };

  const onPrev = () => setPage((p) => Math.max(1, p - 1));
  const onNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goTo = (n) => setPage(() => Math.min(Math.max(1, n), totalPages));

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <h2>Dashboard</h2>
        <div className="dashboard-controls">
          <div className="mode-toggle" role="tablist" aria-label="Select view">
            <button
              className={`mode-btn ${mode === "entered" ? "active" : ""}`}
              onClick={() => setMode("entered")}
              role="tab"
              aria-selected={mode === "entered"}
            >
              Entered
            </button>
            <button
              className={`mode-btn ${mode === "gift" ? "active" : ""}`}
              onClick={() => setMode("gift")}
              role="tab"
              aria-selected={mode === "gift"}
            >
              Gift
            </button>
          </div>

          <div className="page-info">
            <strong>{count}</strong> total
          </div>
        </div>
      </header>

      <div className="dashboard-table-wrap">
        {loading ? (
          <div className="table-loading">Loading…</div>
        ) : error ? (
          <div className="table-error">Error: {String(error)}</div>
        ) : (
          <>
            <table
              className="dashboard-table"
              role="table"
              aria-label="Users table"
            >
              <thead>
                <tr>
                  <th
                    onClick={() => toggleSort("name")}
                    role="columnheader"
                    scope="col"
                  >
                    Name{" "}
                    {sortBy === "name" ? (order === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    onClick={() => toggleSort("uniqueId")}
                    role="columnheader"
                    scope="col"
                  >
                    Unique ID{" "}
                    {sortBy === "uniqueId" ? (order === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    onClick={() => toggleSort("created_at")}
                    role="columnheader"
                    scope="col"
                  >
                    Created{" "}
                    {sortBy === "created_at"
                      ? order === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </th>
                  <th role="columnheader" scope="col">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      style={{ textAlign: "center", padding: "18px 8px" }}
                    >
                      No records
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Name">{r.name ?? "-"}</td>
                      <td data-label="Unique ID">{r.uniqueId ?? r.id}</td>
                      <td data-label="Created">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td data-label="Status">
                        {mode === "entered"
                          ? r.isEntered
                            ? "Entered"
                            : "—"
                          : r.isHuddy
                          ? "Gifted"
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* pagination */}
            <div className="pagination">
              <button
                onClick={onPrev}
                className="page-btn"
                disabled={page === 1}
              >
                Prev
              </button>

              {/* pages (show a small window of pages) */}
              <div className="page-numbers" aria-hidden>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  // show only a window around current page
                  if (
                    totalPages <= 7 ||
                    Math.abs(p - page) <= 2 ||
                    p === 1 ||
                    p === totalPages
                  ) {
                    return (
                      <button
                        key={p}
                        onClick={() => goTo(p)}
                        className={`page-num ${p === page ? "active" : ""}`}
                        aria-current={p === page ? "page" : undefined}
                      >
                        {p}
                      </button>
                    );
                  }
                  // show ellipsis only once (simple approach)
                  if (p === 2 && page > 4)
                    return (
                      <span key="dots-left" className="dots">
                        …
                      </span>
                    );
                  if (p === totalPages - 1 && page < totalPages - 3)
                    return (
                      <span key="dots-right" className="dots">
                        …
                      </span>
                    );
                  return null;
                })}
              </div>

              <button
                onClick={onNext}
                className="page-btn"
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
