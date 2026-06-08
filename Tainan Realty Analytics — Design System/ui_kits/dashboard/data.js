/* Mock Tainan real-estate data for the UI kit (representative, not real). */
window.TRA_DATA = (function () {
  const districts = [
    { district: '永康區', count: 3184, unit_price: 28.4, area: 38.2, avg_total: 1085, sales: 345, pct: 14.2 },
    { district: '安南區', count: 2351, unit_price: 24.1, area: 41.6, avg_total: 1002, sales: 236, pct: 10.5 },
    { district: '東區',   count: 1980, unit_price: 41.2, area: 33.1, avg_total: 1364, sales: 270, pct: 8.8 },
    { district: '中西區', count: 1742, unit_price: 45.8, area: 31.4, avg_total: 1438, sales: 251, pct: 7.8 },
    { district: '北區',   count: 1611, unit_price: 38.6, area: 32.0, avg_total: 1235, sales: 199, pct: 7.2 },
    { district: '南區',   count: 1488, unit_price: 33.2, area: 35.5, avg_total: 1179, sales: 175, pct: 6.6 },
    { district: '仁德區', count: 1320, unit_price: 26.7, area: 39.8, avg_total: 1063, sales: 140, pct: 5.9 },
    { district: '歸仁區', count: 1104, unit_price: 23.9, area: 42.1, avg_total: 1006, sales: 111, pct: 4.9 },
  ];

  const types = [
    { type: '住宅大樓', count: 9820, sales: 1180, pct: 43.8 },
    { type: '透天厝',   count: 6240, sales: 980,  pct: 27.8 },
    { type: '華廈',     count: 2710, sales: 268,  pct: 12.1 },
    { type: '公寓',     count: 1980, sales: 150,  pct: 8.8 },
    { type: '套房',     count: 1010, sales: 64,   pct: 4.5 },
    { type: '辦公商業', count: 670,  sales: 92,   pct: 3.0 },
  ];

  const rooms = [
    { rooms: 1, count: 1820, unit_price: 39.1, area: 14.2, avg_total: 555,  pct: 8.1 },
    { rooms: 2, count: 5240, unit_price: 36.4, area: 23.8, avg_total: 866,  pct: 23.4 },
    { rooms: 3, count: 8910, unit_price: 32.7, area: 35.6, avg_total: 1164, pct: 39.8 },
    { rooms: 4, count: 4520, unit_price: 30.1, area: 45.9, avg_total: 1381, pct: 20.2 },
    { rooms: 5, count: 1940, unit_price: 28.3, area: 58.4, avg_total: 1653, pct: 8.5 },
  ];

  // 24-month unit-price trend (萬/坪) + volume
  const months = [];
  let base = 30.2;
  for (let i = 0; i < 24; i++) {
    const y = 113 + Math.floor((i + 6) / 12);
    const m = ((i + 6) % 12) + 1;
    base += (Math.sin(i / 3) * 0.5) + 0.28 + (i > 16 ? 0.4 : 0);
    months.push({
      label: `${y}/${String(m).padStart(2, '0')}`,
      unit_price: +base.toFixed(1),
      volume: Math.round(1500 + Math.sin(i / 2) * 420 + i * 22),
    });
  }

  const cases = [
    { case_type: '預售', district: '永康區', name: '永康之心',     total_count: 320, count: 268, sales_ratio: 84, common_ratio: 33, unit_price: 31.2, area: 38, avg_total: 1186 },
    { case_type: '成屋', district: '東區',   name: '東寧寓所',     total_count: 96,  count: 96,  sales_ratio: 100, common_ratio: 31, unit_price: 43.5, area: 32, avg_total: 1392 },
    { case_type: '預售', district: '中西區', name: '府城一號院',   total_count: 168, count: 121, sales_ratio: 72, common_ratio: 34, unit_price: 48.9, area: 30, avg_total: 1467 },
    { case_type: '成屋', district: '安南區', name: '安南學區華廈', total_count: 144, count: 138, sales_ratio: 96, common_ratio: 30, unit_price: 25.6, area: 41, avg_total: 1050 },
    { case_type: '預售', district: '北區',   name: '成功匯',       total_count: 240, count: 156, sales_ratio: 65, common_ratio: 32, unit_price: 39.8, area: 34, avg_total: 1353 },
  ];

  const kpi = { total: 22430, avg_unit_price: 33.6, avg_area: 35.4, avg_total: 1189, total_sales: 1204 };

  return { districts, types, rooms, months, cases, kpi };
})();
