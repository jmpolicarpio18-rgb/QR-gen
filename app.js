const qrTypeSelect = document.getElementById("qrType");
const dynamicFields = document.getElementById("dynamicFields");
const generateBtn = document.getElementById("generateBtn");
const downloadBtn = document.getElementById("downloadBtn");
const qrcodeContainer = document.getElementById("qrcode");
const encodedText = document.getElementById("encodedText");
const virtualCard = document.getElementById("virtualCard");
const cardInitials = document.getElementById("cardInitials");
const cardName = document.getElementById("cardName");
const cardTitle = document.getElementById("cardTitle");
const cardCompany = document.getElementById("cardCompany");
const cardPhone = document.getElementById("cardPhone");
const cardEmail = document.getElementById("cardEmail");
const cardAddress = document.getElementById("cardAddress");
const cardWebsite = document.getElementById("cardWebsite");
const cardWebsiteQR = document.getElementById("cardWebsiteQR");
const cardLogo = document.getElementById("cardLogo");

let lastWebsiteUrl = "";
let centerLogoImagePromise;
const CENTER_LOGO_SOURCES = ["assets/logo.png"];

function fieldTemplate(id, label, type = "text", placeholder = "") {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" placeholder="${placeholder}" />
    </div>
  `;
}

function getCenterLogoImage() {
  if (centerLogoImagePromise) return centerLogoImagePromise;

  centerLogoImagePromise = new Promise((resolve, reject) => {
    const preferredSources = ["assets/logo.png"];
    const cardLogoSrc = cardLogo ? cardLogo.getAttribute("src") : "";
    if (cardLogoSrc && !preferredSources.includes(cardLogoSrc)) preferredSources.unshift(cardLogoSrc);
    CENTER_LOGO_SOURCES.forEach((source) => {
      if (!preferredSources.includes(source)) preferredSources.push(source);
    });

    const tryLoad = (sourceIndex) => {
      if (sourceIndex >= preferredSources.length) {
        reject(new Error("Unable to load center logo image."));
        return;
      }

      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => tryLoad(sourceIndex + 1);

      const source = preferredSources[sourceIndex];
      const resolvedSource = /^https?:\/\//i.test(source) || /^data:/i.test(source)
        ? source
        : new URL(source, document.baseURI).toString();
      image.src = resolvedSource;
    };

    tryLoad(0);
  }).catch((error) => {
    centerLogoImagePromise = null;
    throw error;
  });

  return centerLogoImagePromise;
}

function waitForImageReady(image) {
  if (!image) return Promise.resolve();
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("QR image could not be rendered."));
  });
}

async function ensureQRCodeCanvas(container) {
  const existingCanvas = container.querySelector("canvas");
  if (existingCanvas) return existingCanvas;

  const qrImage = container.querySelector("img");
  if (!qrImage) return null;

  await waitForImageReady(qrImage);
  const width = qrImage.naturalWidth || qrImage.width;
  const height = qrImage.naturalHeight || qrImage.height;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${qrImage.width || width}px`;
  canvas.style.height = `${qrImage.height || height}px`;

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(qrImage, 0, 0, width, height);
  qrImage.replaceWith(canvas);
  return canvas;
}

