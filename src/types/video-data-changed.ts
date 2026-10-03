// Copyright (c) 2026 bwedirhan. MIT License.
import type { VideoDataChangeValue } from '@/types/player-api-events';

export interface VideoDataChanged {
  name: string;
  videoData?: VideoDataChangeValue;
}
