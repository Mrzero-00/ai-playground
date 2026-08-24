using UnityEngine;

namespace RCWeeklyTimeAttack.Vehicle
{
    [CreateAssetMenu(fileName = "CarTuning", menuName = "RC Time Attack/Car Tuning")]
    public sealed class CarTuning : ScriptableObject
    {
        [SerializeField, Min(0f)] private float acceleration = 18f;
        [SerializeField, Min(0.1f)] private float maxForwardSpeed = 22f;
        [SerializeField, Min(0f)] private float brakeDeceleration = 32f;
        [SerializeField, Min(0f)] private float coastDeceleration = 2.2f;
        [SerializeField, Min(1f)] private float steeringDegreesPerSecond = 105f;
        [SerializeField, Min(0f)] private float minimumSteeringSpeed = 0.45f;
        [SerializeField, Min(0f)] private float lateralGrip = 12f;
        [Header("Drift")]
        [SerializeField, Min(0f)] private float driftMinimumSpeed = 8f;
        [SerializeField, Range(0f, 1f)] private float driftSteeringThreshold = 0.42f;
        [SerializeField, Range(0f, 1f)] private float driftBrakeThreshold = 0.25f;
        [SerializeField, Min(0f)] private float driftLateralGrip = 2.4f;
        [SerializeField, Range(0.05f, 1f)] private float driftBrakeMultiplier = 0.38f;
        [SerializeField, Min(1f)] private float driftSteeringMultiplier = 1.35f;
        [SerializeField, Min(0.1f)] private float driftEnterRate = 4.5f;
        [SerializeField, Min(0.1f)] private float driftExitRate = 1.25f;

        public float Acceleration => acceleration;
        public float MaxForwardSpeed => maxForwardSpeed;
        public float BrakeDeceleration => brakeDeceleration;
        public float CoastDeceleration => coastDeceleration;
        public float SteeringDegreesPerSecond => steeringDegreesPerSecond;
        public float MinimumSteeringSpeed => minimumSteeringSpeed;
        public float LateralGrip => lateralGrip;
        public float DriftMinimumSpeed => driftMinimumSpeed;
        public float DriftSteeringThreshold => driftSteeringThreshold;
        public float DriftBrakeThreshold => driftBrakeThreshold;
        public float DriftLateralGrip => driftLateralGrip;
        public float DriftBrakeMultiplier => driftBrakeMultiplier;
        public float DriftSteeringMultiplier => driftSteeringMultiplier;
        public float DriftEnterRate => driftEnterRate;
        public float DriftExitRate => driftExitRate;

        private void OnValidate()
        {
            acceleration = Mathf.Max(0f, acceleration);
            maxForwardSpeed = Mathf.Max(0.1f, maxForwardSpeed);
            brakeDeceleration = Mathf.Max(0f, brakeDeceleration);
            coastDeceleration = Mathf.Max(0f, coastDeceleration);
            steeringDegreesPerSecond = Mathf.Max(1f, steeringDegreesPerSecond);
            minimumSteeringSpeed = Mathf.Max(0f, minimumSteeringSpeed);
            lateralGrip = Mathf.Max(0f, lateralGrip);
            driftMinimumSpeed = Mathf.Max(0f, driftMinimumSpeed);
            driftSteeringThreshold = Mathf.Clamp01(driftSteeringThreshold);
            driftBrakeThreshold = Mathf.Clamp01(driftBrakeThreshold);
            driftLateralGrip = Mathf.Max(0f, driftLateralGrip);
            driftBrakeMultiplier = Mathf.Clamp(driftBrakeMultiplier, 0.05f, 1f);
            driftSteeringMultiplier = Mathf.Max(1f, driftSteeringMultiplier);
            driftEnterRate = Mathf.Max(0.1f, driftEnterRate);
            driftExitRate = Mathf.Max(0.1f, driftExitRate);
        }
    }
}
