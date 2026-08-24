using RCWeeklyTimeAttack.Input;
using UnityEngine;

namespace RCWeeklyTimeAttack.Vehicle
{
    [RequireComponent(typeof(Rigidbody), typeof(VehicleInputRouter), typeof(VehicleTelemetry))]
    public sealed class CubeCarController : MonoBehaviour
    {
        [SerializeField] private CarTuning tuning;

        private Rigidbody body;
        private VehicleInputRouter inputRouter;
        private VehicleTelemetry telemetry;
        private CarTuning runtimeFallbackTuning;
        private bool controlEnabled = true;
        private float driftBlend;

        public CarTuning Tuning => tuning;
        public bool ControlEnabled => controlEnabled;

        private void Awake()
        {
            body = GetComponent<Rigidbody>();
            inputRouter = GetComponent<VehicleInputRouter>();
            telemetry = GetComponent<VehicleTelemetry>();

            if (tuning == null)
            {
                runtimeFallbackTuning = ScriptableObject.CreateInstance<CarTuning>();
                runtimeFallbackTuning.name = "Runtime Car Tuning";
                tuning = runtimeFallbackTuning;
            }
        }

        public void Configure(CarTuning value)
        {
            if (value != null)
            {
                tuning = value;
            }
        }

        public void SetControlEnabled(bool value)
        {
            controlEnabled = value;
            if (!controlEnabled)
            {
                inputRouter?.ResetAllInput();
            }
        }

        private void FixedUpdate()
        {
            VehicleInputFrame input = controlEnabled ? inputRouter.Current : VehicleInputFrame.Neutral;
            float deltaTime = Time.fixedDeltaTime;
            Vector3 velocity = body.linearVelocity;
            Vector3 verticalVelocity = Vector3.Project(velocity, Vector3.up);
            Vector3 planarVelocity = velocity - verticalVelocity;

            float forwardSpeed = Vector3.Dot(planarVelocity, transform.forward);
            float lateralSpeed = Vector3.Dot(planarVelocity, transform.right);

            bool initiatingDrift =
                forwardSpeed > tuning.DriftMinimumSpeed &&
                Mathf.Abs(input.Steering) >= tuning.DriftSteeringThreshold &&
                input.Brake >= tuning.DriftBrakeThreshold;
            bool sustainingDrift =
                driftBlend > 0.05f &&
                forwardSpeed > tuning.DriftMinimumSpeed * 0.65f &&
                Mathf.Abs(input.Steering) > 0.12f &&
                input.Throttle > 0.1f;
            float targetDrift = initiatingDrift || sustainingDrift ? 1f : 0f;
            float driftChangeRate = targetDrift > driftBlend
                ? tuning.DriftEnterRate
                : tuning.DriftExitRate;
            driftBlend = Mathf.MoveTowards(driftBlend, targetDrift, driftChangeRate * deltaTime);

            if (input.Brake > 0f)
            {
                float brakingMultiplier = Mathf.Lerp(1f, tuning.DriftBrakeMultiplier, driftBlend);
                forwardSpeed = Mathf.MoveTowards(
                    forwardSpeed,
                    0f,
                    tuning.BrakeDeceleration * brakingMultiplier * input.Brake * deltaTime);
            }
            else if (input.Throttle > 0f)
            {
                forwardSpeed += tuning.Acceleration * input.Throttle * deltaTime;
            }
            else
            {
                forwardSpeed = Mathf.MoveTowards(
                    forwardSpeed,
                    0f,
                    tuning.CoastDeceleration * deltaTime);
            }

            forwardSpeed = Mathf.Clamp(forwardSpeed, 0f, tuning.MaxForwardSpeed);
            float activeLateralGrip = Mathf.Lerp(tuning.LateralGrip, tuning.DriftLateralGrip, driftBlend);
            lateralSpeed = Mathf.MoveTowards(
                lateralSpeed,
                0f,
                activeLateralGrip * deltaTime);

            body.linearVelocity =
                transform.forward * forwardSpeed +
                transform.right * lateralSpeed +
                verticalVelocity;

            if (forwardSpeed > tuning.MinimumSteeringSpeed && Mathf.Abs(input.Steering) > 0.001f)
            {
                float speedRatio = Mathf.Clamp01(forwardSpeed / tuning.MaxForwardSpeed);
                float steeringAuthority = Mathf.Lerp(0.35f, 1f, speedRatio);
                float driftSteering = Mathf.Lerp(1f, tuning.DriftSteeringMultiplier, driftBlend);
                float yawDelta = input.Steering *
                                 tuning.SteeringDegreesPerSecond *
                                 steeringAuthority *
                                 driftSteering *
                                 deltaTime;
                body.MoveRotation(body.rotation * Quaternion.Euler(0f, yawDelta, 0f));
            }

            float slipAngle = Mathf.Atan2(lateralSpeed, Mathf.Max(0.1f, Mathf.Abs(forwardSpeed))) * Mathf.Rad2Deg;
            bool isDrifting = driftBlend > 0.35f && Mathf.Abs(slipAngle) > 2f;
            telemetry.Publish(new VehicleTelemetrySnapshot(
                body.position,
                body.rotation,
                forwardSpeed,
                lateralSpeed,
                input.Steering,
                input.Throttle,
                input.Brake,
                isDrifting,
                driftBlend,
                slipAngle));
        }

        private void OnDestroy()
        {
            if (runtimeFallbackTuning != null)
            {
                Destroy(runtimeFallbackTuning);
            }
        }
    }
}
