import express, { Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import type { GameState, Participant } from './types';
import { createSession, getSession, getAllSessions, updateSession, deleteSession } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// SSE clients for real-time updates
const sseClients: Map<string, Set<Response>> = new Map();

function broadcastToSession(sessionId: string, event: string, data: unknown) {
  const clients = sseClients.get(sessionId);
  if (clients) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
      client.write(message);
    });
  }
}

function broadcastStateUpdate(sessionId: string) {
  const session = getSession(sessionId);
  if (session) {
    broadcastToSession(sessionId, 'state-update', session.state);
  }
}

const defaultHost: Participant = {
  id: 'host',
  name: 'Host',
  role: 'host',
  score: 0,
  predictions: [],
  slotCount: 2,
};

const defaultCohost: Participant = {
  id: 'cohost',
  name: 'Co-Host',
  role: 'cohost',
  score: 0,
  predictions: [],
  slotCount: 2,
};

const defaultGuest: Participant = {
  id: 'guest',
  name: 'Guest',
  role: 'guest',
  score: 0,
  predictions: [],
  slotCount: 2,
};

const initialGameState: GameState = {
  participants: [defaultHost, defaultCohost],
  currentWeek: 1,
  currentTurn: 'host',
  guestEnabled: false,
  revealInProgress: false,
  currentRevealIndex: -1,
  broadcastTitle: 'CSC PREDICTION CHALLENGE',
};

// SSE endpoint for real-time updates
app.get('/api/sessions/:id/events', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const sessionId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial state
  res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);
  res.write(`event: state-update\ndata: ${JSON.stringify(session.state)}\n\n`);

  // Add client to the set
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId)!.add(res);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  }, 30000);

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(sessionId);
      }
    }
  });
});

// Create a new session
app.post('/api/sessions', (req, res) => {
  const { name } = req.body;
  const id = uuidv4();
  const sessionCount = getAllSessions().length;
  const session = createSession(
    id,
    name || `Session ${sessionCount + 1}`,
    JSON.parse(JSON.stringify(initialGameState))
  );
  res.status(201).json(session);
});

// Get all sessions
app.get('/api/sessions', (_req, res) => {
  res.json(getAllSessions());
});

// Get a specific session
app.get('/api/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// Delete a session
app.delete('/api/sessions/:id', (req, res) => {
  if (!deleteSession(req.params.id)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.status(204).send();
});

// Get current game state for a session
app.get('/api/sessions/:id/state', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session.state);
});

// Update entire game state (full sync)
app.put('/api/sessions/:id/state', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  updateSession(req.params.id, req.body);
  broadcastStateUpdate(req.params.id);
  res.json(req.body);
});

// Patch game state (partial update)
app.patch('/api/sessions/:id/state', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const newState = { ...session.state, ...req.body };
  updateSession(req.params.id, newState);
  broadcastStateUpdate(req.params.id);
  res.json(newState);
});

// Update settings (week, title, guest toggle)
app.patch('/api/sessions/:id/settings', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { currentWeek, broadcastTitle, guestEnabled } = req.body;
  const state = session.state;

  if (currentWeek !== undefined) {
    state.currentWeek = currentWeek;
  }
  if (broadcastTitle !== undefined) {
    state.broadcastTitle = broadcastTitle;
  }
  if (guestEnabled !== undefined) {
    const hasGuest = state.participants.some(p => p.role === 'guest');
    if (guestEnabled && !hasGuest) {
      state.guestEnabled = true;
      state.participants.push({ ...defaultGuest });
    } else if (!guestEnabled && hasGuest) {
      state.guestEnabled = false;
      state.participants = state.participants.filter(p => p.role !== 'guest');
    } else {
      state.guestEnabled = guestEnabled;
    }
  }

  updateSession(req.params.id, state);
  broadcastStateUpdate(req.params.id);
  res.json(state);
});

// Get all participants
app.get('/api/sessions/:id/participants', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session.state.participants);
});

