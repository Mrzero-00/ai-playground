using System;
using System.Collections.Generic;
using UnityEngine;

namespace RCWeeklyTimeAttack.Race
{
    public interface IRaceRecordRepository
    {
        float LoadBestTime();
        bool Submit(float finishTime);
        List<float> LoadTopTimes();
    }

    public sealed class PlayerPrefsRaceRecordRepository : IRaceRecordRepository
    {
        private const int MaximumRecords = 5;
        private readonly string key;

        public PlayerPrefsRaceRecordRepository(WeeklyTrackManifest manifest)
        {
            key = $"rc-weekly:times:{manifest.StorageKey}";
        }

        public float LoadBestTime()
        {
            List<float> times = LoadTimes();
            return times.Count > 0 ? times[0] : -1f;
        }

        public bool Submit(float finishTime)
        {
            if (finishTime <= 0f || float.IsNaN(finishTime) || float.IsInfinity(finishTime))
            {
                return false;
            }

            List<float> times = LoadTimes();
            bool isNewBest = times.Count == 0 || finishTime < times[0];
            times.Add(finishTime);
            times.Sort();
            if (times.Count > MaximumRecords)
            {
                times.RemoveRange(MaximumRecords, times.Count - MaximumRecords);
            }

            SaveTimes(times);
            return isNewBest;
        }

        public List<float> LoadTopTimes()
        {
            return LoadTimes();
        }

        private List<float> LoadTimes()
        {
            string json = PlayerPrefs.GetString(key, string.Empty);
            if (string.IsNullOrWhiteSpace(json))
            {
                return new List<float>();
            }

            try
            {
                RecordEnvelope envelope = JsonUtility.FromJson<RecordEnvelope>(json);
                List<float> result = envelope?.times ?? new List<float>();
                result.RemoveAll(value => value <= 0f || float.IsNaN(value) || float.IsInfinity(value));
                result.Sort();
                return result;
            }
            catch (Exception)
            {
                return new List<float>();
            }
        }

        private void SaveTimes(List<float> times)
        {
            PlayerPrefs.SetString(key, JsonUtility.ToJson(new RecordEnvelope { times = times }));
            PlayerPrefs.Save();
        }

        [Serializable]
        private sealed class RecordEnvelope
        {
            public List<float> times = new();
        }
    }
}