function drawCircularFinder(context, left, top, moduleSize, darkColor) {
  const finderSize = moduleSize * 7;
  const centerX = left + finderSize / 2;
  const centerY = top + finderSize / 2;

  // Clear square finder area first so corners become truly circular.
  context.fillStyle = "#ffffff";
  context.fillRect(left, top, finderSize, finderSize);

  context.beginPath();
  context.arc(centerX, centerY, moduleSize * 3.5, 0, Math.PI * 2);
  context.fillStyle = darkColor;
  context.fill();

  context.beginPath();
  context.arc(centerX, centerY, moduleSize * 2.5, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();

  context.beginPath();
  context.arc(centerX, centerY, moduleSize * 1.5, 0, Math.PI * 2);
  context.fillStyle = darkColor;
  context.fill();
}

async function styleCornerEyes(container, qrInstance, darkColor = "#132d5b") {
  const qrModel = qrInstance && qrInstance._oQRCode;
  if (!qrModel || typeof qrModel.getModuleCount !== "function") return;

  const canvas = await ensureQRCodeCanvas(container);
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const moduleCount = qrModel.getModuleCount();
  if (!moduleCount) return;
  const moduleSize = canvas.width / moduleCount;

  drawCircularFinder(context, 0, 0, moduleSize, darkColor);
  drawCircularFinder(context, canvas.width - moduleSize * 7, 0, moduleSize, darkColor);
  drawCircularFinder(context, 0, canvas.height - moduleSize * 7, moduleSize, darkColor);
}

async function applyQrBrandStyle(container, qrInstance, placeholderRatio) {
  await styleCornerEyes(container, qrInstance, "#e31e30");
  await addTrianglePlaceholder(container, placeholderRatio);
}

async function addTrianglePlaceholder(container, sizeRatio = 0.32) {
  const canvas = await ensureQRCodeCanvas(container);
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const side = Math.min(canvas.width, canvas.height) * sizeRatio;
  const height = side * 0.82;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.max(3, side * 0.12);
  const points = [
    { x: centerX, y: centerY - height / 2 },
    { x: centerX + side / 2, y: centerY + height / 2 },
    { x: centerX - side / 2, y: centerY + height / 2 }
  ];

  const corners = points.map((current, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];

    const toPreviousX = previous.x - current.x;
    const toPreviousY = previous.y - current.y;
    const toNextX = next.x - current.x;
    const toNextY = next.y - current.y;
    const prevLength = Math.hypot(toPreviousX, toPreviousY) || 1;
    const nextLength = Math.hypot(toNextX, toNextY) || 1;
    const cornerRadius = Math.min(radius, prevLength * 0.5, nextLength * 0.5);

    return {
      current,
      start: {
        x: current.x + (toPreviousX / prevLength) * cornerRadius,
        y: current.y + (toPreviousY / prevLength) * cornerRadius
      },
      end: {
        x: current.x + (toNextX / nextLength) * cornerRadius,
        y: current.y + (toNextY / nextLength) * cornerRadius
      }
    };
  });

  context.save();
  context.beginPath();
  context.moveTo(corners[0].start.x, corners[0].start.y);
  for (let index = 0; index < corners.length; index += 1) {
    const corner = corners[index];
    const nextCorner = corners[(index + 1) % corners.length];
    context.quadraticCurveTo(corner.current.x, corner.current.y, corner.end.x, corner.end.y);
    context.lineTo(nextCorner.start.x, nextCorner.start.y);
  }
  context.closePath();
  context.fillStyle = "#ffffff";
  context.fill();

  let logoImage = null;
  if (cardLogo && cardLogo.complete && cardLogo.naturalWidth > 0) {
    logoImage = cardLogo;
  } else {
    logoImage = await getCenterLogoImage();
  }
  const logoAspect = (logoImage.naturalWidth || logoImage.width || 1) /
    (logoImage.naturalHeight || logoImage.height || 1);
  const logoBoxWidth = side * 1.18;
  let logoWidth = logoBoxWidth;
  let logoHeight = logoWidth / logoAspect;
  if (logoHeight > height * 1.08) {
    logoHeight = height * 1.08;
    logoWidth = logoHeight * logoAspect;
  }

  const logoX = centerX - logoWidth / 2;
  const logoY = centerY - logoHeight / 2 + height * 0.02;
  context.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
  context.restore();
}

