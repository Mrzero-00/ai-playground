using System;
using UnityEngine;

namespace RCWeeklyTimeAttack.Input
{
    [Serializable]
    public readonly struct VehicleInputFrame
    {
        private const float BrakePriorityThreshold = 0.01f;

        public static VehicleInputFrame Neutral => new(0f, 0f, 0f);

        public float Steering { get; }
        public float Throttle { get; }
        public float Brake { get; }

        public VehicleInputFrame(float steering, float throttle, float brake)
        {
            Steering = Mathf.Clamp(steering, -1f, 1f);
            Brake = Mathf.Clamp01(brake);
            Throttle = Brake > BrakePriorityThreshold ? 0f : Mathf.Clamp01(throttle);
        }
    }
}

