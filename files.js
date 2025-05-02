const openedFiles = [];
const fileHandles = {}; 

async function openFile() {
  const result = await window.electronAPI.openFile();
  if (!result) {
    showNotification("File open cancelled.", "info", "#CCCCCC");
    return;
  }

  const { path, content } = result;
  const name = path.split(/[/\\]/).pop();

  if (!openedFiles.includes(name)) {
    openedFiles.push(name);
    fileHandles[name] = { path, name };
    updateSidebar();
  }

  editor.setValue(content);
  setActiveFile(name);
  hideWelcome();
  showNotification(`Opened ${name} successfully.`, "check-circle", "#5FC234");
}

async function openFolder() {
  const results = await window.electronAPI.openFolder();
  if (!results) {
    showNotification("Folder open cancelled.", "info", "#CCCCCC");
    return;
  }

  openedFiles.length = 0;
  for (const key in fileHandles) delete fileHandles[key];

  for (const { path, name, content } of results) {
    openedFiles.push(name);
    fileHandles[name] = { path, name };
  }

  updateSidebar();

  const first = results[0];
  if (first) {
    editor.setValue(first.content);
    setActiveFile(first.name);
  }

  hideWelcome();
  showNotification("Opened folder successfully.", "check-circle", "#5FC234");
}

function updateSidebar() {
  const openedFilesList = document.getElementById("opened-files");
  openedFilesList.innerHTML = "";

  openedFiles.forEach((fileName) => {
    const file = document.createElement("li");
    file.textContent = fileName;
    file.classList.add("file-item");

    file.addEventListener("click", () => {
      openFileSidebar(fileName);
    });

    openedFilesList.appendChild(file);
  });

  setActiveFile(getActiveFileName());
}

function setActiveFile(fileName) {
  document.querySelectorAll(".file-item").forEach((item) => {
    if (item.textContent === fileName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

function getActiveFileName() {
  const active = document.querySelector(".file-item.active");
  return active ? active.textContent : null;
}

async function openFileSidebar(fileName) {
  const handle = fileHandles[fileName];
  if (!handle) return;

  try {
    const content = await window.electronAPI.readFile(handle.path);
    editor.setValue(content);
    setActiveFile(fileName);
  } catch (e) {
    console.error(`Error opening ${fileName}:`, e);
    showNotification(`Failed to open ${fileName}.`, "error", "#F48872");
  }
}

async function saveFile() {
  const fileName = getActiveFileName();
  const handle = fileHandles[fileName];
  if (!handle || !handle.path) {
    showNotification("No file open to save.", "error", "#F48872");
    return;
  }

  try {
    const succ = await window.electronAPI.saveFile(handle.path, editor.getValue());
    if (succ) {
      showNotification(`Saved ${fileName} successfully.`, "check-circle", "#5FC234");
    } else {
      showNotification("Failed to save file.", "error", "#F48872");
    }
  } catch (e) {
    console.error("Error saving via IPC:", e);
    showNotification("Failed to save file.", "error", "#F48872");
  }
}

async function sendFile() {
  const fileName = getActiveFileName();
  const outputName = fileName.replace(/\.py$/, ".json");

  const handle = fileHandles[fileName];
  if (!handle || !handle.path) {
    showNotification("No file open to send.", "error", "#F48872")
    return
  } else {
    code = editor.getValue();
    showNotification("Sending File...", "info", "#CCCCCC")
    const res = await window.electronAPI.sendFile(code, handle.path)
    if (res) {
      showNotification("Output received!", "check-circle", "#5FC234")
      const jsonPath = handle.path.replace(/\.py$/, '.json');
      const jsonContent = await window.electronAPI.readFile(jsonPath);
      if (!openedFiles.includes(outputName)) {
        openedFiles.push(outputName);
        fileHandles[outputName] = { path: jsonPath, name: outputName }
        updateSidebar();
      }
      editor.setValue(jsonContent)
      setActiveFile(outputName)
    } else {
      showNotification("Error sending to server.", "error", "#F48872")
    }
  }
}