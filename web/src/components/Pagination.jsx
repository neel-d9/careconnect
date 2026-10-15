import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems,
  pageSize = 10,
  onPageSizeChange,
}) {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = totalItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;

  return (
    <div className="pagination-bar">
      {totalItems != null ? (
        <div className="pagination-info-group">
          <span className="pagination-info">
            Showing {startIdx}–{endIdx} of {totalItems}
          </span>
          {onPageSizeChange && (
            <div className="rows-per-page-wrap">
              <select
                className="rows-select"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
              >
                <option value={7}>Rows: 7</option>
                <option value={10}>Rows: 10</option>
                <option value={20}>Rows: 20</option>
              </select>
            </div>
          )}
        </div>
      ) : <span />}
      <div className="pagination-actions">
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft size={15} /> Prev
        </button>

        <div className="pagination-pages">
          {Array.from({ length: totalPages }).map((_, i) => {
            const pageNum = i + 1;
            if (
              totalPages > 7 &&
              Math.abs(pageNum - currentPage) > 2 &&
              pageNum !== 1 &&
              pageNum !== totalPages
            ) {
              if (pageNum === 2 || pageNum === totalPages - 1) {
                return (
                  <span key={pageNum} className="pagination-ellipsis">
                    …
                  </span>
                );
              }
              return null;
            }

            return (
              <button
                key={pageNum}
                type="button"
                className={`pagination-num ${pageNum === currentPage ? "active" : ""}`}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
