/************** Yardımcılar **************/
const logEl = typeof document !== "undefined" ? document.getElementById("log") : null;
const summaryEl = typeof document !== "undefined" ? document.getElementById("summary") : null;

function log(msg){
  if(!logEl) return;
  const now = new Date().toLocaleTimeString();
  logEl.innerHTML = `<div>[${now}] ${msg}</div>` + logEl.innerHTML;
}

function trNormalize(s){
  return s
    .toLowerCase()
    .replaceAll('ç','c').replaceAll('ğ','g').replaceAll('ı','i').replaceAll('i̇','i')
    .replaceAll('ö','o').replaceAll('ş','s').replaceAll('ü','u')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

async function getProductMap(){
  // products.json -> {"popkek": ["popkek","muzlu popkek",...], ...}
  const map = await fetch("./products.json").then(r=>r.json());
  // normalize aliaslar
  const norm = {};
  Object.keys(map).forEach(k=>{
    norm[k] = map[k].map(a=>trNormalize(a));
  });
  localStorage.setItem("product_map", JSON.stringify(norm));
  return norm;
}

/************** OCR + Ayrıştırma **************/
async function processImage(file, type){
  const productMap = JSON.parse(localStorage.getItem("product_map") || "null") || await getProductMap();

  log(`OCR başlatıldı: ${file?.name || 'görsel'}`);

  // Türkçe + İngilizce birlikte
  const { data:{ text } } = await Tesseract.recognize(file, 'tur+eng', {
    logger: m => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        const p = Math.round(m.progress*100);
        log(`OCR ilerleme %${p}`);
      }
    }
  });

  log("OCR tamamlandı. Satır eşleştirme başlıyor…");

  const lines = text.split(/\r?\n/).map(l=>trNormalize(l)).filter(Boolean);

  // sabit kurallar: popkek & frutti tek satır, kişisel bakım kategorileri
  const detected = {}; // { ürün: adet }
  for(const raw of lines){
    // adedi satırın sonundaki ya da en büyük sayıdan yakala
    const nums = [...raw.matchAll(/\b\d+\b/g)].map(m=>parseInt(m[0],10));
    const count = nums.length ? nums[nums.length-1] : 0; // sayı yoksa 0 geç

    // ürün adı eşleştirme
    for(const product in productMap){
      const aliases = productMap[product];
      if (aliases.some(a => raw.includes(a))){
        if(count>0){
          detected[product] = (detected[product]||0) + count;
        }else{
          // adet yazılmadıysa 0 geç (sen sonradan Excel'de görebil)
          detected[product] = (detected[product]||0);
        }
      }
    }
  }

  // kaydet
  saveToLocal(type, detected);
  renderSummary();
}

function saveToLocal(key, data){
  const stok = JSON.parse(localStorage.getItem("stok") || "{}");
  // merge toplama
  const prev = stok[key] || {};
  const merged = {...prev};
  Object.keys(data||{}).forEach(k=>{
    merged[k] = (merged[k]||0) + (data[k]||0);
  });
  stok[key] = merged;
  localStorage.setItem("stok", JSON.stringify(stok));
  log(`${key} işlendi ✅`);
}

/************** Özet **************/
function renderSummary(){
  const stok = JSON.parse(localStorage.getItem("stok") || "{}");
  const pm = JSON.parse(localStorage.getItem("product_map") || "{}");
  const products = Object.keys(pm);

  function tableFor(keys, title){
    let html = `<h4>${title}</h4><table><thead><tr><th>Ürün</th><th>Adet</th></tr></thead><tbody>`;
    keys.forEach(k=>{
      const obj = stok[k] || {};
      const names = Object.keys(obj).filter(p=>obj[p]>0);
      if (names.length===0){ html += `<tr><td colspan="2"><em>—</em></td></tr>`; }
      names.forEach(n=>{
        html += `<tr><td>${n}</td><td>${obj[n]}</td></tr>`;
      });
    });
    html += `</tbody></table>`;
    return html;
  }

  summaryEl.innerHTML =
    tableFor(['okul_gelen'], 'OKUL • Gelen') +
    tableFor(['kiz_cikis','erkek_cikis'], 'Yurt Çıkışları (Kız+Erkek)') +
    tableFor(['okul_kalan','kiz_kalan','erkek_kalan'], 'Kalan Sayımlar (Okul+Kız+Erkek)');
}

