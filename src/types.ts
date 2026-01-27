export type PredictionType = 'favorite' | 'underdog';

export interface Prediction {
  id: string;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  franchisePrefix: string;
  type: PredictionType;
  reasoning?: string;
  revealed: boolean;
  result?: '2-0' | '1-1' | '0-2';
}

export interface OwnTeamPrediction {
  id: string;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  franchisePrefix: string;
  predictedRecord: '2-0' | '1-1' | '0-2';
  reasoning?: string;
  revealed: boolean;
  actualRecord?: '2-0' | '1-1' | '0-2';
}

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'cohost' | 'guest';
  score: number;
  ownTeamId?: string;
  ownTeamName?: string;
  predictions: Prediction[];
  ownTeamPrediction?: OwnTeamPrediction;
  slotCount: number;
}

export interface GameState {
  participants: Participant[];
  currentWeek: number;
  currentTurn: string;
  guestEnabled: boolean;
  revealInProgress: boolean;
  currentRevealIndex: number;
  broadcastTitle: string;
  selectedTier?: string;
}

export interface Session {
  id: string;
  name: string;
  state: GameState;
  createdAt: Date;
  updatedAt: Date;
}
