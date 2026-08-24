using UnityEngine;

namespace RCWeeklyTimeAttack.Vehicle
{
    public readonly struct VehicleTelemetrySnapshot
    {
        public Vector3 Position { get; }
        public Quaternion Rotation { get; }
        public float ForwardSpeed { get; }
        public float LateralSpeed { get; }
        public float Steering { get; }
        public float Throttle { get; }
        public float Brake { get; }
        public bool IsDrifting { get; }
        public float DriftBlend { get; }
        public float SlipAngle { get; }

        public VehicleTelemetrySnapshot(
            Vector3 position,
            Quaternion rotation,
            float forwardSpeed,
            float lateralSpeed,
            float steering,
            float throttle,
            float brake,
            bool isDrifting,
            float driftBlend,
            float slipAngle)
        {
            Position = position;
            Rotation = rotation;
            ForwardSpeed = forwardSpeed;
            LateralSpeed = lateralSpeed;
            Steering = steering;
            Throttle = throttle;
            Brake = brake;
            IsDrifting = isDrifting;
            DriftBlend = driftBlend;
            SlipAngle = slipAngle;
        }
    }

    public sealed class VehicleTelemetry : MonoBehaviour
    {
        public VehicleTelemetrySnapshot Snapshot { get; private set; }

        public void Publish(VehicleTelemetrySnapshot value)
        {
            Snapshot = value;
        }
    }
}
