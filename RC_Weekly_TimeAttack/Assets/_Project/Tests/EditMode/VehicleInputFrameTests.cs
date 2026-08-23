using NUnit.Framework;
using RCWeeklyTimeAttack.Input;

namespace RCWeeklyTimeAttack.Tests
{
    public sealed class VehicleInputFrameTests
    {
        [Test]
        public void Constructor_ClampsEveryAxis()
        {
            VehicleInputFrame frame = new(2f, 3f, -1f);

            Assert.That(frame.Steering, Is.EqualTo(1f));
            Assert.That(frame.Throttle, Is.EqualTo(1f));
            Assert.That(frame.Brake, Is.EqualTo(0f));
        }

        [Test]
        public void Constructor_GivesBrakePriorityOverThrottle()
        {
            VehicleInputFrame frame = new(0.25f, 1f, 0.5f);

            Assert.That(frame.Steering, Is.EqualTo(0.25f));
            Assert.That(frame.Throttle, Is.EqualTo(0f));
            Assert.That(frame.Brake, Is.EqualTo(0.5f));
        }
    }
}

