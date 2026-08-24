using NUnit.Framework;
using RCWeeklyTimeAttack.Race;

namespace RCWeeklyTimeAttack.Tests
{
    public sealed class CheckpointProgressTests
    {
        [Test]
        public void Finish_IsRejectedUntilEveryCheckpointPassesInOrder()
        {
            CheckpointProgress progress = new(3, 1);

            Assert.That(progress.TryPass(1, out _, out _), Is.True);
            Assert.That(progress.TryPass(3, out _, out _), Is.False);
            Assert.That(progress.TryPass(0, out _, out _), Is.False);
            Assert.That(progress.NextCheckpoint, Is.EqualTo(2));
        }

        [Test]
        public void OrderedCheckpoints_CompleteWholeRace()
        {
            CheckpointProgress progress = new(2, 1);

            progress.TryPass(1, out _, out _);
            progress.TryPass(2, out _, out _);
            bool accepted = progress.TryPass(0, out bool lapCompleted, out bool raceCompleted);

            Assert.That(accepted, Is.True);
            Assert.That(lapCompleted, Is.True);
            Assert.That(raceCompleted, Is.True);
        }

        [Test]
        public void MultiLapRace_ResetsCheckpointSequenceForNextLap()
        {
            CheckpointProgress progress = new(1, 2);

            progress.TryPass(1, out _, out _);
            progress.TryPass(0, out _, out bool firstLapFinishedRace);

            Assert.That(firstLapFinishedRace, Is.False);
            Assert.That(progress.CurrentLap, Is.EqualTo(2));
            Assert.That(progress.NextCheckpoint, Is.EqualTo(1));
        }
    }
}