// Get a specific participant
app.get('/api/sessions/:id/participants/:participantId', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const participant = session.state.participants.find(p => p.id === req.params.participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }
  res.json(participant);
});

// Update a participant (name, score, slotCount, ownTeam)
app.patch('/api/sessions/:id/participants/:participantId', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participantIndex = session.state.participants.findIndex(p => p.id === req.params.participantId);
  if (participantIndex === -1) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const { name, score, slotCount, ownTeamId, ownTeamName } = req.body;
  const participant = session.state.participants[participantIndex];

  if (name !== undefined) participant.name = name;
  if (score !== undefined) participant.score = score;
  if (slotCount !== undefined) participant.slotCount = slotCount;
  if (ownTeamId !== undefined) participant.ownTeamId = ownTeamId;
  if (ownTeamName !== undefined) participant.ownTeamName = ownTeamName;

  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.json(participant);
});

// Add a prediction to a participant
app.post('/api/sessions/:id/participants/:participantId/predictions', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participant = session.state.participants.find(p => p.id === req.params.participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const prediction = {
    ...req.body,
    id: req.body.id || uuidv4(),
    revealed: req.body.revealed ?? false,
  };

  participant.predictions.push(prediction);
  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.status(201).json(prediction);
});

// Remove a prediction from a participant
app.delete('/api/sessions/:id/participants/:participantId/predictions/:predictionId', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participant = session.state.participants.find(p => p.id === req.params.participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const predIndex = participant.predictions.findIndex(p => p.id === req.params.predictionId);
  if (predIndex === -1) {
    return res.status(404).json({ error: 'Prediction not found' });
  }

  participant.predictions.splice(predIndex, 1);
  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.status(204).send();
});

// Update a prediction (reveal status, result)
app.patch('/api/sessions/:id/participants/:participantId/predictions/:predictionId', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participant = session.state.participants.find(p => p.id === req.params.participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  const prediction = participant.predictions.find(p => p.id === req.params.predictionId);
  if (!prediction) {
    return res.status(404).json({ error: 'Prediction not found' });
  }

  const { revealed, result, reasoning } = req.body;
  if (revealed !== undefined) prediction.revealed = revealed;
  if (result !== undefined) prediction.result = result;
  if (reasoning !== undefined) prediction.reasoning = reasoning;

  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.json(prediction);
});

// Set own team prediction
app.put('/api/sessions/:id/participants/:participantId/own-team-prediction', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participant = session.state.participants.find(p => p.id === req.params.participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  participant.ownTeamPrediction = {
    ...req.body,
    id: req.body.id || uuidv4(),
    revealed: req.body.revealed ?? false,
  };

  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.json(participant.ownTeamPrediction);
});

// Delete own team prediction
app.delete('/api/sessions/:id/participants/:participantId/own-team-prediction', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participant = session.state.participants.find(p => p.id === req.params.participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  participant.ownTeamPrediction = undefined;
  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.status(204).send();
});

// Update own team prediction (reveal, actual result)
app.patch('/api/sessions/:id/participants/:participantId/own-team-prediction', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participant = session.state.participants.find(p => p.id === req.params.participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  if (!participant.ownTeamPrediction) {
    return res.status(404).json({ error: 'Own team prediction not found' });
  }

  const { revealed, actualRecord, reasoning } = req.body;
  if (revealed !== undefined) participant.ownTeamPrediction.revealed = revealed;
  if (actualRecord !== undefined) participant.ownTeamPrediction.actualRecord = actualRecord;
  if (reasoning !== undefined) participant.ownTeamPrediction.reasoning = reasoning;

  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.json(participant.ownTeamPrediction);
});

// Clear all predictions for a session
app.post('/api/sessions/:id/clear-predictions', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.state.participants.forEach(p => {
    p.predictions = [];
    p.ownTeamPrediction = undefined;
  });

  updateSession(req.params.id, session.state);
  broadcastStateUpdate(req.params.id);
  res.json(session.state);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`CSC Team Prediction API running on http://localhost:${PORT}`);
});
