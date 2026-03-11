import FlipbookViewer from "./FlipbookViewer";
import "./styles.css";

function App() {
  return (
    <div className="app">
      {/* wooden table surface is the full background */}
      <div className="table-surface">
        <FlipbookViewer file={`${import.meta.env.BASE_URL}book.pdf`} />
      </div>
    </div>
  );
}

export default App;
