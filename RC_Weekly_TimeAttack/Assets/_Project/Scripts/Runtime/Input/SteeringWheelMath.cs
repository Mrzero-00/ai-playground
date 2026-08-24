using UnityEngine;

namespace RCWeeklyTimeAttack.Input
{
    public static class SteeringWheelMath
    {
        public static float PointerAngle(Vector2 localPoint)
        {
            return Mathf.Atan2(localPoint.y, localPoint.x) * Mathf.Rad2Deg;
        }

        public static float AccumulateDelta(
            float wheelAngle,
            float previousPointerAngle,
            float currentPointerAngle,
            float maxRotation)
        {
            float stepDelta = Mathf.DeltaAngle(previousPointerAngle, currentPointerAngle);
            return Mathf.Clamp(wheelAngle + stepDelta, -Mathf.Abs(maxRotation), Mathf.Abs(maxRotation));
        }

        public static float ToNormalizedSteering(float wheelAngle, float maxRotation, float deadZone)
        {
            if (maxRotation <= Mathf.Epsilon)
            {
                return 0f;
            }

            float raw = Mathf.Clamp(-wheelAngle / maxRotation, -1f, 1f);
            float magnitude = Mathf.Abs(raw);
            float clampedDeadZone = Mathf.Clamp(deadZone, 0f, 0.95f);
            if (magnitude <= clampedDeadZone)
            {
                return 0f;
            }

            float remapped = Mathf.InverseLerp(clampedDeadZone, 1f, magnitude);
            return Mathf.Sign(raw) * remapped;
        }
    }
}
