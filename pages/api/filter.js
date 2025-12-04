<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Toyota 11Labs Filter</title>
  <style>body{font-family:Arial;text-align:center;padding:80px;background:#f4f4f4}</style>
</head>
<body>
  <h1>Lakeland Toyota → ElevenLabs Filter</h1>
  <p>Upload raw CSV → download clean list</p>
  <input type="file" id="f" accept=".csv"><br><br>
  <button onclick="go()" style="padding:15px 30px;font-size:18px">Process & Download</button>
  <p id="s"></p>
  <script>
  async function go(){
    const file = document.getElementById('f').files[0];
    if(!file) return alert("Pick a file");
    document.getElementById('s').innerHTML = "Working...";
    const form = new FormData();
    form.append('file', file);
    const r = await fetch('/api/filter', {method:'POST', body:form});
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Filtered For 11Labs.csv';
    a.click();
    document.getElementById('s').innerHTML = "Downloaded!";
  }
  </script>
</body>
</html>
