using NUnit.Framework;
using RCWeeklyTimeAttack.Race;

namespace RCWeeklyTimeAttack.Tests
{
    public sealed class RaceTimeFormatterTests
    {
        [TestCase(0f, "00:00.000")]
        [TestCase(34.812f, "00:34.812")]
        [TestCase(65.481f, "01:05.481")]
        public void Format_UsesWholeRaceTime(float input, string expected)
        {
            Assert.That(RaceTimeFormatter.Format(input), Is.EqualTo(expected));
        }

        [Test]
        public void Format_UsesPlaceholderForMissingTime()
        {
            Assert.That(RaceTimeFormatter.Format(-1f), Is.EqualTo("--:--.---"));
        }
    }
}
