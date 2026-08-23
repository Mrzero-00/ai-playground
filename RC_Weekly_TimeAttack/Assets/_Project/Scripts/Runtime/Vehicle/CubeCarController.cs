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

        public CarTuning Tuning => tuning;

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

        private void FixedUpdate()
        {
            VehicleInputFrame input = inputRouter.Current;
            float deltaTime = Time.fixedDeltaTime;
            Vector3 velocity = body.linearVelocity;
            Vector3 verticalVelocity = Vector3.Project(velocity, Vector3.up);
            Vector3 planarVelocity = velocity - verticalVelocity;

            float forwardSpeed = Vector3.Dot(planarVelocity, transform.forward);
            float lateralSpeed = Vector3.Dot(planarVelocity, transform.right);

            if (input.Brake > 0f)
            {
                forwardSpeed = Mathf.MoveTowards(
                    forwardSpeed,
                    0f,
                    tuning.BrakeDeceleration * input.Brake * deltaTime);
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
            lateralSpeed = Mathf.MoveTowards(
                lateralSpeed,
                0f,
                tuning.LateralGrip * deltaTime);

            body.linearVelocity =
                transform.forward * forwardSpeed +
                transform.right * lateralSpeed +
                verticalVelocity;

            if (forwardSpeed > tuning.MinimumSteeringSpeed && Mathf.Abs(input.Steering) > 0.001f)
            {
                float speedRatio = Mathf.Clamp01(forwardSpeed / tuning.MaxForwardSpeed);
                float steeringAuthority = Mathf.Lerp(0.35f, 1f, speedRatio);
                float yawDelta = input.Steering *
                                 tuning.SteeringDegreesPerSecond *
                                 steeringAuthority *
                                 deltaTime;
                body.MoveRotation(body.rotation * Quaternion.Euler(0f, yawDelta, 0f));
            }

            telemetry.Publish(new VehicleTelemetrySnapshot(
                body.position,
                body.rotation,
                forwardSpeed,
                lateralSpeed,
                input.Steering,
                input.Throttle,
                input.Brake));
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

