
async function runCode() {
  const code = editor.getValue();
  const lang = document.getElementById("language").value;
  const outputBox = document.getElementById("output");
  outputBox.textContent = "Running...";

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang, code })
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      outputBox.textContent = data.output || data.error || "No output.";
    } catch {
      outputBox.textContent = "Server returned invalid JSON:\n" + text;
    }
  } catch (err) {
    outputBox.textContent = "Error running code: " + err.message;
  }
}

// Update editor language and default content when selection changes
document.getElementById("language").addEventListener("change", (e) => {
  const lang = e.target.value;
  monaco.editor.setModelLanguage(editor.getModel(), lang === "cpp" ? "cpp" : lang);
  editor.setValue(LANGUAGE_DEFAULTS[lang] || "");
});
