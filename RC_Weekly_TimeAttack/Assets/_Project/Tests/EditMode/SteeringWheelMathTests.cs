using NUnit.Framework;
using RCWeeklyTimeAttack.Input;

namespace RCWeeklyTimeAttack.Tests
{
    public sealed class SteeringWheelMathTests
    {
        [Test]
        public void AccumulateDelta_StopsAtMaximumRotation()
        {
            float result = SteeringWheelMath.AccumulateDelta(0f, 0f, 150f, 90f);

            Assert.That(result, Is.EqualTo(90f).Within(0.001f));
        }

        [Test]
        public void AccumulateDelta_CrossesSignedAngleBoundaryWithoutJumping()
        {
            float result = SteeringWheelMath.AccumulateDelta(20f, 179f, -179f, 90f);

            Assert.That(result, Is.EqualTo(22f).Within(0.001f));
        }

        [Test]
        public void NormalizedSteering_MapsCounterClockwiseToLeft()
        {
            float result = SteeringWheelMath.ToNormalizedSteering(45f, 90f, 0f);

            Assert.That(result, Is.EqualTo(-0.5f).Within(0.001f));
        }

        [Test]
        public void NormalizedSteering_UsesDeadZone()
        {
            float result = SteeringWheelMath.ToNormalizedSteering(2f, 90f, 0.05f);

            Assert.That(result, Is.EqualTo(0f));
        }
    }
}
