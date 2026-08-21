import fs from "fs";

function ensureSpaSites(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.mkdirSync(`${dir}/admin`, { recursive: true });
    fs.copyFileSync(`${dir}/index.html`, `${dir}/admin/index.html`);
    fs.copyFileSync(`${dir}/index.html`, `${dir}/admin.html`);
    fs.copyFileSync(`${dir}/index.html`, `${dir}/404.html`);
    console.log(`✓ SPA fallbacks created in ${dir}`);
  } catch (e) {
    console.error(`Failed in ${dir}:`, e);
  }
}

ensureSpaSites("dist");
ensureSpaSites("artifacts/tin-tuc-portal/dist");
