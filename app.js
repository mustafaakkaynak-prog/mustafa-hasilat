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
function downloadExcel() {
    const stok = JSON.parse(localStorage.getItem("stok") || "{}");

    const workbook = XLSX.utils.book_new();

    function sheetFrom(type, title) {
        const rows = [];

        const productMap = JSON.parse(localStorage.getItem("product_map") || "{}");
        const products = Object.keys(productMap);

        products.forEach(product => {
            const gelen = stok[`${type}_gelen`]?.[product] || 0;
            const cikis = (stok.kiz_cikis?.[product] || 0) + (stok.erkek_cikis?.[product] || 0);
            const kalan = stok[`${type}_kalan`]?.[product] || 0;

            rows.push({
                Ürün: product,
                Gelen: gelen,
                Çıkan: type === "okul" ? cikis : gelen,
                Kalan: kalan,
                Satılan: type === "okul" ? (gelen - cikis - kalan) : (gelen - kalan)
            });
        });

        const sheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, sheet, title);
    }

    sheetFrom("okul", "OKUL");
    sheetFrom("kiz", "YURT KIZ");
    sheetFrom("erkek", "YURT ERKEK");

    const filename = `HASILAT_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
}
