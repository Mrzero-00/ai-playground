using System;
using UnityEngine;

namespace RCWeeklyTimeAttack.Race
{
    [Serializable]
    public sealed class WeeklyTrackManifest
    {
        [SerializeField] private string weekId;
        [SerializeField] private string trackId;
        [SerializeField] private string trackVersion;
        [SerializeField] private string physicsVersion;
        [SerializeField, Min(1)] private int requiredLapCount;

        public string WeekId => weekId;
        public string TrackId => trackId;
        public string TrackVersion => trackVersion;
        public string PhysicsVersion => physicsVersion;
        public int RequiredLapCount => Mathf.Max(1, requiredLapCount);
        public string StorageKey => $"{weekId}:{trackId}:{trackVersion}:{physicsVersion}";

        public WeeklyTrackManifest(
            string weekId,
            string trackId,
            string trackVersion,
            string physicsVersion,
            int requiredLapCount)
        {
            this.weekId = weekId;
            this.trackId = trackId;
            this.trackVersion = trackVersion;
            this.physicsVersion = physicsVersion;
            this.requiredLapCount = Mathf.Max(1, requiredLapCount);
        }
    }

    public interface IWeeklyTrackProvider
    {
        WeeklyTrackManifest Current { get; }
    }

    public sealed class LocalWeeklyTrackProvider : IWeeklyTrackProvider
    {
        public WeeklyTrackManifest Current { get; } = new(
            "PLAYTEST-WEEK",
            "technical-01",
            "technical-01-v1",
            "arcade-v03-mini",
            1);
    }
}
