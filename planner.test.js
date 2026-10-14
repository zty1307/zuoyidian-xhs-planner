const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan } = require('./planner.js');
const config = { date: '2026-10-17', start: '10:00', end: '13:00', maxTasks: 4, rest: 10, travel: 25, rain: false };
const task = (id, extra = {}) => ({ id, title: id, category: '手作', mode: 'home', duration: 30, prepared: true, ...extra });

test('在家事项没有地址或营业时间也能安排，间隔留白不计为通勤', () => {
  const plan = buildPlan([task('妆容'), task('发型')], ['妆容', '发型'], config);
  assert.equal(plan.entries.length, 2);
  assert.equal(plan.entries[0].start, 600);
  assert.equal(plan.entries[1].start - plan.entries[0].end, 10);
  assert.equal(plan.entries[1].transfer, 0);
});
test('材料未备齐只阻止对应事项，不会妨碍其他事项', () => {
  const plan = buildPlan([task('做饭'), task('手作', { prepared: false, materials: '彩纸' })], ['做饭', '手作'], config);
  assert.deepEqual(plan.entries.map((entry) => entry.id), ['做饭']);
  assert.match(plan.excluded[0].reason, /彩纸/);
});
test('午饭按设定的时间窗口排入，超出窗口的事项被解释', () => {
  const plan = buildPlan([task('午饭', { open: '12:00', close: '12:45', duration: 45 }), task('超时', { open: '12:30', close: '12:45' })], ['午饭', '超时'], config);
  assert.equal(plan.entries[0].start, 720);
  assert.equal(plan.entries[0].end, 765);
  assert.match(plan.excluded[0].reason, /时间/);
});
test('输入顺序不影响前置事项先于后续事项完成', () => {
  const plan = buildPlan([task('拍照', { afterId: '妆容', priority: true }), task('妆容')], ['拍照', '妆容'], config);
  assert.deepEqual(plan.entries.map((entry) => entry.id), ['妆容', '拍照']);
  assert.ok(plan.entries[1].start >= plan.entries[0].end);
});
test('未选中的前置事项会提示；当天已做完则允许安排后续事项', () => {
  const items = [task('妆容'), task('拍照', { afterId: '妆容' })];
  assert.match(buildPlan(items, ['拍照'], config).excluded[0].reason, /需要先完成/);
  const plan = buildPlan(items, ['拍照'], config, { '2026-10-17:妆容': true });
  assert.deepEqual(plan.entries.map((entry) => entry.id), ['拍照']);
});
test('出门及回家保留通勤，不能把在家事项安排到出门地点', () => {
  const items = [task('练妆'), task('出门', { mode: 'out', afterId: '练妆' }), task('做饭', { afterId: '出门' })];
  const plan = buildPlan(items, items.map((item) => item.id), config);
  assert.deepEqual(plan.entries.map((entry) => entry.transfer), [0, 25, 25]);
  assert.equal(plan.entries[2].end, 760);
});
test('雨天和周末限制不误伤普通在家事项', () => {
  const items = [task('手作'), task('户外', { mode: 'out', outdoor: true }), task('周末课', { weekendsOnly: true })];
  const plan = buildPlan(items, items.map((item) => item.id), { ...config, date: '2026-10-19', rain: true });
  assert.deepEqual(plan.entries.map((entry) => entry.id), ['手作']);
  assert.ok(plan.excluded.some(({ reason }) => reason.includes('下雨')));
  assert.ok(plan.excluded.some(({ reason }) => reason.includes('周末')));
});
test('循环依赖不会生成错误顺序，件数上限内优先安排星标事项', () => {
  const circular = [task('A', { afterId: 'B' }), task('B', { afterId: 'A' })];
  assert.equal(buildPlan(circular, ['A', 'B'], config).entries.length, 0);
  const plan = buildPlan([task('普通'), task('优先', { priority: true })], ['普通', '优先'], { ...config, maxTasks: 1 });
  assert.equal(plan.entries[0].id, '优先');
  assert.match(plan.excluded[0].reason, /件数/);
});
