const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const forge = require("node-forge");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs").promises;
const { v4: uuidv4 } = require('uuid');

let win;
let token; 

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Menu.setApplicationMenu(null);

  win.loadURL("http://localhost:3000"); // Load frontend from backend server
}

app.whenReady().then(() => {
  // Start backend server
  exec("node server.js", { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) console.error("Server error:", err);
    if (stdout) console.log("Server stdout:", stdout);
    if (stderr) console.error("Server stderr:", stderr);
  });

  // Wait for the server to boot
  setTimeout(createWindow, 2000);

  ipcMain.on("login-change", (success) => {
    if (success) {
      win.webContents.send('update-login', true)
    }
    else win.webContents.send('update-login', false)
  })

  ipcMain.on("pop-window", () => {
    const child = new BrowserWindow({
      width: 600,
      height: 500,
      parent: win,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        preload: path.join(__dirname, "login_preload.js"),
      },
    });
    child.loadFile(path.join(__dirname, "login.html"));
    child.setResizable(false);
    child.setMenu(null);
  });
  buildUUID();
  buildKeys();

  ipcMain.handle("open-file", async () => {
    const {canceled, filePaths} = await dialog.showOpenDialog({
      properties: ["openFile"]
    });
    if (canceled || !filePaths.length) {console.log("opening canceled"); return null;}
    const filePath = filePaths[0];
    const content = await fsp.readFile(filePath, "utf8");
    return { path: filePath, content };
  });

  ipcMain.handle("open-folder", async () => {
    const {canceled, filePaths} = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    if (canceled || !filePaths.length) return null;
    const results = [];
    for (const dir of filePaths) {
      const names = await fsp.readdir(dir);
      for (const name of names) {
        const p = path.join(dir, name);
        if ((await fsp.stat(p)).isFile()) {
          const content = await fsp.readFile(p, "utf8");
          results.push({ path: p, name, content });
        }
      }
    }
    return results;
  });

  ipcMain.handle("read-file", async (_event, filePath) => {
    return fsp.readFile(filePath, "utf8");
  });

  ipcMain.handle("create-account", async (event, username, pass) => {
    console.log("Creating account with ", username, pass);
    try {
      const hashedPass = hashPass(pass);
      const passwordFull = buildPlaintext(hashedPass);
      const encryptedPassword = await encryptPassword(passwordFull);

      const res = await fetch("http://localhost:8080/accounts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: encryptedPassword,
        }),
      });

      if (res.status === 200) return "Account created successfully!";
      if (res.status === 403) return "Username already exists!";
      if (res.status === 400) return "Bad request!";
      return "Unknown error!";
    } catch (error) {
      console.error("Create account error:", error);
      throw new Error("Account creation failed unexpectedly");
    }
  });

  ipcMain.handle("login", async (_event, username, pass) => {
    console.log("starting login in main");
    const hashedPass = hashPass(pass);
    const passwordFull = buildPlaintext(hashedPass);
    const publicKey = fetchPublic();
    const publicKeyClean = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\n/g, '');
    const privateKey = fetchPrivate()
    const encryptedPassword = await encryptPassword(passwordFull);

    try {
      const res = await fetch("http://localhost:8080/accounts/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: encryptedPassword,
          key: publicKeyClean
        }),
      });
      console.log("login response", res);
      if (res.status !== 200) {
        if (res.status === 403) return "Invalid credentials!";
        if (res.status === 400) return "Bad request!";
        if (res.status === 500) return "Server error!";
        return "Unknown error!";
      }

      const encryptedTokenBase64 = await res.text();
      const encryptedToken = Buffer.from(encryptedTokenBase64, 'base64');

      const decryptedBuffer = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        encryptedToken
      );
      console.log("decryptedBuffer", decryptedBuffer);
      const tokenString = decryptedBuffer.toString('utf8');
      token = Buffer.from(buildPlaintext(tokenString), 'utf8').toString('base64');
      return "Login successful!";
    } catch (error) {
      console.error("Login error:", error);
      throw new Error("Login failed unexpectedly");
    }
  });

  ipcMain.handle("logout", async (_event) => {
    try {
      const res = await fetch("http://localhost:8080/accounts/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
        }),
      });

      if (res.status == 200) {
      token = null;
      return "Logged out successfully!";
      }
      if (res.status == 403) return "Invalid token!";
      else return "Unknown error!";
    } catch (error) {
      console.error("Logout error:", error);
      throw new Error("Logout failed unexpectedly")
    }
  });

  ipcMain.handle("send-file", async (_event, code, filePath) => { 
    console.log("sending file", code, filePath);
    let fileName = filePath.split('/').pop();
    console.log(fileName)
    let newFileName = filePath.replace(/\.py$/, ".json");
    console.log(newFileName)
    const token = fs.readFileSync(path.join(__dirname, "UUID.uuid")).toString();
    const codeB64 = forge.util.encode64(code);
    try {
      console.log("trying fetch")
      const res = await fetch("http://localhost:8080/exchange/forward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          task: {
            command: "run-file",
            file_name: fileName,
            file_content: codeB64
          }
        })
      })
      const output = await res.text();
      if (res) {
        let toWrite;
        try {
          const obj = JSON.parse(output);
          toWrite = JSON.stringify(obj, null, 4)
        } catch {
          toWrite = output
        }
        fs.writeFileSync(newFileName, toWrite, "utf8")
        return true
      } else {
        return false
      }
    } catch (e) {
      throw new Error("Error when trying to open file")
    }
  });

  ipcMain.handle("save-file", async (_evt, path, content) => {
    try {
      await fsp.writeFile(path, content, "utf8");
      return true;
    } catch (error) {
      console.error("Error saving file:", error);
      return false;
    }
  });
})