function renderFields(type) {
  if (type === "website") {
    dynamicFields.innerHTML = fieldTemplate(
      "websiteUrl",
      "Website URL",
      "url",
      "https://yourwebsite.com"
    );
    return;
  }

  if (type === "social") {
    dynamicFields.innerHTML = `
      ${fieldTemplate("socialPlatform", "Platform", "text", "Facebook / Instagram / X")}
      ${fieldTemplate("socialHandle", "Username or Handle", "text", "@yourname")}
      ${fieldTemplate("socialUrl", "Profile URL", "url", "https://social.com/yourname")}
    `;
    return;
  }

  dynamicFields.innerHTML = `
    ${fieldTemplate("fullName", "Full Name", "text", "Juan Dela Cruz")}
    ${fieldTemplate("company", "Company", "text", "Your Company")}
    ${fieldTemplate("jobTitle", "Job Title", "text", "Sales Manager")}
    ${fieldTemplate("phone", "Phone Number", "tel", "+63 900 000 0000")}
    ${fieldTemplate("email", "Email", "email", "you@email.com")}
    ${fieldTemplate("address", "Address", "text", "City, Country")}
    ${fieldTemplate("website", "Website", "url", "https://yourwebsite.com")}
  `;
}

function ensureProtocol(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url.trim();
  return `https://${url.trim()}`;
}

function compactVCard(lines) {
  return lines.filter(Boolean).join("\r\n");
}

function escapeVCardValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function splitVCardName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { givenName: "", familyName: "" };
  }
  if (parts.length === 1) {
    return { givenName: parts[0], familyName: "" };
  }
  const givenName = parts.slice(0, -1).join(" ");
  const familyName = parts[parts.length - 1];
  return { givenName, familyName };
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function getInitials(name) {
  const parts = String(name || "")
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);

  if (!parts.length) return "VC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]).join("").toUpperCase();
}

function getVCardFormData() {
  return {
    fullName: getInputValue("fullName"),
    company: getInputValue("company"),
    jobTitle: getInputValue("jobTitle"),
    phone: getInputValue("phone"),
    email: getInputValue("email"),
    address: getInputValue("address"),
    website: ensureProtocol(getInputValue("website"))
  };
}

function updateVirtualCardPreview() {
  const data = getVCardFormData();
  cardInitials.textContent = getInitials(data.fullName || "VC");
  cardName.textContent = data.fullName || "Your Name";
  cardTitle.textContent = data.jobTitle || "Job Title";
  cardCompany.textContent = data.company || "Your Company";
  cardPhone.textContent = `Phone: ${data.phone || "Not set"}`;
  cardEmail.textContent = `Email: ${data.email || "Not set"}`;
  cardAddress.textContent = `Address: ${data.address || "Not set"}`;
  cardWebsite.textContent = `Website: ${data.website || "Not set"}`;
  renderCardWebsiteQR(data.website);
}

function setVirtualCardVisibility(type) {
  virtualCard.classList.toggle("hidden", type !== "vcard");
}

