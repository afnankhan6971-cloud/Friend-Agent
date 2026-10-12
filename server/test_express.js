const express = require('express');
const app = express();
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  res.status(500).json({ error: "Failed to generate AI response." });
});
const server = app.listen(3002, () => {
  const http = require('http');
  http.get('http://localhost:3002', (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.on('data', (chunk) => console.log(`BODY: ${chunk}`));
    res.on('end', () => {
      console.log('END');
      server.close();
    });
  });
});
