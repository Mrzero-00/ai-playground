using System;

namespace RCWeeklyTimeAttack.Race
{
    public sealed class CheckpointProgress
    {
        public int CheckpointCount { get; }
        public int RequiredLapCount { get; }
        public int CurrentLap { get; private set; }
        public int NextCheckpoint { get; private set; }

        public CheckpointProgress(int checkpointCount, int requiredLapCount)
        {
            if (checkpointCount < 1)
            {
                throw new ArgumentOutOfRangeException(nameof(checkpointCount));
            }

            CheckpointCount = checkpointCount;
            RequiredLapCount = Math.Max(1, requiredLapCount);
            Reset();
        }

        public void Reset()
        {
            CurrentLap = 1;
            NextCheckpoint = 1;
        }

        public bool TryPass(int gateIndex, out bool lapCompleted, out bool raceCompleted)
        {
            lapCompleted = false;
            raceCompleted = false;

            if (gateIndex > 0)
            {
                if (gateIndex > CheckpointCount || gateIndex != NextCheckpoint)
                {
                    return false;
                }

                NextCheckpoint++;
                return true;
            }

            if (gateIndex != 0 || NextCheckpoint != CheckpointCount + 1)
            {
                return false;
            }

            lapCompleted = true;
            if (CurrentLap >= RequiredLapCount)
            {
                raceCompleted = true;
                return true;
            }

            CurrentLap++;
            NextCheckpoint = 1;
            return true;
        }
    }
}
