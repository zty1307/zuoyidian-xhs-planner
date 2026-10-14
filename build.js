const fs = require('node:fs');
const path = require('node:path');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="./style.css" />', '<style>\n' + fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8') + '\n</style>');
for (const name of ['demo-notes.js', 'planner.js', 'demo-week.js', 'categories.js', 'plan-output.js', 'shared-album.js', 'app.js', 'travel-data.js', 'travel-planner.js', 'travel.js']) {
  let script = fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/<\/script/gi, '<\\/script');
  if (['demo-notes.js','travel-data.js'].includes(name)) script = script.replace(/assets\/[a-z0-9-]+\.webp/g, file => 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, file)).toString('base64'));
  // Videos stay in assets/ so the browser only requests the opened note.
  html = html.replace(`<script defer src="./${name}"></script>`, '<script defer>\n' + script + '\n</script>');
}
// Inline classic scripts run immediately even with defer. Keep them after the DOM.
const scripts = [...html.matchAll(/<script defer>[\s\S]*?<\/script>/g)].map((match) => match[0].replace('<script defer>', '<script>'));
html = html.replace(/<script defer>[\s\S]*?<\/script>/g, '').replace('</body>', scripts.join('\n') + '\n</body>');
const output = path.join(__dirname, 'standalone.html');
html = html.replace(/^[ \t]+$/gm, '');
fs.writeFileSync(output, html, 'utf8');
process.stdout.write(`已生成 ${output}\n`);
