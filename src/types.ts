export type PredictionType = 'favorite' | 'underdog';
export type PlayoffScore = '2-0' | '2-1';

// Playoff bracket types
export interface PlayoffTeam {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  franchisePrefix: string;
  seed: number;
}

export interface PlayoffMatchup {
  id: string;
  round: number; // 1 = first round, 2 = quarterfinals, etc.
  position: number; // position within the round (0-indexed)
  team1?: PlayoffTeam;
  team2?: PlayoffTeam;
  winner?: string; // teamId of winner
  score?: PlayoffScore; // actual result
  scheduledDate?: string;
}

export interface PlayoffPrediction {
  matchupId: string;
  participantId: string;
  predictedWinner: string; // teamId
  predictedScore: PlayoffScore;
  revealed: boolean;
  correct?: boolean; // null until result is set
  scoreCorrect?: boolean; // bonus for getting exact score
}

export interface PlayoffBracket {
  tier: string;
  matchups: PlayoffMatchup[];
}

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
  playoffScore?: number; // separate score for playoff mode
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
  // Playoff mode
  playoffMode: boolean;
  playoffBracket?: PlayoffBracket;
  playoffPredictions: PlayoffPrediction[];
}

export interface Session {
  id: string;
  name: string;
  state: GameState;
  createdAt: Date;
  updatedAt: Date;
}
