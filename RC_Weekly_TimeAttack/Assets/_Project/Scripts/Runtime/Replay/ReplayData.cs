using System;
using System.Collections.Generic;
using UnityEngine;

namespace RCWeeklyTimeAttack.Replay
{
    [Serializable]
    public struct ReplayFrame
    {
        public float time;
        public Vector3 position;
        public Quaternion rotation;
        public float steering;
        public float throttle;
        public float brake;

        public ReplayFrame(
            float time,
            Vector3 position,
            Quaternion rotation,
            float steering,
            float throttle,
            float brake)
        {
            this.time = time;
            this.position = position;
            this.rotation = rotation;
            this.steering = steering;
            this.throttle = throttle;
            this.brake = brake;
        }
    }

    [Serializable]
    public sealed class ReplayData
    {
        public int schemaVersion = 1;
        public string trackStorageKey;
        public float finishTime;
        public List<ReplayFrame> frames = new();

        public ReplayData()
        {
        }

        public ReplayData(string trackStorageKey, float finishTime, List<ReplayFrame> sourceFrames)
        {
            this.trackStorageKey = trackStorageKey;
            this.finishTime = finishTime;
            frames = new List<ReplayFrame>(sourceFrames);
        }
    }
}
