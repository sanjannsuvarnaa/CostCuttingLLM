/** Self-contained dashboard page: no external CDNs, works fully offline. */
export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tokenwise-mcp — Usage Dashboard</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; margin: 0; padding: 2rem; background: #0f1115; color: #e6e6e6; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  .namespace { color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
  .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .card { background: #1a1d24; border: 1px solid #2a2e37; border-radius: 8px; padding: 1rem 1.5rem; min-width: 160px; }
  .card .value { font-size: 1.8rem; font-weight: 600; }
  .card .label { font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.05em; }
  .chart-container { background: #1a1d24; border: 1px solid #2a2e37; border-radius: 8px; padding: 1rem; margin-bottom: 2rem; overflow-x: auto; }
  .bar { fill: #5b8cff; }
  .bar:hover { fill: #82a8ff; }
  .axis-label { fill: #888; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; background: #1a1d24; border: 1px solid #2a2e37; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #2a2e37; }
  th { color: #999; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  tr:last-child td { border-bottom: none; }
  .empty { color: #888; padding: 1.5rem; text-align: center; }
</style>
</head>
<body>
  <h1>tokenwise-mcp — Daily Usage</h1>
  <div class="namespace" id="namespace"></div>

  <div class="cards">
    <div class="card"><div class="value" id="todaySaved">-</div><div class="label">Tokens saved today</div></div>
    <div class="card"><div class="value" id="todayCalls">-</div><div class="label">Calls today</div></div>
    <div class="card"><div class="value" id="allTimeSaved">-</div><div class="label">Tokens saved (all-time)</div></div>
    <div class="card"><div class="value" id="allTimeCalls">-</div><div class="label">Calls (all-time)</div></div>
  </div>

  <div class="chart-container">
    <svg id="chart" width="100%" height="260" viewBox="0 0 800 260" preserveAspectRatio="xMinYMin meet"></svg>
  </div>

  <table id="toolTable">
    <thead><tr><th>Tool</th><th>Calls today</th><th>Tokens saved today</th></tr></thead>
    <tbody></tbody>
  </table>

  <script>
    function todayKey() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function renderChart(days) {
      var svg = document.getElementById('chart');
      svg.innerHTML = '';
      if (!days.length) {
        var msg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        msg.setAttribute('x', '400');
        msg.setAttribute('y', '130');
        msg.setAttribute('text-anchor', 'middle');
        msg.setAttribute('fill', '#888');
        msg.textContent = 'No usage recorded yet.';
        svg.appendChild(msg);
        return;
      }

      var W = 800, H = 260, padBottom = 30, padTop = 10;
      var max = 1;
      for (var i = 0; i < days.length; i++) max = Math.max(max, days[i].totalTokensSaved);
      var slot = W / days.length;
      var barW = Math.max(4, slot - 4);
      var labelStep = Math.ceil(days.length / 10) || 1;

      days.forEach(function (d, i) {
        var h = (d.totalTokensSaved / max) * (H - padBottom - padTop);
        var x = i * slot + 2;
        var y = H - padBottom - h;

        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', barW);
        rect.setAttribute('height', h);
        rect.setAttribute('class', 'bar');

        var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = d.date + ': ' + d.totalTokensSaved.toLocaleString() + ' tokens saved';
        rect.appendChild(title);
        svg.appendChild(rect);

        if (i % labelStep === 0) {
          var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', x + barW / 2);
          label.setAttribute('y', H - 10);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('class', 'axis-label');
          label.textContent = d.date.slice(5);
          svg.appendChild(label);
        }
      });
    }

    function renderTable(tools) {
      var tbody = document.querySelector('#toolTable tbody');
      tbody.innerHTML = '';
      var entries = Object.entries(tools || {});
      if (!entries.length) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = 3;
        td.className = 'empty';
        td.textContent = 'No tool calls recorded today.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      entries.sort(function (a, b) { return b[1].tokensSaved - a[1].tokensSaved; });
      entries.forEach(function (entry) {
        var name = entry[0], usage = entry[1];
        var tr = document.createElement('tr');
        var cells = [name, usage.calls.toLocaleString(), usage.tokensSaved.toLocaleString()];
        cells.forEach(function (text) {
          var td = document.createElement('td');
          td.textContent = text;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    async function load() {
      var res = await fetch('/api/usage');
      var data = await res.json();
      document.getElementById('namespace').textContent = 'namespace: ' + data.namespace;

      var key = todayKey();
      var todayRow = data.days.find(function (d) { return d.date === key; })
        || { totalCalls: 0, totalTokensSaved: 0, tools: {} };

      document.getElementById('todaySaved').textContent = todayRow.totalTokensSaved.toLocaleString();
      document.getElementById('todayCalls').textContent = todayRow.totalCalls.toLocaleString();
      document.getElementById('allTimeSaved').textContent = data.allTime.totalTokensSaved.toLocaleString();
      document.getElementById('allTimeCalls').textContent = data.allTime.totalCalls.toLocaleString();

      renderChart(data.days);
      renderTable(todayRow.tools);
    }

    load();
  </script>
</body>
</html>`;
}

/** Shown instead of the dashboard once the trial has expired and no license is active. */
export function renderLockedHtml(message: string, purchaseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tokenwise-mcp — License Required</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; margin: 0; padding: 2rem; background: #0f1115; color: #e6e6e6; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .box { max-width: 480px; background: #1a1d24; border: 1px solid #2a2e37; border-radius: 8px; padding: 2rem; text-align: center; }
  h1 { font-size: 1.2rem; margin: 0 0 1rem; }
  p { color: #aaa; line-height: 1.5; }
  a { color: #5b8cff; }
  code { background: #0f1115; padding: 0.1rem 0.3rem; border-radius: 4px; }
</style>
</head>
<body>
  <div class="box">
    <h1>License Required</h1>
    <p>${message}</p>
    <p>Purchase at <a href="${purchaseUrl}">${purchaseUrl}</a>, then activate it via the
    <code>activate_license</code> tool, the <code>TOKENWISE_LICENSE_KEY</code> env var,
    or by saving the key to <code>~/.tokenwise/license.key</code>.</p>
  </div>
</body>
</html>`;
}
