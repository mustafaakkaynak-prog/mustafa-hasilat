async function processImage(file, type) {
  const productMap = await fetch("./products.json").then(r => r.json());
  const text = await file.text();

  const lines = text.split("\n");

  const detected = {};

  for (const line of lines) {
    const lower = line.toLowerCase();

    let count = line.match(/\d+/);
    count = count ? parseInt(count[0]) : 0;

    for (const product in productMap) {
      const aliases = productMap[product];
      if (aliases.some(alias => lower.includes(alias))) {
        detected[product] = (detected[product] || 0) + count;
      }
    }
  }

  saveToLocal(type, detected);
}

function saveToLocal(type, data) {
  const existing = JSON.parse(localStorage.getItem("stok") || "{}");
  existing[type] = data;
  localStorage.setItem("stok", JSON.stringify(existing));
  alert(type + " kaydedildi ✅");
}