function renderCardWebsiteQR(websiteUrl) {
  lastWebsiteUrl = websiteUrl || "";
  cardWebsiteQR.innerHTML = "";
  if (!websiteUrl) {
    cardWebsiteQR.textContent = "No URL";
    return;
  }

  const boxSize = Math.max(80, Math.min(130, cardWebsiteQR.clientWidth - 16));

  const miniQr = new QRCode(cardWebsiteQR, {
    text: websiteUrl,
    typeNumber: 0,
    width: boxSize,
    height: boxSize,
    colorDark: "#132d5b",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  applyQrBrandStyle(cardWebsiteQR, miniQr, 0.3).catch((error) => {
    console.warn("Mini QR style failed:", error);
  });
}

function getDataByType(type) {
  if (type === "website") {
    const websiteUrl = ensureProtocol(document.getElementById("websiteUrl").value);
    if (!websiteUrl) throw new Error("Please enter a website URL.");
    return websiteUrl;
  }

  if (type === "social") {
    const platform = getInputValue("socialPlatform");
    const handle = getInputValue("socialHandle");
    const socialUrl = ensureProtocol(getInputValue("socialUrl"));
    if (!socialUrl) throw new Error("Please enter a social profile URL.");
    const extras = [platform && `Platform: ${platform}`, handle && `Handle: ${handle}`]
      .filter(Boolean)
      .join(" | ");
    return extras ? `${socialUrl}\n${extras}` : socialUrl;
  }

  const { fullName, company, jobTitle, phone, email, address, website } = getVCardFormData();

  if (!fullName) throw new Error("Please enter full name for calling card.");
  const { givenName, familyName } = splitVCardName(fullName);
  const safeFullName = escapeVCardValue(fullName);

  return compactVCard([
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardValue(familyName)};${escapeVCardValue(givenName)};;;`,
    `FN:${safeFullName}`,
    company && `ORG:${escapeVCardValue(company)}`,
    jobTitle && `TITLE:${escapeVCardValue(jobTitle)}`,
    phone && `TEL;TYPE=CELL:${escapeVCardValue(phone)}`,
    email && `EMAIL:${escapeVCardValue(email)}`,
    address && `ADR:;;${escapeVCardValue(address)};;;;`,
    website && `URL:${escapeVCardValue(website)}`,
    "END:VCARD"
  ]);
}

function attachLiveVCardPreview() {
  if (qrTypeSelect.value !== "vcard") return;
  updateVirtualCardPreview();
  const vCardInputs = dynamicFields.querySelectorAll("input");
  vCardInputs.forEach((input) => {
    input.addEventListener("input", updateVirtualCardPreview);
  });
}

async function generateQRCode(text) {
  qrcodeContainer.innerHTML = "";
  const mainQr = new QRCode(qrcodeContainer, {
    text,
    typeNumber: 0,
    width: 260,
    height: 260,
    colorDark: "#132d5b",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  await applyQrBrandStyle(qrcodeContainer, mainQr, 0.28);
}

function setProcessingStatus(status) {
  encodedText.textContent = `Status: ${status}`;
}

function downloadQRCode() {
  const canvas = qrcodeContainer.querySelector("canvas");
  const img = qrcodeContainer.querySelector("img");

  if (canvas) {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "qr-code.png";
    link.click();
    return;
  }

  if (img) {
    const link = document.createElement("a");
    link.href = img.src;
    link.download = "qr-code.png";
    link.click();
  }
}

qrTypeSelect.addEventListener("change", () => {
  const type = qrTypeSelect.value;
  renderFields(type);
  setVirtualCardVisibility(type);
  attachLiveVCardPreview();
  qrcodeContainer.innerHTML = "";
  setProcessingStatus("Completed");
  downloadBtn.disabled = true;
});

generateBtn.addEventListener("click", async () => {
  try {
    setProcessingStatus("Started processing");
    const text = getDataByType(qrTypeSelect.value);
    await generateQRCode(text);
    setProcessingStatus("Completed");
    if (qrTypeSelect.value === "vcard") {
      updateVirtualCardPreview();
    }
    downloadBtn.disabled = false;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.toLowerCase().includes("code length overflow")) {
      alert(
        "Input is too long for one QR code. Shorten the text/URL, remove extra fields, or use a shorter link."
      );
      setProcessingStatus("Completed");
      return;
    }
    alert(message);
    setProcessingStatus("Completed");
  }
});

downloadBtn.addEventListener("click", downloadQRCode);

window.addEventListener("resize", () => {
  if (qrTypeSelect.value === "vcard") {
    renderCardWebsiteQR(lastWebsiteUrl);
  }
});

cardLogo.addEventListener("error", () => {
  if (!cardLogo.src.endsWith("assets/logo.png")) {
    cardLogo.src = "assets/logo.png";
  }
});

renderFields("website");
setVirtualCardVisibility("website");
setProcessingStatus("Completed");
getCenterLogoImage().catch((error) => {
  console.warn("Center logo preload failed:", error);
});

