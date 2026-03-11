import React, {
  useState,
  useRef,
  useCallback,
  forwardRef,
  useEffect,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import HTMLFlipBook from "react-pageflip";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker — must happen in the same module that uses <Document>
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ---------- per-page loading spinner ----------
function PageLoader({ width, height }) {
  return (
    <div className="page-loader" style={{ width, height }}>
      <div className="spinner" />
      <span>Loading…</span>
    </div>
  );
}

// ---------- single flip-page wrapper (must forwardRef for react-pageflip) ----------
const FlipPage = React.memo(
  forwardRef(({ pageNumber, width, height, shouldRender }, ref) => (
    <div ref={ref} className="flip-page">
      {shouldRender ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          loading={<PageLoader width={width} height={height} />}
        />
      ) : (
        <PageLoader width={width} height={height} />
      )}
    </div>
  ))
);
FlipPage.displayName = "FlipPage";

// ---------- responsive page dimensions ----------
function usePageSize() {
  const compute = () => {
    const vw = window.innerWidth;
    const w = Math.min(vw * 0.35, 420);
    return { width: Math.round(w), height: Math.round(w * 1.414) };
  };

  const [size, setSize] = useState(compute);

  useEffect(() => {
    const onResize = () => setSize(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

// How far ahead/behind to pre-render
const PRELOAD_RANGE = 15;
// How many pages to activate per batch tick
const BATCH_SIZE = 3;
// Delay between batches (ms)
const BATCH_DELAY = 60;

// ---------- main component ----------
export default function FlipbookViewer({ file }) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [readyPages, setReadyPages] = useState(new Set());
  const flipBookRef = useRef(null);
  const { width, height } = usePageSize();

  const onDocumentLoadSuccess = useCallback(({ numPages: n }) => {
    setNumPages(n);
    setCurrentPage(0);
    setReadyPages(new Set());
  }, []);

  // Progressive pre-loading: whenever currentPage or numPages changes,
  // schedule pages around the current view in batches (nearest first).
  // Pages already in readyPages are never removed — they stay rendered.
  useEffect(() => {
    if (!numPages) return;

    // Build a list of page indices we want rendered, sorted nearest-first
    const targets = [];
    for (let i = 0; i < numPages; i++) {
      if (Math.abs(i - currentPage) <= PRELOAD_RANGE) {
        targets.push(i);
      }
    }
    targets.sort((a, b) => Math.abs(a - currentPage) - Math.abs(b - currentPage));

    let idx = 0;
    let timer;

    const loadBatch = () => {
      // Slice the next batch of targets BEFORE entering the state updater
      const batch = targets.slice(idx, idx + BATCH_SIZE);
      idx += BATCH_SIZE;

      if (batch.length > 0) {
        setReadyPages((prev) => {
          const next = new Set(prev);
          batch.forEach((p) => next.add(p));
          return next;
        });
      }

      if (idx < targets.length) {
        timer = setTimeout(loadBatch, BATCH_DELAY);
      }
    };

    loadBatch();
    return () => clearTimeout(timer);
  }, [currentPage, numPages]);

  const onFlip = useCallback((e) => {
    setCurrentPage(e.data);
  }, []);

  const flipPrev = () => flipBookRef.current?.pageFlip()?.flipPrev();
  const flipNext = () => flipBookRef.current?.pageFlip()?.flipNext();

  const isCover = currentPage === 0;
  const isBackCover =
    numPages && numPages > 1 && currentPage === numPages - 1 && (numPages - 1) % 2 === 0;
  const isSinglePage = isCover || isBackCover;

  return (
    <div className="flipbook-container">
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<p className="loading-text">Loading PDF…</p>}
        error={<p className="loading-text">Failed to load PDF.</p>}
      >
        {numPages && (
          <div className="book-stage">
            {/* ---- left arrow ---- */}
            <button
              className="nav-arrow nav-arrow--left"
              onClick={flipPrev}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              &#10094;
            </button>

            {/* ---- flipbook ---- */}
            <div
              className="flipbook-wrapper"
              style={{
                transform: isSinglePage ? `translateX(-${width / 2}px)` : "none",
                transition: "transform 0.35s ease",
              }}
            >
              <HTMLFlipBook
                ref={flipBookRef}
                width={width}
                height={height}
                showCover={true}
                flippingTime={600}
                usePortrait={false}
                mobileScrollSupport={false}
                onFlip={onFlip}
                className="flipbook"
                drawShadow={true}
                maxShadowOpacity={0.35}
              >
                {Array.from({ length: numPages }, (_, i) => (
                  <FlipPage
                    key={i}
                    pageNumber={i + 1}
                    width={width}
                    height={height}
                    shouldRender={readyPages.has(i)}
                  />
                ))}
              </HTMLFlipBook>
            </div>

            {/* ---- right arrow ---- */}
            <button
              className="nav-arrow nav-arrow--right"
              onClick={flipNext}
              disabled={currentPage >= numPages - 1}
              aria-label="Next page"
            >
              &#10095;
            </button>
          </div>
        )}
      </Document>

      {numPages && (
        <p className="page-indicator">
          Page {currentPage + 1} / {numPages}
        </p>
      )}
    </div>
  );
}
