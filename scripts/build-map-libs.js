const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);

const files = {
  LEAFLET_JS: nm('leaflet', 'dist', 'leaflet.js'),
  LEAFLET_CSS: nm('leaflet', 'dist', 'leaflet.css'),
  PMTILES_JS: nm('pmtiles', 'dist', 'pmtiles.js'),
  PROTOMAPS_JS: nm('protomaps-leaflet', 'dist', 'protomaps-leaflet.js'),
};

let out = '// Файл создаётся скриптом scripts/build-map-libs.js. Руками не править.\n';
for (const [name, file] of Object.entries(files)) {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/\/\/# sourceMappingURL=.*$/gm, '');
  text = text.replace(/\/\*# sourceMappingURL=.*?\*\//g, '');
  text = text.replace(/<\/script/gi, '<\\/script');
  out += 'export const ' + name + ' = ' + JSON.stringify(text) + ';\n';
}

const target = path.join(root, 'src', 'map', 'libs.generated.ts');
fs.writeFileSync(target, out);
console.log('Готово:', target, Math.round(out.length / 1024) + ' КБ');