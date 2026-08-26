using RCWeeklyTimeAttack.Input;
using UnityEngine;

namespace RCWeeklyTimeAttack.Vehicle
{
    [DisallowMultipleComponent]
    public sealed class RcWheelVisualAnimator : MonoBehaviour
    {
        private const float MaximumSteeringAngle = 23f;

        private Rigidbody sourceBody;
        private VehicleInputRouter inputRouter;
        private Transform motionSource;
        private Transform[] wheels;
        private Quaternion[] baseLocalRotations;
        private float wheelRadius = 0.265f;
        private float spinDegrees;
        private Vector3 previousPosition;
        private bool hasPreviousPosition;

        internal void ConfigurePlayer(
            Rigidbody body,
            VehicleInputRouter router,
            BlueRallyVisualInstance visual,
            float visualScale)
        {
            sourceBody = body;
            inputRouter = router;
            motionSource = transform;
            wheelRadius = Mathf.Max(0.01f, 0.42f * visualScale);
            ConfigureWheels(visual);
        }

        internal void ConfigureGhost(
            Transform ghostMotionSource,
            BlueRallyVisualInstance visual,
            float visualScale)
        {
            sourceBody = null;
            inputRouter = null;
            motionSource = ghostMotionSource;
            wheelRadius = Mathf.Max(0.01f, 0.42f * visualScale);
            ConfigureWheels(visual);
        }

        private void ConfigureWheels(BlueRallyVisualInstance visual)
        {
            wheels = new[]
            {
                visual.FrontLeftWheel,
                visual.FrontRightWheel,
                visual.RearLeftWheel,
                visual.RearRightWheel
            };
            baseLocalRotations = new Quaternion[wheels.Length];
            for (int index = 0; index < wheels.Length; index++)
            {
                baseLocalRotations[index] = wheels[index] != null
                    ? wheels[index].localRotation
                    : Quaternion.identity;
            }
            ResetMotionSample();
        }

        private void OnEnable()
        {
            ResetMotionSample();
        }

        private void LateUpdate()
        {
            if (wheels == null || baseLocalRotations == null || motionSource == null)
            {
                return;
            }

            float forwardSpeed = ResolveForwardSpeed();
            spinDegrees = Mathf.Repeat(
                spinDegrees + forwardSpeed / wheelRadius * Mathf.Rad2Deg * Time.deltaTime,
                360f);
            float steeringAngle = inputRouter != null
                ? inputRouter.Current.Steering * MaximumSteeringAngle
                : 0f;

            for (int index = 0; index < wheels.Length; index++)
            {
                Transform wheel = wheels[index];
                if (wheel == null)
                {
                    continue;
                }

                Quaternion steeringRotation = index < 2
                    ? Quaternion.AngleAxis(steeringAngle, Vector3.up)
                    : Quaternion.identity;
                Quaternion spinRotation = Quaternion.AngleAxis(spinDegrees, Vector3.right);
                wheel.localRotation = steeringRotation * baseLocalRotations[index] * spinRotation;
            }
        }

        private float ResolveForwardSpeed()
        {
            if (sourceBody != null)
            {
                return Vector3.Dot(sourceBody.linearVelocity, transform.forward);
            }

            Vector3 currentPosition = motionSource.position;
            if (!hasPreviousPosition || Time.deltaTime <= Mathf.Epsilon)
            {
                previousPosition = currentPosition;
                hasPreviousPosition = true;
                return 0f;
            }

            Vector3 delta = currentPosition - previousPosition;
            previousPosition = currentPosition;
            return Vector3.Dot(delta / Time.deltaTime, motionSource.forward);
        }

        private void ResetMotionSample()
        {
            hasPreviousPosition = motionSource != null;
            previousPosition = motionSource != null ? motionSource.position : Vector3.zero;
        }
    }
}
