using System;
using RCWeeklyTimeAttack.Race;
using UnityEngine;

namespace RCWeeklyTimeAttack.Replay
{
    public interface IReplayRepository
    {
        ReplayData Load();
        void Save(ReplayData data);
    }

    public sealed class PlayerPrefsReplayRepository : IReplayRepository
    {
        private readonly string key;
        private readonly string expectedTrackStorageKey;

        public PlayerPrefsReplayRepository(WeeklyTrackManifest manifest)
        {
            expectedTrackStorageKey = manifest.StorageKey;
            key = $"rc-weekly:replay:{expectedTrackStorageKey}";
        }

        public ReplayData Load()
        {
            string json = PlayerPrefs.GetString(key, string.Empty);
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                ReplayData data = JsonUtility.FromJson<ReplayData>(json);
                return data != null &&
                       data.schemaVersion == 1 &&
                       data.trackStorageKey == expectedTrackStorageKey &&
                       data.frames != null &&
                       data.frames.Count >= 2
                    ? data
                    : null;
            }
            catch (Exception)
            {
                return null;
            }
        }

        public void Save(ReplayData data)
        {
            if (data == null)
            {
                return;
            }

            PlayerPrefs.SetString(key, JsonUtility.ToJson(data));
            PlayerPrefs.Save();
        }
    }
}