async function encryptPassword(password) {
  const res = await fetch("http://localhost:8080/key");
  const data = await res.text();

  const key = forge.util.decode64(data);
  const pk = forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(key));

  const encrypted = pk.encrypt(password, "RSA-OAEP");

  const encryptedBase64 = forge.util.encode64(encrypted);

  return encryptedBase64;
}

function buildPlaintext(pass) {
  const uuidPath = path.join(__dirname, "UUID.uuid");

  if (!fs.existsSync(uuidPath)) {
    buildUUID();
  }

  const uuid = fs.readFileSync(uuidPath).toString();
  return pass + ":ID=" + uuid;
}

function buildUUID() {
  const uuid = uuidv4();
  fs.writeFileSync(path.join(__dirname, "UUID.uuid"), uuid);
}

function buildKeys() {
  const publicPath = path.join(__dirname, "public_key.pem");
  const privatePath = path.join(__dirname, "private_key.pem");
  if (!fs.existsSync(publicPath) && !fs.existsSync(privatePath)) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync(
      'rsa', {
        modulusLength: 2048
      }
    );

    const publicKeyPEM = publicKey.export({ type: 'spki', format: 'pem' });
    const privateKeyPEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
    
    fs.writeFileSync(publicPath, publicKeyPEM);
    fs.writeFileSync(privatePath, privateKeyPEM);
  }
}

function fetchPrivate() {
  const privateKeyPath = path.join(__dirname, "private_key.pem");
  if (!fs.existsSync(privateKeyPath)) {
    buildKeys();
  }
  const privateKeyPEM = fs.readFileSync(privateKeyPath).toString();
  return privateKeyPEM
} // fetch personal private key

function fetchPublic() {
  const publicKeyPath = path.join(__dirname, "public_key.pem");
  if (!fs.existsSync(publicKeyPath)) {
    buildKeys();
  }
  const publicKeyPEM = fs.readFileSync(publicKeyPath).toString();
  return publicKeyPEM
} // fetch personal public key

function hashPass(pass) {
  return crypto.createHash("sha256").update(pass).digest("hex");
}