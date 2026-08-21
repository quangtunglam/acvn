import fs from "fs";

try {
  fs.mkdirSync("dist/admin", { recursive: true });
  fs.copyFileSync("dist/index.html", "dist/admin/index.html");
  fs.copyFileSync("dist/index.html", "dist/admin.html");
  console.log("✓ Successfully created physical dist/admin/index.html and dist/admin.html");
} catch (e) {
  console.error("Failed to copy admin html:", e);
}
