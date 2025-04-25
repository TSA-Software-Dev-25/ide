let editor;

require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs" } });

require(["vs/editor/editor.main"], () => {
  const lang = document.getElementById("language").value;
  editor = monaco.editor.create(document.getElementById("editor"), {
    value: LANGUAGE_DEFAULTS[lang],
    language: lang,
    theme: "vs-dark",
    automaticLayout: true
  });

  document.getElementById("language").addEventListener("change", (e) => {
    const newLang = e.target.value;
    monaco.editor.setModelLanguage(editor.getModel(), newLang);
    editor.setValue(LANGUAGE_DEFAULTS[newLang]);
  });
});
