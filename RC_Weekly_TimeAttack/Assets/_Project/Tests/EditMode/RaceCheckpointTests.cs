using NUnit.Framework;
using RCWeeklyTimeAttack.Race;
using UnityEngine;

namespace RCWeeklyTimeAttack.Tests
{
    public sealed class RaceCheckpointTests
    {
        [Test]
        public void ForwardVelocity_IsAccepted()
        {
            Assert.That(RaceCheckpoint.IsDirectionValid(Vector3.right, new Vector3(3f, 0f, 0.5f)), Is.True);
        }

        [Test]
        public void ReverseVelocity_IsRejected()
        {
            Assert.That(RaceCheckpoint.IsDirectionValid(Vector3.right, Vector3.left * 3f), Is.False);
        }

        [Test]
        public void StationaryVehicle_IsRejected()
        {
            Assert.That(RaceCheckpoint.IsDirectionValid(Vector3.right, Vector3.zero), Is.False);
        }
    }
}
