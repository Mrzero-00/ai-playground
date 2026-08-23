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

        public float Acceleration => acceleration;
        public float MaxForwardSpeed => maxForwardSpeed;
        public float BrakeDeceleration => brakeDeceleration;
        public float CoastDeceleration => coastDeceleration;
        public float SteeringDegreesPerSecond => steeringDegreesPerSecond;
        public float MinimumSteeringSpeed => minimumSteeringSpeed;
        public float LateralGrip => lateralGrip;

        private void OnValidate()
        {
            acceleration = Mathf.Max(0f, acceleration);
            maxForwardSpeed = Mathf.Max(0.1f, maxForwardSpeed);
            brakeDeceleration = Mathf.Max(0f, brakeDeceleration);
            coastDeceleration = Mathf.Max(0f, coastDeceleration);
            steeringDegreesPerSecond = Mathf.Max(1f, steeringDegreesPerSecond);
            minimumSteeringSpeed = Mathf.Max(0f, minimumSteeringSpeed);
            lateralGrip = Mathf.Max(0f, lateralGrip);
        }
    }
}