/************** Excel Oluşturma (formüllü) **************/
function downloadExcel(){
  const stok = JSON.parse(localStorage.getItem("stok") || "{}");
  const productMap = JSON.parse(localStorage.getItem("product_map") || "{}");
  const products = Object.keys(productMap); // sabit ürün listesi (boş da olsa satırlar oluşturulur)

  const wb = XLSX.utils.book_new();

  // Yardımcı: sheet'e AOA yazar
  function appendSheet(name, header, rowsAOA){
    const ws = XLSX.utils.aoa_to_sheet([header, ...rowsAOA]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  // OKUL: Önceki Kalan | Gelen | Yurda Kız | Yurda Erkek | Kalan | Satılan | Fiyat | Hasılat
  {
    const header = ["Ürün","Önceki Kalan","Gelen","Yurda Kız","Yurda Erkek","Kalan","Satılan","Fiyat","Hasılat"];
    const rows = products.map((p,idx)=>{
      const prev = ""; // İlk haftada boş; sonraki haftalar dosyanın 'Kalan'ı devredecek (kullanıcı isterse elle de girebilir)
      const gelen = stok.okul_gelen?.[p] || 0;
      const yKiz  = stok.kiz_cikis?.[p] || 0;
      const yErk  = stok.erkek_cikis?.[p] || 0;
      const kalan = stok.okul_kalan?.[p] || 0;

      // Excel formülleri (satır numarası = header(1) + dataIndex + 1)
      const r = idx + 2;
      const satilan = `=IFERROR(B${r}+C${r}-D${r}-E${r}-F${r},0)`;
      const hasilat = `=IFERROR(G${r}*H${r},0)`;

      return [p, prev, gelen, yKiz, yErk, kalan, {f:satilan}, "", {f:hasilat}];
    });
    appendSheet("OKUL", header, rows);
  }

  // YURT KIZ: Önceki Kalan | Gelen(=okuldan çıkan) | Kalan | Satılan | Fiyat | Hasılat
  {
    const header = ["Ürün","Önceki Kalan","Gelen","Kalan","Satılan","Fiyat","Hasılat"];
    const rows = products.map((p,idx)=>{
      const prev = "";
      const gelen = stok.kiz_cikis?.[p] || 0;
      const kalan = stok.kiz_kalan?.[p] || 0;
      const r = idx + 2;
      const satilan = `=IFERROR(B${r}+C${r}-D${r},0)`;
      const hasilat = `=IFERROR(E${r}*F${r},0)`;
      return [p, prev, gelen, kalan, {f:satilan}, "", {f:hasilat}];
    });
    appendSheet("YURT KIZ", header, rows);
  }

  // YURT ERKEK
  {
    const header = ["Ürün","Önceki Kalan","Gelen","Kalan","Satılan","Fiyat","Hasılat"];
    const rows = products.map((p,idx)=>{
      const prev = "";
      const gelen = stok.erkek_cikis?.[p] || 0;
      const kalan = stok.erkek_kalan?.[p] || 0;
      const r = idx + 2;
      const satilan = `=IFERROR(B${r}+C${r}-D${r},0)`;
      const hasilat = `=IFERROR(E${r}*F${r},0)`;
      return [p, prev, gelen, kalan, {f:satilan}, "", {f:hasilat}];
    });
    appendSheet("YURT ERKEK", header, rows);
  }

  const filename = `HASILAT_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  log(`${filename} indirildi.`);
}

/************** Temizle **************/
function clearAll(){
  localStorage.removeItem("stok");
  log("Geçici veriler temizlendi.");
  renderSummary();
}

/************** İlk yükte **************/
(async function init(){
  await getProductMap(); // products.json normalizer
  renderSummary();
  log("Uygulama hazır. Fotoğrafları ilgili yerlere yükleyin.");
})();
