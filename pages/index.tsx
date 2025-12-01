export default function Home() {
  const uploadFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/convert-csv", { method: "POST", body: form });
    if (!res.ok) return alert("Something went wrong – try again");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elevenlabs_ready.xlsx";
    a.click();
  };

  return (
    <div style={{ padding: "60px", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1>Lakeland Toyota → ElevenLabs Converter</h1>
      <p style={{ fontSize: "1.4em", marginBottom: "40px" }}>
        Drop your raw Next-Day-Service CSV below
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) uploadFile(file);
        }}
        onClick={() => document.getElementById("fileInput")?.click()}
        style={{
          border: "6px dashed #0066ff",
          borderRadius: "20px",
          padding: "120px",
          margin: "0 auto",
          maxWidth: "800px",
          background: "#f8f8ff",
          cursor: "pointer",
          fontSize: "2em",
          color: "#333",
        }}
      >
        <input
          id="fileInput"
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
        />
        Drop CSV here<br />or click to browse
      </div>
    </div>
  );
}
