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
function downloadExcel() {
    const stok = JSON.parse(localStorage.getItem("stok") || "{}");

    let workbook = {
        "OKUL": [],
        "YURT KIZ": [],
        "YURT ERKEK": []
    };

    const products = Object.keys(JSON.parse(localStorage.getItem("product_map") || "{}"));

    products.forEach(product => {
        workbook["OKUL"].push({
            "Ürün": product,
            "Gelen": stok.okul_gelen?.[product] || 0,
            "Çıkan": (stok.kiz_cikis?.[product] || 0) + (stok.erkek_cikis?.[product] || 0),
            "Kalan": stok.okul_kalan?.[product] || 0
        });

        workbook["YURT KIZ"].push({
            "Ürün": product,
            "Gelen": stok.kiz_cikis?.[product] || 0,
            "Kalan": stok.kiz_kalan?.[product] || 0
        });

        workbook["YURT ERKEK"].push({
            "Ürün": product,
            "Gelen": stok.erkek_cikis?.[product] || 0,
            "Kalan": stok.erkek_kalan?.[product] || 0
        });
    });

    let file = "HASILAT_" + new Date().toISOString().slice(0,10) + ".xlsx";

    let blob = new Blob([JSON.stringify(workbook, null, 2)], { type: "application/json" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
}
