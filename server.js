const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.post("/api/run", (req, res) => {
  const { language, code } = req.body;

  const extMap = { javascript: "temp.js", python: "temp.py" };
  const execMap = { javascript: "node", python: "python3" };

  const filename = extMap[language];
  const command = `${execMap[language]} ${filename}`;

  if (!filename || !command) {
    return res.status(400).json({ error: "Unsupported language" });
  }

  fs.writeFile(filename, code, (err) => {
    if (err) return res.status(500).json({ error: "Failed to write file" });

    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
      fs.unlink(filename, () => {});

      if (error) return res.json({ error: stderr || error.message });
      res.json({ output: stdout });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
