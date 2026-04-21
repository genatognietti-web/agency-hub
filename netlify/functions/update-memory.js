// netlify/functions/update-memory.js
// Receives task updates from the hub and commits them to ellara-memory.json on GitHub
// Required environment variables in Netlify:
//   GITHUB_TOKEN — a Personal Access Token with repo write scope
//   GITHUB_REPO  — e.g. "genatognietti-web/ellara-agent"

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || 'genatognietti-web/ellara-agent';

  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GITHUB_TOKEN not set in Netlify environment variables.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // payload shape:
  // {
  //   taskUpdates: { "p1_a7": true, "p1_w1": false, ... },   // optional
  //   newDecision: { date, category, decision, owner, status }, // optional
  //   businessUpdate: { key: value, ... },                     // optional
  //   lastUpdated: "April 21, 2026"
  // }

  const FILE_PATH = 'ellara-memory.json';
  const API_BASE  = `https://api.github.com/repos/${repo}/contents/${FILE_PATH}`;

  try {
    // 1. Fetch current file from GitHub
    const getRes = await fetch(API_BASE, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'TheWholeGame-Hub'
      }
    });

    if (!getRes.ok) {
      const err = await getRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'GitHub fetch failed: ' + err }) };
    }

    const fileData = await getRes.json();
    const currentContent = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
    const sha = fileData.sha;

    // 2. Apply updates to the memory object

    // Update last_updated
    if (payload.lastUpdated) {
      currentContent._meta.last_updated = payload.lastUpdated;
    }

    // Apply task updates across all phases
    if (payload.taskUpdates && typeof payload.taskUpdates === 'object') {
      ['phase1', 'phase2', 'phase3'].forEach(phase => {
        if (!currentContent.tasks[phase]) return;
        currentContent.tasks[phase].forEach(task => {
          if (payload.taskUpdates.hasOwnProperty(task.id)) {
            task.done = payload.taskUpdates[task.id];
          }
        });
      });
    }

    // Add new decision
    if (payload.newDecision) {
      if (!currentContent.decisions) currentContent.decisions = [];
      currentContent.decisions.push(payload.newDecision);
    }

    // Apply business updates (e.g. revenue, website_status)
    if (payload.businessUpdate && typeof payload.businessUpdate === 'object') {
      Object.assign(currentContent.business, payload.businessUpdate);
    }

    // 3. Commit updated file back to GitHub
    const updatedContent = Buffer.from(JSON.stringify(currentContent, null, 2)).toString('base64');

    const putRes = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'TheWholeGame-Hub'
      },
      body: JSON.stringify({
        message: `Memory update — ${payload.lastUpdated || new Date().toLocaleDateString()}`,
        content: updatedContent,
        sha: sha
      })
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'GitHub commit failed: ' + err }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Memory updated on GitHub.' })
    };

  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected error: ' + err.message })
    };
  }
};
